/**
 * @file Глобальная очистка после Playwright E2E тестов LivAi
 *
 * Очищает тестовое окружение:
 * - Удаление тестовых данных
 * - Очистка тестовой базы данных
 * - Удаление тестовых workspace
 * - Завершение процессов браузера
 */

import * as fsSync from 'fs';
import * as path from 'path';

import { glob as fg } from 'fast-glob';

import type { FullConfig } from '@playwright/test';

// Определение окружения
const isVerbose = Boolean(process.env.E2E_VERBOSE !== 'false'); // По умолчанию verbose включен

// URL для API (может отличаться от веб сервера)
const API_BASE_URL = process.env.E2E_API_BASE_URL
  ?? process.env.E2E_BASE_URL
  ?? 'http://localhost:3000';

// Интерфейс для AI бота (должен совпадать с global-setup.ts)
interface AiBot {
  id: string;
  name: string;
  type: string;
  provider: string;
  workspaceId: string | null;
  createdAt: string;
}

// Декларация типов для глобального тестового окружения (совпадает с global-setup.ts)
declare global {
  var testEnvironment: {
    workspaceId: string;
    userId: string;
    apiToken: string;
    aiBots: AiBot[];
    baseUrl: string;
  };
}

// API клиент для очистки тестовых данных
class CleanupApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? API_BASE_URL;
  }

  async cleanupTestWorkspace(workspaceId: string): Promise<void> {
    const url = `${this.baseUrl}/api/workspaces/${workspaceId}`;

    if (isVerbose) console.log(`📡 DELETE ${url} - Cleaning up workspace`);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${global.testEnvironment.apiToken}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        console.warn(`⚠️ Failed to delete workspace ${workspaceId}: HTTP ${response.status}`);
      } else if (isVerbose) {
        console.log(`🗑️  Cleaned up test workspace: ${workspaceId}`);
      }
    } catch (error) {
      console.warn(
        `⚠️ Error cleaning up workspace ${workspaceId}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async cleanupTestUser(userId: string): Promise<void> {
    const url = `${this.baseUrl}/api/users/${userId}`;

    if (isVerbose) console.log(`📡 DELETE ${url} - Cleaning up user`);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${global.testEnvironment.apiToken}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        console.warn(`⚠️ Failed to delete user ${userId}: HTTP ${response.status}`);
      } else if (isVerbose) {
        console.log(`🗑️  Cleaned up test user: ${userId}`);
      }
    } catch (error) {
      console.warn(
        `⚠️ Error cleaning up user ${userId}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async cleanupAiBot(bot: AiBot): Promise<void> {
    const url = `${this.baseUrl}/api/bots/${bot.id}`;

    if (isVerbose) console.log(`📡 DELETE ${url} - Cleaning up AI bot: ${bot.name}`);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${global.testEnvironment.apiToken}`,
        },
      });

      if (!response.ok && response.status !== 404) {
        console.warn(`⚠️ Failed to delete AI bot ${bot.id}: HTTP ${response.status}`);
      } else if (isVerbose) {
        console.log(`🗑️  Cleaned up AI bot: ${bot.name} (${bot.id})`);
      }
    } catch (error) {
      console.warn(
        `⚠️ Error cleaning up AI bot ${bot.id}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async cleanupAiBots(bots: AiBot[]): Promise<void> {
    // Очистка всех AI ботов
    if (bots.length === 0) return;

    if (isVerbose) console.log(`🧹 Cleaning up ${bots.length} AI bots...`);

    await Promise.all(bots.map((bot) => this.cleanupAiBot(bot)));

    if (isVerbose) console.log(`✅ Cleaned up all AI bots`);
  }
}

async function globalTeardown(_config: FullConfig): Promise<void> {
  if (isVerbose) console.log('🧹 Cleaning up E2E test environment...');

  // В CI предотвращаем параллельную очистку общих ресурсов
  const workerId = process.env.TEST_WORKER_ID ?? '0';
  const isCI = process.env.CI !== undefined;
  const cleanupLockFile = path.join(process.cwd(), 'test-results', '.cleanup-lock');

  if (isCI && workerId !== '0') {
    // Не-первый worker ждет завершения очистки первым worker'ом (макс 30 сек)
    let attempts = 0;
    while (fsSync.existsSync(cleanupLockFile) && attempts < 30) {
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
      attempts++;
    }
    if (isVerbose) {
      console.log(`🔄 Worker ${workerId} skipping duplicate cleanup (handled by worker 0)`);
    }
    return;
  }

  // Первый worker создает lock файл
  if (isCI) {
    try {
      fsSync.writeFileSync(
        cleanupLockFile,
        `Cleanup started by worker ${workerId} at ${new Date().toISOString()}`,
      );
    } catch {
      // Игнорируем ошибки создания lock файла
    }
  }

  try {
    const cleanupClient = new CleanupApiClient();

    // Читаем данные setup для очистки (уникальный файл для каждого worker)
    const workerId = process.env.TEST_WORKER_ID ?? '0';
    const setupFile = path.join(process.cwd(), 'test-results', `e2e-setup-${workerId}.json`);

    try {
      // Проверяем наличие файла перед чтением
      let fileExists: boolean;
      try {
        fsSync.accessSync(setupFile, fsSync.constants.F_OK);
        fileExists = true;
      } catch {
        fileExists = false;
      }
      if (!fileExists) {
        if (isVerbose) console.log('ℹ️  Setup data file not found, skipping cleanup');
        return;
      }

      const rawData = fsSync.readFileSync(setupFile, 'utf8');
      const setupData = JSON.parse(rawData) as {
        workspaceId?: string;
        userId?: string;
        aiBots?: AiBot[];
      };

      // Очищаем созданные тестовые данные
      if (setupData.aiBots && setupData.aiBots.length > 0) {
        await cleanupClient.cleanupAiBots(setupData.aiBots);
      }

      if (setupData.userId !== undefined) {
        await cleanupClient.cleanupTestUser(setupData.userId);
      }

      if (setupData.workspaceId !== undefined) {
        await cleanupClient.cleanupTestWorkspace(setupData.workspaceId);
      }

      // Удаляем файл с тестовыми данными
      try {
        fsSync.unlinkSync(setupFile);
      } catch (unlinkError) {
        // Логируем ошибку, но не бросаем (файл мог быть уже удален другим процессом)
        if (isVerbose) {
          console.warn(
            '⚠️  Could not remove setup data file:',
            unlinkError instanceof Error ? unlinkError.message : String(unlinkError),
          );
        }
      }
      if (isVerbose) console.log('🗑️  Removed test setup data file');
    } catch (parseError) {
      console.warn(
        '⚠️  Could not parse setup data for cleanup:',
        parseError instanceof Error ? parseError.message : String(parseError),
      );
    }

    // Дополнительная очистка процессов и файлов
    if (isVerbose) console.log('🧹 Performing additional cleanup...');

    // Очистка кэша Playwright и временных файлов
    try {
      let cleanupTasks: string[] = [];

      // Очистка Playwright cache (только в CI для экономии времени разработки)
      if (Boolean(process.env.CI)) {
        const playwrightCacheDir = path.join(process.cwd(), '.playwright');
        try {
          if (fsSync.existsSync(playwrightCacheDir)) {
            fsSync.rmSync(playwrightCacheDir, { recursive: true, force: true });
            cleanupTasks = [...cleanupTasks, 'Playwright cache'];
            if (isVerbose) console.log('🗑️  Cleared Playwright cache');
          }
        } catch (cacheError) {
          console.warn(
            '⚠️  Failed to clear Playwright cache:',
            cacheError instanceof Error ? cacheError.message : String(cacheError),
          );
        }
      }

      // Очистка временных скриншотов, видео и кэша
      const tempPatterns = [
        path.join(process.cwd(), 'test-results', '**/*.{png,jpg,jpeg,mp4,webm}'),
        path.join(process.cwd(), '.cache', '**/*'),
        path.join(process.cwd(), 'playwright-report', '**/*.{png,jpg,mp4}'), // Playwright artifacts
      ];

      for (const pattern of tempPatterns) {
        try {
          const files = await fg(pattern, { dot: true, absolute: true });
          if (files.length > 0) {
            let deletedCount = 0;
            files.forEach((f: string) => {
              try {
                fsSync.unlinkSync(f);
                deletedCount++;
              } catch (fileError) {
                // Логируем ошибки удаления файлов, но продолжаем
                if (isVerbose) {
                  console.warn(
                    `⚠️  Could not delete ${f}:`,
                    fileError instanceof Error ? fileError.message : String(fileError),
                  );
                }
              }
            });
            if (deletedCount > 0) {
              cleanupTasks = [
                ...cleanupTasks,
                `${deletedCount}/${files.length} files from ${path.basename(pattern)}`,
              ];
            }
          }
        } catch (globError) {
          // Игнорируем ошибки чтения директорий
          if (isVerbose) {
            console.warn(
              `⚠️  Could not clean pattern ${pattern}:`,
              globError instanceof Error ? globError.message : String(globError),
            );
          }
        }
      }

      if (cleanupTasks.length > 0) {
        if (isVerbose) console.log(`🧹 Cleaned up: ${cleanupTasks.join(', ')}`);
      } else if (isVerbose) {
        console.log('🧹 No additional cleanup needed');
      }
    } catch (cleanupError) {
      console.warn(
        '⚠️  Additional cleanup failed:',
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      );
    }

    if (isVerbose) console.log('✅ E2E environment cleanup completed');

    // Удаляем lock файл в CI
    if (isCI) {
      try {
        fsSync.unlinkSync(cleanupLockFile);
      } catch {
        // Игнорируем ошибки удаления lock файла
      }
    }
  } catch (error) {
    console.error('❌ E2E cleanup failed:', error);
    // Не бросаем ошибку, чтобы не ломать отчетность
  }
}

export default globalTeardown;
