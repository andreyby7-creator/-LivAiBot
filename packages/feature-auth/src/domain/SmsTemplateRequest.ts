/**
 * @file packages/feature-auth/src/domain/SmsTemplateRequest.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — SmsTemplateRequest DTO
 * ============================================================================
 * Архитектурная роль:
 * - DTO для отправки кастомных SMS шаблонов
 * - Используется для верификации телефона, MFA, security уведомлений
 * - Полностью provider-agnostic (Twilio, Nexmo, SMSC, etc.)
 * - Поддержка i18n и template variables
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Provider-agnostic
 * - ✅ Security & audit aware
 *
 * @example
 * const req: SmsTemplateRequest = {
 *   templateId: 'verify-phone',
 *   to: '+491234567890',
 *   locale: 'de-DE',
 *   variables: { code: '123456' },
 *   meta: { reason: 'phone_verification' }
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Типы SMS-сценариев в auth-домене */
export type AuthSmsTemplateType =
  | 'verify_phone'
  | 'mfa_code'
  | 'login_alert'
  | 'security_notification';

/** DTO запроса SMS шаблона */
export type SmsTemplateRequest = {
  /** Идентификатор шаблона (логический или provider-specific) */
  readonly templateId: string;

  /** Тип SMS-сценария (для аудита и аналитики) */
  readonly type?: AuthSmsTemplateType;

  /** Номер телефона получателя (E.164) */
  readonly to: string;

  /** Локаль шаблона */
  readonly locale?: string;

  /** Переменные, подставляемые в шаблон */
  readonly variables?: Record<string, string | number | boolean>;

  /** Клиентское приложение-инициатор */
  readonly clientApp?: string;

  /** Идентификатор пользователя (если известен) */
  readonly userId?: string;

  /** Временная метка запроса (ISO 8601) */
  readonly timestamp?: string;

  /**
   * Дополнительный контекст:
   * - verification code
   * - MFA flow id
   * - security reason
   * - provider hints
   */
  readonly meta?: Record<string, unknown>;
};
