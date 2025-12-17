/**
 * Тесты для ErrorUtils — утилит работы с BaseError
 *
 * Покрывает все функции из ErrorUtils.ts для обеспечения
 * корректности и надежности error handling.
 */

import { describe, it, expect } from 'vitest'

import { createError } from '../../../../src/errors/base/BaseError.js'
import { ERROR_CODE } from '../../../../src/errors/base/ErrorCode.ts'
import {
  ERROR_SEVERITY,
  ERROR_CATEGORY,
  ERROR_ORIGIN
} from '../../../../src/errors/base/ErrorConstants.js'
import {
  // Type guards
  isDomainError,
  isApplicationError,
  isInfrastructureError,
  isSecurityError,
  isValidationError,

  // Metadata helpers
  hasCorrelationId,
  hasTenantId,
  isRetryable,
  hasCause,
  getErrorSeverity,
  getErrorCategory,
  getErrorOrigin,
  requiresAlert,
  shouldBlockDeployment,
  getErrorPriority,

  // Cause chain utilities
  getCauseChain,
  getRootCause,
  getNthCause,

  // Filtering & searching
  filterErrorsBySeverity,
  filterErrorsByCategory,
  findErrorByCode,

  // Transformation utilities
  toSerializableError,
  sanitizeError,

  // Comparison utilities
  areErrorsEqual,
  hasSameCode,
  hasSameCodeAndMessage,

  // Context utilities
  mergeErrorContexts,
  extractContextValue,

  // Validation utilities
  isValidErrorMetadata,
  validateErrorStructure
} from '../../../../src/errors/base/ErrorUtils.js'

describe('ErrorUtils - Type Guards по слоям', () => {
  describe('isDomainError', () => {
    it('должен возвращать true для DOMAIN_ кодов', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
      expect(isDomainError(error)).toBe(true)
    })

    it('должен возвращать false для других кодов', () => {
      const error = createError(ERROR_CODE.INFRA_NETWORK_ERROR, 'Network error')
      expect(isDomainError(error)).toBe(false)
    })

    it('должен возвращать false для не-BaseError объектов', () => {
      expect(isDomainError({})).toBe(false)
      expect(isDomainError(null)).toBe(false)
      expect(isDomainError('string')).toBe(false)
    })
  })

  describe('isApplicationError', () => {
    it('должен возвращать true для APPLICATION_ кодов', () => {
      const error = createError(ERROR_CODE.APPLICATION_COMMAND_REJECTED, 'Rejected')
      expect(isApplicationError(error)).toBe(true)
    })

    it('должен возвращать false для других кодов', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
      expect(isApplicationError(error)).toBe(false)
    })
  })

  describe('isInfrastructureError', () => {
    it('должен возвращать true для INFRA_ кодов', () => {
      const error = createError(ERROR_CODE.INFRA_NETWORK_ERROR, 'Network error')
      expect(isInfrastructureError(error)).toBe(true)
    })

    it('должен возвращать false для других кодов', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
      expect(isInfrastructureError(error)).toBe(false)
    })
  })

  describe('isSecurityError', () => {
    it('должен возвращать true для SECURITY_ кодов', () => {
      const error = createError(ERROR_CODE.SECURITY_UNAUTHORIZED, 'Unauthorized')
      expect(isSecurityError(error)).toBe(true)
    })

    it('должен возвращать false для других кодов', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
      expect(isSecurityError(error)).toBe(false)
    })
  })

  describe('isValidationError', () => {
    it('должен возвращать true для VALIDATION_ кодов', () => {
      const error = createError(ERROR_CODE.VALIDATION_FAILED, 'Validation failed')
      expect(isValidationError(error)).toBe(true)
    })

    it('должен возвращать false для других кодов', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
      expect(isValidationError(error)).toBe(false)
    })
  })
})

describe('ErrorUtils - Metadata Helpers', () => {
  describe('hasCorrelationId', () => {
    it('должен возвращать true если correlationId присутствует', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        correlationId: 'req-123'
      })
      expect(hasCorrelationId(error)).toBe(true)
    })

    it('должен возвращать false если correlationId отсутствует', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      expect(hasCorrelationId(error)).toBe(false)
    })

    it('должен возвращать false для пустой строки', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        correlationId: ''
      })
      expect(hasCorrelationId(error)).toBe(false)
    })
  })

  describe('hasTenantId', () => {
    it('должен возвращать true если tenantId присутствует', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        tenantId: 'tenant-123'
      })
      expect(hasTenantId(error)).toBe(true)
    })

    it('должен возвращать false если tenantId отсутствует', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      expect(hasTenantId(error)).toBe(false)
    })
  })

  describe('isRetryable', () => {
    it('должен возвращать true если retryable === true', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        retryable: true
      })
      expect(isRetryable(error)).toBe(true)
    })

    it('должен возвращать false если retryable !== true', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        retryable: false
      })
      expect(isRetryable(error)).toBe(false)

      const error2 = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      expect(isRetryable(error2)).toBe(false)
    })
  })

  describe('hasCause', () => {
    it('должен возвращать true если cause присутствует', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        cause: new Error('Original error')
      })
      expect(hasCause(error)).toBe(true)
    })

    it('должен возвращать false если cause отсутствует', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      expect(hasCause(error)).toBe(false)
    })
  })

  describe('getErrorSeverity', () => {
    it('должен возвращать severity если он установлен', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.HIGH
      })
      expect(getErrorSeverity(error)).toBe(ERROR_SEVERITY.HIGH)
    })

    it('должен возвращать severity из метаданных реестра', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      // DOMAIN_ENTITY_NOT_FOUND имеет severity HIGH в реестре метаданных
      expect(getErrorSeverity(error)).toBe(ERROR_SEVERITY.HIGH)
    })
  })

  describe('getErrorCategory', () => {
    it('должен возвращать category если он установлен', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        category: ERROR_CATEGORY.BUSINESS
      })
      expect(getErrorCategory(error)).toBe(ERROR_CATEGORY.BUSINESS)
    })

    it('должен возвращать category из метаданных реестра', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      // DOMAIN_ENTITY_NOT_FOUND имеет category BUSINESS в реестре метаданных
      expect(getErrorCategory(error)).toBe(ERROR_CATEGORY.BUSINESS)
    })
  })

  describe('getErrorOrigin', () => {
    it('должен возвращать origin если он установлен', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        origin: ERROR_ORIGIN.DOMAIN
      })
      expect(getErrorOrigin(error)).toBe(ERROR_ORIGIN.DOMAIN)
    })

    it('должен возвращать origin из метаданных реестра', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      // DOMAIN_ENTITY_NOT_FOUND имеет origin DOMAIN в реестре метаданных
      expect(getErrorOrigin(error)).toBe(ERROR_ORIGIN.DOMAIN)
    })
  })

  describe('requiresAlert', () => {
    it('должен возвращать true для CRITICAL severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.CRITICAL
      })
      expect(requiresAlert(error)).toBe(true)
    })

    it('должен возвращать true для HIGH severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.HIGH
      })
      expect(requiresAlert(error)).toBe(true)
    })

    it('должен возвращать false для MEDIUM severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.MEDIUM
      })
      expect(requiresAlert(error)).toBe(false)
    })

    it('должен возвращать false для LOW severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.LOW
      })
      expect(requiresAlert(error)).toBe(false)
    })

    it('должен возвращать true для ошибки с HIGH severity из реестра', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      // DOMAIN_ENTITY_NOT_FOUND имеет severity HIGH в реестре, поэтому requiresAlert = true
      expect(requiresAlert(error)).toBe(true)
    })
  })

  describe('shouldBlockDeployment', () => {
    it('должен возвращать true только для CRITICAL severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.CRITICAL
      })
      expect(shouldBlockDeployment(error)).toBe(true)
    })

    it('должен возвращать false для HIGH severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.HIGH
      })
      expect(shouldBlockDeployment(error)).toBe(false)
    })

    it('должен возвращать false для MEDIUM severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.MEDIUM
      })
      expect(shouldBlockDeployment(error)).toBe(false)
    })

    it('должен возвращать false для LOW severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.LOW
      })
      expect(shouldBlockDeployment(error)).toBe(false)
    })

    it('должен возвращать false для ошибки без severity (использует MEDIUM по умолчанию)', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      expect(shouldBlockDeployment(error)).toBe(false)
    })
  })

  describe('getErrorPriority', () => {
    it('должен возвращать 100 для CRITICAL severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.CRITICAL
      })
      expect(getErrorPriority(error)).toBe(100)
    })

    it('должен возвращать 80 для HIGH severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.HIGH
      })
      expect(getErrorPriority(error)).toBe(80)
    })

    it('должен возвращать 50 для MEDIUM severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.MEDIUM
      })
      expect(getErrorPriority(error)).toBe(50)
    })

    it('должен возвращать приоритет на основе severity из реестра', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      // DOMAIN_ENTITY_NOT_FOUND имеет severity HIGH в реестре, приоритет = 80
      expect(getErrorPriority(error)).toBe(80)
    })

    it('должен возвращать 10 для LOW severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: ERROR_SEVERITY.LOW
      })
      expect(getErrorPriority(error)).toBe(10)
    })

    it('должен возвращать 0 для неизвестного severity', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        severity: 'unknown' as any
      })
      expect(getErrorPriority(error)).toBe(0)
    })
  })
})

describe('ErrorUtils - Cause Chain Utilities', () => {
  describe('getCauseChain', () => {
    it('должен возвращать пустой массив если cause отсутствует', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      const chain = getCauseChain(error)
      expect(chain).toEqual([])
    })

    it('должен возвращать цепочку из одного элемента', () => {
      const originalError = new Error('Original')
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        cause: originalError
      })
      const chain = getCauseChain(error)
      expect(chain).toEqual([originalError])
    })

    it('должен возвращать цепочку из нескольких элементов', () => {
      const rootError = new Error('Root')
      const middleError = new Error('Middle')
      ;(middleError as any).cause = rootError
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        cause: middleError
      })

      const chain = getCauseChain(error)
      expect(chain).toEqual([middleError, rootError])
    })

    it('должен ограничивать глубину цепочки', () => {
      const rootError = new Error('Root')
      const middleError = new Error('Middle')
      ;(middleError as any).cause = rootError
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        cause: middleError
      })

      const chain = getCauseChain(error, 1)
      expect(chain).toEqual([middleError])
    })
  })

  describe('getRootCause', () => {
    it('должен возвращать undefined если cause отсутствует', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      expect(getRootCause(error)).toBeUndefined()
    })

    it('должен возвращать корневую причину', () => {
      const rootError = new Error('Root')
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        cause: rootError
      })
      expect(getRootCause(error)).toBe(rootError)
    })

    it('должен возвращать корневую причину из глубокой цепочки', () => {
      const rootError = new Error('Root')
      const middleError = new Error('Middle')
      ;(middleError as any).cause = rootError
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        cause: middleError
      })
      expect(getRootCause(error)).toBe(rootError)
    })

    it('должен ограничивать глубину поиска через maxDepth', () => {
      const rootError = new Error('Root')
      const middleError = new Error('Middle')
      ;(middleError as any).cause = rootError
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        cause: middleError
      })
      // getRootCause ищет самую глубокую причину до maxDepth
      // С maxDepth=1 находит rootError (depth=0 для middleError, depth=1 для rootError, depth>=maxDepth -> возвращает rootError)
      // С maxDepth=0 ограничивает сразу на middleError
      expect(getRootCause(error, 0)).toBe(middleError)
      expect(getRootCause(error, 1)).toBe(rootError)
      expect(getRootCause(error, 2)).toBe(rootError)
    })

    it('должен обрабатывать null в цепочке', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        cause: null
      })
      expect(getRootCause(error)).toBeUndefined()
    })
  })

  describe('getNthCause', () => {
    it('должен возвращать undefined для отрицательных индексов', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        cause: new Error('Cause')
      })
      expect(getNthCause(error, -1)).toBeUndefined()
    })

    it('должен возвращать N-ю причину', () => {
      const cause1 = new Error('Cause 1')
      const cause2 = new Error('Cause 2')
      ;(cause2 as any).cause = cause1

      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        cause: cause2
      })

      expect(getNthCause(error, 0)).toBe(cause2)
      expect(getNthCause(error, 1)).toBe(cause1)
      expect(getNthCause(error, 2)).toBeUndefined()
    })

    it('должен возвращать undefined если cause отсутствует', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      expect(getNthCause(error, 0)).toBeUndefined()
    })

    it('должен обрабатывать null в цепочке', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        cause: null
      })
      expect(getNthCause(error, 0)).toBeUndefined()
    })

    it('должен обрабатывать объект без cause property', () => {
      const objWithoutCause = { message: 'Not an error' }
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
        cause: objWithoutCause
      })
      expect(getNthCause(error, 0)).toBe(objWithoutCause)
      expect(getNthCause(error, 1)).toBeUndefined()
    })
  })
})

describe('ErrorUtils - Filtering & Searching', () => {
  const errors = [
    createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Domain error', {
      severity: ERROR_SEVERITY.HIGH
    }),
    createError(ERROR_CODE.INFRA_NETWORK_ERROR, 'Infra error', {
      severity: ERROR_SEVERITY.CRITICAL,
      category: ERROR_CATEGORY.INFRASTRUCTURE
    }),
    createError(ERROR_CODE.APPLICATION_COMMAND_REJECTED, 'App error', {
      severity: ERROR_SEVERITY.MEDIUM,
      category: ERROR_CATEGORY.BUSINESS
    })
  ] as const

  describe('filterErrorsBySeverity', () => {
    it('должен фильтровать ошибки по severity', () => {
      const highErrors = filterErrorsBySeverity(errors, ERROR_SEVERITY.HIGH)
      expect(highErrors).toHaveLength(1)
      expect(highErrors[0].code).toBe(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND)

      const criticalErrors = filterErrorsBySeverity(errors, ERROR_SEVERITY.CRITICAL)
      expect(criticalErrors).toHaveLength(1)
      expect(criticalErrors[0].code).toBe(ERROR_CODE.INFRA_NETWORK_ERROR)
    })
  })

  describe('filterErrorsByCategory', () => {
    it('должен фильтровать ошибки по category', () => {
      const infraErrors = filterErrorsByCategory(errors, ERROR_CATEGORY.INFRASTRUCTURE)
      expect(infraErrors).toHaveLength(1)
      expect(infraErrors[0].code).toBe(ERROR_CODE.INFRA_NETWORK_ERROR)

      const businessErrors = filterErrorsByCategory(errors, ERROR_CATEGORY.BUSINESS)
      // DOMAIN_ENTITY_NOT_FOUND имеет category BUSINESS из реестра, APPLICATION_COMMAND_REJECTED тоже
      expect(businessErrors.length).toBeGreaterThanOrEqual(1)
      expect(businessErrors.some(e => e.code === ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND)).toBe(true)
      expect(businessErrors.some(e => e.code === ERROR_CODE.APPLICATION_COMMAND_REJECTED)).toBe(true)
    })
  })

  describe('findErrorByCode', () => {
    it('должен находить ошибку по коду', () => {
      const found = findErrorByCode(errors, ERROR_CODE.INFRA_NETWORK_ERROR)
      expect(found?.code).toBe(ERROR_CODE.INFRA_NETWORK_ERROR)

      const notFound = findErrorByCode(errors, 'NON_EXISTENT_CODE')
      expect(notFound).toBeUndefined()
    })
  })
})

describe('ErrorUtils - Transformation Utilities', () => {
  describe('toSerializableError', () => {
    it('должен создавать сериализуемый объект', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test message', {
        correlationId: 'req-123',
        context: { userId: 'user-456' },
        severity: ERROR_SEVERITY.HIGH,
        cause: new Error('Original')
      })

      const serialized = toSerializableError(error)

      // toSerializableError включает метаданные из реестра (category, origin)
      expect(serialized).toMatchObject({
        code: ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND,
        message: 'Test message',
        timestamp: error.timestamp,
        correlationId: 'req-123',
        context: { userId: 'user-456' },
        severity: ERROR_SEVERITY.HIGH,
        hasCause: true
      })
      // Проверяем наличие метаданных из реестра
      expect(serialized).toHaveProperty('category')
      expect(serialized).toHaveProperty('origin')

      // Проверяем что объект сериализуем
      expect(() => JSON.stringify(serialized)).not.toThrow()
    })

    it('должен исключать undefined поля', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test')
      const serialized = toSerializableError(error)

      expect(serialized.correlationId).toBeUndefined()
      expect(serialized.context).toBeUndefined()
      expect(serialized.hasCause).toBeUndefined()
    })

    it('должен включать все опциональные поля если они присутствуют', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test', {
        correlationId: 'req-123',
        context: { userId: 'user-456' },
        localizedMessage: 'Локализованное сообщение',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        tenantId: 'tenant-789',
        retryable: true,
        origin: ERROR_ORIGIN.DOMAIN,
        extra: { customField: 'value' },
        cause: new Error('Cause')
      })

      const serialized = toSerializableError(error)

      expect(serialized.correlationId).toBe('req-123')
      expect(serialized.context).toEqual({ userId: 'user-456' })
      expect(serialized.localizedMessage).toBe('Локализованное сообщение')
      expect(serialized.severity).toBe(ERROR_SEVERITY.HIGH)
      expect(serialized.category).toBe(ERROR_CATEGORY.BUSINESS)
      expect(serialized.tenantId).toBe('tenant-789')
      expect(serialized.retryable).toBe(true)
      expect(serialized.origin).toBe(ERROR_ORIGIN.DOMAIN)
      expect(serialized.extra).toEqual({ customField: 'value' })
      expect(serialized.hasCause).toBe(true)
    })

    it('должен обрабатывать retryable=false', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test', {
        retryable: false
      })
      const serialized = toSerializableError(error)
      expect(serialized.retryable).toBe(false)
    })
  })

  describe('sanitizeError', () => {
    it('должен удалять sensitive поля из context', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test', {
        context: {
          userId: 'user-123',
          password: 'secret',
          token: 'jwt-token',
          safeField: 'safe'
        }
      })

      const sanitized = sanitizeError(error)

      expect(sanitized.context?.userId).toBe('user-123')
      expect(sanitized.context?.safeField).toBe('safe')
      expect(sanitized.context?.password).toBeUndefined()
      expect(sanitized.context?.token).toBeUndefined()
    })

    it('должен работать с кастомными sensitive ключами', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test', {
        context: { customSecret: 'secret', normalField: 'normal' }
      })

      const sanitized = sanitizeError(error, ['customSecret'])

      expect(sanitized.context?.normalField).toBe('normal')
      expect(sanitized.context?.customSecret).toBeUndefined()
    })

    it('должен возвращать оригинальную ошибку если context отсутствует', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Test')
      const sanitized = sanitizeError(error)
      expect(sanitized).toBe(error)
    })
  })
})

describe('ErrorUtils - Comparison Utilities', () => {
  const error1 = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
  const error2 = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Not found')
  const error3 = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'Different message')
  const error4 = createError(ERROR_CODE.INFRA_NETWORK_ERROR, 'Not found')

  describe('areErrorsEqual', () => {
    it('должен возвращать true для ошибок с одинаковым кодом (identity)', () => {
      expect(areErrorsEqual(error1, error2)).toBe(true)
      // message может отличаться (presentation), но code одинаковый (identity)
      expect(areErrorsEqual(error1, error3)).toBe(true)
    })

    it('должен возвращать false для ошибок с разными кодами', () => {
      expect(areErrorsEqual(error1, error4)).toBe(false)
    })
  })

  describe('hasSameCodeAndMessage', () => {
    it('должен возвращать true для ошибок с одинаковым кодом и сообщением', () => {
      expect(hasSameCodeAndMessage(error1, error2)).toBe(true)
    })

    it('должен возвращать false для ошибок с разными сообщениями', () => {
      expect(hasSameCodeAndMessage(error1, error3)).toBe(false)
    })

    it('должен возвращать false для ошибок с разными кодами', () => {
      expect(hasSameCodeAndMessage(error1, error4)).toBe(false)
    })
  })

  describe('hasSameCode', () => {
    it('должен возвращать true для ошибок с одинаковым кодом', () => {
      expect(hasSameCode(error1, error2)).toBe(true)
      expect(hasSameCode(error1, error3)).toBe(true)
    })

    it('должен возвращать false для ошибок с разными кодами', () => {
      expect(hasSameCode(error1, error4)).toBe(false)
    })
  })
})

describe('ErrorUtils - Context Utilities', () => {
  const error1 = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg', {
    context: { field1: 'value1', shared: 'error1' }
  })
  const error2 = createError(ERROR_CODE.INFRA_NETWORK_ERROR, 'msg', {
    context: { field2: 'value2', shared: 'error2' }
  })

  describe('mergeErrorContexts', () => {
    it('должен объединять контексты с приоритетом правой ошибки', () => {
      const merged = mergeErrorContexts(error1, error2)
      expect(merged).toEqual({
        field1: 'value1',
        shared: 'error2', // error2 имеет приоритет
        field2: 'value2'
      })
    })

    it('должен работать если один из контекстов отсутствует', () => {
      const errorWithoutContext = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      const merged = mergeErrorContexts(error1, errorWithoutContext)
      expect(merged).toEqual(error1.context)
    })

    it('должен возвращать пустой объект если оба контекста отсутствуют', () => {
      const error1 = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      const error2 = createError(ERROR_CODE.INFRA_NETWORK_ERROR, 'msg')
      const merged = mergeErrorContexts(error1, error2)
      expect(merged).toEqual({})
    })
  })

  describe('extractContextValue', () => {
    it('должен извлекать значение из контекста', () => {
      const value = extractContextValue<string>(error1, 'field1')
      expect(value).toBe('value1')
    })

    it('должен возвращать defaultValue если ключ отсутствует', () => {
      const value = extractContextValue(error1, 'missing', 'default')
      expect(value).toBe('default')
    })

    it('должен возвращать undefined если context отсутствует', () => {
      const errorWithoutContext = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      const value = extractContextValue(errorWithoutContext, 'field1')
      expect(value).toBeUndefined()
    })
  })
})

describe('ErrorUtils - Validation Utilities', () => {
  describe('isValidErrorMetadata', () => {
    it('должен возвращать true для корректных метаданных', () => {
      expect(isValidErrorMetadata({})).toBe(true)
      expect(isValidErrorMetadata({
        correlationId: 'req-123',
        severity: ERROR_SEVERITY.HIGH
      })).toBe(true)
    })

    it('должен возвращать false для некорректных типов', () => {
      expect(isValidErrorMetadata(null)).toBe(false)
      expect(isValidErrorMetadata('string')).toBe(false)
      expect(isValidErrorMetadata(123)).toBe(false)
    })

    it('должен возвращать true для всех валидных полей ErrorMetadata', () => {
      expect(isValidErrorMetadata({
        correlationId: 'req-123',
        context: { userId: 'user-456' },
        localizedMessage: 'Message',
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.BUSINESS,
        tenantId: 'tenant-789',
        retryable: true,
        origin: ERROR_ORIGIN.DOMAIN,
        extra: { field: 'value' }
      })).toBe(true)
    })

    it('должен возвращать false для невалидного severity', () => {
      expect(isValidErrorMetadata({
        severity: 'invalid' as any
      })).toBe(false)
    })

    it('должен возвращать false для невалидного category', () => {
      expect(isValidErrorMetadata({
        category: 'invalid' as any
      })).toBe(false)
    })

    it('должен возвращать false для невалидного origin', () => {
      expect(isValidErrorMetadata({
        origin: 'invalid' as any
      })).toBe(false)
    })

    it('должен возвращать false для невалидного correlationId (не string)', () => {
      expect(isValidErrorMetadata({
        correlationId: 123 as any
      })).toBe(false)
    })

    it('должен возвращать false для невалидного tenantId (не string)', () => {
      expect(isValidErrorMetadata({
        tenantId: 123 as any
      })).toBe(false)
    })

    it('должен возвращать false для невалидного retryable (не boolean)', () => {
      expect(isValidErrorMetadata({
        retryable: 'true' as any
      })).toBe(false)
    })

    it('должен возвращать false для невалидного context (не object)', () => {
      expect(isValidErrorMetadata({
        context: 'not-object' as any
      })).toBe(false)
    })

    it('должен возвращать false для невалидного localizedMessage (не string)', () => {
      expect(isValidErrorMetadata({
        localizedMessage: 123 as any
      })).toBe(false)
    })

    it('должен возвращать false для невалидного extra (не object)', () => {
      expect(isValidErrorMetadata({
        extra: 'not-object' as any
      })).toBe(false)
    })
  })

  describe('validateErrorStructure', () => {
    it('должен возвращать true для корректных ошибок', () => {
      const error = createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'msg')
      expect(validateErrorStructure(error)).toBe(true)
    })

    it('должен работать для всех типов BaseError', () => {
      const errors = [
        createError(ERROR_CODE.DOMAIN_ENTITY_NOT_FOUND, 'domain'),
        createError(ERROR_CODE.INFRA_NETWORK_ERROR, 'infra'),
        createError(ERROR_CODE.APPLICATION_COMMAND_REJECTED, 'app')
      ]

      errors.forEach(error => {
        expect(validateErrorStructure(error)).toBe(true)
      })
    })
  })
})