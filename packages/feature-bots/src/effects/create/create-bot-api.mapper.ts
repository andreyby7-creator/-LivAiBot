/**
 * @file packages/feature-bots/src/effects/create/create-bot-api.mapper.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Create Bot API Mapper (Request/Response)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Pure маппинг create-flow input → API input для `BotApiClientPort.createBot`.
 * - Boundary guardrail: fail-closed на некорректном request через schema-валидацию.
 * - Response маппинг делегирован shared-mapper'у (`mapBotResponseToBotInfo`) для SSOT.
 *
 * Принципы:
 * - ✅ SRP: только mapping/validation, без IO/store/policy логики.
 * - ✅ Deterministic: одинаковый input всегда даёт одинаковый API payload/result.
 * - ✅ Reuse: использует существующие shared мапперы и схемы.
 */

import type { BotErrorResponse } from '../../contracts/BotErrorResponse.js';
import { createBotErrorResponse } from '../../lib/bot-errors.js';
import { createBotRequestSchema } from '../../schemas/index.js';
import type { BotInfo } from '../../types/bots.js';
import type {
  BotApiCreateBotInput,
  BotCreateRequestTransport,
  BotResponseTransport,
} from '../shared/api-client.port.js';
import { mapBotResponseToBotInfo } from '../shared/bots-api.mappers.js';
import type { ParseIssue } from '../shared/mapper.contracts.js';
import { mapperErrorCodeParsingJsonInvalid } from '../shared/mapper.contracts.js';
import type { CreateBotEffectInput } from './create-bot-effect.types.js';

/* ============================================================================
 * 🔎 INTERNAL HELPERS
 * ============================================================================
 */

/**
 * Создаёт mapping-level `BotErrorResponse` для ошибок create-bot API маппера.
 *
 * @remarks
 * Это boundary/mapping ошибка (валидация формы request), а не бизнес-ошибка домена.
 * Используется для fail-closed поведения на этапе подготовки transport payload.
 */
export function createCreateBotApiMappingError(
  message: string,
  issues?: readonly ParseIssue[] | undefined,
): BotErrorResponse {
  return createBotErrorResponse({
    code: mapperErrorCodeParsingJsonInvalid,
    context: Object.freeze({
      details: Object.freeze({
        mapper: 'create-bot-api.mapper',
        message,
        ...(issues !== undefined ? { issues } : {}),
      }),
    }),
  });
}

/**
 * Валидирует и нормализует create request для transport-границы.
 *
 * @remarks
 * Fail-closed: при любой несовместимости со схемой выбрасывается mapping-level error
 * (`BOT_PARSING_JSON_INVALID`) вместо частично-валидного payload.
 * Upstream должен выполнять базовую валидацию `workspaceId/request` до вызова mapper.
 */
function validateCreateRequest(input: CreateBotEffectInput['request']): BotCreateRequestTransport {
  const parsed = createBotRequestSchema.safeParse(input);
  if (parsed.success) {
    return parsed.data as BotCreateRequestTransport;
  }

  const issues: readonly ParseIssue[] = Object.freeze(
    parsed.error.issues.map((issue) =>
      Object.freeze({
        path: issue.path.join('.'),
        message: issue.message,
      })
    ),
  );
  throw createCreateBotApiMappingError('Некорректный request для create-bot API', issues);
}

/* ============================================================================
 * 🎯 PUBLIC API
 * ============================================================================
 */

/**
 * Маппит вход create-effect в input для `BotApiClientPort.createBot`.
 */
export function mapCreateBotEffectInputToApiInput(
  input: Readonly<CreateBotEffectInput>,
): Readonly<BotApiCreateBotInput> {
  return Object.freeze({
    workspaceId: input.workspaceId,
    ...(input.operationId !== undefined ? { operationId: input.operationId } : {}),
    body: validateCreateRequest(input.request),
  });
}

/**
 * Маппит validated transport response create-bot API в `BotInfo`.
 * Делегирует shared мапперу, чтобы статус/поля обрабатывались единообразно.
 */
export function mapCreateBotResponseToBotInfo(dto: Readonly<BotResponseTransport>): BotInfo {
  return mapBotResponseToBotInfo(dto);
}
