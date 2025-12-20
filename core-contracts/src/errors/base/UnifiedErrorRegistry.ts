/**
 * @file UnifiedErrorRegistry.ts - Единый реестр всех ошибок системы с namespacing
 *
 * Структура: BASE.*, SHARED.*, SERVICES.*, CONTRACTS.*, EXTENSIONS.*
 * Функции getMeta(code), hasMeta(code), getByNamespace(namespace) для безопасного доступа
 * Компилируется в unified lookup table для performance
 */

// ==================== ИМПОРТЫ ====================

import type { ErrorCode } from './ErrorCode.js';
import type { ErrorCodeMetadata, ErrorCodeMetadataMap } from './ErrorCodeMeta.js';

// ==================== NAMESPACE ТИПЫ ====================

/**
 * Доступные namespaces для ошибок
 */
export type ErrorNamespace =
  | 'BASE' // Базовые ошибки системы
  | 'SHARED' // Общие ошибки между сервисами
  | 'SERVICES' // Ошибки конкретных сервисов
  | 'CONTRACTS' // Ошибки контрактов межсервисного взаимодействия
  | 'EXTENSIONS'; // Ошибки расширений и плагинов

/**
 * Структура namespaced error code
 */
export type NamespacedErrorCode = {
  readonly namespace: ErrorNamespace;
  readonly code: ErrorCode;
  readonly fullCode: string; // namespace.code
};

// ==================== REGISTRY ТИПЫ ====================

/**
 * Единый реестр ошибок с metadata
 */
export type UnifiedErrorRegistry = {
  readonly base: ErrorCodeMetadataMap;
  readonly shared: ErrorCodeMetadataMap;
  readonly services: ErrorCodeMetadataMap;
  readonly contracts: ErrorCodeMetadataMap;
  readonly extensions: ErrorCodeMetadataMap;
};

/**
 * Результат поиска в registry
 */
export type RegistryLookupResult = {
  readonly found: boolean;
  readonly namespace?: ErrorNamespace;
  readonly metadata?: ErrorCodeMetadata;
  readonly error?: string;
};

/**
 * Групповые результаты по namespace
 */
export type NamespaceLookupResult = {
  readonly namespace: ErrorNamespace;
  readonly codes: readonly ErrorCode[];
  readonly metadata: ErrorCodeMetadataMap;
  readonly count: number;
};

// ==================== REGISTRY КЛАСС ====================

/**
 * Единый registry всех ошибок системы
 * Pre-compiled lookup table для максимальной производительности
 */
class UnifiedErrorRegistryImpl implements UnifiedErrorRegistry {
  public readonly base: ErrorCodeMetadataMap;
  public readonly shared: ErrorCodeMetadataMap;
  public readonly services: ErrorCodeMetadataMap;
  public readonly contracts: ErrorCodeMetadataMap;
  public readonly extensions: ErrorCodeMetadataMap;

  private readonly lookupCache: Record<string, RegistryLookupResult>;

  constructor(registry: UnifiedErrorRegistry) {
    this.base = { ...registry.base };
    this.shared = { ...registry.shared };
    this.services = { ...registry.services };
    this.contracts = { ...registry.contracts };
    this.extensions = { ...registry.extensions };

    // Pre-compile lookup cache для O(1) доступа
    this.lookupCache = this.buildLookupCache();
  }

  /**
   * Строит lookup cache для быстрого поиска
   */
  private buildLookupCache(): Record<string, RegistryLookupResult> {
    const namespaceMap: Record<keyof UnifiedErrorRegistry, ErrorNamespace> = {
      base: 'BASE',
      shared: 'SHARED',
      services: 'SERVICES',
      contracts: 'CONTRACTS',
      extensions: 'EXTENSIONS',
    };

    return (Object.keys(namespaceMap) as (keyof UnifiedErrorRegistry)[]).reduce(
      (cache, namespaceKey) => {
        const namespace = namespaceMap[namespaceKey];
        const metadataMap = this[namespaceKey];

        return Object.entries(metadataMap).reduce(
          (updatedCache, [code, metadata]) => ({
            ...updatedCache,
            [code]: {
              found: true,
              namespace,
              metadata,
            },
          }),
          cache,
        );
      },
      {} as Record<string, RegistryLookupResult>,
    );
  }

  /**
   * Получает metadata для error code
   */
  getMeta(code: ErrorCode): RegistryLookupResult {
    const cached = this.lookupCache[code];
    if (cached) {
      return cached;
    }

    return {
      found: false,
      error: `Error code '${code}' not found in registry`,
    };
  }

  /**
   * Проверяет наличие error code в registry
   */
  hasMeta(code: ErrorCode): boolean {
    return code in this.lookupCache;
  }

  /**
   * Получает все ошибки по namespace
   */
  getByNamespace(namespace: ErrorNamespace): NamespaceLookupResult {
    const namespaceKey = namespace.toLowerCase() as keyof UnifiedErrorRegistry;
    const metadataMap = this[namespaceKey];
    const codes = Object.keys(metadataMap);

    return {
      namespace,
      codes,
      metadata: metadataMap,
      count: codes.length,
    };
  }

  /**
   * Получает статистику registry
   */
  getStats(): {
    readonly total: number;
    readonly byNamespace: Record<ErrorNamespace, number>;
  } {
    const byNamespace: Record<ErrorNamespace, number> = {
      BASE: Object.keys(this.base).length,
      SHARED: Object.keys(this.shared).length,
      SERVICES: Object.keys(this.services).length,
      CONTRACTS: Object.keys(this.contracts).length,
      EXTENSIONS: Object.keys(this.extensions).length,
    };

    const total = Object.values(byNamespace).reduce((sum, count) => sum + count, 0);

    return { total, byNamespace };
  }
}

// ==================== UTILITY ФУНКЦИИ ====================

/**
 * Создает namespaced error code
 */
export function createNamespacedErrorCode(
  namespace: ErrorNamespace,
  code: ErrorCode,
): NamespacedErrorCode {
  return {
    namespace,
    code,
    fullCode: `${namespace}.${code}`,
  };
}

/**
 * Парсит namespaced error code
 */
export function parseNamespacedErrorCode(fullCode: string): NamespacedErrorCode | null {
  const NAMESPACE_CODE_PARTS_COUNT = 2;
  const parts = fullCode.split('.');
  if (parts.length !== NAMESPACE_CODE_PARTS_COUNT) {
    return null;
  }

  const namespace = parts[0];
  const code = parts[1];

  if (
    namespace === undefined
    || namespace === ''
    || code === undefined
    || code === ''
    || !isValidErrorNamespace(namespace)
  ) {
    return null;
  }

  return createNamespacedErrorCode(namespace, code);
}

/**
 * Проверяет валидность namespace
 */
export function isValidErrorNamespace(namespace: string): namespace is ErrorNamespace {
  return ['BASE', 'SHARED', 'SERVICES', 'CONTRACTS', 'EXTENSIONS'].includes(
    namespace as ErrorNamespace,
  );
}

/**
 * Создает пустой registry
 */
export function createEmptyRegistry(): UnifiedErrorRegistry {
  return {
    base: {},
    shared: {},
    services: {},
    contracts: {},
    extensions: {},
  };
}

/**
 * Создает registry с начальными данными
 */
export function createRegistry(
  initialData: Partial<UnifiedErrorRegistry> = {},
): UnifiedErrorRegistry {
  return {
    base: { ...initialData.base },
    shared: { ...initialData.shared },
    services: { ...initialData.services },
    contracts: { ...initialData.contracts },
    extensions: { ...initialData.extensions },
  };
}

/**
 * Создает registry instance с pre-compiled cache
 */
export function createRegistryInstance(
  initialData: Partial<UnifiedErrorRegistry> = {},
): UnifiedErrorRegistryImpl {
  const registry = createRegistry(initialData);
  return new UnifiedErrorRegistryImpl(registry);
}

// ==================== DEFAULT REGISTRY ====================

/**
 * Default registry instance
 * В production должен заполняться реальными данными
 */
export const DEFAULT_ERROR_REGISTRY = createRegistryInstance();

// ==================== TYPE EXPORTS ====================

export type { UnifiedErrorRegistryImpl as UnifiedErrorRegistryInstance };
