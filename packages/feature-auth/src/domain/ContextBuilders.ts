/**
 * @file packages/feature-auth/src/domain/ContextBuilders.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Risk Context Builders (Domain Layer)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Context builders для подготовки контекстов разных слоёв
 * - Изолированы от основной логики для соблюдения SRP
 * - Используются в domain и effects layers
 *
 * Принципы:
 * - ✅ SRP — каждый builder отвечает за свой тип контекста
 * - ✅ Pure — детерминированные функции без side-effects
 * - ✅ Reusable — используются в domain и effects layers
 * - ✅ Scalable — O(1) по памяти: readonly ссылки вместо deep copy
 *
 * @note Общие требования для всех builders:
 *       - Signals должны быть sanitized через sanitizeExternalSignals() до вызова (adapter layer responsibility)
 *       - Builders не выполняют security checks — соблюдается разделение ответственности
 *       - Все builders используют readonly ссылки на signals без deep copy (O(1) по памяти)
 *       - Плагины получают readonly контексты и должны возвращать readonly (enforced через ReadonlyDeep typing)
 *       - ⚠️ КРИТИЧНО: плагины не могут мутировать вложенные объекты signals (previousGeo, externalSignals)
 *       - Dev-mode: deepFreeze применяется только к signals для оптимизации (остальное уже readonly)
 */

import type { ReadonlyDeep } from 'type-fest';

import type { DeviceInfo } from './DeviceInfo.js';
import type { RuleEvaluationContext, RuleSignals } from '../effects/login/risk-rules.js';
import type { ScoringContext, ScoringSignals } from '../effects/login/risk-scoring.js';
import type {
  BuildAssessmentContext,
  ContextBuilderPlugin,
  RiskContext,
  RiskSignals,
} from '../types/risk.js';

/* ============================================================================
 * 🔧 HELPER: DEEP FREEZE (DEV-MODE)
 * ============================================================================
 */

/**
 * Deep freeze для dev-mode проверки мутаций плагинами
 * Рекурсивно замораживает все вложенные объекты для раннего выявления мутаций
 *
 * @param obj - Объект для заморозки
 * @param visited - WeakSet для отслеживания уже обработанных объектов (защита от циклических ссылок)
 * @returns Замороженный объект
 *
 * @note Используется только в dev-mode (NODE_ENV === 'development')
 * @note Пропускает специальные объекты (Date, RegExp, Map, Set) которые нельзя заморозить
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
 */
// eslint-disable-next-line functional/prefer-immutable-types -- WeakSet нельзя сделать Immutable, используется только для tracking
function deepFreeze<T>(obj: T, visited: WeakSet<object> = new WeakSet<object>()): Readonly<T> {
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
              // eslint-disable-next-line functional/prefer-immutable-types -- Object.getOwnPropertyNames возвращает mutable массив
              const propNames = Object.getOwnPropertyNames(obj);
              // eslint-disable-next-line fp/no-unused-expression -- forEach вызывается для side-effect (deepFreeze)
              propNames.forEach((name: string): void => {
                // eslint-disable-next-line security/detect-object-injection -- name из Object.getOwnPropertyNames, безопасно
                const value = (obj as Record<string, unknown>)[name];
                // eslint-disable-next-line functional/no-conditional-statements -- if для side-effect в forEach
                if (value !== null && typeof value === 'object') {
                  // eslint-disable-next-line fp/no-unused-expression -- deepFreeze вызывается для side-effect (freeze)
                  deepFreeze(value, visited);
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
 * Применяет плагины для расширения контекста функционально (immutable transformation)
 *
 * @param baseContext - Базовый контекст для расширения
 * @param plugins - Опциональные плагины для применения
 * @param riskContext - Risk context для передачи в плагины
 * @param extendFn - Функция-селектор для получения метода расширения из плагина
 * @returns Расширенный контекст или базовый, если плагины отсутствуют
 */
function applyPlugins<
  T extends (ScoringContext | RuleEvaluationContext | BuildAssessmentContext) & {
    signals?: ReadonlyDeep<ScoringSignals | RuleSignals | RiskSignals>;
  },
>(
  baseContext: T,
  // eslint-disable-next-line functional/prefer-immutable-types -- Parameter comes from effects layer
  plugins: readonly ContextBuilderPlugin[] | undefined,
  riskContext: Readonly<RiskContext>,
  extendFn: (
    plugin: ContextBuilderPlugin,
  ) => ((ctx: Readonly<T>, risk: Readonly<RiskContext>) => Readonly<T>) | undefined,
): T {
  // Dev-mode: deepFreeze только signals для оптимизации (остальное уже readonly)
  const frozenContext =
    process.env['NODE_ENV'] === 'development' && baseContext.signals !== undefined
      ? { ...baseContext, signals: deepFreeze(baseContext.signals) }
      : baseContext;

  return plugins !== undefined && plugins.length > 0
    ? plugins.reduce(
      (acc: T, plugin: ContextBuilderPlugin): T => {
        const extend = extendFn(plugin);
        return extend
          ? ((): T => {
            const result = extend(acc, riskContext);
            // Dev-mode: проверяем, что плагин не мутировал signals (только signals, остальное уже readonly)
            return process.env['NODE_ENV'] === 'development' && result.signals !== undefined
              ? ({ ...result, signals: deepFreeze(result.signals) } as T)
              : result;
          })()
          : acc;
      },
      frozenContext,
    )
    : frozenContext;
}

/* ============================================================================
 * 🔧 SCORING CONTEXT BUILDER
 * ============================================================================
 */

/**
 * Подготавливает контекст для scoring
 *
 * @param deviceInfo - Информация об устройстве
 * @param context - Контекст для оценки риска
 * @param plugins - Опциональные плагины для расширения контекста
 * @returns ScoringContext для calculateRiskScore
 */
export function buildScoringContext(
  deviceInfo: Readonly<DeviceInfo>,
  context: Readonly<RiskContext>,
  // eslint-disable-next-line functional/prefer-immutable-types -- Parameter comes from effects layer
  plugins?: readonly ContextBuilderPlugin[],
): ScoringContext {
  const baseContext: ScoringContext = {
    device: deviceInfo,
    ...(context.geo !== undefined ? { geo: context.geo } : {}),
    ...(context.ip !== undefined ? { ip: context.ip } : {}),
    ...(context.signals !== undefined ? { signals: context.signals } : {}),
  };

  return applyPlugins(baseContext, plugins, context, (plugin) => plugin.extendScoringContext);
}

/* ============================================================================
 * 🔧 RULE CONTEXT BUILDER
 * ============================================================================
 */

/**
 * Подготавливает контекст для rule evaluation
 *
 * @param deviceInfo - Информация об устройстве
 * @param context - Контекст для оценки риска
 * @param riskScore - Текущий risk score (для metadata)
 * @param plugins - Опциональные плагины для расширения контекста
 * @returns RuleEvaluationContext для evaluateRules
 */
export function buildRuleContext(
  deviceInfo: Readonly<DeviceInfo>,
  context: Readonly<RiskContext>,
  riskScore: number,
  // eslint-disable-next-line functional/prefer-immutable-types -- Parameter comes from effects layer
  plugins?: readonly ContextBuilderPlugin[],
): RuleEvaluationContext {
  const baseContext: RuleEvaluationContext = {
    device: deviceInfo,
    ...(context.geo !== undefined ? { geo: context.geo } : {}),
    ...(context.signals?.previousGeo !== undefined
      ? { previousGeo: context.signals.previousGeo }
      : {}),
    ...(context.signals !== undefined ? { signals: context.signals } : {}),
    metadata: {
      isNewDevice: context.previousSessionId === undefined,
      riskScore,
    },
  };

  return applyPlugins(baseContext, plugins, context, (plugin) => plugin.extendRuleContext);
}

/* ============================================================================
 * 🔧 ASSESSMENT CONTEXT BUILDER
 * ============================================================================
 */

/**
 * Подготавливает контекст для buildAssessment
 *
 * @param deviceInfo - Информация об устройстве
 * @param context - Контекст для оценки риска
 * @param plugins - Опциональные плагины для расширения контекста
 * @returns Assessment context для buildAssessment
 */
export function buildAssessmentContext(
  deviceInfo: Readonly<DeviceInfo>,
  context: Readonly<RiskContext>,
  // eslint-disable-next-line functional/prefer-immutable-types -- Parameter comes from effects layer
  plugins?: readonly ContextBuilderPlugin[],
): BuildAssessmentContext {
  const baseContext: BuildAssessmentContext = {
    ...(context.userId !== undefined ? { userId: context.userId } : {}),
    ...(context.ip !== undefined ? { ip: context.ip } : {}),
    ...(context.geo !== undefined ? { geo: context.geo } : {}),
    ...(deviceInfo.userAgent !== undefined ? { userAgent: deviceInfo.userAgent } : {}),
    ...(context.previousSessionId !== undefined
      ? { previousSessionId: context.previousSessionId }
      : {}),
    ...(context.timestamp !== undefined ? { timestamp: context.timestamp } : {}),
    ...(context.signals !== undefined ? { signals: context.signals } : {}),
  };

  return applyPlugins(baseContext, plugins, context, (plugin) => plugin.extendAssessmentContext);
}
