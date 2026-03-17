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

    const result = mapBotErrorToUI('anything', { fallback });

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
});
