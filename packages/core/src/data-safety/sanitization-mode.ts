/**
 * @file packages/core/src/data-safety/sanitization-mode.ts
 * ============================================================================
 * 🛡️ CORE — Sanitization Modes
 * ============================================================================
 *
 * Режимы санитизации данных для защиты от PII и небезопасного контента.
 * Режимы упорядочены по строгости: NONE < BASIC < STRICT < PII_REDACTION.
 *
 * ⚠️ PRODUCTION: Инициализируйте registry на старте, не на горячем пути.
 * Registry после build() immutable и thread-safe.
 */

/* ============================================================================
 * 🔒 BRANDED TYPE
 * ============================================================================
 */

/** Brand для SanitizationMode (защита от создания извне) */
declare const SanitizationModeBrand: unique symbol;

/** Базовый тип режима санитизации (без brand) */
type SanitizationModeBase = symbol;

/**
 * Режимы санитизации данных
 * Symbol гарантирует невозможность подделки через JSON, type safety.
 */
export const sanitizationModes = {
  /** Без санитизации (только для trusted данных) */
  NONE: Symbol('NONE'),
  /** Базовая санитизация (HTML escaping, basic validation) */
  BASIC: Symbol('BASIC'),
  /** Строгая санитизация (полная очистка, валидация структуры) */
  STRICT: Symbol('STRICT'),
  /** Удаление PII (Personally Identifiable Information) */
  PII_REDACTION: Symbol('PII_REDACTION'),
} as const satisfies Record<string, SanitizationModeBase>;

/** Тип режима санитизации (branded union type из Symbol значений sanitizationModes) */
export type SanitizationMode = (typeof sanitizationModes)[keyof typeof sanitizationModes] & {
  readonly [SanitizationModeBrand]: true;
};

/* ============================================================================
 * 🏗️ REGISTRY
 * ============================================================================
 */

/**
 * Immutable registry режимов санитизации
 * Все операции O(1), deterministic, no allocation.
 */
export type SanitizationModeRegistry = Readonly<{
  /** Порядок режимов по строгости (readonly array) */
  readonly order: readonly SanitizationMode[];
  /** Map для O(1) lookup индексов */
  readonly orderIndexMap: ReadonlyMap<SanitizationMode, number>;
  /** Map для получения имени режима (для отладки) */
  readonly modeNames: ReadonlyMap<SanitizationMode, string>;
  /** Map для O(1) проверки дубликатов имён */
  readonly nameToModeMap: ReadonlyMap<string, SanitizationMode>;
}>;

/** Внутреннее состояние Builder (immutable) */
type SanitizationModeRegistryBuilderState = Readonly<{
  readonly modes: readonly Readonly<{ mode: SanitizationMode; name: string; }>[];
}>;

/**
 * Builder для создания immutable SanitizationModeRegistry
 * Порядок добавления определяет порядок строгости (первый = наименее строгий).
 * Multi-registry: можно создать разные registry для разных pipeline contexts.
 */
export type SanitizationModeRegistryBuilder = Readonly<{
  readonly withMode: (mode: SanitizationMode, name: string) => SanitizationModeRegistryBuilder;
  readonly build: () => SanitizationModeRegistry;
}>;

/**
 * Создает Builder для SanitizationModeRegistry
 *
 * @note ⚠️ PRODUCTION: Инициализируйте на старте, не на горячем пути!
 * Builder НЕ thread-safe, но registry после build() полностью thread-safe.
 * Multi-registry: можно создать несколько registry для разных pipeline contexts.
 */
export function createSanitizationModeRegistry(): SanitizationModeRegistryBuilder {
  const state: SanitizationModeRegistryBuilderState = { modes: [] };
  return createBuilderFromState(state);
}

/**
 * Проверяет дубликаты режима санитизации
 *
 * @internal
 * @throws {Error} Если режим или имя уже существуют
 */
function validateMode(
  state: SanitizationModeRegistryBuilderState,
  mode: SanitizationMode,
  name: string,
): void {
  const existingMode = state.modes.find((m) => m.mode === mode);
  if (existingMode) {
    // eslint-disable-next-line fp/no-throw
    throw new Error(
      `SanitizationMode уже добавлен в registry: ${existingMode.name} (${mode.toString()})`,
    );
  }

  const existingName = state.modes.find((m) => m.name === name);
  if (existingName) {
    // eslint-disable-next-line fp/no-throw
    throw new Error(
      `Имя режима санитизации уже используется: "${name}". Используйте другое имя.`,
    );
  }
}

/**
 * Создает SanitizationModeRegistry из состояния
 *
 * @internal
 * @throws {Error} Если registry пуст
 */
function buildRegistryFromState(
  state: SanitizationModeRegistryBuilderState,
): SanitizationModeRegistry {
  if (state.modes.length === 0) {
    // eslint-disable-next-line fp/no-throw
    throw new Error(
      'SanitizationModeRegistry не может быть пустым. Добавьте хотя бы один режим.',
    );
  }

  const order: readonly SanitizationMode[] = Object.freeze(
    state.modes.map((m) => m.mode),
  );

  const orderIndexMap = new Map<SanitizationMode, number>(
    order.map((mode, index) => [mode, index]),
  );

  const modeNames = new Map<SanitizationMode, string>(
    state.modes.map((m) => [m.mode, m.name]),
  );

  const nameToModeMap = new Map<string, SanitizationMode>(
    state.modes.map((m) => [m.name, m.mode]),
  );

  return Object.freeze({
    order,
    orderIndexMap: Object.freeze(orderIndexMap) as ReadonlyMap<SanitizationMode, number>,
    modeNames: Object.freeze(modeNames) as ReadonlyMap<SanitizationMode, string>,
    nameToModeMap: Object.freeze(nameToModeMap) as ReadonlyMap<string, SanitizationMode>,
  });
}

/**
 * Создает Builder из состояния (для внутреннего использования)
 *
 * @internal
 */
function createBuilderFromState(
  state: SanitizationModeRegistryBuilderState,
): SanitizationModeRegistryBuilder {
  const withMode = (mode: SanitizationMode, name: string): SanitizationModeRegistryBuilder => {
    validateMode(state, mode, name);

    const newState: SanitizationModeRegistryBuilderState = {
      modes: Object.freeze([...state.modes, Object.freeze({ mode, name })]) as readonly Readonly<{
        mode: SanitizationMode;
        name: string;
      }>[],
    };

    return createBuilderFromState(newState);
  };

  const build = (): SanitizationModeRegistry => buildRegistryFromState(state);

  return Object.freeze({ withMode, build });
}

/**
 * Дефолтный registry с базовыми режимами (NONE, BASIC, STRICT, PII_REDACTION)
 * Thread-safe, immutable, инициализирован на старте.
 */
export const defaultSanitizationModeRegistry: SanitizationModeRegistry =
  createSanitizationModeRegistry()
    .withMode(sanitizationModes.NONE as SanitizationMode, 'NONE')
    .withMode(sanitizationModes.BASIC as SanitizationMode, 'BASIC')
    .withMode(sanitizationModes.STRICT as SanitizationMode, 'STRICT')
    .withMode(sanitizationModes.PII_REDACTION as SanitizationMode, 'PII_REDACTION')
    .build();

/* ============================================================================
 * 🔧 UTILITY FUNCTIONS
 * ============================================================================
 */

/**
 * Получает имя режима санитизации (для отладки)
 * O(1), возвращает "UNKNOWN" если режим не найден.
 */
export function getSanitizationModeName(
  mode: SanitizationMode,
  registry: SanitizationModeRegistry = defaultSanitizationModeRegistry,
): string {
  return registry.modeNames.get(mode) ?? 'UNKNOWN';
}

/**
 * Проверяет, является ли значение SanitizationMode в данном registry
 * O(1), защищает от NaN, Infinity, подделок.
 */
export function isSanitizationMode(
  x: unknown,
  registry: SanitizationModeRegistry = defaultSanitizationModeRegistry,
): x is SanitizationMode {
  return registry.orderIndexMap.has(x as SanitizationMode);
}

/* ============================================================================
 * 🔐 COMPARISON OPERATIONS
 * ============================================================================
 */

/**
 * Разрешает индексы режимов из registry (общая проверка для всех операций сравнения)
 *
 * @internal
 * @returns Кортеж [indexA, indexB]
 * @throws {Error} Если режим не найден в registry
 */
function resolveModeIndices(
  a: SanitizationMode,
  b: SanitizationMode,
  registry: SanitizationModeRegistry,
  operationName: string,
): [number, number] {
  const indexA = registry.orderIndexMap.get(a);
  const indexB = registry.orderIndexMap.get(b);

  if (indexA === undefined || indexB === undefined) {
    const nameA = getSanitizationModeName(a, registry);
    const nameB = getSanitizationModeName(b, registry);
    const registryInfo = registry === defaultSanitizationModeRegistry
      ? 'defaultSanitizationModeRegistry'
      : `custom registry with ${registry.order.length} modes`;
    // eslint-disable-next-line fp/no-throw
    throw new Error(
      `Unknown SanitizationMode detected in ${operationName}: ${nameA} (${a.toString()}), ${nameB} (${b.toString()}). `
        + `All SanitizationModes must be registered in the provided registry (${registryInfo}).`,
    );
  }

  return [indexA, indexB];
}

/**
 * Общая функция сравнения режимов с кастомным компаратором
 *
 * @param comparatorFn - Функция сравнения индексов: (indexA, indexB) => результат
 * @returns Результат сравнения (тип зависит от comparatorFn)
 *
 * @example compareModes(BASIC, STRICT, (idxA, idxB) => idxA - idxB, registry)
 */
export function compareModes<T>(
  a: SanitizationMode,
  b: SanitizationMode,
  comparatorFn: (indexA: number, indexB: number) => T,
  registry: SanitizationModeRegistry = defaultSanitizationModeRegistry,
): T {
  const [indexA, indexB] = resolveModeIndices(a, b, registry, 'compareModes');
  return comparatorFn(indexA, indexB);
}

/**
 * Проверяет, строже ли режим a чем режим b (a > b по индексу)
 * O(1), deterministic, no allocation.
 *
 * @example isStricter(STRICT, BASIC) === true
 */
export function isStricter(
  a: SanitizationMode,
  b: SanitizationMode,
  registry: SanitizationModeRegistry = defaultSanitizationModeRegistry,
): boolean {
  const [indexA, indexB] = resolveModeIndices(a, b, registry, 'isStricter');
  return indexA > indexB;
}

/**
 * Возвращает более строгий режим из двух
 * O(1), deterministic, no allocation.
 *
 * @example stricterMode(BASIC, STRICT) === STRICT
 */
export function stricterMode(
  a: SanitizationMode,
  b: SanitizationMode,
  registry: SanitizationModeRegistry = defaultSanitizationModeRegistry,
): SanitizationMode {
  const [indexA, indexB] = resolveModeIndices(a, b, registry, 'stricterMode');
  return indexA > indexB ? a : b;
}

/**
 * Возвращает менее строгий режим из двух
 * O(1), deterministic, no allocation.
 *
 * @example lenientMode(BASIC, STRICT) === BASIC
 */
export function lenientMode(
  a: SanitizationMode,
  b: SanitizationMode,
  registry: SanitizationModeRegistry = defaultSanitizationModeRegistry,
): SanitizationMode {
  const [indexA, indexB] = resolveModeIndices(a, b, registry, 'lenientMode');
  return indexA < indexB ? a : b;
}
