/**
 * Unit tests для ValidationError
 */

import { describe, it, expect } from 'vitest'

import { ERROR_CODE } from '../../../../src/errors/base/ErrorCode.js'
import { isBaseError } from '../../../../src/errors/base/ErrorUtils.js'
import {
  createValidationFailedError,
  createSchemaMismatchError,
  createRequiredFieldMissingError,
  matchValidationError,
  mapVal,
  flatMapVal,
  left,
  right,
  isLeft,
  isRight
} from '../../../../src/errors/validation/ValidationError.js'

import type { ValidationError } from '../../../../src/errors/validation/ValidationError.js'

describe('ValidationError', () => {
  describe('createValidationFailedError', () => {
    it('should create ValidationFailedError with correct structure', () => {
      const error = createValidationFailedError({
        field: 'email',
        value: 'invalid'
      })
      
      expect(error._tag).toBe('ValidationFailed')
      expect(error.field).toBe('email')
      expect(error.value).toBe('invalid')
      expect(error.code).toBe(ERROR_CODE.VALIDATION_FAILED)
      expect(isBaseError(error)).toBe(true)
    })

    it('should include violations when provided', () => {
      const error = createValidationFailedError({
        violations: [
          { field: 'email', message: 'Invalid format' },
          { field: 'password', message: 'Too short' }
        ]
      })
      
      expect(error.violations).toBeDefined()
      expect(error.violations).toHaveLength(2)
    })

    it('should include reason when provided', () => {
      const error = createValidationFailedError({
        field: 'email',
        reason: 'Invalid email format'
      })
      
      expect(error.reason).toBe('Invalid email format')
    })
  })

  describe('createSchemaMismatchError', () => {
    it('should create SchemaMismatchError with correct structure', () => {
      const error = createSchemaMismatchError({
        expected: 'string',
        actual: 'number'
      })
      
      expect(error._tag).toBe('SchemaMismatch')
      expect(error.expected).toBe('string')
      expect(error.actual).toBe('number')
      expect(error.code).toBe(ERROR_CODE.VALIDATION_SCHEMA_MISMATCH)
    })

    it('should include path when provided', () => {
      const error = createSchemaMismatchError({
        expected: 'string',
        actual: 'number',
        path: 'user.email'
      })
      
      expect(error.path).toBe('user.email')
    })
  })

  describe('createRequiredFieldMissingError', () => {
    it('should create RequiredFieldMissingError with correct structure', () => {
      const error = createRequiredFieldMissingError({
        field: 'username'
      })
      
      expect(error._tag).toBe('RequiredFieldMissing')
      expect(error.field).toBe('username')
      expect(error.code).toBe(ERROR_CODE.VALIDATION_REQUIRED_FIELD_MISSING)
    })

    it('should include expectedType when provided', () => {
      const error = createRequiredFieldMissingError({
        field: 'age',
        expectedType: 'number'
      })
      
      expect(error.expectedType).toBe('number')
    })
  })

  describe('matchValidationError', () => {
    it('should match all error types', () => {
      const errors: ValidationError[] = [
        createValidationFailedError({ field: 'test' }),
        createSchemaMismatchError({ expected: 'string', actual: 'number' }),
        createRequiredFieldMissingError({ field: 'test' })
      ]
      
      errors.forEach(error => {
        const result = matchValidationError(error, {
          validationFailed: () => 'failed',
          schemaMismatch: () => 'mismatch',
          requiredFieldMissing: () => 'missing'
        })
        expect(typeof result).toBe('string')
      })
    })
  })

  describe('Either helpers', () => {
    it('should mapVal transform Right value', () => {
      const either = right(10)
      const mapped = mapVal(either, (x) => x * 2)
      
      expect(isRight(mapped)).toBe(true)
      if (isRight(mapped)) {
        expect(mapped.right).toBe(20)
      }
    })

    it('should mapVal preserve Left error', () => {
      const error = createValidationFailedError({ field: 'test' })
      const either = left(error)
      const mapped = mapVal(either, (x) => x * 2)
      
      expect(isLeft(mapped)).toBe(true)
    })

    it('should flatMapVal chain Right values', () => {
      const either = right(10)
      const chained = flatMapVal(either, (x) => right(x * 2))
      
      expect(isRight(chained)).toBe(true)
      if (isRight(chained)) {
        expect(chained.right).toBe(20)
      }
    })

    it('should flatMapVal preserve Left error', () => {
      const error = createValidationFailedError({ field: 'test' })
      const either = left(error)
      const chained = flatMapVal(either, (x) => right(x * 2))
      
      expect(isLeft(chained)).toBe(true)
    })
  })
})
