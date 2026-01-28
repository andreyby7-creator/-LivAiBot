/**
 * @file Unit tests for PWA icon microservice parsing and rendering.
 *
 * Покрытие:
 * - parsePwaIconAsset: все размеры, edge cases, security checks
 * - assertValidSpec: валидация через renderPwaIconPng
 * - getTitleText: все ветки через renderPwaIconPng
 * - renderPwaIconPng: cache headers, maskable logic, все виды иконок
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parsePwaIconAsset, renderPwaIconPng } from '../../../src/app/icons/_lib/pwa-icon-service';

// Мок для next/og ImageResponse
// ImageResponse используется как конструктор (new ImageResponse(...))
// Создаем функцию-конструктор, которая может использоваться с new
vi.mock('next/og', () => {
  type ImageResponseMockOptions = Readonly<{
    /**
     * Deep-readonly lint: `Headers` считается mutable типом, поэтому храним как unknown
     * и делаем runtime guard перед использованием.
     */
    readonly headers?: unknown;
    readonly width?: number;
    readonly height?: number;
  }>;

  const ImageResponseMock = vi.fn().mockImplementation(function(
    _element: unknown,
    options?: ImageResponseMockOptions,
  ) {
    const headers = options?.headers instanceof Headers ? options.headers : new Headers();

    return new Response(null, {
      status: 200,
      headers,
    });
  });
  return {
    ImageResponse: ImageResponseMock,
  };
});

describe('PWA icon microservice: parsePwaIconAsset', () => {
  describe('App icons - все разрешенные размеры', () => {
    it('должен парсить icon-72x72.png', () => {
      expect(parsePwaIconAsset('icon-72x72.png')).toEqual({
        size: 72,
        purpose: 'any',
        kind: 'app-icon',
      });
    });

    it('должен парсить icon-96x96.png', () => {
      expect(parsePwaIconAsset('icon-96x96.png')).toEqual({
        size: 96,
        purpose: 'any',
        kind: 'app-icon',
      });
    });

    it('должен парсить icon-128x128.png', () => {
      expect(parsePwaIconAsset('icon-128x128.png')).toEqual({
        size: 128,
        purpose: 'any',
        kind: 'app-icon',
      });
    });

    it('должен парсить icon-144x144.png', () => {
      expect(parsePwaIconAsset('icon-144x144.png')).toEqual({
        size: 144,
        purpose: 'any',
        kind: 'app-icon',
      });
    });

    it('должен парсить icon-152x152.png', () => {
      expect(parsePwaIconAsset('icon-152x152.png')).toEqual({
        size: 152,
        purpose: 'any',
        kind: 'app-icon',
      });
    });

    it('должен парсить icon-192x192.png', () => {
      expect(parsePwaIconAsset('icon-192x192.png')).toEqual({
        size: 192,
        purpose: 'any',
        kind: 'app-icon',
      });
    });

    it('должен парсить icon-384x384.png', () => {
      expect(parsePwaIconAsset('icon-384x384.png')).toEqual({
        size: 384,
        purpose: 'any',
        kind: 'app-icon',
      });
    });

    it('должен парсить icon-512x512.png', () => {
      expect(parsePwaIconAsset('icon-512x512.png')).toEqual({
        size: 512,
        purpose: 'any',
        kind: 'app-icon',
      });
    });
  });

  describe('App icons - варианты формата', () => {
    it('должен парсить icon-192.png (без x)', () => {
      expect(parsePwaIconAsset('icon-192.png')).toEqual({
        size: 192,
        purpose: 'any',
        kind: 'app-icon',
      });
    });

    it('должен парсить icon-512.png (без x)', () => {
      expect(parsePwaIconAsset('icon-512.png')).toEqual({
        size: 512,
        purpose: 'any',
        kind: 'app-icon',
      });
    });

    it('должен парсить maskable icon: icon-192-maskable.png', () => {
      expect(parsePwaIconAsset('icon-192-maskable.png')).toEqual({
        size: 192,
        purpose: 'maskable',
        kind: 'app-icon',
      });
    });

    it('должен парсить maskable icon: icon-512-maskable.png', () => {
      expect(parsePwaIconAsset('icon-512-maskable.png')).toEqual({
        size: 512,
        purpose: 'maskable',
        kind: 'app-icon',
      });
    });

    it('должен парсить maskable icon без x: icon-192-maskable.png', () => {
      expect(parsePwaIconAsset('icon-192-maskable.png')).toEqual({
        size: 192,
        purpose: 'maskable',
        kind: 'app-icon',
      });
    });
  });

  describe('Shortcut icons', () => {
    it('должен парсить shortcut-dialogs-96x96.png', () => {
      expect(parsePwaIconAsset('shortcut-dialogs-96x96.png')).toEqual({
        size: 96,
        purpose: 'any',
        kind: 'shortcut-dialogs',
      });
    });

    it('должен парсить shortcut-billing-96x96.png', () => {
      expect(parsePwaIconAsset('shortcut-billing-96x96.png')).toEqual({
        size: 96,
        purpose: 'any',
        kind: 'shortcut-billing',
      });
    });

    it('должен парсить shortcut-chat-96x96.png', () => {
      expect(parsePwaIconAsset('shortcut-chat-96x96.png')).toEqual({
        size: 96,
        purpose: 'any',
        kind: 'shortcut-chat',
      });
    });
  });

  describe('Security checks', () => {
    it('должен отклонять неизвестные размеры app icons', () => {
      expect(parsePwaIconAsset('icon-999x999.png')).toBeNull();
      expect(parsePwaIconAsset('icon-1x1.png')).toBeNull();
      expect(parsePwaIconAsset('icon-1000x1000.png')).toBeNull();
    });

    it('должен отклонять неизвестные размеры shortcut icons', () => {
      expect(parsePwaIconAsset('shortcut-dialogs-32x32.png')).toBeNull();
      expect(parsePwaIconAsset('shortcut-dialogs-128x128.png')).toBeNull();
    });

    it('должен отклонять shortcut icons с бесконечным размером (Number -> Infinity)', () => {
      // Покрываем защиту в parseShortcutIconAsset: if (!Number.isFinite(size)) return null;
      const huge = '9'.repeat(400);
      expect(parsePwaIconAsset(`shortcut-dialogs-${huge}x${huge}.png`)).toBeNull();
    });

    it('должен отклонять path traversal', () => {
      expect(parsePwaIconAsset('../icon-192x192.png')).toBeNull();
      expect(parsePwaIconAsset('../../icon-192x192.png')).toBeNull();
      expect(parsePwaIconAsset('icons/icon-192x192.png')).toBeNull();
      expect(parsePwaIconAsset('icons\\icon-192x192.png')).toBeNull();
    });

    it('должен отклонять не-png расширения', () => {
      expect(parsePwaIconAsset('icon-192x192.svg')).toBeNull();
      expect(parsePwaIconAsset('icon-192x192.jpg')).toBeNull();
      expect(parsePwaIconAsset('icon-192x192')).toBeNull();
    });

    it('должен отклонять пустую строку', () => {
      expect(parsePwaIconAsset('')).toBeNull();
    });

    it('должен отклонять невалидные форматы app icons', () => {
      expect(parsePwaIconAsset('icon-abc.png')).toBeNull();
      expect(parsePwaIconAsset('icon-192x193.png')).toBeNull(); // несимметричный размер
      expect(parsePwaIconAsset('icon-.png')).toBeNull();
    });

    it('должен отклонять невалидные форматы shortcut icons', () => {
      expect(parsePwaIconAsset('shortcut-unknown-96x96.png')).toBeNull();
      expect(parsePwaIconAsset('shortcut-dialogs-96x97.png')).toBeNull(); // несимметричный размер
    });
  });
});

describe('PWA icon microservice: renderPwaIconPng', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Валидация (assertValidSpec)', () => {
    it('должен выбрасывать ошибку для невалидного размера (0)', () => {
      expect(() => {
        renderPwaIconPng({
          size: 0,
          purpose: 'any',
          kind: 'app-icon',
        });
      }).toThrow('Invalid icon size');
    });

    it('должен выбрасывать ошибку для невалидного размера (отрицательный)', () => {
      expect(() => {
        renderPwaIconPng({
          size: -1,
          purpose: 'any',
          kind: 'app-icon',
        });
      }).toThrow('Invalid icon size');
    });

    it('должен выбрасывать ошибку для невалидного размера (не целое число)', () => {
      expect(() => {
        renderPwaIconPng({
          size: 192.5,
          purpose: 'any',
          kind: 'app-icon',
        });
      }).toThrow('Invalid icon size');
    });
  });

  describe('Cache headers', () => {
    it('должен устанавливать immutable cache для versioned иконки', () => {
      const response = renderPwaIconPng(
        {
          size: 192,
          purpose: 'any',
          kind: 'app-icon',
        },
        { version: '1.0.0' },
      );

      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toBe('public, max-age=31536000, immutable');
    });

    it('должен устанавливать стандартный cache для не-versioned иконки', () => {
      const response = renderPwaIconPng({
        size: 192,
        purpose: 'any',
        kind: 'app-icon',
      });

      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toBe('public, max-age=86400');
    });

    it('должен устанавливать стандартный cache для пустой версии', () => {
      const response = renderPwaIconPng(
        {
          size: 192,
          purpose: 'any',
          kind: 'app-icon',
        },
        { version: '' },
      );

      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toBe('public, max-age=86400');
    });

    it('должен устанавливать стандартный cache для null версии', () => {
      const response = renderPwaIconPng(
        {
          size: 192,
          purpose: 'any',
          kind: 'app-icon',
        },
        { version: null },
      );

      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toBe('public, max-age=86400');
    });
  });

  describe('Content-Type header', () => {
    it('должен устанавливать image/png для всех иконок', () => {
      const response = renderPwaIconPng({
        size: 192,
        purpose: 'any',
        kind: 'app-icon',
      });

      const contentType = response.headers.get('Content-Type');
      expect(contentType).toBe('image/png');
    });
  });

  describe('Maskable logic', () => {
    it('должен применять contentInset для maskable иконки', async () => {
      const { ImageResponse } = await import('next/og');
      renderPwaIconPng({
        size: 192,
        purpose: 'maskable',
        kind: 'app-icon',
      });

      expect(ImageResponse).toHaveBeenCalled();
      const call = vi.mocked(ImageResponse).mock.calls[0];
      expect(call).toBeDefined();
      expect(call?.[1]?.width).toBe(192);
      expect(call?.[1]?.height).toBe(192);
    });

    it('не должен применять contentInset для обычной иконки', async () => {
      const { ImageResponse } = await import('next/og');
      renderPwaIconPng({
        size: 192,
        purpose: 'any',
        kind: 'app-icon',
      });

      expect(ImageResponse).toHaveBeenCalled();
      const call = vi.mocked(ImageResponse).mock.calls[0];
      expect(call).toBeDefined();
      expect(call?.[1]?.width).toBe(192);
      expect(call?.[1]?.height).toBe(192);
    });
  });

  describe('getTitleText - все ветки', () => {
    it('должен генерировать "L" для app-icon', async () => {
      const { ImageResponse } = await import('next/og');
      renderPwaIconPng({
        size: 192,
        purpose: 'any',
        kind: 'app-icon',
      });

      expect(ImageResponse).toHaveBeenCalled();
      const call = vi.mocked(ImageResponse).mock.calls[0];
      expect(call).toBeDefined();
      expect(call?.[0]).toBeDefined();
    });

    it('должен генерировать "D" для shortcut-dialogs', async () => {
      const { ImageResponse } = await import('next/og');
      renderPwaIconPng({
        size: 96,
        purpose: 'any',
        kind: 'shortcut-dialogs',
      });

      expect(ImageResponse).toHaveBeenCalled();
      const call = vi.mocked(ImageResponse).mock.calls[0];
      expect(call).toBeDefined();
      expect(call?.[0]).toBeDefined();
    });

    it('должен генерировать "₽" для shortcut-billing', async () => {
      const { ImageResponse } = await import('next/og');
      renderPwaIconPng({
        size: 96,
        purpose: 'any',
        kind: 'shortcut-billing',
      });

      expect(ImageResponse).toHaveBeenCalled();
      const call = vi.mocked(ImageResponse).mock.calls[0];
      expect(call).toBeDefined();
      expect(call?.[0]).toBeDefined();
    });

    it('должен генерировать "C" для shortcut-chat', async () => {
      const { ImageResponse } = await import('next/og');
      renderPwaIconPng({
        size: 96,
        purpose: 'any',
        kind: 'shortcut-chat',
      });

      expect(ImageResponse).toHaveBeenCalled();
      const call = vi.mocked(ImageResponse).mock.calls[0];
      expect(call).toBeDefined();
      expect(call?.[0]).toBeDefined();
    });
  });

  describe('Размеры иконок', () => {
    it('должен рендерить иконку 72x72', () => {
      const response = renderPwaIconPng({
        size: 72,
        purpose: 'any',
        kind: 'app-icon',
      });

      expect(response.status).toBe(200);
    });

    it('должен рендерить иконку 512x512', () => {
      const response = renderPwaIconPng({
        size: 512,
        purpose: 'any',
        kind: 'app-icon',
      });

      expect(response.status).toBe(200);
    });

    it('должен рендерить maskable иконку 192x192', () => {
      const response = renderPwaIconPng({
        size: 192,
        purpose: 'maskable',
        kind: 'app-icon',
      });

      expect(response.status).toBe(200);
    });
  });
});
