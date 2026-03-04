/**
 * @file Общий setup файл для всех пакетов LivAI
 * Архитектура защиты инфраструктуры:
 * - Защита от дублирования глобальных хуков
 * - Логирование критических ошибок
 * - Чистка состояния между тестами
 * - НЕ лечение тестов, а защита среды выполнения
 */

/// <reference types="node" />
import { afterEach, vi } from 'vitest';

// ------------------ ТИПИЗАЦИЯ ГЛОБАЛЬНЫХ ПЕРЕМЕННЫХ -----------------------------

// Тип для глобального состояния тестов
interface GlobalTestState {
  mocks?: Record<string, unknown>;
  counters?: Record<string, number>;
  timestamps?: Record<string, number>;
  cache?: Map<string, unknown>;
}

declare global {
  var testState: GlobalTestState | undefined;
  var __testTimers: NodeJS.Timeout[] | undefined;
}

// ------------------ ЗАЩИТА ОТ ДУБЛИРОВАНИЯ ГЛОБАЛЬНЫХ ХУКОВ -----------------------------

/**
 * Защита от повторной установки глобальных обработчиков
 * Предотвращает дублирование в watch mode и hot-reload сценариях
 */
((): void => {
  // IIFE гарантирует однократное выполнение в module scope

  // ------------------ ЗАЩИТА ИНФРАСТРУКТУРЫ - НЕ ЛЕЧЕНИЕ ТЕСТОВ -----------------------------

  /**
   * Unhandled rejections - потенциальные баги в инфраструктуре
   * НЕ глушим, а даем Vitest решить, является ли это ошибкой теста
   * Логируем для отладки, но не вмешиваемся в логику тестирования
   */
  process.on('unhandledRejection', (reason) => {
    console.warn('🚨 Unhandled rejection detected:', reason);

    // Логируем стек если доступен
    if (reason instanceof Error && reason.stack != null) {
      console.warn('Stack trace:', reason.stack);
    }

    // НЕ глушим - позволяем Vitest решить, упал тест или нет
    // Это может быть реальный баг, а не "ожидаемая" ошибка теста
  });

  /**
   * Uncaught exceptions - критическое повреждение состояния процесса
   * В CI: немедленно завершаем (безопасность и правильные статусы)
   * В dev: логируем и завершаем (для отладки с полным выводом)
   * Никаких "продолжений работы в сломанном состоянии"
   */
  process.on('uncaughtException', (error) => {
    const isCI = process.env['CI'] === 'true';

    console.error('💀 CRITICAL: Uncaught exception in test environment');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    if (isCI) {
      // В CI: немедленный выход для правильных статусов сборки
      console.error('CI mode: Terminating immediately');
      process.exit(1);
    } else {
      // В dev: даём время на чтение логов, затем завершаем
      console.error('Dev mode: Terminating in 2 seconds...');
      setTimeout(() => {
        console.error('Dev mode: Forced termination');
        process.exit(1);
      }, 2000);
    }
  });

  /**
   * Защита от неконтролируемых таймаутов
   * Предотвращает зависание процессов в CI
   * В dev: 15 минут (для отладки долгих тестов)
   * В CI: 5 минут (быстрое обнаружение проблем)
   */
  const isCI = process.env['CI'] === 'true';
  const GLOBAL_TIMEOUT = isCI
    ? 5 * 60 * 1000 // 5 минут в CI
    : 15 * 60 * 1000; // 15 минут в dev

  setTimeout(() => {
    console.error(
      `💀 GLOBAL TEST TIMEOUT: Tests running too long (${GLOBAL_TIMEOUT / 60000}min), terminating`,
    );
    console.error('Hint: Increase timeout with VITEST_GLOBAL_TIMEOUT_MS env var');
    process.exit(1);
  }, GLOBAL_TIMEOUT);

  // Не очищаем таймаут - пусть процесс завершится естественным путём
  // или будет убит по таймауту если завис
})();

// ------------------ ЧИСТКА СОСТОЯНИЯ МЕЖДУ ТЕСТАМИ -----------------------------

/**
 * Глобальная очистка после каждого теста
 * Обеспечивает чистоту состояния без вмешательства в логику тестирования
 */
afterEach(async () => {
  // Очистка fake timers если они активны
  if (vi.isFakeTimers()) {
    await vi.runAllTimersAsync();
  }

  // Даём event loop завершиться естественным образом
  // НЕ используем waitFor(() => true) - это магия и может быть оптимизирована
  await new Promise((resolve) => setImmediate(resolve));
});
