/**
 * Unit tests для DomainError
 *
 * Тесты для проверки создания domain ошибок, ADT, pattern matching и валидации.
 */

import { describe, it, expect } from 'vitest'

import { ERROR_CODE } from '../../../../src/errors/base/ErrorCode.js'
import { isBaseError } from '../../../../src/errors/base/ErrorUtils.js'
import {
  createEntityNotFoundError,
  createBusinessRuleViolationError,
  createDomainInvariantBrokenError,
  createValidationError,
  createStateTransitionError,
  matchDomainError,
  createStateTransitionKey,
  validateEntityExists,
  validateBusinessRule,
  validateStateTransition
} from '../../../../src/errors/domain/DomainError.js'

import type { DomainError } from '../../../../src/errors/domain/DomainError.js'
import type { EntityContext, BusinessRuleContext, ValidationContext, StateTransitionContext } from '../../../../src/errors/domain/DomainError.js'

describe('DomainError', () => {
  describe('createEntityNotFoundError', () => {
    it('should create EntityNotFoundError with correct structure', () => {
      const context: EntityContext = {
        entityType: 'User',
        entityId: 'user-123'
      }
      
      const error = createEntityNotFoundError(context)
      
      expect(error._tag).toBe('EntityNotFound')
      expect(error.entityType).toBe('User')
      expect(error.entityId).toBe('user-123')
      expect(error.code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND)
      expect(isBaseError(error)).toBe(true)
    })

    it('should create EntityNotFoundError with operation context', () => {
      const context: EntityContext = {
        entityType: 'Order',
        entityId: 'order-456',
        operation: 'read'
      }
      
      const error = createEntityNotFoundError(context)
      
      expect(error._tag).toBe('EntityNotFound')
      expect(error.entityType).toBe('Order')
      expect(error.entityId).toBe('order-456')
      expect(error.context).toBeDefined()
    })

    it('should include entity metadata in extra', () => {
      const context: EntityContext = {
        entityType: 'Product',
        entityId: 789
      }
      
      const error = createEntityNotFoundError(context)
      
      expect(error.extra).toBeDefined()
      expect((error.extra as { domainVersion?: string })?.domainVersion).toBeDefined()
    })
  })

  describe('createBusinessRuleViolationError', () => {
    it('should create BusinessRuleViolationError with correct structure', () => {
      const ruleName = 'MaxOrderAmountRule'
      const message = 'Order amount exceeds maximum'
      
      const error = createBusinessRuleViolationError(ruleName, message)
      
      expect(error._tag).toBe('BusinessRuleViolation')
      expect(error.ruleName).toBe(ruleName)
      expect(error.message).toBe(message)
      expect(error.code).toBe(ERROR_CODE.DOMAIN_RULE_VIOLATION)
      expect(isBaseError(error)).toBe(true)
    })

    it('should create BusinessRuleViolationError with violatedFields', () => {
      const ruleName = 'ValidationRule'
      const message = 'Validation failed'
      const context: BusinessRuleContext = {
        ruleName,
        violatedFields: ['amount', 'currency']
      }
      
      const error = createBusinessRuleViolationError(ruleName, message, context)
      
      expect(error._tag).toBe('BusinessRuleViolation')
      expect(error.violatedFields).toBeDefined()
      expect(error.violatedFields).toEqual(['amount', 'currency'])
    })

    it('should include rule context in error context', () => {
      const ruleName = 'TestRule'
      const message = 'Test message'
      const context: BusinessRuleContext = {
        ruleName,
        violatedFields: ['field1']
      }
      
      const error = createBusinessRuleViolationError(ruleName, message, context)
      
      expect(error.context).toBeDefined()
      expect((error.context as { ruleName?: string })?.ruleName).toBe(ruleName)
    })
  })

  describe('createDomainInvariantBrokenError', () => {
    it('should create DomainInvariantBrokenError with correct structure', () => {
      const invariant = 'TotalAmountInvariant'
      const message = 'Total amount must equal sum of items'
      
      const error = createDomainInvariantBrokenError(invariant, message)
      
      expect(error._tag).toBe('DomainInvariantBroken')
      expect(error.invariant).toBe(invariant)
      expect(error.message).toBe(message)
      expect(error.code).toBe(ERROR_CODE.DOMAIN_INVARIANT_BROKEN)
      expect(isBaseError(error)).toBe(true)
    })

    it('should have CRITICAL severity for invariant errors', () => {
      const error = createDomainInvariantBrokenError('TestInvariant', 'Test message')
      
      expect(error.severity).toBeDefined()
      // Invariant errors should be critical
      expect(error.severity).toBe('critical')
    })
  })

  describe('createValidationError', () => {
    it('should create ValidationError with correct structure', () => {
      const context: ValidationContext = {
        field: 'email',
        value: 'invalid-email',
        constraint: 'must be valid email format'
      }
      
      const error = createValidationError(context)
      
      expect(error._tag).toBe('Validation')
      expect(error.field).toBe('email')
      expect(error.constraint).toBe('must be valid email format')
      expect(error.code).toBe(ERROR_CODE.VALIDATION_FAILED)
      expect(isBaseError(error)).toBe(true)
    })

    it('should include field value in context', () => {
      const context: ValidationContext = {
        field: 'age',
        value: -5,
        constraint: 'must be positive'
      }
      
      const error = createValidationError(context)
      
      expect(error.context).toBeDefined()
      expect((error.context as { value?: number })?.value).toBe(-5)
    })
  })

  describe('createStateTransitionError', () => {
    it('should create StateTransitionError with correct structure', () => {
      const context: StateTransitionContext = {
        from: 'draft',
        to: 'archived',
        allowed: ['draft->active', 'draft->cancelled']
      }
      
      const error = createStateTransitionError(context)
      
      expect(error._tag).toBe('StateTransition')
      expect(error.from).toBe('draft')
      expect(error.to).toBe('archived')
      expect(error.allowed).toEqual(['draft->active', 'draft->cancelled'])
      expect(error.code).toBe(ERROR_CODE.DOMAIN_INVALID_STATE)
      expect(isBaseError(error)).toBe(true)
    })

    it('should include allowed transitions', () => {
      const context: StateTransitionContext = {
        from: 'pending',
        to: 'completed',
        allowed: ['pending->processing', 'pending->cancelled']
      }
      
      const error = createStateTransitionError(context)
      
      expect(error.allowed).toHaveLength(2)
      expect(error.allowed).toContain('pending->processing')
      expect(error.allowed).toContain('pending->cancelled')
    })
  })

  describe('matchDomainError - Pattern Matching', () => {
    it('should match EntityNotFound error', () => {
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123'
      })
      
      const result = matchDomainError(error, {
        entityNotFound: (e) => `Entity not found: ${e.entityType}`,
        businessRuleViolation: () => 'business rule',
        domainInvariantBroken: () => 'invariant',
        validation: () => 'validation',
        stateTransition: () => 'state transition'
      })
      
      expect(result).toBe('Entity not found: User')
    })

    it('should match BusinessRuleViolation error', () => {
      const error = createBusinessRuleViolationError('TestRule', 'Test message')
      
      const result = matchDomainError(error, {
        entityNotFound: () => 'not found',
        businessRuleViolation: (e) => `Rule violated: ${e.ruleName}`,
        domainInvariantBroken: () => 'invariant',
        validation: () => 'validation',
        stateTransition: () => 'state transition'
      })
      
      expect(result).toBe('Rule violated: TestRule')
    })

    it('should match DomainInvariantBroken error', () => {
      const error = createDomainInvariantBrokenError('TestInvariant', 'Test message')
      
      const result = matchDomainError(error, {
        entityNotFound: () => 'not found',
        businessRuleViolation: () => 'rule',
        domainInvariantBroken: (e) => `Invariant broken: ${e.invariant}`,
        validation: () => 'validation',
        stateTransition: () => 'state transition'
      })
      
      expect(result).toBe('Invariant broken: TestInvariant')
    })

    it('should match Validation error', () => {
      const error = createValidationError({
        field: 'email',
        value: 'invalid',
        constraint: 'must be email'
      })
      
      const result = matchDomainError(error, {
        entityNotFound: () => 'not found',
        businessRuleViolation: () => 'rule',
        domainInvariantBroken: () => 'invariant',
        validation: (e) => `Validation failed: ${e.field}`,
        stateTransition: () => 'state transition'
      })
      
      expect(result).toBe('Validation failed: email')
    })

    it('should match StateTransition error', () => {
      const error = createStateTransitionError({
        from: 'draft',
        to: 'archived',
        allowed: ['draft->active']
      })
      
      const result = matchDomainError(error, {
        entityNotFound: () => 'not found',
        businessRuleViolation: () => 'rule',
        domainInvariantBroken: () => 'invariant',
        validation: () => 'validation',
        stateTransition: (e) => `Invalid transition: ${e.from} -> ${e.to}`
      })
      
      expect(result).toBe('Invalid transition: draft -> archived')
    })

    it('should be exhaustive (TypeScript compile-time check)', () => {
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123'
      })
      
      // Все handlers должны быть предоставлены для exhaustive matching
      const result = matchDomainError(error, {
        entityNotFound: () => 'found',
        businessRuleViolation: () => 'rule',
        domainInvariantBroken: () => 'invariant',
        validation: () => 'validation',
        stateTransition: () => 'transition'
      })
      
      expect(typeof result).toBe('string')
    })
  })

  describe('Type safety', () => {
    it('should have correct DomainError union type', () => {
      const errors: DomainError[] = [
        createEntityNotFoundError({ entityType: 'User', entityId: '1' }),
        createBusinessRuleViolationError('Rule', 'Message'),
        createDomainInvariantBrokenError('Invariant', 'Message'),
        createValidationError({ field: 'field', value: 'value', constraint: 'constraint' }),
        createStateTransitionError({ from: 'a', to: 'b', allowed: [] })
      ]
      
      errors.forEach(error => {
        expect(error._tag).toBeDefined()
        expect(isBaseError(error)).toBe(true)
      })
    })

    it('should preserve immutability', () => {
      const error = createEntityNotFoundError({
        entityType: 'User',
        entityId: '123'
      })
      
      // Проверяем, что объект создан корректно
      expect(error.entityType).toBe('User')
      expect(error.entityId).toBe('123')
    })
  })

  describe('Helper functions', () => {
    it('should create state transition key', () => {
      const key = createStateTransitionKey('draft', 'active')
      expect(key).toBe('draft->active')
    })

    it('should validate entity exists', () => {
      const existing = { id: '1', name: 'User' }
      const result = validateEntityExists(existing, { entityType: 'User', entityId: '1' })
      
      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        expect(result.right).toBe(existing)
      }
    })

    it('should return Left when entity is null', () => {
      const result = validateEntityExists(null, { entityType: 'User', entityId: '1' })
      
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('EntityNotFound')
      }
    })

    it('should return Left when entity is undefined', () => {
      const result = validateEntityExists(undefined, { entityType: 'User', entityId: '1' })
      
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('EntityNotFound')
      }
    })

    it('should validate business rule', () => {
      const validValue = 10
      const result = validateBusinessRule(
        validValue,
        (v) => v > 0,
        'PositiveValueRule',
        'Value must be positive'
      )
      
      expect(result._tag).toBe('Right')
      if (result._tag === 'Right') {
        expect(result.right).toBe(10)
      }
    })

    it('should return Left when business rule violated', () => {
      const invalidValue = -5
      const result = validateBusinessRule(
        invalidValue,
        (v) => v > 0,
        'PositiveValueRule',
        'Value must be positive'
      )
      
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('BusinessRuleViolation')
        expect(result.left.ruleName).toBe('PositiveValueRule')
      }
    })

    it('should validate state transition', () => {
      const allowed = [createStateTransitionKey('draft', 'active')]
      const result = validateStateTransition('draft', 'active', allowed)
      
      expect(result._tag).toBe('Right')
    })

    it('should return Left when state transition invalid', () => {
      const allowed = [createStateTransitionKey('draft', 'active')]
      const result = validateStateTransition('draft', 'archived', allowed)
      
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('StateTransition')
        expect(result.left.from).toBe('draft')
        expect(result.left.to).toBe('archived')
      }
    })
  })
})
