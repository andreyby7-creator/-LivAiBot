/**
 * @file packages/core/src/data-safety/trust-level.ts
 * ============================================================================
 * 🛡️ CORE — Trust Levels (Security Lattice)
 * ============================================================================
 *
 * Security lattice для уровней доверия к данным в taint tracking и boundary guards.
 * TrustLevel = security lattice element, НЕ score! Запрещена арифметика, единственная
 * операция: lattice meet (meetTrust). Lattice order: UNTRUSTED < PARTIAL < TRUSTED.
 *
 * ⚠️ ВАЖНО:
 * - ❌ ЗАПРЕЩЕНО: арифметика, Math.min/max, сравнения >= (кроме через dominates())
 * - ✅ РАЗРЕШЕНО: meetTrust(), dominates(), isTrustLevel()
 * - Lattice meet ≠ max/min! meet(UNTRUSTED, TRUSTED) → UNTRUSTED (fail-closed)
 *
 * ⚠️ PRODUCTION:
 * - Инициализируйте registry на старте (не на горячем пути)
 * - Registry после build() immutable и thread-safe
 * - Используйте предварительно созданный registry в worker threads
 */

/* ============================================================================
 * 🔒 BRANDED TYPE
 * ============================================================================
 */

/** Brand для TrustLevel (защита от создания извне) */
declare const TrustLevelBrand: unique symbol;

/**
 * Базовый тип уровня доверия (без brand)
 * Используется для внутренней типизации trustLevels
 */
type TrustLevelBase = symbol;

/**
 * Уровни доверия к данным (Security Lattice)
 * Symbol гарантирует: невозможность арифметики, подделки через JSON, type safety.
 * Branded type: невозможно создать извне (только через trustLevels).
 */
export const trustLevels = {
  /** Непроверенные данные от внешних источников */
  UNTRUSTED: Symbol('UNTRUSTED'),
  /** Частично проверенные данные (промежуточные стадии) */
  PARTIAL: Symbol('PARTIAL'),
  /** Полностью проверенные и безопасные данные */
  TRUSTED: Symbol('TRUSTED'),
} as const satisfies Record<string, TrustLevelBase>;

/** Тип уровня доверия (branded union type из Symbol значений trustLevels) */
export type TrustLevel = (typeof trustLevels)[keyof typeof trustLevels] & {
  readonly [TrustLevelBrand]: true;
};

/* ============================================================================
 * 🏗️ REGISTRY
 * ============================================================================
 */

/**
 * Immutable registry уровней доверия
 * Все операции O(1), deterministic, no allocation.
 */
export type TrustLevelRegistry = Readonly<{
  /** Порядок уровней в lattice (readonly array) */
  readonly order: readonly TrustLevel[];
  /** Map для O(1) lookup индексов */
  readonly orderIndexMap: ReadonlyMap<TrustLevel, number>;
  /** Map для получения имени уровня (для отладки) */
  readonly trustLevelNames: ReadonlyMap<TrustLevel, string>;
  /** Map для O(1) проверки дубликатов имён */
  readonly nameToLevelMap: ReadonlyMap<string, TrustLevel>;
}>;

/** Внутреннее состояние Builder (immutable) */
type TrustLevelRegistryBuilderState = Readonly<{
  readonly levels: readonly Readonly<{ level: TrustLevel; name: string; }>[];
}>;

/**
 * Builder для создания immutable TrustLevelRegistry
 * Порядок добавления определяет lattice порядок (первый = наименее доверенный).
 *
 * @note Multi-registry архитектура: можно создать разные registry для разных
 * pipeline contexts (например, отдельные registry для разных доменов или окружений).
 * Каждый registry независим и может содержать свой набор уровней доверия.
 */
export type TrustLevelRegistryBuilder = Readonly<{
  readonly withLevel: (level: TrustLevel, name: string) => TrustLevelRegistryBuilder;
  readonly build: () => TrustLevelRegistry;
}>;

/**
 * Создает Builder для TrustLevelRegistry
 *
 * @note ⚠️ PRODUCTION: Инициализируйте на старте, не на горячем пути!
 * Builder НЕ thread-safe, но registry после build() полностью thread-safe.
 *
 * @note Multi-registry: можно создать несколько registry для разных pipeline contexts.
 * Каждый registry независим и immutable после build(), что позволяет использовать
 * разные наборы уровней доверия в разных контекстах приложения.
 *
 * @example
 * // Разные registry для разных контекстов
 * const defaultRegistry = createTrustLevelRegistry()...build();
 * const strictRegistry = createTrustLevelRegistry()...build(); // с дополнительными уровнями
 * const permissiveRegistry = createTrustLevelRegistry()...build(); // с другими уровнями
 */
export function createTrustLevelRegistry(): TrustLevelRegistryBuilder {
  const state: TrustLevelRegistryBuilderState = { levels: [] };
  return createBuilderFromState(state);
}

function validateLevel(
  state: TrustLevelRegistryBuilderState,
  level: TrustLevel,
  name: string,
): void {
  const existingLevel = state.levels.find((l) => l.level === level);
  if (existingLevel) {
    // eslint-disable-next-line fp/no-throw
    throw new Error(
      `TrustLevel уже добавлен в registry: ${existingLevel.name} (${level.toString()})`,
    );
  }

  const existingName = state.levels.find((l) => l.name === name);
  if (existingName) {
    // eslint-disable-next-line fp/no-throw
    throw new Error(
      `Имя уровня доверия уже используется: "${name}". Используйте другое имя.`,
    );
  }
}

function buildRegistryFromState(state: TrustLevelRegistryBuilderState): TrustLevelRegistry {
  if (state.levels.length === 0) {
    // eslint-disable-next-line fp/no-throw
    throw new Error('TrustLevelRegistry не может быть пустым. Добавьте хотя бы один уровень.');
  }

  const order: readonly TrustLevel[] = Object.freeze(
    state.levels.map((l) => l.level),
  );

  const orderIndexMap = new Map<TrustLevel, number>(
    order.map((level, index) => [level, index]),
  );

  const trustLevelNames = new Map<TrustLevel, string>(
    state.levels.map((l) => [l.level, l.name]),
  );

  const nameToLevelMap = new Map<string, TrustLevel>(
    state.levels.map((l) => [l.name, l.level]),
  );

  return Object.freeze({
    order,
    orderIndexMap: Object.freeze(orderIndexMap) as ReadonlyMap<TrustLevel, number>,
    trustLevelNames: Object.freeze(trustLevelNames) as ReadonlyMap<TrustLevel, string>,
    nameToLevelMap: Object.freeze(nameToLevelMap) as ReadonlyMap<string, TrustLevel>,
  });
}

function createBuilderFromState(
  state: TrustLevelRegistryBuilderState,
): TrustLevelRegistryBuilder {
  const withLevel = (level: TrustLevel, name: string): TrustLevelRegistryBuilder => {
    validateLevel(state, level, name);

    const newState: TrustLevelRegistryBuilderState = {
      levels: Object.freeze([...state.levels, Object.freeze({ level, name })]) as readonly Readonly<
        {
          level: TrustLevel;
          name: string;
        }
      >[],
    };

    return createBuilderFromState(newState);
  };

  const build = (): TrustLevelRegistry => buildRegistryFromState(state);

  return Object.freeze({ withLevel, build });
}

/**
 * Дефолтный registry с базовыми уровнями (UNTRUSTED, PARTIAL, TRUSTED)
 * Thread-safe, immutable, инициализирован на старте.
 */
export const defaultTrustLevelRegistry: TrustLevelRegistry = createTrustLevelRegistry()
  .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
  .withLevel(trustLevels.PARTIAL as TrustLevel, 'PARTIAL')
  .withLevel(trustLevels.TRUSTED as TrustLevel, 'TRUSTED')
  .build();

/* ============================================================================
 * 🔧 UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Получает имя уровня доверия (для отладки)
 * O(1), возвращает "UNKNOWN" если уровень не найден.
 */
export function getTrustLevelName(
  level: TrustLevel,
  registry: TrustLevelRegistry = defaultTrustLevelRegistry,
): string {
  return registry.trustLevelNames.get(level) ?? 'UNKNOWN';
}

/**
 * Проверяет, является ли значение TrustLevel в данном registry
 * O(1), защищает от NaN, Infinity, подделок.
 */
export function isTrustLevel(
  x: unknown,
  registry: TrustLevelRegistry = defaultTrustLevelRegistry,
): x is TrustLevel {
  return registry.orderIndexMap.has(x as TrustLevel);
}

/* ============================================================================
 * 🔐 LATTICE OPERATIONS
 * ============================================================================
 *
 * Workflow: Registry → Meet → Dominates
 * ┌───────────────────────────────────────────────────────────────┐
 * │                                                               │
 * │  Registry (immutable)                                         │
 * │  ┌──────────────────────────────────────────────────────────┐ │
 * │  │ order: [UNTRUSTED, PARTIAL, TRUSTED]                     │ │
 * │  │ orderIndexMap: {UNTRUSTED→0, PARTIAL→1, TRUSTED→2}       │ │
 * │  └──────────────────────────────────────────────────────────┘ │
 * │                           │                                   │
 * │                           ▼                                   │
 * │  meetTrust(a, b, registry)                                    │
 * │  ┌──────────────────────────────────────────────────────────┐ │
 * │  │ 1. Получить индексы из orderIndexMap (O(1))              │ │
 * │  │ 2. Вернуть уровень с меньшим индексом                    │ │
 * │  │    (наименее доверенный = fail-closed)                   │ │
 * │  │ 3. Пример: meet(UNTRUSTED, TRUSTED) → UNTRUSTED          │ │
 * │  └──────────────────────────────────────────────────────────┘ │
 * │                           │                                   │
 * │                           ▼                                   │
 * │  dominates(a, b, registry)                                    │
 * │  ┌──────────────────────────────────────────────────────────┐ │
 * │  │ Выражена через meet: meet(a, b) === b                    │ │
 * │  │ Пример: dominates(TRUSTED, UNTRUSTED) → true             │ │
 * │  │          (TRUSTED >= UNTRUSTED в lattice порядке)        │ │
 * │  └──────────────────────────────────────────────────────────┘ │
 * │                                                               │
 * └───────────────────────────────────────────────────────────────┘
 */

/**
 * Lattice meet операция (restrict trust)
 * Возвращает наименьший уровень доверия из двух (fail-closed security model).
 *
 * @example meetTrust(UNTRUSTED, TRUSTED) === UNTRUSTED
 * @note Единственная допустимая операция над TrustLevel
 * Идемпотентна, коммутативна, ассоциативна. Fail-hard при неизвестных уровнях.
 */
export function meetTrust(
  a: TrustLevel,
  b: TrustLevel,
  registry: TrustLevelRegistry = defaultTrustLevelRegistry,
): TrustLevel {
  // Lattice order определяется порядком в registry.order
  // Meet = наименее доверенный (fail-closed security model)
  const indexA = registry.orderIndexMap.get(a);
  const indexB = registry.orderIndexMap.get(b);

  // Если уровень не найден в registry - fail-hard для безопасности
  if (indexA === undefined || indexB === undefined) {
    const nameA = getTrustLevelName(a, registry);
    const nameB = getTrustLevelName(b, registry);
    // eslint-disable-next-line fp/no-throw
    throw new Error(
      `Unknown TrustLevel detected in meetTrust: ${nameA} (${a.toString()}), ${nameB} (${b.toString()}). `
        + `All TrustLevels must be registered in the provided registry.`,
    );
  }

  // Meet = уровень с меньшим индексом (наименее доверенный)
  return indexA <= indexB ? a : b;
}

/**
 * Проверяет, доминирует ли уровень a над b в lattice порядке
 * a >= b ⇔ meet(a, b) === b (lattice property)
 * O(1), deterministic, no allocation. Выражена через lattice meet (single source of truth).
 */
export function dominates(
  a: TrustLevel,
  b: TrustLevel,
  registry: TrustLevelRegistry = defaultTrustLevelRegistry,
): boolean {
  // a >= b ⇔ meet(a, b) === b (lattice property)
  return meetTrust(a, b, registry) === b;
}
