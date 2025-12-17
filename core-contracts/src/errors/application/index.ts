/**
 * @file Application Error Layer - публичный экспорт всего Application слоя
 *
 * Application-специфичный ADT ошибок поверх Error Kernel.
 * Типобезопасное моделирование application failures (CQRS, orchestration, permissions).
 */

// ApplicationError exports
export * from './ApplicationError.js'
// ApplicationErrorMeta exports
export * from './ApplicationErrorMeta.js'

