/**
 * @file normalizers/index.ts — публичный API для нормализаторов ошибок
 *
 * Экспортирует функции нормализации внешних ошибок (HTTP, gRPC, etc.) в BaseError.
 */
export {
  normalizeHttpResponse,
  normalizeAxiosError,
  normalizeHttpError,
  extractCorrelationId
} from "./HttpErrorNormalizer.js"

export type { HttpHeaders, HttpErrorContext, HttpErrorLike } from "./HttpErrorNormalizer.js"

