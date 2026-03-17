/**
 * @file packages/feature-bots/src/lib/version-manager.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Version Manager (domain-pure версии конфигурации бота)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Lib-layer менеджер версий конфигурации: создаёт `BotVersionAggregate` (next/rollback) детерминированно.
 * - Domain (`domain/Bot.ts`, `domain/BotVersion.ts`) хранит только типы и инварианты; orchestration — здесь.
 *
 * Принципы:
 * - ✅ SRP: только операции с версиями (создание next/rollback), без persistence/transport.
 * - ✅ Deterministic: все timestamps/ids/operationId передаются явно, без `Date.now()` и генераторов.
 * - ✅ Immutable: возвращаемые объекты shallow-frozen, чтобы исключить случайные мутации.
 *
 * @remarks
 * - Этот модуль не генерирует `id` версии и не назначает `operationId` — это boundary/infra забота.
 * - Для idempotency используйте `operationId` как внешний ключ: создание версии должно быть
 *   условно-идемпотентным на уровне persistence (unique constraint), не на уровне pure функции.
 */

import type { Bot, BotVersion, Revision } from '../domain/Bot.js';
import { assertBotInvariant } from '../domain/Bot.js';
import type {
  BotInstruction,
  BotSettingsSnapshot,
  BotVersionAggregate,
  BotVersionId,
  BotVersionMetadata,
} from '../domain/BotVersion.js';
import { assertBotVersionInvariant } from '../domain/BotVersion.js';
import type { OperationId } from '../types/bot-commands.js';

/* ============================================================================
 * 🧾 PUBLIC API
 * ========================================================================== */

export type CreateNextBotVersionInput = Readonly<{
  /** Идентификатор новой версии (генерируется снаружи). */
  readonly id: BotVersionId;
  /** Бот, для которого создаётся версия (используется как источник botId/workspaceId/currentVersion). */
  readonly bot: Bot;
  /** Предыдущая версия (снапшот), от которой идём вперёд. */
  readonly previous: BotVersionAggregate;
  /** Новая инструкция. */
  readonly instruction: BotInstruction;
  /** Новый снимок настроек. */
  readonly settings: BotSettingsSnapshot;
  /** Идентификатор операции (idempotency trace). */
  readonly operationId: OperationId;
  /** Audit: кто создал версию. */
  readonly createdBy: BotVersionAggregate['createdBy'];
  /** Audit: когда создана версия. */
  readonly createdAt: BotVersionAggregate['createdAt'];
  /** Метаданные версии (теги/extra). */
  readonly metadata?: Omit<BotVersionMetadata, 'rollbackFromVersion'>;
}>;

export type CreateRollbackBotVersionInput = Readonly<{
  /** Идентификатор новой версии (генерируется снаружи). */
  readonly id: BotVersionId;
  /** Бот, для которого создаётся версия отката. */
  readonly bot: Bot;
  /** Текущая версия, с которой выполняется откат. */
  readonly from: BotVersionAggregate;
  /** Целевая версия, на которую откатываемся (источник instruction/settings). */
  readonly to: BotVersionAggregate;
  /** Идентификатор операции (idempotency trace). */
  readonly operationId: OperationId;
  /** Audit: кто инициировал откат. */
  readonly createdBy: BotVersionAggregate['createdBy'];
  /** Audit: когда создана версия отката. */
  readonly createdAt: BotVersionAggregate['createdAt'];
  /** Дополнительные метаданные версии (теги/extra). */
  readonly metadata?: Omit<BotVersionMetadata, 'rollbackFromVersion'>;
}>;

/**
 * Создаёт следующую версию конфигурации (монотонный инкремент версии).
 *
 * @remarks
 * Используйте для publish/update-instruction/update-settings сценариев.
 * Функция не мутирует `bot`/`previous` и не обращается к внешнему состоянию.
 * Ожидания (boundary responsibility):
 * - `previous.botId/workspaceId` соответствуют `bot.id/workspaceId`.
 */
export function createNextBotVersion(input: CreateNextBotVersionInput): BotVersionAggregate {
  assertBotInvariant(input.bot);
  assertBotVersionInvariant(input.previous);

  const nextVersion = incrementBotVersion(input.previous.version);

  const aggregate: BotVersionAggregate = {
    id: input.id,
    botId: input.bot.id,
    workspaceId: input.bot.workspaceId,
    version: nextVersion,
    instruction: input.instruction,
    settings: input.settings,
    operationId: input.operationId,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    metadata: Object.freeze({
      ...(input.metadata ?? {}),
    }),
  } as BotVersionAggregate;

  assertBotVersionInvariant(aggregate);
  return Object.freeze(aggregate);
}

/**
 * Создаёт новую версию-конфигурацию как результат rollback.
 *
 * @remarks
 * Инвариант rollback:
 * - Новая версия всегда создаётся как next-version (монотонный рост),
 * - `metadata.rollbackFromVersion` указывает на версию, с которой откатились,
 * - instruction/settings берутся из целевой `to`.
 * Ожидания (boundary responsibility):
 * - `from.botId/workspaceId` и `to.botId/workspaceId` соответствуют `bot.id/workspaceId`.
 */
export function createRollbackBotVersion(
  input: CreateRollbackBotVersionInput,
): BotVersionAggregate {
  assertBotInvariant(input.bot);
  assertBotVersionInvariant(input.from);
  assertBotVersionInvariant(input.to);

  const nextVersion = incrementBotVersion(input.from.version);

  const aggregate: BotVersionAggregate = {
    id: input.id,
    botId: input.bot.id,
    workspaceId: input.bot.workspaceId,
    version: nextVersion,
    instruction: input.to.instruction,
    settings: input.to.settings,
    operationId: input.operationId,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
    metadata: Object.freeze({
      ...(input.metadata ?? {}),
      rollbackFromVersion: input.from.version,
    }),
  } as BotVersionAggregate;

  assertBotVersionInvariant(aggregate);
  return Object.freeze(aggregate);
}

/**
 * Возвращает новый `Bot`, у которого `currentVersion` синхронизирован с созданной `BotVersionAggregate`.
 *
 * @remarks
 * Это не persistence-операция. Используйте как pure helper при сборке нового состояния агрегата.
 * `revision` увеличивается на 1 как CAS-семантика (монотонно), timestamps задаются явно.
 * Ожидания (boundary responsibility):
 * - `version.botId/workspaceId` соответствуют `bot.id/workspaceId`.
 */
export function applyVersionToBot(
  input: Readonly<{
    readonly bot: Bot;
    readonly version: BotVersionAggregate;
    readonly updatedAt: Bot['updatedAt'];
    readonly updatedBy: Bot['updatedBy'];
  }>,
): Bot {
  assertBotInvariant(input.bot);
  assertBotVersionInvariant(input.version);

  const nextRevision = incrementNonNegativeInteger(
    Number(input.bot.revision),
  ) as unknown as Revision;

  const updated: Bot = Object.freeze({
    ...input.bot,
    currentVersion: input.version.version,
    revision: nextRevision,
    updatedAt: input.updatedAt,
    updatedBy: input.updatedBy,
  }) as Bot;

  assertBotInvariant(updated);
  return updated;
}

/* ============================================================================
 * 🧩 INTERNAL HELPERS
 * ========================================================================== */

/** Инкремент версии (монотонный шаг +1). */
function incrementBotVersion(version: BotVersion): BotVersion {
  return (Number(version) + 1) as BotVersion;
}

/**
 * Инкремент неотрицательного целого числа.
 *
 * @remarks
 * Вход ожидается как non-negative integer (domain invariant). Защита `next < 0 ? 0 : next`
 * оставлена как boundary-safety на случай некорректного runtime ввода.
 */
function incrementNonNegativeInteger(value: number): number {
  const next = value + 1;
  return next < 0 ? 0 : next;
}
