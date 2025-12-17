/**
 * Unit tests для ErrorCodeMetaData
 *
 * Тесты для проверки полноты реестра метаданных, helpers и валидации.
 */

import { describe, it, expect } from 'vitest'

import { ERROR_CODE } from '../../../../src/errors/base/ErrorCode.js'
import { isErrorCodeMeta } from '../../../../src/errors/base/ErrorCodeMeta.js'
import {
  ERROR_CODE_META,
  getErrorCodeMeta,
  hasErrorCodeMeta,
  getErrorCodeMetaOrThrow
} from '../../../../src/errors/base/ErrorCodeMetaData.js'
import {
  ERROR_SEVERITY,
  ERROR_CATEGORY,
  ERROR_ORIGIN
} from '../../../../src/errors/base/ErrorConstants.js'

import type { ErrorCode } from '../../../../src/errors/base/ErrorCode.js'

describe('ErrorCodeMetaData', () => {
  describe('ERROR_CODE_META registry completeness', () => {
    it('should have metadata for all error codes', () => {
      const errorCodes = Object.values(ERROR_CODE) as ErrorCode[]
      
      errorCodes.forEach(code => {
        expect(hasErrorCodeMeta(code)).toBe(true)
        expect(ERROR_CODE_META[code]).toBeDefined()
      })
    })

    it('should have no extra codes in registry', () => {
      const errorCodes = Object.values(ERROR_CODE) as ErrorCode[]
      const registryCodes = Object.keys(ERROR_CODE_META) as ErrorCode[]
      
      // Все коды в реестре должны быть в ERROR_CODE
      registryCodes.forEach(code => {
        expect(errorCodes).toContain(code)
      })
    })

    it('should have valid ErrorCodeMeta structure for all codes', () => {
      const errorCodes = Object.values(ERROR_CODE) as ErrorCode[]
      
      errorCodes.forEach(code => {
        const meta = ERROR_CODE_META[code]
        expect(meta).toBeDefined()
        expect(isErrorCodeMeta(meta)).toBe(true)
      })
    })
  })

  describe('getErrorCodeMeta', () => {
    it('should return metadata for valid error codes', () => {
      const code = ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND as ErrorCode
      const meta = getErrorCodeMeta(code)
      
      expect(meta).toBeDefined()
      expect(isErrorCodeMeta(meta)).toBe(true)
    })

    it('should return undefined for invalid codes', () => {
      // Используем type assertion для тестирования edge case
      const invalidCode = 'INVALID_CODE' as ErrorCode
      const meta = getErrorCodeMeta(invalidCode)
      
      expect(meta).toBeUndefined()
    })

    it('should return correct metadata for domain errors', () => {
      const code = ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND as ErrorCode
      const meta = getErrorCodeMeta(code)
      
      expect(meta).toBeDefined()
      expect(meta?.layer).toBe(ERROR_ORIGIN.DOMAIN)
      expect(meta?.category).toBe(ERROR_CATEGORY.BUSINESS)
      expect(meta?.httpStatus).toBe(404)
      expect(meta?.grpcStatus).toBe(5)
    })

    it('should return correct metadata for application errors', () => {
      const code = ERROR_CODE.APPLICATION_COMMAND_REJECTED as ErrorCode
      const meta = getErrorCodeMeta(code)
      
      expect(meta).toBeDefined()
      expect(meta?.layer).toBe(ERROR_ORIGIN.APPLICATION)
      expect(meta?.category).toBe(ERROR_CATEGORY.BUSINESS)
    })

    it('should return correct metadata for infrastructure errors', () => {
      const code = ERROR_CODE.INFRA_NETWORK_ERROR as ErrorCode
      const meta = getErrorCodeMeta(code)
      
      expect(meta).toBeDefined()
      expect(meta?.layer).toBe(ERROR_ORIGIN.INFRASTRUCTURE)
      expect(meta?.category).toBe(ERROR_CATEGORY.INFRASTRUCTURE)
      expect(meta?.retryable).toBe(true)
    })

    it('should return correct metadata for security errors', () => {
      const code = ERROR_CODE.SECURITY_UNAUTHORIZED as ErrorCode
      const meta = getErrorCodeMeta(code)
      
      expect(meta).toBeDefined()
      expect(meta?.layer).toBe(ERROR_ORIGIN.SECURITY)
      expect(meta?.category).toBe(ERROR_CATEGORY.AUTHORIZATION)
      expect(meta?.httpStatus).toBe(401)
    })

    it('should return correct metadata for validation errors', () => {
      const code = ERROR_CODE.VALIDATION_FAILED as ErrorCode
      const meta = getErrorCodeMeta(code)
      
      expect(meta).toBeDefined()
      expect(meta?.layer).toBe(ERROR_ORIGIN.APPLICATION)
      expect(meta?.category).toBe(ERROR_CATEGORY.VALIDATION)
    })
  })

  describe('hasErrorCodeMeta', () => {
    it('should return true for codes in registry', () => {
      const codes = Object.values(ERROR_CODE) as ErrorCode[]
      
      codes.forEach(code => {
        expect(hasErrorCodeMeta(code)).toBe(true)
      })
    })

    it('should return false for invalid codes', () => {
      const invalidCode = 'INVALID_CODE' as ErrorCode
      expect(hasErrorCodeMeta(invalidCode)).toBe(false)
    })
  })

  describe('getErrorCodeMetaOrThrow', () => {
    it('should return metadata for valid codes', () => {
      const code = ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND as ErrorCode
      const meta = getErrorCodeMetaOrThrow(code)
      
      expect(meta).toBeDefined()
      expect(isErrorCodeMeta(meta)).toBe(true)
    })

    it('should throw error for invalid codes', () => {
      const invalidCode = 'INVALID_CODE' as ErrorCode
      
      expect(() => {
        getErrorCodeMetaOrThrow(invalidCode)
      }).toThrow('ErrorCodeMeta not found for code')
    })
  })

  describe('Metadata structure validation', () => {
    it('should have valid layer for all codes', () => {
      const codes = Object.values(ERROR_CODE) as ErrorCode[]
      
      codes.forEach(code => {
        const meta = ERROR_CODE_META[code]
        expect(meta.layer).toBeDefined()
        expect([
          ERROR_ORIGIN.DOMAIN,
          ERROR_ORIGIN.APPLICATION,
          ERROR_ORIGIN.INFRASTRUCTURE,
          ERROR_ORIGIN.SECURITY
        ]).toContain(meta.layer)
      })
    })

    it('should have valid severity for all codes', () => {
      const codes = Object.values(ERROR_CODE) as ErrorCode[]
      
      codes.forEach(code => {
        const meta = ERROR_CODE_META[code]
        expect(meta.severity).toBeDefined()
        expect([
          ERROR_SEVERITY.LOW,
          ERROR_SEVERITY.MEDIUM,
          ERROR_SEVERITY.HIGH,
          ERROR_SEVERITY.CRITICAL
        ]).toContain(meta.severity)
      })
    })

    it('should have valid category for all codes', () => {
      const codes = Object.values(ERROR_CODE) as ErrorCode[]
      
      codes.forEach(code => {
        const meta = ERROR_CODE_META[code]
        expect(meta.category).toBeDefined()
        expect([
          ERROR_CATEGORY.VALIDATION,
          ERROR_CATEGORY.AUTHORIZATION,
          ERROR_CATEGORY.BUSINESS,
          ERROR_CATEGORY.INFRASTRUCTURE,
          ERROR_CATEGORY.UNKNOWN
        ]).toContain(meta.category)
      })
    })

    it('should have valid httpStatus for all codes', () => {
      const codes = Object.values(ERROR_CODE) as ErrorCode[]
      
      codes.forEach(code => {
        const meta = ERROR_CODE_META[code]
        expect(meta.httpStatus).toBeDefined()
        expect(typeof meta.httpStatus).toBe('number')
        expect(meta.httpStatus).toBeGreaterThanOrEqual(100)
        expect(meta.httpStatus).toBeLessThanOrEqual(599)
      })
    })

    it('should have valid grpcStatus for all codes', () => {
      const codes = Object.values(ERROR_CODE) as ErrorCode[]
      
      codes.forEach(code => {
        const meta = ERROR_CODE_META[code]
        expect(meta.grpcStatus).toBeDefined()
        expect(typeof meta.grpcStatus).toBe('number')
        expect(meta.grpcStatus).toBeGreaterThanOrEqual(0)
        expect(meta.grpcStatus).toBeLessThanOrEqual(16)
      })
    })

    it('should have valid metrics for all codes', () => {
      const codes = Object.values(ERROR_CODE) as ErrorCode[]
      
      codes.forEach(code => {
        const meta = ERROR_CODE_META[code]
        expect(meta.metrics).toBeDefined()
        expect(meta.metrics.counter).toBeDefined()
        expect(meta.metrics.histogram).toBeDefined()
        expect(typeof meta.metrics.counter).toBe('string')
        expect(typeof meta.metrics.histogram).toBe('string')
        expect(meta.metrics.counter.length).toBeGreaterThan(0)
        expect(meta.metrics.histogram.length).toBeGreaterThan(0)
      })
    })

    it('should have valid retryable flag for all codes', () => {
      const codes = Object.values(ERROR_CODE) as ErrorCode[]
      
      codes.forEach(code => {
        const meta = ERROR_CODE_META[code]
        expect(typeof meta.retryable).toBe('boolean')
      })
    })

    it('should have valid recoverable flag for all codes', () => {
      const codes = Object.values(ERROR_CODE) as ErrorCode[]
      
      codes.forEach(code => {
        const meta = ERROR_CODE_META[code]
        expect(typeof meta.recoverable).toBe('boolean')
      })
    })

    it('should have valid semver policy for all codes', () => {
      const codes = Object.values(ERROR_CODE) as ErrorCode[]
      
      codes.forEach(code => {
        const meta = ERROR_CODE_META[code]
        expect(meta.semver).toBeDefined()
        expect(['PATCH', 'MINOR', 'MAJOR']).toContain(meta.semver.add)
        expect(['PATCH', 'MINOR', 'MAJOR']).toContain(meta.semver.change)
        expect(meta.semver.remove).toBe('MAJOR')
      })
    })
  })

  describe('Domain-specific metadata validation', () => {
    it('should have correct metadata for DOMAIN_ENTITY_NOT_FOUND', () => {
      const code = ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND as ErrorCode
      const meta = ERROR_CODE_META[code]
      
      expect(meta.layer).toBe(ERROR_ORIGIN.DOMAIN)
      expect(meta.kind).toBe('entity')
      expect(meta.severity).toBe(ERROR_SEVERITY.HIGH)
      expect(meta.httpStatus).toBe(404)
      expect(meta.grpcStatus).toBe(5)
      expect(meta.retryable).toBe(false)
      expect(meta.recoverable).toBe(true)
    })

    it('should have correct metadata for DOMAIN_INVARIANT_BROKEN', () => {
      const code = ERROR_CODE.DOMAIN_INVARIANT_BROKEN as ErrorCode
      const meta = ERROR_CODE_META[code]
      
      expect(meta.layer).toBe(ERROR_ORIGIN.DOMAIN)
      expect(meta.severity).toBe(ERROR_SEVERITY.CRITICAL)
      expect(meta.retryable).toBe(false)
      expect(meta.recoverable).toBe(false)
    })

    it('should have correct metadata for INFRA_NETWORK_ERROR', () => {
      const code = ERROR_CODE.INFRA_NETWORK_ERROR as ErrorCode
      const meta = ERROR_CODE_META[code]
      
      expect(meta.layer).toBe(ERROR_ORIGIN.INFRASTRUCTURE)
      expect(meta.kind).toBe('network')
      expect(meta.httpStatus).toBe(503)
      expect(meta.grpcStatus).toBe(14)
      expect(meta.retryable).toBe(true)
    })

    it('should have correct metadata for SECURITY_UNAUTHORIZED', () => {
      const code = ERROR_CODE.SECURITY_UNAUTHORIZED as ErrorCode
      const meta = ERROR_CODE_META[code]
      
      expect(meta.layer).toBe(ERROR_ORIGIN.SECURITY)
      expect(meta.category).toBe(ERROR_CATEGORY.AUTHORIZATION)
      expect(meta.httpStatus).toBe(401)
      expect(meta.grpcStatus).toBe(16)
      expect(meta.retryable).toBe(false)
    })
  })

  describe('Metrics format validation', () => {
    it('should have consistent metrics naming format', () => {
      const codes = Object.values(ERROR_CODE) as ErrorCode[]
      
      codes.forEach(code => {
        const meta = ERROR_CODE_META[code]
        const counter = meta.metrics.counter
        const histogram = meta.metrics.histogram
        
        // Counter должен заканчиваться на _total
        expect(counter.endsWith('_total')).toBe(true)
        
        // Histogram должен заканчиваться на _duration_seconds
        expect(histogram.endsWith('_duration_seconds')).toBe(true)
        
        // Оба должны содержать layer и kind
        expect(counter.includes(meta.layer)).toBe(true)
        expect(histogram.includes(meta.layer)).toBe(true)
      })
    })
  })

  describe('Immutability', () => {
    it('should have frozen registry', () => {
      // Попытка мутации должна быть заблокирована на runtime
      expect(() => {
        ;(ERROR_CODE_META as Record<string, unknown>).NEW_CODE = {}
      }).toThrow() // Object.freeze выбрасывает ошибку в strict mode
      
      // Проверяем, что значение не изменилось
      expect((ERROR_CODE_META as Record<string, unknown>).NEW_CODE).toBeUndefined()
    })
  })
})
