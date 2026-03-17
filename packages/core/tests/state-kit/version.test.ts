/**
 * @file tests for core/src/state-kit/version.ts
 */

import { describe, expect, it, vi } from 'vitest';

import {
  assertVersionEqual,
  compareVersion,
  isVersionMismatch,
} from '../../src/state-kit/version.js';

describe('compareVersion', () => {
  it('возвращает 0 для равных версий', () => {
    expect(compareVersion(1, 1)).toBe(0);
  });

  it('возвращает -1, когда ожидаемая версия меньше сохранённой', () => {
    expect(compareVersion(1, 2)).toBe(-1);
  });

  it('возвращает 1, когда ожидаемая версия больше сохранённой', () => {
    expect(compareVersion(3, 2)).toBe(1);
  });
});

describe('isVersionMismatch', () => {
  it('false для одинаковых версий', () => {
    expect(isVersionMismatch(5, 5)).toBe(false);
  });

  it('true для разных версий', () => {
    expect(isVersionMismatch(5, 6)).toBe(true);
  });
});

describe('assertVersionEqual', () => {
  it('ничего не делает, если версии совпадают', () => {
    expect(() => assertVersionEqual(1, 1)).not.toThrow();
  });

  it('в dev-режиме бросает ошибку при несовпадении версий', () => {
    vi.stubEnv('NODE_ENV', 'development');
    try {
      expect(() => assertVersionEqual(1, 2)).toThrowError(
        'State version mismatch: expected 1, got 2',
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('в production режиме не бросает ошибку при несовпадении версий', () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(() => assertVersionEqual(1, 2)).not.toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
