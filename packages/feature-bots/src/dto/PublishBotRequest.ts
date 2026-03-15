/**
 * @file packages/feature-bots/src/dto/PublishBotRequest.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — PublishBotRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - DTO-агрегат PublishBotRequest: контракт запроса публикации бота для API boundary.
 * - Используется bot endpoints для публикации бота или rollback к предыдущей версии.
 *
 * Принципы:
 * - ✅ SRP: только структура запроса публикации (без бизнес-логики и transport-деталей).
 * - ✅ DTO-pure: без HTTP/DB-деталей, только типы контрактов и инварианты.
 * - ✅ Immutable: все поля readonly для integrity и type-safety.
 * - ✅ Type-safe: discriminated union исключает impossible states на уровне типов.
 *
 * Разделение ответственности:
 * - PublishBotRequest: запрос публикации (version опционально) или rollback (rollbackVersion обязательно).
 * - Publishing (domain): доменная модель состояния публикации (draft/active/paused).
 */

import type { BotVersion } from '../domain/Bot.js';

/* ============================================================================
 * 🧩 PUBLISH BOT REQUEST TYPES
 * ========================================================================== */

/**
 * Запрос публикации версии бота.
 *
 * @remarks
 * Если version не задан (пустой объект {}), публикуется текущая версия бота (зависит от external state).
 * Пустой объект {} означает "publish current" - поведение зависит от текущего состояния бота.
 * Это нормальная практика для publish endpoint, но важно понимать, что request → effect не полностью детерминирован.
 */
export type PublishRequest = Readonly<{
  /**
   * Версия бота для публикации (опционально).
   * Если задана, должна существовать в истории версий бота.
   */
  readonly version?: BotVersion;
}>;

/**
 * Запрос rollback к предыдущей версии бота.
 *
 * @remarks
 * Validator должен строго enforce: rollbackVersion < currentActiveVersion.
 * Также проверяется существование версии в истории и безопасность (rollbackVersion <= latestSafeVersion,
 * если система поддерживает security patches).
 */
export type RollbackRequest = Readonly<{
  /**
   * Версия для отката (обязательно).
   * Используется для rollback к предыдущей версии (active(v5) → active(v3)).
   */
  readonly rollbackVersion: BotVersion;
}>;

/**
 * DTO запроса публикации бота.
 * Discriminated union исключает одновременное указание version и rollbackVersion на уровне типов.
 *
 * @remarks
 * Runtime validation выполняется в lib/bot-request-validator.ts.
 * Детальные инварианты описаны в PublishRequest и RollbackRequest.
 *
 * Extensibility:
 * - Union может быть расширен новыми сценариями публикации (например, forcePublish) отдельными members.
 * - Важно придерживаться подхода: не смешивать rollback и publish в одном member.
 */
export type PublishBotRequest = PublishRequest | RollbackRequest;

/* ============================================================================
 * 🔍 TYPE GUARDS — БЕЗОПАСНЫЙ PATTERN MATCHING
 * ========================================================================== */

/**
 * Type guard для проверки, является ли запрос PublishRequest.
 * Используется для безопасного pattern matching в сервисах.
 *
 * @param req - запрос публикации бота
 * @returns true, если запрос является PublishRequest
 */
export const isPublishRequest = (req: PublishBotRequest): req is PublishRequest =>
  'version' in req || Object.keys(req).length === 0;

/**
 * Type guard для проверки, является ли запрос RollbackRequest.
 * Используется для безопасного pattern matching в сервисах.
 *
 * @param req - запрос публикации бота
 * @returns true, если запрос является RollbackRequest
 */
export const isRollbackRequest = (req: PublishBotRequest): req is RollbackRequest =>
  'rollbackVersion' in req;
