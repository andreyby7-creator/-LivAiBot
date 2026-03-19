/**
 * @file packages/feature-bots/src/effects/shared/api-client.port.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — ApiClient Port (Shared)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Единый контракт HTTP-клиента для bot-эффектов.
 * - Стандартизирован на Effect для единой async-модели в orchestrator.
 * - Изолирует effects от деталей реализации HTTP-клиента (fetch/axios/baseURL/interceptors).
 *
 * Принципы:
 * - ✅ Port pattern: объектный интерфейс доменных HTTP-операций.
 * - ✅ Effect-based: все методы возвращают Effect для композиции и отмены.
 * - ✅ AbortSignal через параметр Effect: единообразная cancellation-модель в orchestrator.
 * - ✅ Extensible: легко расширяется новыми endpoint'ами без изменения core-алгоритма adapter'а.
 * - ❌ Нет бизнес-логики: только контракт.
 */

import type { z } from 'zod';

import type { Effect } from '@livai/core/effect';
import type { RequestId } from '@livai/core-contracts';
import type { generatedBots } from '@livai/core-contracts/validation/zod';

import type { BotId, BotWorkspaceId } from '../../domain/Bot.js';
import type { OperationId } from '../../types/bot-commands.js';

/* ============================================================================
 * 🧭 TYPES — REQUEST CONTEXT (domain-safe)
 * ============================================================================
 */

/**
 * Минимальный контекст вызова операции для bot-эффектов.
 *
 * @remarks
 * - Это НЕ HTTP options: контекст не содержит raw headers/baseURL/retry/timeouts.
 * - Adapter — единственная точка формирования HTTP-заголовков (anti-leak transport деталей).
 * - Поля контекста должны оставаться доменно-значимыми (idempotency/tracing/correlation), а не transport-специфичными.
 */
export type RequestContext = Readonly<{
  /**
   * Идентификатор операции для идемпотентности/трассировки.
   * @remarks
   * - Тип `OperationId` брендирован (не «просто string») через `ID<'Operation'>`.
   * - Adapter маппит это поле в allow-listed header `X-Operation-Id`.
   */
  readonly operationId?: OperationId;

  /**
   * Идентификатор запроса для корреляции на одном hop (frontend ↔ gateway ↔ service).
   * @remarks
   * ⚠️ Зарезервировано на будущее: на текущий момент **не влияет на поведение порта**
   * и **не маппится adapter'ом** в HTTP-заголовки/параметры.
   * Поле добавлено для будущих расширений без ломки API, когда появится
   * стандартизированный header и единая политика прокидывания (SSOT — `@livai/core-contracts/context/headers.ts`).
   */
  readonly requestId?: RequestId;
}>;

/* ============================================================================
 * 🧩 TYPES — TRANSPORT SHAPES (bots-service)
 * ============================================================================
 */

/**
 * Transport DTO (validated): shape ответа `bots-service` после Zod-валидации.
 * Это boundary-тип (effects/transport), не domain-модель.
 */
export type BotResponseTransport = z.infer<typeof generatedBots.BotResponseSchema>;

/**
 * Transport DTO (validated): shape ответа списка ботов `bots-service` после Zod-валидации.
 * Это boundary-тип (effects/transport), не domain-модель.
 */
export type BotsListResponseTransport = z.infer<typeof generatedBots.BotsListResponseSchema>;

/** Transport DTO (validated): body для create bot (Zod/OpenAPI generated). */
export type BotCreateRequestTransport = z.infer<typeof generatedBots.BotCreateRequestSchema>;

/** Transport DTO (validated): body для update instruction (Zod/OpenAPI generated). */
export type UpdateInstructionRequestTransport = z.infer<
  typeof generatedBots.UpdateInstructionRequestSchema
>;

/* ============================================================================
 * 🧭 TYPES — PORT (Effect-based)
 * ============================================================================
 */

type WithWorkspace = Readonly<{ readonly workspaceId: BotWorkspaceId; }>;
type WithOptionalOperation = Readonly<{ readonly operationId?: OperationId; }>;
type WithBotId = Readonly<{ readonly botId: BotId; }>;
type WithBody<TBody> = Readonly<{ readonly body: TBody; }>;

export type BotApiListBotsInput = WithWorkspace;

export type BotApiCreateBotInput =
  & WithWorkspace
  & WithOptionalOperation
  & WithBody<BotCreateRequestTransport>;

export type BotApiGetBotInput = WithWorkspace & WithBotId;

export type BotApiUpdateInstructionInput =
  & WithWorkspace
  & WithOptionalOperation
  & WithBotId
  & WithBody<UpdateInstructionRequestTransport>;

/**
 * Порт для HTTP-клиента bots-домена на boundary effects/transport (Effect-based).
 *
 * @remarks
 * - Этот порт intentionally возвращает validated transport DTO и не является domain-моделью.
 * - AbortSignal передаётся через параметр Effect (предпочтительно и единообразно для orchestrator).
 */
export type BotApiClientPort = Readonly<{
  readonly listBots: (
    input: BotApiListBotsInput,
    context?: RequestContext,
  ) => Effect<BotsListResponseTransport>;

  readonly createBot: (
    input: BotApiCreateBotInput,
    context?: RequestContext,
  ) => Effect<BotResponseTransport>;

  readonly getBot: (
    input: BotApiGetBotInput,
    context?: RequestContext,
  ) => Effect<BotResponseTransport>;

  readonly updateInstruction: (
    input: BotApiUpdateInstructionInput,
    context?: RequestContext,
  ) => Effect<BotResponseTransport>;
}>;
