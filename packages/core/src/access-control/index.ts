/**
 * @file packages/core/src/access-control/index.ts
 * ============================================================================
 * 🛡️ ACCESS CONTROL — Public API
 * ============================================================================
 * Публичный API access control (core + React).
 * Core engine (`auth-guard.ts`) — чистое ядро без React зависимостей.
 * React-части (`auth-guard.react.tsx`) — React hooks и контекст для интеграции с UI.
 */

/* ============================================================================
 * 🧠 CORE ENGINE — AUTHORIZATION LOGIC (NO REACT)
 * ========================================================================== */

/**
 * Core engine для авторизации:
 * - types, guards, authorization checks, error handling
 * - без React/DOM зависимостей (platform-neutral)
 * @public
 */

export * from './auth-guard.js';

/* ============================================================================
 * ⚛️ REACT ADAPTER — REACT HOOKS & CONTEXT
 * ========================================================================== */

/**
 * React adapter для авторизации:
 * - AuthGuardContext, AuthGuardProvider, useAuthGuardContext, useCheckAccess, useMemoizedCheckAccess
 * - React hooks и контекст для интеграции с UI компонентами
 * @public
 */

export * from './auth-guard.react.js';
