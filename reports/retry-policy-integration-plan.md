### Интеграция core `RetryPolicy` в feature-пакеты (feature-auth, feature-bots, future features)

**Цель:** централизовать retry-политику на базе `@livai/core/resilience/retry-policy` и убрать дубли/`undefined` по всему монорепо.

---

### 1. Базовая инфраструктура (core) — уже сделано

- **Файлы:** `core/src/resilience/retry-policy.ts`, `core/src/resilience/index.ts`, `core/tests/resilience/retry-policy.test.ts`, `docs/phase2-UI-platform.md`.
- **Статус:** готово.
- **Результат:** есть типы/хелперы `RetryPolicy<T>`, `createRetryPolicy`, `mergeRetryPolicies`, `getRetryable` и документация по controlled-union ключам.

---

### 2. Feature-auth: централизованная retry-политика

- **2.1. Ввести доменные типы ключей политики**
  - **Файлы:** `feature-auth/src/domain/AuthErrorResponse.ts`, `feature-auth/src/domain/OAuthErrorResponse.ts`.
  - **Шаги:**
    - Убедиться, что `AuthErrorType` и `OAuthErrorType` — исчерпывающие union-типы (строки, без "произвольного" string).
    - Если есть implicit-коды (например, в мапперах), поднять их в единый union.

- **2.2. Задать default-политику для Auth**
  - **Файл:** `feature-auth/src/domain/auth-retry-policy.ts` (новый).
  - **Шаги:**
    - Импортировать `RetryPolicy`, `createRetryPolicy`, `getRetryable` из `@livai/core/resilience`.
    - Определить `type AuthRetryKey = AuthErrorType;`.
    - Создать `const AuthRetryPolicy = createRetryPolicy<AuthRetryKey>({ ... } as const satisfies RetryPolicy<AuthRetryKey>);`.
    - Экспортировать `getAuthRetryable(error: AuthRetryKey): boolean` как thin-wrapper над `getRetryable(AuthRetryPolicy, error)`.

- **2.3. Задать default-политику для OAuth**
  - **Файл:** `feature-auth/src/domain/oauth-retry-policy.ts` (новый).
  - **Шаги:**
    - Аналогично п.2.2: `type OAuthRetryKey = OAuthErrorType;`.
    - `const OAuthRetryPolicy = createRetryPolicy<OAuthRetryKey>({ ... } as const satisfies RetryPolicy<OAuthRetryKey>);`.
    - Экспортировать `getOAuthRetryable(error: OAuthRetryKey): boolean`.

- **2.4. Интегрировать политику в error-mapper**
  - **Файл:** `feature-auth/src/lib/error-mapper.ts` (и/или аналоги в `src/effects`).
  - **Шаги:**
    - Найти все места, где `retryable` задаётся вручную (true/false) или вычисляется через локальные таблицы.
    - Заменить на вызовы `getAuthRetryable` / `getOAuthRetryable`, оставив только явные overrides там, где есть осознанные исключения.
    - Убедиться, что нет `retryable: undefined` и что fallback-кейсы (`unknown_error`, transport ошибки) явно документированы.

- **2.5. Обновить эффекты и fallback-обработчики**
  - **Файлы:** `feature-auth/src/effects/*.ts` (регистрация, логин, refresh и др.).
  - **Шаги:**
    - Пройти все code-path’ы, где строится `AuthErrorResponse` / `OAuthErrorResponse`.
    - Заменить прямые литералы `retryable: ...` на:
      - вызовы `getAuthRetryable` / `getOAuthRetryable` для доменных ошибок;
      - явные `retryable: false`/`true` только для специальных infrastructural-кейсов (например, чистый network timeout, отмена пользователем).

- **2.6. Обновить тесты**
  - **Файлы:** `feature-auth/tests/unit/domain/AuthErrorResponse.test.ts`, `feature-auth/tests/unit/domain/OAuthDTOs.test.ts`, `feature-auth/tests/unit/lib/error-mapper.test.ts`, связанные snapshots.
  - **Шаги:**
    - DTO-фабрики (`createAuthErrorResponse`, `createOAuthErrorResponse`) брать `retryable` по умолчанию из `getAuthRetryable` / `getOAuthRetryable`.
    - Оставить явные override-тесты для кейсов, где политика намеренно переопределяется.
    - Проверить все legacy DTO‑фабрики и тестовые snapshots на прямые литералы `retryable` и заменить их на значения из централизованной политики, где это не осознанный override.
    - Добавить smoke‑тест(ы), проходящие по всем значениям `AuthErrorType` / `OAuthErrorType` и проверяющие, что каждый ключ присутствует в соответствующей policy (`AuthRetryPolicy` / `OAuthRetryPolicy`) — exhaustiveness guard.

---

### 3. Feature-bots: централизованная retry-политика

- **3.1. Ввести доменный тип ключей политики**
  - **Файл:** `feature-bots/src/types/bots.ts`.
  - **Шаги:**
    - Выделить union `BotErrorCode` (если ещё не выделен) как canonical набор кодов ботовых ошибок.

- **3.2. Задать `BotRetryPolicy`**
  - **Файл:** `feature-bots/src/domain/bot-retry-policy.ts` (или `src/types/bot-retry-policy.ts` — в зависимости от текущей архитектуры домена).
  - **Шаги:**
    - Импортировать core-примитивы: `RetryPolicy`, `createRetryPolicy`, `getRetryable`.
    - Определить `type BotRetryKey = BotErrorCode;`.
    - Создать `const BotRetryPolicy = createRetryPolicy<BotRetryKey>({ ... } as const satisfies RetryPolicy<BotRetryKey>);`.
    - Экспортировать `getBotRetryable(error: BotRetryKey): boolean`.

- **3.3. Использовать политику в error-mapping registry**
  - **Файл:** `feature-bots/src/types/bots.ts` (секция `BotErrorMappingRegistry`).
  - **Шаги:**
    - Убрать прямые `retryable` из конфигурации, там где они совпадают с политикой.
    - Либо, если registry должен хранить `retryable` явно, генерировать/валидировать его на основе `BotRetryPolicy` (одна точка правды).

- **3.4. Интегрировать политику в эффекты/handlers**
  - **Файлы:** `feature-bots/src/effects/**/*.ts`, обработчики событий/команд, где собирается `BotError`.
  - **Шаги:**
    - Заменить ручные установки `retryable` на `getBotRetryable(code)`, с явными overrides только для transport/infrastructure кейсов.

- **3.5. Обновить тесты**
  - **Файл:** `feature-bots/tests/unit/types/bots.test.ts` и другие тесты ботов.
  - **Шаги:**
    - DTO-фабрики для `BotError` и error-mapping использовать `getBotRetryable` как default-источник.
    - Оставить отдельные тесты, которые проверяют корректность `BotRetryPolicy` и соответствие registry ↔ policy.

---

### 4. Общий cleanup и защита инвариантов

- **4.1. Удалить/заменить локальные RetryPolicy-структуры**
  - **Файлы:** все, где ранее были `Default*RetryPolicy` или ad-hoc `Record<ErrorCode, boolean>`.
  - **Шаги:**
    - Перевести их на `createRetryPolicy` из core.
    - Вынести в dedicated-модули `*retry-policy.ts`, чтобы избежать размазанной логики по коду.

- **4.2. Проход по всем `retryable`**
  - **Файлы:** `packages/**` (поиск `retryable`).
  - **Шаги:**
    - Проверить, что:
      - нет `retryable?:` (contract-asymmetry уже должен это ловить);
      - нет дублирующихся "магических" значений, которые должны читаться из централизованной политики.

- **4.3. Обновить документацию**
  - **Файлы:** `docs/phase2-UI-platform.md`, при необходимости — docs по auth/bots.
  - **Шаги:**
    - Добавить упоминание `AuthRetryPolicy`/`OAuthRetryPolicy`/`BotRetryPolicy` как thin-wrapper’ов над core `RetryPolicy<T>`.
    - Обновить пункты с описаниями модулей auth/bots, чтобы в зависимостях явно фигурировал `core/resilience/retry-policy.ts` вместо локальных `Default*RetryPolicy`.
    - Кратко описать, что все feature-пакеты обязаны использовать core-примитив, а не свои структуры.

- **4.4. Верификация инвариантов**
  - **Файлы/команды:** `scripts/check-contract-asymmetry.mjs`, `pnpm run lint:canary`, `pnpm run test`, `pnpm run check:contract-asymmetry`, `pnpm run test --filter retry-policy`.
  - **Шаги:**
    - Убедиться, что:
      - нет новых срабатываний `check-contract-asymmetry` по `retryable`;
      - все тесты auth/bots проходят с учётом новой централизованной политики, включая smoke‑тесты exhaustiveness для ErrorType ↔ policy.
