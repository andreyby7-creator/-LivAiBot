/**
 * @file security.ts - Shared security utilities for error handling
 *
 * PCI DSS compliance helpers, security field detection, sanitization utilities.
 * Used across all services for consistent security handling.
 */

/**
 * PCI-sensitive поля которые нельзя логировать в метриках, логах или других нешифрованных хранилищах.
 * Согласно PCI DSS requirements для защиты cardholder data.
 */
export const PCI_SENSITIVE_FIELDS = [
  'amount', // Суммы платежей (может раскрывать паттерны)
  'cardNumber', // Номер карты
  'cvv', // CVV код
  'cvv2', // CVV2 код
  'expiry', // Дата истечения
  'cardholderName', // Имя владельца карты
  'pin', // PIN код
  'magneticStripe', // Магнитная полоса
  'chipData', // Данные чипа
  'track1', // Track 1 данные
  'track2', // Track 2 данные
  'cavv', // Cardholder Authentication Verification Value
  'eci', // Electronic Commerce Indicator
  'xid', // Transaction Identifier
] as const;

/** Type for PCI sensitive field names */
export type PCISensitiveField = typeof PCI_SENSITIVE_FIELDS[number];

/**
 * Проверяет содержит ли объект PCI-sensitive поля (top-level проверка)
 * @param obj - объект для проверки
 * @returns массив найденных sensitive полей
 *
 * ⚠️ Не подходит для arbitrary user payloads
 * Использовать только для metrics / structured logs / known schemas
 *
 * @note Проверяет только top-level свойства, не рекурсивно
 */
export const detectPCISensitiveFields = (
  obj: Record<string, unknown>,
): readonly PCISensitiveField[] => PCI_SENSITIVE_FIELDS.filter((field) => field in obj);

/**
 * Проверяет является ли поле PCI-sensitive
 * @param fieldName - имя поля для проверки
 * @returns true если поле sensitive
 */
export const isPCISensitiveField = (fieldName: string): fieldName is PCISensitiveField =>
  (PCI_SENSITIVE_FIELDS as readonly string[]).includes(fieldName);

/**
 * Создает безопасную версию объекта без PCI-sensitive полей
 * @param obj - исходный объект
 * @returns объект без sensitive полей
 */
export const sanitizePCISensitiveData = <T extends Record<string, unknown>>(
  obj: T,
): Omit<T, PCISensitiveField> =>
  Object.fromEntries(
    Object.entries(obj).filter(([key]) => !isPCISensitiveField(key)),
  ) as Omit<T, PCISensitiveField>;
