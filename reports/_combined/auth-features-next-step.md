# План реализации фич аутентификации

## 1. WebAuthn/Passkeys

### Domain DTO

**Файл:** `packages/feature-auth/src/domain/WebAuthnRequest.ts` (новый)

- `WebAuthnChallengeRequest` — запрос challenge от backend
- `WebAuthnCredentialRequest` — ответ с credential для верификации
- `WebAuthnRegistrationRequest` — регистрация нового passkey
- Типы для `PublicKeyCredentialRequestOptions` и `PublicKeyCredentialCreationOptions`

### Расширение MFA типов

**Файл:** `packages/feature-auth/src/domain/MfaChallengeRequest.ts`

- Расширить `MfaType`: добавить `'webauthn' | 'passkey'`
- Добавить WebAuthn-специфичные поля в `MfaChallengeRequest`:
  ```typescript
  readonly webauthnOptions?: PublicKeyCredentialRequestOptions;
  readonly allowCredentials?: PublicKeyCredentialDescriptor[];
  ```

### WebAuthn helpers

**Файл:** `packages/feature-auth/src/effects/webauthn.ts` (новый)

- `createWebAuthnChallenge()` — создание challenge через WebAuthn API
- `verifyWebAuthnCredential()` — верификация credential
- `registerPasskey()` — регистрация нового passkey
- `isWebAuthnAvailable()` — проверка поддержки WebAuthn

### Интеграция в login flow

**Файл:** `packages/feature-auth/src/effects/login.ts`

- Расширить `handleMfaFlow()` для поддержки WebAuthn:
  ```typescript
  if (method === 'webauthn' || method === 'passkey') {
    const credential = await createWebAuthnChallenge(challengeOptions);
    // Отправить credential на backend
  }
  ```

### Store обновления

**Файл:** `packages/feature-auth/src/types/auth.ts`

- Расширить `MfaState` для WebAuthn:
  ```typescript
  readonly webauthnChallenge?: PublicKeyCredentialRequestOptions;
  readonly credentialId?: string;
  ```

### Схемы валидации

**Файл:** `packages/feature-auth/src/schemas.ts`

- Добавить Zod схемы для WebAuthn DTO

---

## 2. Device Trust Persistence

### Storage abstraction

**Файл:** `packages/feature-auth/src/lib/device-storage.ts` (новый)

- `DeviceStorage` interface — абстракция для persistent storage
- `LocalStorageDeviceStorage` — реализация через localStorage
- `IndexedDBDeviceStorage` — реализация через IndexedDB (для больших данных)
- `getDeviceStorage()` — factory функция для выбора storage

### Trusted Device DTO

**Файл:** `packages/feature-auth/src/domain/TrustedDevice.ts` (новый)

- `TrustedDevice` — информация о доверенном устройстве
  ```typescript
  readonly deviceId: string;
  readonly userId: string;
  readonly trustedAt: ISODateString;
  readonly lastUsedAt: ISODateString;
  readonly deviceInfo: DeviceInfo;
  readonly riskScore?: number;
  ```

### Расширение SecurityState

**Файл:** `packages/feature-auth/src/types/auth.ts`

- Добавить новый статус в `SecurityState`:
  ```typescript
  | {
      readonly status: 'device_trusted';
      readonly deviceId: string;
      readonly trustedAt: ISODateString;
      readonly trustLevel: 'low' | 'medium' | 'high';
    }
  ```

### Device trust helpers

**Файл:** `packages/feature-auth/src/effects/device-trust.ts` (новый)

- `shouldTrustDevice()` — логика определения, нужно ли доверять устройству
- `storeTrustedDevice()` — сохранение trusted device
- `getTrustedDevice()` — получение trusted device из storage
- `revokeTrustedDevice()` — отзыв доверия

### Интеграция в login flow

**Файл:** `packages/feature-auth/src/effects/login.ts`

- В `handleSuccessfulLogin()` добавить:
  ```typescript
  // Проверяем, нужно ли доверять устройству
  if (shouldTrustDevice(riskAssessment, deviceInfo, user)) {
    await storeTrustedDevice(deviceInfo, user.id, riskAssessment);
    // Обновить SecurityState
  }
  ```

### Store actions

**Файл:** `packages/feature-auth/src/stores/auth.ts`

- Добавить `setDeviceTrusted()` action для обновления SecurityState

---

## 3. CAPTCHA

### CAPTCHA providers abstraction

**Файл:** `packages/feature-auth/src/lib/captcha.ts` (новый)

- `CaptchaProvider` interface — абстракция для разных провайдеров
- `RecaptchaProvider` — Google reCAPTCHA v3
- `HcaptchaProvider` — hCaptcha
- `TurnstileProvider` — Cloudflare Turnstile
- `getCaptchaProvider()` — factory функция

### CAPTCHA DTO

**Файл:** `packages/feature-auth/src/domain/CaptchaRequest.ts` (новый)

- `CaptchaRequest` — запрос с CAPTCHA token
  ```typescript
  readonly provider: 'recaptcha' | 'hcaptcha' | 'turnstile';
  readonly token: string;
  readonly action?: string; // для reCAPTCHA v3
  readonly score?: number; // для reCAPTCHA v3
  ```

### Расширение LoginRequest

**Файл:** `packages/feature-auth/src/domain/LoginRequest.ts`

- Добавить опциональное поле:
  ```typescript
  readonly captcha?: CaptchaRequest;
  ```

### CAPTCHA helpers

**Файл:** `packages/feature-auth/src/effects/captcha.ts` (новый)

- `requiresCaptcha()` — определяет, нужна ли CAPTCHA на основе risk assessment
- `requestCaptcha()` — запрашивает CAPTCHA token от провайдера
- `verifyCaptcha()` — верифицирует token на backend (через API)

### Интеграция в login flow

**Файл:** `packages/feature-auth/src/effects/login.ts`

- В `createLoginEffect` перед API запросом:
  ```typescript
  // Шаг 4.5: Проверяем, нужна ли CAPTCHA
  if (requiresCaptcha(riskAssessment)) {
    const captchaToken = await requestCaptcha('recaptcha');
    enrichedLoginRequest.captcha = {
      provider: 'recaptcha',
      token: captchaToken,
      action: 'login',
    };
  }
  ```

### Конфигурация

**Файл:** `packages/feature-auth/src/effects/login.ts`

- Добавить в `LoginEffectConfig`:
  ```typescript
  readonly captchaConfig?: {
    provider: 'recaptcha' | 'hcaptcha' | 'turnstile';
    siteKey: string;
    enabled: boolean;
    riskThreshold?: number; // минимальный risk score для CAPTCHA
  };
  ```

---

## 4. Progressive Login

### Progressive Login DTO

**Файл:** `packages/feature-auth/src/domain/ProgressiveLoginRequest.ts` (новый)

- `ProgressiveLoginStep` — шаги progressive login:
  ```typescript
  type ProgressiveLoginStep = 'identifier' | 'password' | 'mfa' | 'complete';
  ```
- `ProgressiveLoginRequest` — запрос для каждого шага:
  ```typescript
  readonly step: ProgressiveLoginStep;
  readonly identifier?: LoginIdentifier;
  readonly password?: string;
  readonly mfaToken?: string;
  readonly sessionToken?: string; // для продолжения flow
  ```

### Расширение AuthState

**Файл:** `packages/feature-auth/src/types/auth.ts`

- Добавить новый статус в `AuthState`:
  ```typescript
  | {
      readonly status: 'progressive_login';
      readonly step: 'identifier' | 'password' | 'mfa';
      readonly sessionToken?: string;
      readonly userId?: string;
      readonly meta?: readonly AuthMeta[];
    }
  ```

### Progressive Login Effect

**Файл:** `packages/feature-auth/src/effects/progressive-login.ts` (новый)

- `createProgressiveLoginEffect()` — основной effect для progressive flow
- `handleProgressiveStep()` — обработка каждого шага
- `validateProgressiveStep()` — валидация данных шага

### Store actions

**Файл:** `packages/feature-auth/src/stores/auth.ts`

- Добавить `setProgressiveLoginStep()` action
- Добавить `clearProgressiveLogin()` action

### Интеграция в login

**Файл:** `packages/feature-auth/src/effects/login.ts`

- Добавить опциональный флаг в `LoginEffectConfig`:
  ```typescript
  readonly progressiveMode?: boolean;
  ```
- Модифицировать `createLoginEffect` для поддержки progressive mode:
  ```typescript
  if (config.progressiveMode) {
    return createProgressiveLoginEffect(config)(loginRequest);
  }
  ```

### Progressive Login helpers

**Файл:** `packages/feature-auth/src/effects/progressive-login.ts`

- `continueProgressiveLogin()` — продолжение flow с session token
- `resetProgressiveLogin()` — сброс progressive flow

---

## Итоговая структура файлов

### Новые файлы:

```
packages/feature-auth/src/
├── domain/
│   ├── WebAuthnRequest.ts          # WebAuthn DTO
│   ├── TrustedDevice.ts             # Device Trust DTO
│   ├── CaptchaRequest.ts            # CAPTCHA DTO
│   └── ProgressiveLoginRequest.ts # Progressive Login DTO
├── effects/
│   ├── webauthn.ts                  # WebAuthn helpers
│   ├── device-trust.ts                # Device Trust helpers
│   ├── captcha.ts                     # CAPTCHA helpers
│   └── progressive-login.ts           # Progressive Login effect
└── lib/
    ├── device-storage.ts              # Storage abstraction
    └── captcha.ts                     # CAPTCHA providers
```

### Изменяемые файлы:

- `packages/feature-auth/src/domain/MfaChallengeRequest.ts` — расширение MfaType
- `packages/feature-auth/src/types/auth.ts` — расширение AuthState, SecurityState, MfaState
- `packages/feature-auth/src/effects/login.ts` — интеграция всех фич
- `packages/feature-auth/src/stores/auth.ts` — новые actions
- `packages/feature-auth/src/schemas.ts` — новые Zod схемы

---

## Приоритет реализации

1. **Device Trust Persistence** — минимальные зависимости, быстрое улучшение UX
2. **CAPTCHA** — защита от ботов, простая интеграция
3. **WebAuthn/Passkeys** — требует больше работы, но важная фича
4. **Progressive Login** — требует рефакторинга login flow
