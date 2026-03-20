/**
 * @file packages/feature-bots/src/lib/error-mapper.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Error Mapper (Production-Grade Rule-Engine)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Lib-слой feature-bots: преобразует boundary-ошибки (например `BotErrorResponse`) и `unknown`
 *   в доменно-стабильный `BotError` для effects/store/UI.
 * - Rule-engine с приоритетами: правила инъектируются через config (DI) и сортируются по `priority`.
 * - Детерминизм: вход + config → один и тот же результат.
 *   В модуле используются только внутренние memoization-кэши (`WeakMap`) для производительности;
 *   они не меняют результат и не создают внешних side-effects.
 * - Microservice-ready: не зависит от HTTP/DB и не протаскивает transport/raw данные в доменные типы.
 *
 * Принципы:
 * - ✅ SRP: этот модуль отвечает только за *маппинг* ошибок.
 * - ✅ Single source of truth для retryability: `getBotRetryable(code)` из `domain/BotRetry`.
 * - ✅ Extensible: новые правила добавляются как элементы массива, не меняя core-алгоритм.
 * - ✅ Strict typing: входные типы ограничены, выход — строгий `BotError`.
 *
 * @remarks
 * - `BotError.message` намеренно отсутствует: UI строит человеко-читаемые сообщения через i18n по `code`.
 * - Runtime-guards (`isBotErrorResponse`, allow-lists) защищают от «грязного» boundary payload.
 * - Для неизвестных ошибок требуется явный `fallback` в конфигурации (детерминизм).
 */

import type { BotErrorResponse } from '../contracts/BotErrorResponse.js';
import { getBotRetryable } from '../domain/BotRetry.js';
import type {
  BotError,
  BotErrorCategory,
  BotErrorContext,
  BotErrorSeverity,
} from '../types/bots.js';
import { botErrorMetaByCode } from './bot-errors.js';

/* ============================================================================
 * 🧭 TYPES
 * ========================================================================== */

type UnknownObject = Readonly<Record<string, unknown>>;

/** Базовый тип для проверки `BotErrorResponse.severity` (защита от грязного transport). */
const BOT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

/** Базовый тип для проверки `BotErrorResponse.category` (защита от грязного transport). */
const BOT_CATEGORIES = [
  'validation',
  'policy',
  'permission',
  'channel',
  'webhook',
  'parsing',
  'integration',
] as const;

function isBotErrorSeverity(value: unknown): value is BotErrorSeverity {
  return typeof value === 'string'
    && BOT_SEVERITIES.includes(value as (typeof BOT_SEVERITIES)[number]);
}

function isBotErrorCategory(value: unknown): value is BotErrorCategory {
  return typeof value === 'string'
    && BOT_CATEGORIES.includes(value as (typeof BOT_CATEGORIES)[number]);
}

/** Конфигурация маппинга bot ошибок (детерминированная, без side-effects). */
type MapBotErrorConfigBase = {
  /**
   * Фолбек-ошибка для случаев, когда вход не является `BotErrorResponse`
   * и не распознан другими правилами.
   *
   * @remarks
   * Делается обязательной, чтобы не "изобретать" код ошибки в рантайме
   * (в `BotErrorCode` нет универсального BOT_UNKNOWN_ERROR).
   */
  readonly fallback: BotError;

  /**
   * Кастомные правила маппинга.
   *
   * @remarks
   * - DI делает маппер truly extensible: можно внедрять feature/app-specific rules, A/B поведение,
   *   и тестировать engine изолированно.
   * - Порядок не важен: правила сортируются по `priority` и кэшируются для immutable/frozen массивов.
   */
  readonly rules?: readonly MappingRule[] | undefined;
};

type MapBotErrorConfigHooks = {
  /**
   * Hook для наблюдаемости: вызывается, если матчится больше одного правила.
   * Никаких скрытых side-effects (console.*) — observability через DI.
   */
  readonly onAmbiguousMatch?: (matches: readonly MappingRule[], input: BotErrorInput) => void;
};

export type MapBotErrorConfig = Readonly<MapBotErrorConfigBase & MapBotErrorConfigHooks>;

/** Входные данные для маппинга (API ошибка или unknown). */
export type BotErrorInput = BotError | BotErrorResponse | Error | string | UnknownObject;

/* ============================================================================
 * 🔍 TYPE GUARDS
 * ========================================================================== */

function isBotErrorResponse(value: unknown): value is BotErrorResponse {
  if (value === null || typeof value !== 'object') return false;

  const v = value as Record<string, unknown>;

  return typeof v['error'] === 'string'
    && typeof v['code'] === 'string'
    && isBotErrorCategory(v['category'])
    && isBotErrorSeverity(v['severity'])
    && typeof v['retryable'] === 'boolean';
}

function isBotError(value: unknown): value is BotError {
  if (value === null || typeof value !== 'object') return false;

  const v = value as Record<string, unknown>;

  // BotErrorResponse включает поле `error` (coarse boundary discriminator).
  if (typeof v['error'] === 'string') return false;

  return typeof v['code'] === 'string'
    && isBotErrorCategory(v['category'])
    && isBotErrorSeverity(v['severity'])
    && typeof v['retryable'] === 'boolean';
}

function isError(value: unknown): value is Error {
  // Production-safe cross-realm guard (iframe/worker/other JS realms)
  if (value === null || typeof value !== 'object') return false;

  const v = value as Record<string, unknown>;
  return typeof v['name'] === 'string'
    && typeof v['message'] === 'string'
    && (value instanceof Error || typeof v['stack'] === 'string');
}

/* ============================================================================
 * 🧩 CORE HELPERS
 * ========================================================================== */

/**
 * Нормализует ошибку в канонический `BotError`.
 *
 * @remarks
 * Всегда вычисляет `retryable` через `BotRetryPolicy` (не доверяем transport значениям).
 * Возвращаем `Object.freeze(...)` как shallow контрактный барьер от случайных мутаций.
 */
function createBotError(
  base: Readonly<{
    readonly category: BotError['category'];
    readonly code: BotError['code'];
    readonly severity: BotErrorSeverity;
    readonly context?: BotErrorContext;
  }>,
): BotError {
  return Object.freeze({
    category: base.category,
    code: base.code,
    severity: base.severity,
    retryable: getBotRetryable(base.code),
    ...(base.context !== undefined ? { context: base.context } : {}),
  });
}

function normalizeFallback(fallback: BotError): BotError {
  // Idempotent guard: если fallback уже нормализован (frozen) и retryable согласован с BotRetryPolicy,
  // возвращаем его без лишних аллокаций.
  if (Object.isFrozen(fallback) && fallback.retryable === getBotRetryable(fallback.code)) {
    return fallback;
  }

  return createBotError({
    category: fallback.category,
    code: fallback.code,
    severity: fallback.severity,
    ...(fallback.context !== undefined ? { context: fallback.context } : {}),
  });
}

const normalizedFallbackCache = new WeakMap<BotError, BotError>();

function getNormalizedFallback(fallback: BotError): BotError {
  // Lazy-нормализация fallback:
  // - fast-path: если fallback уже каноничен (frozen + retryable согласован с BotRetryPolicy), возвращаем его сразу (без WeakMap).
  // - если fallback не frozen — нормализуем без кэша;
  // - если fallback frozen, но "грязный" — нормализуем один раз и кешируем.
  if (Object.isFrozen(fallback) && fallback.retryable === getBotRetryable(fallback.code)) {
    return fallback;
  }

  if (!Object.isFrozen(fallback)) return normalizeFallback(fallback);

  const cached = normalizedFallbackCache.get(fallback);
  if (cached !== undefined) return cached;

  const normalized = normalizeFallback(fallback);
  normalizedFallbackCache.set(fallback, normalized);
  return normalized;
}

/**
 * Нормализует `BotError` в канонический вид по `BotErrorCode`.
 *
 * Важно: при входе в `BotErrorInput` через lifecycle/pipeline всегда делаем нормализацию,
 * а не пасс-through, чтобы избежать дрейфа severity/category/retryable.
 */
export function normalizeBotError(input: BotError): BotError {
  const meta = botErrorMetaByCode[input.code];
  const retryable = getBotRetryable(input.code);

  // Если уже канонично — возвращаем как есть.
  if (
    Object.isFrozen(input)
    && input.category === meta.category
    && input.severity === meta.severity
    && input.retryable === retryable
  ) {
    return input;
  }

  return Object.freeze({
    category: meta.category,
    code: input.code,
    severity: meta.severity,
    retryable,
    ...(input.context !== undefined ? { context: input.context } : {}),
  });
}

/* ============================================================================
 * 🎯 TRUE RULE ENGINE — Priority-Based Rules
 * ========================================================================== */

export type MatchFn = (input: BotErrorInput) => boolean;
export type MapFn = (input: BotErrorInput, config: MapBotErrorConfig) => BotError;

type MappingRuleBase = {
  /** Приоритет правила (меньше = выше приоритет). */
  readonly priority: number;
};

type MappingRuleFns = {
  /** Проверяет применимость правила. */
  readonly match: MatchFn;
  /** Преобразует входные данные в `BotError`. */
  readonly map: MapFn;
};

export type MappingRule = Readonly<MappingRuleBase & MappingRuleFns>;

/**
 * Правило 1: `BotErrorResponse` → `BotError` (приоритет 10).
 *
 * @remarks
 * - Не доверяем `retryable` из transport как source-of-truth:
 *   приводим к `getBotRetryable(code)` из доменной retry-политики.
 */
const botErrorResponseRule: MappingRule = {
  priority: 10,
  match: (input) => isBotErrorResponse(input),
  map: (input) => {
    /* istanbul ignore next */
    if (!isBotErrorResponse(input)) {
      throw new Error('Rule mismatch: expected BotErrorResponse');
    }

    const context: BotErrorContext | undefined = input.context;

    /* eslint-disable @livai/rag/context-leakage -- domain BotErrorContext (не runtime/global context) */
    const botError = createBotError({
      category: input.category,
      code: input.code,
      severity: input.severity,
      ...(context !== undefined ? { context } : {}),
    });
    /* eslint-enable @livai/rag/context-leakage -- domain BotErrorContext (не runtime/global context) */

    return botError;
  },
} as const;

/**
 * Правило 2: Ошибка JS `Error` → fallback (приоритет 90).
 *
 * @remarks
 * - Domain-safe: не протаскиваем stack/message как отдельные поля.
 * - Для observability сохраняем `Error` причину в `context.details.cause`.
 * - При необходимости расширения добавляются новые правила выше по приоритету
 *   (например, распознавание сетевых ошибок по name/code).
 */
const jsErrorRule: MappingRule = {
  priority: 90,
  match: (input) => isError(input),
  map: (input, config) => {
    /* istanbul ignore next */
    if (!isError(input)) {
      return config.fallback;
    }

    const existingContext = config.fallback.context;
    const existingDetails = existingContext?.details;

    const cause = Object.freeze({
      name: input.name,
      message: input.message,
    });

    const enrichedContext: BotErrorContext = {
      ...(existingContext ?? {}),
      details: Object.freeze({
        ...(existingDetails ?? {}),
        cause,
      }),
    };

    /* eslint-disable @livai/rag/context-leakage -- domain BotErrorContext (не runtime/global context) */
    const botError = createBotError({
      category: config.fallback.category,
      code: config.fallback.code,
      severity: config.fallback.severity,
      context: enrichedContext,
    });
    /* eslint-enable @livai/rag/context-leakage -- domain BotErrorContext (не runtime/global context) */

    return botError;
  },
} as const;

/**
 * Правило: `string` → fallback с `context.details.cause`, чтобы не терять семантику.
 *
 * @remarks
 * Мы не выдумываем `code/category/severity`: берем canonical-метаданные из fallback.
 */
const stringErrorRule: MappingRule = {
  priority: 80,
  match: (input) => typeof input === 'string',
  map: (input, config) => {
    /* istanbul ignore next */
    if (typeof input !== 'string') {
      return config.fallback;
    }

    const existingContext = config.fallback.context;
    const existingDetails = existingContext?.details;

    const cause = Object.freeze({
      name: 'StringError',
      message: input,
    });

    const enrichedContext: BotErrorContext = {
      ...(existingContext ?? {}),
      details: Object.freeze({
        ...(existingDetails ?? {}),
        cause,
      }),
    };

    /* eslint-disable @livai/rag/context-leakage -- domain BotErrorContext (не runtime/global context) */
    return createBotError({
      category: config.fallback.category,
      code: config.fallback.code,
      severity: config.fallback.severity,
      context: enrichedContext,
    });
    /* eslint-enable @livai/rag/context-leakage -- domain BotErrorContext (не runtime/global context) */
  },
} as const;

const DEFAULT_RULES: readonly MappingRule[] = [
  botErrorResponseRule,
  stringErrorRule,
  jsErrorRule,
] as const satisfies readonly MappingRule[];

/**
 * Порядок приоритетов rules (меньше `priority` = выше приоритет):
 * - `botErrorResponseRule` (10): самый конкретный boundary тип (`BotErrorResponse`).
 *   Мы извлекаем `code/category/severity` из payload и всегда канонизируем `retryable` по доменной политике.
 * - `stringErrorRule` (80): для `string`-входа сохраняем семантику в `context.details.cause`,
 *   но метаданные `code/category/severity` берем из `fallback` (чтобы не выдумывать доменные коды).
 * - `jsErrorRule` (90): реальный runtime `Error` — обогащаем `context.details.cause` и возвращаем доменный `BotError` на основе fallback.
 *
 * Такой порядок защищает от "перепутывания" типов и гарантирует, что структурированные boundary-пейлоады
 * имеют приоритет над универсальными fallback-ветками.
 */

const sortedRulesCache = new WeakMap<readonly MappingRule[], readonly MappingRule[]>();

function getSortedRules(config: MapBotErrorConfig): readonly MappingRule[] {
  // DEFAULT_RULES уже отсортирован и не требует аллокаций/сортировки.
  if (config.rules === undefined) return DEFAULT_RULES;

  const rules = config.rules;
  if (Object.isFrozen(rules)) {
    const cached = sortedRulesCache.get(rules);
    if (cached !== undefined) return cached;
  }

  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  // Кэшируем только для immutable массивов (frozen) — иначе кэш может стать устаревшим.
  if (Object.isFrozen(rules)) sortedRulesCache.set(rules, sorted);

  return sorted;
}

/**
 * Выбирает первое правило по приоритету и собирает список неоднозначных совпадений (если они есть).
 *
 * @remarks
 * `match` должен быть pure/deterministic. Мы вызываем его ровно один раз на правило.
 */
function selectMatchedRule(
  input: BotErrorInput,
  rules: readonly MappingRule[],
): Readonly<{
  readonly matchedRule: MappingRule | null;
  readonly ambiguousMatches?: readonly MappingRule[] | undefined;
}> {
  let matchedRule: MappingRule | null = null;
  let ambiguousMatches: MappingRule[] | undefined;

  for (const rule of rules) {
    if (!rule.match(input)) continue;

    if (matchedRule === null) {
      matchedRule = rule;
    } else if (ambiguousMatches === undefined) {
      ambiguousMatches = [matchedRule, rule];
    } else {
      ambiguousMatches.push(rule);
    }
  }

  return {
    matchedRule,
    ambiguousMatches,
  } as const;
}

function applyMappingRules(input: BotErrorInput, config: MapBotErrorConfig): BotError {
  const rules = getSortedRules(config);

  const { matchedRule, ambiguousMatches } = selectMatchedRule(input, rules);

  if (ambiguousMatches !== undefined && config.onAmbiguousMatch !== undefined) {
    config.onAmbiguousMatch(ambiguousMatches, input);
  }

  if (matchedRule !== null) {
    return matchedRule.map(input, config);
  }

  return config.fallback;
}

/* ============================================================================
 * 🎯 PUBLIC API
 * ========================================================================== */

/**
 * Трансформирует входную ошибку в UI-friendly `BotError`.
 * Pure функция: детерминированна и не имеет side-effects.
 *
 * @param input - Ошибка boundary/unknown (`BotErrorResponse`, `string`, JS `Error` и т.п.).
 * @param config - Конфигурация маппинга (обязательный fallback).
 */
export function mapBotErrorToUI(input: BotErrorInput, config: MapBotErrorConfig): BotError {
  if (isBotError(input)) {
    return normalizeBotError(input);
  }

  // Нормализуем fallback без лишних аллокаций и по возможности — один раз для одного объекта fallback.
  return applyMappingRules(input, { ...config, fallback: getNormalizedFallback(config.fallback) });
}
