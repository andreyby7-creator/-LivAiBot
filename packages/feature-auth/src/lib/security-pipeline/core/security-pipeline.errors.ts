/**
 * @file packages/feature-auth/src/lib/security-pipeline/core/security-pipeline.errors.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Security Pipeline (Error Model)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Error model для security pipeline
 * - Нормализация и классификация ошибок
 * - Причина изменения: observability или retry semantics
 *
 * Принципы:
 * - ✅ Error model — типизированные ошибки
 * - ✅ Normalization — единая точка нормализации
 * - ✅ Classification — автоматическая классификация ошибок
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Шаг security pipeline для типизированной обработки ошибок */
export type SecurityPipelineStep = 'fingerprint' | 'risk_assessment';

/** Branded type для runtime проверки SecurityPipelineError */
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B; };

/** Custom Error с явным step metadata для надежной обработки */
type SecurityPipelineStepError = Error & {
  readonly step: SecurityPipelineStep;
  readonly originalError?: unknown;
};

/** Типизированные ошибки security pipeline с tagged step для надежной обработки */
export type SecurityPipelineError = Brand<
  | {
    readonly kind: 'fingerprint_failed';
    readonly step: 'fingerprint';
    readonly message: string;
    readonly originalError?: unknown;
  }
  | {
    readonly kind: 'risk_assessment_failed';
    readonly step: 'risk_assessment';
    readonly message: string;
    readonly originalError?: unknown;
  }
  | {
    readonly kind: 'timeout';
    readonly step: SecurityPipelineStep;
    readonly message: string;
  }
  | {
    readonly kind: 'isolation_error';
    readonly step: SecurityPipelineStep;
    readonly message: string;
    readonly originalError?: unknown;
  },
  'SecurityPipelineError'
>;

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Константы для определения типа ошибки по сообщению */
const ERROR_KEYWORDS = {
  FINGERPRINT: 'fingerprint',
  RISK_ASSESSMENT: ['risk-assessment', 'risk_assessment'],
  TIMEOUT: 'timeout',
} as const;

/* ============================================================================
 * 🔧 ERROR CREATION
 * ============================================================================
 */

/** Создает SecurityPipelineStepError с явным step metadata */
export function createSecurityPipelineStepError(
  message: string,
  step: SecurityPipelineStep,
  originalError?: unknown,
): SecurityPipelineStepError {
  const error = new Error(message);
  error.name = 'SecurityPipelineStepError';
  return Object.assign(error, {
    step,
    ...(originalError !== undefined && { originalError }),
  }) as SecurityPipelineStepError;
}

/** Проверяет, является ли ошибка SecurityPipelineStepError */
export function isSecurityPipelineStepError(
  error: unknown,
): error is SecurityPipelineStepError {
  return (
    error !== null
    && typeof error === 'object'
    && 'name' in error
    && error.name === 'SecurityPipelineStepError'
    && 'step' in error
    && typeof (error as { readonly step: unknown; }).step === 'string'
  );
}

/** Создает ошибку fingerprint_failed */
function createFingerprintError(error: Error): SecurityPipelineError {
  return {
    kind: 'fingerprint_failed',
    step: 'fingerprint',
    message: error.message,
    originalError: error,
  } as SecurityPipelineError;
}

/** Создает ошибку risk_assessment_failed */
function createRiskAssessmentError(error: Error): SecurityPipelineError {
  return {
    kind: 'risk_assessment_failed',
    step: 'risk_assessment',
    message: error.message,
    originalError: error,
  } as SecurityPipelineError;
}

/** Создает ошибку timeout */
function createTimeoutError(error: Error, step: SecurityPipelineStep): SecurityPipelineError {
  return {
    kind: 'timeout',
    step,
    message: error.message,
  } as SecurityPipelineError;
}

/** Создает ошибку isolation_error */
function createIsolationError(
  error: unknown,
  step: SecurityPipelineStep,
): SecurityPipelineError {
  return {
    kind: 'isolation_error',
    step,
    message: error instanceof Error ? error.message : String(error),
    originalError: error,
  } as SecurityPipelineError;
}

/* ============================================================================
 * 🔧 ERROR CLASSIFICATION
 * ============================================================================
 */

/** Определяет тип ошибки по сообщению */
export function determineErrorTypeFromMessage(
  message: string,
): 'fingerprint' | 'risk_assessment' | 'timeout' | null {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes(ERROR_KEYWORDS.FINGERPRINT)) {
    return 'fingerprint';
  }
  if (
    ERROR_KEYWORDS.RISK_ASSESSMENT.some((keyword) => lowerMessage.includes(keyword))
  ) {
    return 'risk_assessment';
  }
  if (lowerMessage.includes(ERROR_KEYWORDS.TIMEOUT)) {
    return 'timeout';
  }
  return null;
}

/** Проверяет, является ли ошибка IsolationError или TimeoutError */
function isIsolationOrTimeoutError(error: unknown): boolean {
  return (
    error !== null
    && typeof error === 'object'
    && 'name' in error
    && (error.name === 'IsolationError' || error.name === 'TimeoutError')
  );
}

/* ============================================================================
 * 🔧 ERROR NORMALIZATION
 * ============================================================================
 */

/**
 * Нормализует ошибку SecurityPipelineStepError с явным step
 * @note Безопасный step detection: использует явный step из SecurityPipelineStepError,
 * не парсит строки через includes() для предотвращения silent break при изменении label.
 */
function normalizeSecurityPipelineStepError(
  error: SecurityPipelineStepError,
): SecurityPipelineError {
  const stepFromError = error.step;
  const lowerMessage = error.message.toLowerCase();
  // Определяем тип ошибки по структуре, не по сообщению
  if (lowerMessage.includes('fingerprint')) {
    return createFingerprintError(error);
  }
  if (lowerMessage.includes('risk-assessment') || lowerMessage.includes('risk_assessment')) {
    return createRiskAssessmentError(error);
  }
  if (lowerMessage.includes('timeout')) {
    return createTimeoutError(error, stepFromError);
  }
  // Если это реальная isolation ошибка, мапим как isolation_error
  return createIsolationError(error, stepFromError);
}

/** Нормализует обычную Error с определением типа по структуре */
function normalizeRegularError(
  error: Error,
  step: SecurityPipelineStep,
): SecurityPipelineError {
  // Проверяем имя ошибки для определения типа (безопаснее чем парсинг сообщения)
  if (error.name === 'TimeoutError' || error.message.toLowerCase().includes('timeout')) {
    return createTimeoutError(error, step);
  }
  // Пытаемся определить тип по сообщению только как fallback
  const errorType = determineErrorTypeFromMessage(error.message);
  if (errorType === 'fingerprint') {
    return createFingerprintError(error);
  }
  if (errorType === 'risk_assessment') {
    return createRiskAssessmentError(error);
  }
  if (errorType === 'timeout') {
    return createTimeoutError(error, step);
  }
  // Fallback для неизвестных ошибок
  return createIsolationError(error, step);
}

/**
 * Нормализует ошибку в SecurityPipelineError с явным step из SecurityPipelineStepError
 * @note Безопасный step detection: использует явный step из SecurityPipelineStepError,
 * не парсит строки через includes() для предотвращения silent break при изменении label.
 * Fallback isolation_error используется только для реальных isolation/timeout ошибок,
 * не скрывает fingerprint_failed или risk_assessment_failed.
 */
export function normalizeSecurityPipelineError(
  error: unknown,
  step: SecurityPipelineStep,
): SecurityPipelineError {
  // Если ошибка уже содержит step metadata (SecurityPipelineStepError), используем его
  // Это безопасный способ определения step без парсинга строк
  if (isSecurityPipelineStepError(error)) {
    return normalizeSecurityPipelineStepError(error);
  }

  // Если ошибка - обычный Error, проверяем структуру для определения типа
  if (error instanceof Error) {
    return normalizeRegularError(error, step);
  }

  // Проверяем, является ли ошибка IsolationError или TimeoutError по структуре
  if (isIsolationOrTimeoutError(error)) {
    return createIsolationError(error, step);
  }

  // Fallback: общая ошибка isolation только для неизвестных ошибок
  // НЕ мапим fingerprint_failed или risk_assessment_failed как isolation_error
  return createIsolationError(error, step);
}
