/**
 * @file AI Service Adapters Module
 *
 * Экспорт всех адаптеров AI сервиса для внешних SDK.
 * Обеспечивает чистое разделение между domain логикой и infrastructure.
 */

// ==================== YANDEX AI SDK ADAPTER ====================

export type {
  AICompletionRequest,
  AICompletionResponse,
  YandexAIAdapterError,
  YandexAISDK,
  YandexAISDKAdapterConfig,
} from './YandexAISDKAdapter.js';

export {
  createYandexAIConfigLayer,
  createYandexAISDKLayer,
  yandexAIConfigContext,
  yandexAISDKAdapter,
  yandexAISDKContext,
} from './YandexAISDKAdapter.js';
