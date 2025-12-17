/**
 * Unit tests для ValidationErrorMeta
 */

import { describe, it, expect } from 'vitest'

import { ERROR_SEVERITY, ERROR_CATEGORY } from '../../../../src/errors/base/ErrorConstants.js'
import {
  createValidationFailedError,
  createSchemaMismatchError
} from '../../../../src/errors/validation/ValidationError.js'
import {
  getValidationErrorMeta,
  isValidationErrorRetryable,
  isValidationErrorRecoverable,
  getValidationErrorSeverity,
  getValidationErrorCategory
} from '../../../../src/errors/validation/ValidationErrorMeta.js'

describe('ValidationErrorMeta', () => {
  describe('getValidationErrorMeta', () => {
    it('should return metadata for validation errors', () => {
      const error = createValidationFailedError({ field: 'test' })
      const meta = getValidationErrorMeta(error)
      expect(meta).toBeDefined()
      expect(meta?.category).toBe(ERROR_CATEGORY.VALIDATION)
    })
  })

  describe('isValidationErrorRetryable', () => {
    it('should return false for validation errors', () => {
      const error = createValidationFailedError({ field: 'test' })
      expect(isValidationErrorRetryable(error)).toBe(false)
    })
  })

  describe('isValidationErrorRecoverable', () => {
    it('should return true for validation errors', () => {
      const error = createValidationFailedError({ field: 'test' })
      expect(isValidationErrorRecoverable(error)).toBe(true)
    })
  })

  describe('getValidationErrorSeverity', () => {
    it('should return MEDIUM severity', () => {
      const error = createSchemaMismatchError({ expected: 'string', actual: 'number' })
      const severity = getValidationErrorSeverity(error)
      expect(severity).toBe(ERROR_SEVERITY.MEDIUM)
    })
  })

  describe('getValidationErrorCategory', () => {
    it('should return VALIDATION category', () => {
      const error = createValidationFailedError({ field: 'test' })
      const category = getValidationErrorCategory(error)
      expect(category).toBe(ERROR_CATEGORY.VALIDATION)
    })
  })
})
