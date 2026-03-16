/**
 * @file Автосгенерированные Zod-схемы (OpenAPI → Zod) для сервиса "auth".

 * Источник истины: services/<service>/openapi.json

 * ⚠️ АВТОСГЕНЕРИРОВАНО. НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ.
 * Любые изменения вносятся через OpenAPI и повторную генерацию.
 */

import { z } from "zod";

const LoginRequest = z
  .object({
    email: z.string().min(3).max(320),
    password: z.string().min(8).max(128),
  })
  .passthrough();
export const LoginRequestSchema = LoginRequest;
const TokenPairResponse = z
  .object({
    access_token: z.string(),
    refresh_token: z.string(),
    token_type: z.string().optional().default("bearer"),
  })
  .passthrough();
export const TokenPairResponseSchema = TokenPairResponse;
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
const Authorization = z.union([z.string(), z.null()]).optional();
export const AuthorizationSchema = Authorization;
const MeResponse = z
  .object({
    email: z.string(),
    user_id: z.string().uuid(),
    workspace_id: z.string().uuid(),
  })
  .passthrough();
export const MeResponseSchema = MeResponse;
const RefreshRequest = z.object({ refresh_token: z.string() }).passthrough();
export const RefreshRequestSchema = RefreshRequest;
const RegisterRequest = z
  .object({
    email: z.string().min(3).max(320),
    password: z.string().min(8).max(128),
    workspace_name: z.string().min(1).max(200),
  })
  .passthrough();
export const RegisterRequestSchema = RegisterRequest;

export const schemas = {
  LoginRequest: LoginRequestSchema,
  TokenPairResponse: TokenPairResponseSchema,
  ValidationError: ValidationErrorSchema,
  HTTPValidationError: HTTPValidationErrorSchema,
  Authorization: AuthorizationSchema,
  MeResponse: MeResponseSchema,
  RefreshRequest: RefreshRequestSchema,
  RegisterRequest: RegisterRequestSchema,
} as const;

export type SchemaName = keyof typeof schemas;
