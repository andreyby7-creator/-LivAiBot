/**
 * @file Глобальная настройка для Playwright E2E тестов LivAi
 *
 * Подготавливает тестовое окружение:
 * - Создание тестового workspace
 * - Настройка AI провайдеров
 * - Инициализация тестовой базы данных
 * - Тестовые утилиты для API взаимодействия
 */

import * as fsSync from 'fs';
import * as path from 'path';

import { chromium } from '@playwright/test';

import type { FullConfig } from '@playwright/test';

// Определение окружения
const isCI = process.env['CI'] !== undefined && process.env['CI'] !== '';
const isVerbose = Boolean(process.env['E2E_VERBOSE'] !== 'false'); // По умолчанию verbose включен

// URL для API (может отличаться от веб сервера)
const API_BASE_URL = process.env['E2E_API_BASE_URL']
  ?? process.env['E2E_BASE_URL']
  ?? 'http://localhost:3000';

// Тестовый пароль для создания пользователей в E2E тестах
const TEST_USER_PASSWORD = process.env['E2E_TEST_USER_PASSWORD'] ?? 'testpass123';

// Таймауты для E2E операций
const PAGE_TIMEOUT =
  process.env['E2E_PAGE_TIMEOUT'] !== undefined && process.env['E2E_PAGE_TIMEOUT'] !== ''
    ? parseInt(process.env['E2E_PAGE_TIMEOUT'], 10)
    : (isCI ? 60000 : 30000); // 60 сек в CI, 30 сек локально

const API_TIMEOUT =
  process.env['E2E_API_TIMEOUT'] !== undefined && process.env['E2E_API_TIMEOUT'] !== ''
    ? parseInt(process.env['E2E_API_TIMEOUT'], 10)
    : 10000; // 10 сек для API запросов

const API_RETRY_ATTEMPTS = process.env['E2E_API_RETRY_ATTEMPTS'] !== undefined
    && process.env['E2E_API_RETRY_ATTEMPTS'] !== ''
  ? parseInt(process.env['E2E_API_RETRY_ATTEMPTS'], 10)
  : 3; // 3 попытки для API запросов

const API_RETRY_DELAY =
  process.env['E2E_API_RETRY_DELAY'] !== undefined && process.env['E2E_API_RETRY_DELAY'] !== ''
    ? parseInt(process.env['E2E_API_RETRY_DELAY'], 10)
    : 1000; // 1 сек задержка между попытками

// HTTP клиент для API запросов
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface WorkspaceResponse {
  id: string;
  name: string;
  created_at: string;
}

interface UserResponse {
  id: string;
  email: string;
  token: string;
}

interface BotResponse {
  id: string;
  name: string;
  type: string;
  provider: string;
  workspace_id: string;
  created_at: string;
}

interface TestEnvironmentData {
  workspaceId: string;
  userId: string;
  token: string;
  aiBots: AiBot[];
  performanceMetrics?: PerformanceMetrics;
}

// Вспомогательная функция для выполнения API запросов с retry и метриками
async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit,
  operation: string,
): Promise<ApiResponse<T>> {
  let lastError: Error | null = null;
  const method = options.method ?? 'GET';

  performanceMetrics.apiRequests.total++;

  for (let attempt = 1; attempt <= API_RETRY_ATTEMPTS; attempt++) {
    try {
      if (Boolean(isVerbose && attempt > 1)) {
        console.log(`🔄 ${operation} - attempt ${attempt}/${API_RETRY_ATTEMPTS}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, API_TIMEOUT);

      const requestStart = Date.now();
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      const requestDuration = Date.now() - requestStart;

      clearTimeout(timeoutId);

      // Обновляем метрики производительности
      performanceMetrics.apiRequests.averageResponseTime =
        (performanceMetrics.apiRequests.averageResponseTime
            * (performanceMetrics.apiRequests.successful
              + performanceMetrics.apiRequests.failed
              - 1) + requestDuration)
        / (performanceMetrics.apiRequests.successful + performanceMetrics.apiRequests.failed);

      if (requestDuration > performanceMetrics.apiRequests.slowestRequest.duration) {
        performanceMetrics.apiRequests.slowestRequest = {
          url,
          method,
          duration: requestDuration,
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as T;

      performanceMetrics.apiRequests.successful++;

      if (Boolean(isVerbose && requestDuration > 1000)) {
        console.log(`🐌 Slow API request: ${method} ${url} took ${requestDuration}ms`);
      }

      return { success: true, data };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === API_RETRY_ATTEMPTS) {
        performanceMetrics.apiRequests.failed++;
        break;
      }

      if (Boolean(isVerbose)) {
        console.warn(
          `⚠️ ${operation} failed (attempt ${attempt}/${API_RETRY_ATTEMPTS}):`,
          lastError.message,
        );
      }

      // Ждем перед следующей попыткой
      await new Promise((resolve) => {
        setTimeout(resolve, API_RETRY_DELAY);
      });
    }
  }

  throw new Error(
    `${operation} failed after ${API_RETRY_ATTEMPTS} attempts: ${
      lastError?.message ?? 'Unknown error'
    }`,
  );
}

// Метрики производительности
interface PerformanceMetrics {
  apiRequests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    slowestRequest: {
      url: string;
      method: string;
      duration: number;
    };
  };
  setupDuration: number;
  browserLaunchTime: number;
}

// Глобальные метрики
const performanceMetrics: PerformanceMetrics = {
  apiRequests: {
    total: 0,
    successful: 0,
    failed: 0,
    averageResponseTime: 0,
    slowestRequest: {
      url: '',
      method: '',
      duration: 0,
    },
  },
  setupDuration: 0,
  browserLaunchTime: 0,
};

// Интерфейс для AI бота
interface AiBot {
  id: string;
  name: string;
  type: string;
  provider: string;
  workspaceId: string | null;
  createdAt: string;
}

// Декларация типов для глобального тестового окружения
declare global {
  var testEnvironment: {
    workspaceId: string;
    userId: string;
    apiToken: string;
    aiBots: AiBot[];
    baseUrl: string;
  };
}

// Глобальные переменные для тестового окружения
global.testEnvironment = {
  workspaceId: '',
  userId: '',
  apiToken: '',
  aiBots: [], // Массив созданных AI ботов для тестов
  baseUrl: process.env['E2E_BASE_URL']
    ?? process.env['E2E_API_BASE_URL']
    ?? 'http://localhost:3000',
};

// API клиент для взаимодействия с тестовым сервером
class TestApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? API_BASE_URL;
  }

  async createTestWorkspace(name = 'E2E Test Workspace'): Promise<string> {
    const url = `${this.baseUrl}/api/workspaces`;

    if (isVerbose) {
      console.log('📡 POST', url, '- Creating workspace:', name);
    }

    try {
      const data = await apiRequest<WorkspaceResponse>(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description: 'E2E test workspace',
          type: 'personal',
        }),
      }, 'Create workspace');

      if (!(data.success && data.data)) {
        throw new Error(data.error ?? 'Failed to create workspace');
      }

      const workspaceId = data.data.id;
      if (Boolean(isVerbose)) {
        console.log('📁 Created test workspace:', workspaceId, '(', name, ')');
      }

      Object.assign(global.testEnvironment, { workspaceId });
      return workspaceId;
    } catch (error) {
      console.error(
        '❌ Failed to create test workspace:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async createTestUser(
    email: string,
    password = TEST_USER_PASSWORD,
  ): Promise<{ userId: string; token: string; }> {
    const url = `${this.baseUrl}/api/auth/register`;

    if (isVerbose) {
      console.log(
        '📡 POST',
        url,
        '- Creating user:',
        email,
        'with password:',
        '*'.repeat(password.length),
      );
    }

    try {
      const data = await apiRequest<UserResponse>(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          password_confirm: password,
          terms_accepted: true,
        }),
      }, 'Create user');

      if (!(data.success && data.data)) {
        throw new Error(data.error ?? 'Failed to create user');
      }

      const { id: userId, token } = data.data;

      if (Boolean(isVerbose)) console.log(`👤 Created test user: ${userId} (${email})`);

      Object.assign(global.testEnvironment, { userId, apiToken: token });

      return { userId, token };
    } catch (error) {
      console.error(
        '❌ Failed to create test user:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async createTestAiBot(name: string, type = 'chat', provider = 'yandex'): Promise<AiBot> {
    const url = `${this.baseUrl}/api/bots`;

    if (Boolean(isVerbose)) {
      console.log(`📡 POST ${url} - Creating AI bot: ${name} (${type}/${provider})`);
    }

    try {
      const data = await apiRequest<BotResponse>(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${global.testEnvironment.apiToken}`,
        },
        body: JSON.stringify({
          name,
          type,
          provider,
          workspace_id: global.testEnvironment.workspaceId,
          config: {
            temperature: 0.7,
            max_tokens: 1000,
          },
        }),
      }, 'Create AI bot');

      if (!(data.success && data.data)) {
        throw new Error(data.error ?? 'Failed to create AI bot');
      }

      const bot: AiBot = {
        id: data.data.id,
        name: data.data.name,
        type: data.data.type,
        provider: data.data.provider,
        workspaceId: data.data.workspace_id,
        createdAt: data.data.created_at,
      };

      if (Boolean(isVerbose)) console.log(`🤖 Created test AI bot: ${name} (${type}/${provider})`);

      global.testEnvironment.aiBots.push(bot);
      return bot;
    } catch (error) {
      console.error(
        '❌ Failed to create test AI bot:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async setupTestData(): Promise<TestEnvironmentData> {
    // Настройка начальных тестовых данных
    if (isVerbose) console.log('📊 Setting up test data...');

    const workspaceId = await this.createTestWorkspace();
    const { userId, token } = await this.createTestUser('e2e-test@example.com');

    // Создаем тестовых AI ботов для различных сценариев
    if (isVerbose) console.log('🤖 Creating test AI bots...');
    const chatBot = await this.createTestAiBot('E2E Chat Bot', 'chat', 'yandex');
    const qaBot = await this.createTestAiBot('E2E QA Bot', 'qa', 'yandex');
    const codingBot = await this.createTestAiBot('E2E Coding Bot', 'coding', 'yandex');

    if (isVerbose) {
      console.log(`✅ Created AI bots: ${chatBot.name}, ${qaBot.name}, ${codingBot.name}`);
    }

    return {
      workspaceId,
      userId,
      token,
      aiBots: global.testEnvironment.aiBots,
      performanceMetrics,
    };
  }
}

async function globalSetup(config: FullConfig): Promise<TestEnvironmentData> {
  const setupStartTime = Date.now();

  if (isVerbose) console.log('🚀 Setting up E2E test environment...');

  const apiClient = new TestApiClient(config.webServer?.url ?? 'http://localhost:3000');

  try {
    // Создаем браузер для проверки доступности сервера
    const browserLaunchStart = Date.now();
    const browser = await chromium.launch({ headless: true });
    performanceMetrics.browserLaunchTime = Date.now() - browserLaunchStart;

    const page = await browser.newPage();

    try {
      // Проверяем доступность сервера с retry
      const serverUrl = config.webServer?.url ?? 'http://localhost:3000';
      const maxRetries = 2;
      const retryDelay = 5000; // 5 секунд

      if (!serverUrl) {
        throw new Error('Server URL is not defined');
      }

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (isVerbose) {
            console.log(`🔍 Checking server accessibility (attempt ${attempt}/${maxRetries})...`);
          }

          await page.goto(serverUrl, {
            waitUntil: 'domcontentloaded',
            timeout: PAGE_TIMEOUT,
          });

          if (isVerbose) console.log('✅ Test server is accessible');
          break;
        } catch (serverError) {
          const errorMessage = serverError instanceof Error
            ? serverError.message
            : String(serverError);

          if (attempt === maxRetries) {
            console.error('❌ Test server is not accessible after all retries:', errorMessage);
            throw new Error(
              `Server accessibility check failed after ${maxRetries} attempts: ${errorMessage}`,
            );
          }

          console.warn(
            `⚠️ Server check attempt ${attempt} failed, retrying in ${retryDelay}ms:`,
            errorMessage,
          );
          await new Promise((resolve) => {
            setTimeout(resolve, retryDelay);
          });
        }
      }

      // Настраиваем тестовые данные
      try {
        const testData = await apiClient.setupTestData();

        // Сохраняем тестовые данные для использования в тестах
        const testResultsDir = path.join(process.cwd(), 'test-results');
        try {
          fsSync.mkdirSync(testResultsDir);
        } catch {
          // Директория может уже существовать
        }

        // Уникальный файл для каждого worker при параллельном запуске
        const workerId = process.env['TEST_WORKER_ID'] ?? '0';

        // Обновляем метрики времени настройки
        performanceMetrics.setupDuration = Date.now() - setupStartTime;

        // Сохраняем только безопасные данные (без токенов)
        // Токены доступны через global.testEnvironment для тестов
        fsSync.writeFileSync(
          path.join(testResultsDir, `e2e-setup-${workerId}.json`),
          JSON.stringify(
            {
              workspaceId: testData.workspaceId,
              userId: testData.userId,
              tokenMasked: `${testData.token.substring(0, 8)}...${
                testData.token.substring(testData.token.length - 4)
              }`, // Маскируем токен
              aiBotsCount: testData.aiBots.length,
              aiBotNames: testData.aiBots.map((bot) => bot.name),
              performanceMetrics,
              createdAt: new Date().toISOString(),
              // ВАЖНО: настоящий токен НЕ сохраняется в файл по соображениям безопасности
            },
            null,
            2,
          ),
          'utf8',
        );

        if (Boolean(isVerbose)) {
          console.log('📊 Performance metrics:');
          console.log(`  - Setup duration: ${performanceMetrics.setupDuration}ms`);
          console.log(`  - Browser launch time: ${performanceMetrics.browserLaunchTime}ms`);
          console.log(
            `  - API requests: ${performanceMetrics.apiRequests.successful}/${performanceMetrics.apiRequests.total} successful`,
          );
          console.log(
            `  - Average API response time: ${
              Math.round(performanceMetrics.apiRequests.averageResponseTime)
            }ms`,
          );
        }

        if (isVerbose) console.log('✅ E2E environment setup completed');

        // Возвращаем данные для использования в тестах
        return {
          workspaceId: global.testEnvironment.workspaceId,
          userId: global.testEnvironment.userId,
          token: global.testEnvironment.apiToken,
          aiBots: global.testEnvironment.aiBots,
        };
      } catch (apiError) {
        const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
        console.error('❌ API setup failed:', errorMessage);
        throw new Error(`API setup failed: ${errorMessage}`);
      }
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('❌ E2E setup failed:', error);
    throw error;
  }
}

export default globalSetup;
