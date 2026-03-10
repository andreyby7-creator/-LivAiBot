/**
 * @file Unit тесты для packages/app/src/lib/route-access.ts
 * Полное покрытие всех функций и веток исполнения (100%)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { canAccessRoute } from '../../../src/lib/route-access.js';

/* ============================================================================
 * 🧠 MOCKS
 * ============================================================================
 */

// Мокаем checkRoutePermission из core
vi.mock('@livai/core/access-control/route-permissions', () => ({
  checkRoutePermission: vi.fn(),
}));

import { checkRoutePermission } from '@livai/core/access-control/route-permissions';

const mockCheckRoutePermission = vi.mocked(checkRoutePermission);

/* ============================================================================
 * 🧹 SETUP И TEARDOWN
 * ============================================================================
 */

beforeEach(() => {
  vi.clearAllMocks();
  // Восстанавливаем window для каждого теста
  delete (global as any).window;
});

/* ============================================================================
 * 🎯 CANACCESSROUTE - БРАУЗЕРНОЕ ОКРУЖЕНИЕ
 * ============================================================================
 */

describe('canAccessRoute - браузерное окружение', () => {
  beforeEach(() => {
    // Устанавливаем window для браузерного окружения
    (global as any).window = {};
  });

  describe('определение типа маршрута по пути', () => {
    it('определяет public маршрут для null', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'PUBLIC_ROUTE' });

      const result = canAccessRoute(null as any);

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'public', path: null }),
        expect.any(Object),
      );
    });

    it('определяет public маршрут для undefined', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'PUBLIC_ROUTE' });

      const result = canAccessRoute(undefined as any);

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'public', path: undefined }),
        expect.any(Object),
      );
    });

    it('определяет public маршрут для не-string значения', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'PUBLIC_ROUTE' });

      const result = canAccessRoute(123 as any);

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'public' }),
        expect.any(Object),
      );
    });

    it('определяет public маршрут для пустой строки', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'PUBLIC_ROUTE' });

      const result = canAccessRoute('');

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'public', path: '' }),
        expect.any(Object),
      );
    });

    it('определяет public маршрут для строки только с пробелами', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'PUBLIC_ROUTE' });

      const result = canAccessRoute('   ');

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'public', path: '   ' }),
        expect.any(Object),
      );
    });

    it('определяет auth маршрут для /login', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'GUEST_ACCESS_ALLOWED' });

      const result = canAccessRoute('/login');

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'auth', path: '/login' }),
        expect.any(Object),
      );
    });

    it('определяет auth маршрут для /register', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'GUEST_ACCESS_ALLOWED' });

      const result = canAccessRoute('/register');

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'auth', path: '/register' }),
        expect.any(Object),
      );
    });

    it('определяет auth маршрут для /auth', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'GUEST_ACCESS_ALLOWED' });

      const result = canAccessRoute('/auth');

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'auth', path: '/auth' }),
        expect.any(Object),
      );
    });

    it('определяет auth маршрут для /auth/login', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'GUEST_ACCESS_ALLOWED' });

      const result = canAccessRoute('/auth/login');

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'auth', path: '/auth/login' }),
        expect.any(Object),
      );
    });

    it('определяет dashboard маршрут для /dashboard', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: false, reason: 'AUTH_REQUIRED' });

      const result = canAccessRoute('/dashboard');

      expect(result).toBe(false);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dashboard', path: '/dashboard' }),
        expect.any(Object),
      );
    });

    it('определяет dashboard маршрут для /dashboard/settings', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: false, reason: 'AUTH_REQUIRED' });

      const result = canAccessRoute('/dashboard/settings');

      expect(result).toBe(false);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dashboard', path: '/dashboard/settings' }),
        expect.any(Object),
      );
    });

    it('определяет admin маршрут для /admin', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: false, reason: 'AUTH_REQUIRED' });

      const result = canAccessRoute('/admin');

      expect(result).toBe(false);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'admin', path: '/admin' }),
        expect.any(Object),
      );
    });

    it('определяет admin маршрут для /admin/users', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: false, reason: 'AUTH_REQUIRED' });

      const result = canAccessRoute('/admin/users');

      expect(result).toBe(false);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'admin', path: '/admin/users' }),
        expect.any(Object),
      );
    });

    it('определяет api маршрут для /api', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: false, reason: 'AUTH_REQUIRED' });

      const result = canAccessRoute('/api');

      expect(result).toBe(false);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'api', path: '/api' }),
        expect.any(Object),
      );
    });

    it('определяет api маршрут для /api/users', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: false, reason: 'AUTH_REQUIRED' });

      const result = canAccessRoute('/api/users');

      expect(result).toBe(false);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'api', path: '/api/users' }),
        expect.any(Object),
      );
    });

    it('определяет profile маршрут для /profile', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: false, reason: 'AUTH_REQUIRED' });

      const result = canAccessRoute('/profile');

      expect(result).toBe(false);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'profile', path: '/profile' }),
        expect.any(Object),
      );
    });

    it('определяет profile маршрут для /profile/edit', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: false, reason: 'AUTH_REQUIRED' });

      const result = canAccessRoute('/profile/edit');

      expect(result).toBe(false);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'profile', path: '/profile/edit' }),
        expect.any(Object),
      );
    });

    it('определяет settings маршрут для /settings', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: false, reason: 'AUTH_REQUIRED' });

      const result = canAccessRoute('/settings');

      expect(result).toBe(false);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'settings', path: '/settings' }),
        expect.any(Object),
      );
    });

    it('определяет settings маршрут для /settings/account', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: false, reason: 'AUTH_REQUIRED' });

      const result = canAccessRoute('/settings/account');

      expect(result).toBe(false);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'settings', path: '/settings/account' }),
        expect.any(Object),
      );
    });

    it('определяет public маршрут для неизвестного пути', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'PUBLIC_ROUTE' });

      const result = canAccessRoute('/unknown/path');

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'public', path: '/unknown/path' }),
        expect.any(Object),
      );
    });

    it('определяет public маршрут для корневого пути', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'PUBLIC_ROUTE' });

      const result = canAccessRoute('/');

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'public', path: '/' }),
        expect.any(Object),
      );
    });
  });

  describe('проверка доступа через checkRoutePermission', () => {
    it('возвращает true когда checkRoutePermission разрешает доступ', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'EXPLICIT_ALLOW' });

      const result = canAccessRoute('/dashboard');

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledTimes(1);
    });

    it('возвращает false когда checkRoutePermission запрещает доступ', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: false, reason: 'AUTH_REQUIRED' });

      const result = canAccessRoute('/dashboard');

      expect(result).toBe(false);
      expect(mockCheckRoutePermission).toHaveBeenCalledTimes(1);
    });

    it('передает правильный контекст в checkRoutePermission', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'EXPLICIT_ALLOW' });

      canAccessRoute('/test');

      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          requestId: 'ui-check',
          isAuthenticated: false,
          isAdminMode: false,
        }),
      );
    });

    it('передает правильный RouteInfo в checkRoutePermission', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'EXPLICIT_ALLOW' });

      canAccessRoute('/dashboard/settings');

      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        {
          type: 'dashboard',
          path: '/dashboard/settings',
        },
        expect.any(Object),
      );
    });
  });

  describe('обработка путей с пробелами', () => {
    it('trim-ит путь перед определением типа', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'PUBLIC_ROUTE' });

      const result = canAccessRoute('  /dashboard  ');

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dashboard', path: '  /dashboard  ' }),
        expect.any(Object),
      );
    });

    it('trim-ит путь перед проверкой AUTH_ROUTES', () => {
      mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'GUEST_ACCESS_ALLOWED' });

      const result = canAccessRoute('  /login  ');

      expect(result).toBe(true);
      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'auth', path: '  /login  ' }),
        expect.any(Object),
      );
    });
  });
});

/* ============================================================================
 * 🎯 CANACCESSROUTE - SSR ОКРУЖЕНИЕ
 * ============================================================================
 */

describe('canAccessRoute - SSR окружение', () => {
  beforeEach(() => {
    // Удаляем window для SSR окружения
    delete (global as any).window;
  });

  it('разрешает доступ к public маршруту в SSR', () => {
    const result = canAccessRoute('/');

    expect(result).toBe(true);
    expect(mockCheckRoutePermission).not.toHaveBeenCalled();
  });

  it('разрешает доступ к auth маршруту в SSR', () => {
    const result = canAccessRoute('/login');

    expect(result).toBe(true);
    expect(mockCheckRoutePermission).not.toHaveBeenCalled();
  });

  it('разрешает доступ к /auth маршруту в SSR', () => {
    const result = canAccessRoute('/auth');

    expect(result).toBe(true);
    expect(mockCheckRoutePermission).not.toHaveBeenCalled();
  });

  it('запрещает доступ к dashboard маршруту в SSR', () => {
    const result = canAccessRoute('/dashboard');

    expect(result).toBe(false);
    expect(mockCheckRoutePermission).not.toHaveBeenCalled();
  });

  it('запрещает доступ к admin маршруту в SSR', () => {
    const result = canAccessRoute('/admin');

    expect(result).toBe(false);
    expect(mockCheckRoutePermission).not.toHaveBeenCalled();
  });

  it('запрещает доступ к api маршруту в SSR', () => {
    const result = canAccessRoute('/api');

    expect(result).toBe(false);
    expect(mockCheckRoutePermission).not.toHaveBeenCalled();
  });

  it('запрещает доступ к profile маршруту в SSR', () => {
    const result = canAccessRoute('/profile');

    expect(result).toBe(false);
    expect(mockCheckRoutePermission).not.toHaveBeenCalled();
  });

  it('запрещает доступ к settings маршруту в SSR', () => {
    const result = canAccessRoute('/settings');

    expect(result).toBe(false);
    expect(mockCheckRoutePermission).not.toHaveBeenCalled();
  });

  it('разрешает доступ к неизвестному маршруту в SSR (считается public)', () => {
    const result = canAccessRoute('/unknown');

    expect(result).toBe(true);
    expect(mockCheckRoutePermission).not.toHaveBeenCalled();
  });

  it('разрешает доступ к /register в SSR', () => {
    const result = canAccessRoute('/register');

    expect(result).toBe(true);
    expect(mockCheckRoutePermission).not.toHaveBeenCalled();
  });
});

/* ============================================================================
 * 🎯 EDGE CASES И ПОКРЫТИЕ ВСЕХ ВЕТОК
 * ============================================================================
 */

describe('canAccessRoute - edge cases', () => {
  beforeEach(() => {
    (global as any).window = {};
  });

  it('обрабатывает путь с ведущими пробелами', () => {
    mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'PUBLIC_ROUTE' });

    const result = canAccessRoute('   /test');

    expect(result).toBe(true);
    expect(mockCheckRoutePermission).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'public', path: '   /test' }),
      expect.any(Object),
    );
  });

  it('обрабатывает путь с завершающими пробелами', () => {
    mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'PUBLIC_ROUTE' });

    const result = canAccessRoute('/test   ');

    expect(result).toBe(true);
    expect(mockCheckRoutePermission).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'public', path: '/test   ' }),
      expect.any(Object),
    );
  });

  it('обрабатывает путь с пробелами с обеих сторон', () => {
    mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'PUBLIC_ROUTE' });

    const result = canAccessRoute('   /test   ');

    expect(result).toBe(true);
    expect(mockCheckRoutePermission).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'public', path: '   /test   ' }),
      expect.any(Object),
    );
  });

  it('правильно определяет тип маршрута при совпадении префиксов (более специфичный первым)', () => {
    // /auth/login должен быть auth, а не dashboard
    mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'GUEST_ACCESS_ALLOWED' });

    const result = canAccessRoute('/auth/login');

    expect(result).toBe(true);
    expect(mockCheckRoutePermission).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth' }),
      expect.any(Object),
    );
  });

  it('обрабатывает вложенные пути для всех типов маршрутов', () => {
    const testCases = [
      { path: '/dashboard/analytics', expectedType: 'dashboard' },
      { path: '/admin/users/123', expectedType: 'admin' },
      { path: '/api/v1/data', expectedType: 'api' },
      { path: '/profile/settings', expectedType: 'profile' },
      { path: '/settings/security', expectedType: 'settings' },
    ];

    testCases.forEach(({ path, expectedType }) => {
      mockCheckRoutePermission.mockReturnValue({ allowed: false, reason: 'AUTH_REQUIRED' });

      canAccessRoute(path);

      expect(mockCheckRoutePermission).toHaveBeenCalledWith(
        expect.objectContaining({ type: expectedType, path }),
        expect.any(Object),
      );
    });
  });

  it('создает контекст с правильными значениями по умолчанию', () => {
    mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'EXPLICIT_ALLOW' });

    canAccessRoute('/test');

    const callArgs = mockCheckRoutePermission.mock.calls[0];
    const context = callArgs![1];

    expect(context).toEqual({
      requestId: 'ui-check',
      isAuthenticated: false,
      isAdminMode: false,
    });
  });

  it('не вызывает checkRoutePermission в SSR для любого маршрута', () => {
    delete (global as any).window;

    canAccessRoute('/dashboard');
    canAccessRoute('/admin');
    canAccessRoute('/api');
    canAccessRoute('/profile');
    canAccessRoute('/settings');
    canAccessRoute('/public');

    expect(mockCheckRoutePermission).not.toHaveBeenCalled();
  });

  it('вызывает checkRoutePermission в браузерном окружении', () => {
    (global as any).window = {};

    mockCheckRoutePermission.mockReturnValue({ allowed: true, reason: 'EXPLICIT_ALLOW' });

    canAccessRoute('/test');

    expect(mockCheckRoutePermission).toHaveBeenCalledTimes(1);
  });
});
