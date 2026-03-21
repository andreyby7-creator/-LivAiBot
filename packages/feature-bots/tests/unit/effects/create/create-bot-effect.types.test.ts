/**
 * @vitest-environment node
 */

import { describe, it } from 'vitest';

import type { CreateBotLikeHelpers } from '../../../../src/effects/create/create-bot.helpers.js';
import type {
  CreateBotEffectConfig,
  CreateBotEffectConfigTypes,
  CreateBotEffectInput,
  CreateBotEffectInputTypes,
  OperationEffectTypes,
} from '../../../../src/effects/create/create-bot-effect.types.js';

type Assert<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;

/** Ожидаемые ключи `base` (operationId опционален на уровне типа). */
type ExpectedBaseKeys = 'workspaceId' | 'request' | 'operationId';
/** Ожидаемые ключи `hooks` (опциональные колбэки). */
type ExpectedHooksKeys = 'onSuccess' | 'onError';

describe('create-bot-effect.types', () => {
  it('OperationEffectTypes: input/output/operation и readonly', () => {
    type Shape = OperationEffectTypes<{ a: 1; }, { b: 2; }, 'create'>;
    const _exact: Assert<
      Extends<Shape, Readonly<{ input: { a: 1; }; output: { b: 2; }; operation: 'create'; }>>
    > = true;
    const _inputKey: Assert<Extends<keyof Shape, 'input' | 'output' | 'operation'>> = true;
    void _exact;
    void _inputKey;
  });

  it('CreateBotEffectInputTypes: base содержит workspaceId, request, operationId?', () => {
    type Base = CreateBotEffectInputTypes['base'];
    const _hasWorkspace: Assert<Extends<'workspaceId', keyof Base>> = true;
    const _hasRequest: Assert<Extends<'request', keyof Base>> = true;
    const _hasOperationId: Assert<Extends<'operationId', keyof Base>> = true;
    const _noExtraKeys: Assert<Extends<keyof Base, ExpectedBaseKeys>> = true;
    const _allBaseKeys: Assert<Extends<ExpectedBaseKeys, keyof Base>> = true;
    void _hasWorkspace;
    void _hasRequest;
    void _hasOperationId;
    void _noExtraKeys;
    void _allBaseKeys;
  });

  it('CreateBotEffectInputTypes: hooks содержит onSuccess?, onError?', () => {
    type Hooks = CreateBotEffectInputTypes['hooks'];
    const _onSuccess: Assert<Extends<'onSuccess', keyof Hooks>> = true;
    const _onError: Assert<Extends<'onError', keyof Hooks>> = true;
    const _noExtraHookKeys: Assert<Extends<keyof Hooks, ExpectedHooksKeys>> = true;
    const _allHookKeys: Assert<Extends<ExpectedHooksKeys, keyof Hooks>> = true;
    void _onSuccess;
    void _onError;
    void _noExtraHookKeys;
    void _allHookKeys;
  });

  it('CreateBotEffectInput: совпадает с base & hooks', () => {
    const _input: Assert<
      Extends<
        CreateBotEffectInput,
        CreateBotEffectInputTypes['base'] & CreateBotEffectInputTypes['hooks']
      >
    > = true;
    const _reverse: Assert<
      Extends<
        CreateBotEffectInputTypes['base'] & CreateBotEffectInputTypes['hooks'],
        CreateBotEffectInput
      >
    > = true;
    void _input;
    void _reverse;
  });

  it('CreateBotEffectConfigTypes: порты, политики, ошибки, overrides, createHelpers', () => {
    type CT = CreateBotEffectConfigTypes;
    const _ports: Assert<
      Extends<
        CT['ports'],
        Readonly<{
          storePort: unknown;
          apiClient: unknown;
          auditPort: unknown;
          lifecycleHelper: unknown;
        }>
      >
    > = true;
    const _policies: Assert<
      Extends<CT['policies'], Readonly<{ botPolicy: unknown; botPermissions: unknown; }>>
    > = true;
    const _err: Assert<Extends<CT['errorHandling'], Readonly<{ mapErrorConfig: unknown; }>>> = true;
    const _overrides: Assert<
      Extends<CT['overrides'], Readonly<{ operationHandlers?: unknown; }>>
    > = true;
    const _helpers: Assert<
      Extends<CT['createHelpers'], Readonly<{ createBotLikeHelpers: CreateBotLikeHelpers; }>>
    > = true;
    void _ports;
    void _policies;
    void _err;
    void _overrides;
    void _helpers;
  });

  it('CreateBotEffectConfig: пересечение секций CreateBotEffectConfigTypes', () => {
    const _config: Assert<
      Extends<
        CreateBotEffectConfig,
        & CreateBotEffectConfigTypes['ports']
        & CreateBotEffectConfigTypes['policies']
        & CreateBotEffectConfigTypes['errorHandling']
        & CreateBotEffectConfigTypes['overrides']
        & CreateBotEffectConfigTypes['createHelpers']
      >
    > = true;
    const _flattened: Assert<
      Extends<
        CreateBotEffectConfig,
        & CreateBotEffectConfigTypes['ports']
        & CreateBotEffectConfigTypes['policies']
        & CreateBotEffectConfigTypes['errorHandling']
        & CreateBotEffectConfigTypes['overrides']
        & CreateBotEffectConfigTypes['createHelpers']
      >
    > = true;
    void _config;
    void _flattened;
  });
});
