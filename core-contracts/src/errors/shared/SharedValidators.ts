/**
 * @file SharedValidators.ts
 *
 * Валидаторы shared-инвариантов и архитектурные invariants.
 * Проверка domain и infra ошибок, контроль namespace SHARED_.
 *
 * Принципы:
 *  - ❌ domain error с infra code
 *  - ❌ shared error без namespace SHARED_
 *  - ❌ утечка service-specific metadata
 *  - ✅ validateSharedDomain(), validateSharedInfra()
 *  - интеграция с базовыми ErrorValidators
 */

import { Effect } from 'effect';

import type { BaseError } from '../base/BaseError.js';

export type SharedValidationError = {
  readonly code: string;
  readonly reason: string;
  readonly meta?: Record<string, unknown>;
};

/** Проверка domain-инвариантов для shared errors */
export function validateSharedDomain(error: BaseError): SharedValidationError {
  if (!error.code.startsWith('SHARED_')) {
    return {
      code: 'SHARED_INVALID_DOMAIN',
      reason: `Domain error должен иметь SHARED_ namespace, найдено: ${error.code}`,
      meta: { originalCode: error.code },
    };
  }

  if (error.code.startsWith('SHARED_INFRA_')) {
    return {
      code: 'SHARED_INVALID_DOMAIN',
      reason: `Domain error не может быть infra code: ${error.code}`,
      meta: { originalCode: error.code },
    };
  }

  return { code: error.code, reason: error.message, meta: error.metadata };
}

/** Проверка infra-инвариантов для shared errors */
export function validateSharedInfra(error: BaseError): SharedValidationError {
  if (!error.code.startsWith('SHARED_INFRA_')) {
    return {
      code: 'SHARED_INVALID_INFRA',
      reason: `Infra error должен иметь SHARED_INFRA_ namespace, найдено: ${error.code}`,
      meta: { originalCode: error.code },
    };
  }

  return { code: error.code, reason: error.message, meta: error.metadata };
}

/** Effect-обертка для проверки domain-invariants */
export function effectValidateSharedDomain<A>(
  effect: Effect.Effect<A, BaseError>,
): Effect.Effect<A, SharedValidationError> {
  return Effect.catchAll(effect, (err) => Effect.fail(validateSharedDomain(err)));
}

/** Effect-обертка для проверки infra-invariants */
export function effectValidateSharedInfra<A>(
  effect: Effect.Effect<A, BaseError>,
): Effect.Effect<A, SharedValidationError> {
  return Effect.catchAll(effect, (err) => Effect.fail(validateSharedInfra(err)));
}

/** Универсальная функция проверки shared ошибок */
export function validateSharedError(error: BaseError): SharedValidationError {
  return error.code.startsWith('SHARED_INFRA_')
    ? validateSharedInfra(error)
    : validateSharedDomain(error);
}
