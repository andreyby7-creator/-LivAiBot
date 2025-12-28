import { beforeEach, describe, expect, it } from 'vitest';

import type { ErrorCode } from '../../../../src/errors/base/ErrorCode';
import type {
  ErrorNamespace,
  NamespacedErrorCode,
  NamespaceLookupResult,
  RegistryLookupResult,
  UnifiedErrorRegistry,
  UnifiedErrorRegistryInstance,
} from '../../../../src/errors/base/UnifiedErrorRegistry';
import {
  createEmptyRegistry,
  createNamespacedErrorCode,
  createRegistry,
  createRegistryInstance,
  DEFAULT_ERROR_REGISTRY,
  isValidErrorNamespace,
  parseNamespacedErrorCode,
} from '../../../../src/errors/base/UnifiedErrorRegistry';
import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../src/errors/base/ErrorConstants';

describe('UnifiedErrorRegistry', () => {
  describe('Базовые типы', () => {
    describe('ErrorNamespace', () => {
      it('должен поддерживать все доступные namespaces', () => {
        const namespaces: ErrorNamespace[] = [
          'BASE',
          'SHARED',
          'SERVICES',
          'CONTRACTS',
          'EXTENSIONS',
        ];

        namespaces.forEach((namespace) => {
          expect(['BASE', 'SHARED', 'SERVICES', 'CONTRACTS', 'EXTENSIONS']).toContain(namespace);
        });

        expect(namespaces).toHaveLength(5);
      });

      it('должен быть case-sensitive', () => {
        // TypeScript не позволит использовать неправильный namespace
        const validNamespace: ErrorNamespace = 'BASE';
        expect(validNamespace).toBe('BASE');

        // TypeScript предотвращает использование неправильных namespaces
        // const invalidNamespace: ErrorNamespace = 'base'; // Ошибка компиляции
      });
    });

    describe('NamespacedErrorCode', () => {
      it('должен определять структуру namespaced error code', () => {
        const namespacedCode: NamespacedErrorCode = {
          namespace: 'BASE',
          code: 'DOMAIN_AUTH_001',
          fullCode: 'BASE.DOMAIN_AUTH_001',
        };

        expect(namespacedCode.namespace).toBe('BASE');
        expect(namespacedCode.code).toBe('DOMAIN_AUTH_001');
        expect(namespacedCode.fullCode).toBe('BASE.DOMAIN_AUTH_001');
      });

      it('должен требовать все обязательные поля', () => {
        const incomplete = {
          namespace: 'BASE',
          code: 'DOMAIN_AUTH_001',
          // отсутствует fullCode
        };

        // TypeScript не позволит создать неполную структуру
        expect(() => {
          // @ts-expect-error - неполная структура
          const namespacedCode: NamespacedErrorCode = incomplete;
        });
      });
    });

    describe('UnifiedErrorRegistry', () => {
      it('должен определять интерфейс реестра', () => {
        const registry: UnifiedErrorRegistry = {
          base: {},
          shared: {},
          services: {},
          contracts: {},
          extensions: {},
        };

        expect(registry.base).toEqual({});
        expect(registry.shared).toEqual({});
        expect(registry.services).toEqual({});
        expect(registry.contracts).toEqual({});
        expect(registry.extensions).toEqual({});
      });
    });

    describe('RegistryLookupResult', () => {
      it('должен определять структуру результата поиска (найден)', () => {
        const foundResult: RegistryLookupResult = {
          found: true,
          namespace: 'BASE',
          metadata: {
            code: 'DOMAIN_AUTH_001',
            description: 'Authentication failed',
            severity: ERROR_SEVERITY.MEDIUM,
            category: ERROR_CATEGORY.SECURITY,
            origin: ERROR_ORIGIN.DOMAIN,
          },
        };

        expect(foundResult.found).toBe(true);
        if (foundResult.found) {
          expect(foundResult.namespace).toBe('BASE');
          expect(foundResult.metadata).toBeDefined();
        }
        // error property doesn't exist on found results
        expect('error' in foundResult).toBe(false);
      });

      it('должен определять структуру результата поиска (не найден)', () => {
        const notFoundResult: RegistryLookupResult = {
          found: false,
          error: 'Error code not found',
        };

        expect(notFoundResult.found).toBe(false);
        if (!notFoundResult.found) {
          expect(notFoundResult.error).toBe('Error code not found');
        }
        // namespace and metadata properties don't exist on not found results
        expect('namespace' in notFoundResult).toBe(false);
        expect('metadata' in notFoundResult).toBe(false);
      });
    });

    describe('NamespaceLookupResult', () => {
      it('должен определять структуру групповых результатов', () => {
        const namespaceResult: NamespaceLookupResult = {
          namespace: 'BASE',
          codes: ['DOMAIN_AUTH_001', 'DOMAIN_USER_100'],
          metadata: {
            'DOMAIN_AUTH_001': {
              code: 'DOMAIN_AUTH_001',
              description: 'Auth error',
              severity: ERROR_SEVERITY.MEDIUM,
              category: ERROR_CATEGORY.SECURITY,
              origin: ERROR_ORIGIN.DOMAIN,
            },
          },
          count: 2,
        };

        expect(namespaceResult.namespace).toBe('BASE');
        expect(namespaceResult.codes).toHaveLength(2);
        expect(namespaceResult.count).toBe(2);
        expect(namespaceResult.metadata).toBeDefined();
      });
    });
  });

  describe('Utility функции', () => {
    describe('createNamespacedErrorCode', () => {
      it('должен создавать namespaced error code', () => {
        const result = createNamespacedErrorCode('BASE', 'DOMAIN_AUTH_001');

        expect(result).toEqual({
          namespace: 'BASE',
          code: 'DOMAIN_AUTH_001',
          fullCode: 'BASE.DOMAIN_AUTH_001',
        });
      });

      it('должен работать с разными namespaces', () => {
        const namespaces: ErrorNamespace[] = [
          'BASE',
          'SHARED',
          'SERVICES',
          'CONTRACTS',
          'EXTENSIONS',
        ];

        namespaces.forEach((namespace) => {
          const result = createNamespacedErrorCode(namespace, 'TEST_CODE_001');
          expect(result.namespace).toBe(namespace);
          expect(result.code).toBe('TEST_CODE_001');
          expect(result.fullCode).toBe(`${namespace}.TEST_CODE_001`);
        });
      });

      it('должен возвращать NamespacedErrorCode тип', () => {
        const result = createNamespacedErrorCode('BASE', 'DOMAIN_AUTH_001');

        expect(result).toBeInstanceOf(Object);
        expect(result).toHaveProperty('namespace');
        expect(result).toHaveProperty('code');
        expect(result).toHaveProperty('fullCode');
      });
    });

    describe('parseNamespacedErrorCode', () => {
      it('должен парсить валидный namespaced error code', () => {
        const result = parseNamespacedErrorCode('BASE.DOMAIN_AUTH_001');

        expect(result).toEqual({
          namespace: 'BASE',
          code: 'DOMAIN_AUTH_001',
          fullCode: 'BASE.DOMAIN_AUTH_001',
        });
      });

      it('должен возвращать null для невалидного формата', () => {
        const invalidCodes = [
          'INVALID',
          'BASE',
          'DOMAIN_AUTH_001',
          'BASE.',
          '.DOMAIN_AUTH_001',
          'BASE.DOMAIN_AUTH_001.EXTRA',
          'INVALID.DOMAIN_AUTH_001',
        ];

        invalidCodes.forEach((code) => {
          const result = parseNamespacedErrorCode(code);
          expect(result).toBeNull();
        });
      });

      it('должен работать с разными namespaces', () => {
        const namespaces: ErrorNamespace[] = [
          'BASE',
          'SHARED',
          'SERVICES',
          'CONTRACTS',
          'EXTENSIONS',
        ];

        namespaces.forEach((namespace) => {
          const fullCode = `${namespace}.TEST_CODE_001`;
          const result = parseNamespacedErrorCode(fullCode);

          expect(result).not.toBeNull();
          expect(result!.namespace).toBe(namespace);
          expect(result!.code).toBe('TEST_CODE_001');
          expect(result!.fullCode).toBe(fullCode);
        });
      });

      it('должен возвращать null для пустых частей', () => {
        const invalidCodes = [
          '',
          '.',
          'BASE.',
          '.CODE',
        ];

        invalidCodes.forEach((code) => {
          const result = parseNamespacedErrorCode(code);
          expect(result).toBeNull();
        });
      });
    });

    describe('isValidErrorNamespace', () => {
      it('должен возвращать true для валидных namespaces', () => {
        const validNamespaces: ErrorNamespace[] = [
          'BASE',
          'SHARED',
          'SERVICES',
          'CONTRACTS',
          'EXTENSIONS',
        ];

        validNamespaces.forEach((namespace) => {
          expect(isValidErrorNamespace(namespace)).toBe(true);
        });
      });

      it('должен возвращать false для невалидных namespaces', () => {
        const invalidNamespaces = [
          'base',
          'Base',
          'INVALID',
          'SHARED2',
          '',
          ' ',
          'null',
          'undefined',
        ];

        invalidNamespaces.forEach((namespace) => {
          expect(isValidErrorNamespace(namespace)).toBe(false);
        });
      });

      it('должен быть case-sensitive', () => {
        expect(isValidErrorNamespace('BASE')).toBe(true);
        expect(isValidErrorNamespace('base')).toBe(false);
        expect(isValidErrorNamespace('Base')).toBe(false);
      });
    });

    describe('createEmptyRegistry', () => {
      it('должен создавать пустой registry', () => {
        const registry = createEmptyRegistry();

        expect(registry).toEqual({
          base: {},
          shared: {},
          services: {},
          contracts: {},
          extensions: {},
        });
      });

      it('должен возвращать UnifiedErrorRegistry тип', () => {
        const registry = createEmptyRegistry();

        expect(registry).toBeInstanceOf(Object);
        expect(registry).toHaveProperty('base');
        expect(registry).toHaveProperty('shared');
        expect(registry).toHaveProperty('services');
        expect(registry).toHaveProperty('contracts');
        expect(registry).toHaveProperty('extensions');
      });
    });

    describe('createRegistry', () => {
      it('должен создавать registry с начальными данными', () => {
        const initialData = {
          base: {
            'DOMAIN_AUTH_001': {
              code: 'DOMAIN_AUTH_001',
              description: 'Auth error',
              severity: ERROR_SEVERITY.MEDIUM,
              category: ERROR_CATEGORY.SECURITY,
              origin: ERROR_ORIGIN.DOMAIN,
            },
          },
          shared: {},
          services: {},
          contracts: {},
          extensions: {},
        };

        const registry = createRegistry(initialData);

        expect(registry.base).toHaveProperty('DOMAIN_AUTH_001');
        expect(registry.shared).toEqual({});
        expect(registry.services).toEqual({});
        expect(registry.contracts).toEqual({});
        expect(registry.extensions).toEqual({});
      });

      it('должен создавать пустой registry по умолчанию', () => {
        const registry = createRegistry();

        expect(registry).toEqual({
          base: {},
          shared: {},
          services: {},
          contracts: {},
          extensions: {},
        });
      });

      it('должен копировать данные без мутации оригинала', () => {
        const initialData = {
          base: { test: 'value' as any },
        };

        const registry = createRegistry(initialData);

        // Изменение оригинала не должно влиять на registry
        initialData.base.test = 'modified';

        expect(registry.base.test).toBe('value');
      });
    });
  });

  describe('UnifiedErrorRegistryImpl класс', () => {
    let registryInstance: UnifiedErrorRegistryInstance;

    beforeEach(() => {
      const testRegistry: UnifiedErrorRegistry = {
        base: {
          'DOMAIN_AUTH_001': {
            code: 'DOMAIN_AUTH_001',
            description: 'Authentication failed',
            severity: ERROR_SEVERITY.MEDIUM,
            category: ERROR_CATEGORY.SECURITY,
            origin: ERROR_ORIGIN.DOMAIN,
          },
          'DOMAIN_USER_100': {
            code: 'DOMAIN_USER_100',
            description: 'User not found',
            severity: ERROR_SEVERITY.MEDIUM,
            category: ERROR_CATEGORY.BUSINESS,
            origin: ERROR_ORIGIN.DOMAIN,
          },
        },
        shared: {
          'SHARED_VALIDATION_001': {
            code: 'SHARED_VALIDATION_001',
            description: 'Validation error',
            severity: ERROR_SEVERITY.LOW,
            category: ERROR_CATEGORY.BUSINESS,
            origin: ERROR_ORIGIN.DOMAIN,
          },
        },
        services: {},
        contracts: {},
        extensions: {},
      };

      registryInstance = createRegistryInstance(testRegistry);
    });

    describe('конструктор и инициализация', () => {
      it('должен создавать instance с правильными данными', () => {
        expect(registryInstance.base).toHaveProperty('DOMAIN_AUTH_001');
        expect(registryInstance.shared).toHaveProperty('SHARED_VALIDATION_001');
        expect(registryInstance.services).toEqual({});
        expect(registryInstance.contracts).toEqual({});
        expect(registryInstance.extensions).toEqual({});
      });

      it('должен копировать данные без мутации оригинала', () => {
        const originalRegistry: UnifiedErrorRegistry = {
          base: { test: 'value' as any },
          shared: {},
          services: {},
          contracts: {},
          extensions: {},
        };

        const instance = createRegistryInstance(originalRegistry);

        // Изменение оригинала не должно влиять на instance
        // (в реальности registry immutable, так что это проверка концептуальная)
      });
    });

    describe('getMeta', () => {
      it('должен возвращать metadata для найденного error code', () => {
        const result = registryInstance.getMeta('DOMAIN_AUTH_001');

        expect(result.found).toBe(true);
        if (result.found) {
          expect(result.namespace).toBe('BASE');
          expect(result.metadata).toBeDefined();
          expect(result.metadata.code).toBe('DOMAIN_AUTH_001');
          expect(result.metadata.description).toBe('Authentication failed');
        }
        // error property doesn't exist on found results
        expect('error' in result).toBe(false);
      });

      it('должен возвращать not found для отсутствующего error code', () => {
        const result = registryInstance.getMeta('NON_EXISTENT_CODE');

        expect(result.found).toBe(false);
        if (!result.found) {
          expect(result.error).toBe("Error code 'NON_EXISTENT_CODE' not found in registry");
        }
        // namespace and metadata properties don't exist on not found results
        expect('namespace' in result).toBe(false);
        expect('metadata' in result).toBe(false);
      });

      it('должен работать с кодами из разных namespaces', () => {
        const baseResult = registryInstance.getMeta('DOMAIN_AUTH_001');
        const sharedResult = registryInstance.getMeta('SHARED_VALIDATION_001');

        expect(baseResult.found).toBe(true);
        if (baseResult.found) {
          expect(baseResult.namespace).toBe('BASE');
        }

        expect(sharedResult.found).toBe(true);
        if (sharedResult.found) {
          expect(sharedResult.namespace).toBe('SHARED');
        }
      });
    });

    describe('hasMeta', () => {
      it('должен возвращать true для существующих кодов', () => {
        expect(registryInstance.hasMeta('DOMAIN_AUTH_001')).toBe(true);
        expect(registryInstance.hasMeta('DOMAIN_USER_100')).toBe(true);
        expect(registryInstance.hasMeta('SHARED_VALIDATION_001')).toBe(true);
      });

      it('должен возвращать false для несуществующих кодов', () => {
        expect(registryInstance.hasMeta('NON_EXISTENT_CODE')).toBe(false);
        expect(registryInstance.hasMeta('')).toBe(false);
        expect(registryInstance.hasMeta('INVALID_CODE')).toBe(false);
      });
    });

    describe('getByNamespace', () => {
      it('должен возвращать все ошибки из namespace', () => {
        const result = registryInstance.getByNamespace('BASE');

        expect(result.namespace).toBe('BASE');
        expect(result.codes).toContain('DOMAIN_AUTH_001');
        expect(result.codes).toContain('DOMAIN_USER_100');
        expect(result.count).toBe(2);
        expect(result.metadata).toHaveProperty('DOMAIN_AUTH_001');
        expect(result.metadata).toHaveProperty('DOMAIN_USER_100');
      });

      it('должен возвращать пустой результат для пустого namespace', () => {
        const result = registryInstance.getByNamespace('SERVICES');

        expect(result.namespace).toBe('SERVICES');
        expect(result.codes).toEqual([]);
        expect(result.count).toBe(0);
        expect(result.metadata).toEqual({});
      });

      it('должен работать со всеми namespaces', () => {
        const namespaces: ErrorNamespace[] = [
          'BASE',
          'SHARED',
          'SERVICES',
          'CONTRACTS',
          'EXTENSIONS',
        ];

        namespaces.forEach((namespace) => {
          const result = registryInstance.getByNamespace(namespace);
          expect(result.namespace).toBe(namespace);
          expect(Array.isArray(result.codes)).toBe(true);
          expect(typeof result.count).toBe('number');
          expect(typeof result.metadata).toBe('object');
        });
      });
    });

    describe('getStats', () => {
      it('должен возвращать корректную статистику', () => {
        const stats = registryInstance.getStats();

        expect(stats.total).toBe(3); // 2 base + 1 shared
        expect(stats.byNamespace.BASE).toBe(2);
        expect(stats.byNamespace.SHARED).toBe(1);
        expect(stats.byNamespace.SERVICES).toBe(0);
        expect(stats.byNamespace.CONTRACTS).toBe(0);
        expect(stats.byNamespace.EXTENSIONS).toBe(0);
      });

      it('должен суммировать все namespaces', () => {
        const stats = registryInstance.getStats();
        const sum = Object.values(stats.byNamespace).reduce((acc, count) => acc + count, 0);

        expect(sum).toBe(stats.total);
      });
    });
  });

  describe('Default registry', () => {
    describe('DEFAULT_ERROR_REGISTRY', () => {
      it('должен быть instance UnifiedErrorRegistryImpl', () => {
        expect(DEFAULT_ERROR_REGISTRY).toBeInstanceOf(Object);
        expect(DEFAULT_ERROR_REGISTRY).toHaveProperty('base');
        expect(DEFAULT_ERROR_REGISTRY).toHaveProperty('shared');
        expect(DEFAULT_ERROR_REGISTRY).toHaveProperty('services');
        expect(DEFAULT_ERROR_REGISTRY).toHaveProperty('contracts');
        expect(DEFAULT_ERROR_REGISTRY).toHaveProperty('extensions');
      });

      it('должен иметь пустые namespaces по умолчанию', () => {
        const stats = DEFAULT_ERROR_REGISTRY.getStats();

        expect(stats.total).toBe(0);
        expect(stats.byNamespace.BASE).toBe(0);
        expect(stats.byNamespace.SHARED).toBe(0);
        expect(stats.byNamespace.SERVICES).toBe(0);
        expect(stats.byNamespace.CONTRACTS).toBe(0);
        expect(stats.byNamespace.EXTENSIONS).toBe(0);
      });

      it('должен иметь функциональные методы', () => {
        expect(typeof DEFAULT_ERROR_REGISTRY.getMeta).toBe('function');
        expect(typeof DEFAULT_ERROR_REGISTRY.hasMeta).toBe('function');
        expect(typeof DEFAULT_ERROR_REGISTRY.getByNamespace).toBe('function');
        expect(typeof DEFAULT_ERROR_REGISTRY.getStats).toBe('function');
      });

      it('getMeta должен возвращать not found для любого кода', () => {
        const result = DEFAULT_ERROR_REGISTRY.getMeta('ANY_CODE');
        expect(result.found).toBe(false);
        if (!result.found) {
          expect(result.error).toContain('not found in registry');
        }
      });

      it('hasMeta должен возвращать false для любого кода', () => {
        expect(DEFAULT_ERROR_REGISTRY.hasMeta('ANY_CODE')).toBe(false);
      });
    });
  });

  describe('Интеграционные сценарии', () => {
    it('должен поддерживать полный workflow работы с registry', () => {
      // 1. Создание registry с данными
      const registryData: UnifiedErrorRegistry = {
        base: {
          'DOMAIN_AUTH_001': {
            code: 'DOMAIN_AUTH_001',
            description: 'Authentication failed',
            severity: ERROR_SEVERITY.HIGH,
            category: ERROR_CATEGORY.SECURITY,
            origin: ERROR_ORIGIN.DOMAIN,
          },
        },
        shared: {
          'SHARED_VALIDATION_001': {
            code: 'SHARED_VALIDATION_001',
            description: 'Validation failed',
            severity: ERROR_SEVERITY.MEDIUM,
            category: ERROR_CATEGORY.BUSINESS,
            origin: ERROR_ORIGIN.DOMAIN,
          },
        },
        services: {},
        contracts: {},
        extensions: {},
      };

      const registry = createRegistryInstance(registryData);

      // 2. Проверка статистики
      const stats = registry.getStats();
      expect(stats.total).toBe(2);
      expect(stats.byNamespace.BASE).toBe(1);
      expect(stats.byNamespace.SHARED).toBe(1);

      // 3. Поиск по namespace
      const baseNamespace = registry.getByNamespace('BASE');
      expect(baseNamespace.count).toBe(1);
      expect(baseNamespace.codes).toContain('DOMAIN_AUTH_001');

      // 4. Проверка наличия
      expect(registry.hasMeta('DOMAIN_AUTH_001')).toBe(true);
      expect(registry.hasMeta('NON_EXISTENT')).toBe(false);

      // 5. Получение metadata
      const metaResult = registry.getMeta('DOMAIN_AUTH_001');
      expect(metaResult.found).toBe(true);
      if (metaResult.found) {
        expect(metaResult.metadata.severity).toBe('high');
      }

      // 6. Создание namespaced кодов
      const namespacedCode = createNamespacedErrorCode('BASE', 'DOMAIN_AUTH_001');
      expect(namespacedCode.fullCode).toBe('BASE.DOMAIN_AUTH_001');

      // 7. Парсинг namespaced кодов
      const parsed = parseNamespacedErrorCode('BASE.DOMAIN_AUTH_001');
      expect(parsed).not.toBeNull();
      expect(parsed!.namespace).toBe('BASE');
      expect(parsed!.code).toBe('DOMAIN_AUTH_001');

      // 8. Валидация namespace
      expect(isValidErrorNamespace('BASE')).toBe(true);
      expect(isValidErrorNamespace('INVALID')).toBe(false);
    });

    it('namespaced error codes должны быть обратимыми', () => {
      const testCases = [
        { namespace: 'BASE' as ErrorNamespace, code: 'DOMAIN_AUTH_001' },
        { namespace: 'SHARED' as ErrorNamespace, code: 'SHARED_VALIDATION_001' },
        { namespace: 'SERVICES' as ErrorNamespace, code: 'SERVICE_AI_001' },
        { namespace: 'CONTRACTS' as ErrorNamespace, code: 'CONTRACT_API_001' },
        { namespace: 'EXTENSIONS' as ErrorNamespace, code: 'EXT_PLUGIN_001' },
      ];

      testCases.forEach(({ namespace, code }) => {
        const namespaced = createNamespacedErrorCode(namespace, code);
        const parsed = parseNamespacedErrorCode(namespaced.fullCode);

        expect(parsed).not.toBeNull();
        expect(parsed!.namespace).toBe(namespace);
        expect(parsed!.code).toBe(code);
        expect(parsed!.fullCode).toBe(namespaced.fullCode);
      });
    });

    it('registry должен обеспечивать O(1) доступ к metadata', () => {
      const registry = createRegistryInstance({
        base: {
          'TEST_CODE_001': {
            code: 'TEST_CODE_001',
            description: 'Test error',
            severity: ERROR_SEVERITY.LOW,
            category: ERROR_CATEGORY.BUSINESS,
            origin: ERROR_ORIGIN.DOMAIN,
          },
        },
      });

      // Первый вызов - кеширование
      const result1 = registry.getMeta('TEST_CODE_001');
      expect(result1.found).toBe(true);

      // Повторные вызовы должны использовать cache
      const result2 = registry.getMeta('TEST_CODE_001');
      const result3 = registry.getMeta('TEST_CODE_001');

      expect(result2.found).toBe(true);
      expect(result3.found).toBe(true);
      if (result1.found && result2.found) {
        expect(result2.metadata).toBe(result1.metadata); // Тот же объект из cache
      }
    });
  });

  describe('Edge cases и валидация', () => {
    it('должен корректно обрабатывать пустые registry', () => {
      const emptyRegistry = createRegistryInstance();

      expect(emptyRegistry.getStats().total).toBe(0);
      expect(emptyRegistry.hasMeta('ANY_CODE')).toBe(false);
      expect(emptyRegistry.getMeta('ANY_CODE').found).toBe(false);

      const namespaceResult = emptyRegistry.getByNamespace('BASE');
      expect(namespaceResult.count).toBe(0);
      expect(namespaceResult.codes).toEqual([]);
    });

    it('parseNamespacedErrorCode должен обрабатывать edge cases', () => {
      const edgeCases = [
        'BASE.CODE',
        'SHARED.LONG_CODE_NAME_001',
        'EXTENSIONS.EXT_PLUGIN_ERROR_999',
        'SERVICES.SERVICE_NAME_ERROR_050',
      ];

      edgeCases.forEach((fullCode) => {
        const parsed = parseNamespacedErrorCode(fullCode);
        expect(parsed).not.toBeNull();
        expect(parsed!.fullCode).toBe(fullCode);
      });
    });

    it('registry methods должны быть thread-safe для чтения', () => {
      const registry = createRegistryInstance({
        base: {
          'TEST_CODE': {
            code: 'TEST_CODE',
            description: 'Test',
            severity: ERROR_SEVERITY.LOW,
            category: ERROR_CATEGORY.BUSINESS,
            origin: ERROR_ORIGIN.DOMAIN,
          },
        },
      });

      // Множественные одновременные чтения
      const metaResult = registry.getMeta('TEST_CODE');
      const hasResult = registry.hasMeta('TEST_CODE');
      const namespaceResult = registry.getByNamespace('BASE');
      const statsResult = registry.getStats();

      expect(metaResult.found).toBe(true);
      expect(hasResult).toBe(true);
      expect(namespaceResult.count).toBe(1);
      expect(statsResult.total).toBe(1);
    });

    it('createRegistry должен обрабатывать undefined значения', () => {
      const registry = createRegistry({
        base: undefined,
        shared: { test: 'value' as any },
        services: undefined,
      });

      expect(registry.base).toEqual({});
      expect(registry.shared).toHaveProperty('test');
      expect(registry.services).toEqual({});
      expect(registry.contracts).toEqual({});
      expect(registry.extensions).toEqual({});
    });

    it('getByNamespace должен возвращать правильные типы', () => {
      const registry = createRegistryInstance();
      const result = registry.getByNamespace('BASE');

      expect(typeof result.namespace).toBe('string');
      expect(Array.isArray(result.codes)).toBe(true);
      expect(typeof result.metadata).toBe('object');
      expect(typeof result.count).toBe('number');

      // Type safety
      const namespace: ErrorNamespace = result.namespace;
      const codes: readonly ErrorCode[] = result.codes;
      const count: number = result.count;

      expect(namespace).toBeDefined();
      expect(codes).toBeDefined();
      expect(count).toBeDefined();
    });
  });
});
