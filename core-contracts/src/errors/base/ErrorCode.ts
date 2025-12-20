/**
 * @file ErrorCode.ts - Полная иерархия кодов ошибок LivAiBot с семантическими префиксами
 *
 * Структура: PREFIX_CATEGORY_INCREMENT (DOMAIN_AUTH_001)
 * Группы: Domain (бизнес-логика), Infra (инфраструктура), Service (сервисы), Admin (админ-панель)
 * Подгруппы: AUTH, USER, SUBSCRIPTION, BOT, INTEGRATION, TOKEN, DB, CACHE, NETWORK, EXTERNAL, AI, BILLING, MOBILE, TENANT, FEATURE, FINANCE, AUDIT
 *
 * ABI-safe с validation helpers для type-safe валидации
 */

// ==================== ОСНОВНЫЕ ТИПЫ ДЛЯ ERROR CODES ====================

/**
 * Базовый тип для error code - строка с семантической структурой
 * Формат: PREFIX_CATEGORY_INCREMENT (DOMAIN_AUTH_001)
 */
export type ErrorCode = string;

/**
 * Структура error code для валидации
 */
export type ErrorCodeStructure = {
  readonly prefix: ErrorCodePrefix;
  readonly category: string;
  readonly increment: number;
  readonly fullCode: ErrorCode;
};

/**
 * Префиксы для группировки error codes
 */
export type ErrorCodePrefix =
  | 'DOMAIN' // Бизнес-логика (Domain слой)
  | 'INFRA' // Инфраструктура (Infra слой)
  | 'SERVICE' // Сервисы (Service слой)
  | 'ADMIN'; // Админ-панель (Admin слой)

/**
 * Категории внутри каждой группы
 */
export type ErrorCodeCategory =
  // Domain категории
  | 'AUTH' // Аутентификация
  | 'USER' // Пользователи
  | 'SUBSCRIPTION' // Подписки
  | 'BOT' // Боты
  | 'INTEGRATION' // Интеграции
  | 'TOKEN' // Токены
  | 'BILLING' // Биллинг
  | 'TENANT' // Тенанты
  | 'FEATURE' // Фичи
  | 'FINANCE' // Финансы
  | 'AUDIT' // Аудит
  // Infra категории
  | 'DB' // Базы данных
  | 'CACHE' // Кеш
  | 'NETWORK' // Сеть
  | 'EXTERNAL' // Внешние сервисы
  // Service категории
  | 'AI' // ИИ сервисы
  // Admin категории
  | 'USER' // Админ пользователи (дублируется с domain, но в admin контексте)
  | 'SYSTEM' // Системные операции
  | 'CONFIG'; // Конфигурация

// ==================== DOMAIN ГРУППА (Бизнес-логика) ====================

/**
 * Domain error codes - бизнес-логика LivAiBot
 */
export const DOMAIN_ERROR_CODES = {
  // Authentication (001-099)
  AUTH_INVALID_CREDENTIALS: 'DOMAIN_AUTH_001' as const,
  AUTH_TOKEN_EXPIRED: 'DOMAIN_AUTH_002' as const,
  AUTH_TOKEN_INVALID: 'DOMAIN_AUTH_003' as const,
  AUTH_INSUFFICIENT_PERMISSIONS: 'DOMAIN_AUTH_004' as const,
  AUTH_ACCOUNT_LOCKED: 'DOMAIN_AUTH_005' as const,
  AUTH_ACCOUNT_DISABLED: 'DOMAIN_AUTH_006' as const,
  AUTH_TOO_MANY_ATTEMPTS: 'DOMAIN_AUTH_007' as const,

  // User Management (100-199)
  USER_NOT_FOUND: 'DOMAIN_USER_100' as const,
  USER_ALREADY_EXISTS: 'DOMAIN_USER_101' as const,
  USER_INVALID_DATA: 'DOMAIN_USER_102' as const,
  USER_EMAIL_NOT_VERIFIED: 'DOMAIN_USER_103' as const,
  USER_PHONE_NOT_VERIFIED: 'DOMAIN_USER_104' as const,
  USER_PROFILE_INCOMPLETE: 'DOMAIN_USER_105' as const,

  // Subscriptions (200-299)
  SUBSCRIPTION_NOT_FOUND: 'DOMAIN_SUBSCRIPTION_200' as const,
  SUBSCRIPTION_EXPIRED: 'DOMAIN_SUBSCRIPTION_201' as const,
  SUBSCRIPTION_LIMIT_EXCEEDED: 'DOMAIN_SUBSCRIPTION_202' as const,
  SUBSCRIPTION_PAYMENT_REQUIRED: 'DOMAIN_SUBSCRIPTION_203' as const,
  SUBSCRIPTION_PLAN_NOT_AVAILABLE: 'DOMAIN_SUBSCRIPTION_204' as const,

  // Bot Operations (300-399)
  BOT_NOT_FOUND: 'DOMAIN_BOT_300' as const,
  BOT_ALREADY_EXISTS: 'DOMAIN_BOT_301' as const,
  BOT_INVALID_CONFIGURATION: 'DOMAIN_BOT_302' as const,
  BOT_PROCESSING_FAILED: 'DOMAIN_BOT_303' as const,
  BOT_RATE_LIMIT_EXCEEDED: 'DOMAIN_BOT_304' as const,

  // Integrations (400-499)
  INTEGRATION_NOT_FOUND: 'DOMAIN_INTEGRATION_400' as const,
  INTEGRATION_INVALID_CONFIG: 'DOMAIN_INTEGRATION_401' as const,
  INTEGRATION_CONNECTION_FAILED: 'DOMAIN_INTEGRATION_402' as const,
  INTEGRATION_RATE_LIMIT: 'DOMAIN_INTEGRATION_403' as const,
  INTEGRATION_AUTH_FAILED: 'DOMAIN_INTEGRATION_404' as const,

  // Tokens (500-599)
  TOKEN_INVALID: 'DOMAIN_TOKEN_500' as const,
  TOKEN_EXPIRED: 'DOMAIN_TOKEN_501' as const,
  TOKEN_REVOKED: 'DOMAIN_TOKEN_502' as const,
  TOKEN_INSUFFICIENT_SCOPES: 'DOMAIN_TOKEN_503' as const,

  // Billing (600-699)
  BILLING_PAYMENT_FAILED: 'DOMAIN_BILLING_600' as const,
  BILLING_INVALID_AMOUNT: 'DOMAIN_BILLING_601' as const,
  BILLING_CURRENCY_NOT_SUPPORTED: 'DOMAIN_BILLING_602' as const,
  BILLING_REFUND_FAILED: 'DOMAIN_BILLING_603' as const,

  // Tenants (700-799)
  TENANT_NOT_FOUND: 'DOMAIN_TENANT_700' as const,
  TENANT_LIMIT_EXCEEDED: 'DOMAIN_TENANT_701' as const,
  TENANT_SUSPENDED: 'DOMAIN_TENANT_702' as const,

  // Features (800-899)
  FEATURE_NOT_AVAILABLE: 'DOMAIN_FEATURE_800' as const,
  FEATURE_DISABLED: 'DOMAIN_FEATURE_801' as const,
  FEATURE_QUOTA_EXCEEDED: 'DOMAIN_FEATURE_802' as const,

  // Finance (900-999)
  FINANCE_TRANSACTION_FAILED: 'DOMAIN_FINANCE_900' as const,
  FINANCE_INSUFFICIENT_FUNDS: 'DOMAIN_FINANCE_901' as const,
  FINANCE_ACCOUNT_FROZEN: 'DOMAIN_FINANCE_902' as const,

  // Audit (1000-1099)
  AUDIT_LOG_FAILED: 'DOMAIN_AUDIT_1000' as const,
  AUDIT_ACCESS_DENIED: 'DOMAIN_AUDIT_1001' as const,
} as const;

// ==================== INFRA ГРУППА (Инфраструктура) ====================

/**
 * Infra error codes - инфраструктурные проблемы
 */
export const INFRA_ERROR_CODES = {
  // Database (001-099)
  DB_CONNECTION_FAILED: 'INFRA_DB_001' as const,
  DB_QUERY_FAILED: 'INFRA_DB_002' as const,
  DB_TRANSACTION_FAILED: 'INFRA_DB_003' as const,
  DB_CONNECTION_TIMEOUT: 'INFRA_DB_004' as const,
  DB_DEADLOCK: 'INFRA_DB_005' as const,

  // Cache (100-199)
  CACHE_CONNECTION_FAILED: 'INFRA_CACHE_100' as const,
  CACHE_SET_FAILED: 'INFRA_CACHE_101' as const,
  CACHE_GET_FAILED: 'INFRA_CACHE_102' as const,
  CACHE_DELETE_FAILED: 'INFRA_CACHE_103' as const,

  // Network (200-299)
  NETWORK_TIMEOUT: 'INFRA_NETWORK_200' as const,
  NETWORK_CONNECTION_REFUSED: 'INFRA_NETWORK_201' as const,
  NETWORK_DNS_FAILED: 'INFRA_NETWORK_202' as const,
  NETWORK_SSL_ERROR: 'INFRA_NETWORK_203' as const,

  // External Services (300-399)
  EXTERNAL_API_UNAVAILABLE: 'INFRA_EXTERNAL_300' as const,
  EXTERNAL_API_TIMEOUT: 'INFRA_EXTERNAL_301' as const,
  EXTERNAL_API_RATE_LIMIT: 'INFRA_EXTERNAL_302' as const,
  EXTERNAL_API_AUTH_FAILED: 'INFRA_EXTERNAL_303' as const,
} as const;

// ==================== SERVICE ГРУППА (Сервисы) ====================

/**
 * Service error codes - проблемы сервисов
 */
export const SERVICE_ERROR_CODES = {
  // AI Services (001-099)
  AI_MODEL_UNAVAILABLE: 'SERVICE_AI_001' as const,
  AI_PROCESSING_FAILED: 'SERVICE_AI_002' as const,
  AI_INVALID_INPUT: 'SERVICE_AI_003' as const,
  AI_RATE_LIMIT_EXCEEDED: 'SERVICE_AI_004' as const,
  AI_MODEL_TIMEOUT: 'SERVICE_AI_005' as const,
} as const;

// ==================== ADMIN ГРУППА (Админ-панель) ====================

/**
 * Admin error codes - проблемы админ-панели
 */
export const ADMIN_ERROR_CODES = {
  // User Management (001-099)
  USER_NOT_FOUND: 'ADMIN_USER_001' as const,
  USER_ACCESS_DENIED: 'ADMIN_USER_002' as const,
  USER_INSUFFICIENT_PRIVILEGES: 'ADMIN_USER_003' as const,

  // System Operations (100-199)
  SYSTEM_MAINTENANCE: 'ADMIN_SYSTEM_100' as const,
  SYSTEM_BACKUP_FAILED: 'ADMIN_SYSTEM_101' as const,
  SYSTEM_UPDATE_FAILED: 'ADMIN_SYSTEM_102' as const,

  // Configuration (200-299)
  CONFIG_INVALID: 'ADMIN_CONFIG_200' as const,
  CONFIG_SAVE_FAILED: 'ADMIN_CONFIG_201' as const,
  CONFIG_LOAD_FAILED: 'ADMIN_CONFIG_202' as const,
} as const;

// ==================== ОБЪЕДИНЕННЫЕ ERROR CODES ====================

/**
 * Все error codes LivAiBot в едином объекте
 */
export const LIVAI_ERROR_CODES = {
  ...DOMAIN_ERROR_CODES,
  ...INFRA_ERROR_CODES,
  ...SERVICE_ERROR_CODES,
  ...ADMIN_ERROR_CODES,
} as const;

/**
 * Тип для всех возможных error codes LivAiBot
 */
export type LivAiErrorCode = typeof LIVAI_ERROR_CODES[keyof typeof LIVAI_ERROR_CODES];

// ==================== VALIDATION HELPERS ====================

/**
 * Маппинг сервисов к их error code диапазонам для type-safe валидации
 */
export type ServiceErrorCodeMapping = {
  readonly [serviceName: string]: {
    readonly prefix: ErrorCodePrefix;
    readonly categories: readonly ErrorCodeCategory[];
    readonly rangeStart: number;
    readonly rangeEnd: number;
  };
};

/**
 * Валидация уникальности error codes
 */
export function validateErrorCodeUniqueness(codes: Record<string, ErrorCode>): void {
  const codeValues = Object.values(codes);
  const uniqueCodes = Array.from(new Set(codeValues));
  const duplicates = uniqueCodes.filter((code) =>
    codeValues.indexOf(code) !== codeValues.lastIndexOf(code)
  );

  if (duplicates.length > 0) {
    throw new Error(`Duplicate error codes found: ${duplicates.join(', ')}`);
  }
}

/**
 * Создание type-safe error code с валидацией
 */
export function createErrorCode<T extends ErrorCode>(code: T): T {
  const pattern = /^(DOMAIN|INFRA|SERVICE|ADMIN)_[A-Z]+_\d{3}$/;
  if (!pattern.test(code)) {
    throw new Error(`Invalid error code format: ${code}. Expected: PREFIX_CATEGORY_XXX`);
  }
  return code;
}

/**
 * Парсинг error code в структуру
 * @param code - error code для парсинга
 * @returns структура error code
 */
const ERROR_CODE_CONFIG = { MIN_INCREMENT: 1, MAX_INCREMENT: 999, PARTS_COUNT: 3 } as const;

/**
 * Парсинг error code в структуру
 */
export function parseErrorCode(code: ErrorCode): ErrorCodeStructure {
  const parts = code.split('_');
  if (parts.length !== ERROR_CODE_CONFIG.PARTS_COUNT) {
    throw new Error(`Invalid error code format: ${code}`);
  }

  const [prefix, category, incrementStr] = parts;

  if (
    prefix === undefined
    || prefix === ''
    || category === undefined
    || category === ''
    || incrementStr === undefined
    || incrementStr === ''
  ) {
    throw new Error(`Invalid error code format: ${code}`);
  }

  const increment = parseInt(incrementStr, 10);

  if (
    isNaN(increment)
    || increment < ERROR_CODE_CONFIG.MIN_INCREMENT
    || increment > ERROR_CODE_CONFIG.MAX_INCREMENT
  ) {
    throw new Error(`Invalid increment in error code: ${code}`);
  }

  return {
    prefix: prefix as ErrorCodePrefix,
    category,
    increment,
    fullCode: code,
  };
}

/**
 * Маппинг сервисов для валидации error codes
 */
export const SERVICE_ERROR_CODE_MAPPING: ServiceErrorCodeMapping = {
  auth: { prefix: 'DOMAIN', categories: ['AUTH'], rangeStart: 1, rangeEnd: 99 },
  user: { prefix: 'DOMAIN', categories: ['USER'], rangeStart: 100, rangeEnd: 199 },
  subscription: { prefix: 'DOMAIN', categories: ['SUBSCRIPTION'], rangeStart: 200, rangeEnd: 299 },
  bot: { prefix: 'DOMAIN', categories: ['BOT'], rangeStart: 300, rangeEnd: 399 },
  integration: { prefix: 'DOMAIN', categories: ['INTEGRATION'], rangeStart: 400, rangeEnd: 499 },
  token: { prefix: 'DOMAIN', categories: ['TOKEN'], rangeStart: 500, rangeEnd: 599 },
  billing: { prefix: 'DOMAIN', categories: ['BILLING'], rangeStart: 600, rangeEnd: 699 },
  tenant: { prefix: 'DOMAIN', categories: ['TENANT'], rangeStart: 700, rangeEnd: 799 },
  feature: { prefix: 'DOMAIN', categories: ['FEATURE'], rangeStart: 800, rangeEnd: 899 },
  finance: { prefix: 'DOMAIN', categories: ['FINANCE'], rangeStart: 900, rangeEnd: 999 },
  audit: { prefix: 'DOMAIN', categories: ['AUDIT'], rangeStart: 1000, rangeEnd: 1099 },
  database: { prefix: 'INFRA', categories: ['DB'], rangeStart: 1, rangeEnd: 99 },
  cache: { prefix: 'INFRA', categories: ['CACHE'], rangeStart: 100, rangeEnd: 199 },
  network: { prefix: 'INFRA', categories: ['NETWORK'], rangeStart: 200, rangeEnd: 299 },
  external: { prefix: 'INFRA', categories: ['EXTERNAL'], rangeStart: 300, rangeEnd: 399 },
  ai: { prefix: 'SERVICE', categories: ['AI'], rangeStart: 1, rangeEnd: 99 },
  admin: {
    prefix: 'ADMIN',
    categories: ['USER', 'SYSTEM', 'CONFIG'],
    rangeStart: 1,
    rangeEnd: 299,
  },
} as const;

// ==================== ВАЛИДАЦИЯ ПРИ ЗАГРУЗКЕ ====================

// Валидация уникальности всех error codes при импорте модуля
validateErrorCodeUniqueness(LIVAI_ERROR_CODES);
