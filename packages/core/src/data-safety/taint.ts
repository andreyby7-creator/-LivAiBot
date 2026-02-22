/**
 * @file packages/core/src/data-safety/taint.ts
 * ============================================================================
 * 🛡️ CORE — Data Safety (Taint Tracking)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Система отслеживания "загрязнения" данных для boundary guards и taint isolation
 * - Taint = метаданные о небезопасности данных, распространяющиеся через pipeline
 * - Причина изменения: data safety, boundary guards, taint isolation
 *
 * Принципы:
 * - ✅ SRP: разделение на BRANDED TYPE, TYPES, CONSTANTS, HELPERS, API
 * - ✅ Deterministic: immutable taint metadata, pure functions для проверки и распространения
 * - ✅ Domain-pure: generic по типам значений, без привязки к domain-специфичным типам
 * - ✅ Extensible: поддержка custom taint sources через taintSources registry
 * - ✅ Strict typing: branded types для TaintSource, union types для TaintMetadata
 * - ✅ Microservice-ready: stateless, immutable metadata, thread-safe registry
 * - ✅ Security: immutable taint metadata (запрещена мутация после создания), независимость от TrustLevel
 *
 * ⚠️ ВАЖНО:
 * - ❌ ЗАПРЕЩЕНО: мутация taint metadata после создания
 * - ✅ РАЗРЕШЕНО: isTainted(), stripTaint(), propagateTaint(), assertTrusted()
 * - Taint и TrustLevel независимы: данные могут быть одновременно tainted и trusted
 * - ⚠️ PRODUCTION: Инициализируйте registry на старте (не на горячем пути). Registry после build() immutable и thread-safe.
 */

import type { TrustLevel, TrustLevelRegistry } from './trust-level.js';
import { defaultTrustLevelRegistry, dominates, meetTrust, trustLevels } from './trust-level.js';

/* ============================================================================
 * 1. BRANDED TYPE — TAINT SOURCE (Type Safety)
 * ============================================================================
 */

/** Brand для TaintSource (защита от создания извне) */
declare const TaintSourceBrand: unique symbol;

/** Базовый тип источника taint (без brand) */
type TaintSourceBase = symbol;

/** Источники taint (откуда пришли небезопасные данные) */
export const taintSources = {
  /** Внешний источник (API, пользовательский ввод) */
  EXTERNAL: Symbol('EXTERNAL'),
  /** Плагин (ненадежный код) */
  PLUGIN: Symbol('PLUGIN'),
  /** Неизвестный источник */
  UNKNOWN: Symbol('UNKNOWN'),
} as const satisfies Record<string, TaintSourceBase>;

/** Тип источника taint (branded union type) */
export type TaintSource = (typeof taintSources)[keyof typeof taintSources] & {
  readonly [TaintSourceBrand]: true;
};

/** Метаданные taint для отслеживания загрязнения данных (immutable) */
export type TaintMetadata = Readonly<{
  /** Источник taint (откуда пришли небезопасные данные) */
  readonly source: TaintSource;
  /** Уровень доверия на момент создания taint */
  readonly trustLevel: TrustLevel;
  /** Timestamp создания taint (опционально, для аудита) */
  readonly timestamp?: number;
}>;

/** Значение с taint metadata (tainted data) */
export type Tainted<T> = T & {
  readonly __taint: TaintMetadata;
};

/* ============================================================================
 * 2. TYPES — TAINT MODEL (Pure Type Definitions)
 * ============================================================================
 */

/**
 * Pipeline slot — контейнер для значения в pipeline execution graph
 * @template T - Тип значения в slot
 * @note Используется для передачи данных между шагами pipeline с поддержкой taint tracking
 * @public
 */
export type Slot<T = unknown> = Readonly<{
  /** Значение в slot (может быть tainted или trusted) */
  readonly value: T;
  /** Опциональные метаданные slot (для будущего расширения) */
  readonly metadata?: Readonly<Record<string, unknown>>;
}>;

/* ============================================================================
 * 3. REGISTRY — TAINT SOURCE REGISTRY (Immutable Registry)
 * ============================================================================
 */

/** Immutable registry источников taint (O(1) операции) */
export type TaintSourceRegistry = Readonly<{
  /** Порядок источников по строгости (readonly array) */
  readonly order: readonly TaintSource[];
  /** Map для O(1) lookup индексов */
  readonly orderIndexMap: ReadonlyMap<TaintSource, number>;
  /** Map для получения имени источника (для отладки) */
  readonly sourceNames: ReadonlyMap<TaintSource, string>;
  /** Map для O(1) проверки дубликатов имён */
  readonly nameToSourceMap: ReadonlyMap<string, TaintSource>;
}>;

/** Внутреннее состояние Builder (immutable) */
type TaintSourceRegistryBuilderState = Readonly<{
  readonly sources: readonly Readonly<{ source: TaintSource; name: string; }>[];
}>;

/**
 * Builder для создания immutable TaintSourceRegistry
 * Порядок добавления определяет порядок строгости (первый = наименее строгий).
 */
export type TaintSourceRegistryBuilder = Readonly<{
  readonly withSource: (source: TaintSource, name: string) => TaintSourceRegistryBuilder;
  readonly build: () => TaintSourceRegistry;
}>;

/**
 * Создает Builder для TaintSourceRegistry
 * @note ⚠️ PRODUCTION: Инициализируйте на старте, не на горячем пути!
 *       Builder НЕ thread-safe, но registry после build() полностью thread-safe.
 * @public
 */
export function createTaintSourceRegistry(): TaintSourceRegistryBuilder { // Builder для создания registry
  const state: TaintSourceRegistryBuilderState = { sources: [] };
  return createBuilderFromState(state);
}

/**
 * Проверяет дубликаты источника taint
 *
 * @internal
 */
function validateSource(
  state: TaintSourceRegistryBuilderState,
  source: TaintSource,
  name: string,
): void {
  const existingSource = state.sources.find((s) => s.source === source);
  if (existingSource) {
    // eslint-disable-next-line fp/no-throw
    throw new Error(
      `TaintSource уже добавлен в registry: ${existingSource.name} (${source.toString()})`,
    );
  }

  const existingName = state.sources.find((s) => s.name === name);
  if (existingName) {
    // eslint-disable-next-line fp/no-throw
    throw new Error(
      `Имя источника taint уже используется: "${name}". Используйте другое имя.`,
    );
  }
}

/**
 * Создает TaintSourceRegistry из состояния
 *
 * @internal
 */
function buildRegistryFromState(
  state: TaintSourceRegistryBuilderState,
): TaintSourceRegistry {
  if (state.sources.length === 0) {
    // eslint-disable-next-line fp/no-throw
    throw new Error(
      'TaintSourceRegistry не может быть пустым. Добавьте хотя бы один источник.',
    );
  }

  const order: readonly TaintSource[] = Object.freeze(
    state.sources.map((s) => s.source),
  );

  const orderIndexMap = new Map<TaintSource, number>(
    order.map((source, index) => [source, index]),
  );

  const sourceNames = new Map<TaintSource, string>(
    state.sources.map((s) => [s.source, s.name]),
  );

  const nameToSourceMap = new Map<string, TaintSource>(
    state.sources.map((s) => [s.name, s.source]),
  );

  return Object.freeze({
    order,
    orderIndexMap: Object.freeze(orderIndexMap) as ReadonlyMap<TaintSource, number>,
    sourceNames: Object.freeze(sourceNames) as ReadonlyMap<TaintSource, string>,
    nameToSourceMap: Object.freeze(nameToSourceMap) as ReadonlyMap<string, TaintSource>,
  });
}

/**
 * Создает Builder из состояния
 *
 * @internal
 */
function createBuilderFromState(
  state: TaintSourceRegistryBuilderState,
): TaintSourceRegistryBuilder {
  const withSource = (source: TaintSource, name: string): TaintSourceRegistryBuilder => {
    validateSource(state, source, name);

    const newState: TaintSourceRegistryBuilderState = {
      sources: Object.freeze([
        ...state.sources,
        Object.freeze({ source, name }),
      ]) as readonly Readonly<
        {
          source: TaintSource;
          name: string;
        }
      >[],
    };

    return createBuilderFromState(newState);
  };

  const build = (): TaintSourceRegistry => buildRegistryFromState(state);

  return Object.freeze({ withSource, build });
}

/** Дефолтный registry с базовыми источниками (EXTERNAL, PLUGIN, UNKNOWN) */
export const defaultTaintSourceRegistry: TaintSourceRegistry = createTaintSourceRegistry()
  .withSource(taintSources.EXTERNAL as TaintSource, 'EXTERNAL')
  .withSource(taintSources.PLUGIN as TaintSource, 'PLUGIN')
  .withSource(taintSources.UNKNOWN as TaintSource, 'UNKNOWN')
  .build();

/* ============================================================================
 * 4. CONSTANTS — DEFAULT REGISTRY
 * ============================================================================
 */

/* ============================================================================
 * 5. HELPERS — UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Получает имя источника taint (O(1), для отладки)
 * @public
 */
export function getTaintSourceName(
  source: TaintSource, // Источник taint
  registry: TaintSourceRegistry = defaultTaintSourceRegistry, // Registry источников taint
): string { // Имя источника taint
  return registry.sourceNames.get(source) ?? 'UNKNOWN';
}

/**
 * Проверяет, является ли значение TaintSource в данном registry (O(1))
 * @public
 */
export function isTaintSource(
  x: unknown, // Значение для проверки
  registry: TaintSourceRegistry = defaultTaintSourceRegistry, // Registry источников taint
): x is TaintSource { // Type guard для TaintSource
  return registry.orderIndexMap.has(x as TaintSource);
}

/**
 * Проверяет, является ли значение tainted (O(1), type guard)
 * @public
 */
export function isTainted<T>(
  value: T | Tainted<T>, // Значение для проверки
): value is Tainted<T> { // Type guard для Tainted<T>
  return (
    typeof value === 'object'
    && value !== null
    && '__taint' in value
    && typeof (value as Tainted<unknown>).__taint === 'object'
  );
}

/**
 * Создает taint metadata для значения
 * @public
 */
export function createTaintMetadata(
  source: TaintSource, // Источник taint
  trustLevel: TrustLevel = trustLevels.UNTRUSTED as TrustLevel, // Уровень доверия
  timestamp?: number, // Timestamp создания (опционально)
): TaintMetadata { // Taint metadata
  return Object.freeze({
    source,
    trustLevel,
    timestamp: timestamp ?? Date.now(),
  });
}

/**
 * Добавляет taint к значению (создает Tainted<T>)
 * @note Idempotent: если значение уже tainted, возвращает его без изменений
 * @public
 */
export function addTaint<T>(
  value: T | Tainted<T>, // Значение для добавления taint
  source: TaintSource, // Источник taint
  trustLevel: TrustLevel = trustLevels.UNTRUSTED as TrustLevel, // Уровень доверия
  timestamp?: number, // Timestamp создания (опционально)
): Tainted<T> { // Tainted значение
  // Idempotent: если значение уже tainted, возвращаем его без изменений
  if (isTainted(value)) {
    return value;
  }

  const taint = createTaintMetadata(source, trustLevel, timestamp);
  return Object.freeze({
    ...value,
    __taint: taint,
  }) as Tainted<T>;
}

/**
 * Удаляет taint из значения (stripTaint)
 * @note Оптимизировано для больших объектов: использует shallow copy вместо spread
 * @public
 */
export function stripTaint<T>(
  value: T | Tainted<T>, // Значение для очистки от taint
): T { // Значение без taint
  if (!isTainted(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice() as T;
  }

  const cleanValue = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) => key !== '__taint'),
  );
  return cleanValue as T;
}

/**
 * Получает taint metadata из значения
 * @public
 */
export function getTaintMetadata<T>(
  value: T | Tainted<T>, // Значение для получения metadata
): TaintMetadata | undefined { // Taint metadata или undefined
  return isTainted(value) ? value.__taint : undefined;
}

/**
 * Распространяет taint от источника к целевому значению
 * @note Если source tainted, то target также становится tainted с тем же metadata
 * @public
 */
export function propagateTaint<T, U>(
  source: T | Tainted<T>, // Источник taint
  target: U, // Целевое значение
): U | Tainted<U> { // Целевое значение с propagated taint (если source был tainted)
  if (isTainted(source)) {
    return addTaint(
      target,
      source.__taint.source,
      source.__taint.trustLevel,
      source.__taint.timestamp,
    );
  }
  return target;
}

/**
 * Объединяет taint metadata от нескольких источников
 * @note Возвращает taint с наименее доверенным уровнем (fail-closed)
 * @public
 */
export function mergeTaintMetadata(
  a: TaintMetadata, // Первое taint metadata
  b: TaintMetadata, // Второе taint metadata
  trustLevelRegistry: TrustLevelRegistry = defaultTrustLevelRegistry, // Registry уровней доверия
): TaintMetadata { // Объединенное taint metadata
  const mergedTrustLevel = meetTrust(a.trustLevel, b.trustLevel, trustLevelRegistry);

  const sourceRegistry = defaultTaintSourceRegistry;
  const indexA = sourceRegistry.orderIndexMap.get(a.source) ?? 0;
  const indexB = sourceRegistry.orderIndexMap.get(b.source) ?? 0;
  const stricterSource = indexA >= indexB ? a.source : b.source;
  const earlierTimestamp = a.timestamp !== undefined && b.timestamp !== undefined
    ? Math.min(a.timestamp, b.timestamp)
    : a.timestamp ?? b.timestamp;

  return Object.freeze({
    source: stricterSource,
    trustLevel: mergedTrustLevel,
    ...(earlierTimestamp !== undefined ? { timestamp: earlierTimestamp } : {}),
  } as TaintMetadata);
}

/**
 * Проверяет, является ли значение trusted (assertTrusted)
 * @note Выбрасывает ошибку если значение tainted или trustLevel недостаточен
 * @throws {Error} Если значение tainted или trustLevel недостаточен
 * @public
 */
export function assertTrusted<T>(
  value: T | Tainted<T>, // Значение для проверки
  requiredTrustLevel: TrustLevel = trustLevels.TRUSTED as TrustLevel, // Требуемый уровень доверия
  trustLevelRegistry: TrustLevelRegistry = defaultTrustLevelRegistry, // Registry уровней доверия
): asserts value is T { // Type assertion для trusted значения
  if (isTainted(value)) {
    const taint = value.__taint;
    const isTrusted = dominates(taint.trustLevel, requiredTrustLevel, trustLevelRegistry);

    if (!isTrusted) {
      const taintSourceName = getTaintSourceName(taint.source);
      const trustLevelName = trustLevelRegistry.trustLevelNames.get(taint.trustLevel) ?? 'UNKNOWN';
      const requiredTrustLevelName = trustLevelRegistry.trustLevelNames.get(requiredTrustLevel)
        ?? 'UNKNOWN';
      // eslint-disable-next-line fp/no-throw
      throw new Error(
        `Value is tainted and not trusted. `
          + `Taint source: ${taintSourceName}, `
          + `Trust level: ${trustLevelName}, `
          + `Required: ${requiredTrustLevelName}. `
          + `Use stripTaint() or sanitize the value before using it.`,
      );
    }
  }
}

/* ============================================================================
 * 🔗 PIPELINE SLOT ADAPTERS — FUTURE-PROOF API
 * ============================================================================
 *
 * Thin adapters для интеграции data-safety функций с pipeline slot-архитектурой.
 * Подготавливают API для будущего pipeline, не ломая существующий код.
 *
 * Принципы:
 * - ✅ Thin adapter — только делегирование, без дополнительной логики
 * - ✅ Future-proof — готовность к slot-архитектуре
 * - ✅ Invariant support — все проверки остаются в core функциях
 * - ✅ No breaking changes — существующий код не затрагивается
 */

/* ============================================================================
 * 6. API — SLOT ADAPTERS (Pipeline Slot Support)
 * ============================================================================
 */

/**
 * Проверяет, что значение в slot соответствует requiredTrustLevel
 * @note Делегирует assertTrusted для проверки значения в slot
 * @throws {Error} Если значение tainted или trustLevel недостаточен
 * @example const slot: Slot<string> = { value: 'data' }; assertTrustedSlot(slot, trustLevels.TRUSTED); // После этого TypeScript знает, что slot.value не tainted
 * @public
 */
export function assertTrustedSlot<T>(
  slot: Slot<T>, // Pipeline slot с значением для проверки
  requiredTrustLevel: TrustLevel = trustLevels.TRUSTED as TrustLevel, // Требуемый уровень доверия (по умолчанию TRUSTED)
  trustLevelRegistry: TrustLevelRegistry = defaultTrustLevelRegistry, // Registry уровней доверия (по умолчанию defaultTrustLevelRegistry)
): asserts slot is Slot<Exclude<T, { __taint: unknown; }>> { // Type assertion для trusted slot
  // Thin adapter: просто делегируем в core функцию
  assertTrusted(slot.value, requiredTrustLevel, trustLevelRegistry);
}

/**
 * Удаляет taint из значения в slot
 * @note Делегирует stripTaint для очистки значения в slot
 * @example const taintedSlot: Slot<Tainted<string>> = { value: addTaint('data', taintSources.EXTERNAL) }; const cleanSlot = stripTaintSlot(taintedSlot); // cleanSlot.value теперь без taint
 * @public
 */
export function stripTaintSlot<T>(
  slot: Slot<T>, // Pipeline slot с tainted значением
): Slot<T> { // Slot с очищенным значением (без taint)
  // Thin adapter: просто делегируем в core функцию
  const cleanValue = stripTaint(slot.value);
  return {
    value: cleanValue,
    ...(slot.metadata !== undefined ? { metadata: slot.metadata } : {}),
  };
}

/**
 * Распространяет taint от source slot к target slot
 * @note Делегирует propagateTaint для распространения taint между значениями в slot
 * @example const sourceSlot: Slot<Tainted<string>> = { value: addTaint('data', taintSources.EXTERNAL) }; const targetSlot: Slot<string> = { value: 'result' }; const resultSlot = propagateTaintSlot(sourceSlot, targetSlot); // resultSlot.value теперь tainted, если source был tainted
 * @public
 */
export function propagateTaintSlot<T, U>(
  source: Slot<T>, // Source slot (источник taint)
  target: Slot<U>, // Target slot (целевой slot для propagation)
): Slot<U> { // Target slot с propagated taint (если source был tainted)
  // Thin adapter: просто делегируем в core функцию
  const propagatedValue = propagateTaint(source.value, target.value);
  return {
    value: propagatedValue,
    ...(target.metadata !== undefined ? { metadata: target.metadata } : {}),
  };
}
