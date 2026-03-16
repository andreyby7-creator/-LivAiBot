/**
 * @file Автосгенерированные Zod-схемы (OpenAPI → Zod) для сервиса "bots".

 * Источник истины: services/<service>/openapi.json

 * ⚠️ АВТОСГЕНЕРИРОВАНО. НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ.
 * Любые изменения вносятся через OpenAPI и повторную генерацию.
 */

import { z } from "zod";

const BotResponse = z
  .object({
    created_at: z.string().datetime({ offset: true }),
    current_version: z.number().int(),
    id: z.string().uuid(),
    name: z.string(),
    status: z.string(),
    workspace_id: z.string().uuid(),
  })
  .passthrough();
export const BotResponseSchema = BotResponse;
const BotsListResponse = z
  .object({ items: z.array(BotResponse) })
  .passthrough();
export const BotsListResponseSchema = BotsListResponse;
const BotCreateRequest = z
  .object({
    instruction: z.string().max(50000).optional().default(""),
    name: z.string().min(1).max(200),
    settings: z.object({}).partial().passthrough().optional(),
  })
  .passthrough();
export const BotCreateRequestSchema = BotCreateRequest;
const X_Operation_Id = z.union([z.string(), z.null()]).optional();
export const X_Operation_IdSchema = X_Operation_Id;
const ValidationError = z
  .object({
    loc: z.array(z.union([z.string(), z.number()])),
    msg: z.string(),
    type: z.string(),
  })
  .passthrough();
export const ValidationErrorSchema = ValidationError;
const HTTPValidationError = z
  .object({ detail: z.array(ValidationError) })
  .partial()
  .passthrough();
export const HTTPValidationErrorSchema = HTTPValidationError;
const UpdateInstructionRequest = z
  .object({
    instruction: z.string().min(1).max(50000),
    settings: z.object({}).partial().passthrough().optional(),
  })
  .passthrough();
export const UpdateInstructionRequestSchema = UpdateInstructionRequest;

export const schemas = {
  BotResponse: BotResponseSchema,
  BotsListResponse: BotsListResponseSchema,
  BotCreateRequest: BotCreateRequestSchema,
  X_Operation_Id: X_Operation_IdSchema,
  ValidationError: ValidationErrorSchema,
  HTTPValidationError: HTTPValidationErrorSchema,
  UpdateInstructionRequest: UpdateInstructionRequestSchema,
} as const;

export type SchemaName = keyof typeof schemas;
