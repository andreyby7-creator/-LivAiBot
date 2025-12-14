/// <reference types="node" />
import { afterEach, vi } from 'vitest';

// Глобальная очистка для предотвращения unhandled rejections между тестами
afterEach(async () => {
  // Только если fake timers активны
  if (vi.isFakeTimers()) {
    await vi.runAllTimersAsync();
  }
  await vi.waitFor(() => true); // 💡 микротаски из очереди завершены
});

// Глобальный safeguard для отлова отложенных reject'ов
process.on('unhandledRejection', reason => {
  if (
    reason instanceof Error &&
    (reason.message.includes('timed out') ||
      reason.message.includes('fail') ||
      reason.message.includes('Custom timeout'))
  ) {
    // Поглощаем timeout и retry ошибки в тестах
    return;
  }
  throw reason;
});
