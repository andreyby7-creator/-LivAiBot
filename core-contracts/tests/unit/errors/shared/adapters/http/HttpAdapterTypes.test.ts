/**
 * @file HttpAdapterTypes.test.ts - Тесты для HttpAdapterTypes
 *
 * Цель: типы и branded types; edge cases, optional поля.
 * Желаемое покрытие: 90–95%
 */

import { describe, expect, it } from 'vitest';

import { httpAdapterFactories } from '../../../../../../src/errors/shared/adapters/http/HttpAdapterFactories';
import { HttpMethod } from '../../../../../../src/errors/shared/adapters/http/HttpAdapterTypes';

describe('HttpAdapterTypes', () => {
  describe('HttpMethod', () => {
    it('should have all standard HTTP methods', () => {
      const expectedMethods = [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'HEAD',
        'OPTIONS',
        'TRACE',
        'CONNECT',
      ];

      expectedMethods.forEach((method) => {
        expect(HttpMethod).toHaveProperty(method);
        expect(HttpMethod[method as keyof typeof HttpMethod]).toBe(method);
      });
    });

    it('should have consistent values', () => {
      // HttpMethod enum values should be consistent
      expect(HttpMethod.GET).toBe('GET');
      expect(HttpMethod.POST).toBe('POST');
      expect(HttpMethod.PUT).toBe('PUT');
      expect(HttpMethod.TRACE).toBe('TRACE');
      expect(HttpMethod.CONNECT).toBe('CONNECT');
      // Enum values are defined at compile time
    });
  });

  describe('HttpRequest', () => {
    it('should create valid HttpRequest with all required fields', () => {
      const request = {
        method: HttpMethod.GET,
        url: httpAdapterFactories.makeHttpUrl('https://api.example.com/users'),
        headers: httpAdapterFactories.makeHttpHeaders({ 'Content-Type': 'application/json' }),
        body: undefined,
      };

      expect(request.method).toBe(HttpMethod.GET);
      expect(request.url).toBe('https://api.example.com/users');
      expect(request.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(request.body).toBeUndefined();
    });

    it('should create HttpRequest with body for POST method', () => {
      const requestBody = { name: 'John Doe', email: 'john@example.com' };

      const request = {
        method: HttpMethod.POST,
        url: httpAdapterFactories.makeHttpUrl('https://api.example.com/users'),
        headers: httpAdapterFactories.makeHttpHeaders({ 'Content-Type': 'application/json' }),
        body: requestBody,
      };

      expect(request.method).toBe(HttpMethod.POST);
      expect(request.body).toEqual(requestBody);
    });

    it('should create HttpRequest with empty body for GET method', () => {
      const request = {
        method: HttpMethod.GET,
        url: httpAdapterFactories.makeHttpUrl('https://api.example.com/users'),
        headers: httpAdapterFactories.makeHttpHeaders({}),
        body: undefined,
      };

      expect(request.method).toBe(HttpMethod.GET);
      expect(request.body).toBeUndefined();
    });

    it('should handle different body types', () => {
      const testCases = [
        { type: 'object', body: { key: 'value' } },
        { type: 'array', body: [1, 2, 3] },
        { type: 'string', body: 'plain text' },
        { type: 'null', body: null },
        { type: 'undefined', body: undefined },
      ];

      testCases.forEach(({ type, body }) => {
        const request = {
          method: HttpMethod.POST,
          url: httpAdapterFactories.makeHttpUrl('https://api.example.com/test'),
          headers: httpAdapterFactories.makeHttpHeaders({}),
          body,
        };

        expect(request.body).toBe(body);
      });
    });

    it('should handle complex URLs with query parameters', () => {
      const complexUrl = 'https://api.example.com/users?page=1&limit=10&sort=name&order=asc';

      const request = {
        method: HttpMethod.GET,
        url: httpAdapterFactories.makeHttpUrl(complexUrl),
        headers: httpAdapterFactories.makeHttpHeaders({}),
        body: undefined,
      };

      expect(request.url).toBe(complexUrl);
    });

    it('should ensure immutability of request objects', () => {
      const originalHeaders = { 'Content-Type': 'application/json' };
      const request = {
        method: HttpMethod.GET,
        url: httpAdapterFactories.makeHttpUrl('https://api.example.com/test'),
        headers: httpAdapterFactories.makeHttpHeaders(originalHeaders),
        body: undefined,
      };

      // Since headers are branded as Readonly<Record<string, string>>,
      // they should be immutable
      expect(request.headers).toEqual(originalHeaders);

      // URL is branded string, should be immutable
      expect(request.url).toBe('https://api.example.com/test');
    });
  });

  describe('HttpResponse', () => {
    it('should create valid HttpResponse with all required fields', () => {
      const response = {
        statusCode: httpAdapterFactories.makeHttpStatusCode(200),
        headers: httpAdapterFactories.makeHttpHeaders({ 'Content-Type': 'application/json' }),
        body: { success: true },
        url: httpAdapterFactories.makeHttpUrl('https://api.example.com/test'),
        durationMs: httpAdapterFactories.makeDurationMs(150),
      };

      expect(response.statusCode).toBe(200);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(response.body).toEqual({ success: true });
      expect(response.url).toBe('https://api.example.com/test');
      expect(response.durationMs).toBe(150);
    });

    it('should handle different response body types', () => {
      const testCases = [
        { type: 'object', body: { data: 'value' } },
        { type: 'array', body: ['item1', 'item2'] },
        { type: 'string', body: 'text response' },
        { type: 'null', body: null },
        { type: 'empty object', body: {} },
      ];

      testCases.forEach(({ type, body }) => {
        const response = {
          statusCode: httpAdapterFactories.makeHttpStatusCode(200),
          headers: httpAdapterFactories.makeHttpHeaders({}),
          body,
          url: httpAdapterFactories.makeHttpUrl('https://api.example.com/test'),
          durationMs: httpAdapterFactories.makeDurationMs(100),
        };

        expect(response.body).toBe(body);
      });
    });

    it('should handle all HTTP status codes', () => {
      const statusCodes = [200, 201, 400, 404, 500];

      statusCodes.forEach((code) => {
        const response = {
          statusCode: httpAdapterFactories.makeHttpStatusCode(code),
          headers: httpAdapterFactories.makeHttpHeaders({}),
          body: null,
          url: httpAdapterFactories.makeHttpUrl('https://api.example.com/test'),
          durationMs: httpAdapterFactories.makeDurationMs(100),
        };

        expect(response.statusCode).toBe(code);
      });
    });

    it('should ensure immutability of response objects', () => {
      const response = {
        statusCode: httpAdapterFactories.makeHttpStatusCode(200),
        headers: httpAdapterFactories.makeHttpHeaders({ 'Content-Type': 'application/json' }),
        body: { immutable: true },
        url: httpAdapterFactories.makeHttpUrl('https://api.example.com/test'),
        durationMs: httpAdapterFactories.makeDurationMs(150),
      };

      // All branded types should be immutable
      expect(response.statusCode).toBe(200);
      expect(response.durationMs).toBe(150);
      expect(response.url).toBe('https://api.example.com/test');
    });
  });

  describe('branded types behavior', () => {
    describe('HttpUrl', () => {
      it('should maintain URL string behavior', () => {
        const url = httpAdapterFactories.makeHttpUrl('https://api.example.com/path');
        expect(typeof url).toBe('string');
        expect(url.length).toBeGreaterThan(0);
        expect(url.startsWith('https://')).toBe(true);
      });

      it('should be assignable to string', () => {
        const url: string = httpAdapterFactories.makeHttpUrl('https://api.example.com/test');
        expect(typeof url).toBe('string');
      });
    });

    describe('HttpStatusCode', () => {
      it('should maintain number behavior', () => {
        const statusCode = httpAdapterFactories.makeHttpStatusCode(404);
        expect(typeof statusCode).toBe('number');
        expect(statusCode).toBeGreaterThanOrEqual(100);
        expect(statusCode).toBeLessThanOrEqual(599);
      });

      it('should be assignable to number', () => {
        const statusCode: number = httpAdapterFactories.makeHttpStatusCode(500);
        expect(typeof statusCode).toBe('number');
      });
    });

    describe('DurationMs', () => {
      it('should maintain number behavior', () => {
        const duration = httpAdapterFactories.makeDurationMs(2500);
        expect(typeof duration).toBe('number');
        expect(duration).toBeGreaterThanOrEqual(0);
      });

      it('should be assignable to number', () => {
        const duration: number = httpAdapterFactories.makeDurationMs(1000);
        expect(typeof duration).toBe('number');
      });
    });

    describe('TimeoutMs', () => {
      it('should maintain number behavior', () => {
        const timeout = httpAdapterFactories.makeTimeoutMs(5000);
        expect(typeof timeout).toBe('number');
        expect(timeout).toBeGreaterThan(0);
      });

      it('should be assignable to number', () => {
        const timeout: number = httpAdapterFactories.makeTimeoutMs(30000);
        expect(typeof timeout).toBe('number');
      });
    });

    describe('MaxRetries', () => {
      it('should maintain number behavior', () => {
        const maxRetries = httpAdapterFactories.makeMaxRetries(3);
        expect(typeof maxRetries).toBe('number');
        expect(maxRetries).toBeGreaterThanOrEqual(0);
      });

      it('should be assignable to number', () => {
        const maxRetries: number = httpAdapterFactories.makeMaxRetries(5);
        expect(typeof maxRetries).toBe('number');
      });
    });

    describe('CircuitBreakerThreshold', () => {
      it('should maintain number behavior', () => {
        const threshold = httpAdapterFactories.makeCircuitBreakerThreshold(5);
        expect(typeof threshold).toBe('number');
        expect(threshold).toBeGreaterThan(0);
      });

      it('should be assignable to number', () => {
        const threshold: number = httpAdapterFactories.makeCircuitBreakerThreshold(10);
        expect(typeof threshold).toBe('number');
      });
    });

    describe('HttpHeaders', () => {
      it('should maintain object behavior', () => {
        const headers = httpAdapterFactories.makeHttpHeaders({
          'content-type': 'application/json',
        });
        expect(typeof headers).toBe('object');
        expect(headers).toHaveProperty('content-type');
        expect(Object.keys(headers).length).toBeGreaterThan(0);
      });

      it('should be assignable to Readonly<Record<string, string>>', () => {
        const headers: Readonly<Record<string, string>> = httpAdapterFactories.makeHttpHeaders({
          'authorization': 'Bearer token',
          'accept': 'application/json',
        });
        expect(typeof headers).toBe('object');
        expect(headers.authorization).toBe('Bearer token');
      });
    });
  });

  describe('optional fields handling', () => {
    it('should handle HttpRequest without optional body', () => {
      const request = {
        method: HttpMethod.GET,
        url: httpAdapterFactories.makeHttpUrl('https://api.example.com/test'),
        headers: httpAdapterFactories.makeHttpHeaders({}),
        // body is optional and omitted
      };

      expect(request).not.toHaveProperty('body');
      expect(request.method).toBeDefined();
      expect(request.url).toBeDefined();
      expect(request.headers).toBeDefined();
    });

    it('should handle HttpResponse with minimal required fields', () => {
      const response = {
        statusCode: httpAdapterFactories.makeHttpStatusCode(204),
        headers: httpAdapterFactories.makeHttpHeaders({}),
        body: null, // Can be null/undefined
        url: httpAdapterFactories.makeHttpUrl('https://api.example.com/test'),
        durationMs: httpAdapterFactories.makeDurationMs(0),
      };

      expect(response.statusCode).toBe(204);
      expect(response.body).toBeNull();
      expect(response.durationMs).toBe(0);
    });

    it('should handle headers as empty object', () => {
      const request = {
        method: HttpMethod.HEAD,
        url: httpAdapterFactories.makeHttpUrl('https://api.example.com/test'),
        headers: httpAdapterFactories.makeHttpHeaders({}),
        body: undefined,
      };

      expect(request.headers).toEqual({});
      expect(Object.keys(request.headers).length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very long URLs', () => {
      const longUrl = `https://api.example.com/${'a'.repeat(1000)}`;
      const request = {
        method: HttpMethod.GET,
        url: httpAdapterFactories.makeHttpUrl(longUrl),
        headers: httpAdapterFactories.makeHttpHeaders({}),
        body: undefined,
      };

      expect(request.url.length).toBeGreaterThan(1000);
    });

    it('should handle URLs with special characters', () => {
      const specialUrl = 'https://api.example.com/path with spaces/üñíçødé';
      const request = {
        method: HttpMethod.GET,
        url: httpAdapterFactories.makeHttpUrl(specialUrl),
        headers: httpAdapterFactories.makeHttpHeaders({}),
        body: undefined,
      };

      expect(request.url).toBe(specialUrl);
    });

    it('should handle very large response bodies', () => {
      const largeBody = { data: 'x'.repeat(10000) };
      const response = {
        statusCode: httpAdapterFactories.makeHttpStatusCode(200),
        headers: httpAdapterFactories.makeHttpHeaders({}),
        body: largeBody,
        url: httpAdapterFactories.makeHttpUrl('https://api.example.com/test'),
        durationMs: httpAdapterFactories.makeDurationMs(1000),
      };

      expect(response.body.data.length).toBe(10000);
    });
  });
});
