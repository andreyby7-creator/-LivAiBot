/**
 * @vitest-environment node
 */

import { describe, it } from 'vitest';

import type {
  CreateBotEffectConfig,
  CreateBotEffectConfigTypes,
  CreateBotEffectInput,
  CreateBotEffectInputTypes,
  OperationEffectTypes,
} from '../../../../src/effects/create/create-bot-effect.types.js';

type Assert<T extends true> = T;
type Extends<A, B> = A extends B ? true : false;

describe('create-bot-effect.types', () => {
  it('OperationEffectTypes: хранит input/output/operation', () => {
    type Shape = OperationEffectTypes<{ a: 1; }, { b: 2; }, 'create'>;
    const _shape: Assert<
      Extends<Shape, { input: { a: 1; }; output: { b: 2; }; operation: 'create'; }>
    > = true;
    void _shape;
  });

  it('CreateBotEffectInputTypes: содержит base и hooks', () => {
    const _inputTypes: Assert<
      Extends<CreateBotEffectInputTypes, { base: object; hooks: object; }>
    > = true;
    void _inputTypes;
  });

  it('CreateBotEffectInput: объединяет base + hooks', () => {
    const _input: Assert<
      Extends<
        CreateBotEffectInput,
        CreateBotEffectInputTypes['base'] & CreateBotEffectInputTypes['hooks']
      >
    > = true;
    void _input;
  });

  it('CreateBotEffectConfigTypes/CreateBotEffectConfig: согласованы по разделам DI', () => {
    const _configTypes: Assert<
      Extends<
        CreateBotEffectConfigTypes,
        { ports: object; policies: object; errorHandling: object; overrides: object; }
      >
    > = true;

    const _config: Assert<
      Extends<
        CreateBotEffectConfig,
        & CreateBotEffectConfigTypes['ports']
        & CreateBotEffectConfigTypes['policies']
        & CreateBotEffectConfigTypes['errorHandling']
        & CreateBotEffectConfigTypes['overrides']
      >
    > = true;

    void _configTypes;
    void _config;
  });
});
