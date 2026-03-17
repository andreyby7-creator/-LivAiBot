/**
 * @file packages/feature-bots/src/lib/bot-audit.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Bot Audit Helpers (validation + normalization + emitting)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Lib-layer хелперы для audit-событий ботов: runtime-валидация (через Zod схемы),
 *   нормализация/anti-drift и опциональная отправка в sink (SIEM/логирование) через DI.
 *
 * Принципы:
 * - ✅ SRP: только audit-event utilities (валидация/нормализация/передача в sink).
 * - ✅ Deterministic: один вход → один результат, без `Date.now()` и без глобального состояния.
 * - ✅ Domain-pure boundary: домен содержит только типы; runtime parsing/validation живёт в lib.
 *
 * @remarks
 * - `botAuditEventSchema` валидирует structural shape и базовые ограничения размера/типа.
 *   Типосвязь `type → context` (BotAuditEventContextMap) — domain-level контракт; здесь мы не
 *   добавляем бизнес-семантику, только защищаем boundary.
 */

import type { BotAuditEvent } from '../domain/BotAuditEvent.js';
import type { BotAuditEventValues } from '../schemas/index.js';
import { botAuditEventSchema } from '../schemas/index.js';

/* ============================================================================
 * 🧾 VALIDATION / PARSING
 * ========================================================================== */

export type ParseBotAuditEventErrorCode = 'INVALID_AUDIT_EVENT';

export type ParseBotAuditEventError = Readonly<
  Error & { readonly code: ParseBotAuditEventErrorCode; }
>;

const createParseBotAuditEventError = (message: string): ParseBotAuditEventError => {
  const err = Object.assign(
    new Error(message),
    {
      name: 'ParseBotAuditEventError',
      code: 'INVALID_AUDIT_EVENT' as const,
    },
  );
  return Object.freeze(err);
};

const DEFAULT_MAX_SERIALIZED_SIZE = 100_000;

const trySerializeSize = (value: unknown): number | null => {
  try {
    // NOTE: JSON.stringify.length считает UTF-16 code units; этого достаточно для защитного лимита.
    return JSON.stringify(value).length;
  } catch {
    return null;
  }
};

/**
 * Runtime guard: проверяет, что значение соответствует `BotAuditEventValues`.
 *
 * @remarks
 * Используйте на boundary (HTTP/DB) перед тем, как сохранять или эмитить событие.
 */
export function isBotAuditEventValues(value: unknown): value is BotAuditEventValues {
  return botAuditEventSchema.safeParse(value).success;
}

/**
 * Парсит runtime значение в `BotAuditEventValues` или бросает ошибку.
 *
 * @remarks
 * Предназначено для boundary/parsing слоя: явная ошибка лучше, чем silent drop.
 */
export function parseBotAuditEventValues(value: unknown): BotAuditEventValues {
  const res = botAuditEventSchema.safeParse(value);
  if (res.success) return res.data;
  throw createParseBotAuditEventError(res.error.message);
}

/* ============================================================================
 * 🧼 NORMALIZATION (ANTI-DRIFT)
 * ========================================================================== */

/**
 * Нормализует audit-событие (whitelist полей) и возвращает frozen объект.
 *
 * @remarks
 * Это anti-drift слой: неизвестные поля отбрасываются, чтобы событие оставалось стабильным контрактом
 * для SIEM/логов и не “текло” случайными данными из boundary.
 */
export function normalizeBotAuditEventValues(event: BotAuditEventValues): BotAuditEventValues {
  const context = event.context !== undefined
    // Shallow snapshot: предотвращает мутацию top-level context после emit.
    ? Object.freeze({ ...event.context })
    : undefined;

  const normalized: BotAuditEventValues = {
    eventId: event.eventId,
    type: event.type,
    botId: event.botId,
    workspaceId: event.workspaceId,
    timestamp: event.timestamp,
    ...(event.userId !== undefined ? { userId: event.userId } : {}),
    ...(context !== undefined ? { context } : {}),
  };
  return Object.freeze(normalized);
}

/* ============================================================================
 * 📤 EMIT (DI SINK)
 * ========================================================================== */

export type BotAuditSink = Readonly<{
  /**
   * Sink (порт) для доставки события в SIEM/логирование.
   *
   * @remarks
   * Реальная доставка (HTTP/kafka/console) живёт снаружи; здесь — только вызов порта.
   */
  readonly emit: (event: BotAuditEventValues) => void;
}>;

type EmitBotAuditEventOptionsBase = Readonly<{
  /** Опциональная нормализация перед отправкой. По умолчанию true. */
  readonly normalize?: boolean;
  /**
   * Unsafe mode: если `normalize === false`, anti-drift и immutability guarantees не применяются.
   *
   * @remarks
   * Используйте только если upstream гарантирует стабильный shape/размер payload и отсутствие мутаций после emit.
   */
  /**
   * Строгий режим: при ошибке парсинга бросает исключение.
   * По умолчанию false (ошибка возвращается через результат и/или onInvalid hook).
   */
  readonly strict?: boolean;
  /**
   * Максимальный размер сериализованного payload (JSON.stringify) для boundary-защиты от log explosion.
   * @defaultValue 100_000
   */
  readonly maxSerializedSize?: number;
}>;

type EmitBotAuditEventOptionsHooks = Readonly<{
  /**
   * Hook для наблюдаемости: вызывается, если входное событие не проходит schema validation.
   * Никаких side-effects по умолчанию.
   */
  readonly onInvalid?: (error: ParseBotAuditEventError, value: unknown) => void;
}>;

export type EmitBotAuditEventOptions = Readonly<
  EmitBotAuditEventOptionsBase & EmitBotAuditEventOptionsHooks
>;

export type EmitBotAuditEventResult =
  | Readonly<{ ok: true; }>
  | Readonly<{ ok: false; error: ParseBotAuditEventError; }>;

/**
 * Эмитит audit-событие через DI-sink.
 *
 * @remarks
 * Функция не делает IO сама по себе: IO происходит только внутри `sink.emit`, который
 * предоставляется boundary/infra слоем.
 * Возвращаемый результат позволяет consumers сделать observability без side-effects.
 */
export function emitBotAuditEvent(
  value: unknown,
  sink: BotAuditSink,
  options?: Readonly<EmitBotAuditEventOptions>,
): EmitBotAuditEventResult {
  const maxSerializedSize = options?.maxSerializedSize ?? DEFAULT_MAX_SERIALIZED_SIZE;
  const size = trySerializeSize(value);
  if (size !== null && size > maxSerializedSize) {
    const err = createParseBotAuditEventError(
      `Invalid BotAuditEvent: payload too large (${size} > ${maxSerializedSize})`,
    );
    options?.onInvalid?.(err, value);
    if (options?.strict === true) throw err;
    return Object.freeze({ ok: false, error: err });
  }

  try {
    const parsed = parseBotAuditEventValues(value);
    const out = options?.normalize === false ? parsed : normalizeBotAuditEventValues(parsed);
    sink.emit(out);
    return Object.freeze({ ok: true });
  } catch (e) {
    const err = e instanceof Error
      ? (e as ParseBotAuditEventError)
      : createParseBotAuditEventError('Invalid BotAuditEvent');
    options?.onInvalid?.(err, value);
    if (options?.strict === true) throw err;
    return Object.freeze({ ok: false, error: err });
  }
}

/**
 * Type helper: сужение `BotAuditEvent` до transport-safe представления для SIEM.
 *
 * @remarks
 * Удобно, если у вас уже есть доменное событие, и нужно эмитить его через `BotAuditSink`.
 */
export function toBotAuditEventValues(event: BotAuditEvent): BotAuditEventValues {
  // Domain object still benefits from runtime schema validation before SIEM emitting.
  return normalizeBotAuditEventValues(parseBotAuditEventValues(event as unknown));
}
