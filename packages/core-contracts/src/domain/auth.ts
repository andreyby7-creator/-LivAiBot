/**
 * @file Типы и DTO для аутентификации и авторизации
 */
import type { UUID } from './common.js';

/**
 * Запрос на регистрацию пользователя и workspace.
 */
export type RegisterRequest = {
  email: string;
  password: string;
  workspace_name: string;
};

/**
 * Запрос на вход в систему.
 */
export type LoginRequest = {
  email: string;
  password: string;
};

/**
 * Ответ с токенами после успешного входа/регистрации.
 */
export type TokenPairResponse = {
  access_token: string;
  refresh_token: string;
  /**
   * Тип токена. Всегда "bearer".
   */
  token_type: 'bearer';
};

/**
 * Информация о текущем пользователе.
 * Может быть расширена без breaking changes.
 */
export type MeResponse = {
  user_id: UUID;
  email: string;
  workspace_id: UUID;
};

/**
 * Запрос на обновление токенов.
 */
export type RefreshRequest = {
  refresh_token: string;
};
