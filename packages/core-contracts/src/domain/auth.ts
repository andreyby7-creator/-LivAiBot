/**
 * @file @livai/core-contracts/domain/auth.ts
 * ============================================================================
 * 🔐 AUTH — AUTHENTICATION & AUTHORIZATION CONTRACTS
 * ============================================================================
 *
 * Foundation-типы для аутентификации и авторизации пользователей.
 * Заметка по архитектуре:
 * - Регистрация создаёт пользователя и workspace одновременно (onboarding flow).
 * - Token-based auth с refresh token механизмом для долгоживущих сессий.
 * - MeResponse расширяем без breaking changes (добавляем опциональные поля).
 */
import type { UUID } from './common.js';

/* ============================================================================
 * 📝 REGISTRATION & LOGIN — USER ONBOARDING
 * ========================================================================== */

/**
 * Запрос на регистрацию пользователя и workspace.
 */
export interface RegisterRequest {
  email: string;
  password: string;
  workspace_name: string;
}

/**
 * Запрос на вход в систему.
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/* ============================================================================
 * 🎫 TOKEN RESPONSE — AUTHENTICATION SUCCESS
 * ========================================================================== */

/**
 * Ответ с токенами после успешного входа/регистрации.
 */
export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  /**
   * Тип токена. Всегда "bearer".
   */
  token_type: 'bearer';
  /**
   * Время жизни токена в секундах.
   */
  expires_in: number;
  /**
   * ID пользователя.
   */
  user_id: UUID;
  /**
   * ID workspace.
   */
  workspace_id: UUID;
}

/* ============================================================================
 * 👤 USER PROFILE — CURRENT USER CONTEXT
 * ========================================================================== */

/**
 * Информация о текущем пользователе.
 * Может быть расширена без breaking changes.
 */
export interface MeResponse {
  user_id: UUID;
  email: string;
  workspace_id: UUID;
}

/* ============================================================================
 * 🔄 TOKEN MANAGEMENT — SESSION RENEWAL
 * ========================================================================== */

/**
 * Запрос на обновление токенов.
 */
export interface RefreshRequest {
  refresh_token: string;
}
