/**
 * @file Unit tests for api-schema-guard.ts with mocked runtime internals
 *
 * Purpose:
 * - Cover the (otherwise unreachable) continuation branch in validateSchemaVersion:
 *   `Effect.flatMap(createApiValidationError(...), () => Effect.succeed(undefined))`
 *   because the real factory returns Effect.fail and flatMap never runs the success continuation.
 */

import { Effect, Runtime } from 'effect';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/input-boundary/api-validation-runtime.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/input-boundary/api-validation-runtime.js')
  >(
    '../../src/input-boundary/api-validation-runtime.js',
  );

  return {
    ...actual,
    // createApiValidationErrorFactory() used by api-schema-guard should return a function
    // that succeeds (not fails) so validateSchemaVersion's flatMap continuation is executed.
    createApiValidationErrorFactory: () => () => Effect.succeed(undefined),
  };
});

// import after mock
import type { ApiValidationContext } from '../../src/input-boundary/api-schema-guard.js';
import { validateSchemaVersion } from '../../src/input-boundary/api-schema-guard.js';

describe('api-schema-guard — validateSchemaVersion (mocked runtime)', () => {
  it('в mismatch-ветке возвращает success, когда runtime error factory возвращает succeed', async () => {
    const telemetry = { onWarning: vi.fn() };

    const ctx: ApiValidationContext = {
      method: 'GET',
      endpoint: '/test' as any,
      requestId: 'req-1',
      service: 'AUTH',
      telemetry,
    };

    await Runtime.runPromise(Runtime.defaultRuntime, validateSchemaVersion('v3', ['v1'], ctx));

    expect(telemetry.onWarning).toHaveBeenCalled();
  });
});
