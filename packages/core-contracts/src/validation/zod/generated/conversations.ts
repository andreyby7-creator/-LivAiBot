/**
 * @file Автосгенерированные Zod-схемы (OpenAPI → Zod) для сервиса "conversations".

 * Источник истины: services/<service>/openapi.json

 * ⚠️ АВТОСГЕНЕРИРОВАНО. НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ.
 * Любые изменения вносятся через OpenAPI и повторную генерацию.
 */

import { z } from "zod";

const ThreadResponse = z
  .object({
    bot_id: z.union([z.string(), z.null()]),
    created_at: z.string().datetime({ offset: true }),
    id: z.string().uuid(),
    status: z.string(),
    workspace_id: z.string().uuid(),
  })
  .passthrough();
export const ThreadResponseSchema = ThreadResponse;
const ThreadsListResponse = z
  .object({ items: z.array(ThreadResponse) })
  .passthrough();
export const ThreadsListResponseSchema = ThreadsListResponse;
const ThreadCreateRequest = z
  .object({ bot_id: z.union([z.string(), z.null()]) })
  .partial()
  .passthrough();
export const ThreadCreateRequestSchema = ThreadCreateRequest;
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
const MessageResponse = z
  .object({
    content: z.string(),
    created_at: z.string().datetime({ offset: true }),
    id: z.string().uuid(),
    operation_id: z.union([z.string(), z.null()]).optional(),
    role: z.string(),
    thread_id: z.string().uuid(),
  })
  .passthrough();
export const MessageResponseSchema = MessageResponse;
const MessagesListResponse = z
  .object({ items: z.array(MessageResponse) })
  .passthrough();
export const MessagesListResponseSchema = MessagesListResponse;
const TurnRequest = z
  .object({ content: z.string().min(1).max(50000) })
  .passthrough();
export const TurnRequestSchema = TurnRequest;
const X_Operation_Id = z.union([z.string(), z.null()]).optional();
export const X_Operation_IdSchema = X_Operation_Id;
const TurnResponse = z
  .object({
    assistant_message: MessageResponse,
    thread_id: z.string().uuid(),
    user_message: MessageResponse,
  })
  .passthrough();
export const TurnResponseSchema = TurnResponse;

export const schemas = {
  ThreadResponse: ThreadResponseSchema,
  ThreadsListResponse: ThreadsListResponseSchema,
  ThreadCreateRequest: ThreadCreateRequestSchema,
  ValidationError: ValidationErrorSchema,
  HTTPValidationError: HTTPValidationErrorSchema,
  MessageResponse: MessageResponseSchema,
  MessagesListResponse: MessagesListResponseSchema,
  TurnRequest: TurnRequestSchema,
  X_Operation_Id: X_Operation_IdSchema,
  TurnResponse: TurnResponseSchema,
} as const;

export type SchemaName = keyof typeof schemas;
