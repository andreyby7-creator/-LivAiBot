/**
 * @file Billing Service Adapters Module
 *
 * Экспорт всех адаптеров billing сервиса для внешних SDK.
 * Обеспечивает чистое разделение между domain логикой и infrastructure.
 */

// ==================== WEBPAY API ADAPTER ====================

export type {
  WebPayAdapterConfig,
  WebPayAdapterError,
  WebPayPaymentRequest,
  WebPayPaymentResponse,
  WebPaySDK,
} from './WebPayAPIAdapter.js';

export {
  createWebPayAdapterClient,
  createWebPayConfigLayer,
  createWebPaySDKLayer,
  mapWebPayError,
  webPayAdapter,
  webPayConfigContext,
  webPaySDKContext,
} from './WebPayAPIAdapter.js';

// ==================== BEPAID API ADAPTER ====================

export type {
  BePaidAdapterConfig,
  BePaidAdapterError,
  BePaidPaymentRequest,
  BePaidPaymentResponse,
  BePaidSDK,
} from './BePaidAPIAdapter.js';

export {
  bePaidAdapter,
  bePaidConfigContext,
  bePaidSDKContext,
  circuitBreakerContext as bePaidCircuitBreakerContext,
  createBePaidAdapterClient,
  createBePaidCircuitLayer,
  createBePaidConfigLayer,
  createBePaidSDKLayer,
  mapBePaidError,
} from './BePaidAPIAdapter.js';
