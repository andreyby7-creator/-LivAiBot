/**
 * @file packages/feature-bots/src/effects/create/create-bot-store-updater.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Create Bot Store Updater
 * ============================================================================
 *
 * Назначение:
 * - Единственная точка применения результата create-flow к состоянию bots-store.
 * - Pure sink над `BotsStorePort`: не считает business-доменные правила и не выполняет IO.
 *
 * Инварианты уровня файла:
 * - ❌ Не читает transport/HTTP детали: работает только с `BotInfo` (feature-level).
 * - ✅ updateCreateBotState **не читает store напрямую** и **не использует storePort.getState**: только формирует batch-intents
 *   и применяет их через `batchUpdate`.
 * - ✅ Обновляет store через `batchUpdate` синхронно: подписчики не должны видеть промежуточные состояния
 *   внутри одной logical-operation.
 * - ✅ Детерминированно относительно актуального store: `upsertBot(bot)` не перезаписывает остальные entities (устраняет lost update при последовательных create).
 * - ✅ Отвечает за store-sink семантику: не выполняет boundary/PII валидации и не нормализует request.
 * - @internal Для payload'ов, где может быть PII/секреты: store-updater **не санитизирует** данные. Очищение/маскирование обязан выполнять слой маппинга/пайплайна выше.
 * - @contract store-updater ожидает на вход `BotInfo`, который был построен выше по пайплайну
 *   (Zod валидация transport-слоёв + feature-level маппинг в `bots-api.mappers.ts`).
 *   Если кто-то обходит orchestrator/mappers и передаёт “не контрактный” `BotInfo`,
 *   то store-updater не обязан пытаться это починить — это нарушение архитектурного контракта.
 */

import type { OperationSuccess } from '../../contracts/OperationState.js';
import type { BotInfo } from '../../types/bots.js';
import type { BotsStoreBatchUpdate, BotsStorePort } from '../shared/bots-store.port.js';

/* ============================================================================
 * 🎯 PUBLIC API
 * ============================================================================
 */

function buildCreateSuccessState(
  bot: BotInfo,
): OperationSuccess<BotInfo> {
  // OperationState "success" для create-ветки в рамках boundary-контрактов.
  return Object.freeze({ status: 'success', data: bot }) as OperationSuccess<BotInfo>;
}

/**
 * Обновляет bots-store после успешного создания бота.
 *
 * @remarks
 * - Обновляет `bots.entities` через `upsertBot` и выставляет `operations.create` в `success`.
 * - Не использует `setStoreLocked` напрямую; атомарность достигается `batchUpdate`.
 * - Не читает store напрямую: формирует batch-intents только из входного `bot` и применяет их через `storePort.batchUpdate`.
 */
export function updateCreateBotState(
  storePort: BotsStorePort,
  bot: BotInfo,
): void {
  const updates: readonly BotsStoreBatchUpdate[] = Object.freeze([
    { type: 'upsertBot', bot },
    { type: 'setCreateState', state: buildCreateSuccessState(bot) },
  ]);

  storePort.batchUpdate(updates);
}
