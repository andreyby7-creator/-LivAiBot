/**
 * @file packages/feature-auth/src — Public API для Feature Auth пакета
 * Публичный API пакета @livai/feature-auth.
 * Экспортирует все публичные типы, схемы, эффекты, утилиты и хранилища для аутентификации.
 * Tree-shakeable: все named exports остаются, импорты будут по нужным компонентам.
 * Принцип:
 * - бизнес-логика аутентификации (UI-агностичная)
 * - типизированные контракты для auth операций
 * - runtime валидация через Zod схемы
 * - type-safe inference для TypeScript
 * - согласованность с backend контрактами
 */

/* ============================================================================
 * 🧬 DOMAIN — ДОМЕННЫЕ ТИПЫ
 * ========================================================================== */

/**
 * Domain подпакет: доменные типы для аутентификации.
 * Включает LoginRequest, RegisterRequest, TokenPair, MFA типы, OAuth типы,
 * Password Reset, Verification, Email/SMS Templates, Risk Assessment,
 * Audit Events, Error Responses, Session Policy и все связанные типы.
 * @public
 */
export * from './domain/index.js';

/* ============================================================================
 * ✅ SCHEMAS — СХЕМЫ ВАЛИДАЦИИ
 * ========================================================================== */

/**
 * Schemas подпакет: Zod схемы для runtime валидации.
 * Включает схемы для всех запросов и ответов аутентификации с type-safe inference.
 * @public
 */
export * from './schemas/index.js';

/* ============================================================================
 * 🧩 TYPES — АГРЕГИРУЮЩИЕ ТИПЫ
 * ========================================================================== */

/**
 * Types подпакет: агрегирующие типы для состояния и статусов аутентификации.
 * Включает AuthState, MfaState, OAuthState, SecurityState, SessionState,
 * RiskContext, RiskPolicy, RiskAssessmentResult и все связанные типы.
 * @public
 */
export * from './types/index.js';

/* ============================================================================
 * ⚡ EFFECTS — ЭФФЕКТЫ
 * ========================================================================== */

/**
 * Effects подпакет: pure effects для аутентификации.
 * Включает Login Metadata Enricher, Risk Assessment Adapter, Risk Assessment,
 * Classification Mapper, Error Mapper, Validation, Device Fingerprint,
 * Login API Mapper, Login Store Updater, Login Effect DI Types и все связанные типы.
 * @public
 */
export * from './effects/index.js';

/* ============================================================================
 * 🛡️ LIB — БИБЛИОТЕЧНЫЕ УТИЛИТЫ
 * ========================================================================== */

/**
 * Lib подпакет: библиотечные утилиты для безопасности.
 * Включает Security Pipeline для оценки рисков и принятия решений.
 * @public
 */
export * from './lib/index.js';

/* ============================================================================
 * 🏪 STORES — ХРАНИЛИЩА
 * ========================================================================== */

/**
 * Stores подпакет: Zustand stores для управления состоянием аутентификации.
 * Включает Auth Store с созданием, валидацией, восстановлением и всеми связанными типами и функциями.
 * @public
 */
export * from './stores/index.js';
