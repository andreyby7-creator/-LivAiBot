/**
 * @file packages/feature-bots/src/dto — DTO
 * Публичный API DTO feature-bots для API boundary.
 */

/* ============================================================================
 * 📋 BOTS DTO — КОНТРАКТЫ ЗАПРОСОВ ДЛЯ API BOUNDARY
 * ============================================================================
 */

/**
 * CreateBotRequest: DTO запроса создания бота.
 * @public
 */
export { type CreateBotRequest } from './CreateBotRequest.js';

/**
 * UpdateBotMetadataRequest: DTO запроса обновления метаданных бота.
 * @public
 */
export {
  type AtLeastOne,
  type BotMetadataPatch,
  type UpdateBotMetadataRequest,
} from './UpdateBotMetadataRequest.js';

/**
 * UpdateBotConfigRequest: DTO запроса обновления конфигурации бота.
 * @public
 */
export {
  type BotConfigurationPatch,
  type UpdateBotConfigRequest,
} from './UpdateBotConfigRequest.js';

/**
 * PublishBotRequest: DTO запроса публикации бота.
 * @public
 */
export {
  isPublishRequest,
  isRollbackRequest,
  type PublishBotRequest,
  type PublishRequest,
  type RollbackRequest,
} from './PublishBotRequest.js';

/**
 * TestBotRequest: DTO запроса тестирования бота.
 * @public
 */
export { type TestBotRequest } from './TestBotRequest.js';
