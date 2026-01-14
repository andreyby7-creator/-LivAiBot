/**
 * @file Стандартизированные HTTP заголовки для межсервисного взаимодействия
 *
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

/**
 * Инварианты контекста запроса:
 *
 * - API Gateway ОБЯЗАН добавлять заголовок WORKSPACE_ID
 *   для всех бизнес-эндпоинтов после успешной аутентификации.
 *
 * - USER_ID обязателен для всех запросов,
 *   инициированных пользователем (UI, API-ключ, персональный доступ).
 *
 * - Отсутствие этих заголовков считается ошибкой контракта
 *   и должно приводить к отказу в обработке запроса.
 */

/**
 * Заголовки после успешной аутентификации пользователя.
 * Используются для бизнес-эндпоинтов после проверки токена.
 */
export interface AuthenticatedRequestHeaders {
  [HEADERS.WORKSPACE_ID]: string;
  [HEADERS.USER_ID]: string;
  [HEADERS.TRACE_ID]?: string;
  [HEADERS.OPERATION_ID]?: string;
}

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

/**
 * Все возможные заголовки запроса.
 */
export type RequestHeaders = AuthenticatedRequestHeaders | ServiceRequestHeaders;
