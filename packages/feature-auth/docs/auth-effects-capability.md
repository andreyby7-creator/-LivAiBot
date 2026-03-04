# Capability-Based DI для Auth Effects

> Фиксирует capability-based модель зависимостей для всех auth-эффектов. Вместо монолитного `AuthEffectBaseDeps` — композиционные capability-контракты.

---

## 🎯 Архитектурная модель

**Принцип:** каждый эффект явно декларирует свои возможности через intersection типов.

**Пример: Login Effect**

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
  & WithAbort
  & Readonly<{
    securityPipeline: SecurityPipelinePort; // ExtraDeps
  }>;
```

**Схема зависимостей:**

```
Effect → Capability (shared) → ExtraDeps (effect-specific)
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
packages/feature-auth/src/effects/shared/capabilities/
├── index.ts                    # Экспорт всех capability-типов
├── with-api-client.ts
├── with-auth-store.ts
├── with-session-state-builder.ts
├── with-session-manager.ts
├── with-error-mapping.ts
├── with-audit.ts
├── with-telemetry.ts
├── with-clock.ts
├── with-identifier-hashing.ts
└── with-abort.ts
```

**См. каталог `effects/shared/capabilities/` для полного кода capability-типов.**

---

## 🔧 Capability-типы

### 1. `WithApiClient`

**Файл:** `with-api-client.ts`\
**Описание:** HTTP-клиент для auth API\
**Используется в:** всех эффектах с API-запросами

### 2. `WithAuthStore`

**Файл:** `with-auth-store.ts`\
**Описание:** доступ к auth store\
**Используется в:** всех эффектах, которые читают/обновляют AuthState/SessionState

### 3. `WithSessionStateBuilder`

**Файл:** `with-session-state-builder.ts`\
**Описание:** построение SessionState через единый builder\
**Используется в:** эффектах, которые создают/обновляют сессию (login, register, refresh, reset-password, mfa-challenge, oauth-*)

### 4. `WithSessionManager`

**Файл:** `with-session-manager.ts`\
**Описание:** policy-слой для сессий (TTL, refresh, invalidate)\
**Используется в:** refresh, proactive-refresh, session-policy-check, logout-all-sessions

### 5. `WithErrorMapping`

**Файл:** `with-error-mapping.ts`\
**Описание:** нормализация ошибок в AuthError\
**Используется в:** всех эффектах с API-запросами

### 6. `WithAudit`

**Файл:** `with-audit.ts`\
**Описание:** логирование audit-событий (best-effort, ошибки не ломают основной flow)\
**Используется в:** всех эффектах

### 7. `WithTelemetry`

**Файл:** `with-telemetry.ts`\
**Описание:** observability для auth-слоя (опционально, best-effort)\
**Используется в:** всех эффектах

### 8. `WithClock`

**Файл:** `with-clock.ts`\
**Описание:** единый источник времени\
**Используется в:** всех эффектах (policy checks, audit timestamps, metadata)

### 9. `WithIdentifierHashing`

**Файл:** `with-identifier-hashing.ts`\
**Описание:** хеширование идентификаторов для privacy-safe metadata/audit\
**Используется в:** login, register, oauth-login, oauth-register

### 10. `WithAbort`

**Файл:** `with-abort.ts`\
**Описание:** создание AbortController для cancellation\
**Используется в:** эффектах с concurrency стратегией `cancel_previous` (login, register, logout remote)

---

## 🔒 Инварианты (Rules)

### Таблица обязательных capability

| Тип эффекта           | Обязательные capability                                            |
| --------------------- | ------------------------------------------------------------------ |
| **API-эффекты**       | `WithApiClient`, `WithErrorMapping`, `WithAudit`, `WithClock`      |
| **Store-эффекты**     | `WithAuthStore`, `WithAudit`, `WithClock`                          |
| **Session-создающие** | `WithSessionStateBuilder` (обязательно через builder, не напрямую) |

**Проверка:** если эффект использует `apiClient`, но не использует `WithErrorMapping` → нарушение инварианта.

**Исключения для SessionStateBuilder:**

- `verify-email`, `verify-phone`, `mfa-setup`, `update-profile` — обновляют только отдельные поля через `batchUpdate`, не создают новую сессию.

---

## 🎯 ExtraDeps (специфические зависимости)

**Определение:** доменно-специфичные зависимости, которые используются только в конкретном эффекте и не являются общими capability.

**Правило:** доменно-специфичные capability (securityPipeline, OAuth provider, MFA provider) **НЕ** входят в `shared/capabilities/`, а только в `ExtraDeps` конкретного эффекта.

**Примеры:**

- `securityPipeline` → только в `LoginEffectDeps` / `OAuthLoginEffectDeps`
- `oauthProvider` → только в `OAuthLoginEffectDeps` / `OAuthRegisterEffectDeps`
- `mfaProvider` → только в `MfaChallengeEffectDeps`

**Проверка:** если capability используется только в одном эффекте → вынести в ExtraDeps этого эффекта.

---

## 📝 Пример использования: Login Effect

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
    securityPipeline: SecurityPipelinePort; // ExtraDeps
  }>;
```

**Composer:**

```ts
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
  securityPipeline: createSecurityPipelinePort(...), // ExtraDeps
};
```

**Остальные эффекты:** аналогично, используя нужные capability из матрицы ниже.

---

## 🧪 Тестирование capability

### Type-level проверки

**Создать:** `tests/unit/effects/shared/capabilities/capability-types.test.ts`

**Принцип:** создать unit-test для type-level проверки соответствия `*EffectDeps` обязательным capability.

**Пример:**

```ts
import type { LoginEffectDeps } from '../../../../src/effects/login/login-effect.types.js';
import type {
  WithApiClient,
  WithAudit,
  WithClock,
  WithErrorMapping,
} from '../../../../src/effects/shared/capabilities/index.js';

// Type-level проверка: LoginEffectDeps должен включать обязательные capability
type _CheckLoginDeps = LoginEffectDeps extends
  WithApiClient & WithErrorMapping & WithAudit & WithClock ? true
  : never; // Ошибка компиляции, если не соответствует
```

---

## 📋 Guidelines для новых эффектов

**Правила:**

1. Новые эффекты должны использовать capability из `shared/capabilities/`
2. ExtraDeps только при необходимости (уникальные зависимости)
3. Соблюдение инвариантов (обязательные capability для API/store-эффектов)
4. **Проверка инвариантов через type-level тесты** — создать unit-test для проверки соответствия обязательным capability

**Пример проверки:** см. раздел "Тестирование capability" ниже.

---

## ✅ Чеклист финализации

- [ ] Создать все 10 capability-типов в `effects/shared/capabilities/`
- [ ] Обновить `effects/shared/index.ts` для re-export capability-типов
- [ ] Обновить существующие эффекты (login, register, logout, refresh) на capability-based модель
- [ ] Обновить composer'ы для использования capability-модулей
- [ ] Проверить инварианты (обязательные capability для API/store-эффектов)
- [ ] Добавить type-level тесты для capability-типов
- [ ] Убедиться, что ExtraDeps не дублируют shared capability

---

## 📊 Матрица эффект → capability

### Реализованные эффекты

- **login**: `ApiClient`, `AuthStore`, `SessionBuilder`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`, `IdentifierHash`, `Abort` + `securityPipeline`
- **register**: `ApiClient`, `AuthStore`, `SessionBuilder`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`, `IdentifierHash`, `Abort` + `traceIdGenerator`, `eventIdGenerator`
- **logout**: `AuthStore`, `Audit`, `Telemetry`, `Clock`, `Abort` (opt); remote: + `ApiClient`, `ErrorMapping` + `mode`
- **refresh**: `ApiClient`, `AuthStore`, `SessionBuilder`, `SessionManager`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`

### Запланированные эффекты

- **forgot-password**: `ApiClient`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`
- **reset-password**: `ApiClient`, `AuthStore`, `SessionBuilder`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`
- **verify-email / verify-phone**: `ApiClient`, `AuthStore`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`
- **mfa-challenge / mfa-backup-code**: `ApiClient`, `AuthStore`, `SessionBuilder`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`
- **mfa-setup**: `ApiClient`, `AuthStore`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`
- **oauth-login**: `ApiClient`, `AuthStore`, `SessionBuilder`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`, `IdentifierHash` + `securityPipeline`
- **oauth-register**: `ApiClient`, `AuthStore`, `SessionBuilder`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`, `IdentifierHash`
- **session-revoke**: `ApiClient`, `AuthStore`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`
- **logout-all-sessions**: `AuthStore`, `Audit`, `Telemetry`, `Clock` + `sessionRevokeEffect`, `logoutEffect`
- **change-password**: `ApiClient`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`
- **update-profile**: `ApiClient`, `AuthStore`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`
- **account-lock / account-unblock**: `ApiClient`, `AuthStore`, `ErrorMapping`, `Audit`, `Telemetry`, `Clock`
- **session-policy-check**: `AuthStore`, `SessionManager`, `Audit`, `Telemetry`, `Clock`
- **proactive-refresh**: `AuthStore`, `SessionManager`, `Audit`, `Telemetry`, `Clock` + `refreshEffect`

---

## 📚 Связанные документы

- `auth-status.md` — статус реализации auth слоя и guidelines для будущих эффектов
- `auth-testing-guide.md` — руководство по тестированию auth слоя
- `auth-next-effects.md` — запланированные расширенные эффекты
- `phase2-UI.md` — roadmap Phase 2
