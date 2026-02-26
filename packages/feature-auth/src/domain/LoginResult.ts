/**
 * @file packages/feature-auth/src/domain/LoginResult.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Domain-Level Login Result
 * ============================================================================
 *
 * Архитектурная роль:
 * - Domain-level тип результата login-flow
 * - Immutable discriminated union для type-safe branching
 * - Используется в effects/login.ts для оркестрации
 * - Semantic layer без transport concerns
 * - Чистый domain-тип без zod-артефактов и DTO-зависимостей
 *
 * Принципы:
 * - ❌ Нет бизнес-логики (только типы)
 * - ❌ Нет transport-level типов (только domain-типы)
 * - ❌ Нет zod-схем и DTO-артефактов
 * - ✅ Discriminated union для type-safe branching
 * - ✅ Readonly для immutability
 * - ✅ Fail-closed: строгая типизация без partial состояний
 * - ✅ Extensible: готов к добавлению новых веток
 *
 * @version 1
 */

import type { MeResponse } from './MeResponse.js';
import type { MfaChallengeRequest } from './MfaChallengeRequest.js';
import type { TokenPair } from './TokenPair.js';

/* ============================================================================
 * 🎯 DOMAIN LOGIN RESULT (Immutable Discriminated Union)
 * ============================================================================
 */

/**
 * Domain-level результат login-flow.
 *
 * Представляет discriminated union двух возможных исходов:
 * - `success`: успешный login с токенами и данными пользователя
 * - `mfa_required`: требуется MFA-верификация (future extension)
 *
 * @remarks
 * Все поля readonly для immutability. Использует чистые domain-типы
 * (`TokenPair`, `MeResponse`, `MfaChallengeRequest`) без transport-зависимостей.
 *
 * Fail-closed поведение: success-ветка гарантированно содержит оба поля
 * (`tokenPair` и `me`), никаких partial состояний.
 *
 * Отличается от `LoginResponseDto` (types/login.dto.ts):
 * - `LoginResponseDto` — feature-level, использует transport-типы из schemas (`LoginTokenPairValues`, `MeResponseValues`, `MfaChallengeRequestValues`)
 * - `DomainLoginResult` — domain-level, использует чистые domain-типы (`TokenPair`, `MeResponse`, `MfaChallengeRequest`)
 * - Transport ↔ domain mapping должен быть явным и типобезопасным через mapper-функции
 *
 * @public
 */
export type DomainLoginResult =
  | {
    readonly type: 'success';
    readonly tokenPair: Readonly<TokenPair>;
    readonly me: Readonly<MeResponse>;
  }
  | {
    readonly type: 'mfa_required';
    readonly challenge: Readonly<MfaChallengeRequest>;
  };

/* ============================================================================
 * ✅ EXHAUSTIVENESS HELPER
 * ========================================================================== */

/**
 * Утилита для проверки исчерпывающего разбора union-типов.
 *
 * Используется в switch по `DomainLoginResult` для fail-closed поведения:
 * если появляется новая ветка union-типа и не обрабатывается явно,
 * TypeScript подсветит использование `assertNever` как ошибку компиляции.
 *
 * @param x - Значение типа `never` (неожиданный вариант union-типа)
 * @throws Error Если в рантайме передан неожиданный вариант union-типа
 */
/* eslint-disable fp/no-throw -- Намеренное исключение для защиты от некорректного состояния */
export function assertNever(x: never): never {
  throw new Error(`Unexpected DomainLoginResult variant: ${JSON.stringify(x)}`);
}
/* eslint-enable fp/no-throw */
