/**
 * @file Security Error Layer - публичный экспорт всего Security слоя
 *
 * Security-специфичный ADT ошибок поверх Error Kernel.
 * Типобезопасное моделирование security failures (authentication, authorization, rate limiting).
 */

// SecurityError exports
export * from './SecurityError.js'
// SecurityErrorMeta exports
export * from './SecurityErrorMeta.js'

