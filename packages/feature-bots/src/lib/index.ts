/**
 * @file packages/feature-bots/src/lib — Lib Layer
 * Публичный API lib-слоя feature-bots.
 *
 * @remarks
 * Lib-слой содержит pure утилиты и rule-engine адаптеры поверх domain/types/contracts,
 * не добавляя transport деталей в домен.
 */

/* ============================================================================
 * 🧰 LIB — УТИЛИТЫ И RULE-ENGINE
 * ========================================================================== */

/**
 * Error Mapper: production-grade rule-engine для преобразования boundary/unknown ошибок в `BotError`.
 * @public
 */
export {
  type BotErrorInput,
  type MapBotErrorConfig,
  mapBotErrorToUI,
  type MapFn,
  type MappingRule,
  type MatchFn,
} from './error-mapper.js';
