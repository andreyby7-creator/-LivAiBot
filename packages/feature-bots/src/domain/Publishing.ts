/**
 * @file packages/feature-bots/src/domain/Publishing.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Доменная модель публикации бота
 * ============================================================================
 *
 * Архитектурная роль:
 * - Domain-агрегат Publishing: source-of-truth для состояния публикации бота.
 * - Отдельная от Bot модель: Publishing описывает lifecycle публикации (draft/active/paused) и версионирование.
 * - Используется для управления публикацией ботов и отслеживания версий (publishedVersion, rollbackVersion).
 * - State machine: draft → active, active → paused, paused → active, active(v5) → active(v3) (rollback к предыдущей версии).
 * - ВАЖНО: Валидация инвариантов находится в lib/publishing-validator.ts (assertPublishingInvariant).
 *
 * Принципы:
 * - ✅ SRP: только структура публикации и инварианты (без бизнес-логики и transport-деталей).
 * - ✅ Deterministic: явный lifecycle через discriminated union (DraftPublishing/ActivePublishing/PausedPublishing).
 * - ✅ Domain-pure: без HTTP/DB/DTO-деталей, только доменные типы и инварианты.
 * - ✅ Immutable: все поля readonly для audit trail integrity.
 * - ✅ Type-safe: discriminated union исключает impossible states на уровне типов.
 * - ✅ Extensible: добавление новых статусов не требует изменения nullable-комбинаций.
 * - ✅ Microservice-ready: строгая, сериализуемая модель, удобная для межсервисного взаимодействия.
 */

import type { BotId, BotVersion, Timestamp } from './Bot.js';

/* ============================================================================
 * 🧩 PUBLISHING STATES (State Machine)
 * ========================================================================== */

/** Базовая часть модели, общая для всех состояний lifecycle. */
type PublishingBase = Readonly<{
  /** Идентификатор бота (immutable). */
  readonly botId: BotId;
}>;

/**
 * Состояние черновика (draft).
 * Бот не опубликован, publishedAt и publishedVersion отсутствуют.
 */
export type DraftPublishing =
  & PublishingBase
  & Readonly<{
    readonly status: 'draft';
  }>;

/**
 * Состояние активной публикации (active).
 * Бот опубликован и активен, имеет publishedAt и publishedVersion.
 */
export type ActivePublishing =
  & PublishingBase
  & Readonly<{
    readonly status: 'active';
    /** Временная метка публикации. */
    readonly publishedAt: Timestamp;
    /** Версия бота, которая опубликована. */
    readonly publishedVersion: BotVersion;
    /**
     * Версия для отката (опционально).
     * Используется для указания версии, на которую нужно откатиться при rollback.
     * Инварианты (проверяются в validator):
     * - rollbackVersion < publishedVersion && rollbackVersion !== publishedVersion
     * - rollbackVersion должен ссылаться на существующую версию бота
     * После rollback rollbackVersion становится новым publishedVersion (active(v5) → active(v3)).
     */
    readonly rollbackVersion?: BotVersion;
  }>;

/**
 * Состояние приостановленной публикации (paused).
 * Бот опубликован, но трафик отключен (active bot with traffic disabled).
 * Имеет publishedAt и publishedVersion (обязательно).
 */
export type PausedPublishing =
  & PublishingBase
  & Readonly<{
    readonly status: 'paused';
    /** Временная метка публикации. */
    readonly publishedAt: Timestamp;
    /** Версия бота, которая опубликована. */
    readonly publishedVersion: BotVersion;
    /**
     * Версия для отката (опционально).
     * Используется для указания версии, на которую нужно откатиться при rollback.
     * Инварианты (проверяются в validator):
     * - rollbackVersion < publishedVersion && rollbackVersion !== publishedVersion
     * - rollbackVersion должен ссылаться на существующую версию бота
     * После rollback rollbackVersion становится новым publishedVersion (paused(v5) → active(v3)).
     */
    readonly rollbackVersion?: BotVersion;
  }>;

/**
 * Доменная модель публикации бота.
 * Discriminated union для type-safe state machine:
 * - Исключает impossible states на уровне типов
 * - Явно отражает lifecycle (draft → active → paused)
 * - Упрощает расширение новыми статусами без nullable-комбинаций
 *
 * State machine transitions:
 * - draft → active (публикация)
 * - active → paused (приостановка)
 * - paused → active (возобновление)
 * - active(v5) → active(v3) (rollback к предыдущей версии, бот остается активным)
 * - paused(v5) → active(v3) (rollback к предыдущей версии с переходом в active)
 *
 * Инварианты:
 * - botId: immutable (не изменяется между состояниями)
 * - ActivePublishing/PausedPublishing: publishedAt и publishedVersion обязательны
 * - rollbackVersion: инварианты описаны в комментариях к полю (проверяются в validator)
 * - При rollback: rollbackVersion становится новым publishedVersion (система остается активной)
 */
export type Publishing = DraftPublishing | ActivePublishing | PausedPublishing;

/**
 * Статус публикации бота (для удобства).
 * Exhaustive union для type-safe обработки статусов без if/else-монолита.
 */
export type PublishingStatus = Publishing['status'];

/* ============================================================================
 * 🧪 ERROR TYPES
 * ========================================================================== */

/**
 * Domain-level ошибка нарушения инвариантов Publishing.
 * Оформлена как Error-alias + фабрика (без class/this), совместима с observability-слоем.
 */
export type PublishingInvariantError = Readonly<Error>;

export const createPublishingInvariantError = (
  message: string,
): PublishingInvariantError => {
  // Используем настоящий Error, чтобы сохранить stack и интеграцию с observability.
  // Локально разрешаем мутацию имени ошибки ради корректного name.
  // eslint-disable-next-line functional/prefer-immutable-types
  const error = new Error(message);
  // eslint-disable-next-line fp/no-mutation -- установка name для observability-интеграции
  error.name = 'PublishingInvariantError';
  return Object.freeze(error);
};
