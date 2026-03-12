/**
 * @file packages/feature-bots/src/domain/BotSettings.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Доменная модель настроек бота
 * ============================================================================
 *
 * Архитектурная роль:
 * - Domain-агрегат BotSettings: source-of-truth для конфигурации поведения бота.
 * - Отдельная от Bot/BotVersion модель: Bot хранит только ссылку на настройки, а сам конфиг — автономный domain-объект.
 *
 * Принципы:
 * - ✅ SRP: только структура настроек и инварианты (без бизнес-логики и transport-деталей).
 * - ✅ Deterministic: явные, детерминированные флаги и пороги (temperature/contextWindow/PII/interruptions).
 * - ✅ Domain-pure: без HTTP/DB/DTO-деталей, только доменные типы и инварианты.
 * - ✅ Extensible: секции extra/featureFlags/integrationConfig и settingsSchemaVersion для эволюции без ломки core-схемы.
 * - ✅ Microservice-ready: строгая, сериализуемая модель, удобная для межсервисного взаимодействия и rule-engine.
 */

import type { JsonObject } from '@livai/core-contracts';

/* ============================================================================
 * 🔢 PRIMITIVE BRANDS
 * ========================================================================== */

/**
 * Температура модели (0–2, но конкретные границы проверяются на уровне policy/validation).
 * Branded-тип, чтобы не путать с произвольным number.
 */
export type Temperature = number & { readonly __brand: 'Temperature'; };

/**
 * Размер контекстного окна (количество токенов или сообщений).
 * Branded-тип, чтобы не путать с другими числовыми лимитами.
 */
export type ContextWindow = number & { readonly __brand: 'ContextWindow'; };

/** Доменный флаг включения PII-маскирования. Branded-тип не обязателен, но улучшает читаемость. */
export type PiiMaskingEnabled = boolean;

/** Доменный флаг включения распознавания изображений. */
export type ImageRecognitionEnabled = boolean;

/* ============================================================================
 * 🧩 FALLBACK / INTERRUPTION SETTINGS
 * ========================================================================== */

/** Настройки сообщения по умолчанию, когда бот не может ответить. */
export type UnrecognizedMessageSettings = Readonly<{
  /**
   * Текст fallback-сообщения (domain-level, без локализации).
   * ВАЖНО: НЕ должен содержать prompt-инструкции, executable content или спец-маркеры для LLM.
   * Должен быть безопасным, пользовательским сообщением, а не частью prompt-пайплайна.
   */
  readonly message: string;
  /** Показывать ли пользователю ссылку на поддержку/оператора. */
  readonly showSupportHint: boolean;
}>;

/** Настройки прерывания диалога (interruption rules). */
export type InterruptionRules = Readonly<{
  /** Разрешено ли пользователю прерывать текущий поток общения. */
  readonly allowUserInterruption: boolean;
  /** Максимальное количество одновременных активных потоков. */
  readonly maxConcurrentSessions: number;
}>;

/* ============================================================================
 * 🧩 CORE SETTINGS MODEL
 * ========================================================================== */

/**
 * Фичи, управляемые через фича-флаги бота.
 * Exhaustive union обеспечивает type-safety и discoverability.
 */
export type BotFeatureFlag =
  | 'handoff'
  | 'analytics'
  | 'advanced_memory';

/** Флаги функций бота (scalable rule-engine без string-линий). */
export type BotFeatureFlags = Readonly<Record<BotFeatureFlag, boolean>>;

/**
 * Дополнительные опции интеграций/каналов.
 * Названы как `integrationConfig`, чтобы явно обозначить boundary (application-layer concern).
 */
export type BotIntegrationConfig = JsonObject;

/**
 * Дополнительные, расширяемые настройки бота.
 * @remarks
 * - Используется для feature-флагов и интеграционных конфигураций.
 * - Содержит `settingsSchemaVersion` для безопасной миграции снапшотов.
 */
export type BotSettingsExtra = Readonly<{
  /** Версия схемы настроек, полезна для миграций и интерпретации legacy-snaphots. */
  readonly settingsSchemaVersion?: number;
  /** Флаги функций (строго типизированные). */
  readonly featureFlags?: BotFeatureFlags;
  /** Дополнительные параметры интеграций/каналов. */
  readonly integrationConfig?: BotIntegrationConfig;
}>;

/**
 * Доменная модель настроек бота.
 * Инварианты:
 * - temperature — конечное число (validation/policy может дополнительно ограничивать диапазон).
 * - contextWindow — неотрицательное целое.
 * - interruptionRules.maxConcurrentSessions — положительное целое.
 * - unrecognizedMessage.message — непустая строка (после trim).
 */
export type BotSettings = Readonly<{
  /** Температура генерации ответа. */
  readonly temperature: Temperature;

  /** Размер контекстного окна для модели. */
  readonly contextWindow: ContextWindow;

  /** Включено ли PII-маскирование. */
  readonly piiMasking: PiiMaskingEnabled;

  /** Включено ли распознавание изображений. */
  readonly imageRecognition: ImageRecognitionEnabled;

  /** Настройки сообщения по умолчанию для непонятных запросов. */
  readonly unrecognizedMessage: UnrecognizedMessageSettings;

  /** Настройки прерывания диалога. */
  readonly interruptionRules: InterruptionRules;

  /** Дополнительные, расширяемые настройки. */
  readonly extra?: BotSettingsExtra;
}>;

/* ============================================================================
 * 🔧 HELPERS
 * ========================================================================== */

/**
 * Вспомогательный helper для безопасного снятия бренда с числовых типов.
 * Нужен, чтобы избежать прямых `as number` в коде.
 */
const asNumber = <T extends number>(value: T): number => value;

/* ============================================================================
 * 🧪 INVARIANT CHECKS
 * ========================================================================== */

/**
 * Domain-level ошибка нарушения инвариантов BotSettings.
 * Оформлена как Error-alias + фабрика (без class/this), совместима с observability-слоем.
 */
export type BotSettingsInvariantError = Readonly<Error>;

export const createBotSettingsInvariantError = (
  message: string,
): BotSettingsInvariantError => {
  // Используем настоящий Error, чтобы сохранить stack и интеграцию с observability.
  // Локально разрешаем мутацию имени ошибки ради корректного name.
  // eslint-disable-next-line functional/prefer-immutable-types
  const error = new Error(message);
  // eslint-disable-next-line fp/no-mutation
  error.name = 'BotSettingsInvariantError';
  return Object.freeze(error);
};

/**
 * Хелпер, который всегда выбрасывает BotSettingsInvariantError.
 * Используется в тернарных выражениях и для лаконичных проверок.
 */
const throwBotSettingsInvariantError = (message: string): never => {
  throw createBotSettingsInvariantError(message);
};

/**
 * Runtime-проверка инвариантов BotSettings.
 * Можно вызывать:
 * - на границах (при маппинге из/в transport/DB),
 * - в тестах,
 * - в policy-слое перед критическими операциями.
 */
export function assertBotSettingsInvariant(settings: BotSettings): void {
  const temperatureValue = asNumber(settings.temperature);
  const contextWindowValue = asNumber(settings.contextWindow);
  const maxSessionsValue = settings.interruptionRules.maxConcurrentSessions;
  const fallbackMessage = settings.unrecognizedMessage.message;

  const fallbackMessageErrorMessage = fallbackMessage.trim().length === 0
    ? 'BotSettings invariant violation: unrecognizedMessage.message MUST be a non-empty string'
    : null;

  const maxSessionsErrorMessage = maxSessionsValue <= 0 || !Number.isInteger(maxSessionsValue)
    ? 'BotSettings invariant violation: interruptionRules.maxConcurrentSessions MUST be a positive integer'
    : null;

  const contextWindowErrorMessage = contextWindowValue < 0 || !Number.isInteger(contextWindowValue)
    ? 'BotSettings invariant violation: contextWindow MUST be a non-negative integer'
    : null;

  const temperatureErrorMessage = !Number.isFinite(temperatureValue)
    ? 'BotSettings invariant violation: temperature MUST be a finite number'
    : null;

  const errorMessage = fallbackMessageErrorMessage
    ?? maxSessionsErrorMessage
    ?? contextWindowErrorMessage
    ?? temperatureErrorMessage;
  return errorMessage === null ? undefined : throwBotSettingsInvariantError(errorMessage);
}
