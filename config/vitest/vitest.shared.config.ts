/**
 * @file Конфигурация переменных окружения для Vitest
 * Управляет переменными окружения для тестового окружения LivAI.
 * Детерминированные значения по умолчанию, валидация, защита от опечаток.
 */

type EnvRecord = Record<TestEnvKeys, string>;
type EnvOverrides = Partial<Record<TestEnvKeys, string>>;

// ------------------ ENUM -----------------------------

/** Ключи переменных окружения для тестов */
export enum TestEnvKeys {
  NODE_ENV = 'NODE_ENV',
  DATABASE_URL = 'DATABASE_URL',
  REDIS_URL = 'REDIS_URL',
  JWT_SECRET = 'JWT_SECRET',
  OPENAI_API_KEY = 'OPENAI_API_KEY',
  ANTHROPIC_API_KEY = 'ANTHROPIC_API_KEY',
  GOOGLE_AI_API_KEY = 'GOOGLE_AI_API_KEY',
  GROK_API_KEY = 'GROK_API_KEY',
  DEEPSEEK_API_KEY = 'DEEPSEEK_API_KEY',
  QWEN_API_KEY = 'QWEN_API_KEY',
  YANDEX_API_KEY = 'YANDEX_API_KEY',
  GIGACHAT_API_KEY = 'GIGACHAT_API_KEY',
  LLAMA_API_KEY = 'LLAMA_API_KEY',
  SENTRY_DSN = 'SENTRY_DSN',
  POSTHOG_API_KEY = 'POSTHOG_API_KEY',
  API_BASE_URL = 'API_BASE_URL',
  WEB_BASE_URL = 'WEB_BASE_URL',
}

// ------------------ КОНСТАНТЫ -----------------------------

/**
 * Обязательные переменные окружения для запуска тестов.
 * АРХИТЕКТУРНОЕ РЕШЕНИЕ: СТРОГАЯ ИЗОЛЯЦИЯ
 * ========================================
 * Только JWT_SECRET обязателен для всех типов тестов.
 * Все внешние API (OpenAI, Anthropic, etc.) должны мокаются в юнит-тестах.
 * Почему только JWT_SECRET?
 * - Нужен для внутренних операций аутентификации/авторизации
 * - Другие API ключи имеют дефолтные тестовые значения для моков
 * - Обеспечивает быстрый, предсказуемый CI/CD без внешних зависимостей
 * Для интеграционных AI тестов → отдельный сьют (pnpm test:ai)
 * Для E2E тестов → отдельный сьют с реальными ключами
 */
const REQUIRED_TEST_ENV_KEYS: readonly TestEnvKeys[] = [
  TestEnvKeys.JWT_SECRET, // Только внутренние секреты, уникальные для каждого запуска
];

// ------------------ ДЕФОЛТНЫЕ ЗНАЧЕНИЯ ОКРУЖЕНИЯ -----------------------------

/**
 * Кэшированные дефолтные значения переменных окружения для тестов.
 * Создаются один раз при импорте модуля для оптимизации производительности.
 * ВСЕ ВНЕШНИЕ API КЛЮЧИ ИМЕЮТ ТЕСТОВЫЕ ЗАГЛУШКИ ДЛЯ МОКОВ:
 * ============================================================
 * - OpenAI, Anthropic, Google AI ключи → используются только в моках
 * - Sentry, PostHog ключи → тестовые заглушки для предотвращения реальных вызовов
 * - Database/Redis URL → тестовые значения для локального тестирования
 * Это обеспечивает:
 * ✅ Полную изоляцию тестов от внешних зависимостей
 * ✅ Быстрый CI/CD без сетевых задержек
 * ✅ 100% контроль над тестовыми сценариями (успех/ошибки/таймауты)
 * ✅ Экономию API лимитов и бюджета
 */
const DEFAULT_TEST_ENV: Readonly<EnvRecord> = Object.freeze({
  // Всегда test окружение для Vitest
  [TestEnvKeys.NODE_ENV]: 'test',

  // Тестовые сервисы с детерминированными значениями (можно переопределить)
  [TestEnvKeys.DATABASE_URL]: 'postgres://test:test@localhost:5432/livai_test',
  [TestEnvKeys.REDIS_URL]: 'redis://localhost:6379',

  // Секреты (всегда тестовые значения, детерминированные)
  [TestEnvKeys.JWT_SECRET]: 'test-jwt-secret-key-for-testing-only',

  // ВНЕШНИЕ API КЛЮЧИ → ТОЛЬКО ДЛЯ МОКОВ (не используются реально)
  [TestEnvKeys.OPENAI_API_KEY]: 'test-openai-key',
  [TestEnvKeys.ANTHROPIC_API_KEY]: 'test-anthropic-key',
  [TestEnvKeys.GOOGLE_AI_API_KEY]: 'test-google-ai-key',
  [TestEnvKeys.GROK_API_KEY]: 'test-grok-key',
  [TestEnvKeys.DEEPSEEK_API_KEY]: 'test-deepseek-key',
  [TestEnvKeys.QWEN_API_KEY]: 'test-qwen-key',
  [TestEnvKeys.YANDEX_API_KEY]: 'test-yandex-key',
  [TestEnvKeys.GIGACHAT_API_KEY]: 'test-gigachat-key',
  [TestEnvKeys.LLAMA_API_KEY]: 'test-llama-key',
  [TestEnvKeys.SENTRY_DSN]: 'test-sentry-dsn',
  [TestEnvKeys.POSTHOG_API_KEY]: 'test-posthog-key',

  // URLs для тестового окружения (детерминированные)
  [TestEnvKeys.API_BASE_URL]: 'http://localhost:3001',
  [TestEnvKeys.WEB_BASE_URL]: 'http://localhost:3000',
});

/**
 * Возвращает кэшированные дефолтные значения переменных окружения для тестов.
 * Использует предварительно вычисленный и замороженный объект для оптимизации.
 * @returns EnvRecord - Дефолтные значения переменных окружения для тестов
 */
function getDefaultTestEnv(): Readonly<EnvRecord> {
  return DEFAULT_TEST_ENV;
}

// ------------------ ВАЛИДАЦИЯ URL -----------------------------

/**
 * Валидирует URL по заданному паттерну.
 * @param url - URL для валидации
 * @param key - Название переменной окружения для сообщения об ошибке
 * @param pattern - Регулярное выражение для проверки
 * @param expectedFormat - Описание ожидаемого формата для сообщения об ошибке
 * @param exampleUrl - Пример правильного URL для подсказки
 * @throws Error если URL не соответствует паттерну
 */
function validateUrl(
  url: string,
  key: TestEnvKeys | string,
  pattern: RegExp,
  expectedFormat: string,
  exampleUrl: string,
): void {
  if (url && !pattern.test(url)) {
    throw new Error(
      `${key} должен быть корректным URL (${expectedFormat}).\n`
        + `Пример: ${exampleUrl}\n`
        + `Получено: ${url}`,
    );
  }
}

/**
 * Дополнительная валидация для API и WEB URL с часто встречающимися ошибками.
 * Проверяет наличие пробелов, специальных символов и корректность портов для localhost.
 * URL с конечным слешем считаются допустимыми (например, http://localhost:3000/).
 * @param url - URL для валидации
 * @param key - Название переменной окружения
 */
function validateApiWebUrl(url: string, key: string): void {
  if (!url) return;

  // Проверить на пробелы и специальные символы, которые часто вызывают проблемы
  if (/[\s<>'"\[\]{}|\\^`]/.test(url)) {
    throw new Error(
      `${key} содержит недопустимые символы (пробелы, < > ' " [ ] { } | \\ ^ \`). Эти символы могут ломать URL.\n`
        + `Пример: http://localhost:3000\n`
        + `Получено: "${url}"`,
    );
  }

  // Для localhost URL проверить порт
  if (url.includes('localhost')) {
    const portMatch = url.match(/:(\d+)/);
    if (portMatch && portMatch[1]) {
      const port = parseInt(portMatch[1], 10);
      if (port < 1 || port > 65535) {
        throw new Error(
          `${key} содержит недопустимый порт ${port}. Порт должен быть от 1 до 65535.\n`
            + `Пример: http://localhost:3000\n`
            + `Получено: "${url}"`,
        );
      }
    }
  }

  // URL с конечным слешем вполне допустимы (например, http://localhost:3000/)
  // Не требуем строгой нормализации, чтобы не ломать существующие конфигурации
}

// ------------------ ВАЛИДАЦИЯ ОКРУЖЕНИЯ -----------------------------

/**
 * Валидирует переменные окружения для тестов.
 * Проверяет наличие и непустоту обязательных секретных ключей, а также корректность типов.
 * @param env - Объект с переменными окружения
 * @throws Error если отсутствуют обязательные переменные, они пустые или некорректные значения
 */
function validateTestEnv(env: EnvRecord): void {
  const missingKeys = REQUIRED_TEST_ENV_KEYS.filter((key) => {
    const val = String(env[key] ?? '');
    return !val || val.trim() === '';
  });

  if (missingKeys.length > 0) {
    throw new Error(
      `Отсутствуют обязательные переменные окружения для тестов: ${missingKeys.join(', ')}\n`
        + 'Укажите эти переменные в overrides или установите их в окружении.\n'
        + 'Пустые строки не допускаются для обязательных переменных.',
    );
  }

  // Дополнительная проверка типов для критически важных переменных
  validateUrl(
    String(env[TestEnvKeys.DATABASE_URL] ?? ''),
    'DATABASE_URL',
    /^postgres(?:ql)?:\/\/.+/,
    'начинается с postgres:// или postgresql://',
    'postgres://user:password@localhost:5432/database_name',
  );

  validateUrl(
    String(env[TestEnvKeys.REDIS_URL] ?? ''),
    'REDIS_URL',
    /^redis:\/\/.+/,
    'начинается с redis://',
    'redis://localhost:6379',
  );

  const apiUrl = String(env[TestEnvKeys.API_BASE_URL] ?? '');
  validateUrl(
    apiUrl,
    'API_BASE_URL',
    /^https?:\/\/.+/,
    'начинается с http:// или https://',
    'http://localhost:3001',
  );
  validateApiWebUrl(apiUrl, 'API_BASE_URL');

  const webUrl = String(env[TestEnvKeys.WEB_BASE_URL] ?? '');
  validateUrl(
    webUrl,
    'WEB_BASE_URL',
    /^https?:\/\/.+/,
    'начинается с http:// или https://',
    'http://localhost:3000',
  );
  validateApiWebUrl(webUrl, 'WEB_BASE_URL');
}

// ------------------ ПУБЛИЧНЫЙ API -----------------------------

/**
 * Создает переменные окружения для Vitest с значениями по умолчанию и переопределениями.
 * Выполняет валидацию обязательных переменных перед возвратом.
 * @param overrides - Частичные переменные окружения для переопределения значений по умолчанию
 * @returns EnvRecord - Финальные переменные окружения для тестов
 */
export function buildVitestEnv(overrides: EnvOverrides = {}): Readonly<EnvRecord> {
  // Проверяем на опечатки в названиях ключей
  const allowedKeys = Object.values(TestEnvKeys).sort();
  const unknownKeys = Object.keys(overrides).filter(
    (key) => !allowedKeys.includes(key as TestEnvKeys),
  );

  if (unknownKeys.length > 0) {
    throw new Error(
      `Неизвестные ключи в overrides (возможные опечатки): ${unknownKeys.join(', ')}\n`
        + `Доступные ключи: ${allowedKeys.join(', ')}`,
    );
  }

  // Фильтруем переопределения, оставляя только определенные значения
  const filteredOverrides: Partial<EnvRecord> = Object.fromEntries(
    Object.entries(overrides).filter(([_, value]) => value !== undefined),
  );

  // Создаем окружение с дефолтными значениями и переопределениями
  const env: EnvRecord = {
    ...getDefaultTestEnv(),
    ...filteredOverrides,
  };

  // Логируем статистику создания окружения
  const totalKeys = Object.keys(env).length;
  const overriddenKeys = Object.keys(filteredOverrides).length;
  const defaultKeys = totalKeys - overriddenKeys;

  if (process.env['VITEST_ENV_DEBUG'] === 'true') {
    console.log(
      `🔧 Building test environment: ${totalKeys} keys (${defaultKeys} defaults, ${overriddenKeys} overrides)`,
    );
  }

  // Валидируем обязательные ключи
  validateTestEnv(env);

  if (process.env['VITEST_ENV_DEBUG'] === 'true') {
    console.log(`✅ Test environment validated successfully`);
  }

  // Замораживаем объект для предотвращения мутаций
  return Object.freeze(env);
}
