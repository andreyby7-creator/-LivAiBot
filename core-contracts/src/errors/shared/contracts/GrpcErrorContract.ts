/**
 * @file GrpcErrorContract.ts - Контракт для gRPC ошибок в shared слое
 *
 * Определяет стандартизированный формат gRPC ошибок для упрощения миграции
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
 * Тип контракта для gRPC ошибок. Гарантирует консистентность структуры
 * gRPC ответов с ошибками между всеми компонентами shared слоя.
 */
export type GrpcErrorContract = {
  /** gRPC статус код ошибки (из grpc-status header) */
  readonly code: number;

  /** gRPC статус сообщение (из grpc-message header) */
  readonly message: string;

  /** Дополнительные метаданные gRPC ошибки */
  readonly metadata: {
    /** Код ошибки из shared namespace */
    readonly errorCode: SharedErrorCodeString;
    /** Дополнительные детали ошибки */
    readonly details?: ErrorDetails;
    /** Correlation ID для трассировки */
    readonly correlationId?: string;
    /** Временная метка ошибки */
    readonly timestamp: string;
  };
};

/**
 * Тип для дискриминации контрактов ошибок. Используется для type-safe
 * обработки разных типов контрактов в shared компонентах.
 */
export type GrpcErrorContractType = 'GRPC_ERROR';

/**
 * Стандартные gRPC статус коды. Используются для консистентного
 * маппинга бизнес-ошибок на gRPC статусы.
 */
export const GRPC_STATUS_CODES = {
  /** OK - успешная операция */
  OK: 0,
  /** CANCELLED - операция была отменена */
  CANCELLED: 1,
  /** UNKNOWN - неизвестная ошибка */
  UNKNOWN: 2,
  /** INVALID_ARGUMENT - некорректные аргументы */
  INVALID_ARGUMENT: 3,
  /** DEADLINE_EXCEEDED - превышен deadline */
  DEADLINE_EXCEEDED: 4,
  /** NOT_FOUND - ресурс не найден */
  NOT_FOUND: 5,
  /** ALREADY_EXISTS - ресурс уже существует */
  ALREADY_EXISTS: 6,
  /** PERMISSION_DENIED - недостаточно прав */
  PERMISSION_DENIED: 7,
  /** RESOURCE_EXHAUSTED - исчерпаны ресурсы */
  RESOURCE_EXHAUSTED: 8,
  /** FAILED_PRECONDITION - нарушен precondition */
  FAILED_PRECONDITION: 9,
  /** ABORTED - операция прервана */
  ABORTED: 10,
  /** OUT_OF_RANGE - значение вне диапазона */
  OUT_OF_RANGE: 11,
  /** UNIMPLEMENTED - метод не реализован */
  UNIMPLEMENTED: 12,
  /** INTERNAL - внутренняя ошибка сервера */
  INTERNAL: 13,
  /** UNAVAILABLE - сервис недоступен */
  UNAVAILABLE: 14,
  /** DATA_LOSS - потеря данных */
  DATA_LOSS: 15,
  /** UNAUTHENTICATED - не аутентифицирован */
  UNAUTHENTICATED: 16,
} as const;

/**
 * Проверяет, является ли код валидным gRPC статус кодом.
 * Используется для валидации в фабриках и type guards.
 */
function isValidGrpcCode(
  code: number,
): code is (typeof GRPC_STATUS_CODES)[keyof typeof GRPC_STATUS_CODES] {
  const validCodes = Object.values(GRPC_STATUS_CODES) as readonly number[];
  return Number.isInteger(code) && validCodes.includes(code);
}

/**
 * Фабрика для создания GrpcErrorContract. Гарантирует консистентность
 * структуры и валидность данных при создании контракта.
 * Возвращает Either для явной обработки ошибок валидации.
 */
export function createGrpcErrorContract(
  grpcCode: number,
  errorCode: string,
  message: string,
  details?: ErrorDetails,
  correlationId?: string,
): Either<ContractValidationError, GrpcErrorContract> {
  // Валидация входных параметров
  if (!isValidGrpcCode(grpcCode)) {
    return failure({
      type: 'CONTRACT_VALIDATION_ERROR',
      message: 'Invalid gRPC status code',
      field: 'grpcCode',
      value: grpcCode,
    });
  }

  if (typeof errorCode !== 'string' || !errorCode.startsWith('SHARED_')) {
    return failure({
      type: 'CONTRACT_VALIDATION_ERROR',
      message: 'Invalid error code format',
      field: 'errorCode',
      value: errorCode,
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

  const contract: GrpcErrorContract = {
    code: grpcCode,
    message: message.trim(),
    metadata: {
      errorCode: errorCode as SharedErrorCodeString,
      timestamp: new Date().toISOString(),
      ...(details !== undefined ? { details } : {}),
      ...(correlationId !== undefined ? { correlationId } : {}),
    },
  };

  return success<ContractValidationError, GrpcErrorContract>(contract);
}

/**
 * Type guard для проверки, является ли объект GrpcErrorContract.
 * Используется для безопасной типизации в runtime.
 */
export function isGrpcErrorContract(obj: unknown): obj is GrpcErrorContract {
  const candidate = obj as Record<string, unknown>;

  // Проверка основных полей с валидацией gRPC кода и непустоты строк
  if (
    typeof obj !== 'object'
    || obj === null
    || typeof candidate['code'] !== 'number'
    || !Number.isInteger(candidate['code'])
    || !isValidGrpcCode(candidate['code'])
    || typeof candidate['message'] !== 'string'
    || candidate['message'].trim().length === 0
  ) return false;

  // Проверка метаданных
  const metadata = candidate['metadata'];
  if (
    typeof metadata !== 'object'
    || metadata === null
  ) return false;

  const metadataRecord = metadata as Record<string, unknown>;
  return (
    typeof metadataRecord['errorCode'] === 'string'
    && metadataRecord['errorCode'].startsWith('SHARED_')
    && typeof metadataRecord['timestamp'] === 'string'
    && metadataRecord['timestamp'].trim().length > 0
  );
}

/**
 * Утилита для извлечения кода ошибки из GrpcErrorContract.
 * Упрощает работу с контрактами в shared компонентах.
 */
export function getGrpcErrorCode(contract: GrpcErrorContract): SharedErrorCodeString {
  return contract.metadata.errorCode;
}

/**
 * Утилита для извлечения correlation ID из GrpcErrorContract.
 * Возвращает undefined если correlation ID отсутствует.
 */
export function getGrpcCorrelationId(contract: GrpcErrorContract): string | undefined {
  return contract.metadata.correlationId;
}

/**
 * Утилита для извлечения деталей ошибки из GrpcErrorContract.
 * Возвращает undefined если детали отсутствуют.
 */
export function getGrpcErrorDetails(contract: GrpcErrorContract): unknown {
  return contract.metadata.details;
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
