/**
 * @file Infrastructure Error Layer - публичный экспорт всего Infrastructure слоя
 *
 * Infrastructure-специфичный ADT ошибок поверх Error Kernel.
 * Типобезопасное моделирование infrastructure failures (IO, runtime, external services).
 */

// InfrastructureError exports
export * from './InfrastructureError.js'
// InfrastructureErrorMeta exports
export * from './InfrastructureErrorMeta.js'

