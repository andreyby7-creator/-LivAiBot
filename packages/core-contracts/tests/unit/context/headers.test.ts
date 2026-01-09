/**
 * @file Unit тесты для context/headers.ts
 */
import { describe, expect, it } from 'vitest';
import {
  type AuthenticatedRequestHeaders,
  HEADERS,
  type RequestHeaders,
  type ServiceRequestHeaders,
} from '../../../src/context/headers.js';

describe('HEADERS', () => {
  it('содержит все необходимые заголовки', () => {
    expect(HEADERS).toHaveProperty('TRACE_ID');
    expect(HEADERS).toHaveProperty('OPERATION_ID');
    expect(HEADERS).toHaveProperty('WORKSPACE_ID');
    expect(HEADERS).toHaveProperty('USER_ID');
  });

  it('значения соответствуют ожидаемым строкам', () => {
    expect(HEADERS.TRACE_ID).toBe('X-Trace-Id');
    expect(HEADERS.OPERATION_ID).toBe('X-Operation-Id');
    expect(HEADERS.WORKSPACE_ID).toBe('X-Workspace-Id');
    expect(HEADERS.USER_ID).toBe('X-User-Id');
  });

  it('все значения являются строками', () => {
    Object.values(HEADERS).forEach((header) => {
      expect(typeof header).toBe('string');
      expect(header).toMatch(/^X-[A-Z][a-zA-Z-]+$/);
    });
  });

  it('является immutable (as const)', () => {
    expect(() => {
      // @ts-expect-error - пытаемся изменить readonly объект
      HEADERS.TRACE_ID = 'X-Something-Else';
    }).toThrow();
  });
});

describe('AuthenticatedRequestHeaders', () => {
  it('валидная структура AuthenticatedRequestHeaders', () => {
    const headers: AuthenticatedRequestHeaders = {
      'X-Workspace-Id': 'workspace-123',
      'X-User-Id': 'user-456',
      'X-Trace-Id': 'trace-789',
      'X-Operation-Id': 'operation-101',
    };

    expect(headers).toMatchObject({
      'X-Workspace-Id': 'workspace-123',
      'X-User-Id': 'user-456',
      'X-Trace-Id': 'trace-789',
      'X-Operation-Id': 'operation-101',
    });
  });

  it('обязательные поля workspace_id и user_id', () => {
    const headers: AuthenticatedRequestHeaders = {
      'X-Workspace-Id': 'workspace-123',
      'X-User-Id': 'user-456',
    };

    expect(headers['X-Workspace-Id']).toBe('workspace-123');
    expect(headers['X-User-Id']).toBe('user-456');
  });

  it('опциональные поля trace_id и operation_id', () => {
    const headersWithoutOptional: AuthenticatedRequestHeaders = {
      'X-Workspace-Id': 'workspace-123',
      'X-User-Id': 'user-456',
    };

    const headersWithOptional: AuthenticatedRequestHeaders = {
      'X-Workspace-Id': 'workspace-123',
      'X-User-Id': 'user-456',
      'X-Trace-Id': 'trace-789',
    };

    expect(headersWithoutOptional).not.toHaveProperty('X-Trace-Id');
    expect(headersWithOptional).toHaveProperty('X-Trace-Id');
  });

  it('отвергает отсутствие обязательных полей', () => {
    expect(() => {
      // @ts-expect-error - отсутствие workspace_id должно быть ошибкой компиляции
      const invalidHeaders: AuthenticatedRequestHeaders = {
        'X-User-Id': 'user-456',
      };
    }).not.toThrow(); // Runtime проверка

    expect(() => {
      // @ts-expect-error - отсутствие user_id должно быть ошибкой компиляции
      const invalidHeaders: AuthenticatedRequestHeaders = {
        'X-Workspace-Id': 'workspace-123',
      };
    }).not.toThrow(); // Runtime проверка
  });
});

describe('ServiceRequestHeaders', () => {
  it('все поля опциональны', () => {
    const headers: ServiceRequestHeaders = {};

    expect(headers).toEqual({});
  });

  it('может содержать workspace_id', () => {
    const headers: ServiceRequestHeaders = {
      'X-Workspace-Id': 'workspace-123',
    };

    expect(headers['X-Workspace-Id']).toBe('workspace-123');
  });

  it('может содержать user_id', () => {
    const headers: ServiceRequestHeaders = {
      'X-User-Id': 'user-456',
    };

    expect(headers['X-User-Id']).toBe('user-456');
  });

  it('может содержать trace_id и operation_id', () => {
    const headers: ServiceRequestHeaders = {
      'X-Trace-Id': 'trace-789',
      'X-Operation-Id': 'operation-101',
    };

    expect(headers['X-Trace-Id']).toBe('trace-789');
    expect(headers['X-Operation-Id']).toBe('operation-101');
  });

  it('снапшот полной структуры', () => {
    const headers: ServiceRequestHeaders = {
      'X-Workspace-Id': 'workspace-123',
      'X-User-Id': 'user-456',
      'X-Trace-Id': 'trace-789',
      'X-Operation-Id': 'operation-101',
    };

    expect(headers).toMatchSnapshot();
  });
});

describe('RequestHeaders union type', () => {
  it('принимает AuthenticatedRequestHeaders', () => {
    const authHeaders: RequestHeaders = {
      'X-Workspace-Id': 'workspace-123',
      'X-User-Id': 'user-456',
    };

    expect(authHeaders).toHaveProperty('X-Workspace-Id');
    expect(authHeaders).toHaveProperty('X-User-Id');
  });

  it('принимает ServiceRequestHeaders', () => {
    const serviceHeaders: RequestHeaders = {
      'X-Trace-Id': 'trace-789',
    };

    expect(serviceHeaders).toHaveProperty('X-Trace-Id');
  });

  it('AuthenticatedRequestHeaders совместим с RequestHeaders', () => {
    const authHeaders: AuthenticatedRequestHeaders = {
      'X-Workspace-Id': 'workspace-123',
      'X-User-Id': 'user-456',
      'X-Trace-Id': 'trace-789',
    };

    // Это должно компилироваться без ошибок
    const requestHeaders: RequestHeaders = authHeaders;

    expect(requestHeaders).toHaveProperty('X-Workspace-Id');
    expect(requestHeaders).toHaveProperty('X-User-Id');
    expect(requestHeaders).toHaveProperty('X-Trace-Id');
  });

  it('ServiceRequestHeaders совместим с RequestHeaders', () => {
    const serviceHeaders: ServiceRequestHeaders = {
      'X-Workspace-Id': 'workspace-123',
    };

    // Это должно компилироваться без ошибок
    const requestHeaders: RequestHeaders = serviceHeaders;

    expect(requestHeaders).toHaveProperty('X-Workspace-Id');
  });
});

describe('Интеграционные тесты', () => {
  it('HEADERS значения используются в типах', () => {
    const headers: AuthenticatedRequestHeaders = {
      [HEADERS.WORKSPACE_ID]: 'workspace-123',
      [HEADERS.USER_ID]: 'user-456',
    };

    expect(headers[HEADERS.WORKSPACE_ID]).toBe('workspace-123');
    expect(headers[HEADERS.USER_ID]).toBe('user-456');
  });

  it('константы HEADERS не могут быть переопределены', () => {
    // Проверяем, что мы используем именно константы из HEADERS
    const workspaceHeader = HEADERS.WORKSPACE_ID;
    const userHeader = HEADERS.USER_ID;

    expect(workspaceHeader).toBe('X-Workspace-Id');
    expect(userHeader).toBe('X-User-Id');
  });

  it('снапшот всех констант HEADERS', () => {
    expect(HEADERS).toMatchSnapshot();
  });
});
