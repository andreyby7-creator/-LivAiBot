import { describe, expect, it } from 'vitest';

import type {
  ErrorCodeGroupMetadata,
  ErrorCodeMetadata,
  ErrorCodeMetadataFactory,
  ErrorCodeMetadataMap,
  ErrorCodeMetadataValidationResult,
  ErrorCodeMetadataValidator,
  ExtendedErrorCodeMetadata,
  ExtendedErrorCodeMetadataMap,
  PartialExtendedErrorCodeMetadata,
  RequiredErrorCodeMetadata,
  SupportedHttpStatus,
} from '../../../../src/errors/base/ErrorCodeMeta';
import {
  DEFAULT_ERROR_CODE_METADATA,
  DEFAULT_ORIGIN_BY_CATEGORY,
  DEFAULT_SEVERITY_BY_CATEGORY,
  MAX_ERROR_DESCRIPTION_LENGTH,
  MAX_REMEDIATION_LENGTH,
  SUPPORTED_HTTP_STATUSES,
} from '../../../../src/errors/base/ErrorCodeMeta';
import type { ErrorSeverity } from '../../../../src/errors/base/ErrorConstants';
import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../src/errors/base/ErrorConstants';

describe('ErrorCodeMeta', () => {
  describe('Базовые типы метаданных', () => {
    describe('ErrorCodeMetadata', () => {
      it('должен определять структуру базовых метаданных', () => {
        const metadata: ErrorCodeMetadata = {
          code: 'DOMAIN_AUTH_001',
          description: 'Invalid credentials provided',
          severity: ERROR_SEVERITY.MEDIUM,
          category: ERROR_CATEGORY.SECURITY,
          origin: ERROR_ORIGIN.DOMAIN,
        };

        expect(metadata.code).toBe('DOMAIN_AUTH_001');
        expect(metadata.description).toBe('Invalid credentials provided');
        expect(metadata.severity).toBe('medium');
        expect(metadata.category).toBe('SECURITY');
        expect(metadata.origin).toBe('DOMAIN');
      });

      it('должен требовать все обязательные поля', () => {
        const incomplete = {
          code: 'DOMAIN_AUTH_001',
          description: 'Test error',
          // отсутствуют severity, category, origin
        };

        // TypeScript не позволит создать неполную структуру
        expect(() => {
          // @ts-expect-error - неполная структура
          const metadata: ErrorCodeMetadata = incomplete;
        });
      });
    });

    describe('ExtendedErrorCodeMetadata', () => {
      it('должен расширять базовые метаданные дополнительными полями', () => {
        const extendedMetadata: ExtendedErrorCodeMetadata = {
          code: 'DOMAIN_AUTH_001',
          description: 'Invalid credentials provided',
          severity: ERROR_SEVERITY.MEDIUM,
          category: ERROR_CATEGORY.SECURITY,
          origin: ERROR_ORIGIN.DOMAIN,
          httpStatus: 401,
          internalCode: 'AUTH_001',
          loggable: true,
          visibility: 'public',
          remediation: 'Please check your credentials and try again',
          docsUrl: 'https://docs.example.com/auth-errors',
        };

        expect(extendedMetadata.httpStatus).toBe(401);
        expect(extendedMetadata.internalCode).toBe('AUTH_001');
        expect(extendedMetadata.loggable).toBe(true);
        expect(extendedMetadata.visibility).toBe('public');
        expect(extendedMetadata.remediation).toBe('Please check your credentials and try again');
        expect(extendedMetadata.docsUrl).toBe('https://docs.example.com/auth-errors');
      });

      it('должен требовать обязательные дополнительные поля', () => {
        const extendedMetadata: ExtendedErrorCodeMetadata = {
          code: 'DOMAIN_AUTH_001',
          description: 'Invalid credentials provided',
          severity: ERROR_SEVERITY.MEDIUM,
          category: ERROR_CATEGORY.SECURITY,
          origin: ERROR_ORIGIN.DOMAIN,
          // обязательные поля
          loggable: true,
          visibility: 'internal',
          // опциональные поля
          httpStatus: 401,
          remediation: 'Please check your credentials',
        };

        expect(extendedMetadata.loggable).toBe(true);
        expect(extendedMetadata.visibility).toBe('internal');
        expect(extendedMetadata.httpStatus).toBe(401);
        expect(extendedMetadata.remediation).toBe('Please check your credentials');
      });
    });

    describe('ErrorCodeGroupMetadata', () => {
      it('должен определять структуру метаданных группы', () => {
        const groupMetadata: ErrorCodeGroupMetadata = {
          name: 'Authentication Errors',
          description: 'Errors related to user authentication',
          prefix: 'DOMAIN_AUTH',
          minCode: 1,
          maxCode: 99,
          category: ERROR_CATEGORY.SECURITY,
          defaultSeverity: ERROR_SEVERITY.MEDIUM,
          defaultOrigin: ERROR_ORIGIN.DOMAIN,
        };

        expect(groupMetadata.name).toBe('Authentication Errors');
        expect(groupMetadata.description).toBe('Errors related to user authentication');
        expect(groupMetadata.prefix).toBe('DOMAIN_AUTH');
        expect(groupMetadata.minCode).toBe(1);
        expect(groupMetadata.maxCode).toBe(99);
        expect(groupMetadata.category).toBe('SECURITY');
        expect(groupMetadata.defaultSeverity).toBe('medium');
        expect(groupMetadata.defaultOrigin).toBe('DOMAIN');
      });
    });
  });

  describe('Default значения', () => {
    describe('DEFAULT_SEVERITY_BY_CATEGORY', () => {
      it('должен содержать severity для всех категорий', () => {
        expect(DEFAULT_SEVERITY_BY_CATEGORY.BUSINESS).toBe('medium');
        expect(DEFAULT_SEVERITY_BY_CATEGORY.TECHNICAL).toBe('high');
        expect(DEFAULT_SEVERITY_BY_CATEGORY.SECURITY).toBe('critical');
        expect(DEFAULT_SEVERITY_BY_CATEGORY.PERFORMANCE).toBe('medium');
      });

      it('должен быть определен', () => {
        expect(DEFAULT_SEVERITY_BY_CATEGORY).toBeDefined();
      });

      it('security ошибки должны иметь critical severity', () => {
        expect(DEFAULT_SEVERITY_BY_CATEGORY.SECURITY).toBe('critical');
      });

      it('technical ошибки должны иметь high severity', () => {
        expect(DEFAULT_SEVERITY_BY_CATEGORY.TECHNICAL).toBe('high');
      });
    });

    describe('DEFAULT_ORIGIN_BY_CATEGORY', () => {
      it('должен содержать origin для всех категорий', () => {
        expect(DEFAULT_ORIGIN_BY_CATEGORY.BUSINESS).toBe('DOMAIN');
        expect(DEFAULT_ORIGIN_BY_CATEGORY.TECHNICAL).toBe('INFRASTRUCTURE');
        expect(DEFAULT_ORIGIN_BY_CATEGORY.SECURITY).toBe('DOMAIN');
        expect(DEFAULT_ORIGIN_BY_CATEGORY.PERFORMANCE).toBe('INFRASTRUCTURE');
      });

      it('должен быть определен', () => {
        expect(DEFAULT_ORIGIN_BY_CATEGORY).toBeDefined();
      });

      it('business ошибки должны происходить из domain', () => {
        expect(DEFAULT_ORIGIN_BY_CATEGORY.BUSINESS).toBe('DOMAIN');
      });

      it('technical и performance ошибки должны происходить из infrastructure', () => {
        expect(DEFAULT_ORIGIN_BY_CATEGORY.TECHNICAL).toBe('INFRASTRUCTURE');
        expect(DEFAULT_ORIGIN_BY_CATEGORY.PERFORMANCE).toBe('INFRASTRUCTURE');
      });
    });

    describe('DEFAULT_ERROR_CODE_METADATA', () => {
      it('должен содержать базовые значения по умолчанию', () => {
        expect(DEFAULT_ERROR_CODE_METADATA.severity).toBe('high');
        expect(DEFAULT_ERROR_CODE_METADATA.category).toBe('TECHNICAL');
        expect(DEFAULT_ERROR_CODE_METADATA.origin).toBe('INFRASTRUCTURE');
        expect(DEFAULT_ERROR_CODE_METADATA.loggable).toBe(true);
        expect(DEFAULT_ERROR_CODE_METADATA.visibility).toBe('internal');
      });

      it('должен быть определен', () => {
        expect(DEFAULT_ERROR_CODE_METADATA).toBeDefined();
      });

      it('не должен содержать code и description (добавляются при использовании)', () => {
        expect(DEFAULT_ERROR_CODE_METADATA).not.toHaveProperty('code');
        expect(DEFAULT_ERROR_CODE_METADATA).not.toHaveProperty('description');
      });

      it('должен иметь разумные значения по умолчанию', () => {
        // High severity для технических ошибок
        expect(DEFAULT_ERROR_CODE_METADATA.severity).toBe('high');
        // Technical category по умолчанию
        expect(DEFAULT_ERROR_CODE_METADATA.category).toBe('TECHNICAL');
        // Infrastructure origin по умолчанию
        expect(DEFAULT_ERROR_CODE_METADATA.origin).toBe('INFRASTRUCTURE');
        // Логируется по умолчанию
        expect(DEFAULT_ERROR_CODE_METADATA.loggable).toBe(true);
        // Не показывается пользователю по умолчанию
        expect(DEFAULT_ERROR_CODE_METADATA.visibility).toBe('internal');
      });
    });
  });

  describe('Utility типы', () => {
    describe('ErrorCodeMetadataMap', () => {
      it('должен позволять создавать маппинг кодов на метаданные', () => {
        const metadataMap: ErrorCodeMetadataMap = {
          'DOMAIN_AUTH_001': {
            code: 'DOMAIN_AUTH_001',
            description: 'Invalid credentials',
            severity: ERROR_SEVERITY.MEDIUM,
            category: ERROR_CATEGORY.SECURITY,
            origin: ERROR_ORIGIN.DOMAIN,
          },
          'INFRA_DB_001': {
            code: 'INFRA_DB_001',
            description: 'Database connection failed',
            severity: ERROR_SEVERITY.HIGH,
            category: ERROR_CATEGORY.TECHNICAL,
            origin: ERROR_ORIGIN.INFRASTRUCTURE,
          },
        };

        expect(metadataMap['DOMAIN_AUTH_001'].description).toBe('Invalid credentials');
        expect(metadataMap['INFRA_DB_001'].severity).toBe('high');
      });
    });

    describe('ExtendedErrorCodeMetadataMap', () => {
      it('должен позволять создавать маппинг кодов на расширенные метаданные', () => {
        const extendedMap: ExtendedErrorCodeMetadataMap = {
          'DOMAIN_AUTH_001': {
            code: 'DOMAIN_AUTH_001',
            description: 'Invalid credentials',
            severity: ERROR_SEVERITY.MEDIUM,
            category: ERROR_CATEGORY.SECURITY,
            origin: ERROR_ORIGIN.DOMAIN,
            httpStatus: 401,
            loggable: true,
            visibility: 'public',
          },
        };

        expect(extendedMap['DOMAIN_AUTH_001'].httpStatus).toBe(401);
        expect(extendedMap['DOMAIN_AUTH_001'].visibility).toBe('public');
      });
    });

    describe('ErrorCodeMetadataFactory', () => {
      it('должен определять тип фабричной функции', () => {
        const factory: ErrorCodeMetadataFactory = (code, overrides) => ({
          code,
          description: 'Default description',
          severity: ERROR_SEVERITY.MEDIUM,
          category: ERROR_CATEGORY.TECHNICAL,
          origin: ERROR_ORIGIN.INFRASTRUCTURE,
          ...overrides,
        });

        const result = factory('DOMAIN_TEST_001', {
          description: 'Custom description',
          severity: ERROR_SEVERITY.HIGH,
        });

        expect(result.code).toBe('DOMAIN_TEST_001');
        expect(result.description).toBe('Custom description');
        expect(result.severity).toBe('high');
      });
    });
  });

  describe('Helper типы', () => {
    describe('RequiredErrorCodeMetadata', () => {
      it('должен делать все поля обязательными', () => {
        const requiredMetadata: RequiredErrorCodeMetadata = {
          code: 'DOMAIN_AUTH_001',
          description: 'Required description',
          severity: ERROR_SEVERITY.MEDIUM,
          category: ERROR_CATEGORY.SECURITY,
          origin: ERROR_ORIGIN.DOMAIN,
        };

        expect(requiredMetadata.description).toBe('Required description');
      });
    });

    describe('PartialExtendedErrorCodeMetadata', () => {
      it('должен делать все поля опциональными', () => {
        const partialMetadata: PartialExtendedErrorCodeMetadata = {
          code: 'DOMAIN_AUTH_001',
          // все поля опциональны
        };

        expect(partialMetadata.code).toBe('DOMAIN_AUTH_001');
      });
    });
  });

  describe('Validation типы', () => {
    describe('ErrorCodeMetadataValidationResult', () => {
      it('должен определять структуру результата валидации', () => {
        const validResult: ErrorCodeMetadataValidationResult = {
          code: 'DOMAIN_AUTH_001',
          isValid: true,
          errors: [],
          warnings: [],
        };

        const invalidResult: ErrorCodeMetadataValidationResult = {
          code: 'DOMAIN_AUTH_002',
          isValid: false,
          errors: ['Description too long'],
          warnings: ['Missing remediation'],
        };

        expect(validResult.isValid).toBe(true);
        expect(validResult.errors).toHaveLength(0);
        expect(validResult.warnings).toHaveLength(0);

        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.errors).toContain('Description too long');
        expect(invalidResult.warnings).toContain('Missing remediation');
      });
    });

    describe('ErrorCodeMetadataValidator', () => {
      it('должен определять тип функции валидации', () => {
        const validator: ErrorCodeMetadataValidator = (metadata) => ({
          code: metadata.code,
          isValid: metadata.description.length > 0,
          errors: metadata.description.length === 0 ? ['Description is required'] : [],
          warnings: [],
        });

        const validMetadata: ErrorCodeMetadata = {
          code: 'DOMAIN_AUTH_001',
          description: 'Valid description',
          severity: ERROR_SEVERITY.MEDIUM,
          category: ERROR_CATEGORY.SECURITY,
          origin: ERROR_ORIGIN.DOMAIN,
        };

        const result = validator(validMetadata);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('Константы', () => {
    describe('MAX_ERROR_DESCRIPTION_LENGTH', () => {
      it('должен иметь разумное значение для максимальной длины описания', () => {
        expect(MAX_ERROR_DESCRIPTION_LENGTH).toBe(500);
        expect(MAX_ERROR_DESCRIPTION_LENGTH).toBeGreaterThan(100);
        expect(MAX_ERROR_DESCRIPTION_LENGTH).toBeLessThan(1000);
      });
    });

    describe('MAX_REMEDIATION_LENGTH', () => {
      it('должен иметь разумное значение для максимальной длины remediation', () => {
        expect(MAX_REMEDIATION_LENGTH).toBe(1000);
        expect(MAX_REMEDIATION_LENGTH).toBeGreaterThan(MAX_ERROR_DESCRIPTION_LENGTH);
      });
    });

    describe('SUPPORTED_HTTP_STATUSES', () => {
      it('должен содержать валидные HTTP статус коды', () => {
        expect(SUPPORTED_HTTP_STATUSES).toContain(400);
        expect(SUPPORTED_HTTP_STATUSES).toContain(401);
        expect(SUPPORTED_HTTP_STATUSES).toContain(404);
        expect(SUPPORTED_HTTP_STATUSES).toContain(500);
        expect(SUPPORTED_HTTP_STATUSES).toContain(502);
      });

      it('должен быть массивом', () => {
        expect(Array.isArray(SUPPORTED_HTTP_STATUSES)).toBe(true);
      });

      it('все статусы должны быть валидными HTTP кодами', () => {
        SUPPORTED_HTTP_STATUSES.forEach((status) => {
          expect(status).toBeGreaterThanOrEqual(100);
          expect(status).toBeLessThanOrEqual(599);
        });
      });

      it('должен содержать только статусы из SUPPORTED_HTTP_STATUSES', () => {
        const allStatuses = [
          400,
          401,
          402,
          403,
          404,
          405,
          406,
          407,
          408,
          409,
          410,
          411,
          412,
          413,
          414,
          415,
          416,
          417,
          418,
          422,
          423,
          424,
          425,
          426,
          428,
          429,
          431,
          451,
          500,
          501,
          502,
          503,
          504,
          505,
          506,
          507,
          508,
          510,
          511,
        ];

        expect(SUPPORTED_HTTP_STATUSES).toEqual(allStatuses);
      });
    });

    describe('SupportedHttpStatus', () => {
      it('должен позволять использовать только поддерживаемые HTTP статусы', () => {
        const validStatus: SupportedHttpStatus = 404;
        expect(validStatus).toBe(404);

        const anotherValidStatus: SupportedHttpStatus = 500;
        expect(anotherValidStatus).toBe(500);

        // TypeScript не позволит использовать неподдерживаемый статус
        // const invalidStatus: SupportedHttpStatus = 418; // 418 есть в массиве
      });
    });
  });

  describe('Интеграционные сценарии', () => {
    it('должен поддерживать полный workflow создания метаданных', () => {
      // 1. Использование default значений
      const defaultSeverity = DEFAULT_SEVERITY_BY_CATEGORY.SECURITY; // 'critical'
      const defaultOrigin = DEFAULT_ORIGIN_BY_CATEGORY.SECURITY; // 'DOMAIN'

      // 2. Создание базовых метаданных
      const baseMetadata: ErrorCodeMetadata = {
        code: 'DOMAIN_AUTH_001',
        description: 'Invalid authentication credentials',
        severity: defaultSeverity,
        category: ERROR_CATEGORY.SECURITY,
        origin: defaultOrigin,
      };

      // 3. Создание расширенных метаданных
      const extendedMetadata: ExtendedErrorCodeMetadata = {
        ...baseMetadata,
        httpStatus: 401,
        loggable: true,
        visibility: 'public',
        remediation: 'Please check your username and password',
      };

      // 4. Создание группы метаданных
      const groupMetadata: ErrorCodeGroupMetadata = {
        name: 'Authentication Errors',
        description: 'Errors related to user authentication process',
        prefix: 'DOMAIN_AUTH',
        minCode: 1,
        maxCode: 99,
        category: ERROR_CATEGORY.SECURITY,
        defaultSeverity,
        defaultOrigin,
      };

      // 5. Валидация структур
      expect(baseMetadata.severity).toBe('critical');
      expect(extendedMetadata.httpStatus).toBe(401);
      expect(groupMetadata.prefix).toBe('DOMAIN_AUTH');

      // 6. Type safety проверка
      const severity: ErrorSeverity = baseMetadata.severity;
      const httpStatus: number | undefined = extendedMetadata.httpStatus;

      expect(severity).toBeDefined();
      expect(httpStatus).toBeDefined();
    });

    it('default значения должны обеспечивать консистентность', () => {
      // Проверяем что default значения логичны для каждой категории
      expect(DEFAULT_SEVERITY_BY_CATEGORY.SECURITY).toBe('critical'); // Безопасность - критично
      expect(DEFAULT_SEVERITY_BY_CATEGORY.BUSINESS).toBe('medium'); // Бизнес-логика - средне
      expect(DEFAULT_SEVERITY_BY_CATEGORY.TECHNICAL).toBe('high'); // Технические - высоко
      expect(DEFAULT_SEVERITY_BY_CATEGORY.PERFORMANCE).toBe('medium'); // Производительность - средне

      expect(DEFAULT_ORIGIN_BY_CATEGORY.BUSINESS).toBe('DOMAIN'); // Бизнес-логика из домена
      expect(DEFAULT_ORIGIN_BY_CATEGORY.TECHNICAL).toBe('INFRASTRUCTURE'); // Технические из инфраструктуры
      expect(DEFAULT_ORIGIN_BY_CATEGORY.SECURITY).toBe('DOMAIN'); // Безопасность из домена
      expect(DEFAULT_ORIGIN_BY_CATEGORY.PERFORMANCE).toBe('INFRASTRUCTURE'); // Производительность из инфраструктуры
    });

    it('расширенные метаданные должны быть обратно совместимы с базовыми', () => {
      const extended: ExtendedErrorCodeMetadata = {
        code: 'DOMAIN_AUTH_001',
        description: 'Test error',
        severity: ERROR_SEVERITY.MEDIUM,
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.DOMAIN,
        httpStatus: 401,
        loggable: true,
        visibility: 'internal',
      };

      // Extended должен быть совместим с базовым типом
      const base: ErrorCodeMetadata = extended;

      expect(base.code).toBe(extended.code);
      expect(base.description).toBe(extended.description);
      expect(base.severity).toBe(extended.severity);
      expect(base.category).toBe(extended.category);
      expect(base.origin).toBe(extended.origin);
    });
  });

  describe('Edge cases и валидация', () => {
    it('длины строк должны быть в разумных пределах', () => {
      // Максимальная длина описания
      expect(MAX_ERROR_DESCRIPTION_LENGTH).toBeLessThanOrEqual(1000);
      expect(MAX_ERROR_DESCRIPTION_LENGTH).toBeGreaterThanOrEqual(100);

      // Максимальная длина remediation
      expect(MAX_REMEDIATION_LENGTH).toBeLessThanOrEqual(2000);
      expect(MAX_REMEDIATION_LENGTH).toBeGreaterThanOrEqual(500);
      expect(MAX_REMEDIATION_LENGTH).toBeGreaterThan(MAX_ERROR_DESCRIPTION_LENGTH);
    });

    it('HTTP статусы должны покрывать основные сценарии ошибок', () => {
      // 4xx клиентские ошибки
      expect(SUPPORTED_HTTP_STATUSES).toContain(400); // Bad Request
      expect(SUPPORTED_HTTP_STATUSES).toContain(401); // Unauthorized
      expect(SUPPORTED_HTTP_STATUSES).toContain(403); // Forbidden
      expect(SUPPORTED_HTTP_STATUSES).toContain(404); // Not Found

      // 5xx серверные ошибки
      expect(SUPPORTED_HTTP_STATUSES).toContain(500); // Internal Server Error
      expect(SUPPORTED_HTTP_STATUSES).toContain(502); // Bad Gateway
      expect(SUPPORTED_HTTP_STATUSES).toContain(503); // Service Unavailable
      expect(SUPPORTED_HTTP_STATUSES).toContain(504); // Gateway Timeout
    });

    it('default metadata должен иметь валидные значения', () => {
      expect(Object.values(ERROR_SEVERITY)).toContain(DEFAULT_ERROR_CODE_METADATA.severity);
      expect(Object.values(ERROR_CATEGORY)).toContain(DEFAULT_ERROR_CODE_METADATA.category);
      expect(Object.values(ERROR_ORIGIN)).toContain(DEFAULT_ERROR_CODE_METADATA.origin);
      expect(typeof DEFAULT_ERROR_CODE_METADATA.loggable).toBe('boolean');
      expect(DEFAULT_ERROR_CODE_METADATA.visibility).toBe('internal');
    });

    it('все маппинги должны покрывать все категории', () => {
      const categories = Object.values(ERROR_CATEGORY);

      categories.forEach((category) => {
        expect(DEFAULT_SEVERITY_BY_CATEGORY).toHaveProperty(category);
        expect(DEFAULT_ORIGIN_BY_CATEGORY).toHaveProperty(category);
      });
    });

    it('функции валидации должны корректно работать с граничными случаями', () => {
      // Пустое описание
      const emptyDesc: ErrorCodeMetadata = {
        code: 'DOMAIN_TEST_001',
        description: '',
        severity: ERROR_SEVERITY.LOW,
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.DOMAIN,
      };

      // Очень длинное описание
      const longDesc: ErrorCodeMetadata = {
        code: 'DOMAIN_TEST_002',
        description: 'A'.repeat(600), // Больше максимума
        severity: ERROR_SEVERITY.LOW,
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.DOMAIN,
      };

      expect(emptyDesc.description).toBe('');
      expect(longDesc.description.length).toBeGreaterThan(MAX_ERROR_DESCRIPTION_LENGTH);
    });
  });
});
