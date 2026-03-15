/**
 * @file packages/feature-bots/src/domain/Bot.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Доменная модель бота
 * ============================================================================
 *
 * Архитектурная роль:
 * - Domain-агрегат Bot: lifecycle, оптимистичные версии и инварианты живут здесь, а не в transport/types слоях.
 * - Единый контракт для business-логики и policy-слоя (без UI/HTTP/DB-деталей и DTO-полей).
 *
 * Принципы:
 * - ✅ SRP: только структура агрегата и доменные типы (status, metadata, revision, timestamps), без бизнес-методов.
 * - ✅ Deterministic: явный lifecycle (Active/Deleted), optimistic-lock `revision` и branded timestamps.
 * - ✅ Domain-pure: без HTTP/DB/DTO-деталей, только доменные типы и инварианты.
 * - ✅ Extensible: типобезопасные, контролируемо расширяемые метаданные без unbounded JSON-дыр.
 */

import type { ID, JsonObject } from '@livai/core-contracts';

/* ============================================================================
 * 🔐 ID ТИПЫ
 * ========================================================================== */

/** Идентификатор бота (domain-level alias над ID<'Bot'>). */
export type BotId = ID<'Bot'>;

/** Идентификатор рабочего пространства, к которому привязан бот. */
export type BotWorkspaceId = ID<'Workspace'>;

/** Идентификатор пользователя (создатель/обновивший бот). */
export type BotUserId = ID<'User'>;

/* ============================================================================
 * ⏱️ ВРЕМЕННЫЕ ТИПЫ
 * ========================================================================== */

/**
 * Domain-level timestamp (epoch millis).
 * Формат (ISO/DB/transport) — инфраструктурная забота.
 * Branded type, чтобы не перепутать с произвольным number.
 */
export type Timestamp = number & { readonly __brand: 'Timestamp'; };

/**
 * Optimistic-lock версия агрегата.
 * Branded type, чтобы не путать с версиями конфигурации или timestamp.
 */
export type Revision = number & { readonly __brand: 'Revision'; };

/**
 * Версия конфигурации бота (логически отделена от revision).
 * Branded type, чтобы не путать с другими числовыми версиями.
 */
export type BotVersion = number & { readonly __brand: 'BotVersion'; };

/**
 * Вспомогательный helper для безопасного снятия бренда с числовых типов.
 * Нужен, чтобы избежать прямых `as number` в коде.
 */
const asNumber = <T extends number>(value: T): number => value as number;

/* ============================================================================
 * 🧩 METADATA
 * ========================================================================== */

/**
 * Дополнительные метаданные бота.
 * Важно:
 * - Это НЕ unbounded JSON-дыра. Структура эволюционирует контролируемо.
 * - Для расширений предпочтительно добавлять новые поля сюда (или versioned-подструктуры).
 */
export type BotMetadata = Readonly<{
  readonly labels?: readonly string[];
  readonly features?: Readonly<Record<string, boolean>>;
  readonly integrations?: Readonly<Record<string, JsonObject>>;
  /**
   * Расширяемое поле для back-compat сценариев.
   * Лучше, чем голый JsonObject: верхний уровень контролируется, а не произвольный.
   */
  readonly extra?: JsonObject;
}>;

/* ============================================================================
 * 🧩 DOMAIN MODEL
 * ========================================================================== */

/**
 * Статусы бота на domain-уровне.
 * Domain владеет lifecycle и не зависит от деталей transport-уровня.
 */
type Status<T extends string> = Readonly<{ type: T; }>;

export type ActiveBotStatus =
  | Status<'draft'>
  | Status<'active'>
  | Status<'paused'>
  | Status<'archived'>
  | Status<'suspended'>
  | Status<'deprecated'>;

export type DeletedBotStatus = Status<'deleted'>;

/** Базовая часть модели, общая для всех состояний lifecycle. */
type BotBase = Readonly<{
  /** Уникальный идентификатор бота. */
  readonly id: BotId;

  /** Рабочее пространство, в котором находится бот. */
  readonly workspaceId: BotWorkspaceId;

  /** Человекочитаемое имя бота. */
  readonly name: string;

  /**
   * Optimistic-lock версия агрегата.
   * Используется для CAS-обновлений: revision инкрементируется при каждом успешном update.
   */
  readonly revision: Revision;

  /**
   * Текущая версия конфигурации бота.
   * Инвариант: монотонно неубывающее значение, логически отделена от revision.
   */
  readonly currentVersion: BotVersion;

  /**
   * Дополнительные метаданные бота.
   * Используются для тегов, feature-флагов, интеграционных настроек и т.п.
   */
  readonly metadata: BotMetadata;

  /** Время создания бота (domain-level). */
  readonly createdAt: Timestamp;

  /** Время последнего обновления доменной модели бота (domain-level). */
  readonly updatedAt?: Timestamp;

  /** Пользователь, создавший бота. Инвариант: всегда присутствует. */
  readonly createdBy: BotUserId;

  /** Пользователь, последним обновивший бота. */
  readonly updatedBy?: BotUserId;
}>;

/**
 * Активный (не удалённый) бот.
 * Инварианты:
 * - status.type ∈ {draft, active, paused, archived, suspended, deprecated}
 * - deletedAt: never — логическое удаление не применено.
 */
export type ActiveBot =
  & BotBase
  & Readonly<{
    readonly status: ActiveBotStatus;
    readonly deletedAt?: never;
  }>;

/**
 * Удалённый бот.
 * Инварианты:
 * - status.type === 'deleted'
 * - deletedAt: обязательно, доменный timestamp логического удаления.
 */
export type DeletedBot =
  & BotBase
  & Readonly<{
    readonly status: DeletedBotStatus;
    readonly deletedAt: Timestamp;
  }>;

/**
 * Доменная модель бота как явный discriminated union.
 * Инварианты:
 * - `status` следует domain-контракту lifecycle (draft/active/paused/archived/deleted/suspended/deprecated).
 * - `revision` — optimistic-lock версия агрегата (CAS).
 * - `currentVersion` — версия конфигурации (монотонно неубывающее значение).
 * - Для `status.type === 'deleted'` всегда задан `deletedAt`, для остальных статусов — он отсутствует.
 * - `createdBy` всегда присутствует (audit-safe).
 */
export type Bot = Readonly<ActiveBot | DeletedBot>;

/**
 * Domain-level ошибка нарушения инвариантов Bot.
 * Позволяет policy/observability слоям отдельно классифицировать нарушения инвариантов.
 * Архитектурно оформляем её как Error-alias + фабрику, чтобы избежать class/this/mutation
 * и оставаться совместимыми с policy/observability-слоями (name используется как тип ошибки).
 */
export type BotInvariantError = Readonly<Error>;

export const createBotInvariantError = (message: string): BotInvariantError => {
  // Используем настоящий Error, чтобы сохранить stack и интеграцию с observability.
  // Локально разрешаем мутацию имени ошибки ради корректного name.
  // eslint-disable-next-line functional/prefer-immutable-types
  const error = new Error(message);
  // eslint-disable-next-line fp/no-mutation
  error.name = 'BotInvariantError';
  return Object.freeze(error);
};

/**
 * Хелпер, который всегда выбрасывает BotInvariantError.
 * Используется в тернарных выражениях, чтобы избежать if/else и "голых" выражений.
 */
const throwBotInvariantError = (message: string): never => {
  throw createBotInvariantError(message);
};

/**
 * Runtime-проверка инвариантов Bot.
 * Можно вызывать на границах (при маппингах из/в транспорт/DB), в тестах и policy-слое.
 */
export function assertBotInvariant(bot: Bot): void {
  // versioning инварианты (минимальные sanity-checks)
  const revisionValue = asNumber(bot.revision);

  const deletedErrorMessage = bot.status.type === 'deleted' && bot.deletedAt === undefined
    ? 'Bot invariant violation: deleted bot MUST have deletedAt'
    : null;

  const nonDeletedErrorMessage = bot.status.type !== 'deleted' && bot.deletedAt !== undefined
    ? 'Bot invariant violation: non-deleted bot MUST NOT have deletedAt'
    : null;

  const revisionErrorMessage = revisionValue < 0 || !Number.isInteger(revisionValue)
    ? 'Bot invariant violation: revision MUST be a non-negative integer'
    : null;

  const errorMessage = deletedErrorMessage
    ?? nonDeletedErrorMessage
    ?? revisionErrorMessage
    ?? (bot.currentVersion < 0 || !Number.isInteger(bot.currentVersion)
      ? 'Bot invariant violation: currentVersion MUST be a non-negative integer'
      : null);

  return errorMessage === null ? undefined : throwBotInvariantError(errorMessage);
}
