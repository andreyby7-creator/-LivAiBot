/**
 * @file @livai/core-contracts — Core Contracts (Foundation Layer)
 * Публичный API пакета core-contracts.
 * Экспортирует все публичные компоненты, типы и утилиты для контрактов API, типов ошибок и контекстных данных.
 * Используется во всех сервисах и UI.
 */

/* ============================================================================
 * 🚨 ERRORS — HTTP ERROR TYPES & CODES
 * ============================================================================
 */

/**
 * Errors подпакет: типы ошибок HTTP API и стандартизированные коды ошибок.
 * Включает ErrorResponse (единый контракт ошибки), errorCodes (стандартизированные коды).
 * Используется для единообразной обработки ошибок во всех сервисах.
 * @public
 */
export * from './errors/index.js';

/* ============================================================================
 * 📋 CONTEXT — REQUEST CONTEXT & HEADERS
 * ============================================================================
 */

/**
 * Context подпакет: контекстные данные запроса и стандартизированные HTTP заголовки.
 * Включает HEADERS (trace_id, operation_id, workspace_id, user_id),
 * HTTP методы (HttpMethod) и имена сервисов (ServiceName).
 * Используется для межсервисного взаимодействия, корреляции запросов, tenant isolation.
 * @public
 */
export * from './context/index.js';

/* ============================================================================
 * 🧩 DOMAIN — DOMAIN TYPES & DTO
 * ============================================================================
 */

/**
 * Domain подпакет: доменные типы и DTO для всех доменов.
 * Включает common типы (UUID, ISODateString, JsonObject, Settings, Decision types),
 * app-effects типы (ApiRequestContext, ApiError, ApiResponse, AppError),
 * auth типы, bots типы, conversations типы, telemetry типы.
 * Используется для типизации данных между слоями.
 * @public
 */
export * from './domain/index.js';

/* ============================================================================
 * ✅ VALIDATION — RUNTIME VALIDATION (ZOD)
 * ============================================================================
 */

/**
 * Validation подпакет: runtime-валидация для frontend через Zod.
 * Включает автогенерированные схемы из OpenAPI (generated/**),
 * кастомные схемы и правила (custom/**), утилиты для валидации (utils/**).
 * Автогенерация из OpenAPI + кастомные расширения через .extend() / .refine().
 * @public
 */
export * from './validation/zod/index.js';
