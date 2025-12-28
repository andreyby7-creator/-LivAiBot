import { describe, expect, it, vi } from 'vitest';

import {
  checkSharedCodesConsistency,
  getAllSharedErrorCodes,
  getFromBaseRegistry,
  getFromNamespaceRegistry,
  getFromSharedRegistry,
  getRegistryStats,
  getSharedRegistryStats,
  isSharedErrorCode,
  registerSharedLayer,
  resolveSharedErrorMeta,
  SHARED_ERROR_CODES,
  SHARED_ERROR_METADATA,
} from '../../../../src/errors/shared/SharedErrorRegistry';
import {
  createEmptyRegistry,
  createRegistryInstance,
} from '../../../../src/errors/base/UnifiedErrorRegistry';

// ==================== UNIT TESTS ДЛЯ SharedErrorRegistry ====================

describe('SharedErrorRegistry', () => {
  describe('SHARED_ERROR_CODES', () => {
    it('содержит все необходимые SHARED_* коды', () => {
      expect(SHARED_ERROR_CODES.DOMAIN_VALIDATION_FAILED).toBe('SHARED_DOMAIN_VALIDATION_FAILED');
      expect(SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND).toBe('SHARED_DOMAIN_USER_NOT_FOUND');
      expect(SHARED_ERROR_CODES.INFRA_DATABASE_CONNECTION_FAILED).toBe(
        'SHARED_INFRA_DATABASE_CONNECTION_FAILED',
      );
      expect(SHARED_ERROR_CODES.POLICY_RETRY_EXHAUSTED).toBe('SHARED_POLICY_RETRY_EXHAUSTED');
      expect(SHARED_ERROR_CODES.ADAPTER_HTTP_TIMEOUT).toBe('SHARED_ADAPTER_HTTP_TIMEOUT');
    });

    it('все коды начинаются с SHARED_', () => {
      const codes = Object.values(SHARED_ERROR_CODES);
      codes.forEach((code) => {
        expect(code).toMatch(/^SHARED_/);
      });
    });
  });

  describe('SHARED_ERROR_METADATA', () => {
    it('содержит метаданные для всех SHARED_* кодов', () => {
      // Явные проверки для каждого кода для безопасности ESLint
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.DOMAIN_VALIDATION_FAILED]).toBeDefined();
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND]).toBeDefined();
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.DOMAIN_PERMISSION_DENIED]).toBeDefined();
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.DOMAIN_DATA_CORRUPTION]).toBeDefined();

      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.INFRA_DATABASE_CONNECTION_FAILED])
        .toBeDefined();
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.INFRA_CACHE_UNAVAILABLE]).toBeDefined();
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.INFRA_NETWORK_TIMEOUT]).toBeDefined();
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.INFRA_EXTERNAL_API_ERROR]).toBeDefined();

      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.POLICY_RETRY_EXHAUSTED]).toBeDefined();
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.POLICY_CIRCUIT_BREAKER_OPEN]).toBeDefined();
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.POLICY_RATE_LIMIT_EXCEEDED]).toBeDefined();
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.POLICY_FALLBACK_FAILED]).toBeDefined();

      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.ADAPTER_HTTP_TIMEOUT]).toBeDefined();
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.ADAPTER_GRPC_CONNECTION_FAILED])
        .toBeDefined();
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.ADAPTER_MESSAGE_QUEUE_ERROR]).toBeDefined();
      expect(SHARED_ERROR_METADATA[SHARED_ERROR_CODES.ADAPTER_SERIALIZATION_FAILED]).toBeDefined();
    });

    it('метаданные имеют правильную структуру', () => {
      const sampleMeta = SHARED_ERROR_METADATA[SHARED_ERROR_CODES.DOMAIN_VALIDATION_FAILED];

      expect(sampleMeta).toHaveProperty('code');
      expect(sampleMeta).toHaveProperty('description');
      expect(sampleMeta).toHaveProperty('severity');
      expect(sampleMeta).toHaveProperty('category');
      expect(sampleMeta).toHaveProperty('origin');
    });
  });

  describe('registerSharedLayer', () => {
    it('регистрирует SHARED_* коды в registry.shared', () => {
      const emptyRegistry = createEmptyRegistry();
      const registryWithShared = registerSharedLayer(emptyRegistry);

      expect(Object.keys(registryWithShared.shared)).toHaveLength(
        Object.keys(SHARED_ERROR_METADATA).length,
      );

      // Проверяем, что все SHARED коды зарегистрированы
      expect(registryWithShared.shared[SHARED_ERROR_CODES.DOMAIN_VALIDATION_FAILED]).toBeDefined();
      expect(registryWithShared.shared[SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND]).toBeDefined();
      expect(registryWithShared.shared[SHARED_ERROR_CODES.DOMAIN_PERMISSION_DENIED]).toBeDefined();
      expect(registryWithShared.shared[SHARED_ERROR_CODES.DOMAIN_DATA_CORRUPTION]).toBeDefined();

      expect(registryWithShared.shared[SHARED_ERROR_CODES.INFRA_DATABASE_CONNECTION_FAILED])
        .toBeDefined();
      expect(registryWithShared.shared[SHARED_ERROR_CODES.INFRA_CACHE_UNAVAILABLE]).toBeDefined();
      expect(registryWithShared.shared[SHARED_ERROR_CODES.INFRA_NETWORK_TIMEOUT]).toBeDefined();
      expect(registryWithShared.shared[SHARED_ERROR_CODES.INFRA_EXTERNAL_API_ERROR]).toBeDefined();

      expect(registryWithShared.shared[SHARED_ERROR_CODES.POLICY_RETRY_EXHAUSTED]).toBeDefined();
      expect(registryWithShared.shared[SHARED_ERROR_CODES.POLICY_CIRCUIT_BREAKER_OPEN])
        .toBeDefined();
      expect(registryWithShared.shared[SHARED_ERROR_CODES.POLICY_RATE_LIMIT_EXCEEDED])
        .toBeDefined();
      expect(registryWithShared.shared[SHARED_ERROR_CODES.POLICY_FALLBACK_FAILED]).toBeDefined();

      expect(registryWithShared.shared[SHARED_ERROR_CODES.ADAPTER_HTTP_TIMEOUT]).toBeDefined();
      expect(registryWithShared.shared[SHARED_ERROR_CODES.ADAPTER_GRPC_CONNECTION_FAILED])
        .toBeDefined();
      expect(registryWithShared.shared[SHARED_ERROR_CODES.ADAPTER_MESSAGE_QUEUE_ERROR])
        .toBeDefined();
      expect(registryWithShared.shared[SHARED_ERROR_CODES.ADAPTER_SERIALIZATION_FAILED])
        .toBeDefined();
    });

    it('не затрагивает другие namespaces', () => {
      const emptyRegistry = createEmptyRegistry();
      const registryWithShared = registerSharedLayer(emptyRegistry);

      expect(registryWithShared.base).toEqual({});
      expect(registryWithShared.services).toEqual({});
      expect(registryWithShared.contracts).toEqual({});
      expect(registryWithShared.extensions).toEqual({});
    });
  });

  describe('registerSharedLayer + createRegistryInstance', () => {
    it('создает registry instance с зарегистрированными SHARED кодами через registerSharedLayer', () => {
      const emptyRegistry = createEmptyRegistry();
      const registryWithShared = registerSharedLayer(emptyRegistry);
      const registryInstance = createRegistryInstance(registryWithShared);

      const stats = registryInstance.getStats();
      expect(stats.byNamespace.SHARED).toBeGreaterThan(0);

      // Проверяем, что можем найти SHARED коды
      const result = registryInstance.getMeta(SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.namespace).toBe('SHARED');
      }
    });
  });

  describe('resolveSharedErrorMeta', () => {
    it('находит SHARED коды в layered resolution', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      const result = resolveSharedErrorMeta(SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND, registry);

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.namespace).toBe('SHARED');
        expect(result.metadata.code).toBe(SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
      }
    });

    it('возвращает fallback для не найденных кодов', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      const result = resolveSharedErrorMeta('NON_EXISTENT_CODE' as any, registry);

      expect(result.found).toBe(false);
      expect((result as any).error).toContain('layered resolution');
    });

    it('находит код в BASE registry при отсутствии в SHARED', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));
      // Добавляем код в BASE registry
      registry.base['BASE_TEST_CODE'] = {
        code: 'BASE_TEST_CODE',
        description: 'Base test code',
        severity: 'medium' as const,
        category: 'TECHNICAL' as const,
        origin: 'DOMAIN' as const,
      };

      const result = resolveSharedErrorMeta('BASE_TEST_CODE' as any, registry);

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.namespace).toBe('BASE');
        expect(result.metadata.code).toBe('BASE_TEST_CODE');
      }
    });

    it('отдает приоритет SHARED над BASE при конфликте', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));
      // Добавляем один и тот же код в оба registry с разными данными
      const sharedCode = 'SHARED_BASE_CONFLICT';
      const sharedMetadata = {
        code: sharedCode,
        description: 'Shared version',
        severity: 'high' as const,
        category: 'BUSINESS' as const,
        origin: 'DOMAIN' as const,
      };
      const baseMetadata = {
        code: sharedCode,
        description: 'Base version',
        severity: 'low' as const,
        category: 'TECHNICAL' as const,
        origin: 'DOMAIN' as const,
      };

      // Безопасное присваивание - используем фиксированную строку как ключ
      registry.shared['SHARED_BASE_CONFLICT'] = sharedMetadata;
      registry.base['SHARED_BASE_CONFLICT'] = baseMetadata;

      const result = resolveSharedErrorMeta(sharedCode, registry);

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.namespace).toBe('SHARED'); // Должен выбрать SHARED
        expect(result.metadata.description).toBe('Shared version');
      }
    });
  });

  describe('isSharedErrorCode', () => {
    it('возвращает true для зарегистрированных SHARED_* кодов', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      expect(isSharedErrorCode(SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND, registry)).toBe(true);
      expect(isSharedErrorCode(SHARED_ERROR_CODES.INFRA_DATABASE_CONNECTION_FAILED, registry)).toBe(
        true,
      );
    });

    it('возвращает false для не-SHARED кодов', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      expect(isSharedErrorCode('DOMAIN_USER_NOT_FOUND', registry)).toBe(false);
      expect(isSharedErrorCode('SOME_RANDOM_CODE', registry)).toBe(false);
    });

    it('возвращает false для незарегистрированных SHARED кодов', () => {
      const emptyRegistry = createRegistryInstance(createEmptyRegistry());

      expect(isSharedErrorCode(SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND, emptyRegistry)).toBe(
        false,
      );
    });
  });

  describe('getAllSharedErrorCodes', () => {
    it('возвращает все SHARED_* коды', () => {
      const codes = getAllSharedErrorCodes();

      expect(codes).toHaveLength(Object.keys(SHARED_ERROR_CODES).length);
      expect(codes).toContain(SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND);
      expect(codes).toContain(SHARED_ERROR_CODES.INFRA_DATABASE_CONNECTION_FAILED);
    });

    it('возвращает readonly массив', () => {
      const codes = getAllSharedErrorCodes();

      expect(() => {
        (codes as any).push('NEW_CODE');
      }).toThrow();
    });
  });

  describe('getRegistryStats', () => {
    it('возвращает статистику для SHARED namespace с проверкой всех кодов', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));
      const stats = getRegistryStats(registry, 'SHARED');

      expect(stats.totalCodes).toBe(Object.keys(SHARED_ERROR_CODES).length);
      expect(stats.codes).toHaveLength(stats.totalCodes);
      expect(stats.hasAllExpectedCodes).toBe(true);
    });

    it('возвращает статистику для BASE namespace без проверки кодов', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));
      const stats = getRegistryStats(registry, 'BASE');

      expect(stats.totalCodes).toBe(0); // В тесте BASE пустой
      expect((stats as any).hasAllExpectedCodes).toBeUndefined(); // Только для SHARED
    });
  });

  describe('getSharedRegistryStats', () => {
    it('возвращает статистику SHARED registry (обратная совместимость)', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));
      const stats = getSharedRegistryStats(registry);

      expect(stats.totalCodes).toBe(Object.keys(SHARED_ERROR_CODES).length);
      expect(stats.codes).toHaveLength(stats.totalCodes);
      expect(stats.hasAllExpectedCodes).toBe(true);
    });

    it('показывает, что registry неполный', () => {
      const incompleteRegistry = createRegistryInstance({});
      const stats = getSharedRegistryStats(incompleteRegistry);

      expect(stats.totalCodes).toBe(0);
      expect(stats.hasAllExpectedCodes).toBe(false);
    });
  });

  describe('checkSharedCodesConsistency', () => {
    it('возвращает isConsistent: true для консистентного registry', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));
      const result = checkSharedCodesConsistency(registry);

      expect(result.isConsistent).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('обнаруживает коды, которые есть в константах, но нет в registry', () => {
      const incompleteRegistry = createRegistryInstance(createEmptyRegistry());
      // Добавляем один код в registry, но не все
      incompleteRegistry.shared[SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND] =
        SHARED_ERROR_METADATA[SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND];

      const result = checkSharedCodesConsistency(incompleteRegistry);

      expect(result.isConsistent).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes('есть в константах, но отсутствует в registry.shared')
        ),
      ).toBe(true);
    });

    it('обнаруживает коды, которые есть в registry, но нет в константах', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));
      // Добавляем лишний код в registry
      registry.shared['EXTRA_CODE'] = {
        code: 'EXTRA_CODE',
        description: 'Extra code',
        severity: 'low',
        category: 'TECHNICAL',
        origin: 'DOMAIN',
      };

      const result = checkSharedCodesConsistency(registry);

      expect(result.isConsistent).toBe(false);
      expect(
        result.errors.some((error) =>
          error.includes('есть в registry.shared, но отсутствует в константах')
        ),
      ).toBe(true);
    });

    it('обнаруживает одновременно отсутствующие и лишние коды', () => {
      const registry = createRegistryInstance(createEmptyRegistry());
      // Добавляем только один код из констант
      registry.shared[SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND] =
        SHARED_ERROR_METADATA[SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND];
      // Добавляем лишний код
      registry.shared['EXTRA_CODE'] = {
        code: 'EXTRA_CODE',
        description: 'Extra code',
        severity: 'low',
        category: 'TECHNICAL',
        origin: 'DOMAIN',
      };

      const result = checkSharedCodesConsistency(registry);

      expect(result.isConsistent).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1); // Должно быть несколько ошибок
      expect(
        result.errors.some((error) =>
          error.includes('есть в константах, но отсутствует в registry.shared')
        ),
      ).toBe(true);
      expect(
        result.errors.some((error) =>
          error.includes('есть в registry.shared, но отсутствует в константах')
        ),
      ).toBe(true);
    });

    it('обнаруживает только отсутствующие коды (registry пустой)', () => {
      const registry = createRegistryInstance(createEmptyRegistry());
      // Registry полностью пустой

      const result = checkSharedCodesConsistency(registry);

      expect(result.isConsistent).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(
        result.errors.every((error) =>
          error.includes('есть в константах, но отсутствует в registry.shared')
        ),
      ).toBe(true);
    });

    it('обнаруживает только лишние коды', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));
      // Добавляем лишний код к полному registry
      registry.shared['EXTRA_CODE'] = {
        code: 'EXTRA_CODE',
        description: 'Extra code',
        severity: 'low',
        category: 'TECHNICAL',
        origin: 'DOMAIN',
      };

      const result = checkSharedCodesConsistency(registry);

      expect(result.isConsistent).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('есть в registry.shared, но отсутствует в константах');
    });
  });

  describe('Integration с UnifiedErrorRegistry', () => {
    it('SHARED коды доступны через стандартный registry API', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      // Проверяем через стандартный API
      const result = registry.getMeta(SHARED_ERROR_CODES.POLICY_RETRY_EXHAUSTED);
      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.namespace).toBe('SHARED');
      }

      // Проверяем статистику по namespace
      const sharedStats = registry.getByNamespace('SHARED');
      expect(sharedStats.count).toBe(Object.keys(SHARED_ERROR_CODES).length);
    });

    it('SHARED коды имеют правильные метаданные', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      Object.values(SHARED_ERROR_CODES).forEach((code) => {
        const result = registry.getMeta(code);
        expect(result.found).toBe(true);
        if (result.found) {
          expect(result.metadata.code).toBe(code);
          expect(result.metadata.description).toBeDefined();
          expect(['low', 'medium', 'high', 'critical']).toContain(result.metadata.severity);
        }
      });
    });
  });

  describe('Shared Registry API', () => {
    it('getFromSharedRegistry возвращает только SHARED коды', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      const sharedResult = getFromSharedRegistry(
        SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        registry,
      );
      expect(sharedResult.found).toBe(true);
      if (sharedResult.found) {
        expect(sharedResult.namespace).toBe('SHARED');
      }

      const notSharedResult = getFromSharedRegistry('DOMAIN_USER_NOT_FOUND' as any, registry);
      expect(notSharedResult.found).toBe(false);
    });

    it('getFromBaseRegistry возвращает только BASE коды', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      // BASE коды не определены в нашем registry, так что должен быть fallback
      const baseResult = getFromBaseRegistry('DOMAIN_USER_NOT_FOUND' as any, registry);
      expect(baseResult.found).toBe(false);
      if (!baseResult.found) {
        expect(baseResult.error).toContain('not found in BASE namespace');
      }
    });

    it('getFromNamespaceRegistry обрабатывает SHARED namespace через dedicated API', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      const result = getFromNamespaceRegistry(
        'SHARED',
        SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
        registry,
      );
      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.namespace).toBe('SHARED');
      }
    });

    it('getFromNamespaceRegistry обрабатывает BASE namespace через dedicated API', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      const result = getFromNamespaceRegistry('BASE', 'SOME_BASE_CODE' as any, registry);
      expect(result.found).toBe(false);
      if (!result.found) {
        expect(result.error).toContain('not found in BASE namespace');
      }
    });

    it('getFromNamespaceRegistry использует fallback для SERVICES namespace', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      const result = getFromNamespaceRegistry('SERVICES', 'SOME_SERVICES_CODE' as any, registry);
      expect(result.found).toBe(false);
      if (!result.found) {
        expect(result.error).toContain('not found in SERVICES namespace');
      }
    });

    it('getFromNamespaceRegistry использует fallback для CONTRACTS namespace', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      const result = getFromNamespaceRegistry('CONTRACTS', 'SOME_CONTRACTS_CODE' as any, registry);
      expect(result.found).toBe(false);
      if (!result.found) {
        expect(result.error).toContain('not found in CONTRACTS namespace');
      }
    });

    it('getFromNamespaceRegistry использует fallback для EXTENSIONS namespace', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      const result = getFromNamespaceRegistry(
        'EXTENSIONS',
        'SOME_EXTENSIONS_CODE' as any,
        registry,
      );
      expect(result.found).toBe(false);
      if (!result.found) {
        expect(result.error).toContain('not found in EXTENSIONS namespace');
      }
    });

    it('getFromNamespaceRegistry находит код в fallback namespace при совпадении namespace', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));
      // Добавляем код в registry с namespace 'SERVICES'
      registry.getMeta = vi.fn().mockReturnValue({
        found: true,
        namespace: 'SERVICES',
        code: 'SOME_SERVICES_CODE',
        metadata: {
          code: 'SOME_SERVICES_CODE',
          description: 'Test code',
          severity: 'low' as const,
          category: 'TECHNICAL' as const,
          origin: 'DOMAIN' as const,
        },
      });

      const result = getFromNamespaceRegistry('SERVICES', 'SOME_SERVICES_CODE' as any, registry);
      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.namespace).toBe('SERVICES');
      }
    });

    it('getFromNamespaceRegistry возвращает not found при несовпадении namespace в fallback', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));
      // Добавляем код в registry с namespace 'SERVICES', но ищем в 'CONTRACTS'
      registry.getMeta = vi.fn().mockReturnValue({
        found: true,
        namespace: 'SERVICES',
        code: 'SOME_SERVICES_CODE',
        metadata: {
          code: 'SOME_SERVICES_CODE',
          description: 'Test code',
          severity: 'low' as const,
          category: 'TECHNICAL' as const,
          origin: 'DOMAIN' as const,
        },
      });

      const result = getFromNamespaceRegistry('CONTRACTS', 'SOME_SERVICES_CODE' as any, registry);
      expect(result.found).toBe(false);
      if (!result.found) {
        expect(result.error).toContain('not found in CONTRACTS namespace');
      }
    });
  });

  describe('Layered Resolution Pipeline', () => {
    it('следует порядку: SharedRegistry → BaseRegistry → fallback', () => {
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      // SHARED код должен найтись через SharedRegistry первым
      const sharedResult = resolveSharedErrorMeta(
        SHARED_ERROR_CODES.DOMAIN_VALIDATION_FAILED,
        registry,
      );
      expect(sharedResult.found).toBe(true);
      if (sharedResult.found) {
        expect(sharedResult.namespace).toBe('SHARED');
      }

      // Не-SHARED код должен дать fallback после проверки обоих registries
      const fallbackResult = resolveSharedErrorMeta('UNKNOWN_CODE' as any, registry);
      expect(fallbackResult.found).toBe(false);
      if (!fallbackResult.found) {
        expect(fallbackResult.error).toContain('layered resolution pipeline');
      }
    });

    it('SHARED коды имеют приоритет над BASE через pipeline', () => {
      // Pipeline гарантирует, что SHARED проверяется первым
      const registry = createRegistryInstance(registerSharedLayer(createEmptyRegistry()));

      const result = resolveSharedErrorMeta(SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND, registry);
      if (result.found) {
        expect(result.namespace).toBe('SHARED');
      }
      // Если бы BASE проверялся первым, результат мог бы быть другим
    });
  });
});
// EOF
