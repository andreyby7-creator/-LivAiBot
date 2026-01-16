/**
 * @file Глобальная настройка для всех тестов LivAI
 *
 * Архитектура с разделением ответственности:
 * - beforeAll/afterAll: глобальная инициализация сервисов с таймаутами и ретраями
 * - beforeEach/afterEach: подготовка отдельных тестов с асинхронным reset
 * - Вспомогательные функции: модульные операции с типизированным состоянием
 *
 * Масштабируемость: новые сервисы добавляются через registerService().
 * Безопасность: try/catch везде, логирование без прерывания тестов.
 * Конфигурация: ENV флаги вынесены в константы для легкого расширения.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

// Импорт и настройка matchers для @testing-library
import '@testing-library/jest-dom/vitest';

// Расширение глобального типа для тестового состояния
declare global {
  var testState: GlobalTestState | undefined;
  var __testTimers: NodeJS.Timeout[] | undefined;
  // vi уже объявлен в vitest globals
  var jest: unknown;
}

// ------------------ ТИПЫ И ИНТЕРФЕЙСЫ -----------------------------

/** Глобальное состояние тестов для типизации */
interface GlobalTestState {
  mocks?: Record<string, unknown>;
  counters?: Record<string, number>;
  timestamps?: Record<string, number>;
  cache?: Map<string, unknown>;
}

/** Сервис для тестирования с таймаутами и ретраями */
interface TestService {
  name: string;
  init?: () => Promise<void> | void;
  cleanup?: () => Promise<void> | void;
  reset?: () => Promise<void> | void;
  timeout?: number; // таймаут инициализации в мс
  retries?: number; // количество повторных попыток
}

/** Конфигурация тестового окружения */
interface TestConfig {
  debug: boolean;
  clearRequireCache: boolean;
  clearTempFiles: boolean;
  clearTestEnv: boolean;
  services: TestService[];
}

// ------------------ КОНСТАНТЫ И КОНФИГУРАЦИЯ -----------------------------

/** Оригинальные process listeners для восстановления после тестов */
const originalProcessListeners: Map<
  NodeJS.Signals | string,
  Array<(...args: readonly unknown[]) => void>
> = new Map();

/**
 * Сохранение оригинальных process listeners
 * @returns void
 */
function saveOriginalProcessListeners(): void {
  const eventsToSave: (NodeJS.Signals | string)[] = [
    'unhandledRejection',
    'uncaughtException',
    'warning',
  ];

  eventsToSave.forEach((event) => {
    const listeners = process.listeners(event as NodeJS.Signals);
    if (listeners.length > 0) {
      originalProcessListeners.set(
        event,
        [...listeners] as Array<(...args: readonly unknown[]) => void>,
      );
    }
  });

  logDebug('💾 Saved original process listeners');
}

/**
 * Восстановление оригинальных process listeners
 * @returns void
 */
function restoreOriginalProcessListeners(): void {
  originalProcessListeners.forEach((listeners, event) => {
    // Сначала удаляем все текущие listeners
    process.removeAllListeners(event as NodeJS.Signals);
    // Затем восстанавливаем оригинальные
    listeners.forEach((listener) => {
      process.on(event as NodeJS.Signals, listener);
    });
  });

  originalProcessListeners.clear();
  logDebug('🔄 Restored original process listeners');
}

/** ENV флаги для управления поведением тестов */
const TEST_ENV_FLAGS = {
  DEBUG: 'VITEST_ENV_DEBUG',
  CLEAR_CACHE: 'CLEAR_REQUIRE_CACHE',
  CLEAR_TEMP: 'CLEAR_TEMP_FILES',
  CLEAR_ENV: 'CLEAR_TEST_ENV',
} as const;

/** Ключи переменных окружения для очистки */
const TEST_ENV_KEYS = ['TEST_', 'VITEST_', '_TEST_'] as const;

/** Таймауты по умолчанию для сервисов */
const SERVICE_TIMEOUTS = {
  DEFAULT_INIT: 10000, // 10 сек
  DEFAULT_CLEANUP: 5000, // 5 сек
  DEFAULT_RESET: 1000, // 1 сек
} as const;

/** Директории для очистки */
const TEMP_DIRS = [join(tmpdir(), 'livai-test'), join(process.cwd(), 'tmp', 'test')] as const;

/** Глобальная конфигурация тестового окружения */
const TEST_CONFIG: TestConfig = {
  debug: process.env[TEST_ENV_FLAGS.DEBUG] === 'true',
  clearRequireCache: process.env[TEST_ENV_FLAGS.CLEAR_CACHE] === 'true',
  clearTempFiles: process.env[TEST_ENV_FLAGS.CLEAR_TEMP] === 'true',
  clearTestEnv: process.env[TEST_ENV_FLAGS.CLEAR_ENV] === 'true',
  services: [
    // Примеры сервисов с таймаутами и ретраями
    // {
    //   name: 'database',
    //   init: () => initTestDB(),
    //   cleanup: () => cleanupTestDB(),
    //   reset: () => resetTestDB(),
    //   timeout: 15000,
    //   retries: 3
    // }
  ],
};

// ------------------ ГЛОБАЛЬНЫЕ HOOKS - РАЗДЕЛЕНИЕ ОТВЕТСТВЕННОСТИ -----------------------------

/**
 * Выполнение операции с таймаутом и повторными попытками
 * @param operation - Асинхронная или синхронная операция для выполнения
 * @param name - Название операции для логирования
 * @param timeoutMs - Таймаут в миллисекундах для каждой попытки
 * @param retries - Количество повторных попыток (0 = без ретраев)
 * @returns Promise<T> - Результат выполнения операции
 * @throws Ошибка после исчерпания всех попыток или при превышении таймаута
 */
async function withTimeoutAndRetries<T>(
  operation: () => Promise<T> | T,
  name: string,
  timeoutMs: number,
  retries: number,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Promise.race([
        Promise.resolve(operation()),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            reject(new Error(`Timeout after ${timeoutMs}ms`));
          }, timeoutMs)
        ),
      ]);
      if (attempt > 0) logDebug(`✅ ${name} succeeded on attempt ${attempt + 1}`);
      return result;
    } catch (error) {
      const isLastAttempt = attempt === retries;
      if (isLastAttempt) throw error;
      logDebug(`⚠️  ${name} failed (attempt ${attempt + 1}/${retries + 1}), retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1))); // экспоненциальная задержка
    }
  }
  throw new Error(`All ${retries + 1} attempts failed for ${name}`);
}

/**
 * Глобальная инициализация тестового окружения
 * Выполняется один раз перед запуском всех тестов.
 * Отвечает за запуск долгоживущих сервисов (БД, Redis, etc.) с таймаутами и повторными попытками.
 * @returns Promise<void>
 */
beforeAll(async () => {
  logDebug('🚀 Initializing LivAI test environment');

  try {
    // Сохранение оригинальных process listeners
    saveOriginalProcessListeners();

    // Инициализация всех зарегистрированных сервисов с таймаутами и ретраями
    for (const service of TEST_CONFIG.services) {
      if (service.init) {
        const timeout = service.timeout ?? SERVICE_TIMEOUTS.DEFAULT_INIT;
        const retries = service.retries ?? 0;

        logDebug(
          `📦 Initializing ${service.name} service (timeout: ${timeout}ms, retries: ${retries})`,
        );
        await withTimeoutAndRetries(service.init, `${service.name} init`, timeout, retries);
      }
    }

    // Финальная очистка окружения
    cleanupTestEnvironment();
  } catch (error) {
    logError('Failed to initialize test environment', error);
    throw error; // Критично - прерываем тесты
  }
});

/**
 * Глобальная финализация тестового окружения
 * Выполняется один раз после завершения всех тестов.
 * Отвечает за корректное завершение работы сервисов и восстановление оригинального состояния системы.
 * @returns Promise<void>
 */
afterAll(async () => {
  logDebug('🧹 Cleaning up test environment');

  try {
    // Очистка всех зарегистрированных сервисов (в обратном порядке) с таймаутами
    for (const service of TEST_CONFIG.services.slice().reverse()) {
      if (service.cleanup) {
        const timeout = service.timeout ?? SERVICE_TIMEOUTS.DEFAULT_CLEANUP;
        logDebug(`🗑️  Cleaning up ${service.name} service (timeout: ${timeout}ms)`);
        await withTimeoutAndRetries(
          service.cleanup,
          `${service.name} cleanup`,
          timeout,
          0, // cleanup без ретраев
        );
      }
    }

    // Финальная очистка
    cleanupTestEnvironment();

    // Восстановление оригинальных process listeners
    restoreOriginalProcessListeners();
  } catch (error) {
    logError('Failed to cleanup test environment', error);
    // Не прерываем - cleanup должен быть максимально надежным
  }
});

/**
 * Подготовка перед каждым тестом
 * Выполняется перед запуском каждого отдельного теста.
 * Отвечает за сброс состояния для обеспечения изоляции тестов с поддержкой асинхронного сброса сервисов.
 * @returns Promise<void>
 */
beforeEach(async () => {
  try {
    // Асинхронный сброс всех зарегистрированных сервисов
    for (const service of TEST_CONFIG.services) {
      if (service.reset) {
        const timeout = SERVICE_TIMEOUTS.DEFAULT_RESET;
        await withTimeoutAndRetries(
          service.reset,
          `${service.name} reset`,
          timeout,
          0, // reset без ретраев
        );
      }
    }

    // Быстрая очистка для каждого теста
    resetTestState();
  } catch (error) {
    logError('Failed to prepare test', error);
    throw error; // Прерываем тест при ошибке в подготовке
  }
});

/**
 * Очистка после каждого теста
 * Выполняется после завершения каждого отдельного теста.
 * Отвечает за проверку состояния и очистку ресурсов, включая временные файлы.
 * @returns Promise<void>
 */
afterEach(async () => {
  try {
    // Очистка DOM в jsdom окружении
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      // Агрессивная очистка всего DOM между тестами
      document.body.innerHTML = '';
      document.head.innerHTML = '';

      // Очистка всех контейнеров рендеринга
      const containers = document.querySelectorAll('[data-testid]');
      containers.forEach((container) => container.remove());

      // Финальная очистка всех элементов
      const allElements = document.querySelectorAll('*');
      allElements.forEach((element) => {
        if (element.parentNode && element.parentNode !== document) {
          try {
            element.parentNode.removeChild(element);
          } catch (e) {
            // Игнорируем ошибки - элемент может быть уже удален
          }
        }
      });

      // Очистка body
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }
    }

    // Очистка временных файлов (опционально)
    if (TEST_CONFIG.clearTempFiles) {
      await cleanupTempFiles();
    }

    // Здесь можно добавить:
    // - Проверку утечек памяти
    // - Логирование результатов теста
    // - Валидацию состояния сервисов
  } catch (error) {
    logError('Failed to cleanup after test', error);
  }
});

// ------------------ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ - МОДУЛЬНЫЕ ОПЕРАЦИИ -----------------------------

/**
 * Автоматическая очистка тестового окружения
 * Выполняет стандартные процедуры очистки для предотвращения нестабильности тестов (flakiness).
 * Включает очистку моков, require кэша и переменных окружения в зависимости от конфигурации.
 * @returns void
 */
function cleanupTestEnvironment(): void {
  try {
    // Очистка глобальных моков
    resetGlobalMocks();

    // Очистка require кэша (опционально)
    if (TEST_CONFIG.clearRequireCache) {
      clearRequireCache(/test|mock|spec/);
    }

    // Очистка переменных окружения (опционально)
    if (TEST_CONFIG.clearTestEnv) {
      clearTestEnvironmentVariables();
    }

    logDebug('✅ Test environment cleanup completed');
  } catch (error) {
    logError('Error during test environment cleanup', error);
  }
}

/**
 * Быстрый сброс состояния для каждого теста
 * Сбрасывает глобальное тестовое состояние, счетчики, кэш, таймстампы и тестовые таймеры.
 * Очищает только тестовые process listeners, сохраняя оригинальные.
 * @returns void
 */
function resetTestState(): void {
  // Типизированный сброс глобального состояния
  const testState = global.testState;
  if (testState) {
    // Сброс счетчиков
    if (testState.counters) {
      Object.keys(testState.counters).forEach((key) => {
        testState.counters![key] = 0;
      });
    }

    // Очистка кэша
    if (testState.cache) {
      testState.cache.clear();
    }

    // Сброс таймстампов
    if (testState.timestamps) {
      Object.keys(testState.timestamps).forEach((key) => {
        delete testState.timestamps![key];
      });
    }
  }

  // Сброс глобальных таймеров
  if (typeof global !== 'undefined') {
    // Очистка всех таймеров (если они есть)
    const timers = global.__testTimers;
    if (timers) {
      timers.forEach((timer: NodeJS.Timeout) => {
        clearTimeout(timer);
      });
      timers.length = 0;
    }
  }

  // Очистка тестовых process listeners (оригинальные будут восстановлены в afterAll)
  const currentListeners = process.listeners('unhandledRejection' as NodeJS.Signals);
  const originalListeners = originalProcessListeners.get('unhandledRejection') ?? [];

  if (currentListeners.length > originalListeners.length) {
    // Удаляем только добавленные во время тестов listeners
    const testListeners = currentListeners.slice(originalListeners.length);
    testListeners.forEach((listener) => {
      process.removeListener('unhandledRejection' as NodeJS.Signals, listener);
    });
  }
}

/**
 * Очистка глобальных моков
 * Очищает все моки в Vitest (global.vi) и Jest (global.jest) если они доступны.
 * Безопасно обрабатывает случаи, когда mocking библиотеки не инициализированы.
 * @returns void
 */
function resetGlobalMocks(): void {
  // Vitest mocks
  if (typeof vi.clearAllMocks === 'function') {
    vi.clearAllMocks();
  }

  // Jest compatibility
  const jest = global.jest as { clearAllMocks?: () => void; } | undefined;
  if (jest && typeof jest.clearAllMocks === 'function') {
    jest.clearAllMocks();
  }
}

/**
 * Очистка require кэша по паттерну (оптимизировано с Set)
 * Удаляет из require.cache модули, чьи пути соответствуют регулярному выражению.
 * Использует Set для эффективного отслеживания ключей перед удалением.
 * @param pattern - Регулярное выражение для фильтрации путей модулей
 * @returns void
 */
function clearRequireCache(pattern: RegExp): void {
  const cacheKeys = Object.keys(require.cache);
  const keysToDelete = new Set<string>();

  // Собираем ключи для удаления
  cacheKeys.forEach((key) => {
    if (pattern.test(key)) {
      keysToDelete.add(key);
    }
  });

  // Удаляем с подсчетом
  let clearedCount = 0;
  keysToDelete.forEach((key) => {
    delete require.cache[key];
    clearedCount++;
  });

  if (clearedCount > 0 && TEST_CONFIG.debug) {
    console.log(`🧹 Cleared ${clearedCount} modules from require cache`);
  }
}

/**
 * Очистка переменных окружения тестов (использует константы)
 * Удаляет переменные окружения, соответствующие тестовым паттернам.
 * Использует предопределенные константы для надежной фильтрации.
 * @returns void
 */
function clearTestEnvironmentVariables(): void {
  const envKeys = Object.keys(process.env);
  let clearedCount = 0;

  envKeys.forEach((key) => {
    const shouldClear = TEST_ENV_KEYS.some(
      (prefix) => key.startsWith(prefix) || key.includes('_TEST_') || key.includes('TEST_'),
    );

    if (shouldClear) {
      delete process.env[key];
      clearedCount++;
    }
  });

  if (clearedCount > 0 && TEST_CONFIG.debug) {
    console.log(`🧹 Cleared ${clearedCount} test environment variables`);
  }
}

/**
 * Очистка временных файлов и директорий с параллельной обработкой
 * @returns Promise<void>
 */
async function cleanupTempFiles(): Promise<void> {
  const startTime = Date.now();
  let cleanedFiles = 0;
  let cleanedDirs = 0;

  try {
    // Параллельная очистка стандартных временных директорий
    const tempDirPromises = TEMP_DIRS.map(async (tempDir) => {
      try {
        await fs.access(tempDir);
        await cleanupDirectory(tempDir);
        return { type: 'dir', path: tempDir, success: true };
      } catch {
        return { type: 'dir', path: tempDir, success: false };
      }
    });

    const tempResults = await Promise.allSettled(tempDirPromises);
    tempResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.success) {
        cleanedDirs++;
        logDebug(`🗂️  Cleaned temp directory: ${result.value.path}`);
      }
    });

    // Очистка файлов с тестовыми паттернами в tmpdir
    const tmpDir = tmpdir();
    try {
      const files = await fs.readdir(tmpDir);
      const testFiles = files.filter(
        (file) =>
          file.startsWith('livai-test-') || file.startsWith('vitest-') || file.includes('-test-'),
      );

      // Параллельная обработка файлов
      const filePromises = testFiles.map(async (file) => {
        const filePath = join(tmpDir, file);
        try {
          const stat = await fs.stat(filePath);
          if (stat.isDirectory()) {
            await cleanupDirectory(filePath);
            return { type: 'dir' as const, success: true };
          } else {
            await fs.unlink(filePath);
            return { type: 'file' as const, success: true };
          }
        } catch (error) {
          logDebug(`⚠️  Failed to clean ${filePath}: ${error}`);
          return { type: 'unknown' as const, success: false };
        }
      });

      const fileResults = await Promise.allSettled(filePromises);
      fileResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          if (result.value.type === 'dir') cleanedDirs++;
          else cleanedFiles++;
        }
      });
    } catch (error) {
      logDebug(`⚠️  Failed to read tmp directory: ${error}`);
    }

    // Очистка process.cwd()/tmp если существует
    const cwdTmp = join(process.cwd(), 'tmp');
    try {
      await fs.access(cwdTmp);
      await cleanupDirectory(cwdTmp);
      cleanedDirs++;
    } catch {
      // Директория не существует
    }

    const duration = Date.now() - startTime;
    logDebug(
      `🗂️  Temp cleanup completed: ${cleanedFiles} files, ${cleanedDirs} dirs (${duration}ms)`,
    );
  } catch (error) {
    logError('Error during temp files cleanup', error);
  }
}

/**
 * Рекурсивная очистка директории
 * Полностью удаляет директорию и все ее содержимое.
 * Сначала удаляет все файлы и поддиректории, затем саму директорию.
 * В качестве fallback использует recursive опцию fs.rmdir.
 * @param dirPath - Путь к директории для очистки
 * @returns Promise<void>
 * @throws Ошибка при неудачной очистке директории
 */
async function cleanupDirectory(dirPath: string): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        await cleanupDirectory(fullPath);
        await fs.rmdir(fullPath);
      } else {
        await fs.unlink(fullPath);
      }
    }
  } catch (error) {
    // Если не можем прочитать директорию, просто логируем ошибку
    // Удаление директории пропускаем для совместимости
    console.warn(`Warning: Could not clean temp directory ${dirPath}:`, error);
  }
}

// ------------------ API ДЛЯ РАСШИРЕНИЯ -----------------------------

/**
 * Регистрация нового тестового сервиса
 * Позволяет динамически добавлять сервисы без изменения кода setup файла.
 * Сервис будет автоматически управляться хуками beforeAll/afterAll/beforeEach.
 * @param service - Конфигурация сервиса с методами init, cleanup, reset
 * @returns void
 */
function registerTestService(service: Readonly<TestService>): void {
  TEST_CONFIG.services.push(service);
  logDebug(`📝 Registered test service: ${service.name}`);
}

/**
 * Получение текущей конфигурации тестов
 * Возвращает readonly копию конфигурации тестового окружения.
 * Полезно для проверки настроек в самих тестах или отладки.
 * @returns Readonly<TestConfig> - Текущая конфигурация тестов
 */
function getTestConfig(): Readonly<TestConfig> {
  return { ...TEST_CONFIG };
}

// ------------------ ЛОГИРОВАНИЕ - БЕЗ SIDE EFFECTS -----------------------------

/**
 * Логирование отладочной информации (только если DEBUG включен)
 * Выводит сообщение только когда VITEST_ENV_DEBUG=true.
 * Используется для детальной отладки тестового окружения.
 * @param message - Сообщение для логирования
 * @returns void
 */
function logDebug(message: string): void {
  if (TEST_CONFIG.debug) {
    console.log(message);
  }
}

/**
 * Логирование ошибок (всегда, но не прерывая тесты)
 * Выводит ошибки в stderr с дополнительной информацией.
 * Не прерывает выполнение тестов, только логирует проблемы.
 * @param message - Описание ошибки
 * @param error - Объект ошибки (опционально)
 * @returns void
 */
function logError(message: string, error?: unknown): void {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.warn(`⚠️  ${message}: ${errorMsg}`);
}

/**
 * Логирование информации (всегда)
 * Выводит информационные сообщения в stdout.
 * Используется для важных уведомлений, которые должны быть видны всегда.
 * @param message - Информационное сообщение
 * @returns void
 */
function logInfo(message: string): void {
  console.log(`ℹ️  ${message}`);
}

// ------------------ ЭКСПОРТЫ ДЛЯ ТЕСТОВ -----------------------------

export {
  cleanupDirectory,
  cleanupTempFiles,
  cleanupTestEnvironment,
  clearRequireCache,
  clearTestEnvironmentVariables,
  getTestConfig,
  type GlobalTestState,
  logDebug,
  logError,
  logInfo,
  registerTestService,
  resetGlobalMocks,
  resetTestState,
  type TestConfig,
  // Типы для использования в тестах
  type TestService,
  withTimeoutAndRetries,
};
