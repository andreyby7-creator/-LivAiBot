/**
 * @file PaymentValidationError.ts - Доменные ошибки валидации платежей LivAiBot
 *
 * Бизнес-ошибки валидации платежа (до любых SDK/API).
 * PCI-safe: без PAN, CVV, expiry. Только бизнес-правила.
 *
 * Фокус: Беларусь + Россия (2025), с планом расширения на Казахстан, Польшу, Европу.
 *
 * Возможности:
 * - Бизнес-валидация (лимит сумм по валютам, поддерживаемые валюты/методы оплаты)
 * - Currency-specific лимиты (BYN/RUB/USD/EUR с разными пределами)
 * - Гибкая типизация валют: SupportedCurrency | string (поддерживаемые + любые другие)
 * - Фиксированные единицы: amount всегда в минимальных единицах (cents/kopeks)
 * - Структурированные правила: rule в формате "entity.constraint.context" для аналитики
 * - Адаптивный severity: CRITICAL для PCI нарушений, HIGH для остальных ошибок
 * - Трассировка (transactionId, userId, sessionId)
 * - PCI комплаенс (без чувствительных данных платежей)
 * - Расширяемая архитектура (union типы, опциональные поля)
 * - Локальные платежные провайдеры РБ/РФ (WebPay, bePaid, Оплати, Assist)
 *
 * План расширения:
 * - Казахстан: +KZT, локальные провайдеры
 * - Польша: +PLN, европейские платежи
 * - Европа: PSD2/GDPR комплаенс, SEPA
 *
 * Будущие улучшения:
 * - Региональный комплаенс (PSD2, GDPR, локальные регуляции)
 * - Динамический движок правил валидации (PaymentValidationRule union)
 * - Поддержка мульти-валютных конвертаций
 * - Интеграция с audit trail
 */

import { SERVICE_ERROR_CODES } from '../../../base/ErrorCode.js';
import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../../../base/ErrorConstants.js';

import type { TaggedError } from '../../../base/BaseErrorTypes.js';
import type { ErrorCode } from '../../../base/ErrorCode.js';

// ==================== CONSTANTS ====================

/** Допустимые значения PaymentValidationReason */
export const VALID_PAYMENT_VALIDATION_REASONS = [
  'invalid-amount',
  'unsupported-currency',
  'invalid-payment-method',
  'pci-violation',
  'amount-precision-error',
  'currency-mismatch',
] as const;

/** Type guard для PaymentValidationReason union */
function isPaymentValidationReason(value: unknown): value is PaymentValidationReason {
  return VALID_PAYMENT_VALIDATION_REASONS.includes(value as PaymentValidationReason);
}

/** Получает лимит для поддерживаемой валюты */
export function getCurrencyLimit(
  limits: Record<SupportedCurrency, number>,
  currency: SupportedCurrency,
): number {
  switch (currency) {
    case 'BYN':
      return limits.BYN;
    case 'RUB':
      return limits.RUB;
    case 'USD':
      return limits.USD;
    case 'EUR':
      return limits.EUR;
    default: {
      const exhaustiveCheck: never = currency;
      return exhaustiveCheck;
    }
  }
}

/** Тип контекста для payment validation */
const PAYMENT_VALIDATION_CONTEXT_TYPE = 'payment_validation' as const;

/** Поддерживаемые валюты (ISO 4217) - фокус на РБ/РФ рынки */
export const SUPPORTED_CURRENCIES = [
  'BYN', // Белорусский рубль (основная валюта РБ)
  'RUB', // Российский рубль (для РФ интеграции)
  'USD', // Доллары США (международные платежи)
  'EUR', // Евро (международные платежи)
] as const;

/** Поддерживаемые методы оплаты (без sensitive данных) - фокус на РБ/РФ рынки */
export const SUPPORTED_PAYMENT_METHODS = [
  // Международные методы
  'credit_card',
  'debit_card',
  'paypal',

  // Локальные белорусские провайдеры (из RB-Payments-Overview.md)
  'webpay', // WebPay - основной белорусский агрегатор
  'bepaid', // bePaid - гибкий агрегатор
  'assist', // Assist/BelAssist
  'oplati', // Оплати - QR платежи

  // Общие методы
  'qr_code', // QR платежи (Оплати, СБП в РФ)
  'online_banking', // Интернет-банкинг
  'bank_transfer', // Банковские переводы
] as const;

/** Минимальные суммы платежей по валютам (в минимальных единицах: cents/kopeks) */
const MINIMUM_PAYMENT_AMOUNTS = {
  BYN: 1, // 1 kop = 0.01 BYN (минимальная копейка)
  RUB: 100, // 100 kop = 1.00 RUB (минимальный рубль)
  USD: 1, // 1 cent = 0.01 USD
  EUR: 1, // 1 cent = 0.01 EUR
} as const;

/** Максимальные суммы платежей по валютам (в минимальных единицах: cents/kopeks) */
const MAXIMUM_PAYMENT_AMOUNTS = {
  BYN: 5_000_000, // 50,000 BYN = 50k BYN (лимиты белорусских платежей)
  RUB: 50_000_000, // 500,000 RUB = 500k RUB (лимиты российских платежей)
  USD: 1_000_000, // 10,000 USD = 10k USD (международные лимиты)
  EUR: 1_000_000, // 10,000 EUR = 10k EUR (международные лимиты)
} as const;

/** Количество минимальных единиц в основных (cents в долларе, kopeks в рубле) */
const UNITS_PER_MAJOR = 100;

/** Количество десятичных знаков для отображения сумм */
const DECIMAL_PLACES_DISPLAY = 2;

// ==================== PAYMENT VALIDATION TYPES ====================

/** Рекомендуемый формат правил валидации для аналитики и агрегатов
 * @example
 * "amount.min.BYN"     // сумма ниже минимума для BYN
 * "amount.max.RUB"     // сумма выше максимума для RUB
 * "currency.unsupported" // неподдерживаемая валюта
 * "method.unsupported"   // неподдерживаемый метод оплаты
 * "pci.unsafe"         // PCI нарушение
 *
 * rule: entity.constraint.context (e.g. amount.min.BYN)
 */

/** Правила валидации платежа - структурированные сообщения */
export type PaymentValidationRule =
  | `amount.min.${SupportedCurrency}`
  | `amount.max.${SupportedCurrency}`
  | 'currency.unsupported'
  | 'method.unsupported'
  | 'pci.unsafe';

/** Причины валидации платежа - бизнес-специфичные */
export type PaymentValidationReason =
  | 'invalid-amount' // Сумма <= 0 или > лимита (umbrella reason: min/max/precision)
  | 'unsupported-currency' // Валюта не поддерживается
  | 'invalid-payment-method' // Метод оплаты не разрешен
  | 'pci-violation' // Нарушение PCI compliance
  | 'amount-precision-error' // Неправильная точность суммы
  | 'currency-mismatch'; // Несоответствие валюты тарифу

/** ISO 4217 код валюты для multi-currency support */
export type ISO4217CurrencyCode = string;

/** Поддерживаемые валюты */
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

/** Поддерживаемые методы оплаты */
export type SupportedPaymentMethod = typeof SUPPORTED_PAYMENT_METHODS[number];

/** Минимальные суммы платежей по валютам */
export const PAYMENT_MINIMUM_AMOUNTS = MINIMUM_PAYMENT_AMOUNTS;

/** Максимальные суммы платежей по валютам */
export const PAYMENT_MAXIMUM_AMOUNTS = MAXIMUM_PAYMENT_AMOUNTS;

/** Контекст ошибки валидации платежа */
export type PaymentValidationErrorContext = {
  readonly type: typeof PAYMENT_VALIDATION_CONTEXT_TYPE;
  readonly reason: PaymentValidationReason;
  readonly rule: PaymentValidationRule;
  /** Сумма платежа в минимальных единицах валюты (cents/kopeks)
   * @example 100 = 1.00 USD/EUR, 100 = 1.00 BYN, 10000 = 100.00 RUB */
  readonly amount?: number;
  readonly currency?: ISO4217CurrencyCode; // Валюта (ISO 4217)
  readonly paymentMethod?: SupportedPaymentMethod; // Канал оплаты (без деталей)
  readonly planId?: string; // ID тарифного плана
  readonly transactionId?: string; // ID транзакции для traceability
  readonly userId?: string; // ID пользователя для audit
  readonly sessionId?: string; // ID сессии для security tracking
  readonly suggestions?: readonly string[]; // Предложения по исправлению
};

/** TaggedError для ошибок валидации платежей */
export type PaymentValidationError = TaggedError<{
  readonly category: typeof ERROR_CATEGORY.BUSINESS;
  readonly origin: typeof ERROR_ORIGIN.DOMAIN;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details: PaymentValidationErrorContext;
}, 'PaymentValidationError'>;

/** Получает severity ошибки валидации платежа */
export const getPaymentValidationErrorSeverity = (
  error: PaymentValidationError,
): typeof ERROR_SEVERITY.HIGH | typeof ERROR_SEVERITY.CRITICAL =>
  getPaymentValidationSeverity(error.details.reason);

/** Определяет severity ошибки на основе причины валидации */
function getPaymentValidationSeverity(
  reason: PaymentValidationReason,
): typeof ERROR_SEVERITY.HIGH | typeof ERROR_SEVERITY.CRITICAL {
  // PCI нарушения - критический уровень
  if (reason === 'pci-violation') {
    return ERROR_SEVERITY.CRITICAL;
  }
  // Все остальные payment validation ошибки - высокий уровень
  return ERROR_SEVERITY.HIGH;
}

/** Создает PaymentValidationError */
export function createPaymentValidationError(
  reason: PaymentValidationReason,
  rule: PaymentValidationRule,
  message: string,
  context?: Omit<PaymentValidationErrorContext, 'type' | 'reason' | 'rule'>,
): PaymentValidationError {
  return {
    _tag: 'PaymentValidationError',
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
    code: SERVICE_ERROR_CODES.SERVICE_BILLING_PAYMENT_VALIDATION_FAILED,
    message,
    details: {
      type: PAYMENT_VALIDATION_CONTEXT_TYPE,
      reason,
      rule,
      ...context,
    },
  } as PaymentValidationError;
}

// ==================== TYPE GUARDS & HELPERS ====================

/** Проверяет PaymentValidationErrorContext - структурная валидация типов */
export function isValidPaymentValidationErrorContext(
  context: unknown,
): context is PaymentValidationErrorContext {
  if (context == null || typeof context !== 'object') return false;

  const ctx = context as Record<string, unknown>;

  // Обязательные поля
  if (ctx['type'] !== PAYMENT_VALIDATION_CONTEXT_TYPE) return false;
  if (typeof ctx['reason'] !== 'string') return false;
  if (typeof ctx['rule'] !== 'string') return false;

  // Проверяем что reason допустимый (type guard для union)
  const reason = ctx['reason'];
  if (!isPaymentValidationReason(reason)) return false;

  // Опциональные поля - только структурная валидация типов
  if (ctx['amount'] !== undefined) {
    if (typeof ctx['amount'] !== 'number') return false;
  }

  if (ctx['currency'] !== undefined) {
    if (typeof ctx['currency'] !== 'string') return false;
    // Currency validation: может быть поддерживаемой или любой другой строкой
    // Для поддерживаемых валют будут применяться специфические лимиты
    // Для неподдерживаемых - fallback лимиты
  }

  if (ctx['paymentMethod'] !== undefined) {
    if (typeof ctx['paymentMethod'] !== 'string') return false;
  }

  // Остальные опциональные поля
  if (ctx['planId'] !== undefined && typeof ctx['planId'] !== 'string') return false;
  if (ctx['transactionId'] !== undefined && typeof ctx['transactionId'] !== 'string') return false;
  if (ctx['userId'] !== undefined && typeof ctx['userId'] !== 'string') return false;
  if (ctx['sessionId'] !== undefined && typeof ctx['sessionId'] !== 'string') return false;

  if (ctx['suggestions'] !== undefined) {
    if (!Array.isArray(ctx['suggestions'])) return false;
    if (!ctx['suggestions'].every((s: unknown) => typeof s === 'string')) return false;
    // Business validation: не пустые строки
    if (ctx['suggestions'].some((s: unknown) => typeof s === 'string' && s.trim().length === 0)) {
      return false;
    }
  }

  return true;
}

/** Проверяет является ли ошибка PaymentValidationError */
export function isPaymentValidationError(
  error: unknown,
): error is PaymentValidationError {
  return (
    typeof error === 'object'
    && error !== null
    && '_tag' in error
    && (error as { _tag: string; })._tag === 'PaymentValidationError'
  );
}

/** Получает причину валидации */
export function getPaymentValidationReason(
  error: PaymentValidationError,
): PaymentValidationReason {
  return error.details.reason;
}

/** Получает правило валидации */
export function getPaymentValidationRule(
  error: PaymentValidationError,
): string {
  return error.details.rule;
}

/** Получает сумму платежа (если указана) */
export function getPaymentAmount(
  error: PaymentValidationError,
): number | undefined {
  return error.details.amount;
}

/** Получает валюту платежа (если указана) */
export function getPaymentCurrency(
  error: PaymentValidationError,
): string | undefined {
  return error.details.currency;
}

/** Получает предложения по исправлению */
export function getPaymentValidationSuggestions(
  error: PaymentValidationError,
): readonly string[] | undefined {
  return error.details.suggestions;
}

/** Получает ID транзакции для traceability */
export function getPaymentTransactionId(
  error: PaymentValidationError,
): string | undefined {
  return error.details.transactionId;
}

/** Получает ID пользователя для audit */
export function getPaymentUserId(
  error: PaymentValidationError,
): string | undefined {
  return error.details.userId;
}

/** Получает ID сессии для security tracking */
export function getPaymentSessionId(
  error: PaymentValidationError,
): string | undefined {
  return error.details.sessionId;
}

/** Проверяет поддерживается ли валюта */
export function isCurrencySupported(currency: string): currency is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency);
}

/** Определяет тип валюты: поддерживаемая или неподдерживаемая */
export function getCurrencyType(currency: string): 'supported' | 'unsupported' {
  return isCurrencySupported(currency) ? 'supported' : 'unsupported';
}

/** Проверяет поддерживается ли метод оплаты */
export function isPaymentMethodSupported(method: string): method is SupportedPaymentMethod {
  return SUPPORTED_PAYMENT_METHODS.includes(method as SupportedPaymentMethod);
}

/** Проверяет валидна ли сумма платежа с учетом валюты */
export function isPaymentAmountValid(
  amount: number,
  currency: SupportedCurrency,
): boolean {
  // Currency-specific лимиты
  const minLimit = getCurrencyLimit(MINIMUM_PAYMENT_AMOUNTS, currency);
  const maxLimit = getCurrencyLimit(MAXIMUM_PAYMENT_AMOUNTS, currency);

  return amount >= minLimit && amount <= maxLimit;
}

/** Конвертирует сумму из основных единиц в минимальные (cents/kopeks) */
export function convertToMinorUnits(amount: number /* major units */): number {
  // Все валюты работают с 2 десятичными знаками
  // Для будущих валют с другой точностью можно добавить параметр currency

  const minorAmount = amount * UNITS_PER_MAJOR;

  // Проверяем точность - результат должен быть целым числом
  if (minorAmount % 1 !== 0) {
    throw new Error(`Invalid amount precision: ${amount} results in ${minorAmount} minor units`);
  }

  return minorAmount;
}

/** Конвертирует сумму из минимальных единиц в основные */
export function convertToMajorUnits(minorAmount: number): number {
  // Все валюты работают с 2 десятичными знаками
  // Для будущих валют с другой точностью можно добавить параметр currency
  return minorAmount / UNITS_PER_MAJOR; // amount = cents/kopeks / UNITS_PER_MAJOR
}

/** Форматирует сумму для отображения с правильной валютой */
export function formatPaymentAmount(minorAmount: number, currency: SupportedCurrency): string {
  const majorAmount = convertToMajorUnits(minorAmount);
  return `${majorAmount.toFixed(DECIMAL_PLACES_DISPLAY)} ${currency}`;
}
