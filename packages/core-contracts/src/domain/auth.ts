/**
 * @file Типы и DTO для аутентификации и авторизации
 */
import type { UUID } from './common.js';

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

/**
 * Информация о текущем пользователе.
 * Может быть расширена без breaking changes.
 */
export interface MeResponse {
  user_id: UUID;
  email: string;
  workspace_id: UUID;
}

/**
 * Запрос на обновление токенов.
 */
export interface RefreshRequest {
  refresh_token: string;
}
