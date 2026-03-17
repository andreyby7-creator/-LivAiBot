/**
 * @file tests for core/src/state-kit/updater.ts
 */

import { describe, expect, it } from 'vitest';

import { applyUpdater } from '../../src/state-kit/updater.js';

type State = Readonly<{ value: number; label: string; }>;

/* eslint-disable ai-security/data-leakage -- test names here do not contain real training data */
describe('applyUpdater helper', () => {
  const base: State = { value: 1, label: 'base' };

  it('возвращает новый объект при изменённом значении', () => {
    const next = applyUpdater(base, (s) => ({ ...s, value: s.value + 1 }));
    expect(next).not.toBe(base);
    expect(next).toEqual({ value: 2, label: 'base' });
  });

  it('сохраняет ту же ссылку при отсутствии изменений', () => {
    const next = applyUpdater(base, (s) => s);
    expect(next).toBe(base);
  });
});

/* eslint-enable ai-security/data-leakage */
