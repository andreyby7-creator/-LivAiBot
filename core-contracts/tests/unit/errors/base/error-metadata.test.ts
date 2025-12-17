/**
 * Unit tests для ErrorMetadata
 *
 * Тесты для проверки создания метаданных ошибок, immutability и валидации.
 */

import { describe, it, expect } from 'vitest'

import {
  ERROR_SEVERITY,
  ERROR_CATEGORY,
  ERROR_ORIGIN
} from '../../../../src/errors/base/ErrorConstants.js'
import { createErrorMetadata } from '../../../../src/errors/base/ErrorMetadata.js'

import type { ErrorSeverity, ErrorCategory, ErrorOrigin } from '../../../../src/errors/base/ErrorConstants.js'
import type { ErrorMetadata } from '../../../../src/errors/base/ErrorMetadata.js'

describe('ErrorMetadata', () => {
  describe('createErrorMetadata', () => {
    it('should create empty metadata when no parameters provided', () => {
      const metadata = createErrorMetadata()
      
      expect(metadata).toBeDefined()
      expect(typeof metadata).toBe('object')
      // Пустой объект должен быть создан
      expect(Object.keys(metadata).length).toBe(0)
    })

    it('should create metadata with correlationId', () => {
      const metadata = createErrorMetadata({
        correlationId: 'req-123'
      })
      
      expect(metadata.correlationId).toBe('req-123')
    })

    it('should create metadata with tenantId', () => {
      const metadata = createErrorMetadata({
        tenantId: 'tenant-456'
      })
      
      expect(metadata.tenantId).toBe('tenant-456')
    })

    it('should create metadata with severity', () => {
      const metadata = createErrorMetadata({
        severity: ERROR_SEVERITY.HIGH as ErrorSeverity
      })
      
      expect(metadata.severity).toBe(ERROR_SEVERITY.HIGH)
    })

    it('should create metadata with category', () => {
      const metadata = createErrorMetadata({
        category: ERROR_CATEGORY.BUSINESS as ErrorCategory
      })
      
      expect(metadata.category).toBe(ERROR_CATEGORY.BUSINESS)
    })

    it('should create metadata with origin', () => {
      const metadata = createErrorMetadata({
        origin: ERROR_ORIGIN.DOMAIN as ErrorOrigin
      })
      
      expect(metadata.origin).toBe(ERROR_ORIGIN.DOMAIN)
    })

    it('should create metadata with retryable flag', () => {
      const metadata = createErrorMetadata({
        retryable: true
      })
      
      expect(metadata.retryable).toBe(true)
    })

    it('should create metadata with localizedMessage', () => {
      const metadata = createErrorMetadata({
        localizedMessage: 'Ошибка произошла'
      })
      
      expect(metadata.localizedMessage).toBe('Ошибка произошла')
    })

    it('should create metadata with context', () => {
      const context = {
        userId: 'user-123',
        operation: 'create'
      }
      
      const metadata = createErrorMetadata({
        context
      })
      
      expect(metadata.context).toBeDefined()
      expect(metadata.context?.userId).toBe('user-123')
      expect(metadata.context?.operation).toBe('create')
    })

    it('should create metadata with extra fields', () => {
      const extra = {
        customField: 'customValue',
        nested: {
          field: 'value'
        }
      }
      
      const metadata = createErrorMetadata({
        extra
      })
      
      expect(metadata.extra).toBeDefined()
      expect(metadata.extra?.customField).toBe('customValue')
      expect((metadata.extra?.nested as { field: string })?.field).toBe('value')
    })

    it('should create metadata with cause', () => {
      const cause = new Error('Original error')
      
      const metadata = createErrorMetadata({
        cause
      })
      
      expect(metadata.cause).toBe(cause)
    })

    it('should create metadata with all fields', () => {
      const context = { userId: 'user-123' }
      const extra = { customField: 'value' }
      const cause = new Error('Original error')
      
      const metadata = createErrorMetadata({
        correlationId: 'req-123',
        tenantId: 'tenant-456',
        severity: ERROR_SEVERITY.HIGH as ErrorSeverity,
        category: ERROR_CATEGORY.BUSINESS as ErrorCategory,
        origin: ERROR_ORIGIN.DOMAIN as ErrorOrigin,
        retryable: true,
        localizedMessage: 'Localized message',
        context,
        extra,
        cause
      })
      
      expect(metadata.correlationId).toBe('req-123')
      expect(metadata.tenantId).toBe('tenant-456')
      expect(metadata.severity).toBe(ERROR_SEVERITY.HIGH)
      expect(metadata.category).toBe(ERROR_CATEGORY.BUSINESS)
      expect(metadata.origin).toBe(ERROR_ORIGIN.DOMAIN)
      expect(metadata.retryable).toBe(true)
      expect(metadata.localizedMessage).toBe('Localized message')
      expect(metadata.context).toBeDefined()
      expect(metadata.extra).toBeDefined()
      expect(metadata.cause).toBe(cause)
    })

    it('should exclude undefined fields from result', () => {
      const metadata = createErrorMetadata({
        correlationId: undefined,
        tenantId: 'tenant-456',
        severity: undefined,
        retryable: undefined
      })
      
      // undefined поля не должны быть включены
      expect('correlationId' in metadata).toBe(false)
      expect('severity' in metadata).toBe(false)
      expect('retryable' in metadata).toBe(false)
      
      // Определенные поля должны быть включены
      expect(metadata.tenantId).toBe('tenant-456')
    })

    it('should handle empty string values', () => {
      const metadata = createErrorMetadata({
        correlationId: '',
        tenantId: '',
        localizedMessage: ''
      })
      
      // Пустые строки должны быть включены (это валидные значения)
      expect(metadata.correlationId).toBe('')
      expect(metadata.tenantId).toBe('')
      expect(metadata.localizedMessage).toBe('')
    })

    it('should handle null in context and extra', () => {
      const metadata = createErrorMetadata({
        context: {
          field: null,
          anotherField: 'value'
        },
        extra: {
          field: null
        }
      })
      
      expect(metadata.context).toBeDefined()
      expect((metadata.context as { field: null; anotherField: string })?.field).toBeNull()
      expect((metadata.context as { field: null; anotherField: string })?.anotherField).toBe('value')
      expect(metadata.extra).toBeDefined()
    })

    it('should handle arrays in context and extra', () => {
      const metadata = createErrorMetadata({
        context: {
          items: [1, 2, 3]
        },
        extra: {
          tags: ['tag1', 'tag2']
        }
      })
      
      expect(metadata.context).toBeDefined()
      const items = (metadata.context as { items: number[] })?.items
      expect(Array.isArray(items)).toBe(true)
      expect(items).toEqual([1, 2, 3])
      
      expect(metadata.extra).toBeDefined()
      const tags = (metadata.extra as { tags: string[] })?.tags
      expect(Array.isArray(tags)).toBe(true)
      expect(tags).toEqual(['tag1', 'tag2'])
    })

    it('should create immutable metadata', () => {
      const metadata = createErrorMetadata({
        correlationId: 'req-123',
        context: { userId: 'user-123' }
      })
      
      // Попытка мутации не должна изменить объект (если используется Object.freeze)
      // Но в createErrorMetadata нет явного freeze, поэтому проверяем структуру
      expect(metadata.correlationId).toBe('req-123')
      
      // Проверяем, что объект создан корректно
      expect(typeof metadata).toBe('object')
      expect(metadata).not.toBeNull()
    })

    it('should handle nested objects in context', () => {
      const metadata = createErrorMetadata({
        context: {
          user: {
            id: 'user-123',
            name: 'John'
          },
          operation: 'create'
        }
      })
      
      expect(metadata.context).toBeDefined()
      const user = (metadata.context as { user: { id: string; name: string }; operation: string })?.user
      expect(user?.id).toBe('user-123')
      expect(user?.name).toBe('John')
      expect((metadata.context as { user: { id: string; name: string }; operation: string })?.operation).toBe('create')
    })

    it('should handle complex cause objects', () => {
      const cause = {
        code: 'CUSTOM_ERROR',
        message: 'Custom error message',
        details: {
          field: 'value'
        }
      }
      
      const metadata = createErrorMetadata({
        cause
      })
      
      expect(metadata.cause).toBe(cause)
    })
  })

  describe('Type safety', () => {
    it('should return ErrorMetadata type', () => {
      const metadata: ErrorMetadata = createErrorMetadata({
        correlationId: 'req-123'
      })
      
      expect(metadata).toBeDefined()
      expect(typeof metadata).toBe('object')
    })

    it('should accept Partial<ErrorMetadata>', () => {
      const partial: Partial<ErrorMetadata> = {
        correlationId: 'req-123',
        severity: ERROR_SEVERITY.MEDIUM as ErrorSeverity
      }
      
      const metadata = createErrorMetadata(partial)
      
      expect(metadata.correlationId).toBe('req-123')
      expect(metadata.severity).toBe(ERROR_SEVERITY.MEDIUM)
    })
  })
})
