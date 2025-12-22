/**
 * @file InternalErrorDTO.ts - DTO для внутренних ошибок в shared слое
 *
 * Определяет стандартизированный формат внутренних ошибок для упрощения миграции
 * к services/contracts layer и устранения implicit agreements между компонентами.
 * Используется для передачи ошибок между внутренними компонентами shared слоя.
 */

import { randomUUID } from 'crypto';

import type { Either } from 'effect/Either';
import { left, right } from 'effect/Either';

import type { SharedErrorCategory, SharedErrorCodeString } from '../SharedErrorTypes.js';

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
 * DTO для внутренних ошибок shared слоя. Гарантирует консистентность структуры
 * ошибок при передаче между компонентами shared слоя (adapters, policies, etc.).
 */
export type InternalErrorDTO = {
  /** Уникальный идентификатор ошибки для трассировки */
  readonly id: string;

  /** Код ошибки из shared namespace */
  readonly code: SharedErrorCodeString;

  /** Категория ошибки (domain, infrastructure, policy, adapter) */
  readonly category: SharedErrorCategory;

  /** Человекочитаемое сообщение об ошибке */
  readonly message: string;

  /** Детали ошибки для debugging (опционально) */
  readonly details?: ErrorDetails;

  /** Метаданные ошибки */
  readonly metadata: {
    /** Временная метка создания ошибки */
    readonly timestamp: string;
    /** Correlation ID для distributed tracing */
    readonly correlationId?: string;
    /** ID компонента, где произошла ошибка */
    readonly componentId: string;
    /** Версия компонента */
    readonly componentVersion: string;
    /** Контекст выполнения (development, staging, production) */
    readonly environment: string;
  };

  /** Цепочка причин ошибки (опционально) */
  readonly cause?: InternalErrorDTO;
};

/**
 * Тип для дискриминации DTO ошибок. Используется для type-safe
 * обработки разных типов DTO в shared компонентах.
 */
export type InternalErrorDTOType = 'INTERNAL_ERROR';

/**
 * Контекст выполнения для метаданных ошибки.
 * Определяет возможные окружения работы компонентов.
 */
export type ExecutionContext = 'development' | 'staging' | 'production' | 'testing';

/**
 * Фабрика для создания InternalErrorDTO. Гарантирует консистентность
 * структуры и валидность данных при создании DTO.
 * Возвращает Either для явной обработки ошибок валидации.
 */
export function createInternalErrorDTO(
  code: string,
  category: string,
  message: string,
  componentId: string,
  componentVersion: string,
  environment: ExecutionContext,
  details?: ErrorDetails,
  correlationId?: string,
  cause?: InternalErrorDTO,
  id?: string, // Для тестирования можно прокинуть кастомный id
): Either<ContractValidationError, InternalErrorDTO> {
  // Валидация входных параметров
  if (typeof code !== 'string' || !code.startsWith('SHARED_')) {
    return failure({
      type: 'CONTRACT_VALIDATION_ERROR',
      message: 'Invalid error code format',
      field: 'code',
      value: code,
    });
  }

  const validCategories: SharedErrorCategory[] = ['domain', 'infrastructure', 'policy', 'adapter'];
  if (typeof category !== 'string' || !validCategories.includes(category as SharedErrorCategory)) {
    return failure({
      type: 'CONTRACT_VALIDATION_ERROR',
      message: 'Invalid error category',
      field: 'category',
      value: category,
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

  if (typeof componentId !== 'string' || componentId.trim().length === 0) {
    return failure({
      type: 'CONTRACT_VALIDATION_ERROR',
      message: 'Component ID cannot be empty',
      field: 'componentId',
      value: componentId,
    });
  }

  if (typeof componentVersion !== 'string' || componentVersion.trim().length === 0) {
    return failure({
      type: 'CONTRACT_VALIDATION_ERROR',
      message: 'Component version cannot be empty',
      field: 'componentVersion',
      value: componentVersion,
    });
  }

  const dto: InternalErrorDTO = {
    id: id ?? randomUUID(), // Поддержка кастомного id для тестирования
    code: code as SharedErrorCodeString,
    category: category as SharedErrorCategory,
    message: message.trim(),
    ...(details !== undefined ? { details } : {}),
    metadata: {
      timestamp: new Date().toISOString(),
      componentId: componentId.trim(),
      componentVersion: componentVersion.trim(),
      environment,
      ...(correlationId !== undefined ? { correlationId } : {}),
    },
    ...(cause !== undefined ? { cause } : {}),
  };

  return success<ContractValidationError, InternalErrorDTO>(dto);
}

/**
 * Type guard для проверки, является ли объект InternalErrorDTO.
 * Используется для безопасной типизации в runtime.
 */
export function isInternalErrorDTO(obj: unknown): obj is InternalErrorDTO {
  const candidate = obj as Record<string, unknown>;

  // Проверка основных полей с валидацией непустоты строк
  const isValidBasic = typeof obj === 'object'
    && obj !== null
    && typeof candidate['id'] === 'string'
    && candidate['id'].trim().length > 0
    && typeof candidate['code'] === 'string'
    && candidate['code'].startsWith('SHARED_')
    && typeof candidate['category'] === 'string'
    && ['domain', 'infrastructure', 'policy', 'adapter'].includes(candidate['category'])
    && typeof candidate['message'] === 'string'
    && candidate['message'].trim().length > 0;

  if (!isValidBasic) return false;

  // Проверка метаданных
  const metadata = candidate['metadata'];
  if (
    typeof metadata !== 'object'
    || metadata === null
  ) return false;

  const metadataRecord = metadata as Record<string, unknown>;
  const isValidMetadata = typeof metadataRecord['timestamp'] === 'string'
    && metadataRecord['timestamp'].trim().length > 0
    && typeof metadataRecord['componentId'] === 'string'
    && metadataRecord['componentId'].trim().length > 0
    && typeof metadataRecord['componentVersion'] === 'string'
    && metadataRecord['componentVersion'].trim().length > 0
    && typeof metadataRecord['environment'] === 'string'
    && ['development', 'staging', 'production', 'testing'].includes(metadataRecord['environment']);

  if (!isValidMetadata) return false;

  // Рекурсивная проверка cause если он существует
  const cause = candidate['cause'];
  if (cause !== undefined) {
    return isInternalErrorDTO(cause);
  }

  return true;
}

/**
 * Утилита для извлечения кода ошибки из InternalErrorDTO.
 * Упрощает работу с DTO в shared компонентах.
 */
export function getInternalErrorCode(dto: InternalErrorDTO): SharedErrorCodeString {
  return dto.code;
}

/**
 * Утилита для извлечения категории ошибки из InternalErrorDTO.
 * Упрощает работу с DTO в shared компонентах.
 */
export function getInternalErrorCategory(dto: InternalErrorDTO): SharedErrorCategory {
  return dto.category;
}

/**
 * Утилита для извлечения correlation ID из InternalErrorDTO.
 * Возвращает undefined если correlation ID отсутствует.
 */
export function getInternalCorrelationId(dto: InternalErrorDTO): string | undefined {
  return dto.metadata.correlationId;
}

/**
 * Утилита для извлечения компонента, где произошла ошибка.
 * Упрощает debugging и мониторинг.
 */
export function getInternalErrorComponent(dto: InternalErrorDTO): string {
  return dto.metadata.componentId;
}

/**
 * Утилита для проверки, является ли ошибка частью цепочки (имеет cause).
 * Используется для анализа цепочек ошибок.
 */
export function hasInternalErrorCause(dto: InternalErrorDTO): boolean {
  return dto.cause !== undefined;
}

/**
 * Утилита для получения всей цепочки ошибок в виде массива.
 * Упрощает анализ и логирование цепочек ошибок.
 */
export function getInternalErrorChain(dto: InternalErrorDTO): InternalErrorDTO[] {
  const buildChain = (
    current: InternalErrorDTO | undefined,
    acc: InternalErrorDTO[],
  ): InternalErrorDTO[] => {
    if (!current) return acc;
    return buildChain(current.cause, [current, ...acc]);
  };

  return buildChain(dto, []);
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
