/**
 * @file CurrencyCode.ts - Доменные коды валют billing service
 *
 * Брендированные типы для безопасной работы с валютами.
 * Защищает от случайных строковых значений в runtime.
 */

import type { Branded } from 'effect/Brand';

// ==================== БРЕНДИРОВАННЫЕ ТИПЫ ====================

/** Брендированный тип для кодов валют */
export type CurrencyCode = Branded<string, 'CurrencyCode'>;

/** Поддерживаемые валюты billing service */
export const SUPPORTED_CURRENCY_CODES = {
  BYN: 'BYN' as CurrencyCode, // Белорусский рубль
  USD: 'USD' as CurrencyCode, // Доллар США
  EUR: 'EUR' as CurrencyCode, // Евро
  RUB: 'RUB' as CurrencyCode, // Российский рубль
} as const;

/** Type guard для проверки кодов валют */
export const isCurrencyCode = (value: string): value is CurrencyCode =>
  Object.values(SUPPORTED_CURRENCY_CODES).includes(value as CurrencyCode);

/** Безопасное создание CurrencyCode */
export const makeCurrencyCode = (value: string): CurrencyCode => {
  if (!isCurrencyCode(value)) {
    throw new Error(`Invalid currency code: ${value}`);
  }
  return value;
};

// ==================== CONSTANTS ====================

/** Все допустимые коды валют */
export const CURRENCY_CODE_VALUES = Object.values(SUPPORTED_CURRENCY_CODES);

/** Количество поддерживаемых валют */
export const CURRENCY_CODE_COUNT = CURRENCY_CODE_VALUES.length;
