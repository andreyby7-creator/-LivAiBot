/**
 * @file packages/feature-bots/src/effects/shared/orchestrator-runtime.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Orchestrator Runtime (hooks, audit meta, time/id ports)
 * ============================================================================
 *
 * Общий слой для bot-оркестраторов: best-effort hooks, пара `eventId` + `timestamp` для audit,
 * минимальные DI-порты времени и генерации id. Без `Date.now()` / `Math.random` внутри фабрик —
 * только делегирование в инжектированные `clock` и `eventIdGenerator`.
 */

/* ============================================================================
 * 🧭 TYPES — CLOCK, EVENT ID, AUDIT META
 * ============================================================================
 */

/** Единственный источник timestamp для audit (epoch-ms). */
export type ClockPort = {
  now(): number;
};

/**
 * Генерация строкового `eventId` для audit-событий (в тестах подменяется детерминированно).
 *
 * @remarks
 * Этот модуль **не** гарантирует уникальность, формат (UUID/ULID/инкремент) и криптостойкость —
 * только контракт вызова `next()`. Уникальность, коллизии и выбор алгоритма — ответственность
 * инжектированной реализации (composition root / адаптер).
 */
export type EventIdGeneratorPort = {
  next(): string;
};

export type AuditMetaPort = Readonly<{
  /**
   * Возвращает следующую пару полей для audit payload: `eventId` + `timestamp`.
   * Имя метода отражает семантику (не «очередь» абстрактно, а именно meta для audit).
   */
  readonly nextAuditMeta: () => Readonly<{ readonly eventId: string; readonly timestamp: number; }>;
}>;

/* ============================================================================
 * 🏭 FACTORIES — AUDIT META
 * ============================================================================
 */

/**
 * Фабрика audit-meta: только `clock.now()` и `eventIdGenerator.next()` (никаких fallback).
 *
 * @remarks
 * Порты читаются из `deps` один раз при создании; замыкание держит стабильные ссылки на `clock` и
 * `eventIdGenerator`, даже если объект `deps` позже мутируют снаружи (антипаттерн).
 */
export function createAuditMetaPort(
  deps: Readonly<{
    readonly clock: ClockPort;
    readonly eventIdGenerator: EventIdGeneratorPort;
  }>,
): AuditMetaPort {
  const { clock, eventIdGenerator } = deps;
  return Object.freeze({
    nextAuditMeta: (): Readonly<{ readonly eventId: string; readonly timestamp: number; }> =>
      Object.freeze({
        eventId: eventIdGenerator.next(),
        timestamp: clock.now(),
      }),
  });
}

/* ============================================================================
 * 🪝 HOOKS — BEST-EFFORT WRAPPER
 * ============================================================================
 */

export type WrapBestEffortHookOptions = Readonly<{
  /**
   * Вызывается при исключении из user-hook (например логгер/telemetry в dev).
   * По умолчанию ошибка не наблюдаема снаружи — см. {@link wrapBestEffortHook}.
   */
  readonly onError?: (error: unknown) => void;
}>;

/**
 * Оборачивает hook так, чтобы исключения из пользовательского callback не пробрасывались наружу
 * и не ломали основной flow оркестратора.
 *
 * @remarks
 * **Осознанный trade-off:** ошибки в hook (в т.ч. сбой «вспомогательного» audit/telemetry внутри
 * callback) **полностью поглощаются** — иначе побочный наблюдаемостный код мог бы ломать
 * детерминированный бизнес-flow. Для отладки передайте {@link WrapBestEffortHookOptions.onError}.
 */
export function wrapBestEffortHook<T>(
  hook?: ((value: T) => void) | undefined,
  options?: WrapBestEffortHookOptions | undefined,
): ((value: T) => void) | undefined {
  if (hook === undefined) return undefined;
  const onError = options?.onError;
  return (value: T): void => {
    try {
      hook(value);
    } catch (err: unknown) {
      // Hooks best-effort: не ломаем основной flow; наблюдаемость — только через onError.
      onError?.(err);
    }
  };
}
