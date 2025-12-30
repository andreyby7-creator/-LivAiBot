/**
 * @file BillingOperation.ts - Доменные операции billing service
 *
 * Брендированные типы для безопасной работы с операциями.
 * Защищает от случайных строковых значений в runtime.
 */

import type { Branded } from 'effect/Brand';

// ==================== БРЕНДИРОВАННЫЕ ТИПЫ ====================

/** Брендированный тип для billing операций */
export type BillingOperation = Branded<string, 'BillingOperation'>;

/** Допустимые значения billing операций */
export const BILLING_OPERATIONS = {
  PAYMENT: 'payment' as BillingOperation,
  REFUND: 'refund' as BillingOperation,
  SUBSCRIPTION: 'subscription' as BillingOperation,
  VALIDATION: 'validation' as BillingOperation,
} as const;

/** Type guard для проверки billing операций */
export const isBillingOperation = (value: string): value is BillingOperation =>
  Object.values(BILLING_OPERATIONS).includes(value as BillingOperation);

/** Безопасное создание BillingOperation */
export const makeBillingOperation = (value: string): BillingOperation => {
  if (!isBillingOperation(value)) {
    throw new Error(`Invalid billing operation: ${value}`);
  }
  return value;
};

// ==================== CONSTANTS ====================

/** Все допустимые billing операции для runtime валидации */
export const BILLING_OPERATION_VALUES = Object.values(BILLING_OPERATIONS);

/** Количество поддерживаемых операций */
export const BILLING_OPERATION_COUNT = BILLING_OPERATION_VALUES.length;
