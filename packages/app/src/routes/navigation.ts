/**
 * @file packages/app/src/routes/navigation.ts
 *
 * =============================================================================
 * 🧭 NAVIGATION — КОНФИГУРАЦИЯ НАВИГАЦИИ (SIDEBAR / HEADER / MOBILE)
 * =============================================================================
 *
 * Финальная, устойчивая и дальновидная версия навигационного контракта.
 * Является единым источником истины для:
 * - UI (Sidebar, Header, Mobile navigation)
 * - API (NavigationCapabilities /me/navigation)
 * - SSR / Edge / Workers
 *
 * Архитектурные принципы:
 * - 🧱 Stable contract (Core ↔ UI ↔ API)
 * - 🚫 Нет side-effects — только декларация и чистые функции
 * - 🧠 Полная зависимость от route-meta (Single Source of Truth)
 * - 🔐 Security-first: навигация = отражение реальных прав
 * - 📦 Микросервисная пригодность (JSON-safe)
 */

import { canAccessRouteByName } from './route-meta.js';
import type { FeatureFlags } from './route-meta.js';
import { RouteNames } from './routes.js';
import type { RouteName } from './routes.js';
import { UserRoles } from '../types/common.js';

/* ========================================================================== */
/* 🧩 NAVIGATION DOMAIN */
/* ========================================================================== */

/** Где отображается элемент навигации */
export type NavigationPlacement = 'sidebar' | 'header' | 'mobile';

/** Тип элемента навигации */
export type NavigationItemType = 'link' | 'group' | 'divider';

/** Источник данных для badge */
export type NavigationBadgeSource = 'api' | 'state';

/** Badge (уведомления, счётчики, индикаторы) */
export type NavigationBadge = {
  readonly type: 'count' | 'dot';
  readonly source: NavigationBadgeSource;
};

/** Базовый контракт навигационного элемента */
type BaseNavigationItem = {
  /** Stable ID (используется как key, analytics, ACL) */
  readonly id: string;

  /** Тип элемента */
  readonly type: NavigationItemType;

  /** Заголовок для UI */
  readonly title?: string;

  /** Иконка (UI сам решает как рендерить) */
  readonly icon?: string;

  /** Где элемент должен отображаться */
  readonly placement?: readonly NavigationPlacement[];

  /** Принудительно скрыт (A/B, эксперименты) */
  readonly hidden?: boolean;

  /** Дополнительное описание (tooltip, a11y) */
  readonly description?: string;
};

/** Навигационная ссылка */
export type NavigationLink = BaseNavigationItem & {
  readonly type: 'link';

  /** Имя маршрута (строго из RouteNames) */
  readonly route: RouteName;

  /** Badge (опционально) */
  readonly badge?: NavigationBadge;

  /** Внешняя ссылка */
  readonly external?: boolean;
};

/** Навигационная группа */
export type NavigationGroup = BaseNavigationItem & {
  readonly type: 'group';

  /** Дочерние элементы */
  readonly children: readonly NavigationItem[];
};

/** Разделитель */
// Divider не проверяет access и placement.
// Его видимость определяется контекстом окружения.
export type NavigationDivider = BaseNavigationItem & {
  readonly type: 'divider';
};

/** Union всех навигационных элементов */
export type NavigationItem =
  | NavigationLink
  | NavigationGroup
  | NavigationDivider;

/* ========================================================================== */
/* 🗂️ NAVIGATION DEFINITIONS */
/* ========================================================================== */

/**
 * Декларативное описание навигации приложения.
 * Порядок элементов = порядок отображения.
 */
export const NAVIGATION: readonly NavigationItem[] = [
  /* ---------------------------------------------------------------------- */
  /* 🔑 АККАУНТ */
  /* ---------------------------------------------------------------------- */
  {
    id: 'account',
    type: 'group',
    title: 'Аккаунт',
    icon: 'user',
    placement: ['sidebar', 'mobile'],
    children: [
      {
        id: 'login',
        type: 'link',
        title: 'Вход',
        route: RouteNames.LOGIN,
      },
      {
        id: 'profile',
        type: 'link',
        title: 'Профиль',
        route: RouteNames.PROFILE,
      },
      {
        id: 'logout',
        type: 'link',
        title: 'Выход',
        route: RouteNames.LOGOUT,
      },
    ],
  },

  { id: 'div-1', type: 'divider' },

  /* ---------------------------------------------------------------------- */
  /* 🤖 БОТЫ */
  /* ---------------------------------------------------------------------- */
  {
    id: 'bots',
    type: 'group',
    title: 'Боты',
    icon: 'bot',
    placement: ['sidebar', 'mobile'],
    children: [
      {
        id: 'bots-list',
        type: 'link',
        title: 'Мои боты',
        route: RouteNames.BOTS_LIST,
      },
      {
        id: 'bots-create',
        type: 'link',
        title: 'Создать бота',
        route: RouteNames.BOTS_CREATE,
      },
    ],
  },

  /* ---------------------------------------------------------------------- */
  /* 💬 ЧАТЫ */
  /* ---------------------------------------------------------------------- */
  {
    id: 'chat',
    type: 'group',
    title: 'Чаты',
    icon: 'chat',
    placement: ['sidebar', 'mobile'],
    children: [
      {
        id: 'chat-list',
        type: 'link',
        title: 'Все чаты',
        route: RouteNames.CHAT_LIST,
        badge: { type: 'count', source: 'state' },
      },
    ],
  },

  { id: 'div-2', type: 'divider' },

  /* ---------------------------------------------------------------------- */
  /* 💳 БИЛЛИНГ */
  /* ---------------------------------------------------------------------- */
  {
    id: 'billing',
    type: 'group',
    title: 'Биллинг',
    icon: 'credit-card',
    placement: ['sidebar'],
    children: [
      {
        id: 'billing-dashboard',
        type: 'link',
        title: 'Обзор',
        route: RouteNames.BILLING_DASHBOARD,
      },
      {
        id: 'billing-usage',
        type: 'link',
        title: 'Использование',
        route: RouteNames.BILLING_USAGE,
      },
    ],
  },
];

/* ========================================================================== */
/* 🔧 NAVIGATION FILTERING & CAPABILITIES */
/* ========================================================================== */

/** Контекст фильтрации навигации */
export type NavigationContext = {
  readonly isAuthenticated: boolean;
  readonly roles: readonly UserRoles[];
  readonly featureFlags?: readonly FeatureFlags[];
  readonly placement?: NavigationPlacement;
};

/** Проверка доступности ссылки */
function isLinkAccessible(
  link: NavigationLink,
  ctx: NavigationContext,
): boolean {
  return canAccessRouteByName(link.route, ctx.roles, ctx.featureFlags);
}

/** Рекурсивная фильтрация навигации */
function filterItem(
  item: NavigationItem,
  ctx: NavigationContext,
): NavigationItem | null {
  if (item.hidden === true) return null;

  if (ctx.placement && item.placement && !item.placement.includes(ctx.placement)) {
    return null;
  }

  switch (item.type) {
    case 'divider':
      return item;

    case 'link':
      return isLinkAccessible(item, ctx) ? item : null;

    case 'group': {
      const children = item.children
        .map((c) => filterItem(c, ctx))
        .filter(Boolean) as NavigationItem[];

      return children.length > 0 ? { ...item, children } : null;
    }
  }
}

/**
 * Возвращает навигацию, доступную пользователю.
 * Используется напрямую в UI и API.
 */
export function getNavigationForContext(
  ctx: NavigationContext,
): readonly NavigationItem[] {
  const filtered = NAVIGATION
    .map((item) => filterItem(item, ctx))
    .filter(Boolean) as NavigationItem[];

  if (filtered.length === 0) return filtered;

  // Post-processing: убираем divider в начале/конце и двойные divider
  if (filtered.length === 0) return filtered;

  let result = filtered;

  // Убираем divider в начале
  const firstNonDividerIndex = result.findIndex((item) => item.type !== 'divider');
  if (firstNonDividerIndex > 0) {
    result = result.slice(firstNonDividerIndex);
  }

  // Убираем divider в конце
  const lastNonDividerIndex = result
    .map((item, index) => ({ item, index }))
    .reverse()
    .find(({ item }) => item.type !== 'divider')?.index;

  if (lastNonDividerIndex !== undefined && lastNonDividerIndex < result.length - 1) {
    result = result.slice(0, lastNonDividerIndex + 1);
  }

  // Убираем двойные divider
  result = result.reduce<NavigationItem[]>((acc, item) => {
    if (item.type === 'divider' && acc.length > 0 && acc[acc.length - 1]?.type === 'divider') {
      return acc; // Пропускаем двойной divider
    }
    return [...acc, item];
  }, []);

  return result;
}

/* ========================================================================== */
/* 🔍 CONSISTENCY VALIDATION */
/* ========================================================================== */

function logWarningOrThrow(message: string): void {
  if (process.env['NODE_ENV'] !== 'production') {
    throw new Error(message);
  } else {
    // eslint-disable-next-line no-console
    console.warn('Navigation validation warning:', message);
  }
}

/** Проверка консистентности navigation ↔ routes */
function validateNavigation(): void {
  const routeSet = new Set(Object.values(RouteNames));

  const walk = (items: readonly NavigationItem[]): void => {
    for (const item of items) {
      if (item.type === 'link' && !routeSet.has(item.route)) {
        logWarningOrThrow(
          `Navigation item "${item.id}" ссылается на неизвестный route: ${item.route}`,
        );
      }
      if (item.type === 'group') walk(item.children);
    }
  };

  walk(NAVIGATION);
}

// Fail-fast
validateNavigation();
