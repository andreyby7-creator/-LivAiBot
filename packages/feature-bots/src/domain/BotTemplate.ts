/**
 * @file packages/feature-bots/src/domain/BotTemplate.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Доменная модель шаблона бота
 * ============================================================================
 *
 * Архитектурная роль:
 * - Domain-агрегат BotTemplate: source-of-truth для стандартных конфигураций бота.
 * - Отдельная от Bot/BotVersion/BotSettings модель: шаблон описывает только дефолты, а не runtime-состояние.
 *
 * Принципы:
 * - ✅ SRP: только структура шаблона и инварианты (без бизнес-логики и transport-деталей).
 * - ✅ Deterministic: явные, детерминированные поля (role/defaultInstruction/defaultSettings/capabilities/tags).
 * - ✅ Domain-pure: без HTTP/DB/DTO-деталей, только доменные типы и инварианты.
 * - ✅ Extensible: capabilities/tags и BotSettings в defaultSettings позволяют эволюцию без ломки core-схемы.
 * - ✅ Microservice-ready: строгая, сериализуемая модель, удобная для межсервисного взаимодействия и rule-engine.
 */

import type { ID } from '@livai/core-contracts';

import type { BotSettings } from './BotSettings.js';
import { assertBotSettingsInvariant } from './BotSettings.js';

/* ============================================================================
 * 🔐 ID ТИПЫ
 * ========================================================================== */

/** Идентификатор шаблона бота (domain-level alias над ID<'BotTemplate'>). */
export type BotTemplateId = ID<'BotTemplate'>;

/* ============================================================================
 * 🧩 ROLE / CAPABILITIES / TAGS
 * ========================================================================== */

/**
 * Роль бота по умолчанию (semantic role).
 * Используется для high-level категоризации шаблонов.
 */
export type BotTemplateRole =
  | 'assistant'
  | 'support'
  | 'sales'
  | 'analytics'
  | 'system';

/**
 * Возможности шаблона (capabilities).
 * Exhaustive union обеспечивает type-safety и discoverability.
 */
export type BotTemplateCapability =
  | 'multi_channel'
  | 'handoff'
  | 'advanced_memory'
  | 'external_tools';

/** Набор capabilities шаблона (Set-semantics по инвариантам, без дубликатов). */
export type BotTemplateCapabilities = readonly BotTemplateCapability[];

/** Теги/лейблы шаблона для фильтрации без изменения структуры (Set-semantics по инвариантам). */
export type BotTemplateTags = readonly string[];

/* ============================================================================
 * 🧩 DOMAIN MODEL
 * ========================================================================== */

/**
 * Доменная модель шаблона бота.
 * Инварианты:
 * - name — непустая строка (после trim).
 * - defaultInstruction — непустая строка (после trim).
 * - capabilities — массив без дубликатов.
 * - tags — массив без дубликатов.
 * - defaultSettings удовлетворяет assertBotSettingsInvariant.
 */
export type BotTemplate = Readonly<{
  /** Идентификатор шаблона бота. */
  readonly id: BotTemplateId;

  /** Имя шаблона (для каталога и UI). */
  readonly name: string;

  /** Роль бота по умолчанию. */
  readonly role: BotTemplateRole;

  /** Описание шаблона (для каталога и документации). */
  readonly description: string;

  /**
   * Дефолтная инструкция (system/instruction prompt).
   * ВАЖНО: не должна содержать control-токены или prompt-инъекции; дополнительные проверки — на policy-layer.
   */
  readonly defaultInstruction: string;

  /** Дефолтные настройки бота для шаблона. */
  readonly defaultSettings: BotSettings;

  /** Возможности шаблона. */
  readonly capabilities: BotTemplateCapabilities;

  /** Теги/лейблы для фильтрации шаблонов. */
  readonly tags: BotTemplateTags;
}>;

/* ============================================================================
 * 🧪 INVARIANT CHECKS
 * ========================================================================== */

/**
 * Domain-level ошибка нарушения инвариантов BotTemplate.
 * Оформлена как Error-alias + фабрика (без class/this), совместима с observability-слоем.
 */
export type BotTemplateInvariantError = Readonly<Error>;

export const createBotTemplateInvariantError = (
  message: string,
): BotTemplateInvariantError => {
  // Используем настоящий Error, чтобы сохранить stack и интеграцию с observability.
  // Локально разрешаем мутацию имени ошибки ради корректного name.
  // eslint-disable-next-line functional/prefer-immutable-types
  const error = new Error(message);
  // eslint-disable-next-line fp/no-mutation
  error.name = 'BotTemplateInvariantError';
  return Object.freeze(error);
};

/**
 * Хелпер, который всегда выбрасывает BotTemplateInvariantError.
 * Используется в тернарных выражениях и для лаконичных проверок.
 */
const throwBotTemplateInvariantError = (message: string): never => {
  throw createBotTemplateInvariantError(message);
};

/**
 * Runtime-проверка инвариантов BotTemplate.
 * Можно вызывать на границах (при маппинге из/в transport/DB), в тестах и policy-слое.
 */
export function assertBotTemplateInvariant(template: BotTemplate): void {
  // Сначала проверяем вложенные настройки, чтобы не держать invalid defaultSettings в домене.
  // eslint-disable-next-line fp/no-unused-expression
  assertBotSettingsInvariant(template.defaultSettings);

  const nameErrorMessage = template.name.trim().length === 0
    ? 'BotTemplate invariant violation: name MUST be a non-empty string'
    : null;

  const instructionErrorMessage = template.defaultInstruction.trim().length === 0
    ? 'BotTemplate invariant violation: defaultInstruction MUST be a non-empty string'
    : null;

  const capabilitiesErrorMessage =
    template.capabilities.length !== new Set(template.capabilities).size
      ? 'BotTemplate invariant violation: capabilities MUST NOT contain duplicates'
      : null;

  const tagsErrorMessage = template.tags.length !== new Set(template.tags).size
    ? 'BotTemplate invariant violation: tags MUST NOT contain duplicates'
    : null;

  const errorMessage = nameErrorMessage
    ?? instructionErrorMessage
    ?? capabilitiesErrorMessage
    ?? tagsErrorMessage;

  return errorMessage === null ? undefined : throwBotTemplateInvariantError(errorMessage);
}
