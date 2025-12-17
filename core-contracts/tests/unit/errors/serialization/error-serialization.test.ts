/**
 * Golden tests для проверки стабильности Error Serialization ABI
 *
 * Эти тесты гарантируют, что форматы сериализации (HTTP, Log, Telemetry) остаются стабильными.
 * Любые изменения должны быть explicit и документированы через ADR.
 *
 * 🧱 Это ABI contracts, не просто функции:
 *  - HTTP responses должны быть совместимы с клиентами
 *  - Log formats должны быть совместимы с парсерами логов
 *  - Telemetry formats должны быть совместимы с observability системами
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createError } from '../../../../src/errors/base/BaseError.js'
import { ERROR_CODE } from '../../../../src/errors/base/ErrorCode.ts'
import { hasErrorCodeMeta, getErrorCodeMeta } from '../../../../src/errors/base/ErrorCodeMetaData.ts'
import {
  ERROR_SEVERITY,
  ERROR_CATEGORY,
  ERROR_ORIGIN
} from '../../../../src/errors/base/ErrorConstants.js'
import { createErrorMetadata } from '../../../../src/errors/base/ErrorMetadata.js'
import {
  toHttpErrorResponse,
  toLogErrorFormat,
  toTelemetryErrorFormat,
  getHttpStatusFromError,
  getGrpcStatusFromError,
  toGrpcErrorResponse
} from '../../../../src/errors/serialization/ErrorSerialization.js'

// Mock Date for stable timestamps in golden tests
const FIXED_DATE = new Date('2025-01-01T12:00:00.000Z')

describe('Error Serialization - Golden ABI Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })
  describe('HTTP Serialization (toHttpErrorResponse)', () => {
    it('should have stable HTTP response format - minimal error', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'User not found')
      const result = toHttpErrorResponse(error)

      expect(result).toMatchSnapshot()
      expect(result.status).toBe(404) // Status from metadata
    })

    it('should have stable HTTP response format - full metadata', () => {
      const error = createError(
        ERROR_CODE.APPLICATION_COMMAND_REJECTED,
        'Command rejected',
        createErrorMetadata({
          correlationId: 'req-123',
          tenantId: 'tenant-456',
          severity: ERROR_SEVERITY['HIGH'],
          category: ERROR_CATEGORY['VALIDATION'],
          origin: ERROR_ORIGIN['APPLICATION'],
          retryable: true,
          context: { userId: 'user-789', operation: 'create' }
        })
      )
      const result = toHttpErrorResponse(error)

      expect(result).toMatchSnapshot()
      expect(result.status).toBe(400) // Status from metadata
    })

    it('should have stable HTTP response format - with cause', () => {
      const cause = createError(ERROR_CODE.INFRA_NETWORK_ERROR, 'Network timeout')
      const error = createError(
        ERROR_CODE.APPLICATION_QUERY_FAILED,
        'Query failed',
        createErrorMetadata({
          cause,
          correlationId: 'req-999'
        })
      )
      const result = toHttpErrorResponse(error)

      expect(result).toMatchSnapshot()
      expect(result.status).toBe(500) // Status from metadata
    })

    it('should have stable HTTP response format - different error codes', () => {
      const error401 = createError(ERROR_CODE.SECURITY_UNAUTHORIZED, 'Unauthorized')
      const error403 = createError(ERROR_CODE.SECURITY_FORBIDDEN, 'Forbidden')
      const result401 = toHttpErrorResponse(error401)
      const result403 = toHttpErrorResponse(error403)

      expect(result401).toMatchSnapshot()
      expect(result403).toMatchSnapshot()
      expect(result401.status).toBe(401) // Status from metadata
      expect(result403.status).toBe(403) // Status from metadata
    })

    it('should have stable HTTP response format - all severity levels', () => {
      const severities = [
        ERROR_SEVERITY['CRITICAL'],
        ERROR_SEVERITY['HIGH'],
        ERROR_SEVERITY['MEDIUM'],
        ERROR_SEVERITY['LOW']
      ] as const

      const results = severities.map(severity => {
        const error = createError(
          ERROR_CODE.DOMAIN_INVARIANT_BROKEN,
          'Invariant broken',
          createErrorMetadata({ severity })
        )
        return toHttpErrorResponse(error)
      })

      expect(results).toMatchSnapshot()
    })
  })

  describe('Log Serialization (toLogErrorFormat)', () => {
    it('should have stable log format - minimal error', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'User not found')
      const result = toLogErrorFormat(error)

      expect(result).toMatchSnapshot()
    })

    it('should have stable log format - with context', () => {
      const error = createError(
        ERROR_CODE.APPLICATION_COMMAND_REJECTED,
        'Command rejected',
        createErrorMetadata({
          context: { userId: 'user-123', operation: 'update', details: { field: 'email' } },
          correlationId: 'req-456'
        })
      )
      const result = toLogErrorFormat(error, { includeContext: true })

      expect(result).toMatchSnapshot()
    })

    it('should have stable log format - with stack', () => {
      const errorObj = new Error('Original error')
      const baseError = createError(
        ERROR_CODE.INFRA_NETWORK_ERROR,
        'Network error',
        createErrorMetadata({
          cause: errorObj,
          correlationId: 'req-789'
        })
      )
      // Create a test object that includes stack (simulating runtime property)
      // BaseError is frozen, so we create a new object with stack property
      const errorWithStack = Object.create(baseError)
      Object.assign(errorWithStack, { stack: errorObj.stack })
      const result = toLogErrorFormat(errorWithStack as typeof baseError & { stack?: string }, {
        includeStack: true
      })

      expect(result).toMatchSnapshot()
    })

    it('should have stable log format - with context and stack', () => {
      const errorObj = new Error('Root cause')
      const baseError = createError(
        ERROR_CODE.APPLICATION_QUERY_FAILED,
        'Query failed',
        createErrorMetadata({
          cause: errorObj,
          context: { query: 'SELECT * FROM users', timeout: 5000 },
          correlationId: 'req-111'
        })
      )
      // Create a test object that includes stack (simulating runtime property)
      const errorWithStack = Object.create(baseError)
      Object.assign(errorWithStack, { stack: errorObj.stack })
      const result = toLogErrorFormat(errorWithStack as typeof baseError & { stack?: string }, {
        includeContext: true,
        includeStack: true
      })

      expect(result).toMatchSnapshot()
    })

    it('should have stable log format - without context and stack options', () => {
      const error = createError(
        ERROR_CODE.DOMAIN_INVALID_STATE,
        'Invalid state',
        createErrorMetadata({
          context: { state: 'invalid' },
          correlationId: 'req-222'
        })
      )
      // Note: even with context present, if includeContext is false, it should not be included
      const result = toLogErrorFormat(error, { includeContext: false, includeStack: false })

      expect(result).toMatchSnapshot()
    })

    it('should have stable log format - with cause chain', () => {
      const rootCause = createError(ERROR_CODE.INFRA_DATABASE_ERROR, 'DB connection failed')
      const cause = createError(
        ERROR_CODE.INFRA_NETWORK_ERROR,
        'Network timeout',
        createErrorMetadata({ cause: rootCause })
      )
      const error = createError(
        ERROR_CODE.APPLICATION_QUERY_FAILED,
        'Query failed',
        createErrorMetadata({
          cause,
          correlationId: 'req-333'
        })
      )
      const result = toLogErrorFormat(error, { includeContext: true })

      expect(result).toMatchSnapshot()
    })
  })

  describe('Telemetry Serialization (toTelemetryErrorFormat)', () => {
    it('should have stable telemetry format - minimal error', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'User not found')
      const result = toTelemetryErrorFormat(error)

      expect(result).toMatchSnapshot()
    })

    it('should have stable telemetry format - full metadata', () => {
      const error = createError(
        ERROR_CODE.APPLICATION_COMMAND_REJECTED,
        'Command rejected',
        createErrorMetadata({
          correlationId: 'req-123',
          tenantId: 'tenant-456',
          severity: ERROR_SEVERITY['CRITICAL'],
          category: ERROR_CATEGORY['AUTHENTICATION'],
          origin: ERROR_ORIGIN['SECURITY'],
          retryable: false
        })
      )
      const result = toTelemetryErrorFormat(error)

      expect(result).toMatchSnapshot()
    })

    it('should have stable telemetry format - with cause', () => {
      const cause = createError(ERROR_CODE.INFRA_NETWORK_ERROR, 'Network timeout')
      const error = createError(
        ERROR_CODE.APPLICATION_QUERY_FAILED,
        'Query failed',
        createErrorMetadata({
          cause,
          correlationId: 'req-444',
          tenantId: 'tenant-555'
        })
      )
      const result = toTelemetryErrorFormat(error)

      expect(result).toMatchSnapshot()
    })

    it('should have stable telemetry format - all severity levels', () => {
      const severities = [
        ERROR_SEVERITY['CRITICAL'],
        ERROR_SEVERITY['HIGH'],
        ERROR_SEVERITY['MEDIUM'],
        ERROR_SEVERITY['LOW']
      ] as const

      const results = severities.map(severity => {
        const error = createError(
          ERROR_CODE.DOMAIN_INVARIANT_BROKEN,
          'Invariant broken',
          createErrorMetadata({ severity, correlationId: `req-${severity}` })
        )
        return toTelemetryErrorFormat(error)
      })

      expect(results).toMatchSnapshot()
    })

    it('should have stable telemetry format - all categories', () => {
      const categories = [
        ERROR_CATEGORY['VALIDATION'],
        ERROR_CATEGORY['AUTHENTICATION'],
        ERROR_CATEGORY['AUTHORIZATION'],
        ERROR_CATEGORY['BUSINESS_LOGIC'],
        ERROR_CATEGORY['SYSTEM']
      ] as const

      const results = categories.map(category => {
        const error = createError(
          ERROR_CODE.DOMAIN_RULE_VIOLATION,
          'Rule violated',
          createErrorMetadata({ category, correlationId: `req-${category}` })
        )
        return toTelemetryErrorFormat(error)
      })

      expect(results).toMatchSnapshot()
    })

    it('should have stable telemetry format - all origins', () => {
      const origins = [
        ERROR_ORIGIN['DOMAIN'],
        ERROR_ORIGIN['APPLICATION'],
        ERROR_ORIGIN['INFRASTRUCTURE'],
        ERROR_ORIGIN['SECURITY']
      ] as const

      const results = origins.map(origin => {
        const error = createError(
          ERROR_CODE.DOMAIN_CONFLICT,
          'Conflict occurred',
          createErrorMetadata({ origin, correlationId: `req-${origin}` })
        )
        return toTelemetryErrorFormat(error)
      })

      expect(results).toMatchSnapshot()
    })

    it('should have stable telemetry format - without optional fields', () => {
      const error = createError(ERROR_CODE.INFRA_RESOURCE_UNAVAILABLE, 'Resource unavailable')
      const result = toTelemetryErrorFormat(error)

      // Verify format - метаданные из реестра могут включать category и origin
      expect(result).toMatchSnapshot()
      // category и origin могут быть из метаданных реестра
      // correlationId и tenantId должны отсутствовать, если не указаны в error
      expect(result).not.toHaveProperty('correlationId')
      expect(result).not.toHaveProperty('tenantId')
    })

    it('should have stable telemetry format - message intentionally omitted', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'This message should not appear')
      const result = toTelemetryErrorFormat(error)

      // Verify that message is NOT in telemetry format (high cardinality)
      expect(result).not.toHaveProperty('message')
      expect(result).toMatchSnapshot()
    })
  })

  describe('getHttpStatusFromError', () => {
    it('should return status from metadata', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
      const status = getHttpStatusFromError(error)
      expect(status).toBe(404)
    })

    it('should return status for different error codes', () => {
      const domainError = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
      const appError = createError(ERROR_CODE.APPLICATION_COMMAND_REJECTED, 'Command rejected')
      const infraError = createError(ERROR_CODE.INFRA_NETWORK_ERROR, 'Network error')
      const securityError = createError(ERROR_CODE.SECURITY_UNAUTHORIZED, 'Unauthorized')
      
      expect(getHttpStatusFromError(domainError)).toBe(404)
      expect(getHttpStatusFromError(appError)).toBe(400)
      expect(getHttpStatusFromError(infraError)).toBe(503)
      expect(getHttpStatusFromError(securityError)).toBe(401)
    })
  })

  describe('getGrpcStatusFromError', () => {
    it('should return gRPC status from metadata', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
      const status = getGrpcStatusFromError(error)
      expect(status).toBe(5) // NOT_FOUND
    })

    it('should return gRPC status for different error codes', () => {
      const domainError = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
      const appError = createError(ERROR_CODE.APPLICATION_COMMAND_REJECTED, 'Command rejected')
      const infraError = createError(ERROR_CODE.INFRA_NETWORK_ERROR, 'Network error')
      const securityError = createError(ERROR_CODE.SECURITY_UNAUTHORIZED, 'Unauthorized')
      
      expect(getGrpcStatusFromError(domainError)).toBe(5) // NOT_FOUND
      expect(getGrpcStatusFromError(appError)).toBe(3) // INVALID_ARGUMENT
      expect(getGrpcStatusFromError(infraError)).toBe(14) // UNAVAILABLE
      expect(getGrpcStatusFromError(securityError)).toBe(16) // UNAUTHENTICATED
    })
  })

  describe('toGrpcErrorResponse', () => {
    it('should convert error to gRPC response', () => {
      const error = createError(
        ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
        'Not found',
        createErrorMetadata({
          context: { userId: 'user-123' }
        })
      )
      const response = toGrpcErrorResponse(error)
      
      expect(response.code).toBe(5)
      expect(response.message).toBe('Not found')
      expect(response.details).toBeDefined()
    })

    it('should not include details when context is absent', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
      const response = toGrpcErrorResponse(error)
      
      expect(response.code).toBe(5)
      expect(response.message).toBe('Not found')
      expect(response.details).toBeUndefined()
    })
  })

  describe('Serialization edge cases', () => {
    it('should handle error without optional fields', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
      const httpResponse = toHttpErrorResponse(error)
      const logFormat = toLogErrorFormat(error)
      
      expect(httpResponse.body.error.code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND)
      expect(logFormat.error.code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND)
      // Проверяем, что optional поля не включены, если их нет
      expect(httpResponse.body.error.correlationId).toBeUndefined()
      expect(logFormat.error.correlationId).toBeUndefined()
    })

    it('should handle error with extreme metadata (large context)', () => {
      const largeContext = {
        userId: 'user-123',
        sessionId: 'session-456',
        requestId: 'req-789',
        traceId: 'trace-abc',
        spanId: 'span-def',
        metadata: {
          nested: {
            deep: {
              value: 'test'
            }
          }
        }
      }
      const error = createError(
        ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
        'Not found',
        { context: largeContext }
      )
      
      const httpResponse = toHttpErrorResponse(error)
      const logFormat = toLogErrorFormat(error, { includeContext: true })
      
      expect(httpResponse.body.error.code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND)
      expect(logFormat.context).toBeDefined()
    })

    it('should handle error with extreme metadata (large extra)', () => {
      const largeExtra = {
        debug: {
          stack: 'long stack trace...',
          variables: {
            var1: 'value1',
            var2: 'value2',
            var3: 'value3'
          }
        }
      }
      const error = createError(
        ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
        'Not found',
        { extra: largeExtra }
      )
      
      // Проверяем, что error создан с extra
      expect(error.extra).toBeDefined()
      // logFormat может не включать extra напрямую, но error должен иметь его
      expect((error.extra as typeof largeExtra).debug).toBeDefined()
    })

    it('should handle error with empty correlationId', () => {
      const error = createError(
        ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
        'Not found',
        { correlationId: '' }
      )
      
      const httpResponse = toHttpErrorResponse(error)
      
      // Пустая строка должна быть отфильтрована
      expect(httpResponse.body.error.correlationId).toBeUndefined()
    })

    it('should handle error with empty tenantId', () => {
      const error = createError(
        ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
        'Not found',
        { tenantId: '' }
      )
      
      const httpResponse = toHttpErrorResponse(error)
      
      // Пустая строка должна быть отфильтрована
      expect(httpResponse.body.error.tenantId).toBeUndefined()
    })
  })
})

describe('Error System - Exhaustive Guarantees', () => {
  it('should have all ERROR_CODE entries in ERROR_CODE_META', () => {
    const missingCodes: string[] = []
    for (const code of Object.values(ERROR_CODE) as string[]) {
      if (!hasErrorCodeMeta(code)) {
        missingCodes.push(code)
      }
    }
    
    expect(missingCodes).toEqual([])
  })

  it('should have all ERROR_CODE entries with required metadata fields', () => {
    const invalidCodes: Array<{ code: string; missing: string[] }> = []
    for (const code of Object.values(ERROR_CODE) as string[]) {
      const meta = getErrorCodeMeta(code)
      if (meta === undefined) {
        invalidCodes.push({ code, missing: ['meta'] })
        continue
      }
      
      const missing: string[] = []
      if (!meta.severity) missing.push('severity')
      if (!meta.category) missing.push('category')
      if (!meta.httpStatus) missing.push('httpStatus')
      if (!meta.grpcStatus) missing.push('grpcStatus')
      if (!meta.metrics) missing.push('metrics')
      if (!meta.semver) missing.push('semver')
      
      if (missing.length > 0) {
        invalidCodes.push({ code, missing })
      }
    }
    
    expect(invalidCodes).toEqual([])
  })
})

