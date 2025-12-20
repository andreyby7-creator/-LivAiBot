/**
 * @file Конфигурация Vitest для интеграционных AI тестов
 *
 * Проверяет реальные интеграции с AI провайдерами.
 * Использует реальные API ключи, простой учет стоимости.
 */

import { defineConfig } from 'vitest/config';
import { buildVitestEnv } from './vitest.shared.config';

// =============================================================================
// ПРОСТОЙ УЧЕТ AI ЗАПРОСОВ
// =============================================================================

/** Конфигурация AI провайдера */
interface AIProviderConfig {
  name: string;
  key: string;
  rate: number; // USD per 1000 tokens
  required?: boolean; // Обязателен для основных тестов
}

/** Конфигурация всех AI провайдеров */
const AI_PROVIDERS: AIProviderConfig[] = [
  { name: 'openai', key: 'OPENAI_API_KEY', rate: 0.002, required: true },
  { name: 'anthropic', key: 'ANTHROPIC_API_KEY', rate: 0.032, required: true },
  { name: 'google_ai', key: 'GOOGLE_AI_API_KEY', rate: 0.0005, required: true },
  { name: 'grok', key: 'GROK_API_KEY', rate: 0.003 },
  { name: 'deepseek', key: 'DEEPSEEK_API_KEY', rate: 0.001 },
  { name: 'qwen', key: 'QWEN_API_KEY', rate: 0.0015 },
  { name: 'yandex', key: 'YANDEX_API_KEY', rate: 0.002 },
  { name: 'gigachat', key: 'GIGACHAT_API_KEY', rate: 0.0025 },
  { name: 'llama', key: 'LLAMA_API_KEY', rate: 0.001 },
];

/** Мапа тарифов для быстрого доступа (генерируется из AI_PROVIDERS) */
const AI_PROVIDER_RATES: Partial<Record<string, number>> = Object.fromEntries(
  AI_PROVIDERS.map((p) => [p.name, p.rate]),
);

/** Таймаут для AI вызовов по умолчанию */
const DEFAULT_AI_TIMEOUT = 30000;

/** Простой счетчик AI вызовов */
let aiCallCount = 0;
let aiCostEstimate = 0;

/** Запись AI вызова для учета стоимости */
function recordAICall(provider: string, tokens: number) {
  aiCallCount++;
  const rate = AI_PROVIDER_RATES[provider] || 0.001;
  aiCostEstimate += (tokens * rate) / 1000;
}

/** Сброс счетчиков AI для тестов */
function resetAICounters() {
  aiCallCount = 0;
  aiCostEstimate = 0;
}

/** Получение отчета по AI вызовам */
function getAICountersReport() {
  return {
    calls: aiCallCount,
    cost: aiCostEstimate.toFixed(4),
    averageCostPerCall: aiCallCount > 0 ? (aiCostEstimate / aiCallCount).toFixed(6) : '0.000000',
  };
}

/** Проверка доступности ключа для конкретного провайдера */
function isProviderKeyAvailable(providerName: string): boolean {
  const provider = AI_PROVIDERS.find((p) => p.name === providerName);
  if (!provider) return false;

  const apiKey = provider.key;
  const secretKey = provider.key.replace('_API_KEY', '_SECRET');

  // Приоритет: API_KEY имеет преимущество над _SECRET
  return Boolean(process.env[apiKey] || process.env[secretKey]);
}

/** Логирование суммарной статистики AI вызовов */
function logAICountersSummary() {
  const { calls, cost, averageCostPerCall } = getAICountersReport();
  console.log(
    `🤖 AI Calls Summary: ${calls} calls, estimated cost $${cost}, avg $${averageCostPerCall}/call`,
  );
}

/** Логирование отчета для CI/debug режимов */
function logCIReport() {
  const { available, missing, hasRequired } = checkAIKeysAvailability();

  console.log(`🤖 AI Integration Tests configuration loaded:`);
  console.log(`   - Environment: AI Integration Mode`);
  console.log(`   - Test timeout: 30s (API calls)`);
  console.log(`   - Retry attempts: 3 (for API failures)`);
  console.log(
    `   - AI API Keys (${available.length}/${available.length + missing.length} provided):`,
  );

  available.forEach((key) => console.log(`     ✅ ${key}`));
  missing.forEach((key) => console.log(`     ⚠️  ${key} (missing)`));

  if (!hasRequired) {
    console.warn(`⚠️  No required AI API keys found!`);
    console.warn(`   Some integration tests may fail!`);
  }

  // Выводим текущую статистику
  logAICountersSummary();
}

/** Безопасный вызов AI с автоматическим логированием и таймаутом */
async function callAI<T>(
  provider: string,
  tokens: number,
  fn: () => Promise<T>,
  timeoutMs: number = DEFAULT_AI_TIMEOUT,
): Promise<T> {
  try {
    const result = await withTimeout(fn(), timeoutMs);
    recordAICall(provider, tokens);
    return result;
  } catch (error) {
    console.error(`AI call failed for provider ${provider}:`, error);
    throw error;
  }
}

/** Таймаут для AI вызовов с автоматической отменой */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = DEFAULT_AI_TIMEOUT): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI call timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/** Проверка доступности AI ключей */
function checkAIKeysAvailability() {
  const available: string[] = [];
  const missing: string[] = [];

  AI_PROVIDERS.forEach((provider) => {
    if (isProviderKeyAvailable(provider.name)) {
      available.push(provider.name);
    } else {
      missing.push(provider.name);
    }
  });

  const requiredProviders = AI_PROVIDERS.filter((p) => p.required).map((p) => p.name);
  const hasRequired = requiredProviders.every((p) => available.includes(p));

  return { available, missing, hasRequired };
}

// =============================================================================
// ОСНОВНАЯ КОНФИГУРАЦИЯ
// =============================================================================

export default defineConfig({
  test: {
    name: 'AI Integration Tests',
    environment: 'node',
    globals: true,
    setupFiles: ['./test.setup.ts'],

    // AI интеграционные тесты
    include: [
      'tests/integration/**/*.ai.test.ts',
      'tests/integration/**/*.ai.spec.ts',
      'src/**/*ai*integration*.test.ts',
    ],

    // Исключаем unit-тесты
    exclude: ['tests/unit/**/*', 'src/**/*.test.ts', 'src/**/*.spec.ts'],

    // Настройки для API тестов
    testTimeout: 30000, // 30 секунд на API вызовы
    retry: 3, // Повторы при сетевых ошибках

    // Репортеры
    reporters: ['verbose', ['json', { outputFile: 'test-results/ai-results.json' }]],

    // Параллельность и изоляция
    pool: 'threads',
    isolate: false, // AI тесты могут быть зависимы от состояния

    // Покрытие для AI кода
    coverage: {
      include: ['src/ai/**/*', 'src/services/ai/**/*', 'src/integrations/**/*', 'src/**/*ai*/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.d.ts'],
    },

    // Env переменные для AI тестов (автоматически из AI_PROVIDERS)
    env: Object.fromEntries(
      AI_PROVIDERS.map((p) => [p.key, process.env[p.key]]).filter(([_, value]) => value), // Только если переменная установлена
    ),
  },

  // Настройки resolve для AI интеграций
  resolve: {
    alias: {
      '@': '/src',
      '@services': '/src/services',
      '@infra': '/src/infra',
      '@core': '/src/core',
      '@ai': '/src/ai',
    },
  },

  // Оптимизации для AI тестов
  optimizeDeps: {
    exclude: ['@ai-sdk/openai', '@ai-sdk/anthropic', '@ai-sdk/google'],
  },
});

// =============================================================================
// УТИЛИТЫ ДЛЯ AI ТЕСТОВ
// =============================================================================

// Функция logCIReport() теперь доступна для явного вызова в тестах

// Экспорт для использования в тестах
export {
  AI_PROVIDERS,
  aiCallCount,
  aiCostEstimate,
  callAI,
  checkAIKeysAvailability,
  getAICountersReport,
  isProviderKeyAvailable,
  logAICountersSummary,
  logCIReport,
  recordAICall,
  resetAICounters,
  withTimeout,
};
