/**
 * @file Unit тесты для трансформаций Zod схем (utils/transform).
 * Файл transform.ts пока пустой (заготовка для будущих трансформаций),
 * но добавляем smoke тест для проверки экспорта модуля.
 */

import { describe, expect, it } from 'vitest';

describe('utils/transform', () => {
  it('модуль экспортируется без ошибок', async () => {
    // Проверяем, что модуль можно импортировать
    await expect(
      import('../../../../src/validation/zod/utils/transform.js'),
    ).resolves.toBeDefined();
  });

  it('модуль является объектом', async () => {
    const mod = await import('../../../../src/validation/zod/utils/transform.js');
    expect(typeof mod).toBe('object');
    expect(mod).not.toBeNull();
  });
});
