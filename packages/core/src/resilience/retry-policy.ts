/**
 * @file packages/core/src/resilience/retry-policy.ts
 * ============================================================================
 * 🛡️ CORE / RESILIENCE — Retry Policy Primitive
 * ============================================================================
 *
 * Архитектурная роль:
 * - Generic примитив надёжности: типизированная политика retryability.
 * - Единый контракт для feature-пакетов: deterministic lookup без if/else.
 *
 * Принципы:
 * - ✅ SRP: только retry-policy контракт и helper
 * - ✅ Deterministic: один ключ → одно значение
 * - ✅ Domain-pure: без side-effects и transport деталей
 * - ✅ Extensible: новые домены/feature расширяются без изменения core-логики
 */

/**
 * Политика ретраев для дискретного набора кодов/типов (например error codes).
 *
 * ВАЖНО: параметр T должен быть controlled типом:
 * - exhaustive union / enum-подобные строковые литералы (например AuthErrorType);
 * - НЕ произвольный `string`, иначе TypeScript не сможет гарантировать полноту политики.
 */
export type RetryPolicy<T extends string> = Readonly<Record<T, boolean>>;

/**
 * Создаёт строго типизированную retry-policy.
 *
 * Рекомендуемый паттерн:
 * - объявить union-тип для кодов ошибок: `type MyErrorType = 'a' | 'b' | ...`;
 * - создать литерал политики: `const MyPolicy = createRetryPolicy<MyErrorType>({ ... } as const);`
 * - при необходимости завернуть lookup в helper: `getRetryable(error: MyErrorType) => MyPolicy[error]`.
 */
export function createRetryPolicy<T extends string>(
  policy: Record<T, boolean>,
): RetryPolicy<T> {
  return policy;
}

/**
 * Мерж двух retry-политик: override переопределяет base.
 * Полезно для cross-feature правил и локальных overrides поверх глобальной политики.
 */
export function mergeRetryPolicies<T extends string>(
  base: RetryPolicy<T>,
  override: Partial<RetryPolicy<T>>,
): RetryPolicy<T> {
  return { ...base, ...override } as const satisfies RetryPolicy<T>;
}

/**
 * Безопасный lookup helper: типобезопасно возвращает retryable-флаг для ключа.
 * Удобен в feature-пакетах, чтобы не обращаться к policy напрямую.
 */
export const getRetryable = <T extends string>(
  policy: RetryPolicy<T>,
  key: T,
): boolean => policy[key];
