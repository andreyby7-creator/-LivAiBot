/**
 * @file SharedErrorRegistry.ts - Регистрация SHARED_* кодов в UnifiedErrorRegistry
 *
 * Layered registry resolution: SharedRegistry → BaseRegistry → fallback
 * Регистрирует SHARED_* коды в UnifiedErrorRegistry.shared
 * Единый lookup без дублирования реестров
 */

import { ERROR_CATEGORY, ERROR_ORIGIN, ERROR_SEVERITY } from '../base/ErrorConstants.js';

import type { ErrorCode } from '../base/ErrorCode.js';
import type { ErrorCodeMetadataMap } from '../base/ErrorCodeMeta.js';
import type {
  ErrorNamespace,
  RegistryLookupResult,
  UnifiedErrorRegistry,
  UnifiedErrorRegistryInstance,
} from '../base/UnifiedErrorRegistry.js';

// ==================== REGISTRY NAMESPACE TYPES ====================

/** Типизированные namespace константы для type-safe работы. Предотвращает использование строковых литералов напрямую. */
export const REGISTRY_NAMESPACES = {
  SHARED: 'SHARED' as const,
  BASE: 'BASE' as const,
  SERVICES: 'SERVICES' as const,
  CONTRACTS: 'CONTRACTS' as const,
  EXTENSIONS: 'EXTENSIONS' as const,
} as const;

/** Type-safe namespace тип для registry операций. */
export type RegistryNamespace = typeof REGISTRY_NAMESPACES[keyof typeof REGISTRY_NAMESPACES];

// ==================== SHARED ERROR CODES ====================

/** SHARED_* коды ошибок для общего использования между сервисами. Эти коды регистрируются в UnifiedErrorRegistry.shared. */
export const SHARED_ERROR_CODES = {
  // Domain ошибки (SHARED_DOMAIN_*)
  DOMAIN_VALIDATION_FAILED: 'SHARED_DOMAIN_VALIDATION_FAILED',
  DOMAIN_USER_NOT_FOUND: 'SHARED_DOMAIN_USER_NOT_FOUND',
  DOMAIN_PERMISSION_DENIED: 'SHARED_DOMAIN_PERMISSION_DENIED',
  DOMAIN_DATA_CORRUPTION: 'SHARED_DOMAIN_DATA_CORRUPTION',

  // Infrastructure ошибки (SHARED_INFRA_*)
  INFRA_DATABASE_CONNECTION_FAILED: 'SHARED_INFRA_DATABASE_CONNECTION_FAILED',
  INFRA_CACHE_UNAVAILABLE: 'SHARED_INFRA_CACHE_UNAVAILABLE',
  INFRA_NETWORK_TIMEOUT: 'SHARED_INFRA_NETWORK_TIMEOUT',
  INFRA_EXTERNAL_API_ERROR: 'SHARED_INFRA_EXTERNAL_API_ERROR',

  // Policy ошибки (SHARED_POLICY_*)
  POLICY_RETRY_EXHAUSTED: 'SHARED_POLICY_RETRY_EXHAUSTED',
  POLICY_CIRCUIT_BREAKER_OPEN: 'SHARED_POLICY_CIRCUIT_BREAKER_OPEN',
  POLICY_RATE_LIMIT_EXCEEDED: 'SHARED_POLICY_RATE_LIMIT_EXCEEDED',
  POLICY_FALLBACK_FAILED: 'SHARED_POLICY_FALLBACK_FAILED',

  // Adapter ошибки (SHARED_ADAPTER_*)
  ADAPTER_HTTP_TIMEOUT: 'SHARED_ADAPTER_HTTP_TIMEOUT',
  ADAPTER_GRPC_CONNECTION_FAILED: 'SHARED_ADAPTER_GRPC_CONNECTION_FAILED',
  ADAPTER_MESSAGE_QUEUE_ERROR: 'SHARED_ADAPTER_MESSAGE_QUEUE_ERROR',
  ADAPTER_SERIALIZATION_FAILED: 'SHARED_ADAPTER_SERIALIZATION_FAILED',
} as const;

/**
 * Тип для SHARED_* кодов ошибок
 */
export type SharedErrorCode = typeof SHARED_ERROR_CODES[keyof typeof SHARED_ERROR_CODES];

// ==================== SHARED ERROR METADATA ====================

/** Метаданные для SHARED_* кодов ошибок. Регистрируются в UnifiedErrorRegistry.shared. */
export const SHARED_ERROR_METADATA: ErrorCodeMetadataMap = {
  // Domain ошибки
  [SHARED_ERROR_CODES.DOMAIN_VALIDATION_FAILED]: {
    code: SHARED_ERROR_CODES.DOMAIN_VALIDATION_FAILED,
    description: 'Ошибка валидации входных данных в shared слое',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
  },

  [SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND]: {
    code: SHARED_ERROR_CODES.DOMAIN_USER_NOT_FOUND,
    description: 'Пользователь не найден в shared контексте',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.BUSINESS,
    origin: ERROR_ORIGIN.DOMAIN,
  },

  [SHARED_ERROR_CODES.DOMAIN_PERMISSION_DENIED]: {
    code: SHARED_ERROR_CODES.DOMAIN_PERMISSION_DENIED,
    description: 'Доступ запрещен в shared слое',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.SECURITY,
    origin: ERROR_ORIGIN.DOMAIN,
  },

  [SHARED_ERROR_CODES.DOMAIN_DATA_CORRUPTION]: {
    code: SHARED_ERROR_CODES.DOMAIN_DATA_CORRUPTION,
    description: 'Повреждение данных в shared слое',
    severity: ERROR_SEVERITY.CRITICAL,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.DOMAIN,
  },

  // Infrastructure ошибки
  [SHARED_ERROR_CODES.INFRA_DATABASE_CONNECTION_FAILED]: {
    code: SHARED_ERROR_CODES.INFRA_DATABASE_CONNECTION_FAILED,
    description: 'Ошибка подключения к базе данных в shared слое',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
  },

  [SHARED_ERROR_CODES.INFRA_CACHE_UNAVAILABLE]: {
    code: SHARED_ERROR_CODES.INFRA_CACHE_UNAVAILABLE,
    description: 'Кеш недоступен в shared слое',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
  },

  [SHARED_ERROR_CODES.INFRA_NETWORK_TIMEOUT]: {
    code: SHARED_ERROR_CODES.INFRA_NETWORK_TIMEOUT,
    description: 'Таймаут сетевого запроса в shared слое',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
  },

  [SHARED_ERROR_CODES.INFRA_EXTERNAL_API_ERROR]: {
    code: SHARED_ERROR_CODES.INFRA_EXTERNAL_API_ERROR,
    description: 'Ошибка внешнего API в shared слое',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.EXTERNAL,
  },

  // Policy ошибки
  [SHARED_ERROR_CODES.POLICY_RETRY_EXHAUSTED]: {
    code: SHARED_ERROR_CODES.POLICY_RETRY_EXHAUSTED,
    description: 'Исчерпаны попытки повтора в shared слое',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.SERVICE,
  },

  [SHARED_ERROR_CODES.POLICY_CIRCUIT_BREAKER_OPEN]: {
    code: SHARED_ERROR_CODES.POLICY_CIRCUIT_BREAKER_OPEN,
    description: 'Circuit breaker открыт в shared слое',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.SERVICE,
  },

  [SHARED_ERROR_CODES.POLICY_RATE_LIMIT_EXCEEDED]: {
    code: SHARED_ERROR_CODES.POLICY_RATE_LIMIT_EXCEEDED,
    description: 'Превышен лимит запросов в shared слое',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.SERVICE,
  },

  [SHARED_ERROR_CODES.POLICY_FALLBACK_FAILED]: {
    code: SHARED_ERROR_CODES.POLICY_FALLBACK_FAILED,
    description: 'Fallback стратегия не удалась в shared слое',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.SERVICE,
  },

  // Adapter ошибки
  [SHARED_ERROR_CODES.ADAPTER_HTTP_TIMEOUT]: {
    code: SHARED_ERROR_CODES.ADAPTER_HTTP_TIMEOUT,
    description: 'HTTP таймаут в shared адаптере',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.EXTERNAL,
  },

  [SHARED_ERROR_CODES.ADAPTER_GRPC_CONNECTION_FAILED]: {
    code: SHARED_ERROR_CODES.ADAPTER_GRPC_CONNECTION_FAILED,
    description: 'Ошибка подключения gRPC в shared адаптере',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.EXTERNAL,
  },

  [SHARED_ERROR_CODES.ADAPTER_MESSAGE_QUEUE_ERROR]: {
    code: SHARED_ERROR_CODES.ADAPTER_MESSAGE_QUEUE_ERROR,
    description: 'Ошибка очереди сообщений в shared адаптере',
    severity: ERROR_SEVERITY.HIGH,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.INFRASTRUCTURE,
  },

  [SHARED_ERROR_CODES.ADAPTER_SERIALIZATION_FAILED]: {
    code: SHARED_ERROR_CODES.ADAPTER_SERIALIZATION_FAILED,
    description: 'Ошибка сериализации в shared адаптере',
    severity: ERROR_SEVERITY.MEDIUM,
    category: ERROR_CATEGORY.TECHNICAL,
    origin: ERROR_ORIGIN.SERVICE,
  },
};

// ==================== SHARED REGISTRY FUNCTIONS ====================

/**
 * РАСШИРЯЕТ существующий registry SHARED слоем. Регистрирует SHARED_* коды в UnifiedErrorRegistry.shared.
 * НЕ создает новый registry instance - работает с существующим.
 */
export function registerSharedLayer(registry: UnifiedErrorRegistry): UnifiedErrorRegistry {
  return {
    ...registry,
    shared: {
      ...registry.shared,
      ...SHARED_ERROR_METADATA,
    },
  };
}

/**
 * Регистрирует SHARED_* коды в UnifiedErrorRegistry (устаревшая функция, используйте registerSharedLayer)
 * @deprecated Используйте registerSharedLayer вместо этой функции
 */
export function registerSharedErrorsInRegistry(
  registry: UnifiedErrorRegistry,
): UnifiedErrorRegistry {
  return registerSharedLayer(registry);
}

/** ⚠️ SharedErrorRegistry не создает registry instances - расширяет существующие через registerSharedLayer(). Предотвращает дублирование. */

// ==================== LAYERED RESOLUTION PIPELINE ====================

/** Настоящий layered pipeline: SharedRegistry → BaseRegistry → fallback. Контролируемый порядок поиска без постфильтрации. */

// ==================== SHARED REGISTRY API ====================

/** Чистый API для SHARED namespace - получает метаданные только из shared без влияния на другие namespaces. */
export function getFromSharedRegistry(
  code: ErrorCode,
  registry: UnifiedErrorRegistryInstance,
): RegistryLookupResult {
  if (code in registry.shared) {
    return {
      found: true,
      namespace: 'SHARED',
      metadata: Reflect.get(registry.shared, code),
    };
  }

  return {
    found: false,
    error: `Code '${code}' not found in SHARED namespace`,
  };
}

/** Получает метаданные из BASE namespace только. Не затрагивает другие namespaces - чистый BaseRegistry API. */
export function getFromBaseRegistry(
  code: ErrorCode,
  registry: UnifiedErrorRegistryInstance,
): RegistryLookupResult {
  if (code in registry.base) {
    return {
      found: true,
      namespace: 'BASE',
      metadata: Reflect.get(registry.base, code),
    };
  }

  return {
    found: false,
    error: `Code '${code}' not found in BASE namespace`,
  };
}

// ==================== LAYERED REGISTRY LOOKUP ====================

/** Получает метаданные из указанного namespace через registry. Явная type-safe работа с namespace. */
export function getFromNamespaceRegistry(
  namespace: RegistryNamespace,
  code: ErrorCode,
  registry: UnifiedErrorRegistryInstance,
): RegistryLookupResult {
  // Type-safe routing по namespace
  if (namespace === 'SHARED') {
    return getFromSharedRegistry(code, registry);
  }

  if (namespace === 'BASE') {
    return getFromBaseRegistry(code, registry);
  }

  // Fallback для других namespaces: используем общий UnifiedErrorRegistry lookup
  // Эти namespaces не имеют dedicated registry API в shared слое
  const result = registry.getMeta(code);
  if (result.found && result.namespace === namespace) {
    return result;
  }

  return {
    found: false,
    error: `Code '${code}' not found in ${namespace} namespace`,
  };
}

/**
 * Layered registry resolution pipeline: SharedRegistry → BaseRegistry → fallback.
 * Архитектурно выраженный pipeline с управляемым порядком поиска. Использует type-safe namespace константы.
 */
export function resolveSharedErrorMeta(
  code: ErrorCode,
  registry: UnifiedErrorRegistryInstance,
): RegistryLookupResult {
  // ШАГ 1: SharedRegistry - проверяем SHARED namespace первым (приоритет shared ошибок)
  const sharedResult = getFromNamespaceRegistry(REGISTRY_NAMESPACES.SHARED, code, registry);
  if (sharedResult.found) {
    return sharedResult;
  }

  // ШАГ 2: BaseRegistry - проверяем BASE namespace вторым
  const baseResult = getFromNamespaceRegistry(REGISTRY_NAMESPACES.BASE, code, registry);
  if (baseResult.found) {
    return baseResult;
  }

  // ШАГ 3: Fallback - код не найден в pipeline
  return {
    found: false,
    error:
      `Shared error code '${code}' not found in layered resolution pipeline (SharedRegistry → BaseRegistry → fallback)`,
  };
}

/**
 * Проверяет, является ли код SHARED_* кодом и зарегистрирован ли он
 * Гарантирует, что код не только имеет правильный префикс, но и действительно зарегистрирован в системе
 */
export function isSharedErrorCode(
  code: ErrorCode,
  registry: UnifiedErrorRegistryInstance,
): code is SharedErrorCode {
  // Проверяем наличие в registry.shared - это гарантирует, что код действительно зарегистрирован
  return code in registry.shared;
}

/** Получает все SHARED_* коды. */
export function getAllSharedErrorCodes(): readonly SharedErrorCode[] {
  return Object.freeze(Object.values(SHARED_ERROR_CODES));
}

/**
 * Проверяет совпадение SHARED кодов между константами и registry.
 * Возвращает результат проверки для предотвращения расхождений источника истины.
 * Рекомендуется вызывать при инициализации приложения или в dev-mode для раннего обнаружения несоответствий.
 */
export function checkSharedCodesConsistency(registry: UnifiedErrorRegistryInstance): {
  readonly isConsistent: boolean;
  readonly errors: readonly string[];
} {
  const constantCodes = new Set(Object.values(SHARED_ERROR_CODES));
  const registryCodes = new Set(Object.keys(registry.shared));

  // Собираем ошибки без мутации массива
  const missingInRegistry = Array.from(constantCodes).filter((code) => !registryCodes.has(code));
  const extraInRegistry = Array.from(registryCodes).filter((code) =>
    !constantCodes.has(code as SharedErrorCode)
  );

  const errors = [
    ...missingInRegistry.map((code) =>
      `SHARED код '${code}' есть в константах, но отсутствует в registry.shared`
    ),
    ...extraInRegistry.map((code) =>
      `SHARED код '${code}' есть в registry.shared, но отсутствует в константах`
    ),
  ];

  return {
    isConsistent: errors.length === 0,
    errors,
  };
}

/** Получает статистику registry для SHARED namespace. */
export function getRegistryStats(
  registry: UnifiedErrorRegistryInstance,
  namespace: 'SHARED',
): {
  readonly totalCodes: number;
  readonly codes: readonly string[];
  readonly hasAllExpectedCodes: boolean;
};

/** Получает статистику registry для других namespaces. */
export function getRegistryStats(
  registry: UnifiedErrorRegistryInstance,
  namespace: Exclude<ErrorNamespace, 'SHARED'>,
): {
  readonly totalCodes: number;
  readonly codes: readonly string[];
};

/** Получает статистику registry для указанного namespace. Для SHARED namespace проверяет наличие всех зарегистрированных кодов. */
export function getRegistryStats(
  registry: UnifiedErrorRegistryInstance,
  namespace: ErrorNamespace,
): {
  readonly totalCodes: number;
  readonly codes: readonly string[];
  readonly hasAllExpectedCodes?: boolean;
} {
  const namespaceStats = registry.getByNamespace(namespace);

  if (namespace === 'SHARED') {
    // Для SHARED namespace дополнительно проверяем наличие всех ожидаемых кодов
    const hasAllExpectedCodes = getAllSharedErrorCodes().every((code) =>
      namespaceStats.codes.includes(code)
    );

    return {
      totalCodes: namespaceStats.count,
      codes: namespaceStats.codes,
      hasAllExpectedCodes,
    };
  }

  return {
    totalCodes: namespaceStats.count,
    codes: namespaceStats.codes,
  };
}

/** Получает статистику SHARED registry (обертка для обратной совместимости). */
export function getSharedRegistryStats(registry: UnifiedErrorRegistryInstance): {
  readonly totalCodes: number;
  readonly codes: readonly string[];
  readonly hasAllExpectedCodes: boolean;
} {
  return getRegistryStats(registry, 'SHARED');
}
