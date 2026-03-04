# Capability-Based DI для Auth Effects

> Фиксирует capability-based модель зависимостей для всех auth-эффектов. Вместо монолитного `AuthEffectBaseDeps` — композиционные capability-контракты.

---

## 🎯 Архитектурная модель

**Принцип:** каждый эффект явно декларирует свои возможности через intersection типов.

```ts
type LoginEffectDeps =
  & WithApiClient
  & WithAuthStore
  & WithSessionStateBuilder
  & WithErrorMapping
  & WithAudit
  & WithTelemetry
  & WithClock
  & WithIdentifierHashing
  & { securityPipeline: LoginSecurityPipelinePort; };
```

**Преимущества:**

- ✅ Нет базового монолита — каждый эффект собирает только нужные capability
- ✅ Явная декларация возможностей — сразу видно, чем эффект может пользоваться
- ✅ Композиционность DI — легко собирать deps из capability-модулей
- ✅ Тестируемость — можно подменять отдельные capability в тестах
- ✅ Масштабируемость — capability можно реиспользовать за пределами auth

---

## 📁 Файловая структура

```
packages/feature-auth/src/effects/
├── shared/
│   ├── capabilities/
│   │   ├── index.ts                    # Экспорт всех capability-типов
│   │   ├── with-api-client.ts          # WithApiClient
│   │   ├── with-auth-store.ts          # WithAuthStore
│   │   ├── with-session-state-builder.ts # WithSessionStateBuilder
│   │   ├── with-session-manager.ts      # WithSessionManager
│   │   ├── with-error-mapping.ts       # WithErrorMapping
│   │   ├── with-audit.ts               # WithAudit
│   │   ├── with-telemetry.ts           # WithTelemetry
│   │   ├── with-clock.ts               # WithClock
│   │   ├── with-identifier-hashing.ts # WithIdentifierHashing
│   │   └── with-abort.ts               # WithAbort
│   ├── api-client.port.ts              # AuthApiClientPort (существующий)
│   ├── auth-store.port.ts              # AuthStorePort (существующий)
│   ├── session-state.builder.ts        # buildSessionState (существующий)
│   └── index.ts                        # Re-export capabilities
```

---

## 🔧 Capability-типы

### 1. `WithApiClient`

**Файл:** `effects/shared/capabilities/with-api-client.ts`

```ts
import type { AuthApiClientPort } from '../api-client.port.js';

/**
 * Capability: HTTP-клиент для auth API.
 * Используется во всех эффектах, которые делают API-запросы.
 */
export type WithApiClient = Readonly<{
  apiClient: AuthApiClientPort;
}>;
```

**Используется в:** login, register, logout (remote), refresh, forgot-password, reset-password, verify-email, verify-phone, mfa-_, oauth-_, session-revoke, change-password, update-profile, account-lock, account-unblock

---

### 2. `WithAuthStore`

**Файл:** `effects/shared/capabilities/with-auth-store.ts`

```ts
import type { AuthStorePort } from '../auth-store.port.js';

/**
 * Capability: доступ к auth store.
 * Используется во всех эффектах, которые читают/обновляют AuthState/SessionState.
 */
export type WithAuthStore = Readonly<{
  authStore: AuthStorePort;
}>;
```

**Используется в:** login, register, logout, refresh, reset-password, verify-email, verify-phone, mfa-_, oauth-_, session-revoke, update-profile, account-lock, account-unblock, session-policy-check

---

### 3. `WithSessionStateBuilder`

**Файл:** `effects/shared/capabilities/with-session-state-builder.ts`

```ts
import type { BuildSessionStateParams } from '../session-state.builder.js';
import { buildSessionState } from '../session-state.builder.js';

/**
 * Capability: построение SessionState через единый builder.
 * Используется в эффектах, которые создают/обновляют сессию.
 */
export type WithSessionStateBuilder = Readonly<{
  sessionStateBuilder: {
    build: (params: BuildSessionStateParams) => ReturnType<typeof buildSessionState>;
  };
}>;
```

**Используется в:** login, register, refresh, reset-password, mfa-challenge, mfa-backup-code, oauth-login, oauth-register

---

### 4. `WithSessionManager`

**Файл:** `effects/shared/capabilities/with-session-manager.ts`

```ts
import type { SessionState } from '../../../types/auth.js';
import type { UnixTimestampMs } from '@livai/core-contracts';

/**
 * Capability: policy-слой для сессий (TTL, refresh, invalidate).
 * Используется в эффектах, которые проверяют/управляют жизненным циклом сессии.
 */
export type SessionManagerPort = Readonly<{
  shouldRefresh: (session: SessionState | null, now: UnixTimestampMs) => boolean;
  shouldInvalidate: (session: SessionState | null, now: UnixTimestampMs) => boolean;
  isExpired: (session: SessionState | null, now: UnixTimestampMs) => boolean;
  canOpenNewSession: (session: SessionState | null, now: UnixTimestampMs) => boolean;
}>;

export type WithSessionManager = Readonly<{
  sessionManager: SessionManagerPort;
}>;
```

**Используется в:** refresh, proactive-refresh, session-policy-check, logout-all-sessions

---

### 5. `WithErrorMapping`

**Файл:** `effects/shared/capabilities/with-error-mapping.ts`

```ts
import type { AuthError } from '../../../types/auth.js';

/**
 * Capability: нормализация ошибок в AuthError.
 * Используется во всех эффектах, которые обрабатывают API-ошибки.
 */
export type ErrorMapperPort = Readonly<{
  map: (unknownError: unknown) => AuthError;
}>;

export type WithErrorMapping = Readonly<{
  errorMapper: ErrorMapperPort;
}>;
```

**Используется в:** все эффекты с API-запросами (login, register, logout (remote), refresh, forgot-password, reset-password, verify-_, mfa-_, oauth-_, session-revoke, change-password, update-profile, account-_)

---

### 6. `WithAudit`

**Файл:** `effects/shared/capabilities/with-audit.ts`

```ts
import type { AuditEventValues } from '../../../schemas/index.js';

/**
 * Capability: логирование audit-событий.
 * Используется во всех эффектах для security-логирования.
 */
export type AuditLoggerPort = Readonly<{
  logAuditEvent: (event: AuditEventValues) => void | Promise<void>;
}>;

export type WithAudit = Readonly<{
  auditLogger: AuditLoggerPort;
}>;
```

**Используется в:** все эффекты (best-effort логирование)

---

### 7. `WithTelemetry`

**Файл:** `effects/shared/capabilities/with-telemetry.ts`

```ts
/**
 * Capability: observability для auth-слоя.
 * Используется во всех эффектах для метрик и мониторинга.
 */
export type TelemetryPort = Readonly<{
  recordAuditFailure: (event: Readonly<{ operation: string; reason: string; }>) => void;
  recordErrorMapperFailure: (event: Readonly<{ operation: string; reason: string; }>) => void;
  recordEffectDuration: (event: Readonly<{ operation: string; durationMs: number; }>) => void;
}>;

export type WithTelemetry = Readonly<{
  telemetry?: TelemetryPort | undefined;
}>;
```

**Используется в:** все эффекты (опционально, best-effort)

---

### 8. `WithClock`

**Файл:** `effects/shared/capabilities/with-clock.ts`

```ts
import type { UnixTimestampMs } from '@livai/core-contracts';

/**
 * Capability: единый источник времени.
 * Используется во всех эффектах для policy checks, audit timestamps, metadata.
 */
export type ClockPort = Readonly<{
  now: () => UnixTimestampMs;
}>;

export type WithClock = Readonly<{
  clock: ClockPort;
}>;
```

**Используется в:** все эффекты (policy, audit, metadata)

---

### 9. `WithIdentifierHashing`

**Файл:** `effects/shared/capabilities/with-identifier-hashing.ts`

```ts
/**
 * Capability: хеширование идентификаторов для privacy-safe metadata/audit.
 * Используется в эффектах, которые работают с user identifiers (login, register, OAuth).
 */
export type IdentifierHasherPort = Readonly<{
  hash: (input: string) => string;
}>;

export type WithIdentifierHashing = Readonly<{
  identifierHasher: IdentifierHasherPort;
}>;
```

**Используется в:** login, register, oauth-login, oauth-register

---

### 10. `WithAbort`

**Файл:** `effects/shared/capabilities/with-abort.ts`

```ts
/**
 * Capability: создание AbortController для cancellation.
 * Используется в эффектах с concurrency стратегией 'cancel_previous'.
 */
export type AbortControllerPort = Readonly<{
  create: () => AbortController;
}>;

export type WithAbort = Readonly<{
  abortController?: AbortControllerPort | undefined;
}>;
```

**Используется в:** login, register, logout (remote, опционально)

---

## 📊 Матрица эффект → capability dependencies

| Effect                   | ApiClient   | AuthStore | SessionBuilder | SessionManager | ErrorMapping | Audit | Telemetry | Clock | IdentifierHash | Abort    | ExtraDeps                              |
| ------------------------ | ----------- | --------- | -------------- | -------------- | ------------ | ----- | --------- | ----- | -------------- | -------- | -------------------------------------- |
| **login**                | ✅          | ✅        | ✅             | ❌             | ✅           | ✅    | ✅        | ✅    | ✅             | ✅       | `securityPipeline`                     |
| **register**             | ✅          | ✅        | ✅             | ❌             | ✅           | ✅    | ✅        | ✅    | ✅             | ✅       | `traceIdGenerator`, `eventIdGenerator` |
| **logout**               | ✅ (remote) | ✅        | ❌             | ❌             | ✅ (remote)  | ✅    | ✅        | ✅    | ❌             | ✅ (opt) | `mode: 'local' \| 'remote'`            |
| **refresh**              | ✅          | ✅        | ✅             | ✅             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **forgot-password**      | ✅          | ❌        | ❌             | ❌             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **reset-password**       | ✅          | ✅        | ✅             | ❌             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **verify-email**         | ✅          | ✅        | ❌             | ❌             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **verify-phone**         | ✅          | ✅        | ❌             | ❌             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **mfa-challenge**        | ✅          | ✅        | ✅             | ❌             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **mfa-setup**            | ✅          | ✅        | ❌             | ❌             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **mfa-backup-code**      | ✅          | ✅        | ✅             | ❌             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **oauth-login**          | ✅          | ✅        | ✅             | ❌             | ✅           | ✅    | ✅        | ✅    | ✅             | ❌       | `securityPipeline`                     |
| **oauth-register**       | ✅          | ✅        | ✅             | ❌             | ✅           | ✅    | ✅        | ✅    | ✅             | ❌       | —                                      |
| **session-revoke**       | ✅          | ✅        | ❌             | ❌             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **logout-all-sessions**  | ❌          | ✅        | ❌             | ❌             | ❌           | ✅    | ✅        | ✅    | ❌             | ❌       | `sessionRevokeEffect`, `logoutEffect`  |
| **change-password**      | ✅          | ❌        | ❌             | ❌             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **update-profile**       | ✅          | ✅        | ❌             | ❌             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **account-lock**         | ✅          | ✅        | ❌             | ❌             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **account-unblock**      | ✅          | ✅        | ❌             | ❌             | ✅           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **session-policy-check** | ❌          | ✅        | ❌             | ✅             | ❌           | ✅    | ✅        | ✅    | ❌             | ❌       | —                                      |
| **proactive-refresh**    | ❌          | ✅        | ❌             | ✅             | ❌           | ✅    | ✅        | ✅    | ❌             | ❌       | `refreshEffect`                        |

---

## 📝 Примеры использования

### Login Effect

**Файл:** `effects/login/login-effect.types.ts`

```ts
import type {
  WithAbort,
  WithApiClient,
  WithAudit,
  WithAuthStore,
  WithClock,
  WithErrorMapping,
  WithIdentifierHashing,
  WithSessionStateBuilder,
  WithTelemetry,
} from '../shared/capabilities/index.js';
import type { SecurityPipelinePort } from './login-effect.types.js';

export type LoginEffectDeps =
  & WithApiClient
  & WithAuthStore
  & WithSessionStateBuilder
  & WithErrorMapping
  & WithAudit
  & WithTelemetry
  & WithClock
  & WithIdentifierHashing
  & WithAbort
  & Readonly<{
    securityPipeline: SecurityPipelinePort;
  }>;
```

---

### Refresh Effect

**Файл:** `effects/refresh/refresh-effect.types.ts`

```ts
import type {
  WithApiClient,
  WithAudit,
  WithAuthStore,
  WithClock,
  WithErrorMapping,
  WithSessionManager,
  WithSessionStateBuilder,
  WithTelemetry,
} from '../shared/capabilities/index.js';

export type RefreshEffectDeps =
  & WithApiClient
  & WithAuthStore
  & WithSessionStateBuilder
  & WithSessionManager
  & WithErrorMapping
  & WithAudit
  & WithTelemetry
  & WithClock
  & Readonly<{
    eventIdGenerator: EventIdGeneratorPort; // Опционально, если нужен детерминизм
  }>;
```

---

### Forgot Password Effect

**Файл:** `effects/forgot-password/forgot-password-effect.types.ts`

```ts
import type {
  WithApiClient,
  WithAudit,
  WithClock,
  WithErrorMapping,
  WithTelemetry,
} from '../shared/capabilities/index.js';

export type ForgotPasswordEffectDeps =
  & WithApiClient
  & WithErrorMapping
  & WithAudit
  & WithTelemetry
  & WithClock;
```

---

### Logout Effect

**Файл:** `effects/logout/logout-effect.types.ts`

```ts
import type {
  WithAudit,
  WithAuthStore,
  WithClock,
  WithTelemetry,
} from '../shared/capabilities/index.js';

// Local mode
export type LocalLogoutEffectDeps =
  & WithAuthStore
  & WithAudit
  & WithTelemetry
  & WithClock;

// Remote mode
import type { WithAbort, WithApiClient, WithErrorMapping } from '../shared/capabilities/index.js';

export type RemoteLogoutEffectDeps =
  & WithAuthStore
  & WithApiClient
  & WithErrorMapping
  & WithAudit
  & WithTelemetry
  & WithClock
  & WithAbort;

export type LogoutEffectDeps =
  | (LocalLogoutEffectDeps & { mode: 'local'; })
  | (RemoteLogoutEffectDeps & { mode: 'remote'; });
```

---

## 🔒 Инварианты

### 1. Обязательные capability для API-эффектов

**Правило:** все эффекты, которые делают API-запросы, ОБЯЗАНЫ использовать:

- `WithApiClient`
- `WithErrorMapping`
- `WithAudit`
- `WithClock`

**Проверка:** если эффект использует `apiClient`, но не использует `WithErrorMapping` → нарушение инварианта.

---

### 2. Обязательные capability для store-эффектов

**Правило:** все эффекты, которые обновляют `AuthState`/`SessionState`, ОБЯЗАНЫ использовать:

- `WithAuthStore`
- `WithAudit`
- `WithClock`

**Проверка:** если эффект использует `authStore.batchUpdate`, но не использует `WithAudit` → нарушение инварианта.

---

### 3. SessionState строится только через builder

**Правило:** все эффекты, которые создают/обновляют `SessionState`, ОБЯЗАНЫ использовать:

- `WithSessionStateBuilder`

**Проверка:** если эффект напрямую строит `SessionState` без `sessionStateBuilder.build()` → нарушение инварианта.

**Исключения:**

- `verify-email` / `verify-phone` / `mfa-setup` / `update-profile` — обновляют только отдельные поля через `batchUpdate`, не создают новую сессию.

---

### 4. Нет доменно-специфичных capability

**Правило:** в `effects/shared/capabilities/` НЕ должно быть:

- `WithSecurityPipeline` (это login/OAuth-specific, не общее)
- `WithMfaProvider` (это MFA-specific, не общее)
- `WithOAuthProvider` (это OAuth-specific, не общее)

**Проверка:** если capability используется только в одном эффекте → вынести в ExtraDeps этого эффекта.

---

### 5. Telemetry всегда опциональна

**Правило:** `WithTelemetry` всегда опциональна (`telemetry?: TelemetryPort | undefined`).

**Причина:** best-effort observability не должна ломать основной flow.

---

## 🎯 Миграция существующих эффектов

### Шаг 1: Создать capability-типы

Создать файлы в `effects/shared/capabilities/` согласно структуре выше.

---

### Шаг 2: Обновить `login-effect.types.ts`

**Было:**

```ts
export type LoginEffectDeps = Readonly<{
  apiClient: AuthApiClientPort;
  authStore: AuthStorePort;
  securityPipeline: SecurityPipelinePort;
  identifierHasher: IdentifierHasherPort;
  auditLogger: AuditLoggerPort;
  errorMapper: ErrorMapperPort;
  abortController: AbortControllerPort;
  clock: ClockPort;
}>;
```

**Стало:**

```ts
import type {
  WithAbort,
  WithApiClient,
  WithAudit,
  WithAuthStore,
  WithClock,
  WithErrorMapping,
  WithIdentifierHashing,
  WithSessionStateBuilder,
  WithTelemetry,
} from '../shared/capabilities/index.js';

export type LoginEffectDeps =
  & WithApiClient
  & WithAuthStore
  & WithSessionStateBuilder
  & WithErrorMapping
  & WithAudit
  & WithTelemetry
  & WithClock
  & WithIdentifierHashing
  & WithAbort
  & Readonly<{
    securityPipeline: SecurityPipelinePort;
  }>;
```

---

### Шаг 3: Обновить composer'ы

**Было:**

```ts
const loginDeps: LoginEffectDeps = {
  apiClient: createApiClientPortAdapter(httpClient),
  authStore: createAuthStorePortAdapter(authStore),
  securityPipeline: createSecurityPipelinePort(...),
  identifierHasher: { hash: sha256 },
  auditLogger: { logAuditEvent: auditLogger.log },
  errorMapper: { map: errorMapper.map },
  abortController: { create: () => new AbortController() },
  clock: { now: () => Date.now() },
};
```

**Стало:**

```ts
// Собираем capability-модули
const apiClientCapability: WithApiClient = {
  apiClient: createApiClientPortAdapter(httpClient),
};

const authStoreCapability: WithAuthStore = {
  authStore: createAuthStorePortAdapter(authStore),
};

// ... остальные capability

// Композируем deps
const loginDeps: LoginEffectDeps = {
  ...apiClientCapability,
  ...authStoreCapability,
  ...sessionStateBuilderCapability,
  ...errorMappingCapability,
  ...auditCapability,
  ...telemetryCapability,
  ...clockCapability,
  ...identifierHashingCapability,
  ...abortCapability,
  securityPipeline: createSecurityPipelinePort(...),
};
```

---

## ✅ Чеклист финализации

- [ ] Создать все 10 capability-типов в `effects/shared/capabilities/`
- [ ] Обновить `effects/shared/index.ts` для re-export capability-типов
- [ ] Обновить `login-effect.types.ts` на capability-based модель
- [ ] Обновить `register-effect.types.ts` на capability-based модель
- [ ] Обновить `logout-effect.types.ts` на capability-based модель
- [ ] Обновить `refresh-effect.types.ts` на capability-based модель (когда будет реализован)
- [ ] Обновить composer'ы для использования capability-модулей
- [ ] Проверить инварианты (обязательные capability для API/store-эффектов)
- [ ] Добавить unit-тесты для capability-типов (type-level проверки)

---

## 📚 Связанные документы

- `auth-effects-plan.md` — план реализации refresh и useAuth
- `auth-next-effects.md` — запланированные расширенные эффекты
- `phase2-UI.md` — roadmap Phase 2
