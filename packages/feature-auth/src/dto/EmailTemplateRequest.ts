/**
 * @file packages/feature-auth/src/dto/EmailTemplateRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — EmailTemplateRequest DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - DTO для отправки кастомных email-шаблонов
 * - Используется для верификации, восстановления пароля, MFA, уведомлений
 * - Отделяет auth-домен от конкретного email-провайдера
 * - Поддерживает i18n и template variables
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Provider-agnostic
 * - ✅ Security & audit aware
 *
 * @example
 * const req: EmailTemplateRequest = {
 *   templateId: 'verify-email',
 *   to: 'user@example.com',
 *   locale: 'en-US',
 *   variables: {
 *     verificationLink: 'https://app.example.com/verify?token=abc'
 *   },
 *   meta: { reason: 'email_verification' }
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Типы email-сценариев в auth-домене */
export type AuthEmailTemplateType =
  | 'verify_email'
  | 'password_reset'
  | 'mfa_code'
  | 'login_alert'
  | 'security_notification';

/** DTO запроса email-шаблона */
export type EmailTemplateRequest = {
  /** Идентификатор шаблона (логический или provider-specific) */
  readonly templateId: string;

  /** Тип email-сценария (для аудита и аналитики) */
  readonly type?: AuthEmailTemplateType;

  /** Email получателя */
  readonly to: string;

  /** Язык / локаль шаблона */
  readonly locale?: string;

  /** Переменные, подставляемые в шаблон (может быть пустым объектом для шаблонов без переменных) */
  readonly variables: Record<string, string | number | boolean>;

  /** Клиентское приложение-инициатор */
  readonly clientApp?: string;

  /** Идентификатор пользователя (если известен) */
  readonly userId?: string;

  /** Временная метка запроса (ISO 8601) */
  readonly timestamp?: string;

  /**
   * Дополнительный контекст:
   * - verification token
   * - reset flow id
   * - security reason
   * - provider hints
   */
  readonly meta?: Record<string, unknown>;
};
