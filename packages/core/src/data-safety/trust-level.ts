/**
 * @file packages/core/src/data-safety/trust-level.ts
 * ============================================================================
 * 🛡️ CORE — Data Safety (Trust Levels)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Security lattice для уровней доверия к данным в taint tracking и boundary guards
 * - TrustLevel = security lattice element, НЕ score! Запрещена арифметика, единственная операция: lattice meet (meetTrust)
 * - Причина изменения: data safety, security lattice, boundary guards
 *
 * Принципы:
 * - ✅ SRP: разделение на BRANDED TYPE, REGISTRY, CONSTANTS, HELPERS, LATTICE OPERATIONS
 * - ✅ Deterministic: immutable registry, pure functions для lattice operations, O(1) операции
 * - ✅ Domain-pure: generic по типам значений, без привязки к domain-специфичным типам
 * - ✅ Extensible: multi-registry архитектура для разных pipeline contexts
 * - ✅ Strict typing: branded types для TrustLevel, union types для lattice operations
 * - ✅ Microservice-ready: stateless, immutable registry, thread-safe после build()
 * - ✅ Security: fail-closed semantics (lattice meet возвращает наименее доверенный уровень)
 *
 * ⚠️ ВАЖНО:
 * - ❌ ЗАПРЕЩЕНО: арифметика, Math.min/max, сравнения >= (кроме через dominates())
 * - ✅ РАЗРЕШЕНО: meetTrust(), dominates(), isTrustLevel()
 * - Lattice meet ≠ max/min! meet(UNTRUSTED, TRUSTED) → UNTRUSTED (fail-closed)
 * - Lattice order: UNTRUSTED < PARTIAL < TRUSTED
 * - ⚠️ PRODUCTION: Инициализируйте registry на старте (не на горячем пути). Registry после build() immutable и thread-safe. Используйте предварительно созданный registry в worker threads.
 */

/* ============================================================================
 * 1. BRANDED TYPE — TRUST LEVEL (Type Safety)
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
 * 2. REGISTRY — TRUST LEVEL REGISTRY (Immutable Registry)
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
 * @note Порядок добавления определяет lattice порядок (первый = наименее доверенный).
 *       Multi-registry архитектура: можно создать разные registry для разных pipeline contexts
 *       (например, отдельные registry для разных доменов или окружений).
 *       Каждый registry независим и может содержать свой набор уровней доверия.
 * @public
 */
export type TrustLevelRegistryBuilder = Readonly<{
  readonly withLevel: (level: TrustLevel, name: string) => TrustLevelRegistryBuilder;
  readonly build: () => TrustLevelRegistry;
}>;

/**
 * Создает Builder для TrustLevelRegistry
 * @note ⚠️ PRODUCTION: Инициализируйте на старте, не на горячем пути!
 *       Builder НЕ thread-safe, но registry после build() полностью thread-safe.
 *       Multi-registry: можно создать несколько registry для разных pipeline contexts.
 *       Каждый registry независим и immutable после build(), что позволяет использовать
 *       разные наборы уровней доверия в разных контекстах приложения.
 * @example const defaultRegistry = createTrustLevelRegistry()...build(); const strictRegistry = createTrustLevelRegistry()...build(); // с дополнительными уровнями
 * @public
 */
export function createTrustLevelRegistry(): TrustLevelRegistryBuilder { // Builder для создания registry
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

/* ============================================================================
 * 3. CONSTANTS — DEFAULT REGISTRY
 * ============================================================================
 */

/**
 * Дефолтный registry с базовыми уровнями (UNTRUSTED, PARTIAL, TRUSTED)
 * @note Thread-safe, immutable, инициализирован на старте
 * @public
 */
export const defaultTrustLevelRegistry: TrustLevelRegistry = createTrustLevelRegistry()
  .withLevel(trustLevels.UNTRUSTED as TrustLevel, 'UNTRUSTED')
  .withLevel(trustLevels.PARTIAL as TrustLevel, 'PARTIAL')
  .withLevel(trustLevels.TRUSTED as TrustLevel, 'TRUSTED')
  .build();

/* ============================================================================
 * 4. HELPERS — UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Получает имя уровня доверия (для отладки)
 * @note O(1), возвращает "UNKNOWN" если уровень не найден
 * @public
 */
export function getTrustLevelName(
  level: TrustLevel, // Уровень доверия
  registry: TrustLevelRegistry = defaultTrustLevelRegistry, // Registry уровней доверия
): string { // Имя уровня доверия
  return registry.trustLevelNames.get(level) ?? 'UNKNOWN';
}

/**
 * Проверяет, является ли значение TrustLevel в данном registry
 * @note O(1), защищает от NaN, Infinity, подделок
 * @public
 */
export function isTrustLevel(
  x: unknown, // Значение для проверки
  registry: TrustLevelRegistry = defaultTrustLevelRegistry, // Registry уровней доверия
): x is TrustLevel { // Type guard для TrustLevel
  return registry.orderIndexMap.has(x as TrustLevel);
}

/* ============================================================================
 * 5. LATTICE OPERATIONS — SECURITY LATTICE OPERATIONS
 * ============================================================================
 *
 * Workflow: Registry → Meet → Dominates
 * Registry (immutable) → meetTrust(a, b, registry) → dominates(a, b, registry)
 * meetTrust: возвращает уровень с меньшим индексом (наименее доверенный = fail-closed)
 * dominates: выражена через meet: meet(a, b) === b (lattice property)
 */

/**
 * Lattice meet операция (restrict trust)
 * @note Возвращает наименьший уровень доверия из двух (fail-closed security model).
 *       Единственная допустимая операция над TrustLevel.
 *       Идемпотентна, коммутативна, ассоциативна. Fail-hard при неизвестных уровнях.
 * @example meetTrust(UNTRUSTED, TRUSTED) === UNTRUSTED
 * @throws {Error} Если уровень не найден в registry
 * @public
 */
export function meetTrust(
  a: TrustLevel, // Первый уровень доверия
  b: TrustLevel, // Второй уровень доверия
  registry: TrustLevelRegistry = defaultTrustLevelRegistry, // Registry уровней доверия
): TrustLevel { // Наименьший уровень доверия из двух (fail-closed)
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
 * @note a >= b ⇔ meet(a, b) === b (lattice property).
 *       O(1), deterministic, no allocation. Выражена через lattice meet (single source of truth).
 * @public
 */
export function dominates(
  a: TrustLevel, // Первый уровень доверия
  b: TrustLevel, // Второй уровень доверия
  registry: TrustLevelRegistry = defaultTrustLevelRegistry, // Registry уровней доверия
): boolean { // true если a >= b в lattice порядке
  // a >= b ⇔ meet(a, b) === b (lattice property)
  return meetTrust(a, b, registry) === b;
}
