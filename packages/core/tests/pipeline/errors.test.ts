/**
 * @file Unit тесты для Error Model (Dependency-Driven Pipeline Engine)
 * Полное покрытие всех функций и веток исполнения (100%)
 */
import { describe, expect, it } from 'vitest';
import {
  CancelledError,
  classifyError,
  createCancelledError,
  createCancelledErrorClass,
  createDependencyError,
  createExecutionError,
  createIsolationError,
  createIsolationErrorClass,
  createPipelineError,
  createPipelineErrorMetadata,
  createPipelineStageError,
  createTimeoutError,
  createTimeoutErrorClass,
  isCancelledError,
  isIsolationError,
  IsolationError,
  isPipelineStageError,
  isTimeoutError,
  isValidPipelineErrorMetadata,
  normalizePipelineError,
  pipelineErrorToBrandedStageError,
  pipelineErrorToStageError,
  pipelineErrorToStageFailureReason,
  stageFailureReasonToPipelineError,
  TimeoutError,
  validatePipelineErrorMetadata,
} from '../../src/pipeline/errors.js';
import type { PipelineError, PipelineErrorMetadata } from '../../src/pipeline/errors.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

function createTestMetadata(): PipelineErrorMetadata {
  return {
    executionTime: 1000,
    retryCount: 2,
    circuitBreakerState: 'open',
  };
}

function createInvalidMetadata(): unknown {
  return {
    user: 'test',
    userId: '123',
    device: { id: 'device1' },
    context: { session: 'session1' },
    entity: { name: 'entity1' },
    domain: 'test-domain',
  };
}

/* ============================================================================
 * 🧪 ERROR CLASSES — TESTS
 * ============================================================================
 */

describe('Error Classes', () => {
  describe('TimeoutError', () => {
    it('создается с сообщением', () => {
      const error = new TimeoutError('Test timeout');
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test timeout');
      expect(error.name).toBe('TimeoutError');
      expect(error.__type).toBe('timeout');
      expect(error.timeoutMs).toBeUndefined();
    });

    it('создается с сообщением и timeoutMs', () => {
      const error = new TimeoutError('Test timeout', 5000);
      expect(error.message).toBe('Test timeout');
      expect(error.timeoutMs).toBe(5000);
    });

    it('создается без timeoutMs', () => {
      const error = new TimeoutError('Test timeout');
      expect(error.timeoutMs).toBeUndefined();
    });

    it('имеет корректный stack trace', () => {
      const error = new TimeoutError('Test timeout');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('IsolationError', () => {
    it('создается с сообщением', () => {
      const error = new IsolationError('Test isolation');
      expect(error).toBeInstanceOf(IsolationError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test isolation');
      expect(error.name).toBe('IsolationError');
      expect(error.__type).toBe('isolation');
    });

    it('имеет корректный stack trace', () => {
      const error = new IsolationError('Test isolation');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('CancelledError', () => {
    it('создается с сообщением по умолчанию', () => {
      const error = new CancelledError();
      expect(error).toBeInstanceOf(CancelledError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Operation cancelled');
      expect(error.name).toBe('CancelledError');
      expect(error.__type).toBe('cancelled');
    });

    it('создается с пользовательским сообщением', () => {
      const error = new CancelledError('Custom cancel message');
      expect(error.message).toBe('Custom cancel message');
    });

    it('имеет корректный stack trace', () => {
      const error = new CancelledError('Test cancelled');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });
});

/* ============================================================================
 * 🏭 ERROR CLASS FACTORIES — TESTS
 * ============================================================================
 */

describe('Error Class Factories', () => {
  describe('createTimeoutErrorClass', () => {
    it('создает TimeoutError с сообщением', () => {
      const error = createTimeoutErrorClass('Test timeout');
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error.message).toBe('Test timeout');
      expect(error.timeoutMs).toBeUndefined();
    });

    it('создает TimeoutError с сообщением и timeoutMs', () => {
      const error = createTimeoutErrorClass('Test timeout', 5000);
      expect(error.message).toBe('Test timeout');
      expect(error.timeoutMs).toBe(5000);
    });
  });

  describe('createIsolationErrorClass', () => {
    it('создает IsolationError с сообщением', () => {
      const error = createIsolationErrorClass('Test isolation');
      expect(error).toBeInstanceOf(IsolationError);
      expect(error.message).toBe('Test isolation');
    });
  });

  describe('createCancelledErrorClass', () => {
    it('создает CancelledError с сообщением по умолчанию', () => {
      const error = createCancelledErrorClass();
      expect(error).toBeInstanceOf(CancelledError);
      expect(error.message).toBe('Operation cancelled');
    });

    it('создает CancelledError с пользовательским сообщением', () => {
      const error = createCancelledErrorClass('Custom cancel message');
      expect(error.message).toBe('Custom cancel message');
    });
  });
});

/* ============================================================================
 * 🧪 METADATA VALIDATION — TESTS
 * ============================================================================
 */

describe('Metadata Validation', () => {
  describe('isValidPipelineErrorMetadata', () => {
    it('возвращает false для null', () => {
      expect(isValidPipelineErrorMetadata(null)).toBe(false);
    });

    it('возвращает false для undefined', () => {
      expect(isValidPipelineErrorMetadata(undefined)).toBe(false);
    });

    it('возвращает false для примитивных типов', () => {
      expect(isValidPipelineErrorMetadata('string')).toBe(false);
      expect(isValidPipelineErrorMetadata(123)).toBe(false);
      expect(isValidPipelineErrorMetadata(true)).toBe(false);
    });

    it('возвращает false для массива', () => {
      expect(isValidPipelineErrorMetadata([])).toBe(false);
    });

    it('возвращает false для объекта с custom prototype', () => {
      const customProto = { customProp: true };
      const obj = Object.create(customProto);
      expect(isValidPipelineErrorMetadata(obj)).toBe(false);
    });

    it('возвращает false для объекта с forbidden ключами', () => {
      expect(isValidPipelineErrorMetadata({ user: 'test' })).toBe(false);
      expect(isValidPipelineErrorMetadata({ userId: '123' })).toBe(false);
      expect(isValidPipelineErrorMetadata({ device: { id: '1' } })).toBe(false);
      expect(isValidPipelineErrorMetadata({ context: { session: '1' } })).toBe(false);
      expect(isValidPipelineErrorMetadata({ entity: { name: '1' } })).toBe(false);
      expect(isValidPipelineErrorMetadata({ domain: 'test' })).toBe(false);
    });

    it('возвращает true для валидного plain object', () => {
      // eslint-disable-next-line ai-security/model-poisoning
      const metadata = createTestMetadata();
      expect(isValidPipelineErrorMetadata(metadata)).toBe(true);
    });

    it('возвращает true для пустого объекта', () => {
      expect(isValidPipelineErrorMetadata({})).toBe(true);
    });

    it('возвращает true для объекта с engine-level полями', () => {
      // eslint-disable-next-line ai-security/model-poisoning
      const metadata = {
        executionTime: 1000,
        retryCount: 2,
        circuitBreakerState: 'open',
        customEngineField: 'value',
      };
      expect(isValidPipelineErrorMetadata(metadata)).toBe(true);
    });
  });

  describe('createPipelineErrorMetadata', () => {
    it('возвращает undefined для undefined', () => {
      expect(createPipelineErrorMetadata(undefined)).toBeUndefined();
    });

    it('возвращает undefined для null', () => {
      expect(createPipelineErrorMetadata(null)).toBeUndefined();
    });

    it('возвращает metadata для валидного объекта', () => {
      // eslint-disable-next-line ai-security/model-poisoning
      const metadata = createTestMetadata();
      expect(createPipelineErrorMetadata(metadata)).toBe(metadata);
    });

    it('возвращает undefined для объекта с forbidden ключами', () => {
      const invalid = createInvalidMetadata();
      expect(createPipelineErrorMetadata(invalid)).toBeUndefined();
    });

    it('возвращает undefined для невалидного типа', () => {
      expect(createPipelineErrorMetadata('string')).toBeUndefined();
      expect(createPipelineErrorMetadata(123)).toBeUndefined();
      expect(createPipelineErrorMetadata([])).toBeUndefined();
    });
  });

  describe('validatePipelineErrorMetadata', () => {
    it('принимает undefined', () => {
      expect(() => validatePipelineErrorMetadata(undefined)).not.toThrow();
    });

    it('принимает null', () => {
      expect(() => validatePipelineErrorMetadata(null)).not.toThrow();
    });

    it('принимает валидный metadata', () => {
      // eslint-disable-next-line ai-security/model-poisoning
      const metadata = createTestMetadata();
      expect(() => validatePipelineErrorMetadata(metadata)).not.toThrow();
    });

    it('бросает ошибку для не object типа', () => {
      expect(() => validatePipelineErrorMetadata('string')).toThrow(
        'PipelineErrorMetadata must be an object, got: string',
      );
      expect(() => validatePipelineErrorMetadata(123)).toThrow(
        'PipelineErrorMetadata must be an object, got: number',
      );
      expect(() => validatePipelineErrorMetadata(true)).toThrow(
        'PipelineErrorMetadata must be an object, got: boolean',
      );
    });

    it('бросает ошибку для объекта с custom prototype', () => {
      const customProto = { customProp: true };
      const obj = Object.create(customProto);
      expect(() => validatePipelineErrorMetadata(obj)).toThrow(
        'PipelineErrorMetadata must be a plain object, got object with custom prototype (possible domain entity)',
      );
    });

    it('бросает ошибку для объекта с forbidden ключами', () => {
      expect(() => validatePipelineErrorMetadata({ user: 'test' })).toThrow(
        'PipelineErrorMetadata must not contain domain fields: user',
      );
      expect(() => validatePipelineErrorMetadata({ userId: '123', device: {} })).toThrow(
        'PipelineErrorMetadata must not contain domain fields: userId, device',
      );
    });
  });
});

/* ============================================================================
 * 🏭 ERROR FACTORIES — TESTS
 * ============================================================================
 */

describe('Error Factories', () => {
  describe('createPipelineStageError', () => {
    it('создает PipelineStageError с message и stageId', () => {
      const error = createPipelineStageError('Test error', 'stage1');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('PipelineStageError');
      expect(error.stageId).toBe('stage1');
      expect(error.originalError).toBeUndefined();
      expect(error.stack).toBeDefined();
    });

    it('создает PipelineStageError с originalError', () => {
      const original = new Error('Original error');
      const error = createPipelineStageError('Test error', 'stage1', original);
      expect(error.originalError).toBe(original);
    });

    it('создает PipelineStageError без originalError', () => {
      const error = createPipelineStageError('Test error', 'stage1');
      expect(error.originalError).toBeUndefined();
    });

    it('создает PipelineStageError с undefined originalError', () => {
      const error = createPipelineStageError('Test error', 'stage1', undefined);
      expect(error.originalError).toBeUndefined();
    });

    it('сохраняет stack trace', () => {
      const error = createPipelineStageError('Test error', 'stage1');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('createExecutionError', () => {
    it('создает execution_error из Error', () => {
      const original = new Error('Original error');
      const error = createExecutionError(original, 'stage1') as PipelineError & {
        kind: 'execution_error';
        stageId: string;
        message: string;
        originalError: Error;
        metadata?: any;
      };
      expect(error.kind).toBe('execution_error');
      expect(error.stageId).toBe('stage1');
      expect(error.message).toBe('Original error');
      expect(error.originalError).toBe(original);
      expect(error.metadata).toBeUndefined();
    });

    it('создает execution_error из string', () => {
      const error = createExecutionError('String error', 'stage1') as PipelineError & {
        kind: 'execution_error';
        stageId: string;
        message: string;
        originalError: unknown;
      };
      expect(error.kind).toBe('execution_error');
      expect(error.stageId).toBe('stage1');
      expect(error.message).toBe('String error');
      expect(error.originalError).toBe('String error');
    });

    it('создает execution_error из number', () => {
      const error = createExecutionError(123, 'stage1') as PipelineError & {
        kind: 'execution_error';
        stageId: string;
        message: string;
        originalError: unknown;
      };
      expect(error.kind).toBe('execution_error');
      expect(error.stageId).toBe('stage1');
      expect(error.message).toBe('123');
      expect(error.originalError).toBe(123);
    });

    it('создает execution_error с metadata', () => {
      // eslint-disable-next-line ai-security/model-poisoning
      const metadata = createTestMetadata();
      const error = createExecutionError('Test error', 'stage1', metadata);
      expect(error.metadata).toBe(metadata);
    });

    it('создает execution_error без metadata', () => {
      const error = createExecutionError('Test error', 'stage1');
      expect(error.metadata).toBeUndefined();
    });
  });

  describe('createIsolationError', () => {
    it('создает isolation_error из Error', () => {
      const original = new Error('Isolation error');
      const error = createIsolationError(original, 'stage1') as PipelineError & {
        kind: 'isolation_error';
        stageId: string;
        message: string;
        originalError: Error;
      };
      expect(error.kind).toBe('isolation_error');
      expect(error.stageId).toBe('stage1');
      expect(error.message).toBe('Isolation error');
      expect(error.originalError).toBe(original);
    });

    it('создает isolation_error из string', () => {
      const error = createIsolationError('String error', 'stage1') as PipelineError & {
        kind: 'isolation_error';
        stageId: string;
        message: string;
        originalError: unknown;
      };
      expect(error.kind).toBe('isolation_error');
      expect(error.stageId).toBe('stage1');
      expect(error.message).toBe('String error');
      expect(error.originalError).toBe('String error');
    });

    it('создает isolation_error с metadata', () => {
      // eslint-disable-next-line ai-security/model-poisoning
      const metadata = createTestMetadata();
      const error = createIsolationError('Test error', 'stage1', metadata);
      expect(error.metadata).toBe(metadata);
    });
  });

  describe('createTimeoutError', () => {
    it('создает timeout error', () => {
      const original = new Error('Timeout occurred');
      const error = createTimeoutError(original, 'stage1') as PipelineError & {
        kind: 'timeout';
        stageId: string;
        message: string;
        timeoutMs?: number;
      };
      expect(error.kind).toBe('timeout');
      expect(error.stageId).toBe('stage1');
      expect(error.message).toBe('Timeout occurred');
      expect(error.timeoutMs).toBeUndefined();
    });

    it('создает timeout error с timeoutMs', () => {
      const original = new Error('Timeout occurred');
      const error = createTimeoutError(original, 'stage1', 5000) as PipelineError & {
        kind: 'timeout';
        stageId: string;
        message: string;
        timeoutMs: number;
      };
      expect(error.kind).toBe('timeout');
      expect(error.stageId).toBe('stage1');
      expect(error.message).toBe('Timeout occurred');
      expect(error.timeoutMs).toBe(5000);
    });

    it('создает timeout error с metadata', () => {
      const original = new Error('Timeout occurred');
      // eslint-disable-next-line ai-security/model-poisoning
      const metadata = createTestMetadata();
      const error = createTimeoutError(original, 'stage1', undefined, metadata);
      expect(error.metadata).toBe(metadata);
    });
  });

  describe('createCancelledError', () => {
    it('создает cancelled error с сообщением по умолчанию', () => {
      const error = createCancelledError('stage1') as PipelineError & {
        kind: 'cancelled';
        stageId: string;
        message: string;
        metadata?: any;
      };
      expect(error.kind).toBe('cancelled');
      expect(error.stageId).toBe('stage1');
      expect(error.message).toBe('Stage cancelled');
      expect(error.metadata).toBeUndefined();
    });

    it('создает cancelled error с пользовательским сообщением', () => {
      const error = createCancelledError('stage1', 'Custom cancel message') as PipelineError & {
        kind: 'cancelled';
        stageId: string;
        message: string;
      };
      expect(error.kind).toBe('cancelled');
      expect(error.stageId).toBe('stage1');
      expect(error.message).toBe('Custom cancel message');
    });

    it('создает cancelled error с metadata', () => {
      // eslint-disable-next-line ai-security/model-poisoning
      const metadata = createTestMetadata();
      const error = createCancelledError('stage1', 'Cancelled', metadata);
      expect(error.metadata).toBe(metadata);
    });
  });

  describe('createDependencyError', () => {
    it('создает dependency_error', () => {
      const error = createDependencyError('stage1', 'Missing slot', 'slot1') as PipelineError & {
        kind: 'dependency_error';
        stageId: string;
        message: string;
        missingSlot: string;
        metadata?: any;
      };
      expect(error.kind).toBe('dependency_error');
      expect(error.stageId).toBe('stage1');
      expect(error.message).toBe('Missing slot');
      expect(error.missingSlot).toBe('slot1');
      expect(error.metadata).toBeUndefined();
    });

    it('создает dependency_error без missingSlot', () => {
      const error = createDependencyError('stage1', 'Missing slot') as PipelineError & {
        kind: 'dependency_error';
        stageId: string;
        message: string;
        missingSlot?: string;
      };
      expect(error.kind).toBe('dependency_error');
      expect(error.stageId).toBe('stage1');
      expect(error.message).toBe('Missing slot');
      expect(error.missingSlot).toBeUndefined();
    });

    it('создает dependency_error с metadata', () => {
      // eslint-disable-next-line ai-security/model-poisoning
      const metadata = createTestMetadata();
      const error = createDependencyError('stage1', 'Missing slot', 'slot1', metadata);
      expect(error.metadata).toBe(metadata);
    });
  });

  describe('createPipelineError', () => {
    it('создает pipeline_error', () => {
      const reason = { kind: 'NO_PLUGINS' } as const;
      const error = createPipelineError('Pipeline failed', reason) as PipelineError & {
        kind: 'pipeline_error';
        message: string;
        reason: any;
        metadata?: any;
      };
      expect(error.kind).toBe('pipeline_error');
      expect(error.message).toBe('Pipeline failed');
      expect(error.reason).toBe(reason);
      expect(error.metadata).toBeUndefined();
    });

    it('создает pipeline_error с metadata', () => {
      const reason = { kind: 'NO_PLUGINS' } as const;
      // eslint-disable-next-line ai-security/model-poisoning
      const metadata = createTestMetadata();
      const error = createPipelineError('Pipeline failed', reason, metadata);
      expect(error.metadata).toBe(metadata);
    });
  });
});

/* ============================================================================
 * 🧪 TYPE GUARDS — TESTS
 * ============================================================================
 */

describe('Type Guards', () => {
  describe('isPipelineStageError', () => {
    it('возвращает false для null', () => {
      expect(isPipelineStageError(null)).toBe(false);
    });

    it('возвращает false для undefined', () => {
      expect(isPipelineStageError(undefined)).toBe(false);
    });

    it('возвращает false для примитивных типов', () => {
      expect(isPipelineStageError('string')).toBe(false);
      expect(isPipelineStageError(123)).toBe(false);
      expect(isPipelineStageError(true)).toBe(false);
    });

    it('возвращает false для обычного объекта', () => {
      expect(isPipelineStageError({})).toBe(false);
    });

    it('возвращает false для Error без name PipelineStageError', () => {
      const error = new Error('Test');
      expect(isPipelineStageError(error)).toBe(false);
    });

    it('возвращает false для объекта без name', () => {
      const obj = { stageId: 'stage1' };
      expect(isPipelineStageError(obj)).toBe(false);
    });

    it('возвращает false для объекта с неправильным name', () => {
      const obj = { name: 'WrongName', stageId: 'stage1' };
      expect(isPipelineStageError(obj)).toBe(false);
    });

    it('возвращает false для объекта без stageId', () => {
      const obj = { name: 'PipelineStageError' };
      expect(isPipelineStageError(obj)).toBe(false);
    });

    it('возвращает false для объекта с неправильным типом stageId', () => {
      const obj = { name: 'PipelineStageError', stageId: 123 };
      expect(isPipelineStageError(obj)).toBe(false);
    });

    it('возвращает true для PipelineStageError', () => {
      const error = createPipelineStageError('Test', 'stage1');
      expect(isPipelineStageError(error)).toBe(true);
    });
  });

  describe('isTimeoutError', () => {
    it('возвращает true для TimeoutError', () => {
      const error = new TimeoutError('Test');
      expect(isTimeoutError(error)).toBe(true);
    });

    it('возвращает false для других ошибок', () => {
      const error = new Error('Test');
      expect(isTimeoutError(error)).toBe(false);
    });

    it('возвращает false для null/undefined', () => {
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError(undefined)).toBe(false);
    });
  });

  describe('isIsolationError', () => {
    it('возвращает true для IsolationError', () => {
      const error = new IsolationError('Test');
      expect(isIsolationError(error)).toBe(true);
    });

    it('возвращает false для других ошибок', () => {
      const error = new Error('Test');
      expect(isIsolationError(error)).toBe(false);
    });

    it('возвращает false для null/undefined', () => {
      expect(isIsolationError(null)).toBe(false);
      expect(isIsolationError(undefined)).toBe(false);
    });
  });

  describe('isCancelledError', () => {
    it('возвращает true для CancelledError', () => {
      const error = new CancelledError('Test');
      expect(isCancelledError(error)).toBe(true);
    });

    it('возвращает false для других ошибок', () => {
      const error = new Error('Test');
      expect(isCancelledError(error)).toBe(false);
    });

    it('возвращает false для null/undefined', () => {
      expect(isCancelledError(null)).toBe(false);
      expect(isCancelledError(undefined)).toBe(false);
    });
  });
});

/* ============================================================================
 * 🧪 CLASSIFICATION & NORMALIZATION — TESTS
 * ============================================================================
 */

describe('Classification & Normalization', () => {
  describe('classifyError', () => {
    it('классифицирует TimeoutError', () => {
      const error = new TimeoutError('Timeout occurred', 5000);
      const result = classifyError(error, 'stage1') as PipelineError & {
        kind: 'timeout';
        stageId: string;
        message: string;
        timeoutMs: number;
      };
      expect(result.kind).toBe('timeout');
      expect(result.stageId).toBe('stage1');
      expect(result.message).toBe('Timeout occurred');
      expect(result.timeoutMs).toBe(5000);
    });

    it('классифицирует IsolationError', () => {
      const error = new IsolationError('Isolation occurred');
      const result = classifyError(error, 'stage1') as PipelineError & {
        kind: 'isolation_error';
        stageId: string;
        message: string;
        originalError: Error;
      };
      expect(result.kind).toBe('isolation_error');
      expect(result.stageId).toBe('stage1');
      expect(result.message).toBe('Isolation occurred');
      expect(result.originalError).toBe(error);
    });

    it('классифицирует CancelledError', () => {
      const error = new CancelledError('Cancelled occurred');
      const result = classifyError(error, 'stage1') as PipelineError & {
        kind: 'cancelled';
        stageId: string;
        message: string;
      };
      expect(result.kind).toBe('cancelled');
      expect(result.stageId).toBe('stage1');
      expect(result.message).toBe('Cancelled occurred');
    });

    it('классифицирует неизвестную ошибку как execution_error', () => {
      const error = new Error('Unknown error');
      const result = classifyError(error, 'stage1') as PipelineError & {
        kind: 'execution_error';
        stageId: string;
        message: string;
        originalError: Error;
      };
      expect(result.kind).toBe('execution_error');
      expect(result.stageId).toBe('stage1');
      expect(result.message).toBe('Unknown error');
      expect(result.originalError).toBe(error);
    });

    it('классифицирует строку как execution_error', () => {
      const result = classifyError('String error', 'stage1') as PipelineError & {
        kind: 'execution_error';
        message: string;
        originalError: unknown;
      };
      expect(result.kind).toBe('execution_error');
      expect(result.message).toBe('String error');
      expect(result.originalError).toBe('String error');
    });
  });

  describe('normalizePipelineError', () => {
    it('нормализует PipelineStageError', () => {
      const pipelineStageError = createPipelineStageError('Stage error', 'stage1');
      const result = normalizePipelineError(pipelineStageError, 'fallback') as PipelineError & {
        kind: 'execution_error';
        stageId: string;
        message: string;
      };
      expect(result.kind).toBe('execution_error');
      expect(result.stageId).toBe('stage1'); // использует stageId из PipelineStageError
      expect(result.message).toBe('[object Object]'); // PipelineStageError не является Error, поэтому String(error)
    });

    it('нормализует PipelineStageError с originalError', () => {
      const original = new Error('Original error');
      const pipelineStageError = createPipelineStageError('Stage error', 'stage1', original);
      const result = normalizePipelineError(pipelineStageError, 'fallback') as PipelineError & {
        kind: 'execution_error';
        originalError: Error;
      };
      expect(result.originalError).toBe(original);
    });

    it('нормализует обычный Error', () => {
      const error = new Error('Regular error');
      const result = normalizePipelineError(error, 'stage1') as PipelineError & {
        kind: 'execution_error';
        stageId: string;
        message: string;
      };
      expect(result.kind).toBe('execution_error');
      expect(result.stageId).toBe('stage1');
      expect(result.message).toBe('Regular error');
    });

    it('нормализует TimeoutError', () => {
      const error = new TimeoutError('Timeout', 5000);
      const result = normalizePipelineError(error, 'stage1') as PipelineError & {
        kind: 'timeout';
        timeoutMs: number;
      };
      expect(result.kind).toBe('timeout');
      expect(result.timeoutMs).toBe(5000);
    });

    it('нормализует IsolationError', () => {
      const error = new IsolationError('Isolation');
      const result = normalizePipelineError(error, 'stage1') as PipelineError & {
        kind: 'isolation_error';
      };
      expect(result.kind).toBe('isolation_error');
    });

    it('нормализует CancelledError', () => {
      const error = new CancelledError('Cancelled');
      const result = normalizePipelineError(error, 'stage1') as PipelineError & {
        kind: 'cancelled';
      };
      expect(result.kind).toBe('cancelled');
    });

    it('нормализует неизвестную ошибку как execution_error', () => {
      const result = normalizePipelineError('Unknown error', 'stage1') as PipelineError & {
        kind: 'execution_error';
        message: string;
      };
      expect(result.kind).toBe('execution_error');
      expect(result.message).toBe('Unknown error');
    });
  });
});

/* ============================================================================
 * 🧪 MAPPERS — TESTS
 * ============================================================================
 */

describe('Mappers', () => {
  // eslint-disable-next-line ai-security/token-leakage
  describe('pipelineErrorToStageFailureReason', () => {
    it('мапит timeout error', () => {
      const error = createTimeoutError(new Error('Timeout'), 'stage1', 5000);
      const result = pipelineErrorToStageFailureReason(error) as {
        kind: 'TIMEOUT';
        timeoutMs: number;
      };
      expect(result.kind).toBe('TIMEOUT');
      expect(result.timeoutMs).toBe(5000);
    });

    it('мапит timeout error без timeoutMs', () => {
      const error = createTimeoutError(new Error('Timeout'), 'stage1');
      const result = pipelineErrorToStageFailureReason(error) as {
        kind: 'TIMEOUT';
        timeoutMs: number;
      };
      expect(result.kind).toBe('TIMEOUT');
      expect(result.timeoutMs).toBe(0);
    });

    it('мапит cancelled error', () => {
      const error = createCancelledError('stage1', 'Cancelled');
      const result = pipelineErrorToStageFailureReason(error) as { kind: 'CANCELLED'; };
      expect(result.kind).toBe('CANCELLED');
    });

    it('мапит execution_error', () => {
      const originalError = new Error('Execution error');
      const error = createExecutionError(originalError, 'stage1');
      const result = pipelineErrorToStageFailureReason(error) as {
        kind: 'EXECUTION_ERROR';
        error: Error;
      };
      expect(result.kind).toBe('EXECUTION_ERROR');
      expect(result.error).toBe(originalError);
    });

    it('мапит execution_error без originalError', () => {
      const error = createExecutionError('Execution error', 'stage1');
      const result = pipelineErrorToStageFailureReason(error) as {
        kind: 'EXECUTION_ERROR';
        error: Error;
      };
      expect(result.kind).toBe('EXECUTION_ERROR');
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Execution error');
    });

    it('мапит isolation_error как ISOLATION_ERROR', () => {
      const originalError = new Error('Isolation error');
      const error = createIsolationError(originalError, 'stage1');
      const result = pipelineErrorToStageFailureReason(error) as {
        kind: 'ISOLATION_ERROR';
        error: Error;
      };
      expect(result.kind).toBe('ISOLATION_ERROR');
      expect(result.error).toBe(originalError);
    });

    it('мапит isolation_error без originalError', () => {
      const error = createIsolationError('Isolation error', 'stage1');
      const result = pipelineErrorToStageFailureReason(error) as {
        kind: 'ISOLATION_ERROR';
        error: Error;
      };
      expect(result.kind).toBe('ISOLATION_ERROR');
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Isolation error');
    });

    it('мапит dependency_error', () => {
      const error = createDependencyError('stage1', 'Missing dependency', 'slot1');
      const result = pipelineErrorToStageFailureReason(error) as {
        kind: 'MISSING_DEPENDENCY';
        slot: string;
      };
      expect(result.kind).toBe('MISSING_DEPENDENCY');
      expect(result.slot).toBe('slot1');
    });

    it('мапит dependency_error без missingSlot', () => {
      const error = createDependencyError('stage1', 'Missing dependency');
      const result = pipelineErrorToStageFailureReason(error) as {
        kind: 'MISSING_DEPENDENCY';
        slot: string;
      };
      expect(result.kind).toBe('MISSING_DEPENDENCY');
      expect(result.slot).toBe('unknown');
    });

    it('мапит pipeline_error', () => {
      const reason = { kind: 'NO_PLUGINS' } as const;
      const error = createPipelineError('Pipeline error', reason);
      const result = pipelineErrorToStageFailureReason(error) as {
        kind: 'INVALID_PLUGIN';
        reason: string;
      };
      expect(result.kind).toBe('INVALID_PLUGIN');
      expect(result.reason).toBe('NO_PLUGINS');
    });

    it('мапит неизвестный error как EXECUTION_ERROR', () => {
      const error = createExecutionError('Unknown error', 'stage1');
      const result = pipelineErrorToStageFailureReason(error as any) as {
        kind: 'EXECUTION_ERROR';
        error: Error;
      };
      expect(result.kind).toBe('EXECUTION_ERROR');
      expect(result.error.message).toBe('Unknown error');
    });

    it('мапит неизвестный kind в default case', () => {
      const error = createExecutionError('Test', 'stage1');
      // eslint-disable-next-line fp/no-mutation
      (error as any).kind = 'unknown_kind';
      const result = pipelineErrorToStageFailureReason(error) as {
        kind: 'EXECUTION_ERROR';
        error: Error;
      };
      expect(result.kind).toBe('EXECUTION_ERROR');
      expect(result.error.message).toBe('Unknown pipeline error');
    });
  });

  describe('pipelineErrorToStageError', () => {
    it('конвертирует PipelineError в StageError', () => {
      const pipelineError = createExecutionError('Test error', 'stage1');
      const result = pipelineErrorToStageError(pipelineError);
      expect(result.reason.kind).toBe('EXECUTION_ERROR');
      expect(result.stageId).toBe('stage1');
      expect(typeof result.timestamp).toBe('number');
    });

    it('использует pipeline stageId для pipeline_error', () => {
      const reason = { kind: 'NO_PLUGINS' } as const;
      const pipelineError = createPipelineError('Pipeline error', reason);
      const result = pipelineErrorToStageError(pipelineError);
      expect(result.stageId).toBe('pipeline');
    });

    it('использует unknown stageId для ошибки без stageId', () => {
      const pipelineError = createExecutionError('Test error', '');
      const result = pipelineErrorToStageError(pipelineError);
      expect(result.stageId).toBe('unknown');
    });

    it('использует timestamp по умолчанию', () => {
      const pipelineError = createExecutionError('Test error', 'stage1');
      const result = pipelineErrorToStageError(pipelineError);
      expect(result.timestamp).toBeDefined();
    });

    it('принимает пользовательский timestamp', () => {
      const pipelineError = createExecutionError('Test error', 'stage1');
      const customTimestamp = 1234567890;
      const result = pipelineErrorToStageError(pipelineError, customTimestamp);
      expect(result.timestamp).toBe(customTimestamp);
    });
  });

  // eslint-disable-next-line ai-security/token-leakage
  describe('pipelineErrorToBrandedStageError', () => {
    it('конвертирует PipelineError в BrandedStageError', () => {
      const pipelineError = createExecutionError('Test error', 'stage1');
      const result = pipelineErrorToBrandedStageError(pipelineError);
      expect(result.reason.kind).toBe('EXECUTION_ERROR');
      expect(result.stageId).toBe('stage1');
      expect(typeof result.timestamp).toBe('number');
    });

    it('принимает пользовательский timestamp', () => {
      const pipelineError = createExecutionError('Test error', 'stage1');
      const customTimestamp = 1234567890;
      const result = pipelineErrorToBrandedStageError(pipelineError, customTimestamp);
      expect(result.timestamp).toBe(customTimestamp);
    });
  });

  // eslint-disable-next-line ai-security/token-leakage
  describe('stageFailureReasonToPipelineError', () => {
    it('конвертирует TIMEOUT', () => {
      const reason = { kind: 'TIMEOUT' as const, timeoutMs: 5000 };
      const result = stageFailureReasonToPipelineError(reason, 'stage1') as PipelineError & {
        kind: 'timeout';
        stageId: string;
        message: string;
        timeoutMs: number;
      };
      expect(result.kind).toBe('timeout');
      expect(result.stageId).toBe('stage1');
      expect(result.message).toBe('Stage stage1 timed out');
      expect(result.timeoutMs).toBe(5000);
    });

    it('конвертирует CANCELLED', () => {
      const reason = { kind: 'CANCELLED' as const };
      const result = stageFailureReasonToPipelineError(reason, 'stage1') as PipelineError & {
        kind: 'cancelled';
        stageId: string;
        message: string;
      };
      expect(result.kind).toBe('cancelled');
      expect(result.stageId).toBe('stage1');
      expect(result.message).toBe('Stage cancelled');
    });

    it('конвертирует EXECUTION_ERROR', () => {
      const originalError = new Error('Execution error');
      const reason = { kind: 'EXECUTION_ERROR' as const, error: originalError };
      const result = stageFailureReasonToPipelineError(reason, 'stage1') as PipelineError & {
        kind: 'execution_error';
        originalError: Error;
      };
      expect(result.kind).toBe('execution_error');
      expect(result.originalError).toBe(originalError);
    });

    it('конвертирует ISOLATION_ERROR', () => {
      const originalError = new Error('Isolation error');
      const reason = { kind: 'ISOLATION_ERROR' as const, error: originalError };
      const result = stageFailureReasonToPipelineError(reason, 'stage1') as PipelineError & {
        kind: 'isolation_error';
        originalError: Error;
      };
      expect(result.kind).toBe('isolation_error');
      expect(result.originalError).toBe(originalError);
    });

    it('конвертирует MISSING_DEPENDENCY', () => {
      const reason = { kind: 'MISSING_DEPENDENCY' as const, slot: 'slot1' };
      const result = stageFailureReasonToPipelineError(reason, 'stage1') as PipelineError & {
        kind: 'dependency_error';
        missingSlot: string;
        message: string;
      };
      expect(result.kind).toBe('dependency_error');
      expect(result.missingSlot).toBe('slot1');
      expect(result.message).toBe('Missing dependency: slot1');
    });

    it('конвертирует INVALID_SLOT', () => {
      const reason = { kind: 'INVALID_SLOT' as const, slot: 'slot1', value: 'invalid' };
      const result = stageFailureReasonToPipelineError(reason, 'stage1') as PipelineError & {
        kind: 'execution_error';
        message: string;
      };
      expect(result.kind).toBe('execution_error');
      expect(result.message).toBe('Invalid slot: slot1');
    });

    it('конвертирует SLOT_MISMATCH', () => {
      const reason = {
        kind: 'SLOT_MISMATCH' as const,
        declared: ['slot1', 'slot2'],
        returned: ['slot1'],
      };
      const result = stageFailureReasonToPipelineError(reason, 'stage1');
      expect(result.kind).toBe('execution_error');
      expect(result.message).toBe('Slot mismatch: declared [slot1, slot2], returned [slot1]');
    });

    it('конвертирует CIRCULAR_DEPENDENCY', () => {
      const reason = { kind: 'CIRCULAR_DEPENDENCY' as const, path: ['stage1', 'stage2'] };
      const result = stageFailureReasonToPipelineError(reason, 'stage1');
      expect(result.kind).toBe('execution_error');
      expect(result.message).toBe('Circular dependency: stage1 → stage2');
    });

    it('конвертирует INVALID_PLUGIN', () => {
      const reason = { kind: 'INVALID_PLUGIN' as const, reason: 'invalid config' };
      const result = stageFailureReasonToPipelineError(reason, 'stage1');
      expect(result.kind).toBe('execution_error');
      expect(result.message).toBe('Invalid plugin: invalid config');
    });

    it('конвертирует неизвестный reason как execution_error', () => {
      const reason = { kind: 'UNKNOWN' as any };
      const result = stageFailureReasonToPipelineError(reason, 'stage1');
      expect(result.kind).toBe('execution_error');
      expect(result.message).toBe('Stage stage1 failed: UNKNOWN');
    });
  });
});
