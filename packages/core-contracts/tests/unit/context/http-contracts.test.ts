/**
 * @file Unit tests for context/http-contracts.ts
 *
 * NOTE:
 * - Это файл с foundation-типами (zero-runtime-cost).
 * - Поэтому v8 coverage не сможет “померить” покрытие этих типов напрямую.
 * - Эти тесты максимизируют coverage НА УРОВНЕ ТИПОВ: позитивные кейсы + негативные @ts-expect-error.
 */

import { describe, expect, it } from 'vitest';

import type { HttpMethod, ServiceName } from '../../../src/context/http-contracts.js';

type Assert<T extends true> = T;

// Проверяем, что HttpMethod принимает canonical base
describe('HttpMethod (type)', () => {
  it('принимает стандартные HTTP методы', () => {
    const methods: HttpMethod[] = [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
      'HEAD',
    ];
    expect(methods).toHaveLength(7);
  });

  it('принимает расширенные UPPERCASE методы (extension capability)', () => {
    const extended: HttpMethod[] = ['CONNECT', 'TRACE', 'PROPFIND', 'INTERNAL_HEALTHCHECK'];
    expect(extended[0]).toBe('CONNECT');
  });

  it('отвергает не-uppercase строковые литералы', () => {
    expect(() => {
      // @ts-expect-error - lowercase не должен подходить под Uppercase<string>
      const m: HttpMethod = 'get';
      void m;
    }).not.toThrow();

    expect(() => {
      // @ts-expect-error - mixedcase тоже не должен подходить
      const m: HttpMethod = 'Get';
      void m;
    }).not.toThrow();
  });
});

describe('ServiceName (type)', () => {
  it('принимает canonical имена сервисов', () => {
    const services: ServiceName[] = ['auth', 'billing', 'chat', 'bots', 'gateway'];
    expect(services).toContain('auth');
  });

  it('принимает произвольные строки (extensible union)', () => {
    const custom: ServiceName = 'search';
    expect(custom).toBe('search');
  });

  it('не сужается до literal-юниона (гарантия extensible shape)', () => {
    // Если тип станет closed union, это выражение перестанет компилироваться.
    const invariant: Assert<string extends ServiceName ? true : false> = true;
    expect(invariant).toBe(true);
  });
});
