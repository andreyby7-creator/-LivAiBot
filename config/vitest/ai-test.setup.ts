/**
 * @file Минимальная настройка для AI интеграционных тестов
 * Отличается от основной test.setup.ts тем, что не импортирует
 * @testing-library/jest-dom/vitest (DOM utilities), так как AI тесты
 * работают в Node окружении без DOM.
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

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
  string,
  Array<(...args: readonly unknown[]) => void>
> = new Map();

/** ENV флаги для управления поведением тестов */
const TEST_ENV_FLAGS = {
  DEBUG: 'VITEST_ENV_DEBUG',
  CLEAR_CACHE: 'CLEAR_REQUIRE_CACHE',
  CLEAR_TEMP: 'CLEAR_TEMP_FILES',
  CLEAR_ENV: 'CLEAR_TEST_ENV',
} as const;

/** Таймауты по умолчанию для сервисов */
const SERVICE_TIMEOUTS = {
  DEFAULT_INIT: 10000, // 10 сек
  DEFAULT_CLEANUP: 5000, // 5 сек
  DEFAULT_RESET: 1000, // 1 сек
} as const;

/** Глобальная конфигурация тестового окружения */
const TEST_CONFIG: TestConfig = {
  debug: process.env[TEST_ENV_FLAGS.DEBUG] === 'true',
  clearRequireCache: process.env[TEST_ENV_FLAGS.CLEAR_CACHE] === 'true',
  clearTempFiles: process.env[TEST_ENV_FLAGS.CLEAR_TEMP] === 'true',
  clearTestEnv: process.env[TEST_ENV_FLAGS.CLEAR_ENV] === 'true',
  services: [
    // AI сервисы можно добавить здесь при необходимости
  ],
};

// ------------------ ГЛОБАЛЬНЫЕ HOOKS -----------------------------

/**
 * Глобальная инициализация AI тестового окружения
 */
beforeAll(async () => {
  logDebug('🚀 Initializing LivAI AI test environment');

  try {
    // Сохранение оригинальных process listeners
    saveOriginalProcessListeners();

    // Инициализация всех зарегистрированных сервисов
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
  } catch (error) {
    logError('Failed to initialize AI test environment', error);
    throw error;
  }
});

/**
 * Глобальная финализация AI тестового окружения
 */
afterAll(async () => {
  logDebug('🧹 Cleaning up AI test environment');

  try {
    // Очистка всех зарегистрированных сервисов
    for (const service of TEST_CONFIG.services.slice().reverse()) {
      if (service.cleanup) {
        const timeout = service.timeout ?? SERVICE_TIMEOUTS.DEFAULT_CLEANUP;
        logDebug(`🗑️  Cleaning up ${service.name} service (timeout: ${timeout}ms)`);
        await withTimeoutAndRetries(
          service.cleanup,
          `${service.name} cleanup`,
          timeout,
          0,
        );
      }
    }

    // Восстановление оригинальных process listeners
    restoreOriginalProcessListeners();
  } catch (error) {
    logError('Failed to cleanup AI test environment', error);
  }
});

/**
 * Подготовка перед каждым AI тестом
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
          0,
        );
      }
    }

    // Быстрая очистка для каждого теста
    resetTestState();
  } catch (error) {
    logError('Failed to prepare AI test', error);
    throw error;
  }
});

/**
 * Очистка после каждого AI теста
 */
afterEach(() => {
  try {
    // Очистка глобальных моков
    resetGlobalMocks();
  } catch (error) {
    logError('Failed to cleanup after AI test', error);
  }
});

// ------------------ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ -----------------------------

/**
 * Выполнение операции с таймаутом и повторными попытками
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
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw new Error(`All ${retries + 1} attempts failed for ${name}`);
}

/**
 * Быстрый сброс состояния для каждого теста
 */
function resetTestState(): void {
  // Очистка глобальных таймеров
  if (typeof global !== 'undefined') {
    const timers = global.__testTimers;
    if (timers) {
      timers.forEach((timer: NodeJS.Timeout) => {
        clearTimeout(timer);
      });
      // Очищаем массив без мутации
      global.__testTimers = [];
    }
  }
}

/**
 * Очистка глобальных моков
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
 * Сохранение оригинальных process listeners
 */
function saveOriginalProcessListeners(): void {
  const eventsToSave = [
    'unhandledRejection',
    'uncaughtException',
    'warning',
  ] as const;

  eventsToSave.forEach((event) => {
    const listeners = process.listeners(event);
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
 */
function restoreOriginalProcessListeners(): void {
  originalProcessListeners.forEach((listeners, event) => {
    // Сначала удаляем все текущие listeners
    process.removeAllListeners(event);
    // Затем восстанавливаем оригинальные
    listeners.forEach((listener) => {
      process.on(event, listener);
    });
  });

  originalProcessListeners.clear();
  logDebug('🔄 Restored original process listeners');
}

// ------------------ ЛОГИРОВАНИЕ -----------------------------

function logDebug(message: string): void {
  if (TEST_CONFIG.debug) {
    console.log(message);
  }
}

function logError(message: string, error?: unknown): void {
  const errorMsg = error instanceof Error ? error.message : String(error);
  console.warn(`⚠️  ${message}: ${errorMsg}`);
}

// ------------------ ЭКСПОРТЫ -----------------------------

export {
  type GlobalTestState,
  logDebug,
  logError,
  resetGlobalMocks,
  resetTestState,
  type TestConfig,
  type TestService,
  withTimeoutAndRetries,
};
