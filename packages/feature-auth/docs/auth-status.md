# Статус реализации Auth слоя

## ✅ Реализовано (базовые эффекты)

### 1. Login Effect

- ✅ `effects/login.ts` - orchestrator
- ✅ `effects/login/login-effect.types.ts` - DI порты
- ✅ `effects/login/login-api.mapper.ts` - маппинг API
- ✅ `effects/login/login-store-updater.ts` - обновление store
- ✅ `effects/login/login-audit.mapper.ts` - audit logging
- ✅ `effects/login/login-metadata.enricher.ts` - обогащение метаданных
- ✅ `effects/login/validation.ts` - валидация
- ✅ Интеграция в `@livai/app/lib/auth-hook-deps.ts`
- ✅ Интеграция в `@livai/app/hooks/useAuth.ts`
- ✅ Unit тесты: `tests/unit/effects/login.test.ts`

### 2. Logout Effect

- ✅ `effects/logout.ts` - orchestrator
- ✅ `effects/logout/logout-effect.types.ts` - DI порты
- ✅ `effects/logout/logout-store-updater.ts` - обновление store
- ✅ `effects/logout/logout-audit.mapper.ts` - audit logging
- ✅ Интеграция в `@livai/app/lib/auth-hook-deps.ts`
- ✅ Интеграция в `@livai/app/hooks/useAuth.ts`
- ✅ Unit тесты: `tests/unit/effects/logout.test.ts`

### 3. Register Effect

- ✅ `effects/register.ts` - orchestrator
- ✅ `effects/register/register-effect.types.ts` - DI порты
- ✅ `effects/register/register-api.mapper.ts` - маппинг API
- ✅ `effects/register/register-store-updater.ts` - обновление store
- ✅ `effects/register/register-audit.mapper.ts` - audit logging
- ✅ `effects/register/register-metadata.enricher.ts` - обогащение метаданных
- ✅ Интеграция в `@livai/app/lib/auth-hook-deps.ts`
- ✅ Интеграция в `@livai/app/hooks/useAuth.ts`
- ✅ Unit тесты: `tests/unit/effects/register.test.ts`

### 4. Refresh Effect

- ✅ `effects/refresh.ts` - orchestrator
- ✅ `effects/refresh/refresh-effect.types.ts` - DI порты
- ✅ `effects/refresh/refresh-api.mapper.ts` - маппинг API
- ✅ `effects/refresh/refresh-store-updater.ts` - обновление store
- ✅ `effects/refresh/refresh-audit.mapper.ts` - audit logging
- ✅ Интеграция в `@livai/app/lib/auth-hook-deps.ts`
- ✅ Интеграция в `@livai/app/hooks/useAuth.ts`
- ✅ Unit тесты: `tests/unit/effects/refresh.test.ts`

### 5. Shared Infrastructure

- ✅ `effects/shared/api-client.port.ts` - порт для API клиента
- ✅ `effects/shared/api-client.adapter.ts` - адаптер API клиента
- ✅ `effects/shared/auth-store.port.ts` - порт для auth store
- ✅ `effects/shared/auth-api.mappers.ts` - общие мапперы
- ✅ `effects/shared/session-state.builder.ts` - построитель состояния сессии

### 6. Store & Types

- ✅ `stores/auth.ts` - Zustand store
- ✅ `types/auth.ts` - типы состояний
- ✅ `types/auth-risk.ts` - типы для risk assessment
- ✅ `schemas/index.ts` - Zod схемы валидации

### 7. App Layer Integration

- ✅ `@livai/app/lib/auth-hook-deps.ts` - DI фабрика
- ✅ `@livai/app/lib/auth-token-adapter.ts` - адаптер токенов
- ✅ `@livai/app/hooks/useAuth.ts` - React hook
- ✅ `@livai/app/hooks/useAuth-provider.tsx` - React provider
- ✅ `@livai/app/providers/AppProviders.tsx` - интеграция в провайдеры

### 8. Security & Risk Assessment

- ✅ `lib/security-pipeline.ts` - security pipeline с device fingerprint и risk assessment
- ✅ `lib/device-fingerprint.ts` - device fingerprinting
- ✅ `lib/risk-assessment.ts` - risk assessment с classification mapper
- ✅ `lib/classification-mapper.ts` - классификация рисков
- ✅ `lib/error-mapper.ts` - маппинг ошибок

### 9. Session Management (Domain Layer)

- ✅ `lib/session-manager.ts` - SessionManager для policy decisions и proactive refresh
- ✅ `domain/SessionPolicy.ts` - типы для session policies
- ✅ Интеграция в refresh effect через `SessionManagerPort`

### 10. Background Tasks (Proactive Refresh)

- ✅ `@livai/app/src/background/tasks.ts` - периодическая задача `auth-refresh` для proactive refresh
- ✅ `@livai/app/src/background/scheduler.ts` - scheduler для фоновых задач
- ✅ Интеграция с `refreshEffect` из `UseAuthDeps`

## 🔴 Не реализовано (запланировано в auth-next-effects.md)

### Password Reset Flow

- ❌ `effects/forgot-password.ts`
- ❌ `effects/reset-password.ts`

### Contact Verification

- ❌ `effects/verify-email.ts`
- ❌ `effects/verify-phone.ts`

### Multi-Factor Authentication

- ❌ `effects/mfa-challenge.ts`
- ❌ `effects/mfa-setup.ts`
- ❌ `effects/mfa-backup-code.ts`

### OAuth Authentication

- ❌ `effects/oauth-login.ts`
- ❌ `effects/oauth-register.ts`

### Session Management

- ❌ `effects/session-revoke.ts`
- ❌ `effects/logout-all-sessions.ts`

### Profile & Security Updates

- ❌ `effects/change-password.ts`
- ❌ `effects/update-profile.ts`

### Audit & Telemetry

- ⚠️ **Реализовано альтернативно через порты в эффектах:**
  - ✅ `effects/login/login-audit.mapper.ts` + `AuditLoggerPort` в `login-effect.types.ts`
  - ✅ `effects/logout/logout-audit.mapper.ts` + `LogoutAuditLoggerPort`
  - ✅ `effects/register/register-audit.mapper.ts` + `RegisterAuditLoggerPort`
  - ✅ `effects/refresh/refresh-audit.mapper.ts` + `RefreshAuditLoggerPort`
  - ✅ `lib/security-pipeline.ts` с `MandatoryAuditLogger` для критических ошибок
  - ✅ `domain/AuthAuditEvent.ts` - типы для audit событий
  - ❌ `lib/audit-logger.ts` - централизованный logger (не реализован, используется портовый подход)
  - ❌ `lib/audit-logger-adapter.ts` - адаптер для telemetry (не реализован)
  - ⚠️ `lib/auth-telemetry.ts` - частично через метрики в `@livai/app/src/background/tasks.ts`

### Session Policy & Proactive Refresh

- ⚠️ **Реализовано альтернативно:**
  - ✅ `lib/session-manager.ts` - полная реализация SessionManager с policy checks
  - ✅ `effects/refresh/refresh-effect.types.ts` - `SessionManagerPort` для policy decisions
  - ✅ `effects/refresh.ts` - встроенный policy check через `sessionManager.decide()`
  - ✅ `domain/SessionPolicy.ts` - типы для session policies
  - ✅ `@livai/app/src/background/tasks.ts` - proactive refresh как периодическая задача `auth-refresh`
  - ❌ `effects/session-policy-check.ts` - отдельный эффект (не нужен, встроен в refresh)
  - ❌ `effects/proactive-refresh.ts` - отдельный эффект (реализован через background tasks)

### Account Security

- ❌ `effects/account-lock.ts` - не реализовано
- ❌ `effects/account-unblock.ts` - не реализовано

## 📊 Статистика

- **Реализовано**: 4 базовых эффекта (login, logout, register, refresh)
- **Дополнительно реализовано**:
  - Session Manager с policy checks (встроен в refresh)
  - Proactive refresh через background tasks
  - Audit logging через порты в эффектах
  - Security pipeline с risk assessment
- **Запланировано**: ~20 дополнительных эффектов (password reset, MFA, OAuth, etc.)
- **Покрытие тестами**: Unit тесты для всех реализованных эффектов
- **Интеграция**: Полная интеграция в app layer через DI

## ⚠️ Альтернативные реализации

Некоторые компоненты реализованы альтернативно, не как отдельные файлы из плана:

1. **Audit Logging**: Вместо централизованного `lib/audit-logger.ts` используется портовый подход с `*-audit.mapper.ts` в каждом эффекте. Это более гибко и соответствует DI-архитектуре.

2. **Session Policy Check**: Вместо отдельного `effects/session-policy-check.ts` policy checks встроены в refresh effect через `SessionManagerPort.decide()`. Это упрощает архитектуру и избегает дублирования.

3. **Proactive Refresh**: Вместо отдельного `effects/proactive-refresh.ts` реализован через периодическую background task в `@livai/app/src/background/tasks.ts`. Это более подходящее место для периодических задач.

## ✅ Архитектурные принципы (соблюдены)

- ✅ DI через порты: все зависимости через типизированные порты
- ✅ Валидация конфигурации: `validate*Config` на этапе композиции
- ✅ Pure мэпперы: используют shared‑мэпперы, возвращают frozen объекты
- ✅ Store‑only‑updates: все изменения через `*-store-updater.ts` с `batchUpdate`
- ✅ Fail‑closed: частично успешные ответы не применяются
- ✅ Audit logging: best‑effort через `*-audit.mapper.ts` с Zod валидацией
- ✅ Orchestrator pattern: `validate→api→map→store→audit` через `@livai/app` utilities

## 📐 Auth Layer — Guidelines for Future Effects

### 1. Архитектурные границы

**1.1 Effect = Orchestrator, не сервис**

Обязательная цепочка: `validate → api → map → store → audit`

**Запрещено:**

- Бизнес-логика в store
- Прямые вызовы `fetch`
- Прямая telemetry (только через порт)
- Мутации состояния вне store-updater

**1.2 Все зависимости — только через порты**

Новый эффект не может импортировать:

- `ApiClient` напрямую
- Zustand store напрямую
- Telemetry runtime
- Session manager реализацию

Только через `*Port`. Адаптеры создаются в app-layer.

**1.3 Fail-closed обязателен**

Если API вернул частично валидный ответ, маппинг упал или validation не прошла → store не обновляется.

### 2. Стандартизация будущих эффектов

**2.1 Обязательная структура:**

```
effects/<name>.ts
effects/<name>/<name>-effect.types.ts
effects/<name>/<name>-api.mapper.ts
effects/<name>/<name>-store-updater.ts
effects/<name>/<name>-audit.mapper.ts
```

**2.2 Shared мапперы**

Повторяющаяся логика (token mapping, session building, user mapping) выносится в `effects/shared/`. Дублирование запрещено.

**2.3 Store обновляется только через store-updater**

Запрещено: `store.setState(...)`. Только через `*-store-updater.ts`.

### 3. Управление сложностью

**3.1 Общий Effect Template**

При >10 эффектах: ввести `createAuthEffect()` factory для унификации audit wiring и error mapping.

**3.2 Не допускать "God Effect"**

Если эффект содержит >1 API вызова, сложную branch логику или state machine → выносить domain-логику в отдельный компонент (как `SessionManager`).

### 4. Session Management Scaling Rules

**4.1 SessionManager — только policy logic**

Можно: refresh decisions, expiration logic, step-up requirements.

Нельзя: network calls, telemetry, store mutations.

**4.2 Proactive refresh остаётся вне эффектов**

Периодические задачи только через background scheduler, не через hook lifecycle.

### 5. Audit & Compliance

**5.1 Все эффекты обязаны эмитить audit event** (даже если best-effort).

**5.2 В перспективе ввести CentralAuditAdapter**

При появлении MFA, OAuth, multi-session revoke, compliance требований → audit должен централизоваться в одном адаптере.

### 6. MFA / OAuth / Password Reset правила

**6.1 State Machine эффекты**

MFA и OAuth: не должны раздувать один эффект. Каждый шаг = отдельный эффект, orchestration step-level.

**6.2 Multi-step flow нельзя хранить в store напрямую**

Использовать: transient state, effect-local state или dedicated flow manager.

### 7. React Layer ограничения

**7.1 useAuth остаётся thin facade**

Hook не содержит бизнес-логики, redirect-логики, derived security logic. Только проксирует эффекты.

### 8. Тестирование

**8.1 Каждый эффект — unit test**

Тестируются: happy path, API error, validation error, store mutation, audit emission.

**8.2 Domain-компоненты тестируются отдельно**

`SessionManager`, risk assessment, classification — изолированно.

### 9. Масштабирование (Enterprise readiness)

При добавлении multi-tenant, device binding, geo restrictions, risk thresholds:

**Правило:** Domain logic растёт отдельно от эффектов. Эффект не становится policy engine.

### 10. Запреты (Hard Constraints)

**Нельзя:**

- Добавлять логику refresh в login
- Вызывать refresh из ApiClient
- Делать silent retry auth внутри transport
- Мутировать auth store из background напрямую
- Связывать security pipeline с React

### 🎯 Главный принцип

Auth слой должен оставаться:

- Детерминированным
- Порт-ориентированным
- Policy-driven
- Fail-closed
- Расширяемым без переписывания

**Если новый эффект требует изменения существующего — архитектура нарушена.**
