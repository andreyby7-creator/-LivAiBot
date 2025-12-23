/**
 * @file CacheAdapterTypes.test.ts - Тесты для CacheAdapterTypes
 *
 * Цель: типы и branded types; edge cases, optional поля.
 * Желаемое покрытие: 95%+
 */

import { describe, expect, it } from 'vitest';

import { cacheAdapterFactories } from '../../../../../../src/errors/shared/adapters/cache/CacheAdapterFactories';
import { INFRA_ERROR_CODES } from '../../../../../../src/errors/base/ErrorCode';
import type {
  CacheAdapterContext,
  CacheAdapterOptions,
  CacheError,
  CacheRequest,
  CacheResponse,
  CacheStrategyDecision,
} from '../../../../../../src/errors/shared/adapters/cache/CacheAdapterTypes';

describe('CacheAdapterTypes', () => {
  describe('CacheRequest', () => {
    describe('get request', () => {
      it('should create valid CacheGetRequest with all required fields', () => {
        const request: CacheRequest = {
          type: 'get',
          request: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            timeoutMs: cacheAdapterFactories.makeTimeoutMs(5000),
          },
        };

        expect(request.type).toBe('get');
        expect(request.request.key).toBe('user:123');
        expect(request.request.timeoutMs).toBe(5000);
      });

      it('should create valid CacheGetRequest with minimal fields', () => {
        const request: CacheRequest = {
          type: 'get',
          request: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
          },
        };

        expect(request.type).toBe('get');
        expect(request.request.key).toBe('user:123');
        expect(request.request.timeoutMs).toBeUndefined();
      });
    });

    describe('set request', () => {
      it('should create valid CacheSetRequest with all required fields', () => {
        const request: CacheRequest = {
          type: 'set',
          request: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            value: { name: 'John', age: 30 },
            ttlMs: cacheAdapterFactories.makeCacheTtlMs(3600000),
            timeoutMs: cacheAdapterFactories.makeTimeoutMs(3000),
          },
        };

        expect(request.type).toBe('set');
        expect(request.request.key).toBe('user:123');
        expect(request.request.value).toEqual({ name: 'John', age: 30 });
        expect(request.request.ttlMs).toBe(3600000);
        expect(request.request.timeoutMs).toBe(3000);
      });

      it('should create valid CacheSetRequest with minimal fields', () => {
        const request: CacheRequest = {
          type: 'set',
          request: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            value: 'simple string',
          },
        };

        expect(request.type).toBe('set');
        expect(request.request.key).toBe('user:123');
        expect(request.request.value).toBe('simple string');
        expect(request.request.ttlMs).toBeUndefined();
        expect(request.request.timeoutMs).toBeUndefined();
      });

      it('should handle different value types', () => {
        // string
        const stringRequest: CacheRequest = {
          type: 'set',
          request: {
            key: cacheAdapterFactories.makeCacheKey('str:key'),
            value: 'test string',
          },
        };
        expect(stringRequest.request.value).toBe('test string');

        // number
        const numberRequest: CacheRequest = {
          type: 'set',
          request: {
            key: cacheAdapterFactories.makeCacheKey('num:key'),
            value: 42,
          },
        };
        expect(numberRequest.request.value).toBe(42);

        // boolean
        const booleanRequest: CacheRequest = {
          type: 'set',
          request: {
            key: cacheAdapterFactories.makeCacheKey('bool:key'),
            value: true,
          },
        };
        expect(booleanRequest.request.value).toBe(true);

        // object
        const objectRequest: CacheRequest = {
          type: 'set',
          request: {
            key: cacheAdapterFactories.makeCacheKey('obj:key'),
            value: { nested: { data: 'value' } },
          },
        };
        expect(objectRequest.request.value).toEqual({ nested: { data: 'value' } });

        // array
        const arrayRequest: CacheRequest = {
          type: 'set',
          request: {
            key: cacheAdapterFactories.makeCacheKey('arr:key'),
            value: [1, 2, 3, 'four'],
          },
        };
        expect(arrayRequest.request.value).toEqual([1, 2, 3, 'four']);
      });
    });

    describe('delete request', () => {
      it('should create valid CacheDeleteRequest with all fields', () => {
        const request: CacheRequest = {
          type: 'delete',
          request: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            timeoutMs: cacheAdapterFactories.makeTimeoutMs(2000),
          },
        };

        expect(request.type).toBe('delete');
        expect(request.request.key).toBe('user:123');
        expect(request.request.timeoutMs).toBe(2000);
      });

      it('should create valid CacheDeleteRequest with minimal fields', () => {
        const request: CacheRequest = {
          type: 'delete',
          request: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
          },
        };

        expect(request.type).toBe('delete');
        expect(request.request.key).toBe('user:123');
        expect(request.request.timeoutMs).toBeUndefined();
      });
    });

    describe('exists request', () => {
      it('should create valid CacheExistsRequest with all fields', () => {
        const request: CacheRequest = {
          type: 'exists',
          request: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            timeoutMs: cacheAdapterFactories.makeTimeoutMs(1000),
          },
        };

        expect(request.type).toBe('exists');
        expect(request.request.key).toBe('user:123');
        expect(request.request.timeoutMs).toBe(1000);
      });

      it('should create valid CacheExistsRequest with minimal fields', () => {
        const request: CacheRequest = {
          type: 'exists',
          request: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
          },
        };

        expect(request.type).toBe('exists');
        expect(request.request.key).toBe('user:123');
        expect(request.request.timeoutMs).toBeUndefined();
      });
    });

    describe('ttl request', () => {
      it('should create valid CacheTtlRequest with all fields', () => {
        const request: CacheRequest = {
          type: 'ttl',
          request: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            timeoutMs: cacheAdapterFactories.makeTimeoutMs(1500),
          },
        };

        expect(request.type).toBe('ttl');
        expect(request.request.key).toBe('user:123');
        expect(request.request.timeoutMs).toBe(1500);
      });

      it('should create valid CacheTtlRequest with minimal fields', () => {
        const request: CacheRequest = {
          type: 'ttl',
          request: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
          },
        };

        expect(request.type).toBe('ttl');
        expect(request.request.key).toBe('user:123');
        expect(request.request.timeoutMs).toBeUndefined();
      });
    });
  });

  describe('CacheResponse', () => {
    describe('get response', () => {
      it('should create valid CacheGetResponse with value', () => {
        const response: CacheResponse = {
          type: 'get',
          response: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            value: { name: 'John', age: 30 },
            durationMs: cacheAdapterFactories.makeDurationMs(45),
          },
        };

        expect(response.type).toBe('get');
        expect(response.response.key).toBe('user:123');
        expect(response.response.value).toEqual({ name: 'John', age: 30 });
        expect(response.response.durationMs).toBe(45);
      });

      it('should create valid CacheGetResponse with null (cache miss)', () => {
        const response: CacheResponse = {
          type: 'get',
          response: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            value: null,
            durationMs: cacheAdapterFactories.makeDurationMs(12),
          },
        };

        expect(response.type).toBe('get');
        expect(response.response.key).toBe('user:123');
        expect(response.response.value).toBeNull();
        expect(response.response.durationMs).toBe(12);
      });
    });

    describe('set response', () => {
      it('should create valid CacheSetResponse with success', () => {
        const response: CacheResponse = {
          type: 'set',
          response: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            success: true,
            durationMs: cacheAdapterFactories.makeDurationMs(23),
          },
        };

        expect(response.type).toBe('set');
        expect(response.response.key).toBe('user:123');
        expect(response.response.success).toBe(true);
        expect(response.response.durationMs).toBe(23);
      });

      it('should create valid CacheSetResponse with failure', () => {
        const response: CacheResponse = {
          type: 'set',
          response: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            success: false,
            durationMs: cacheAdapterFactories.makeDurationMs(89),
          },
        };

        expect(response.type).toBe('set');
        expect(response.response.key).toBe('user:123');
        expect(response.response.success).toBe(false);
        expect(response.response.durationMs).toBe(89);
      });
    });

    describe('delete response', () => {
      it('should create valid CacheDeleteResponse with deletion', () => {
        const response: CacheResponse = {
          type: 'delete',
          response: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            deleted: true,
            durationMs: cacheAdapterFactories.makeDurationMs(15),
          },
        };

        expect(response.type).toBe('delete');
        expect(response.response.key).toBe('user:123');
        expect(response.response.deleted).toBe(true);
        expect(response.response.durationMs).toBe(15);
      });

      it('should create valid CacheDeleteResponse with no deletion', () => {
        const response: CacheResponse = {
          type: 'delete',
          response: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            deleted: false,
            durationMs: cacheAdapterFactories.makeDurationMs(8),
          },
        };

        expect(response.type).toBe('delete');
        expect(response.response.key).toBe('user:123');
        expect(response.response.deleted).toBe(false);
        expect(response.response.durationMs).toBe(8);
      });
    });

    describe('exists response', () => {
      it('should create valid CacheExistsResponse with exists', () => {
        const response: CacheResponse = {
          type: 'exists',
          response: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            exists: true,
            durationMs: cacheAdapterFactories.makeDurationMs(7),
          },
        };

        expect(response.type).toBe('exists');
        expect(response.response.key).toBe('user:123');
        expect(response.response.exists).toBe(true);
        expect(response.response.durationMs).toBe(7);
      });

      it('should create valid CacheExistsResponse with not exists', () => {
        const response: CacheResponse = {
          type: 'exists',
          response: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            exists: false,
            durationMs: cacheAdapterFactories.makeDurationMs(5),
          },
        };

        expect(response.type).toBe('exists');
        expect(response.response.key).toBe('user:123');
        expect(response.response.exists).toBe(false);
        expect(response.response.durationMs).toBe(5);
      });
    });

    describe('ttl response', () => {
      it('should create valid CacheTtlResponse with TTL', () => {
        const response: CacheResponse = {
          type: 'ttl',
          response: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            ttlMs: 3600000,
            durationMs: cacheAdapterFactories.makeDurationMs(9),
          },
        };

        expect(response.type).toBe('ttl');
        expect(response.response.key).toBe('user:123');
        expect(response.response.ttlMs).toBe(3600000);
        expect(response.response.durationMs).toBe(9);
      });

      it('should create valid CacheTtlResponse with no TTL (-1)', () => {
        const response: CacheResponse = {
          type: 'ttl',
          response: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            ttlMs: -1,
            durationMs: cacheAdapterFactories.makeDurationMs(6),
          },
        };

        expect(response.type).toBe('ttl');
        expect(response.response.key).toBe('user:123');
        expect(response.response.ttlMs).toBe(-1);
        expect(response.response.durationMs).toBe(6);
      });

      it('should create valid CacheTtlResponse with key not found (-2)', () => {
        const response: CacheResponse = {
          type: 'ttl',
          response: {
            key: cacheAdapterFactories.makeCacheKey('user:123'),
            ttlMs: -2,
            durationMs: cacheAdapterFactories.makeDurationMs(4),
          },
        };

        expect(response.type).toBe('ttl');
        expect(response.response.key).toBe('user:123');
        expect(response.response.ttlMs).toBe(-2);
        expect(response.response.durationMs).toBe(4);
      });
    });
  });

  describe('CacheError', () => {
    describe('CacheConnectionError', () => {
      it('should create valid CacheConnectionError', () => {
        const error: CacheError = {
          _tag: 'CacheConnectionError',
          message: 'Connection refused',
          code: 'ECONNREFUSED',
        };

        expect(error._tag).toBe('CacheConnectionError');
        expect(error.message).toBe('Connection refused');
        expect(error.code).toBe('ECONNREFUSED');
      });

      it('should create valid CacheConnectionError without code', () => {
        const error: CacheError = {
          _tag: 'CacheConnectionError',
          message: 'Connection timeout',
        };

        expect(error._tag).toBe('CacheConnectionError');
        expect(error.message).toBe('Connection timeout');
        expect(error.code).toBeUndefined();
      });
    });

    describe('CacheTimeoutError', () => {
      it('should create valid CacheTimeoutError', () => {
        const error: CacheError = {
          _tag: 'CacheTimeoutError',
          timeoutMs: cacheAdapterFactories.makeTimeoutMs(5000),
        };

        expect(error._tag).toBe('CacheTimeoutError');
        expect(error.timeoutMs).toBe(5000);
      });
    });

    describe('CacheSerializationError', () => {
      it('should create valid CacheSerializationError', () => {
        const error: CacheError = {
          _tag: 'CacheSerializationError',
          message: 'Invalid JSON format',
        };

        expect(error._tag).toBe('CacheSerializationError');
        expect(error.message).toBe('Invalid JSON format');
      });
    });

    describe('CacheKeyNotFound', () => {
      it('should create valid CacheKeyNotFound', () => {
        const error: CacheError = {
          _tag: 'CacheKeyNotFound',
          key: cacheAdapterFactories.makeCacheKey('user:123'),
        };

        expect(error._tag).toBe('CacheKeyNotFound');
        expect(error.key).toBe('user:123');
      });
    });

    describe('CacheClusterError', () => {
      it('should create valid CacheClusterError with nodeId', () => {
        const error: CacheError = {
          _tag: 'CacheClusterError',
          message: 'Node unreachable',
          nodeId: cacheAdapterFactories.makeCacheNodeId('node-1'),
        };

        expect(error._tag).toBe('CacheClusterError');
        expect(error.message).toBe('Node unreachable');
        expect(error.nodeId).toBe('node-1');
      });

      it('should create valid CacheClusterError without nodeId', () => {
        const error: CacheError = {
          _tag: 'CacheClusterError',
          message: 'Cluster split brain',
        };

        expect(error._tag).toBe('CacheClusterError');
        expect(error.message).toBe('Cluster split brain');
        expect(error.nodeId).toBeUndefined();
      });
    });

    describe('CacheUnknownError', () => {
      it('should create valid CacheUnknownError', () => {
        const originalError = new Error('Something went wrong');
        const error: CacheError = {
          _tag: 'CacheUnknownError',
          original: originalError,
        };

        expect(error._tag).toBe('CacheUnknownError');
        expect(error.original).toBe(originalError);
      });
    });
  });

  describe('CacheStrategyDecision', () => {
    describe('success decision', () => {
      it('should create valid success decision', () => {
        const decision: CacheStrategyDecision = {
          type: 'success',
        };

        expect(decision.type).toBe('success');
      });
    });

    describe('retry decision', () => {
      it('should create valid retry decision with retryAfterMs', () => {
        const decision: CacheStrategyDecision = {
          type: 'retry',
          retryAfterMs: cacheAdapterFactories.makeTimeoutMs(1000),
        };

        expect(decision.type).toBe('retry');
        expect(decision.retryAfterMs).toBe(1000);
      });

      it('should create valid retry decision without retryAfterMs', () => {
        const decision: CacheStrategyDecision = {
          type: 'retry',
        };

        expect(decision.type).toBe('retry');
        expect(decision.retryAfterMs).toBeUndefined();
      });
    });

    describe('fail decision', () => {
      it('should create valid fail decision with circuit open', () => {
        const decision: CacheStrategyDecision = {
          type: 'fail',
          errorCode: INFRA_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED,
          openCircuit: true,
        };

        expect(decision.type).toBe('fail');
        if (decision.type === 'fail') {
          expect(decision.errorCode).toBe(INFRA_ERROR_CODES.INFRA_CACHE_CONNECTION_FAILED);
          expect(decision.openCircuit).toBe(true);
        }
      });

      it('should create valid fail decision without circuit open', () => {
        const decision: CacheStrategyDecision = {
          type: 'fail',
          errorCode: INFRA_ERROR_CODES.INFRA_CACHE_GET_FAILED,
          openCircuit: false,
        };

        expect(decision.type).toBe('fail');
        if (decision.type === 'fail') {
          expect(decision.errorCode).toBe(INFRA_ERROR_CODES.INFRA_CACHE_GET_FAILED);
          expect(decision.openCircuit).toBe(false);
        }
      });

      it('should create valid fail decision without openCircuit', () => {
        const decision: CacheStrategyDecision = {
          type: 'fail',
          errorCode: INFRA_ERROR_CODES.INFRA_CACHE_SET_FAILED,
        };

        expect(decision.type).toBe('fail');
        if (decision.type === 'fail') {
          expect(decision.errorCode).toBe(INFRA_ERROR_CODES.INFRA_CACHE_SET_FAILED);
          expect(decision.openCircuit).toBeUndefined();
        }
      });
    });

    describe('degrade decision', () => {
      it('should create valid degrade decision to database', () => {
        const decision: CacheStrategyDecision = {
          type: 'degrade',
          fallback: 'database',
          maxRetries: cacheAdapterFactories.makeMaxRetries(2),
        };

        expect(decision.type).toBe('degrade');
        expect(decision.fallback).toBe('database');
        expect(decision.maxRetries).toBe(2);
      });

      it('should create valid degrade decision to memory', () => {
        const decision: CacheStrategyDecision = {
          type: 'degrade',
          fallback: 'memory',
        };

        expect(decision.type).toBe('degrade');
        expect(decision.fallback).toBe('memory');
        expect(decision.maxRetries).toBeUndefined();
      });

      it('should create valid degrade decision to noop', () => {
        const decision: CacheStrategyDecision = {
          type: 'degrade',
          fallback: 'noop',
          maxRetries: cacheAdapterFactories.makeMaxRetries(0),
        };

        expect(decision.type).toBe('degrade');
        expect(decision.fallback).toBe('noop');
        expect(decision.maxRetries).toBe(0);
      });
    });
  });

  describe('CacheAdapterOptions', () => {
    it('should create valid CacheAdapterOptions with all fields', () => {
      const options: CacheAdapterOptions = {
        instanceId: cacheAdapterFactories.makeCacheInstanceId('cache-1'),
        timeoutMs: cacheAdapterFactories.makeTimeoutMs(10000),
        maxRetries: cacheAdapterFactories.makeMaxRetries(3),
        retryDelayMs: cacheAdapterFactories.makeTimeoutMs(500),
        circuitBreakerThreshold: cacheAdapterFactories.makeCircuitBreakerThreshold(5),
        circuitBreakerRecoveryMs: cacheAdapterFactories.makeTimeoutMs(30000),
        circuitBreakerEnabled: true,
        retriesEnabled: true,
        compressionEnabled: true,
        serializationFormat: 'json',
        clusterEnabled: true,
        clusterNodes: [
          cacheAdapterFactories.makeCacheNodeId('node-1'),
          cacheAdapterFactories.makeCacheNodeId('node-2'),
        ],
        metricsEnabled: true,
      };

      expect(options.instanceId).toBe('cache-1');
      expect(options.timeoutMs).toBe(10000);
      expect(options.maxRetries).toBe(3);
      expect(options.retryDelayMs).toBe(500);
      expect(options.circuitBreakerThreshold).toBe(5);
      expect(options.circuitBreakerRecoveryMs).toBe(30000);
      expect(options.circuitBreakerEnabled).toBe(true);
      expect(options.retriesEnabled).toBe(true);
      expect(options.compressionEnabled).toBe(true);
      expect(options.serializationFormat).toBe('json');
      expect(options.clusterEnabled).toBe(true);
      expect(options.clusterNodes).toEqual(['node-1', 'node-2']);
      expect(options.metricsEnabled).toBe(true);
    });

    it('should create valid CacheAdapterOptions with minimal fields', () => {
      const options: CacheAdapterOptions = {};

      expect(options.instanceId).toBeUndefined();
      expect(options.timeoutMs).toBeUndefined();
      expect(options.maxRetries).toBeUndefined();
      expect(options.retryDelayMs).toBeUndefined();
      expect(options.circuitBreakerThreshold).toBeUndefined();
      expect(options.circuitBreakerRecoveryMs).toBeUndefined();
      expect(options.circuitBreakerEnabled).toBeUndefined();
      expect(options.retriesEnabled).toBeUndefined();
      expect(options.compressionEnabled).toBeUndefined();
      expect(options.serializationFormat).toBeUndefined();
      expect(options.clusterEnabled).toBeUndefined();
      expect(options.clusterNodes).toBeUndefined();
      expect(options.metricsEnabled).toBeUndefined();
    });

    it('should handle different serialization formats', () => {
      const jsonOptions: CacheAdapterOptions = {
        serializationFormat: 'json',
      };
      expect(jsonOptions.serializationFormat).toBe('json');

      const msgpackOptions: CacheAdapterOptions = {
        serializationFormat: 'msgpack',
      };
      expect(msgpackOptions.serializationFormat).toBe('msgpack');

      const binaryOptions: CacheAdapterOptions = {
        serializationFormat: 'binary',
      };
      expect(binaryOptions.serializationFormat).toBe('binary');
    });

    it('should handle cluster configuration when clusterEnabled=false', () => {
      const options: CacheAdapterOptions = {
        clusterEnabled: false,
        clusterNodes: [
          cacheAdapterFactories.makeCacheNodeId('node-1'),
          cacheAdapterFactories.makeCacheNodeId('node-2'),
        ],
      };

      expect(options.clusterEnabled).toBe(false);
      expect(options.clusterNodes).toEqual(['node-1', 'node-2']);
      // clusterNodes is ignored when clusterEnabled=false (comment in types)
    });
  });

  describe('CacheAdapterContext', () => {
    it('should create valid CacheAdapterContext with all required fields', () => {
      const context: CacheAdapterContext = {
        instanceId: cacheAdapterFactories.makeCacheInstanceId('cache-1'),
        defaultTimeoutMs: cacheAdapterFactories.makeTimeoutMs(5000),
        defaultTtlMs: cacheAdapterFactories.makeCacheTtlMs(3600000),
        maxRetries: cacheAdapterFactories.makeMaxRetries(3),
      };

      expect(context.instanceId).toBe('cache-1');
      expect(context.defaultTimeoutMs).toBe(5000);
      expect(context.defaultTtlMs).toBe(3600000);
      expect(context.maxRetries).toBe(3);
    });

    it('should create valid CacheAdapterContext with only required fields', () => {
      const context: CacheAdapterContext = {
        instanceId: cacheAdapterFactories.makeCacheInstanceId('cache-1'),
      };

      expect(context.instanceId).toBe('cache-1');
      expect(context.defaultTimeoutMs).toBeUndefined();
      expect(context.defaultTtlMs).toBeUndefined();
      expect(context.maxRetries).toBeUndefined();
    });
  });

  describe('CacheAdapterFactories integration', () => {
    describe('CacheKey factory', () => {
      it('should create valid CacheKey', () => {
        const key = cacheAdapterFactories.makeCacheKey('test:key');
        expect(key).toBe('test:key');
      });

      it('should throw on empty key', () => {
        expect(() => cacheAdapterFactories.makeCacheKey('')).toThrow(
          'CacheKey must be a non-empty string',
        );
      });

      it('should throw on whitespace-only key', () => {
        expect(() => cacheAdapterFactories.makeCacheKey('   ')).toThrow(
          'CacheKey must be a non-empty string',
        );
      });
    });

    describe('CacheTtlMs factory', () => {
      it('should create valid CacheTtlMs', () => {
        const ttl = cacheAdapterFactories.makeCacheTtlMs(3600000);
        expect(ttl).toBe(3600000);
      });

      it('should throw on zero TTL', () => {
        expect(() => cacheAdapterFactories.makeCacheTtlMs(0)).toThrow(
          'CacheTtlMs must be a finite number between 1 and',
        );
      });

      it('should throw on negative TTL', () => {
        expect(() => cacheAdapterFactories.makeCacheTtlMs(-1000)).toThrow(
          'CacheTtlMs must be a finite number between 1 and',
        );
      });

      it('should throw on TTL too large', () => {
        expect(() => cacheAdapterFactories.makeCacheTtlMs(4000000000)).toThrow(
          'CacheTtlMs must be a finite number between 1 and',
        );
      });
    });

    describe('TimeoutMs factory', () => {
      it('should create valid TimeoutMs', () => {
        const timeout = cacheAdapterFactories.makeTimeoutMs(5000);
        expect(timeout).toBe(5000);
      });

      it('should throw on timeout too small', () => {
        expect(() => cacheAdapterFactories.makeTimeoutMs(50)).toThrow(
          'TimeoutMs must be a finite number between 100 and',
        );
      });

      it('should throw on timeout too large', () => {
        expect(() => cacheAdapterFactories.makeTimeoutMs(400000)).toThrow(
          'TimeoutMs must be a finite number between 100 and',
        );
      });
    });

    describe('DurationMs factory', () => {
      it('should create valid DurationMs', () => {
        const duration = cacheAdapterFactories.makeDurationMs(150);
        expect(duration).toBe(150);
      });

      it('should throw on negative duration', () => {
        expect(() => cacheAdapterFactories.makeDurationMs(-10)).toThrow(
          'DurationMs must be a non-negative finite number',
        );
      });

      it('should accept zero duration', () => {
        const duration = cacheAdapterFactories.makeDurationMs(0);
        expect(duration).toBe(0);
      });
    });

    describe('MaxRetries factory', () => {
      it('should create valid MaxRetries', () => {
        const retries = cacheAdapterFactories.makeMaxRetries(3);
        expect(retries).toBe(3);
      });

      it('should throw on negative retries', () => {
        expect(() => cacheAdapterFactories.makeMaxRetries(-1)).toThrow(
          'MaxRetries must be an integer between 0 and',
        );
      });

      it('should throw on retries too large', () => {
        expect(() => cacheAdapterFactories.makeMaxRetries(15)).toThrow(
          'MaxRetries must be an integer between 0 and',
        );
      });

      it('should throw on non-integer retries', () => {
        expect(() => cacheAdapterFactories.makeMaxRetries(2.5)).toThrow(
          'MaxRetries must be an integer between 0 and',
        );
      });
    });

    describe('CacheInstanceId factory', () => {
      it('should create valid CacheInstanceId', () => {
        const instanceId = cacheAdapterFactories.makeCacheInstanceId('cache-1');
        expect(instanceId).toBe('cache-1');
      });

      it('should throw on empty instanceId', () => {
        expect(() => cacheAdapterFactories.makeCacheInstanceId('')).toThrow(
          'CacheInstanceId must be a non-empty string',
        );
      });
    });

    describe('CacheNodeId factory', () => {
      it('should create valid CacheNodeId', () => {
        const nodeId = cacheAdapterFactories.makeCacheNodeId('node-1');
        expect(nodeId).toBe('node-1');
      });

      it('should throw on empty nodeId', () => {
        expect(() => cacheAdapterFactories.makeCacheNodeId('')).toThrow(
          'CacheNodeId must be a non-empty string',
        );
      });
    });

    describe('CacheCircuitBreakerKey factory', () => {
      it('should create valid CacheCircuitBreakerKey', () => {
        const key = cacheAdapterFactories.makeCacheCircuitBreakerKey('cache-1:get');
        expect(key).toBe('cache-1:get');
      });

      it('should throw on empty key', () => {
        expect(() => cacheAdapterFactories.makeCacheCircuitBreakerKey('')).toThrow(
          'CacheCircuitBreakerKey must be a non-empty string',
        );
      });
    });

    describe('CircuitBreakerThreshold factory', () => {
      it('should create valid CircuitBreakerThreshold', () => {
        const threshold = cacheAdapterFactories.makeCircuitBreakerThreshold(5);
        expect(threshold).toBe(5);
      });

      it('should throw on threshold too small', () => {
        expect(() => cacheAdapterFactories.makeCircuitBreakerThreshold(0)).toThrow(
          'CircuitBreakerThreshold must be an integer between 1 and',
        );
      });

      it('should throw on threshold too large', () => {
        expect(() => cacheAdapterFactories.makeCircuitBreakerThreshold(150)).toThrow(
          'CircuitBreakerThreshold must be an integer between 1 and',
        );
      });

      it('should throw on non-integer threshold', () => {
        expect(() => cacheAdapterFactories.makeCircuitBreakerThreshold(5.5)).toThrow(
          'CircuitBreakerThreshold must be an integer between 1 and',
        );
      });
    });

    describe('ValidationError class', () => {
      it('should create ValidationError with correct properties', () => {
        const error = new cacheAdapterFactories.ValidationError(
          'Test error',
          'testFactory',
          'invalid value',
        );

        expect(error.name).toBe('CacheAdapterValidationError');
        expect(error.message).toBe('[testFactory] Test error');
        expect(error.factory).toBe('testFactory');
        expect(error.value).toBe('invalid value');
      });
    });
  });
});
