/**
 * @file packages/feature-bots/src/domain/BotVersion.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Доменная модель версии бота
 * ============================================================================
 *
 * Архитектурная роль:
 * - Domain-агрегат BotVersion: source-of-truth для истории конфигураций бота.
 * - Отдельная от Bot модель: Bot хранит только currentVersion, а версии — отдельный стрим событий/состояний.
 *
 * Принципы:
 * - ✅ SRP: только структура версии и инварианты (без бизнес-логики и transport-деталей).
 * - ✅ Deterministic: явная, монотонно неубывающая версия (BotVersion) и инварианты instruction/settings/version/rollback.
 * - ✅ Domain-pure: без HTTP/DB/DTO-деталей, только доменные типы и инварианты.
 * - ✅ Immutable: все поля readonly для истории версий и rollback integrity.
 * - ✅ Extensible: metadata/tags и BotSettingsSnapshot для эволюции без изменения core-схемы.
 * - ✅ Microservice-ready: строгие типы, удобные для передачи между сервисами.
 */

import type { ID, JsonObject } from '@livai/core-contracts';

import type { OperationId } from '../types/bot-commands.js';
import type { BotId, BotUserId, BotVersion, BotWorkspaceId, Timestamp } from './Bot.js';
import type { BotSettings } from './BotSettings.js';

/* ============================================================================
 * 🔐 ID/BRAND ТИПЫ
 * ========================================================================== */

/**
 * Идентификатор версии бота (domain-level alias над ID<'BotVersion'>).
 * Используется, если версии хранятся как отдельные сущности в хранилище.
 */
export type BotVersionId = ID<'BotVersion'>;

/**
 * Domain-level инструкция бота.
 * Технически это строка, но помеченная брендом для избежания путаницы с произвольным string.
 */
export type BotInstruction = string & { readonly __brand: 'BotInstruction'; };

/**
 * Вспомогательный helper для безопасного снятия бренда с числовых типов.
 * Нужен, чтобы избежать прямых `as number` в коде.
 */
const asNumber = <T extends number>(value: T): number => value as number;

/* ============================================================================
 * 🧩 METADATA / TAGS
 * ========================================================================== */

/**
 * Дополнительные метаданные версии бота.
 * Инварианты:
 * - Не содержит чувствительных данных (PII/секреты).
 * - Используется для rollback-истории и тегов, а не для произвольного JSON.
 */
export type BotVersionMetadata = Readonly<{
  /**
   * Версия, от которой был выполнен откат.
   * Если задана — текущая версия получена через rollback.
   */
  readonly rollbackFromVersion?: BotVersion;

  /**
   * Теги/лейблы версии.
   * Используются для фильтрации и поиска версий без изменения структуры.
   */
  readonly tags?: readonly string[];

  /**
   * Дополнительные данные версии (back-compat/расширения).
   * Верхнеуровневая структура контролируется, а не произвольный JSON.
   */
  readonly extra?: JsonObject;
}>;

/**
 * Снимок настроек бота на момент создания версии.
 * Domain-алиас поверх строго типизированного `BotSettings`, который может эволюционировать независимо.
 */
export type BotSettingsSnapshot = BotSettings;

/* ============================================================================
 * 🧩 DOMAIN MODEL
 * ========================================================================== */

/**
 * Доменная модель версии бота.
 * Инварианты:
 * - `version` — монотонно неубывающее целое число (BotVersion).
 * - `rollbackFromVersion` (если задан) строго меньше `version`.
 * - `createdBy` и `createdAt` всегда заданы (audit-safe) — инвариант фабрик/слоя persistence.
 * - `instruction` не пустая (после trim).
 * - `settings` как минимум является объектом (sanity-check снимка конфигурации).
 * - `instruction` и `settings` относятся к одному и тому же ботy/версии (гарантируется снаружи).
 */
export type BotVersionAggregate = Readonly<{
  /** Идентификатор версии (обязателен на уровне домена). */
  readonly id: BotVersionId;

  /** Идентификатор бота, к которому относится версия. */
  readonly botId: BotId;

  /** Рабочее пространство бота (для шардирования и многоарендности). */
  readonly workspaceId: BotWorkspaceId;

  /** Номер версии бота (монотонно неубывающее значение). */
  readonly version: BotVersion;

  /** Инструкция бота в данной версии. */
  readonly instruction: BotInstruction;

  /**
   * Снимок настроек бота.
   * Детальная модель живёт в `BotSettings.ts`, здесь — только слепок конфигурации.
   */
  readonly settings: BotSettingsSnapshot;

  /**
   * Идентификатор операции, породившей эту версию (idempotency trace).
   * Позволяет безопасно повторять команды без дублирования версий.
   */
  readonly operationId: OperationId;

  /** Время создания версии (domain-level timestamp). */
  readonly createdAt: Timestamp;

  /** Пользователь, создавший эту версию. */
  readonly createdBy: BotUserId;

  /**
   * Дополнительные метаданные версии.
   * Содержат rollback-историю и теги.
   */
  readonly metadata: BotVersionMetadata;
}>;

/**
 * Domain-level ошибка нарушения инвариантов BotVersion.
 * Оформлена как Error-alias + фабрика (без class/this), совместима с observability-слоем.
 */
export type BotVersionInvariantError = Readonly<Error>;

export const createBotVersionInvariantError = (
  message: string,
): BotVersionInvariantError => {
  // Используем настоящий Error, чтобы сохранить stack и интеграцию с observability.
  // Локально разрешаем мутацию имени ошибки ради корректного name.
  // eslint-disable-next-line functional/prefer-immutable-types
  const error = new Error(message);
  // eslint-disable-next-line fp/no-mutation
  error.name = 'BotVersionInvariantError';
  return Object.freeze(error);
};

/**
 * Хелпер, который всегда выбрасывает BotVersionInvariantError.
 * Используется в тернарных выражениях и для лаконичных проверок.
 */
const throwBotVersionInvariantError = (message: string): never => {
  throw createBotVersionInvariantError(message);
};

/* ============================================================================
 * 🧪 INVARIANT CHECKS
 * ========================================================================== */

/**
 * Runtime-проверка инвариантов BotVersionAggregate.
 * Можно вызывать:
 * - на границах (при маппинге из/в transport/DB),
 * - в тестах,
 * - в policy-слое перед критическими операциями (publish/rollback).
 */
export function assertBotVersionInvariant(version: BotVersionAggregate): void {
  const versionValue = asNumber(version.version);

  const instructionErrorMessage = version.instruction.trim().length === 0
    ? 'BotVersion invariant violation: instruction MUST be a non-empty string'
    : null;

  const settingsErrorMessage = typeof version.settings !== 'object'
    ? 'BotVersion invariant violation: settings MUST be a non-null object'
    : null;

  const versionErrorMessage = versionValue < 0 || !Number.isInteger(versionValue)
    ? 'BotVersion invariant violation: version MUST be a non-negative integer'
    : null;

  const rollbackErrorMessage = version.metadata.rollbackFromVersion !== undefined
      && asNumber(version.metadata.rollbackFromVersion) >= versionValue
    ? 'BotVersion invariant violation: rollbackFromVersion MUST be less than current version'
    : null;

  const errorMessage = instructionErrorMessage
    ?? settingsErrorMessage
    ?? versionErrorMessage
    ?? rollbackErrorMessage;

  return errorMessage === null ? undefined : throwBotVersionInvariantError(errorMessage);
}
