/**
 * @file PaymentProviderId.ts - Shared types для платежных провайдеров
 *
 * Центральный репозиторий типов, связанных с payment providers.
 * Используется всеми инфраструктурными модулями billing service.
 *
 * Архитектурная роль:
 * - Предотвращает циклические зависимости между инфраструктурными ошибками
 * - Обеспечивает consistent type safety для всех payment provider IDs
 * - Служит single source of truth для валидации и типизации
 */

export type PaymentProviderId = string & { readonly __brand: 'PaymentProviderId'; };

/**
 * Максимальная длина идентификатора платежного провайдера.
 *
 * Обоснование выбора 50 символов:
 * - Достаточно для читаемых имен: "russian-standard-bank", "international-payment-gateway"
 * - Защита от DoS через слишком длинные строки в логах/метриках
 * - Соответствует типичным ограничениям БД (VARCHAR(50), VARCHAR(64))
 * - Позволяет использовать в URL, headers, correlation IDs
 * - Оставляет запас для будущих требований (банки, новые провайдеры)
 */
export const MAX_PROVIDER_ID_LENGTH = 50;

/** Валидатор для PaymentProviderId с boundary checks */
export function isPaymentProviderId(value: unknown): value is PaymentProviderId {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_PROVIDER_ID_LENGTH;
}
