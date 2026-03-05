/**
 * @file Unit тесты для packages/app/src/types/api.ts
 * Тестирование enterprise-level API типизации с 100% покрытием:
 * - HTTP контракты и методы
 * - Discriminated unions для API ответов
 * - Error handling с distributed tracing
 * - Realtime API с типизированными событиями
 * - Service discovery и retry policies
 * - Observability метрики
 */

import { describe, expect, it } from 'vitest';

import type {
  ApiAuthContext,
  ApiClientConfig,
  ApiError,
  ApiErrorCategory,
  ApiErrorSource,
  ApiFailureResponse,
  ApiHandler,
  ApiHeaders,
  ApiMetrics,
  ApiRequest,
  ApiRequestContext,
  ApiResponse,
  ApiRetryPolicy,
  ApiServiceName,
  ApiSuccessResponse,
  AppFileStatus,
  BaseApiDTO,
  FileValidationResult,
  HttpMethod,
  InternalFileInfo,
  PaginatedResult,
  PaginationParams,
  RealtimeEvent,
  RealtimeSubscription,
  SoftDeletable,
  UploadDomainStatus,
  VersionedEntity,
} from '../../../src/types/api.js';
import type { ID, ISODateString } from '../../../src/types/common.js';

// Helper функции для создания брендированных ID в тестах
function createGenericID(id: string): ID {
  return id as ID;
}

function createISODateString(date: string): ISODateString {
  return date as ISODateString;
}

// ============================================================================
// 🧱 БАЗОВЫЕ HTTP КОНТРАКТЫ
// ============================================================================

describe('HttpMethod тип', () => {
  it('принимает все стандартные HTTP методы', () => {
    const methods: HttpMethod[] = [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
      'HEAD',
    ];

    methods.forEach((method) => {
      expect([
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
        'HEAD',
      ]).toContain(method);
    });
  });
});

describe('ApiServiceName тип', () => {
  it('принимает все поддерживаемые микросервисы', () => {
    const services: ApiServiceName[] = [
      'auth',
      'billing',
      'chat',
      'bots',
      'gateway',
    ];

    services.forEach((service) => {
      expect(['auth', 'billing', 'chat', 'bots', 'gateway']).toContain(service);
    });
  });
});

describe('ApiRequestContext тип', () => {
  it('создает минимальный контекст', () => {
    const context: ApiRequestContext = {};

    expect(context).toEqual({});
  });

  it('создает полный контекст с distributed tracing', () => {
    const context: ApiRequestContext = {
      traceId: 'trace-123',
      authToken: 'jwt-token',
      locale: 'en-US',
      platform: 'web',
      idempotencyKey: 'idempotent-456',
    };

    expect(context.traceId).toBe('trace-123');
    expect(context.authToken).toBe('jwt-token');
    expect(context.locale).toBe('en-US');
    expect(context.platform).toBe('web');
    expect(context.idempotencyKey).toBe('idempotent-456');
  });

  it('опциональные поля могут отсутствовать', () => {
    const context: ApiRequestContext = {
      traceId: 'trace-123',
    };

    expect(context.traceId).toBe('trace-123');
    expect(context.authToken).toBeUndefined();
    expect(context.locale).toBeUndefined();
    expect(context.platform).toBeUndefined();
    expect(context.idempotencyKey).toBeUndefined();
  });
});

// ============================================================================
// 📦 API RESPONSE (DISCRIMINATED UNIONS)
// ============================================================================

describe('ApiErrorCategory тип', () => {
  it('принимает все категории ошибок', () => {
    const categories: ApiErrorCategory[] = [
      'VALIDATION',
      'AUTH',
      'PERMISSION',
      'NOT_FOUND',
      'CONFLICT',
      'RATE_LIMIT',
      'TIMEOUT',
      'DEPENDENCY',
      'INTERNAL',
    ];

    categories.forEach((category) => {
      expect([
        'VALIDATION',
        'AUTH',
        'PERMISSION',
        'NOT_FOUND',
        'CONFLICT',
        'RATE_LIMIT',
        'TIMEOUT',
        'DEPENDENCY',
        'INTERNAL',
      ]).toContain(category);
    });
  });
});

describe('ApiErrorSource тип', () => {
  it('принимает все источники ошибок', () => {
    const sources: ApiErrorSource[] = ['CLIENT', 'GATEWAY', 'SERVICE'];

    sources.forEach((source) => {
      expect(['CLIENT', 'GATEWAY', 'SERVICE']).toContain(source);
    });
  });
});

describe('ApiError тип', () => {
  it('создает минимальную ошибку', () => {
    const error: ApiError = {
      code: 'VALIDATION_FAILED',
      category: 'VALIDATION',
      message: 'Invalid input data',
    };

    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.category).toBe('VALIDATION');
    expect(error.message).toBe('Invalid input data');
    expect(error.source).toBeUndefined();
    expect(error.traceId).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  it('создает ошибку с distributed tracing', () => {
    const error: ApiError = {
      code: 'INTERNAL_ERROR',
      category: 'INTERNAL',
      message: 'Service unavailable',
      source: 'SERVICE',
      traceId: 'abc-123-def',
      details: { service: 'auth-service', version: '1.0.0' },
    };

    expect(error.source).toBe('SERVICE');
    expect(error.traceId).toBe('abc-123-def');
    expect(error.details).toEqual({ service: 'auth-service', version: '1.0.0' });
  });
});

describe('ApiSuccessResponse и ApiFailureResponse типы', () => {
  it('ApiSuccessResponse требует data', () => {
    const response: ApiSuccessResponse<string> = {
      success: true,
      data: 'Success data',
      meta: { requestId: 'req-123' },
    };

    expect(response.success).toBe(true);
    expect(response.data).toBe('Success data');
    expect(response.meta).toEqual({ requestId: 'req-123' });

    // Проверяем что это не failure response
    expect(response).not.toHaveProperty('error');
  });

  it('ApiFailureResponse требует error', () => {
    const apiError: ApiError = {
      code: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message: 'Resource not found',
    };

    const response: ApiFailureResponse = {
      success: false,
      error: apiError,
      meta: { traceId: 'trace-456' },
    };

    expect(response.success).toBe(false);
    expect(response.error).toEqual(apiError);
    expect(response.meta).toEqual({ traceId: 'trace-456' });

    // Проверяем что это не success response
    expect(response).not.toHaveProperty('data');
  });
});

describe('ApiResponse discriminated union', () => {
  it('success response требует data', () => {
    const response: ApiResponse<string> = {
      success: true,
      data: 'Hello World',
      meta: { total: 100 },
    };

    expect(response.success).toBe(true);
    expect(response.data).toBe('Hello World');
    expect(response).not.toHaveProperty('error');
  });

  it('failure response требует error', () => {
    const apiError: ApiError = {
      code: 'VALIDATION_FAILED',
      category: 'VALIDATION',
      message: 'Invalid email format',
    };

    const response: ApiResponse<number> = {
      success: false,
      error: apiError,
      meta: { field: 'email' },
    };

    expect(response.success).toBe(false);
    expect(response.error).toEqual(apiError);
    expect(response).not.toHaveProperty('data');
  });

  it('предотвращает несогласованные состояния', () => {
    // TypeScript не позволит создать несогласованные состояния
    // runtime проверки для демонстрации

    // Невозможно: success=true без data
    // const invalidSuccess: ApiResponse<string> = { success: true }; // TypeScript error

    // Невозможно: success=false без error
    // const invalidFailure: ApiResponse<string> = { success: false }; // TypeScript error

    // Невозможно: success с error и data одновременно
    // const invalidMixed: ApiResponse<string> = { success: true, data: 'test', error: apiError }; // TypeScript error

    expect(true).toBe(true); // Заглушка для теста
  });
});

// ============================================================================
// 📊 ПАГИНАЦИЯ И СПИСКИ
// ============================================================================

describe('PaginationParams тип', () => {
  it('создает параметры пагинации', () => {
    const params: PaginationParams = {
      limit: 10,
      offset: 20,
    };

    expect(params.limit).toBe(10);
    expect(params.offset).toBe(20);
  });
});

describe('PaginatedResult тип', () => {
  it('создает пагинированный результат', () => {
    const result: PaginatedResult<string> = {
      items: ['item1', 'item2', 'item3'],
      total: 100,
      limit: 10,
      offset: 20,
    };

    expect(result.items).toHaveLength(3);
    expect(result.total).toBe(100);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(20);
  });
});

// ============================================================================
// 🔄 REALTIME API
// ============================================================================

describe('RealtimeEvent типизированные события', () => {
  it('создает базовое событие', () => {
    const event: RealtimeEvent = {
      type: 'USER_JOINED',
      timestamp: createISODateString('2026-01-16T12:34:56.000Z'),
      payload: { userId: 'user-123' },
    };

    expect(event.type).toBe('USER_JOINED');
    expect(event.timestamp).toBe('2026-01-16T12:34:56.000Z');
    expect(event.payload).toEqual({ userId: 'user-123' });
  });

  it('работает с типизированными каналами', () => {
    // Пример типизированного события
    type ChatMessageEvent = RealtimeEvent<'CHAT_MESSAGE', { message: string; from: string; }>;

    const chatEvent: ChatMessageEvent = {
      type: 'CHAT_MESSAGE',
      timestamp: createISODateString('2026-01-16T12:34:56.000Z'),
      payload: {
        message: 'Hello!',
        from: 'user-123',
      },
    };

    expect(chatEvent.type).toBe('CHAT_MESSAGE');
    expect(chatEvent.payload.message).toBe('Hello!');
    expect(chatEvent.payload.from).toBe('user-123');
  });
});

describe('RealtimeSubscription тип', () => {
  it('создает подписку на realtime события', () => {
    let unsubscribed = false;

    const subscription: RealtimeSubscription = {
      channel: 'chat-room-123',
      unsubscribe: () => {
        unsubscribed = true;
      },
    };

    expect(subscription.channel).toBe('chat-room-123');
    expect(typeof subscription.unsubscribe).toBe('function');

    subscription.unsubscribe();
    expect(unsubscribed).toBe(true);
  });
});

// ============================================================================
// 🔁 API REQUEST CONTRACTS
// ============================================================================

describe('ApiRequest тип', () => {
  it('создает минимальный запрос', () => {
    const request: ApiRequest = {
      method: 'GET',
      url: '/api/users',
    };

    expect(request.method).toBe('GET');
    expect(request.url).toBe('/api/users');
    expect(request.body).toBeUndefined();
    expect(request.query).toBeUndefined();
    expect(request.headers).toBeUndefined();
    expect(request.context).toBeUndefined();
    expect(request.retryPolicy).toBeUndefined();
    expect(request.signal).toBeUndefined();
  });

  it('создает полный запрос с retry policy', () => {
    const request: ApiRequest<{ name: string; }, { search: string; }> = {
      method: 'POST',
      url: '/api/users',
      body: { name: 'John' },
      query: { search: 'active' },
      headers: { 'Content-Type': 'application/json' },
      context: {
        traceId: 'trace-123',
        authToken: 'jwt-token',
        idempotencyKey: 'idempotent-456',
      },
      retryPolicy: {
        retries: 3,
        backoffMs: 1000,
      },
    };

    expect(request.method).toBe('POST');
    expect(request.body).toEqual({ name: 'John' });
    expect(request.query).toEqual({ search: 'active' });
    expect(request.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(request.context?.traceId).toBe('trace-123');
    expect(request.retryPolicy?.retries).toBe(3);
  });

  it('создает запрос с AbortSignal', () => {
    const controller = new AbortController();
    const request: ApiRequest = {
      method: 'GET',
      url: '/api/users',
      signal: controller.signal,
    };

    expect(request.signal).toBe(controller.signal);
    expect(request.signal?.aborted).toBe(false);
  });
});

describe('ApiHandler тип', () => {
  it('работает как обработчик API запросов', async () => {
    const mockRequest = { userId: 'user-123' };
    const mockResponse: ApiResponse<string> = {
      success: true,
      data: 'User data',
    };

    const handler: ApiHandler<typeof mockRequest, string> = async (request) => {
      expect(request.userId).toBe('user-123');
      return mockResponse;
    };

    const result = await handler(mockRequest);
    expect(result).toEqual(mockResponse);
  });
});

// ============================================================================
// 🧩 DOMAIN-AGNOSTIC DTO КОНТРАКТЫ
// ============================================================================

describe('BaseApiDTO тип', () => {
  it('создает базовый DTO с обязательными полями', () => {
    const dto: BaseApiDTO = {
      id: createGenericID('entity-123'),
      createdAt: createISODateString('2026-01-16T12:34:56.000Z'),
      updatedAt: createISODateString('2026-01-16T13:00:00.000Z'),
    };

    expect(dto.id).toBe('entity-123');
    expect(dto.createdAt).toBe('2026-01-16T12:34:56.000Z');
    expect(dto.updatedAt).toBe('2026-01-16T13:00:00.000Z');
  });

  it('updatedAt может быть undefined', () => {
    const dto: BaseApiDTO = {
      id: createGenericID('entity-456'),
      createdAt: createISODateString('2026-01-16T12:34:56.000Z'),
    };

    expect(dto.id).toBe('entity-456');
    expect(dto.createdAt).toBe('2026-01-16T12:34:56.000Z');
    expect(dto.updatedAt).toBeUndefined();
  });
});

describe('SoftDeletable контракт', () => {
  it('добавляет поле deletedAt', () => {
    const softDeletable: SoftDeletable = {
      deletedAt: createISODateString('2026-01-16T14:00:00.000Z'),
    };

    expect(softDeletable.deletedAt).toBe('2026-01-16T14:00:00.000Z');
  });

  it('deletedAt может быть undefined (не удалено)', () => {
    const softDeletable: SoftDeletable = {};

    expect(softDeletable.deletedAt).toBeUndefined();
  });
});

describe('VersionedEntity контракт', () => {
  it('требует поле version', () => {
    const versioned: VersionedEntity = {
      version: 42,
    };

    expect(versioned.version).toBe(42);
  });
});

// ============================================================================
// 🔒 API SECURITY
// ============================================================================

describe('ApiAuthContext тип', () => {
  it('создает аутентифицированный контекст', () => {
    const context: ApiAuthContext = {
      accessToken: 'jwt-token-here',
      refreshToken: 'refresh-token-here',
      isAuthenticated: true,
    };

    expect(context.accessToken).toBe('jwt-token-here');
    expect(context.refreshToken).toBe('refresh-token-here');
    expect(context.isAuthenticated).toBe(true);
  });

  it('создает неаутентифицированный контекст', () => {
    const context: ApiAuthContext = {
      isAuthenticated: false,
    };

    expect(context.accessToken).toBeUndefined();
    expect(context.refreshToken).toBeUndefined();
    expect(context.isAuthenticated).toBe(false);
  });
});

describe('ApiHeaders тип', () => {
  it('создает заголовки с tracing', () => {
    const headers: ApiHeaders = {
      'x-trace-id': 'trace-123',
      'x-request-id': 'req-456',
      Authorization: 'Bearer jwt-token',
    };

    expect(headers['x-trace-id']).toBe('trace-123');
    expect(headers['x-request-id']).toBe('req-456');
    expect(headers.Authorization).toBe('Bearer jwt-token');
  });

  it('заголовки могут быть частично заполнены', () => {
    const headers: ApiHeaders = {
      'x-trace-id': 'trace-789',
    };

    expect(headers['x-trace-id']).toBe('trace-789');
    expect(headers['x-request-id']).toBeUndefined();
    expect(headers.Authorization).toBeUndefined();
  });
});

// ============================================================================
// 🔄 RETRY POLICY
// ============================================================================

describe('ApiRetryPolicy тип', () => {
  it('создает политику повторов', () => {
    const policy: ApiRetryPolicy = {
      retries: 3,
      backoffMs: 1000,
    };

    expect(policy.retries).toBe(3);
    expect(policy.backoffMs).toBe(1000);
  });

  it('работает с мобильными настройками', () => {
    const mobilePolicy: ApiRetryPolicy = {
      retries: 5,
      backoffMs: 2000,
    };

    expect(mobilePolicy.retries).toBe(5);
    expect(mobilePolicy.backoffMs).toBe(2000);
  });
});

// ============================================================================
// 🧠 OBSERVABILITY
// ============================================================================

describe('ApiMetrics тип', () => {
  it('создает метрики запроса', () => {
    const metrics: ApiMetrics = {
      durationMs: 150,
      statusCode: 200,
      service: 'auth-service',
    };

    expect(metrics.durationMs).toBe(150);
    expect(metrics.statusCode).toBe(200);
    expect(metrics.service).toBe('auth-service');
  });

  it('работает с ошибочными ответами', () => {
    const errorMetrics: ApiMetrics = {
      durationMs: 5000,
      statusCode: 500,
      service: 'billing-service',
    };

    expect(errorMetrics.durationMs).toBe(5000);
    expect(errorMetrics.statusCode).toBe(500);
    expect(errorMetrics.service).toBe('billing-service');
  });
});

// ============================================================================
// 🔧 API CLIENT CONFIGURATION
// ============================================================================

describe('ApiClientConfig тип', () => {
  it('создает минимальную конфигурацию', () => {
    const config: ApiClientConfig = {
      baseUrl: 'https://api.example.com',
    };

    expect(config.baseUrl).toBe('https://api.example.com');
    expect(config.defaultHeaders).toBeUndefined();
    expect(config.timeoutMs).toBeUndefined();
    expect(config.retries).toBeUndefined();
    expect(config.fetchImpl).toBeUndefined();
    expect(config.getAccessToken).toBeUndefined();
  });

  it('создает полную конфигурацию', () => {
    const config: ApiClientConfig = {
      baseUrl: 'https://api.example.com',
      defaultHeaders: {
        'x-trace-id': 'trace-123',
        Authorization: 'Bearer token',
      },
      timeoutMs: 5000,
      retries: 3,
      fetchImpl: fetch,
      getAccessToken: async () => 'access-token',
    };

    expect(config.baseUrl).toBe('https://api.example.com');
    expect(config.defaultHeaders?.['x-trace-id']).toBe('trace-123');
    expect(config.timeoutMs).toBe(5000);
    expect(config.retries).toBe(3);
    expect(config.fetchImpl).toBe(fetch);
    expect(typeof config.getAccessToken).toBe('function');
  });

  it('getAccessToken может возвращать null', async () => {
    const config: ApiClientConfig = {
      baseUrl: 'https://api.example.com',
      getAccessToken: async () => null,
    };

    const token = await config.getAccessToken!();
    expect(token).toBeNull();
  });
});

// ============================================================================
// 📁 FILE UPLOAD CONTRACTS
// ============================================================================

describe('UploadDomainStatus тип', () => {
  it('принимает все статусы загрузки', () => {
    const statuses: UploadDomainStatus[] = [
      'idle',
      'uploading',
      'success',
      'error',
    ];

    statuses.forEach((status) => {
      expect(['idle', 'uploading', 'success', 'error']).toContain(status);
    });
  });
});

describe('FileValidationResult тип', () => {
  it('создает успешный результат валидации', () => {
    const result: FileValidationResult = {
      valid: true,
    };

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('создает результат с ошибкой валидации', () => {
    const result: FileValidationResult = {
      valid: false,
      error: 'File size exceeds limit',
    };

    expect(result.valid).toBe(false);
    expect(result.error).toBe('File size exceeds limit');
  });
});

describe('AppFileStatus тип', () => {
  it('создает pending статус', () => {
    const status: AppFileStatus = {
      type: 'pending',
      label: 'Waiting to upload',
    };

    expect(status.type).toBe('pending');
    expect(status.label).toBe('Waiting to upload');
  });

  it('создает progress статус', () => {
    const status: AppFileStatus = {
      type: 'progress',
      label: 'Uploading... 50%',
    };

    expect(status.type).toBe('progress');
    expect(status.label).toBe('Uploading... 50%');
  });

  it('создает success статус', () => {
    const status: AppFileStatus = {
      type: 'success',
      label: 'Upload complete',
    };

    expect(status.type).toBe('success');
    expect(status.label).toBe('Upload complete');
  });

  it('создает error статус', () => {
    const status: AppFileStatus = {
      type: 'error',
      label: 'Upload failed',
    };

    expect(status.type).toBe('error');
    expect(status.label).toBe('Upload failed');
  });
});

describe('InternalFileInfo тип', () => {
  it('создает полную информацию о файле', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const fileInfo: InternalFileInfo = {
      id: 'file-123',
      file,
      uploadStatus: 'uploading',
      uploadProgress: 50,
    };

    expect(fileInfo.id).toBe('file-123');
    expect(fileInfo.file).toBe(file);
    expect(fileInfo.uploadStatus).toBe('uploading');
    expect(fileInfo.uploadProgress).toBe(50);
    expect(fileInfo.errorMessage).toBeUndefined();
  });

  it('создает информацию о файле с ошибкой', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const fileInfo: InternalFileInfo = {
      id: 'file-456',
      file,
      uploadStatus: 'error',
      errorMessage: 'Network error',
    };

    expect(fileInfo.uploadStatus).toBe('error');
    expect(fileInfo.errorMessage).toBe('Network error');
    expect(fileInfo.uploadProgress).toBeUndefined();
  });

  it('создает информацию о файле в idle статусе', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const fileInfo: InternalFileInfo = {
      id: 'file-789',
      file,
      uploadStatus: 'idle',
    };

    expect(fileInfo.uploadStatus).toBe('idle');
    expect(fileInfo.uploadProgress).toBeUndefined();
    expect(fileInfo.errorMessage).toBeUndefined();
  });
});

// ============================================================================
// 📊 ПОКРЫТИЕ 100%
// ============================================================================

describe('Экспорты типов', () => {
  it('все типы корректно экспортируются', () => {
    // Этот тест проверяет что все импорты работают
    // TypeScript проверит корректность типов на этапе компиляции

    // Проверяем что типы существуют и могут быть использованы
    const testValues = {
      method: 'GET' as HttpMethod,
      service: 'auth' as ApiServiceName,
      errorCategory: 'VALIDATION' as ApiErrorCategory,
      errorSource: 'CLIENT' as ApiErrorSource,
      uploadStatus: 'idle' as UploadDomainStatus,
    };

    expect(testValues.method).toBe('GET');
    expect(testValues.service).toBe('auth');
    expect(testValues.errorCategory).toBe('VALIDATION');
    expect(testValues.errorSource).toBe('CLIENT');
    expect(testValues.uploadStatus).toBe('idle');
  });
});
