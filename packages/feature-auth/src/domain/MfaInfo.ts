/**
 * @file packages/feature-auth/src/domain/MfaInfo.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — MfaInfo DTO
 * ============================================================================
 *
 * Архитектурная роль:
 * - Типизированный контракт информации о многофакторной аутентификации
 * - Используется в LoginRequest, RegisterRequest, RegisterResponse
 * - Immutable, extensible, security-aware, domain-pure
 *
 * Принципы:
 * - ❌ Нет бизнес-логики
 * - ✅ Полная типизация (discriminated union для type-safety)
 * - ✅ Immutable / readonly
 * - ✅ Extensible / future-proof
 * - ✅ Security-aware (sensitive data warnings)
 * - ✅ Domain-pure (не transport-driven)
 *
 * @example
 * // TOTP MFA (с токеном)
 * const totpMfa: MfaInfo = {
 *   type: 'totp',
 *   token: '123456',
 *   deviceId: 'device-abc'
 * };
 *
 * // SMS MFA (с токеном)
 * const smsMfa: MfaInfo = {
 *   type: 'sms',
 *   token: '654321'
 * };
 *
 * // Push MFA (без токена, обязательный deviceId)
 * const pushMfa: MfaInfo = {
 *   type: 'push',
 *   deviceId: 'device-xyz'
 * };
 */

/* ============================================================================
 * 🧭 TYPES
 * ============================================================================
 */

/** Тип MFA метода */
export type MfaType = 'totp' | 'sms' | 'email' | 'push';

/**
 * DTO информации о многофакторной аутентификации
 *
 * Discriminated union для type-safe branching:
 * - TOTP/SMS/Email: требуют token (string), deviceId опционален
 * - Push: не требует token, deviceId обязателен
 *
 * Это обеспечивает domain-pure структуру:
 * - Push approval не имеет "token" (это не string-based)
 * - WebAuthn (future) не будет string-based
 * - TypeScript exhaustiveness check работает корректно
 */
export type MfaInfo =
  | {
    /** Тип MFA метода с токеном (TOTP, SMS, Email) */
    readonly type: 'totp' | 'sms' | 'email';

    /**
     * MFA токен или код подтверждения
     *
     * ⚠️ SENSITIVE: must never be logged or persisted.
     * This field contains authentication credentials that should:
     * - Never appear in logs, telemetry, or audit trails
     * - Never be stored in plain text
     * - Be handled with the same security as passwords
     */
    readonly token: string;

    /** Идентификатор устройства (опционально, для привязки MFA к устройству) */
    readonly deviceId?: string;
  }
  | {
    /** Тип MFA метода без токена (Push) */
    readonly type: 'push';

    /** Идентификатор устройства (обязателен для Push) */
    readonly deviceId: string;
  };
