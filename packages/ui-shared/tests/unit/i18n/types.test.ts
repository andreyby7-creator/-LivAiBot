/**
 * @file Unit тесты для i18n типов/контрактов (TFunction).
 *
 * Примечание: `TFunction` — type-only, поэтому в runtime покрытие строк не даёт.
 * Эти тесты фиксируют ожидаемое поведение типового контракта через реальные функции.
 */

import { describe, expect, it } from 'vitest';

import type { TFunction } from '../../../src/i18n/types.js';

describe('TFunction', () => {
  it('работает с произвольными string ключами', () => {
    const translations: Record<string, string> = {
      'hello': 'Привет',
      'world': 'мир',
    };

    const t: TFunction = (key) => translations[key];

    expect(t('hello')).toBe('Привет');
    expect(t('world')).toBe('мир');
    expect(t('unknown')).toBeUndefined();
  });

  it('поддерживает строгие ключи через generic', () => {
    type Keys = 'form.submit' | 'form.cancel';

    const t: TFunction<Keys> = (key) => {
      switch (key) {
        case 'form.submit':
          return 'Отправить';
        case 'form.cancel':
          return 'Отмена';
      }
    };

    expect(t('form.submit')).toBe('Отправить');
    expect(t('form.cancel')).toBe('Отмена');
  });
});
