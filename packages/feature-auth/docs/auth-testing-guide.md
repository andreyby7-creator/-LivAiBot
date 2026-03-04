# Руководство по тестированию Auth слоя

## 🎯 Подход к тестированию

**Принцип:** Auth слой тестируется через поведение (state transitions), а не через внутренние реализации.

**Правило:** Тесты не должны знать структуру internal effect pipeline.

### Контракт эффекта

Каждый эффект должен:

- Возвращать типизированный `Result` (success/error)
- Обновлять store только через `batchUpdate`
- Не бросать исключения наружу (ошибки мапятся в `Result`)

Это важно для будущего масштабирования и рефакторинга.

## 📊 Уровни тестирования

### Уровень 1 — Unit (уже есть)

**Тестируем:**

- Чистые эффекты изолированно
- Мапперы (api, audit, store-updater)
- Concurrency стратегию изолированно

**Где:** `tests/unit/effects/`

### Уровень 2 — Integration (основной) ⭐

**Тестируем:**

- `createAuthHookDeps` wiring
- Эффект → store state transitions
- Success/error flows
- Side effects (audit logging)
- Инварианты store

**Где:** `tests/integration/`

**Принцип изоляции feature:**

- Integration тесты не импортируют код из app-пакета
- Тестируется только `feature-auth` + его публичный API
- Иначе через год появится coupling с app-слоем

**Структура:**

```
tests/integration/
  login-flow.test.ts
  register-flow.test.ts
  refresh-flow.test.ts
  logout-flow.test.ts
  store-invariants.test.ts
  concurrency/
    login-concurrency.test.ts
    refresh-concurrency.test.ts
  test-helpers.ts  # Фабрика testDepsBuilder
```

### Уровень 3 — E2E (в будущем)

**Тестируем через Playwright:**

- Login через UI
- Logout
- Auto refresh
- Session expire

**Примечание:** E2E тесты не обязательны сейчас, но должны покрывать весь user journey при внедрении MFA, OAuth или multi-session.

---

## 🏗️ Структура Integration тестов

### Фабрика testDepsBuilder

**Создать:** `tests/integration/test-helpers.ts`

**Рекомендации:**

- Вынести общую конфигурацию в `createTestDepsBuilder()`
- Переиспользовать в каждом тесте
- Мокировать только внешние зависимости (API, security pipeline, session manager)
- Использовать реальный store из `createAuthStore()`

**Что мокировать:**

- `apiClient` (post, get)
- `securityPipeline` (assess)
- `errorMapper` (map)
- `auditLogger` (logAuditEvent, logLogoutEvent, etc.)
- `clock` (now) — с возможностью управления временем для concurrency тестов
- `sessionManager` (decide)

**Что НЕ мокировать:**

- Store (использовать реальный)
- Effect runtime (использовать стандартный)

### Структура теста flow

**Для каждого эффекта (login/register/refresh/logout):**

1. **Setup:** Создать `testDepsBuilder`, настроить моки
2. **Execute:** Вызвать эффект через `createAuthHookDeps`
3. **Assert:**
   - Результат эффекта (success/error)
   - State transition в store
   - Факт вызова audit logger

**Пример структуры:**

- `it('должен успешно выполнить и обновить store')`
- `it('должен обработать ошибку и не обновить store')`

### Concurrency тесты (отдельно)

**Создать:** `tests/integration/concurrency/`

**Рекомендации:**

- Тестировать каждую стратегию отдельно
- Запускать параллельные промисы
- Использовать deferred для управления завершением промисов в `serialize`/`cancel_previous` стратегиях
- Проверять финальное состояние store

**Стратегии:**

- `cancel_previous` — предыдущий запрос отменяется
- `serialize` — запросы выполняются последовательно
- `ignore` — новые запросы игнорируются во время выполнения

---

## ✅ Что тестировать

### State Transitions

- `unauthenticated` → `authenticated` (login/register)
- `authenticated` → `unauthenticated` (logout)
- `authenticated` → `authenticated` (refresh с обновлением токенов)

### Error Handling

- API ошибки не обновляют store
- Validation ошибки не обновляют store
- Все ошибки проходят через errorMapper
- **Refresh с invalid/expired token:** корректно переводит state → `unauthenticated`

### Side Effects

- Audit logging вызывается (только факт вызова)
- Store обновляется атомарно

### Concurrency

- Стратегии работают корректно
- Финальное состояние консистентно

### Инварианты Store

**Обязательные проверки:**

- В состоянии `authenticated` всегда есть `user`
- В `unauthenticated` нет `session`
- Нельзя иметь `session.status = active`, если `auth.status != authenticated`

**Где тестировать:** `tests/integration/store-invariants.test.ts`

**Почему важно:** Защита от регрессий при будущих расширениях (MFA, roles, multi-session и т.д.)

---

## 🚫 Что НЕ тестировать

### ❌ Private функции

- Не тестировать внутренние helper функции эффектов
- Не тестировать implementation details

### ❌ Store моки целиком

- Использовать реальный store из `createAuthStore()`
- Мокировать только внешние зависимости (API, security pipeline)

### ❌ Effect implementation details

- Не проверять структуру Effect pipeline
- Не тестировать Runtime internals

### ❌ Audit payload подробно

- Только факт вызова: `expect(mockAuditLogger.logAuditEvent).toHaveBeenCalled()`
- Не проверять каждое поле audit event

### ❌ Не превращать integration в псевдо-e2e

- Не тестировать UI логику
- Не тестировать redirect логику
- Фокус на state transitions и side effects

---

## 🚀 Запуск тестов

```bash
# Все integration тесты
cd packages/feature-auth
pnpm test tests/integration/

# Конкретный flow
pnpm test tests/integration/login-flow.test.ts

# Concurrency тесты
pnpm test tests/integration/concurrency/

# С watch mode
pnpm test:watch tests/integration/

# С coverage
pnpm test:coverage tests/integration/
```

---

## 📋 Чеклист

### Базовая функциональность

- [ ] Login успешно создает сессию
- [ ] Login обрабатывает ошибки
- [ ] Register успешно создает аккаунт
- [ ] Refresh обновляет токены
- [ ] Refresh с invalid/expired token переводит в `unauthenticated`
- [ ] Logout очищает сессию

### State Transitions

- [ ] Store обновляется после успешных операций
- [ ] Store не обновляется при ошибках
- [ ] State transitions атомарны

### Concurrency

- [ ] `cancel_previous` отменяет предыдущие запросы
- [ ] `serialize` выполняет последовательно
- [ ] `ignore` игнорирует новые запросы

### Audit

- [ ] Audit вызывается для успешных операций
- [ ] Audit вызывается для ошибок
- [ ] Ошибки audit не ломают flow

### Инварианты Store

- [ ] В `authenticated` всегда есть `user`
- [ ] В `unauthenticated` нет `session`
- [ ] Нельзя иметь `session.status = active` при `auth.status != authenticated`
