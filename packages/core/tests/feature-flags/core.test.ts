import { describe, expect, it, vi } from 'vitest';

import type {
  FeatureContext,
  FeatureFlagDefinition,
  FeatureFlagName,
  FeatureFlagProvider,
} from '../../src/feature-flags/core.js';
import {
  alwaysOff,
  alwaysOn,
  and,
  createInMemoryFeatureFlagProvider,
  enabledForAttribute,
  enabledForTenants,
  enabledForUsers,
  evaluateFeature,
  evaluateFeatures,
  freezeContext,
  getGlobalFeatureFlagLogger,
  isFeatureEnabled,
  not,
  or,
  percentageRollout,
  setGlobalFeatureFlagLogger,
} from '../../src/feature-flags/core.js';

const SERVICE = 'AUTH' as const;

const FLAG_A = 'AUTH_flagA' as const satisfies FeatureFlagName;
const FLAG_B = 'AUTH_flagB' as const satisfies FeatureFlagName;
const FLAG_C = 'AUTH_flagC' as const satisfies FeatureFlagName;
const FLAG_D = 'AUTH_flagD' as const satisfies FeatureFlagName;

function makeFlag(
  name: FeatureFlagName,
  overrides: Partial<FeatureFlagDefinition> = {},
): FeatureFlagDefinition {
  return {
    name,
    description: `desc:${name}`,
    default: false,
    service: SERVICE,
    ...overrides,
  };
}

describe('feature-flags/core.ts — strategies', () => {
  it('alwaysOn / alwaysOff', () => {
    expect(alwaysOn({})).toBe(true);
    expect(alwaysOff({})).toBe(false);
  });

  it('enabledForUsers работает с array и Set', () => {
    const viaArray = enabledForUsers(['u1']);
    expect(viaArray({ userId: 'u1' })).toBe(true);
    expect(viaArray({ userId: 'u2' })).toBe(false);
    expect(viaArray({})).toBe(false);

    const viaSet = enabledForUsers(new Set(['u3']));
    expect(viaSet({ userId: 'u3' })).toBe(true);
    expect(viaSet({ userId: 'u2' })).toBe(false);
  });

  it('enabledForTenants работает с array и Set', () => {
    const viaArray = enabledForTenants(['t1']);
    expect(viaArray({ tenantId: 't1' })).toBe(true);
    expect(viaArray({ tenantId: 't2' })).toBe(false);
    expect(viaArray({})).toBe(false);

    const viaSet = enabledForTenants(new Set(['t3']));
    expect(viaSet({ tenantId: 't3' })).toBe(true);
    expect(viaSet({ tenantId: 't2' })).toBe(false);
  });

  it('enabledForAttribute поддерживает известные и кастомные атрибуты', () => {
    const byKnown = enabledForAttribute('environment', ['production']);
    expect(byKnown({ attributes: { environment: 'production' } })).toBe(true);
    expect(byKnown({ attributes: { environment: 'staging' } })).toBe(false);
    expect(byKnown({})).toBe(false);

    const byCustom = enabledForAttribute('customField', [true]);
    expect(byCustom({ attributes: { customField: true } })).toBe(true);
    expect(byCustom({ attributes: { customField: false } })).toBe(false);
  });

  it('percentageRollout: clamp, key switch, meta default, и логирование при отсутствии id', () => {
    // clamp <=0 => alwaysOff
    expect(percentageRollout(-10)({ userId: 'u' })).toBe(false);
    expect(percentageRollout(0)({ userId: 'u' })).toBe(false);

    // clamp >=100 => alwaysOn
    expect(percentageRollout(100)({ userId: 'u' })).toBe(true);
    expect(percentageRollout(1000)({ userId: 'u' })).toBe(true);

    // meta default path (meta undefined => 'rollout')
    const mid = percentageRollout(50);
    const ctx: FeatureContext = { userId: 'u-mid' };
    expect(typeof mid(ctx)).toBe('boolean');

    // key switch: tenantId
    const byTenant = percentageRollout(50, 'tenantId');
    expect(typeof byTenant({ tenantId: 't-mid' }, { name: FLAG_A })).toBe('boolean');

    // missing id path without global logger
    const midMissingId = percentageRollout(50);
    expect(midMissingId({})).toBe(false);

    // missing id path with global logger
    const logger = vi.fn();
    setGlobalFeatureFlagLogger(logger);
    expect(getGlobalFeatureFlagLogger()).toBe(logger);
    expect(midMissingId({})).toBe(false);
    expect(logger).toHaveBeenCalledWith(
      'percentageRollout: userId is undefined in context, returning false',
    );
  });

  it('and/or/not: прокидывают meta и корректно short-circuit', () => {
    const s1 = vi.fn((_ctx: FeatureContext, meta) => meta?.name === FLAG_A);
    const s2False = vi.fn(() => false);

    expect(and(s1, s2False)({}, { name: FLAG_A })).toBe(false);
    expect(s1).toHaveBeenCalledWith({}, { name: FLAG_A });
    expect(s2False).toHaveBeenCalledWith({}, { name: FLAG_A });

    const s2True = vi.fn(() => true);
    const s3Never = vi.fn(() => false);
    expect(or(s2True, s3Never)({}, { name: FLAG_B })).toBe(true);
    // `some` short-circuit: второй strategy не должен быть вызван
    expect(s3Never).not.toHaveBeenCalled();

    expect(not(alwaysOn)({}, { name: FLAG_C })).toBe(false);
  });
});

describe('feature-flags/core.ts — freezeContext', () => {
  it('замораживает ctx и attributes (и возвращает тот же объект если уже frozen)', () => {
    const ctx1: FeatureContext = { userId: 'u', attributes: { locale: 'ru', custom: true } };
    const frozen1 = freezeContext(ctx1);
    expect(Object.isFrozen(frozen1)).toBe(true);
    expect(Object.isFrozen(frozen1.attributes!)).toBe(true);

    const ctx2: FeatureContext = Object.freeze({ userId: 'u2' });
    const frozen2 = freezeContext(ctx2);
    expect(frozen2).toBe(ctx2);
  });
});

describe('feature-flags/core.ts — evaluation API', () => {
  it('in-memory provider: snapshot возвращает frozen массив', async () => {
    const mkProvider = createInMemoryFeatureFlagProvider;
    const provider = mkProvider([
      makeFlag(FLAG_A, { default: true, strategy: null }),
    ]);
    const snapshot = await provider.snapshot?.();
    expect(snapshot).toBeDefined();
    expect(Object.isFrozen(snapshot!)).toBe(true);
    expect(snapshot).toHaveLength(1);
    expect(snapshot?.[0]?.name).toBe(FLAG_A);
  });

  it('DI logger: explicit logger имеет приоритет над global logger (и userId fallback unknown)', async () => {
    const globalLogger = vi.fn();
    setGlobalFeatureFlagLogger(globalLogger);

    const explicitLogger = vi.fn();
    const err = new Error('boom');

    const provider: FeatureFlagProvider = {
      getFlag: async () =>
        makeFlag(FLAG_A, {
          strategy: () => {
            throw err;
          },
        }),
    };

    const r1 = await evaluateFeature(provider, FLAG_A, { userId: 'u-explicit' }, explicitLogger);
    expect(r1.reason).toBe('STRATEGY');
    expect(r1.value).toBe(false);
    expect(explicitLogger).toHaveBeenCalledWith(
      'Feature flag strategy error for userId=u-explicit',
      err,
    );
    expect(globalLogger).not.toHaveBeenCalled();

    explicitLogger.mockClear();
    const r2 = await evaluateFeature(provider, FLAG_A, {}, explicitLogger);
    expect(r2.reason).toBe('STRATEGY');
    expect(r2.value).toBe(false);
    expect(explicitLogger).toHaveBeenCalledWith(
      'Feature flag strategy error for userId=unknown',
      err,
    );
  });

  it('без DI logger и без global logger (fresh module) проходит ветку globalLogger === undefined', async () => {
    vi.resetModules();
    const fresh = await import('../../src/feature-flags/core.js');

    // В свежем модуле global logger не установлен (undefined), поэтому ветка if (globalLogger) не срабатывает.
    const provider: FeatureFlagProvider = {
      getFlag: async () =>
        makeFlag(FLAG_A, {
          strategy: () => {
            throw new Error('boom');
          },
        }),
    };

    const r = await fresh.evaluateFeature(provider, FLAG_A, {});
    expect(r.reason).toBe('STRATEGY');
    expect(r.value).toBe(false);
  });

  it('evaluateFeature: NOT_FOUND / DEFAULT / STRATEGY / ERROR', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2020-01-01T00:00:00.000Z'));

    const providerNotFound: FeatureFlagProvider = {
      getFlag: async () => undefined,
    };
    await expect(evaluateFeature(providerNotFound, FLAG_A, {})).resolves.toEqual({
      name: FLAG_A,
      value: false,
      reason: 'NOT_FOUND',
      timestamp: Date.now(),
    });

    const providerDefault: FeatureFlagProvider = {
      getFlag: async () => makeFlag(FLAG_A, { default: true, strategy: null }),
    };
    const rDefault = await evaluateFeature(providerDefault, FLAG_A, {});
    expect(rDefault.reason).toBe('DEFAULT');
    expect(rDefault.value).toBe(true);
    expect(rDefault.flag?.name).toBe(FLAG_A);

    const providerStrategy: FeatureFlagProvider = {
      getFlag: async () =>
        makeFlag(FLAG_A, {
          strategy: (ctx, meta) => ctx.userId === 'u' && meta?.name === FLAG_A,
          version: 1,
        }),
    };
    const rStrategy = await evaluateFeature(providerStrategy, FLAG_A, { userId: 'u' });
    expect(rStrategy).toEqual({
      name: FLAG_A,
      value: true,
      reason: 'STRATEGY',
      flag: expect.objectContaining({ name: FLAG_A }),
      timestamp: Date.now(),
    });

    const providerError: FeatureFlagProvider = {
      getFlag: async () => {
        throw new Error('boom');
      },
    };
    const rError = await evaluateFeature(providerError, FLAG_A, {});
    expect(rError.reason).toBe('ERROR');
    expect(rError.value).toBe(false);

    vi.useRealTimers();
  });

  it('isFeatureEnabled возвращает value из evaluateFeature', async () => {
    const provider: FeatureFlagProvider = {
      getFlag: async () => makeFlag(FLAG_A, { default: true, strategy: null }),
    };
    await expect(isFeatureEnabled(provider, FLAG_A, {})).resolves.toBe(true);
  });

  it('evaluateFeature: safeExecuteStrategy ловит исключение, логирует (global logger) и возвращает false', async () => {
    const globalLogger = vi.fn();
    setGlobalFeatureFlagLogger(globalLogger);

    const provider: FeatureFlagProvider = {
      getFlag: async () =>
        makeFlag(FLAG_A, {
          strategy: () => {
            throw new Error('strategy failed');
          },
        }),
    };
    const r = await evaluateFeature(provider, FLAG_A, { userId: 'u-err' });
    expect(r.reason).toBe('STRATEGY');
    expect(r.value).toBe(false);
    expect(globalLogger).toHaveBeenCalled();
  });

  it('evaluateFeatures: ветки с provider.getFlags и без него + evaluateFromMap ветки', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2021-01-01T00:00:00.000Z'));

    const flags: readonly FeatureFlagDefinition[] = [
      makeFlag(FLAG_A, { default: true, strategy: null }),
      makeFlag(FLAG_B, { strategy: alwaysOn, version: 2 }),
      makeFlag(FLAG_C, {
        strategy: () => {
          throw new Error('boom');
        },
      }),
    ];
    const mkProvider = createInMemoryFeatureFlagProvider;
    const providerWithGetFlags = mkProvider(flags);

    // provider.getFlags branch + evaluateFromMap: NOT_FOUND/DEFAULT/STRATEGY + strategy-throw
    const names = [FLAG_A, FLAG_B, FLAG_C, FLAG_D] as const;
    const ctx: FeatureContext = { userId: 'u', attributes: { environment: 'test' } };
    const results1 = await evaluateFeatures(providerWithGetFlags, names, ctx);
    expect(Object.isFrozen(results1)).toBe(true);
    expect(results1.find((r) => r.name === FLAG_D)?.reason).toBe('NOT_FOUND');
    expect(results1.find((r) => r.name === FLAG_A)?.reason).toBe('DEFAULT');
    expect(results1.find((r) => r.name === FLAG_B)?.reason).toBe('STRATEGY');
    expect(results1.find((r) => r.name === FLAG_C)?.reason).toBe('STRATEGY');
    expect(results1.find((r) => r.name === FLAG_C)?.value).toBe(false);

    // no getFlags branch: Promise.all(evaluateFeature)
    const providerWithoutGetFlags: FeatureFlagProvider = {
      getFlag: providerWithGetFlags.getFlag,
    };
    const frozenCtx = Object.freeze({ userId: 'u2' } satisfies FeatureContext);
    const results2 = await evaluateFeatures(providerWithoutGetFlags, [FLAG_B], frozenCtx);
    expect(Object.isFrozen(results2)).toBe(true);
    expect(results2[0]?.reason).toBe('STRATEGY');

    vi.useRealTimers();
  });
});
