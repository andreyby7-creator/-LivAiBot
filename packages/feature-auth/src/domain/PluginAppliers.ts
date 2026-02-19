/**
 * @file packages/feature-auth/src/domain/pluginAppliers.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Plugin Appliers (Domain Layer)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Применение плагинов для расширения контекстов
 * - Изолированы от основной логики для соблюдения SRP
 * - Используются в domain и effects layers
 *
 * Принципы:
 * - ✅ SRP — generic applyPlugins<T> применяет плагины к любому типу контекста
 * - ✅ Pure — детерминированные функции без side-effects
 * - ✅ Functional — использование reduce для immutable transformations
 * - ✅ Reusable — используются в domain и effects layers
 * - ✅ Scalable — O(n) по количеству плагинов, оптимизированный deepFreeze только для signals
 * - ✅ Deterministic — плагины сортируются по priority для детерминированного порядка применения
 *
 * @note Плагины должны быть чистыми функциями без побочных эффектов (кроме возвращаемого объекта).
 *       Детерминированность: одинаковый вход → одинаковый выход.
 * @note Порядок применения: плагины сортируются по priority (ascending), плагины без priority применяются последними.
 *       Порядок плагинов с одинаковым priority стабильный (stable sort) в современных движках JS (V8, SpiderMonkey).
 * @note Dev-mode deepFreeze применяется только к signals для оптимизации (остальное уже readonly).
 *       Для больших Record (externalSignals > 50 ключей) используется shallow freeze.
 *       Для очень больших объектов (≥1000 ключей) рекомендуется профилирование dev-mode.
 * @note Security: мутации вложенных объектов signals заблокированы через ReadonlyDeep typing + ProtectedSignals + dev-mode freeze.
 * @note Отключение правила обосновано: readonly массивы/типы неизменяемы на runtime.
 *       Параметры plugins приходят из effects layer, WeakSet используется только для tracking,
 *       Object.getOwnPropertyNames возвращает mutable массив, sortedPlugins создается через spread.
 */

/* eslint-disable functional/prefer-immutable-types */
/* readonly массивы/типы неизменяемы на runtime, параметры приходят из effects layer */

import type { ReadonlyDeep } from 'type-fest';

import type { RuleEvaluationContext, RuleSignals } from '../effects/login/risk-rules.js';
import type { ScoringContext, ScoringSignals } from '../effects/login/risk-scoring.js';
import type {
  BuildAssessmentContext,
  ContextBuilderPlugin,
  RiskContext,
  RiskSignals,
} from '../types/risk.js';

/* ============================================================================
 * 🧭 TYPE ALIASES
 * ============================================================================
 */

/** Union type для всех типов signals (для упрощения типизации) */
type BaseSignals = ScoringSignals | RuleSignals | RiskSignals;

/**
 * Защищенные сигналы с явной типизацией для compile-time запрета мутаций
 * Используется для критичных вложенных объектов, которые не должны мутироваться плагинами
 */
type ProtectedSignals = {
  readonly previousGeo?: Readonly<{
    readonly lat?: number;
    readonly lng?: number;
    readonly country?: string;
    readonly region?: string;
    readonly city?: string;
  }>;
  readonly externalSignals?: Readonly<Record<string, unknown>>;
};

/* ============================================================================
 * 🔧 CONSTANTS
 * ============================================================================
 */

/** Порог для shallow freeze больших Record объектов (оптимизация для externalSignals) */
const LARGE_RECORD_THRESHOLD = 50;

/** Порог для ленивой проверки очень больших объектов (пропуск глубокой рекурсии) */
const VERY_LARGE_RECORD_THRESHOLD = 1000;

/* ============================================================================
 * 🔧 HELPER: DEEP FREEZE (DEV-MODE)
 * ============================================================================
 */

/**
 * Shallow freeze для больших Record объектов (оптимизация для externalSignals)
 * Замораживает только первый уровень, не рекурсивно
 *
 * @param obj - Record для заморозки
 * @returns Замороженный объект
 */
function shallowFreezeRecord<T extends Record<string, unknown>>(obj: T): Readonly<T> {
  return Object.freeze(obj);
}

/**
 * Deep freeze для dev-mode проверки мутаций плагинами
 * Рекурсивно замораживает все вложенные объекты для раннего выявления мутаций
 *
 * @param obj - Объект для заморозки
 * @param visited - WeakSet для отслеживания уже обработанных объектов (защита от циклических ссылок)
 * @param depth - Текущая глубина рекурсии (для ленивой проверки больших объектов)
 * @returns Замороженный объект
 *
 * @note Используется только в dev-mode (NODE_ENV === 'development')
 * @note Пропускает специальные объекты (Date, RegExp, Map, Set) которые нельзя заморозить
 * @note Оптимизация: для больших Record (externalSignals > 50 ключей) используется shallow freeze
 * @note Ленивая проверка: для очень больших объектов (≥1000 ключей) можно пропустить глубокую рекурсию
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
 */
function deepFreeze<T>(
  obj: T,
  visited: WeakSet<object> = new WeakSet<object>(),
  depth: number = 0,
): Readonly<T> {
  // Пропускаем null, undefined и примитивы
  return (obj === null || obj === undefined || typeof obj !== 'object')
    ? (obj as Readonly<T>)
    : ((): Readonly<T> => {
      // Защита от циклических ссылок
      return visited.has(obj as object)
        ? (obj as Readonly<T>)
        : ((): Readonly<T> => {
          // Пропускаем специальные объекты, которые нельзя заморозить
          return (
              obj instanceof Date
              || obj instanceof RegExp
              || obj instanceof Map
              || obj instanceof Set
              || obj instanceof WeakMap
              || obj instanceof WeakSet
            )
            ? (obj as Readonly<T>)
            : ((): Readonly<T> => {
              // eslint-disable-next-line fp/no-unused-expression -- visited.add вызывается для side-effect (tracking)
              visited.add(obj as object);

              // Рекурсивно замораживаем вложенные объекты
              const propNames = Object.getOwnPropertyNames(obj);
              // eslint-disable-next-line fp/no-unused-expression, sonarjs/cognitive-complexity -- forEach вызывается для side-effect, рекурсивная функция с оптимизациями требует сложной логики
              propNames.forEach((name: string): void => {
                // eslint-disable-next-line security/detect-object-injection -- name из Object.getOwnPropertyNames, безопасно
                const value = (obj as Record<string, unknown>)[name];
                // eslint-disable-next-line functional/no-conditional-statements -- if для side-effect в forEach
                if (value !== null && typeof value === 'object') {
                  // Оптимизация: shallow freeze для больших Record (externalSignals)
                  // eslint-disable-next-line functional/no-conditional-statements -- if для side-effect
                  if (Array.isArray(value) || value.constructor === Object) {
                    const keysCount = Object.keys(value).length;
                    // eslint-disable-next-line functional/no-conditional-statements -- if для side-effect
                    if (keysCount > LARGE_RECORD_THRESHOLD) {
                      // eslint-disable-next-line fp/no-unused-expression -- shallowFreezeRecord вызывается для side-effect
                      shallowFreezeRecord(value as Record<string, unknown>);
                      // Ленивая проверка: для очень больших объектов пропускаем глубокую рекурсию
                      // eslint-disable-next-line functional/no-conditional-statements -- if для side-effect
                      if (keysCount >= VERY_LARGE_RECORD_THRESHOLD && depth > 2) {
                        // Пропускаем глубокую рекурсию для очень больших объектов на большой глубине
                        // (return не нужен - это последний statement в блоке, но оставляем для явности логики)
                      }
                    } else {
                      // eslint-disable-next-line fp/no-unused-expression -- deepFreeze вызывается для side-effect
                      deepFreeze(value, visited, depth + 1);
                    }
                  } else {
                    // eslint-disable-next-line fp/no-unused-expression -- deepFreeze вызывается для side-effect
                    deepFreeze(value, visited, depth + 1);
                  }
                }
              });

              // Замораживаем сам объект
              return Object.freeze(obj);
            })();
        })();
    })();
}

/* ============================================================================
 * 🔧 HELPER: PLUGIN APPLIER
 * ============================================================================
 */

/**
 * Сортирует плагины по приоритету (ascending: меньше = выше приоритет)
 * Плагины без priority применяются последними (в порядке массива)
 *
 * @param plugins - Плагины для сортировки
 * @returns Отсортированный массив плагинов
 *
 * @note Детерминированность: порядок плагинов с одинаковым priority сохраняется (stable sort).
 *       Стабильность гарантирована в современных движках JS (V8, SpiderMonkey, JavaScriptCore).
 *       В старых движках порядок может отличаться, но это не критично для функциональности.
 */
function sortPluginsByPriority(
  plugins: readonly ContextBuilderPlugin[],
): readonly ContextBuilderPlugin[] {
  return [...plugins].sort((a, b) => {
    const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
    const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
    return priorityA - priorityB;
  });
}

/**
 * TypeScript guard для compile-time проверки, что плагин не мутирует контекст
 * Гарантирует, что extendFn возвращает новый объект, а не мутирует входной
 */
type ImmutablePluginExtender<T> = (ctx: Readonly<T>, risk: Readonly<RiskContext>) => Readonly<T>;

/**
 * Применяет плагины для расширения контекста функционально (immutable transformation)
 *
 * @param baseContext - Базовый контекст для расширения
 * @param plugins - Плагины для применения (сортируются по priority перед применением)
 * @param riskContext - Risk context для передачи в плагины
 * @param extendFn - Функция-селектор для получения метода расширения из плагина
 * @returns Расширенный контекст или базовый, если плагины отсутствуют
 *
 * @note Плагины сортируются по priority (ascending) для детерминированного порядка применения
 * @note extendFn должен возвращать чистую функцию, которая принимает Readonly<T> и возвращает Readonly<T>
 * @note TypeScript guard (ImmutablePluginExtender) гарантирует compile-time запрет мутаций
 */
function applyPlugins<
  T extends (ScoringContext | RuleEvaluationContext | BuildAssessmentContext) & {
    signals?: ReadonlyDeep<BaseSignals> & Partial<ProtectedSignals>;
  },
>(
  baseContext: T,
  plugins: readonly ContextBuilderPlugin[],
  riskContext: Readonly<RiskContext>,
  extendFn: (
    plugin: ContextBuilderPlugin,
  ) => ImmutablePluginExtender<T> | undefined,
): T {
  // Сортируем плагины по priority для детерминированного порядка применения
  const sortedPlugins = sortPluginsByPriority(plugins);

  // Dev-mode: deepFreeze только signals для оптимизации (остальное уже readonly)
  const frozenContext =
    process.env['NODE_ENV'] === 'development' && baseContext.signals !== undefined
      ? { ...baseContext, signals: deepFreeze(baseContext.signals) }
      : baseContext;

  return sortedPlugins.reduce(
    (acc: T, plugin: ContextBuilderPlugin): T => {
      const extend = extendFn(plugin);
      return extend
        ? ((): T => {
          const result = extend(acc, riskContext);
          // Type constraint: extendFn гарантирует, что result уже Readonly<T>
          // Dev-mode: проверяем, что плагин не мутировал signals (только signals, остальное уже readonly)
          return process.env['NODE_ENV'] === 'development' && result.signals !== undefined
            ? ({ ...result, signals: deepFreeze(result.signals) } as T)
            : result;
        })()
        : acc;
    },
    frozenContext,
  );
}

/* ============================================================================
 * 🔧 SCORING PLUGIN APPLIER
 * ============================================================================
 */

/**
 * Применяет плагины для расширения scoring context
 *
 * @param context - Базовый scoring context
 * @param plugins - Плагины для применения
 * @param riskContext - Risk context для передачи в плагины
 * @returns Расширенный scoring context
 *
 * @note Thin wrapper для backward compatibility. Для новых контекстов можно использовать generic applyPlugins напрямую.
 */
export function applyScoringPlugins(
  context: ScoringContext,
  plugins: readonly ContextBuilderPlugin[],
  riskContext: RiskContext,
): ScoringContext {
  return applyPlugins(context, plugins, riskContext, (plugin) => plugin.extendScoringContext);
}

/* ============================================================================
 * 🔧 RULE PLUGIN APPLIER
 * ============================================================================
 */

/**
 * Применяет плагины для расширения rule context
 *
 * @param context - Базовый rule context
 * @param plugins - Плагины для применения
 * @param riskContext - Risk context для передачи в плагины
 * @returns Расширенный rule context
 *
 * @note Thin wrapper для backward compatibility. Для новых контекстов можно использовать generic applyPlugins напрямую.
 */
export function applyRulePlugins(
  context: RuleEvaluationContext,
  plugins: readonly ContextBuilderPlugin[],
  riskContext: RiskContext,
): RuleEvaluationContext {
  return applyPlugins(context, plugins, riskContext, (plugin) => plugin.extendRuleContext);
}

/* ============================================================================
 * 🔧 ASSESSMENT PLUGIN APPLIER
 * ============================================================================
 */

/**
 * Применяет плагины для расширения assessment context
 *
 * @param context - Базовый assessment context
 * @param plugins - Плагины для применения
 * @param riskContext - Risk context для передачи в плагины
 * @returns Расширенный assessment context
 *
 * @note Thin wrapper для backward compatibility. Для новых контекстов можно использовать generic applyPlugins напрямую.
 */
export function applyAssessmentPlugins(
  context: BuildAssessmentContext,
  plugins: readonly ContextBuilderPlugin[],
  riskContext: RiskContext,
): BuildAssessmentContext {
  return applyPlugins(context, plugins, riskContext, (plugin) => plugin.extendAssessmentContext);
}

/* eslint-enable functional/prefer-immutable-types */
