/**
 * @file Unit тесты для lib/error-mapper.ts
 * Цель: 100% покрытие файла error-mapper.ts
 */

import { describe, expect, it, vi } from 'vitest';

import type { BotErrorResponse } from '../../../src/contracts/BotErrorResponse.js';
import { getBotRetryable } from '../../../src/domain/BotRetry.js';
import type { MappingRule } from '../../../src/lib/error-mapper.js';
import { mapBotErrorToUI } from '../../../src/lib/error-mapper.js';
import type { BotError, BotErrorContext } from '../../../src/types/bots.js';

const createFallback = (overrides: Partial<BotError> = {}): BotError => ({
  category: 'validation',
  code: 'BOT_NAME_INVALID',
  severity: 'low',
  retryable: false,
  ...overrides,
});

const createBotErrorResponse = (
  overrides: Partial<BotErrorResponse> = {},
): BotErrorResponse => ({
  error: 'validation_error',
  code: 'BOT_CHANNEL_CONNECTION_FAILED',
  category: 'channel',
  severity: 'high',
  retryable: false,
  ...overrides,
});

describe('mapBotErrorToUI', () => {
  it('нормализует fallback: возвращает тот же объект, если он frozen и retryable согласован с BotRetryPolicy', () => {
    const code = 'BOT_CHANNEL_CONNECTION_FAILED' as const;
    const fallback: BotError = Object.freeze({
      category: 'channel',
      code,
      severity: 'high',
      retryable: getBotRetryable(code),
    });

    // Важно: вход должен НЕ матчить ни одно правило (stringErrorRule / jsErrorRule / botErrorResponseRule),
    // иначе маппер обогащает context и не сможет вернуть тот же объект fallback.
    const result = mapBotErrorToUI({ a: 1 }, { fallback });

    expect(result).toBe(fallback);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.retryable).toBe(getBotRetryable(code));
  });

  it('нормализует fallback: пересчитывает retryable и freeze, если fallback не frozen или не согласован', () => {
    const code = 'BOT_CHANNEL_CONNECTION_FAILED' as const;
    const fallback = createFallback({
      category: 'channel',
      code,
      severity: 'high',
      retryable: false, // специально не совпадает с доменной политикой
    });

    const result = mapBotErrorToUI('anything', { fallback });

    expect(result).not.toBe(fallback);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.retryable).toBe(getBotRetryable(code));
    expect(result.category).toBe('channel');
    expect(result.code).toBe(code);
    expect(result.severity).toBe('high');
  });

  it('маппит BotErrorResponse в BotError и не доверяет transport retryable', () => {
    const input = createBotErrorResponse({
      code: 'BOT_CHANNEL_CONNECTION_FAILED',
      category: 'channel',
      severity: 'critical',
      retryable: false, // transport значение должно игнорироваться
    });

    const fallback = createFallback();

    const result = mapBotErrorToUI(input, { fallback });

    expect(result.category).toBe('channel');
    expect(result.code).toBe('BOT_CHANNEL_CONNECTION_FAILED');
    expect(result.severity).toBe('critical');
    expect(result.retryable).toBe(getBotRetryable('BOT_CHANNEL_CONNECTION_FAILED'));
    expect(Object.isFrozen(result)).toBe(true);
    expect('context' in result).toBe(false);
  });

  it('пробрасывает context из BotErrorResponse, если он задан', () => {
    const context: BotErrorContext = { field: 'name', value: 'x' };

    const input = createBotErrorResponse({
      context,
      code: 'BOT_NAME_INVALID',
      category: 'validation',
      severity: 'medium',
    });

    const result = mapBotErrorToUI(input, { fallback: createFallback() });

    expect(result.context).toEqual(context);
    expect(result.retryable).toBe(getBotRetryable('BOT_NAME_INVALID'));
  });

  it('маппит JS Error в fallback, добавляя cause в context.details (с сохранением существующих details)', () => {
    const input = new Error('boom');

    const fallbackContextDetails = Object.freeze({ existing: true });

    const fallbackContext: BotErrorContext = {
      field: 'instruction',
      details: fallbackContextDetails,
    };

    const fallback = createFallback({
      category: 'integration',
      code: 'BOT_INTEGRATION_TIMEOUT',
      severity: 'high',
      context: fallbackContext,
    });

    const result = mapBotErrorToUI(input, { fallback });

    expect(result.category).toBe('integration');
    expect(result.code).toBe('BOT_INTEGRATION_TIMEOUT');
    expect(result.severity).toBe('high');
    expect(result.retryable).toBe(getBotRetryable('BOT_INTEGRATION_TIMEOUT'));

    expect(result.context?.field).toBe('instruction');
    expect(result.context?.details).toMatchObject({
      existing: true,
      cause: { name: 'Error', message: 'boom' },
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.context?.details)).toBe(true);

    const details = result.context?.details as unknown as { cause?: object; } | undefined;
    expect(Object.isFrozen(details?.cause)).toBe(true);
  });

  it('обогащает context.details.cause при последовательных ошибках: second Error перезаписывает cause, сохраняя existing details', () => {
    const firstError = new Error('first');
    const secondError = new Error('second');

    const fallbackContextDetails = Object.freeze({ existing: true });
    const fallbackContext: BotErrorContext = {
      field: 'instruction',
      details: fallbackContextDetails,
    };

    const fallback = createFallback({
      category: 'integration',
      code: 'BOT_INTEGRATION_TIMEOUT',
      severity: 'high',
      context: fallbackContext,
    });

    const firstResult = mapBotErrorToUI(firstError, { fallback });
    const detailsAfterFirst = firstResult.context!.details;

    // Второй вызов использует результат первого вызова как fallback.
    // jsErrorRule должен сохранить existing details и перезаписать cause на новый Error.
    const secondResult = mapBotErrorToUI(secondError, { fallback: firstResult });

    expect(secondResult.context!.field).toBe('instruction');
    // details создаётся заново через spread + Object.freeze, поэтому reference будет другим.
    expect(secondResult.context!.details).not.toBe(detailsAfterFirst);

    // Содержимое должно соответствовать второму Error
    expect((secondResult.context!.details as any).existing).toBe(true);
    expect((secondResult.context!.details as any).cause).toEqual({
      name: 'Error',
      message: 'second',
    });

    // Первый результат не мутируется
    expect((detailsAfterFirst as any).existing).toBe(true);
    expect((detailsAfterFirst as any).cause).toEqual({ name: 'Error', message: 'first' });
  });

  it('распознаёт не-Error объект по name/message/stack (cross-realm guard) и обогащает пустой context', () => {
    const input = {
      name: 'CrossRealmError',
      message: 'x',
      stack: 'stack',
    };

    const fallback = createFallback({
      category: 'integration',
      code: 'BOT_INTEGRATION_TIMEOUT',
      severity: 'high',
    });

    const result = mapBotErrorToUI(input, { fallback });

    // jsErrorRule должен сматчиться через ветку "typeof stack === 'string'" (а не instanceof Error)
    expect(result.code).toBe('BOT_INTEGRATION_TIMEOUT');
    expect(result.context?.details).toMatchObject({
      cause: { name: 'CrossRealmError', message: 'x' },
    });
  });

  it('использует кастомные правила (с сортировкой по priority) и вызывает onAmbiguousMatch при нескольких матчах', () => {
    const input = { something: true } as const;

    const fallback = createFallback({
      category: 'policy',
      code: 'BOT_POLICY_ACTION_DENIED',
      severity: 'low',
      retryable: false,
    });

    const onAmbiguousMatch = vi.fn();

    const ruleHighPriority: MappingRule = {
      priority: 1,
      match: () => true,
      map: () =>
        Object.freeze({
          category: 'permission',
          code: 'BOT_PERMISSION_DENIED',
          severity: 'critical',
          retryable: getBotRetryable('BOT_PERMISSION_DENIED'),
        }),
    };

    const ruleLowerPriorityAlsoMatches: MappingRule = {
      priority: 2,
      match: () => true,
      map: () => createFallback(),
    };

    const ruleThirdAlsoMatches: MappingRule = {
      priority: 3,
      match: () => true,
      map: () =>
        createFallback({ code: 'BOT_POLICY_MODE_INVALID', category: 'policy', severity: 'low' }),
    };

    // Передаем правила в "плохом" порядке, чтобы проверить сортировку.
    const result = mapBotErrorToUI(input, {
      fallback,
      rules: [ruleThirdAlsoMatches, ruleLowerPriorityAlsoMatches, ruleHighPriority],
      onAmbiguousMatch,
    });

    expect(result.code).toBe('BOT_PERMISSION_DENIED');
    expect(onAmbiguousMatch).toHaveBeenCalledTimes(1);

    const [matchesArg, inputArg] = onAmbiguousMatch.mock.calls[0]!;
    expect(inputArg).toBe(input);
    expect(matchesArg).toHaveLength(3);
    expect(matchesArg[0]?.priority).toBe(1);
    expect(matchesArg[1]?.priority).toBe(2);
    expect(matchesArg[2]?.priority).toBe(3);
  });

  it('не вызывает onAmbiguousMatch, если совпало ровно одно правило', () => {
    const input = { a: 1 };
    const onAmbiguousMatch = vi.fn();

    const onlyRule: MappingRule = {
      priority: 1,
      match: () => true,
      map: () =>
        createFallback({ code: 'BOT_POLICY_ARCHIVED', category: 'policy', severity: 'medium' }),
    };

    const result = mapBotErrorToUI(input, {
      fallback: createFallback(),
      rules: [onlyRule],
      onAmbiguousMatch,
    });

    expect(result.code).toBe('BOT_POLICY_ARCHIVED');
    expect(onAmbiguousMatch).not.toHaveBeenCalled();
  });

  it('возвращает fallback, если ни одно правило не сматчилось', () => {
    const input = { a: 1 };
    const fallback = Object.freeze(
      createFallback({ category: 'webhook', code: 'BOT_WEBHOOK_FAILED', severity: 'high' }),
    );

    const neverRule: MappingRule = {
      priority: 1,
      match: () => false,
      map: () =>
        createFallback({ code: 'BOT_POLICY_MODE_INVALID', category: 'policy', severity: 'low' }),
    };

    const result = mapBotErrorToUI(input, { fallback, rules: [neverRule] });

    // В этом кейсе fallback уже frozen, но retryable может быть несогласован — normalizeFallback исправит.
    expect(result.category).toBe('webhook');
    expect(result.code).toBe('BOT_WEBHOOK_FAILED');
    expect(result.severity).toBe('high');
    expect(result.retryable).toBe(getBotRetryable('BOT_WEBHOOK_FAILED'));
  });

  it('нормализует BotError на входе (включая ранний return, если вход уже каноничен и frozen)', () => {
    const code = 'BOT_CHANNEL_CONNECTION_FAILED' as const;

    const input: BotError = Object.freeze({
      category: 'channel',
      code,
      severity: 'high',
      retryable: getBotRetryable(code),
    });

    const result = mapBotErrorToUI(input, { fallback: createFallback() });
    expect(result).toBe(input);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('нормализует BotError на входе (retryable не согласован): пересоздаёт BotError без context', () => {
    const code = 'BOT_CHANNEL_CONNECTION_FAILED' as const;

    const input: BotError = {
      category: 'channel',
      code,
      severity: 'high',
      // специально не совпадает с доменной политикой
      retryable: false,
    };

    const result = mapBotErrorToUI(input, { fallback: createFallback() });

    expect(Object.isFrozen(result)).toBe(true);
    expect(result.code).toBe(code);
    expect(result.retryable).toBe(getBotRetryable(code));
    expect('context' in result).toBe(false);
  });

  it('нормализует BotError на входе (retryable не согласован): пересоздаёт BotError с context', () => {
    const code = 'BOT_CHANNEL_CONNECTION_FAILED' as const;
    const context: BotErrorContext = { field: 'name', value: 'x' };

    const input: BotError = Object.freeze({
      category: 'channel',
      code,
      severity: 'high',
      retryable: false, // специально не совпадает
      context,
    });

    const result = mapBotErrorToUI(input, { fallback: createFallback() });

    expect(Object.isFrozen(result)).toBe(true);
    expect(result.retryable).toBe(getBotRetryable(code));
    expect(result.context).toEqual(context);
  });

  it('isBotError: короткое замыкание — код не string, поэтому не является BotError и возвращает fallback', () => {
    const fallback = createFallback();

    const result = mapBotErrorToUI(
      { code: 123, category: 'channel', severity: 'high', retryable: false } as any,
      { fallback },
    );

    expect(result.code).toBe(fallback.code);
  });

  it('isBotError: короткое замыкание — category невалидная, поэтому не является BotError', () => {
    const fallback = createFallback();

    const result = mapBotErrorToUI(
      {
        code: 'BOT_CHANNEL_CONNECTION_FAILED',
        category: 'unknown',
        severity: 'high',
        retryable: false,
      } as any,
      { fallback },
    );

    expect(result.code).toBe(fallback.code);
  });

  it('isBotError: короткое замыкание — severity невалидная, поэтому не является BotError', () => {
    const fallback = createFallback();

    const result = mapBotErrorToUI(
      {
        code: 'BOT_CHANNEL_CONNECTION_FAILED',
        category: 'channel',
        severity: 'unknown',
        retryable: false,
      } as any,
      { fallback },
    );

    expect(result.code).toBe(fallback.code);
  });

  it('isBotError: короткое замыкание — retryable не boolean, поэтому не является BotError', () => {
    const fallback = createFallback();

    const result = mapBotErrorToUI(
      {
        code: 'BOT_CHANNEL_CONNECTION_FAILED',
        category: 'channel',
        severity: 'high',
        retryable: 'nope',
      } as any,
      { fallback },
    );

    expect(result.code).toBe(fallback.code);
  });

  it('кэширует сортировку frozen rules: первый вызов считает, второй возвращает из WeakMap', () => {
    const fallback = createFallback();
    const rulesFrozen = Object.freeze([
      {
        priority: 2,
        match: () => false,
        map: () => fallback,
      },
      {
        priority: 1,
        match: () => false,
        map: () => fallback,
      },
    ]) satisfies readonly MappingRule[];

    const first = mapBotErrorToUI({ a: 1 }, { fallback, rules: rulesFrozen });
    const second = mapBotErrorToUI({ b: 2 }, { fallback, rules: rulesFrozen });

    expect(first.code).toBe(fallback.code);
    expect(second.code).toBe(fallback.code);
  });

  it('getNormalizedFallback: покрывает cached !== undefined при повторном нормализующем вызове frozen fallback', () => {
    const code = 'BOT_CHANNEL_CONNECTION_FAILED' as const;
    const fallback = Object.freeze({
      category: 'channel',
      code,
      severity: 'high',
      // специально не совпадает с доменной политикой
      retryable: false,
    }) satisfies BotError;

    const first = mapBotErrorToUI({ a: 1 }, { fallback });
    const second = mapBotErrorToUI({ b: 2 }, { fallback });

    expect(second).toBe(first); // cached возвращает тот же нормализованный объект
  });

  it('normalizeFallback: покрывает ветку "уже нормализован" через временную подмену getBotRetryable', async () => {
    vi.resetModules();
    const mockGetBotRetryable = vi
      .fn()
      // 1-й вызов ломает fast-path в getNormalizedFallback
      .mockImplementationOnce(() => false)
      // 2-й вызов делает условие true внутри normalizeFallback
      .mockImplementation(() => true);

    vi.doMock('../../../src/domain/BotRetry.js', () => ({
      getBotRetryable: mockGetBotRetryable,
    }));

    const { mapBotErrorToUI: mapBotErrorToUIIsolated } = await import(
      '../../../src/lib/error-mapper.js'
    );

    const code = 'BOT_CHANNEL_CONNECTION_FAILED' as const;
    const fallback = Object.freeze({
      category: 'channel',
      code,
      severity: 'high',
      retryable: true,
    }) satisfies BotError;

    const result = mapBotErrorToUIIsolated({ a: 1 }, { fallback });

    expect(result).toBe(fallback);
  });
});
