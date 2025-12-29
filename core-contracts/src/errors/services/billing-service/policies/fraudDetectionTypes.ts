/**
 * @file fraudDetectionTypes.ts - Общие типы данных для fraud detection
 *
 * Содержит базовые типы данных для fraud detection, вынесенные для устранения
 * циклических зависимостей между fraudDetectionInterfaces.ts, fraudDetectionPolicy.ts и fraudDetectionProviders.ts.
 *
 * Архитектурная роль:
 * - Single source of truth для базовых типов fraud detection
 * - Предотвращает циклические импорты между policy, interfaces и providers
 * - Обеспечивает consistent type safety для всех fraud detection компонентов
 */

import type { BillingServiceError } from '../BillingServiceErrorTypes.js';
import type { RetryContext, RetryDecision } from './paymentRetryPolicy.js';

// ==================== FRAUD DECISION TYPES ====================

/**
 * Решение политики обнаружения мошенничества.
 * Discriminated union для type safety.
 */
export type FraudDecision =
  | { readonly _tag: 'Clean'; readonly score: number; readonly evaluatedRules: number; }
  | {
    readonly _tag: 'Suspicious';
    readonly score: number;
    readonly reasons: readonly FraudReason[];
    readonly evaluatedRules: number;
    readonly triggeredRules: readonly string[];
  }
  | {
    readonly _tag: 'HighRisk';
    readonly score: number;
    readonly reasons: readonly FraudReason[];
    readonly evaluatedRules: number;
    readonly triggeredRules: readonly string[];
  };

/**
 * Причины подозрения в мошенничестве.
 * Каждая причина имеет базовый score contribution.
 */
export type FraudReason =
  | 'velocity_attack' // скоординированная атака (>10 попыток/минуту)
  | 'excessive_retries' // >5 retry попыток (зависит от retry policy)
  | 'geolocation_mismatch' // геолокация не соответствует истории
  | 'device_fingerprint' // подозрительный device fingerprint
  | 'unusual_amount' // сумма отклоняется >200% от среднего
  | 'rapid_attempts' // >3 попытки за 5 минут
  | 'payment_method_mismatch'; // новый метод оплаты для пользователя

/** Уровень приоритета правила (от 1-низкий до 10-высокий) */
export type RulePriority = typeof RULE_PRIORITIES[keyof typeof RULE_PRIORITIES];

// ==================== FRAUD RULE TYPES ====================

/** Fraud rule - неизменяемое правило обнаружения мошенничества */
export type FraudRule = {
  /** Уникальный ID правила */
  readonly id: string;
  /** Человекочитаемое имя */
  readonly name: string;
  /** Функция условия (deterministic) */
  readonly condition: (context: FraudContext) => boolean;
  /** Score contribution при срабатывании */
  readonly score: number;
  /** Fraud reason для категоризации */
  readonly reason: FraudReason;
  /** Приоритет выполнения (1-10, higher = earlier evaluation) */
  readonly priority: RulePriority;
  /** Включено ли правило */
  readonly enabled: boolean;
  /** Версия правила для backward compatibility */
  readonly version: string;
  /** Описание для документации */
  readonly description: string;
};

// ==================== PAYMENT HISTORY TYPES ====================

/** Исторические данные платежей пользователя */
export type UserPaymentHistory = {
  /** ID пользователя */
  readonly userId: string;
  /** Средняя сумма платежей */
  readonly averageAmount: number;
  /** Общее количество платежей */
  readonly totalPayments: number;
  /** Недавние попытки (последние 24 часа) */
  readonly recentAttempts: PaymentAttempt[];
  /** Последний успешный платеж */
  readonly lastSuccessfulPayment?: PaymentDetails;
  /** Известные геолокации пользователя */
  readonly knownGeolocations: string[];
  /** Известные device fingerprints */
  readonly knownDeviceFingerprints: string[];
};

/** Попытка платежа для истории */
export type PaymentAttempt = {
  /** Timestamp попытки */
  readonly timestamp: number;
  /** Была ли успешной */
  readonly successful: boolean;
  /** Сумма */
  readonly amount: number;
  /** Метод оплаты */
  readonly paymentMethod: string;
  /** Геолокация */
  readonly geolocation?: string;
  /** Device fingerprint */
  readonly deviceFingerprint?: string;
};

// ==================== PAYMENT DETAILS TYPES ====================

/** Детали платежа */
export type PaymentDetails = {
  /** ID платежа */
  readonly id: string;
  /** Сумма */
  readonly amount: number;
  /** Валюта */
  readonly currency: string;
  /** Метод оплаты */
  readonly paymentMethod: string;
  /** Страна платежа */
  readonly country: string;
  /** Тип платежа (one-time, subscription, etc.) */
  readonly paymentType: string;
  /** Timestamp создания */
  readonly createdAt: number;
};

// ==================== DEVICE AND GEOLOCATION TYPES ====================

/** Device fingerprint для обнаружения мошенничества */
export type DeviceFingerprint = {
  /** User agent браузера */
  readonly userAgent?: string;
  /** IP адрес */
  readonly ipAddress: string;
  /** Device ID (если доступен) */
  readonly deviceId?: string;
  /** Browser fingerprint hash */
  readonly fingerprintHash?: string;
};

/** Геолокационные данные */
export type GeolocationData = {
  /** Страна */
  readonly country: string;
  /** Город */
  readonly city?: string;
  /** Координаты (примерно) */
  readonly coordinates?: { lat: number; lng: number; };
  /** Timezone */
  readonly timezone?: string;
  /** Confidence score (0-100) */
  readonly confidence: number;
};

// ==================== FRAUD CONTEXT TYPES ====================

/** Контекст для оценки fraud detection */
export type FraudContext = {
  /** Ошибка платежа */
  readonly paymentError: BillingServiceError;
  /** Решение retry policy */
  readonly retryDecision: RetryDecision;
  /** Контекст retry (если был retry) */
  readonly retryContext?: RetryContext;
  /** История платежей пользователя */
  readonly userHistory: UserPaymentHistory;
  /** Детали платежа */
  readonly paymentDetails: PaymentDetails;
  /** Device fingerprint */
  readonly deviceFingerprint?: DeviceFingerprint;
  /** Геолокационные данные */
  readonly geolocation?: GeolocationData;
  /** Correlation ID для tracing */
  readonly correlationId: string;
  /** Feature flags для A/B testing и gradual rollout */
  readonly flags?: Record<string, boolean>;
};

// ==================== POLICY CONFIG TYPES ====================

/** Конфигурация fraud detection policy */
export type FraudPolicyConfig = {
  /** Fraud rules registry */
  readonly rules: Record<string, FraudRule>;
  /** Пороги для решений */
  readonly thresholds: {
    /** Порог низкого риска (< этого = Clean) */
    readonly lowRisk: number;
    /** Порог высокого риска (> этого = HighRisk) */
    readonly highRisk: number;
  };
  /** Максимальный score */
  readonly maxScore: number;
  /** Включена ли политика */
  readonly enabled: boolean;
  /** Версия конфигурации для hot reload compatibility */
  readonly version: string;
  /** Настройки производительности */
  readonly performance: {
    /** Максимум правил для оценки */
    readonly maxRulesEvaluation: number;
    /** Short-circuit при достижении этого score */
    readonly shortCircuitThreshold: number;
  };
  /** Настройки external APIs */
  readonly externalApis: {
    /** Rate limit для geo lookups */
    readonly geoLookupRateLimit: number;
    /** Timeout для external calls */
    readonly externalCallTimeoutMs: number;
  };
  /** Alert thresholds для мониторинга */
  readonly alerts: {
    /** Alert при > этого процента suspicious решений */
    readonly suspiciousRateThreshold: number;
    /** Alert при > этого процента high risk решений */
    readonly highRiskRateThreshold: number;
    /** Alert при > этой latency оценки */
    readonly evaluationLatencyThresholdMs: number;
  };
};

// ==================== CONSTANTS (for RulePriority) ====================

/** Приоритеты правил fraud detection */
export const RULE_PRIORITIES = {
  /** Минимальный приоритет */
  PAYMENT_METHOD_MISMATCH: 1,
  /** Быстрые попытки */
  RAPID_ATTEMPTS: 2,
  /** Необычная сумма */
  UNUSUAL_AMOUNT: 3,
  /** Device fingerprint */
  DEVICE_FINGERPRINT: 4,
  /** Несоответствие геолокации */
  GEOLOCATION_MISMATCH: 5,
  /** Чрезмерные повторы */
  EXCESSIVE_RETRIES: 6,
  /** Атака скоординированная */
  VELOCITY_ATTACK: 10,
} as const;
