/**
 * Unit tests для ErrorCodeMeta
 *
 * Тесты для проверки метаданных кодов ошибок, runtime guards и валидации.
 * 
 * ⚠️ Важно: Этот тест НЕ должен импортировать BaseError или ErrorCodeMetaData,
 * чтобы избежать циклических зависимостей при загрузке модулей.
 */

import { describe, it, expect } from 'vitest'

import { ERROR_CODE } from '../../../../src/errors/base/ErrorCode.js'
import {
  assertErrorCodeMeta,
  isErrorCodeMeta,
  createErrorCodeMetaWithDefaults,
  generateMetricName,
  DEFAULT_ERROR_CODE_META
} from '../../../../src/errors/base/ErrorCodeMeta.js'
import {
  getHttpStatusCategory,
  validateHttpStatusCode,
  isValidHttpStatusCode,
  isHttpStatusCode
} from '../../../../src/errors/base/ErrorCodeMeta.js'
import { ERROR_ORIGIN, ERROR_CATEGORY, ERROR_SEVERITY } from '../../../../src/errors/base/ErrorConstants.js'

import type { ErrorCodeMeta } from '../../../../src/errors/base/ErrorCodeMeta.js'

describe('ErrorCodeMeta', () => {
  describe('assertErrorCodeMeta', () => {
    it('should not throw for valid ErrorCodeMeta', () => {
      const validMeta: ErrorCodeMeta = {
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: {
          counter: 'domain_entity_test_total',
          histogram: 'domain_entity_test_duration_seconds'
        },
        semver: {
          add: 'MINOR',
          change: 'MAJOR',
          remove: 'MAJOR'
        }
      }

      expect(() => assertErrorCodeMeta(validMeta)).not.toThrow()
    })

    it('should throw for null', () => {
      expect(() => assertErrorCodeMeta(null)).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for undefined', () => {
      expect(() => assertErrorCodeMeta(undefined)).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for non-object values', () => {
      expect(() => assertErrorCodeMeta('string')).toThrow('Invalid ErrorCodeMeta')
      expect(() => assertErrorCodeMeta(123)).toThrow('Invalid ErrorCodeMeta')
      expect(() => assertErrorCodeMeta(true)).toThrow('Invalid ErrorCodeMeta')
      expect(() => assertErrorCodeMeta([])).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for object missing required fields', () => {
      expect(() => assertErrorCodeMeta({})).toThrow('Invalid ErrorCodeMeta')
      expect(() => assertErrorCodeMeta({ layer: ERROR_ORIGIN.DOMAIN })).toThrow('Invalid ErrorCodeMeta')
      expect(() => assertErrorCodeMeta({
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity'
      })).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for invalid layer', () => {
      const invalidMeta = {
        layer: 'invalid',
        kind: 'entity',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: {
          counter: 'test_total',
          histogram: 'test_duration_seconds'
        },
        semver: {
          add: 'MINOR',
          change: 'MAJOR',
          remove: 'MAJOR'
        }
      }

      expect(() => assertErrorCodeMeta(invalidMeta)).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for invalid severity', () => {
      const invalidMeta = {
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        severity: 'invalid',
        category: ERROR_CATEGORY.BUSINESS,
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: {
          counter: 'test_total',
          histogram: 'test_duration_seconds'
        },
        semver: {
          add: 'MINOR',
          change: 'MAJOR',
          remove: 'MAJOR'
        }
      }

      expect(() => assertErrorCodeMeta(invalidMeta)).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for invalid category', () => {
      const invalidMeta = {
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        severity: ERROR_SEVERITY.HIGH,
        category: 'invalid',
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: {
          counter: 'test_total',
          histogram: 'test_duration_seconds'
        },
        semver: {
          add: 'MINOR',
          change: 'MAJOR',
          remove: 'MAJOR'
        }
      }

      expect(() => assertErrorCodeMeta(invalidMeta)).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for invalid metrics', () => {
      const invalidMeta = {
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: null,
        semver: {
          add: 'MINOR',
          change: 'MAJOR',
          remove: 'MAJOR'
        }
      }

      expect(() => assertErrorCodeMeta(invalidMeta)).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for invalid metrics structure - counter not string', () => {
      const invalidMeta = {
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: {
          counter: 123, // should be string
          histogram: 'test_duration_seconds'
        },
        semver: {
          add: 'MINOR',
          change: 'MAJOR',
          remove: 'MAJOR'
        }
      }

      expect(() => assertErrorCodeMeta(invalidMeta)).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for invalid metrics structure - histogram not string', () => {
      const invalidMeta = {
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: {
          counter: 'test_total',
          histogram: 456 // should be string
        },
        semver: {
          add: 'MINOR',
          change: 'MAJOR',
          remove: 'MAJOR'
        }
      }

      expect(() => assertErrorCodeMeta(invalidMeta)).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for invalid semver - add not valid', () => {
      const invalidMeta = {
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: {
          counter: 'test_total',
          histogram: 'test_duration_seconds'
        },
        semver: {
          add: 'invalid', // should be PATCH, MINOR or MAJOR
          change: 'MAJOR',
          remove: 'MAJOR'
        }
      }

      expect(() => assertErrorCodeMeta(invalidMeta)).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for invalid semver - change not valid', () => {
      const invalidMeta = {
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: {
          counter: 'test_total',
          histogram: 'test_duration_seconds'
        },
        semver: {
          add: 'MINOR',
          change: 'invalid', // should be PATCH, MINOR or MAJOR
          remove: 'MAJOR'
        }
      }

      expect(() => assertErrorCodeMeta(invalidMeta)).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for invalid semver - remove not MAJOR', () => {
      const invalidMeta = {
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: {
          counter: 'test_total',
          histogram: 'test_duration_seconds'
        },
        semver: {
          add: 'MINOR',
          change: 'MAJOR',
          remove: 'MINOR' // should be MAJOR
        }
      }

      expect(() => assertErrorCodeMeta(invalidMeta)).toThrow('Invalid ErrorCodeMeta')
    })

    it('should throw for invalid semver - patch not valid', () => {
      const invalidMeta = {
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: {
          counter: 'test_total',
          histogram: 'test_duration_seconds'
        },
        semver: {
          add: 'MINOR',
          change: 'MAJOR',
          remove: 'MAJOR',
          patch: 'MAJOR' // should be PATCH or MINOR
        }
      }

      expect(() => assertErrorCodeMeta(invalidMeta)).toThrow('Invalid ErrorCodeMeta')
    })

    it('should allow optional description field', () => {
      const validMetaWithDescription: ErrorCodeMeta = {
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: {
          counter: 'test_total',
          histogram: 'test_duration_seconds'
        },
        semver: {
          add: 'MINOR',
          change: 'MAJOR',
          remove: 'MAJOR'
        },
        description: 'Optional description'
      }

      expect(() => assertErrorCodeMeta(validMetaWithDescription)).not.toThrow()
    })
  })

  describe('isErrorCodeMeta', () => {
    it('should return true for valid ErrorCodeMeta', () => {
      const validMeta: ErrorCodeMeta = {
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        retryable: false,
        recoverable: true,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: {
          counter: 'test_total',
          histogram: 'test_duration_seconds'
        },
        semver: {
          add: 'MINOR',
          change: 'MAJOR',
          remove: 'MAJOR'
        }
      }

      expect(isErrorCodeMeta(validMeta)).toBe(true)
    })

    it('should return false for invalid values', () => {
      expect(isErrorCodeMeta(null)).toBe(false)
      expect(isErrorCodeMeta(undefined)).toBe(false)
      expect(isErrorCodeMeta('string')).toBe(false)
      expect(isErrorCodeMeta(123)).toBe(false)
      expect(isErrorCodeMeta({})).toBe(false)
    })
  })

  describe('createErrorCodeMetaWithDefaults', () => {
    it('should create meta with defaults applied', () => {
      const meta = createErrorCodeMetaWithDefaults({
        layer: ERROR_ORIGIN.DOMAIN,
        kind: 'entity',
        category: ERROR_CATEGORY.BUSINESS,
        httpStatus: 404,
        grpcStatus: 5,
        metrics: generateMetricName(ERROR_ORIGIN.DOMAIN, 'entity', ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND)
      })

      expect(meta.severity).toBe(DEFAULT_ERROR_CODE_META.severity)
      expect(meta.retryable).toBe(DEFAULT_ERROR_CODE_META.retryable)
      expect(meta.recoverable).toBe(DEFAULT_ERROR_CODE_META.recoverable)
      expect(meta.httpStatus).toBe(404)
      expect(meta.grpcStatus).toBe(5)
    })

    it('should throw if metrics is missing', () => {
      expect(() => {
        createErrorCodeMetaWithDefaults({
          layer: ERROR_ORIGIN.DOMAIN,
          kind: 'entity',
          category: ERROR_CATEGORY.BUSINESS,
          httpStatus: 404,
          grpcStatus: 5,
          // @ts-expect-error - intentionally missing metrics for test
          metrics: undefined
        })
      }).toThrow('createErrorCodeMetaWithDefaults: metrics is required and must be a valid ErrorMetrics object')
    })

    it('should throw if metrics is invalid', () => {
      expect(() => {
        createErrorCodeMetaWithDefaults({
          layer: ERROR_ORIGIN.DOMAIN,
          kind: 'entity',
          category: ERROR_CATEGORY.BUSINESS,
          httpStatus: 404,
          grpcStatus: 5,
          // @ts-expect-error - intentionally invalid metrics for test
          metrics: { counter: 123, histogram: 'test' }
        })
      }).toThrow('createErrorCodeMetaWithDefaults: metrics is required and must be a valid ErrorMetrics object')
    })
  })

  describe('HTTP Status utilities', () => {
    describe('isValidHttpStatusCode', () => {
      it('should return true for valid status codes', () => {
        expect(isValidHttpStatusCode(200)).toBe(true)
        expect(isValidHttpStatusCode(404)).toBe(true)
        expect(isValidHttpStatusCode(500)).toBe(true)
        expect(isValidHttpStatusCode(100)).toBe(true)
        expect(isValidHttpStatusCode(599)).toBe(true)
      })

      it('should return false for invalid status codes', () => {
        expect(isValidHttpStatusCode(99)).toBe(false)
        expect(isValidHttpStatusCode(600)).toBe(false)
        expect(isValidHttpStatusCode(-1)).toBe(false)
        expect(isValidHttpStatusCode(1.5)).toBe(false)
      })
    })

    describe('isHttpStatusCode', () => {
      it('should return true for valid status codes', () => {
        expect(isHttpStatusCode(200)).toBe(true)
        expect(isHttpStatusCode(404)).toBe(true)
      })

      it('should return false for invalid values', () => {
        expect(isHttpStatusCode('200')).toBe(false)
        expect(isHttpStatusCode(null)).toBe(false)
        expect(isHttpStatusCode(undefined)).toBe(false)
        expect(isHttpStatusCode(99)).toBe(false)
      })
    })

    describe('getHttpStatusCategory', () => {
      it('should return informational for 1xx codes', () => {
        expect(getHttpStatusCategory(100)).toBe('informational')
        expect(getHttpStatusCategory(199)).toBe('informational')
      })

      it('should return success for 2xx codes', () => {
        expect(getHttpStatusCategory(200)).toBe('success')
        expect(getHttpStatusCategory(299)).toBe('success')
      })

      it('should return redirect for 3xx codes', () => {
        expect(getHttpStatusCategory(300)).toBe('redirect')
        expect(getHttpStatusCategory(399)).toBe('redirect')
      })

      it('should return client for 4xx codes', () => {
        expect(getHttpStatusCategory(400)).toBe('client')
        expect(getHttpStatusCategory(499)).toBe('client')
      })

      it('should return server for 5xx codes', () => {
        expect(getHttpStatusCategory(500)).toBe('server')
        expect(getHttpStatusCategory(599)).toBe('server')
      })

      it('should return undefined for invalid codes', () => {
        expect(getHttpStatusCategory(99)).toBeUndefined()
        expect(getHttpStatusCategory(600)).toBeUndefined()
      })
    })

    describe('validateHttpStatusCode', () => {
      it('should return valid for valid status codes', () => {
        const result = validateHttpStatusCode(200)
        expect(result.valid).toBe(true)
        if (result.valid) {
          expect(result.value).toBe(200)
        }
      })

      it('should return invalid for non-number values', () => {
        const result = validateHttpStatusCode('200')
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.reason).toBe('TypeMismatch')
        }
      })

      it('should return invalid for out of range values', () => {
        const result = validateHttpStatusCode(600)
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.reason).toBe('OutOfRange')
        }
      })

      it('should return invalid for NaN values', () => {
        const result = validateHttpStatusCode(NaN)
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.reason).toBe('TypeMismatch')
        }
      })

      it('should return invalid for non-integer values', () => {
        const result = validateHttpStatusCode(200.5)
        expect(result.valid).toBe(false)
        if (!result.valid) {
          expect(result.reason).toBe('TypeMismatch')
        }
      })
    })
  })
})
