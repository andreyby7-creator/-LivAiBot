/**
 * Unit tests для SecurityErrorMeta
 */

import { describe, it, expect } from 'vitest'

import { ERROR_SEVERITY, ERROR_CATEGORY } from '../../../../src/errors/base/ErrorConstants.js'
import {
  createUnauthorizedError,
  createTokenExpiredError,
  createRateLimitedError
} from '../../../../src/errors/security/SecurityError.js'
import {
  getSecurityErrorMeta,
  getSecurityErrorMetaOrThrow,
  isSecurityErrorRetryable,
  isSecurityErrorRecoverable,
  getSecurityErrorSeverity,
  getSecurityErrorCategory
} from '../../../../src/errors/security/SecurityErrorMeta.js'

describe('SecurityErrorMeta', () => {
  describe('getSecurityErrorMeta', () => {
    it('should return metadata for security errors', () => {
      const error = createUnauthorizedError({})
      const meta = getSecurityErrorMeta(error)
      expect(meta).toBeDefined()
      expect(meta?.layer).toBe('security')
    })
  })

  describe('isSecurityErrorRetryable', () => {
    it('should return false for UnauthorizedError', () => {
      const error = createUnauthorizedError({})
      expect(isSecurityErrorRetryable(error)).toBe(false)
    })

    it('should return true for RateLimitedError', () => {
      const error = createRateLimitedError({ limit: 10, windowMs: 1000 })
      expect(isSecurityErrorRetryable(error)).toBe(true)
    })
  })

  describe('isSecurityErrorRecoverable', () => {
    it('should return true for TokenExpiredError', () => {
      const error = createTokenExpiredError({})
      expect(isSecurityErrorRecoverable(error)).toBe(true)
    })
  })

  describe('getSecurityErrorSeverity', () => {
    it('should return HIGH severity for UnauthorizedError', () => {
      const error = createUnauthorizedError({})
      const severity = getSecurityErrorSeverity(error)
      expect(severity).toBe(ERROR_SEVERITY.HIGH)
    })
  })

  describe('getSecurityErrorCategory', () => {
    it('should return AUTHORIZATION category', () => {
      const error = createUnauthorizedError({})
      const category = getSecurityErrorCategory(error)
      expect(category).toBe(ERROR_CATEGORY.AUTHORIZATION)
    })
  })

  describe('getSecurityErrorMetaOrThrow', () => {
    it('should return metadata for valid errors', () => {
      const error = createUnauthorizedError({})
      const meta = getSecurityErrorMetaOrThrow(error)
      expect(meta).toBeDefined()
      expect(meta.layer).toBe('security')
    })
  })
})
