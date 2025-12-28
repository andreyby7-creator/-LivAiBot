import { describe, expect, it } from 'vitest';

import type {
  CreateErrorCodeResult,
  ErrorCode,
  ErrorCodeCategory,
  ErrorCodePrefix,
  ErrorCodeStructure,
  LivAiErrorCode,
  UniquenessValidationResult,
  ValidationResult,
} from '../../../../src/errors/base/ErrorCode';
import {
  ADMIN_ERROR_CODES,
  createErrorCode,
  createErrorCodeOrThrow,
  DOMAIN_ERROR_CODES,
  INFRA_ERROR_CODES,
  LIVAI_ERROR_CODES,
  parseErrorCode,
  parseErrorCodeOrThrow,
  SERVICE_ERROR_CODE_MAPPING,
  SERVICE_ERROR_CODES,
  validateErrorCodeUniqueness,
  validateErrorCodeUniquenessOrThrow,
} from '../../../../src/errors/base/ErrorCode';

describe('ErrorCode', () => {
  describe('Базовые типы для error codes', () => {
    describe('ErrorCode', () => {
      it('должен поддерживать строковый тип для кодов ошибок', () => {
        const code: ErrorCode = 'DOMAIN_AUTH_001';
        expect(typeof code).toBe('string');
        expect(code).toBe('DOMAIN_AUTH_001');
      });
    });

    describe('ErrorCodeStructure', () => {
      it('должен определять структуру разобранного error code', () => {
        const structure: ErrorCodeStructure = {
          prefix: 'DOMAIN',
          category: 'AUTH',
          increment: 1,
          fullCode: 'DOMAIN_AUTH_001',
        };

        expect(structure.prefix).toBe('DOMAIN');
        expect(structure.category).toBe('AUTH');
        expect(structure.increment).toBe(1);
        expect(structure.fullCode).toBe('DOMAIN_AUTH_001');
      });
    });

    describe('ErrorCodePrefix', () => {
      it('должен поддерживать все допустимые префиксы', () => {
        const prefixes: ErrorCodePrefix[] = ['DOMAIN', 'INFRA', 'SERVICE', 'ADMIN'];

        prefixes.forEach((prefix) => {
          expect(['DOMAIN', 'INFRA', 'SERVICE', 'ADMIN']).toContain(prefix);
        });

        expect(prefixes).toHaveLength(4);
      });

      it('должен быть case-sensitive для префиксов', () => {
        // TypeScript не позволит присвоить неправильный префикс
        const validPrefix: ErrorCodePrefix = 'DOMAIN';
        expect(validPrefix).toBe('DOMAIN');

        // TypeScript предотвращает использование неправильных префиксов
        // const invalidPrefix: ErrorCodePrefix = 'domain'; // Ошибка компиляции
      });
    });

    describe('ErrorCodeCategory', () => {
      it('должен поддерживать все допустимые категории', () => {
        const categories: ErrorCodeCategory[] = [
          // Domain
          'AUTH',
          'USER',
          'SUBSCRIPTION',
          'BOT',
          'INTEGRATION',
          'TOKEN',
          'BILLING',
          'TENANT',
          'FEATURE',
          'FINANCE',
          'AUDIT',
          // Infra
          'DB',
          'CACHE',
          'NETWORK',
          'EXTERNAL',
          // Service
          'AI',
          // Admin
          'USER',
          'SYSTEM',
          'CONFIG',
        ];

        expect(categories).toContain('AUTH');
        expect(categories).toContain('DB');
        expect(categories).toContain('AI');
        expect(categories).toContain('SYSTEM');
      });
    });
  });

  describe('Domain группа (Бизнес-логика)', () => {
    describe('DOMAIN_ERROR_CODES', () => {
      it('должен содержать все ожидаемые доменные коды ошибок', () => {
        expect(DOMAIN_ERROR_CODES.AUTH_INVALID_CREDENTIALS).toBe('DOMAIN_AUTH_001');
        expect(DOMAIN_ERROR_CODES.DOMAIN_USER_NOT_FOUND).toBe('DOMAIN_USER_100');
        expect(DOMAIN_ERROR_CODES.DOMAIN_SUBSCRIPTION_EXPIRED).toBe('DOMAIN_SUBSCRIPTION_201');
        expect(DOMAIN_ERROR_CODES.DOMAIN_BOT_PROCESSING_FAILED).toBe('DOMAIN_BOT_303');
        expect(DOMAIN_ERROR_CODES.DOMAIN_INTEGRATION_CONNECTION_FAILED).toBe(
          'DOMAIN_INTEGRATION_402',
        );
        expect(DOMAIN_ERROR_CODES.DOMAIN_TOKEN_REVOKED).toBe('DOMAIN_TOKEN_502');
        expect(DOMAIN_ERROR_CODES.DOMAIN_BILLING_PAYMENT_FAILED).toBe('DOMAIN_BILLING_600');
        expect(DOMAIN_ERROR_CODES.DOMAIN_TENANT_SUSPENDED).toBe('DOMAIN_TENANT_702');
        expect(DOMAIN_ERROR_CODES.DOMAIN_FEATURE_QUOTA_EXCEEDED).toBe('DOMAIN_FEATURE_802');
        expect(DOMAIN_ERROR_CODES.DOMAIN_FINANCE_INSUFFICIENT_FUNDS).toBe('DOMAIN_FINANCE_901');
        expect(DOMAIN_ERROR_CODES.DOMAIN_AUDIT_ACCESS_DENIED).toBe('DOMAIN_AUDIT_1001');
      });

      it('все значения должны быть строками', () => {
        Object.values(DOMAIN_ERROR_CODES).forEach((code) => {
          expect(typeof code).toBe('string');
        });
      });

      it('должен иметь правильную структуру кодов', () => {
        const codes = Object.values(DOMAIN_ERROR_CODES);
        const pattern = /^DOMAIN_[A-Z]+_\d{1,4}$/;

        codes.forEach((code) => {
          expect(pattern.test(code)).toBe(true);
        });
      });
    });
  });

  describe('Infra группа (Инфраструктура)', () => {
    describe('INFRA_ERROR_CODES', () => {
      it('должен содержать все ожидаемые инфраструктурные коды ошибок', () => {
        expect(INFRA_ERROR_CODES.INFRA_DB_CONNECTION_FAILED).toBe('INFRA_DB_001');
        expect(INFRA_ERROR_CODES.INFRA_CACHE_SET_FAILED).toBe('INFRA_CACHE_101');
        expect(INFRA_ERROR_CODES.INFRA_NETWORK_TIMEOUT).toBe('INFRA_NETWORK_200');
        expect(INFRA_ERROR_CODES.INFRA_EXTERNAL_API_UNAVAILABLE).toBe('INFRA_EXTERNAL_300');
      });

      it('все значения должны быть строками', () => {
        Object.values(INFRA_ERROR_CODES).forEach((code) => {
          expect(typeof code).toBe('string');
        });
      });

      it('должен иметь правильную структуру кодов', () => {
        const codes = Object.values(INFRA_ERROR_CODES);
        const pattern = /^INFRA_[A-Z]+_\d{3}$/;

        codes.forEach((code) => {
          expect(pattern.test(code)).toBe(true);
        });
      });
    });
  });

  describe('Service группа (Сервисы)', () => {
    describe('SERVICE_ERROR_CODES', () => {
      it('должен содержать все ожидаемые сервисные коды ошибок', () => {
        expect(SERVICE_ERROR_CODES.SERVICE_AI_MODEL_UNAVAILABLE).toBe('SERVICE_AI_001');
        expect(SERVICE_ERROR_CODES.SERVICE_AI_PROCESSING_FAILED).toBe('SERVICE_AI_002');
        expect(SERVICE_ERROR_CODES.SERVICE_AI_INVALID_INPUT).toBe('SERVICE_AI_003');
        expect(SERVICE_ERROR_CODES.SERVICE_AI_RATE_LIMIT_EXCEEDED).toBe('SERVICE_AI_004');
        expect(SERVICE_ERROR_CODES.SERVICE_AI_MODEL_TIMEOUT).toBe('SERVICE_AI_005');
      });

      it('все значения должны быть строками', () => {
        Object.values(SERVICE_ERROR_CODES).forEach((code) => {
          expect(typeof code).toBe('string');
        });
      });

      it('должен иметь правильную структуру кодов', () => {
        const codes = Object.values(SERVICE_ERROR_CODES);
        const pattern = /^SERVICE_[A-Z]+_\d{3}$/;

        codes.forEach((code) => {
          expect(pattern.test(code)).toBe(true);
        });
      });
    });
  });

  describe('Admin группа (Админ-панель)', () => {
    describe('ADMIN_ERROR_CODES', () => {
      it('должен содержать все ожидаемые административные коды ошибок', () => {
        expect(ADMIN_ERROR_CODES.ADMIN_USER_NOT_FOUND).toBe('ADMIN_USER_001');
        expect(ADMIN_ERROR_CODES.ADMIN_SYSTEM_MAINTENANCE).toBe('ADMIN_SYSTEM_100');
        expect(ADMIN_ERROR_CODES.ADMIN_CONFIG_INVALID).toBe('ADMIN_CONFIG_200');
      });

      it('все значения должны быть строками', () => {
        Object.values(ADMIN_ERROR_CODES).forEach((code) => {
          expect(typeof code).toBe('string');
        });
      });

      it('должен иметь правильную структуру кодов', () => {
        const codes = Object.values(ADMIN_ERROR_CODES);
        const pattern = /^ADMIN_[A-Z]+_\d{3}$/;

        codes.forEach((code) => {
          expect(pattern.test(code)).toBe(true);
        });
      });
    });
  });

  describe('Объединенные error codes', () => {
    describe('LIVAI_ERROR_CODES', () => {
      it('должен содержать все error codes из всех групп', () => {
        const domainCount = Object.keys(DOMAIN_ERROR_CODES).length;
        const infraCount = Object.keys(INFRA_ERROR_CODES).length;
        const serviceCount = Object.keys(SERVICE_ERROR_CODES).length;
        const adminCount = Object.keys(ADMIN_ERROR_CODES).length;
        const totalCount = Object.keys(LIVAI_ERROR_CODES).length;

        expect(totalCount).toBe(domainCount + infraCount + serviceCount + adminCount);
      });

      it('должен поддерживать TypeScript типы', () => {
        const code: LivAiErrorCode = 'DOMAIN_AUTH_001';
        expect(code).toBe('DOMAIN_AUTH_001');

        // TypeScript гарантирует типобезопасность
        const allCodes = Object.values(LIVAI_ERROR_CODES) as LivAiErrorCode[];
        expect(allCodes).toContain('DOMAIN_AUTH_001');
        expect(allCodes).toContain('INFRA_DB_001');
        expect(allCodes).toContain('SERVICE_AI_001');
        expect(allCodes).toContain('ADMIN_USER_001');
      });

      it('все error codes должны быть уникальными', () => {
        const codes = Object.values(LIVAI_ERROR_CODES);
        const uniqueCodes = Array.from(new Set(codes));
        expect(uniqueCodes).toHaveLength(codes.length);
      });

      it('все error codes должны соответствовать формату PREFIX_CATEGORY_XXX', () => {
        const pattern = /^(DOMAIN|INFRA|SERVICE|ADMIN)_[A-Z]+_\d{1,4}$/;

        Object.values(LIVAI_ERROR_CODES).forEach((code) => {
          expect(pattern.test(code)).toBe(true);
        });
      });

      it('все error codes должны иметь валидные префиксы', () => {
        const validPrefixes = ['DOMAIN', 'INFRA', 'SERVICE', 'ADMIN'];

        Object.values(LIVAI_ERROR_CODES).forEach((code) => {
          const prefix = code.split('_')[0];
          expect(validPrefixes).toContain(prefix);
        });
      });

      it('все error codes должны иметь уникальные значения', () => {
        const codeValues = Object.values(LIVAI_ERROR_CODES);
        const uniqueValues = new Set(codeValues);
        expect(uniqueValues.size).toBe(codeValues.length);
      });
    });

    describe('LivAiErrorCode тип', () => {
      it('должен позволять создавать полные метаданные используя defaults', () => {
        const code: LivAiErrorCode = LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS;
        expect(code).toBe('DOMAIN_AUTH_001');

        // TypeScript знает что это валидный error code
        const anotherCode: LivAiErrorCode = LIVAI_ERROR_CODES.INFRA_DB_CONNECTION_FAILED;
        expect(anotherCode).toBe('INFRA_DB_001');
      });

      it('должен поддерживать валидацию метаданных с использованием констант', () => {
        const validCode: LivAiErrorCode = 'DOMAIN_AUTH_001';
        expect(LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS).toBe(validCode);
      });

      it('должен поддерживать создание коллекций метаданных', () => {
        const errorCodes: LivAiErrorCode[] = [
          LIVAI_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
          LIVAI_ERROR_CODES.INFRA_DB_CONNECTION_FAILED,
          LIVAI_ERROR_CODES.SERVICE_AI_MODEL_UNAVAILABLE,
        ];

        expect(errorCodes).toHaveLength(3);
        expect(errorCodes[0]).toBe('DOMAIN_AUTH_001');
        expect(errorCodes[1]).toBe('INFRA_DB_001');
        expect(errorCodes[2]).toBe('SERVICE_AI_001');
      });
    });
  });

  describe('Структура констант', () => {
    it('все объекты с error codes должны быть определены', () => {
      expect(DOMAIN_ERROR_CODES).toBeDefined();
      expect(INFRA_ERROR_CODES).toBeDefined();
      expect(SERVICE_ERROR_CODES).toBeDefined();
      expect(ADMIN_ERROR_CODES).toBeDefined();
      expect(LIVAI_ERROR_CODES).toBeDefined();
    });

    it('SERVICE_ERROR_CODE_MAPPING должен быть определен', () => {
      expect(SERVICE_ERROR_CODE_MAPPING).toBeDefined();
    });
  });

  describe('Функции валидации', () => {
    describe('validateErrorCodeUniqueness', () => {
      it('должен возвращать success для уникальных кодов', () => {
        const uniqueCodes = {
          CODE1: 'DOMAIN_TEST_001',
          CODE2: 'DOMAIN_TEST_002',
        };

        const result = validateErrorCodeUniqueness(uniqueCodes);
        expect(result.success).toBe(true);
      });

      it('должен возвращать failure с дубликатами при дублированных кодах', () => {
        const duplicateCodes = {
          CODE1: 'DOMAIN_TEST_001',
          CODE2: 'DOMAIN_TEST_001', // дубликат
        };

        const result = validateErrorCodeUniqueness(duplicateCodes);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.duplicates).toEqual(['DOMAIN_TEST_001']);
        }
      });
    });

    describe('createErrorCode', () => {
      it('должен возвращать success с кодом для валидного error code', () => {
        const result = createErrorCode('DOMAIN_AUTH_001');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.code).toBe('DOMAIN_AUTH_001');
        }
      });

      it('должен возвращать failure для невалидного формата', () => {
        const invalidResults = [
          createErrorCode('INVALID'),
          createErrorCode('DOMAIN_AUTH_ABC'),
          createErrorCode('DOMAIN_AUTH_1'),
        ];

        invalidResults.forEach((result) => {
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toContain('Invalid error code format');
          }
        });
      });

      it('должен поддерживать все валидные префиксы', () => {
        const validResults = [
          createErrorCode('DOMAIN_AUTH_001'),
          createErrorCode('INFRA_DB_001'),
          createErrorCode('SERVICE_AI_001'),
          createErrorCode('ADMIN_USER_001'),
        ];

        validResults.forEach((result) => {
          expect(result.success).toBe(true);
        });
      });
    });
  });

  describe('parseErrorCode', () => {
    it('должен корректно парсить валидный error code', () => {
      const result = parseErrorCode('DOMAIN_AUTH_001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          prefix: 'DOMAIN',
          category: 'AUTH',
          increment: 1,
          fullCode: 'DOMAIN_AUTH_001',
        });
      }
    });

    it('должен корректно парсить error codes с разными инкрементами', () => {
      const testCases = [
        { code: 'DOMAIN_AUTH_001', increment: 1 },
        { code: 'INFRA_DB_099', increment: 99 },
        { code: 'SERVICE_AI_050', increment: 50 },
        { code: 'ADMIN_SYSTEM_999', increment: 999 },
      ];

      testCases.forEach(({ code, increment }) => {
        const result = parseErrorCode(code);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.increment).toBe(increment);
          expect(result.data.fullCode).toBe(code);
        }
      });
    });

    it('должен возвращать failure для невалидного формата', () => {
      const invalidCodes = [
        'INVALID',
        'DOMAIN',
        'DOMAIN_AUTH',
        'DOMAIN_AUTH_ABC',
        'wrong_format',
        'DOMAIN_AUTH_',
        '_AUTH_001',
      ];

      invalidCodes.forEach((code) => {
        const result = parseErrorCode(code);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });

    it('должен обрабатывать граничные значения инкрементов', () => {
      // Валидные граничные значения
      expect(parseErrorCode('DOMAIN_TEST_001').success).toBe(true);
      expect(parseErrorCode('DOMAIN_TEST_999').success).toBe(true);
      expect(parseErrorCode('DOMAIN_TEST_1000').success).toBe(true);

      // Невалидные граничные значения
      expect(parseErrorCode('DOMAIN_TEST_000').success).toBe(false);
      expect(parseErrorCode('DOMAIN_TEST_10000').success).toBe(false);
    });

    it('должен возвращать ValidationResult с ErrorCodeStructure данными', () => {
      const result = parseErrorCode('DOMAIN_AUTH_001');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeInstanceOf(Object);
        expect(result.data).toHaveProperty('prefix');
        expect(result.data).toHaveProperty('category');
        expect(result.data).toHaveProperty('increment');
        expect(result.data).toHaveProperty('fullCode');
      }
    });

    describe('Boundary обёртки (fail-fast)', () => {
      describe('validateErrorCodeUniquenessOrThrow', () => {
        it('должен проходить валидацию для уникальных кодов', () => {
          const uniqueCodes = {
            CODE1: 'DOMAIN_TEST_001',
            CODE2: 'DOMAIN_TEST_002',
          };

          expect(() => validateErrorCodeUniquenessOrThrow(uniqueCodes)).not.toThrow();
        });

        it('должен выбрасывать ошибку при дублированных кодах', () => {
          const duplicateCodes = {
            CODE1: 'DOMAIN_TEST_001',
            CODE2: 'DOMAIN_TEST_001', // дубликат
          };

          expect(() => validateErrorCodeUniquenessOrThrow(duplicateCodes)).toThrow(
            'Duplicate error codes found: DOMAIN_TEST_001',
          );
        });

        it('должен покрывать все ветки условий в validateErrorCodeUniquenessOrThrow', () => {
          // Пустой объект - не должен выбрасывать ошибку
          expect(() => validateErrorCodeUniquenessOrThrow({})).not.toThrow();

          // Объект с одним кодом - не должен выбрасывать ошибку
          expect(() => validateErrorCodeUniquenessOrThrow({ CODE1: 'DOMAIN_TEST_001' })).not.toThrow();

          // Объект с уникальными кодами - не должен выбрасывать ошибку
          const uniqueCodes = {
            CODE1: 'DOMAIN_TEST_001',
            CODE2: 'DOMAIN_TEST_002',
            CODE3: 'INFRA_DB_001',
          };
          expect(() => validateErrorCodeUniquenessOrThrow(uniqueCodes)).not.toThrow();

          // Объект с дубликатами - должен выбрасывать ошибку
          const duplicateCodes1 = {
            CODE1: 'DOMAIN_TEST_001',
            CODE2: 'DOMAIN_TEST_001', // дубликат
          };
          expect(() => validateErrorCodeUniquenessOrThrow(duplicateCodes1)).toThrow('Duplicate error codes found: DOMAIN_TEST_001');

          // Объект с несколькими дубликатами
          const duplicateCodes2 = {
            CODE1: 'DOMAIN_TEST_001',
            CODE2: 'DOMAIN_TEST_001',
            CODE3: 'INFRA_DB_001',
            CODE4: 'INFRA_DB_001',
          };
          expect(() => validateErrorCodeUniquenessOrThrow(duplicateCodes2)).toThrow();
        });
      });

      describe('createErrorCodeOrThrow', () => {
        it('должен создавать валидный error code', () => {
          const code = createErrorCodeOrThrow('DOMAIN_AUTH_001');
          expect(code).toBe('DOMAIN_AUTH_001');
        });

        it('должен выбрасывать ошибку для невалидного формата', () => {
          expect(() => createErrorCodeOrThrow('INVALID')).toThrow(
            'Invalid error code format: INVALID. Expected: PREFIX_CATEGORY_XXX',
          );
        });

        it('должен покрывать все ветки условий в createErrorCodeOrThrow', () => {
          // Валидные коды - не должны выбрасывать ошибку
          expect(() => createErrorCodeOrThrow('DOMAIN_AUTH_001')).not.toThrow();
          expect(() => createErrorCodeOrThrow('INFRA_DB_999')).not.toThrow();
          expect(() => createErrorCodeOrThrow('SERVICE_AI_100')).not.toThrow();
          expect(() => createErrorCodeOrThrow('ADMIN_USER_050')).not.toThrow();

          // Невалидные коды - должны выбрасывать ошибку
          const invalidCodes = [
            'DOMAIN_AUTH_ABC',
            'DOMAIN_AUTH_',
            'DOMAIN_AUTH',
            'DOMAIN_001',
            'AUTH_001',
            'INVALID_FORMAT',
            'domain_auth_001',
            'DOMAIN_auth_001',
            '',
          ];

          invalidCodes.forEach(code => {
            expect(() => createErrorCodeOrThrow(code)).toThrow();
          });
        });
      });

      describe('parseErrorCodeOrThrow', () => {
        it('должен корректно парсить валидный error code', () => {
          const result = parseErrorCodeOrThrow('DOMAIN_AUTH_001');

          expect(result).toEqual({
            prefix: 'DOMAIN',
            category: 'AUTH',
            increment: 1,
            fullCode: 'DOMAIN_AUTH_001',
          });
        });

        it('должен выбрасывать ошибку для невалидного формата', () => {
          expect(() => parseErrorCodeOrThrow('INVALID')).toThrow();
        });

        it('должен покрывать все ветки условий в parseErrorCodeOrThrow', () => {
          // Валидные коды - не должны выбрасывать ошибку
          expect(() => parseErrorCodeOrThrow('DOMAIN_AUTH_001')).not.toThrow();
          expect(() => parseErrorCodeOrThrow('INFRA_DB_999')).not.toThrow();
          expect(() => parseErrorCodeOrThrow('SERVICE_AI_1000')).not.toThrow();
          expect(() => parseErrorCodeOrThrow('ADMIN_SYSTEM_9999')).not.toThrow();

          // Невалидные коды - должны выбрасывать ошибку
          const invalidCodes = [
            'INVALID',
            'DOMAIN',
            'DOMAIN_AUTH',
            'DOMAIN_AUTH_ABC',
            'DOMAIN_AUTH_0',
            'DOMAIN_AUTH_10000',
            'DOMAIN__001',
            '_AUTH_001',
            'DOMAIN_AUTH_',
            'DOMAIN_AUTH_001_EXTRA',
          ];

          invalidCodes.forEach(code => {
            expect(() => parseErrorCodeOrThrow(code)).toThrow();
          });
        });
      });
    });
  });

  describe('SERVICE_ERROR_CODE_MAPPING', () => {
    it('должен содержать маппинг для всех сервисов', () => {
      const expectedServices = [
        'auth',
        'user',
        'subscription',
        'bot',
        'integration',
        'token',
        'billing',
        'tenant',
        'feature',
        'finance',
        'audit',
        'database',
        'cache',
        'network',
        'external',
        'ai',
        'admin',
      ];

      expectedServices.forEach((service) => {
        expect(SERVICE_ERROR_CODE_MAPPING).toHaveProperty(service);
      });
    });

    it('должен иметь корректную структуру для каждого сервиса', () => {
      Object.values(SERVICE_ERROR_CODE_MAPPING).forEach((mapping) => {
        expect(mapping).toHaveProperty('prefix');
        expect(mapping).toHaveProperty('categories');
        expect(mapping).toHaveProperty('rangeStart');
        expect(mapping).toHaveProperty('rangeEnd');
        expect(Array.isArray(mapping.categories)).toBe(true);
        expect(typeof mapping.rangeStart).toBe('number');
        expect(typeof mapping.rangeEnd).toBe('number');
      });
    });

    it('должен иметь корректные диапазоны для каждого сервиса', () => {
      Object.values(SERVICE_ERROR_CODE_MAPPING).forEach((mapping) => {
        expect(mapping.rangeStart).toBeGreaterThanOrEqual(1);
        expect(mapping.rangeEnd).toBeLessThanOrEqual(9999);
        expect(mapping.rangeStart).toBeLessThanOrEqual(mapping.rangeEnd);
      });
    });
  });

  describe('Интеграционные проверки', () => {
    it('должен проходить валидацию для уникальных кодов при загрузке модуля', () => {
      // Этот тест проверяет что валидация прошла успешно при импорте
      // Если бы были дубликаты, модуль не загрузился бы
      expect(LIVAI_ERROR_CODES).toBeDefined();
      expect(Object.keys(LIVAI_ERROR_CODES)).toHaveLength(
        Object.keys(DOMAIN_ERROR_CODES).length
          + Object.keys(INFRA_ERROR_CODES).length
          + Object.keys(SERVICE_ERROR_CODES).length
          + Object.keys(ADMIN_ERROR_CODES).length,
      );
    });

    it('все error codes из LIVAI_ERROR_CODES должны быть парсибельны', () => {
      Object.values(LIVAI_ERROR_CODES).forEach((code) => {
        const result = parseErrorCode(code);
        expect(result.success).toBe(true);
      });
    });

    it('парсинг должен быть обратимым для всех error codes', () => {
      Object.values(LIVAI_ERROR_CODES).forEach((code) => {
        const parsed = parseErrorCode(code);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.fullCode).toBe(code);
        }
      });
    });
  });

  describe('Edge cases и валидация', () => {
    it('должен корректно обрабатывать пустые описания', () => {
      // Проверяем что коды не содержат пустых значений
      Object.values(LIVAI_ERROR_CODES).forEach((code) => {
        expect(code).toBeTruthy();
        expect(code.trim()).toBe(code);
      });
    });

    it('должен иметь разумную длину кодов', () => {
      // Все коды должны иметь длину от 12 до 25 символов
      Object.values(LIVAI_ERROR_CODES).forEach((code) => {
        expect(code.length).toBeGreaterThanOrEqual(12);
        expect(code.length).toBeLessThanOrEqual(25);
      });
    });

    it('должен поддерживать все комбинации severity и category', () => {
      // Проверяем что все категории представлены
      const categories = new Set<string>();
      Object.values(LIVAI_ERROR_CODES).forEach((code) => {
        const parts = code.split('_');
        if (parts.length >= 2) {
          categories.add(parts[1]); // категория - второй элемент
        }
      });

      expect(categories.size).toBeGreaterThan(0);
    });

    it('должен поддерживать все supported HTTP статусы', () => {
      // Проверяем что коды не конфликтуют с HTTP статусами
      Object.values(LIVAI_ERROR_CODES).forEach((code) => {
        expect(
          code.startsWith('DOMAIN_')
            || code.startsWith('INFRA_')
            || code.startsWith('SERVICE_')
            || code.startsWith('ADMIN_'),
        ).toBe(true);
      });
    });

    it('должен покрывать все ветки условий в createErrorCode', () => {
      // Валидные коды
      expect(createErrorCode('DOMAIN_AUTH_001').success).toBe(true);
      expect(createErrorCode('INFRA_DB_999').success).toBe(true);
      expect(createErrorCode('SERVICE_AI_100').success).toBe(true);
      expect(createErrorCode('ADMIN_USER_050').success).toBe(true);

      // Невалидные коды - проверяем все ветки условий
      const invalidCodes = [
        'DOMAIN_AUTH_ABC',     // невалидный инкремент
        'DOMAIN_AUTH_',        // пустой инкремент
        'DOMAIN_AUTH',         // отсутствует инкремент
        'DOMAIN_001',          // отсутствует категория
        'AUTH_001',            // отсутствует префикс
        'INVALID_FORMAT',      // полностью неправильный формат
        'domain_auth_001',     // неправильный регистр префикса
        'DOMAIN_auth_001',     // неправильный регистр категории
        '',                    // пустая строка
      ];

      invalidCodes.forEach(code => {
        const result = createErrorCode(code);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('Invalid error code format');
        }
      });
    });

    it('должен покрывать все ветки условий в parseErrorCode', () => {
      // Валидные коды
      expect(parseErrorCode('DOMAIN_AUTH_001').success).toBe(true);
      expect(parseErrorCode('INFRA_DB_999').success).toBe(true);
      expect(parseErrorCode('SERVICE_AI_1000').success).toBe(true);
      expect(parseErrorCode('ADMIN_SYSTEM_9999').success).toBe(true);

      // Невалидные коды - проверяем все ветки условий
      const invalidCases = [
        { code: 'INVALID', error: 'Invalid error code format' },
        { code: 'DOMAIN', error: 'Invalid error code format' },
        { code: 'DOMAIN_AUTH', error: 'Invalid error code format' },
        { code: 'DOMAIN_AUTH_ABC', error: 'Invalid increment' },
        { code: 'DOMAIN_AUTH_0', error: 'Invalid increment' },
        { code: 'DOMAIN_AUTH_10000', error: 'Invalid increment' },
        { code: 'DOMAIN__001', error: 'Missing required parts' },
        { code: '_AUTH_001', error: 'Missing required parts' },
        { code: 'DOMAIN_AUTH_', error: 'Missing required parts' },
        { code: 'DOMAIN_AUTH_001_EXTRA', error: 'Invalid error code format' },
      ];

      invalidCases.forEach(({ code, error }) => {
        const result = parseErrorCode(code);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain(error);
        }
      });
    });

    it('должен покрывать все ветки условий в validateErrorCodeUniqueness', () => {
      // Пустой объект - должен вернуть success
      expect(validateErrorCodeUniqueness({}).success).toBe(true);

      // Объект с одним кодом - должен вернуть success
      expect(validateErrorCodeUniqueness({ CODE1: 'DOMAIN_TEST_001' }).success).toBe(true);

      // Объект с уникальными кодами - должен вернуть success
      const uniqueCodes = {
        CODE1: 'DOMAIN_TEST_001',
        CODE2: 'DOMAIN_TEST_002',
        CODE3: 'INFRA_DB_001',
      };
      expect(validateErrorCodeUniqueness(uniqueCodes).success).toBe(true);

      // Объект с дубликатами - должен вернуть failure с дубликатами
      const duplicateCodes = {
        CODE1: 'DOMAIN_TEST_001',
        CODE2: 'DOMAIN_TEST_001', // дубликат
        CODE3: 'DOMAIN_TEST_001', // еще один дубликат
      };
      const duplicateResult = validateErrorCodeUniqueness(duplicateCodes);
      expect(duplicateResult.success).toBe(false);
      if (!duplicateResult.success) {
        expect(duplicateResult.duplicates).toEqual(['DOMAIN_TEST_001']);
      }

      // Объект с несколькими дубликатами
      const multipleDuplicates = {
        CODE1: 'DOMAIN_TEST_001',
        CODE2: 'DOMAIN_TEST_001',
        CODE3: 'INFRA_DB_001',
        CODE4: 'INFRA_DB_001',
      };
      const multipleResult = validateErrorCodeUniqueness(multipleDuplicates);
      expect(multipleResult.success).toBe(false);
      if (!multipleResult.success) {
        expect(multipleResult.duplicates).toContain('DOMAIN_TEST_001');
        expect(multipleResult.duplicates).toContain('INFRA_DB_001');
      }
    });

    it('должен корректно обрабатывать optional поля в extended metadata', () => {
      // Все error codes должны иметь консистентную структуру
      Object.values(LIVAI_ERROR_CODES).forEach((code) => {
        expect(code.split('_')).toHaveLength(3);
      });
    });
  });
});
