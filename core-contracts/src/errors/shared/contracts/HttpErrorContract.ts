/**
 * @file HttpErrorContract.ts - Контракт для HTTP ошибок в shared слое
 *
 * Определяет стандартизированный формат HTTP ошибок для упрощения миграции
 * к services/contracts layer и устранения implicit agreements между компонентами.
 */

import type { Either } from 'effect/Either';
import { left, right } from 'effect/Either';

/**
 * Создает Either с failure результатом (ошибкой валидации).
 * Использует корректную типизацию Effect Either с unknown cast.
 */
function failure<A>(err: ContractValidationError): Either<ContractValidationError, A> {
  return left(err) as unknown as Either<ContractValidationError, A>;
}

/**
 * Создает Either с success результатом, правильно типизированный.
 * Использует корректную типизацию Effect Either с unknown cast.
 */
function success<E, A>(value: A): Either<E, A> {
  return right(value) as unknown as Either<E, A>;
}

import type { SharedErrorCodeString } from '../SharedErrorTypes.js';

/**
 * Стандартизированная структура деталей ошибки.
 * Предоставляет типобезопасный способ передачи дополнительной информации об ошибке.
 */
export type ErrorDetails = {
  /** Контекст выполнения ошибки */
  readonly context?: Record<string, unknown>;

  /** Дополнительные данные для debugging */
  readonly debug?: Record<string, unknown>;

  /** Stack trace если доступен */
  readonly stack?: string;

  /** Код операции где произошла ошибка */
  readonly operation?: string;

  /** ID запроса/транзакции для трассировки */
  readonly requestId?: string;

  /** Timestamp ошибки */
  readonly timestamp?: string;

  /** Произвольные дополнительные данные */
  readonly [key: string]: unknown;
};

/**
 * Тип ошибки валидации для фабрик контрактов.
 * Используется в Either.left для явного возврата ошибок валидации.
 */
export type ContractValidationError = {
  readonly type: 'CONTRACT_VALIDATION_ERROR';
  readonly message: string;
  readonly field?: string;
  readonly value?: unknown;
};

/**
 * Тип контракта для HTTP ошибок. Гарантирует консистентность структуры
 * HTTP ответов с ошибками между всеми компонентами shared слоя.
 */
export type HttpErrorContract = {
  /** HTTP статус код ошибки */
  readonly statusCode: number;

  /** HTTP заголовки ответа */
  readonly headers: Record<string, string>;

  /** Тело ответа с деталями ошибки */
  readonly body: {
    /** Стандартизированная структура ошибки */
    readonly error: {
      /** Код ошибки из shared namespace */
      readonly code: SharedErrorCodeString;
      /** Человекочитаемое сообщение об ошибке */
      readonly message: string;
      /** Дополнительные детали ошибки (опционально) */
      readonly details?: ErrorDetails;
    };
  };
};

/**
 * Тип для дискриминации контрактов ошибок. Используется для type-safe
 * обработки разных типов контрактов в shared компонентах.
 */
export type HttpErrorContractType = 'HTTP_ERROR';

/**
 * Фабрика для создания HttpErrorContract. Гарантирует консистентность
 * структуры и валидность данных при создании контракта.
 * Возвращает Either для явной обработки ошибок валидации.
 */
export function createHttpErrorContract(
  statusCode: number,
  code: string,
  message: string,
  details?: ErrorDetails,
  headers: Record<string, string> = {},
): Either<ContractValidationError, HttpErrorContract> {
  // Валидация входных параметров
  const HTTP_CLIENT_ERROR_MIN = 400;
  const HTTP_SERVER_ERROR_MAX = 599;

  if (
    !Number.isInteger(statusCode)
    || statusCode < HTTP_CLIENT_ERROR_MIN
    || statusCode > HTTP_SERVER_ERROR_MAX
  ) {
    return failure({
      type: 'CONTRACT_VALIDATION_ERROR',
      message: 'Invalid HTTP status code',
      field: 'statusCode',
      value: statusCode,
    });
  }

  if (typeof code !== 'string' || !code.startsWith('SHARED_')) {
    return failure({
      type: 'CONTRACT_VALIDATION_ERROR',
      message: 'Invalid error code format',
      field: 'code',
      value: code,
    });
  }

  if (typeof message !== 'string' || message.trim().length === 0) {
    return failure({
      type: 'CONTRACT_VALIDATION_ERROR',
      message: 'Message cannot be empty',
      field: 'message',
      value: message,
    });
  }

  const contract: HttpErrorContract = {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: {
      error: {
        code: code as SharedErrorCodeString,
        message: message.trim(),
        ...(details !== undefined ? { details } : {}),
      },
    },
  };

  return success<ContractValidationError, HttpErrorContract>(contract);
}

/**
 * Type guard для проверки, является ли объект HttpErrorContract.
 * Используется для безопасной типизации в runtime.
 */
export function isHttpErrorContract(obj: unknown): obj is HttpErrorContract {
  const candidate = obj as Record<string, unknown>;

  // HTTP error code range constants
  const HTTP_CLIENT_ERROR_MIN = 400;
  const HTTP_SERVER_ERROR_MAX = 599;

  // Проверка основных полей с валидацией HTTP кодов
  if (
    typeof obj !== 'object'
    || obj === null
    || typeof candidate['statusCode'] !== 'number'
    || !Number.isInteger(candidate['statusCode'])
    || candidate['statusCode'] < HTTP_CLIENT_ERROR_MIN
    || candidate['statusCode'] > HTTP_SERVER_ERROR_MAX
  ) return false;

  // Проверка headers (объект с строковыми значениями)
  const headers = candidate['headers'];
  if (
    typeof headers !== 'object'
    || headers === null
  ) return false;

  // Проверяем что все значения в headers являются строками
  const headersRecord = headers as Record<string, unknown>;
  for (const value of Object.values(headersRecord)) {
    if (typeof value !== 'string') return false;
  }

  // Проверка body и error структуры
  const body = candidate['body'];
  if (
    typeof body !== 'object'
    || body === null
  ) return false;

  const bodyRecord = body as Record<string, unknown>;
  const error = bodyRecord['error'];
  if (
    typeof error !== 'object'
    || error === null
  ) return false;

  const errorRecord = error as Record<string, unknown>;
  return (
    typeof errorRecord['code'] === 'string'
    && errorRecord['code'].startsWith('SHARED_')
    && typeof errorRecord['message'] === 'string'
    && errorRecord['message'].trim().length > 0
  );
}

/**
 * Утилита для извлечения кода ошибки из HttpErrorContract.
 * Упрощает работу с контрактами в shared компонентах.
 */
export function getHttpErrorCode(contract: HttpErrorContract): SharedErrorCodeString {
  return contract.body.error.code;
}

/**
 * Утилита для извлечения сообщения об ошибке из HttpErrorContract.
 * Упрощает работу с контрактами в shared компонентах.
 */
export function getHttpErrorMessage(contract: HttpErrorContract): string {
  return contract.body.error.message;
}

/**
 * Утилита для извлечения деталей ошибки из HttpErrorContract.
 * Возвращает undefined если детали отсутствуют.
 */
export function getHttpErrorDetails(contract: HttpErrorContract): unknown {
  return contract.body.error.details;
}

/**
 * Type guard для проверки, является ли объект ContractValidationError.
 * Используется для безопасной типизации в runtime.
 */
export function isContractValidationError(obj: unknown): obj is ContractValidationError {
  const candidate = obj as Record<string, unknown>;
  return (
    typeof obj === 'object'
    && obj !== null
    && candidate['type'] === 'CONTRACT_VALIDATION_ERROR'
    && typeof candidate['message'] === 'string'
  );
}
