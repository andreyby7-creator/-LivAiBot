/**
 * @file @livai/core-contracts/context/headers.ts
 * ============================================================================
 * 📋 HTTP — REQUEST HEADERS (TRACE, IDEMPOTENCY, TENANT, AUTH)
 * ============================================================================
 *
 * Foundation-типы для стандартизированных HTTP заголовков межсервисного взаимодействия.
 * Заметка по архитектуре:
 * - Заголовки разделены на authenticated (бизнес-эндпоинты) и service (внутренние/фоновые).
 * - WORKSPACE_ID обязателен для authenticated запросов (tenant isolation).
 * - USER_ID обязателен для authenticated запросов (user context).
 * - TRACE_ID и OPERATION_ID опциональны (корреляция и идемпотентность).
 */
/* ============================================================================
 * 📋 HEADER NAMES — STANDARDIZED CONSTANTS
 * ========================================================================== */

/**
 * Стандартизированные имена HTTP заголовков для межсервисного взаимодействия.
 * Используются для:
 * - Корреляции запросов (trace_id)
 * - Идемпотентности операций (operation_id)
 * - Tenant isolation (workspace_id)
 * - Аутентификации (user_id)
 */
export const HEADERS = Object.freeze(
  {
    TRACE_ID: 'X-Trace-Id',
    OPERATION_ID: 'X-Operation-Id',
    WORKSPACE_ID: 'X-Workspace-Id',
    USER_ID: 'X-User-Id',
  } as const,
);

/* ============================================================================
 * 🔐 AUTHENTICATED REQUEST HEADERS — USER CONTEXT REQUIRED
 * ========================================================================== */

/**
 * Заголовки после успешной аутентификации пользователя.
 * Используются для бизнес-эндпоинтов после проверки токена.
 *
 * Инварианты контекста запроса:
 * - API Gateway ОБЯЗАН добавлять заголовок WORKSPACE_ID
 *   для всех бизнес-эндпоинтов после успешной аутентификации.
 * - USER_ID обязателен для всех запросов,
 *   инициированных пользователем (UI, API-ключ, персональный доступ).
 * - Отсутствие этих заголовков считается ошибкой контракта
 *   и должно приводить к отказу в обработке запроса.
 */
export interface AuthenticatedRequestHeaders {
  [HEADERS.WORKSPACE_ID]: string;
  [HEADERS.USER_ID]: string;
  [HEADERS.TRACE_ID]?: string;
  [HEADERS.OPERATION_ID]?: string;
}

/* ============================================================================
 * ⚙️ SERVICE REQUEST HEADERS — INTERNAL/SYSTEM CONTEXT
 * ========================================================================== */

/**
 * Заголовки для внутренних/сервисных запросов
 * (например, webhooks, health checks, фоновые задачи).
 * Здесь workspace_id и user_id могут отсутствовать.
 */
export interface ServiceRequestHeaders {
  [HEADERS.WORKSPACE_ID]?: string;
  [HEADERS.USER_ID]?: string;
  [HEADERS.TRACE_ID]?: string;
  [HEADERS.OPERATION_ID]?: string;
}

/* ============================================================================
 * 📦 REQUEST HEADERS UNION — ALL POSSIBLE HEADERS
 * ========================================================================== */

/**
 * Все возможные заголовки запроса.
 * Union типов для authenticated и service контекстов.
 */
export type RequestHeaders = AuthenticatedRequestHeaders | ServiceRequestHeaders;
