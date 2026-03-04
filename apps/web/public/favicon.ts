/**
 * @file apps/web/public/favicon.ts
 * ============================================================================
 * 🟢 FAVICON & PWA ICON MICROSERVICE
 * ============================================================================
 * Микросервис для управления favicon, PWA icons и splash screens:
 * - Автоматическая вставка всех размеров и форматов (ICO, PNG, Apple Touch Icon)
 * - Dark/light mode динамика
 * - Версионирование и кэш-контроль
 * - Поддержка splash screens для iOS/Android
 * - Telemetry-ready
 * - Graceful degradation для SSR/Node
 * - Feature flag для динамики и отключения
 * Принципы:
 * - Zero business logic
 * - Immutable configuration
 * - Full TypeScript
 */

/* ============================================================================
 * 🧬 TYPES & CONFIG
 * ========================================================================== */

type IconConfig = {
  url: string;
  sizes?: string;
  type?: string;
  rel?: string;
  darkMode?: boolean;
  version?: string;
};

type ManifestConfig = {
  url: string;
  version?: string;
};

type SplashConfig = {
  url: string;
  media: string;
  version?: string;
};

type FaviconServiceConfig = {
  icons?: IconConfig[];
  appleIcons?: IconConfig[];
  manifest?: ManifestConfig;
  splashScreens?: SplashConfig[];
  dynamic?: boolean;
  enabled?: boolean; // глобальный feature flag
  debug?: boolean; // флаг для debug логирования
  autoInject?: boolean; // контроль auto-inject
  debounceDelay?: number; // задержка debounce для переключения темы (мс, по умолчанию 100)
  onInject?: (link: HTMLLinkElement) => void; // telemetry hook для вставки
  onError?: (error: Error) => void; // callback для ошибок
};

type UnsubscribeFunction = () => void;

/** Значения по умолчанию */
const DEFAULT_CONFIG: FaviconServiceConfig = {
  icons: [
    { url: '/favicon.ico', rel: 'icon', type: 'image/x-icon', sizes: '32x32', version: '1.0.0' },
    { url: '/favicon-16x16.png', rel: 'icon', type: 'image/png', sizes: '16x16', version: '1.0.0' },
    { url: '/favicon-32x32.png', rel: 'icon', type: 'image/png', sizes: '32x32', version: '1.0.0' },
    {
      url: '/favicon-192x192.png',
      rel: 'icon',
      type: 'image/png',
      sizes: '192x192',
      version: '1.0.0',
    },
    {
      url: '/favicon-512x512.png',
      rel: 'icon',
      type: 'image/png',
      sizes: '512x512',
      version: '1.0.0',
    },
  ],
  appleIcons: [
    { url: '/apple-touch-icon.png', rel: 'apple-touch-icon', sizes: '180x180', version: '1.0.0' },
  ],
  manifest: { url: '/manifest.json', version: '1.0.0' },
  splashScreens: [
    {
      url: '/splash-640x1136.png',
      media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
      version: '1.0.0',
    },
    {
      url: '/splash-750x1334.png',
      media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
      version: '1.0.0',
    },
    {
      url: '/splash-1242x2208.png',
      media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)',
      version: '1.0.0',
    },
  ],
  dynamic: true,
  enabled: true,
  debug: false,
  autoInject: true,
  debounceDelay: 100,
};

/* ============================================================================
 * 🔍 FEATURE DETECTION
 * ========================================================================== */

/** Проверка поддержки document/head (SSR/Node safe) */
function isDocumentSupported(): boolean {
  return typeof document !== 'undefined' && typeof document.head !== 'undefined';
}

/** Проверка текущей темы (dark/light) - SSR safe */
function isDarkMode(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/* ============================================================================
 * 📝 CORE LOGIC
 * ========================================================================== */

/** Проверяет, нужно ли вставлять иконку в зависимости от темы */
function shouldInjectIcon(icon: IconConfig, dark: boolean, dynamic: boolean): boolean {
  if (!dynamic) return true;
  if (icon.darkMode === undefined) return true;
  return icon.darkMode === dark;
}

/** Создает <link> элемент для favicon/PWA icon с data-атрибутом */
function createLink(icon: IconConfig): HTMLLinkElement {
  // Строгая проверка на пустой url
  if (icon.url === '') {
    throw new Error('Icon URL не может быть пустым');
  }
  const link = document.createElement('link');
  const rel = icon.rel ?? 'icon';
  const type = icon.type ?? 'image/png';
  const href = icon.version !== undefined && icon.version !== ''
    ? `${icon.url}?v=${icon.version}`
    : icon.url;

  Object.assign(link, {
    rel,
    type,
    href,
  });
  if (icon.sizes !== undefined && icon.sizes !== '') {
    link.sizes = icon.sizes;
  }

  link.dataset['faviconService'] = 'true';
  return link;
}

/** Создает <link rel="manifest"> с data-атрибутом */
function createManifestLink(manifest: ManifestConfig): HTMLLinkElement {
  // Строгая проверка на пустой url
  if (manifest.url === '') {
    throw new Error('Manifest URL не может быть пустым');
  }
  const link = document.createElement('link');
  const href = manifest.version !== undefined && manifest.version !== ''
    ? `${manifest.url}?v=${manifest.version}`
    : manifest.url;

  Object.assign(link, {
    rel: 'manifest',
    href,
  });

  link.dataset['faviconService'] = 'true';
  return link;
}

/** Создает splash screen <link> с data-атрибутом */
function createSplashLink(splash: SplashConfig): HTMLLinkElement {
  // Строгая проверка на пустой url
  if (splash.url === '') {
    throw new Error('Splash screen URL не может быть пустым');
  }
  const link = document.createElement('link');
  const href = splash.version !== undefined && splash.version !== ''
    ? `${splash.url}?v=${splash.version}`
    : splash.url;

  Object.assign(link, {
    rel: 'apple-touch-startup-image',
    media: splash.media,
    href,
  });

  link.dataset['faviconService'] = 'true';
  return link;
}

/** Удаляет только свои favicon/PWA ссылки по data-атрибуту */
function removeExistingLinks(): void {
  const links = document.querySelectorAll<HTMLLinkElement>(
    'link[data-favicon-service="true"]',
  );
  links.forEach((el) => el.parentNode?.removeChild(el));
}

/** Нормализует массив с поддержкой явного override пустым массивом */
function normalizeArray<T>(configArray: T[] | undefined, defaultsArray: T[] | undefined): T[] {
  if (configArray !== undefined) {
    return configArray.length === 0 ? [] : configArray;
  }
  return defaultsArray ?? [];
}

/** Нормализует boolean значение с учетом undefined */
function normalizeBoolean(
  configValue: boolean | undefined,
  defaultValue: boolean | undefined,
): boolean | undefined {
  if (configValue !== undefined) {
    return !!configValue;
  }
  return defaultValue !== undefined ? !!defaultValue : undefined;
}

/**
 * Создает immutable копию конфигурации с поддержкой override пустыми массивами
 * @param config Конфигурация пользователя
 * @param defaults Конфигурация по умолчанию
 */
function createImmutableConfig(
  config: FaviconServiceConfig | undefined,
  defaults: FaviconServiceConfig,
): FaviconServiceConfig {
  // Поддержка явного override пустыми массивами (config.icons?.length === 0)
  const icons = normalizeArray(config?.icons, defaults.icons);
  const appleIcons = normalizeArray(config?.appleIcons, defaults.appleIcons);
  const splashScreens = normalizeArray(config?.splashScreens, defaults.splashScreens);

  // Строгая нормализация boolean значений
  const dynamicValue = normalizeBoolean(config?.dynamic, defaults.dynamic);
  const enabledValue = normalizeBoolean(config?.enabled, defaults.enabled);
  const debugValue = normalizeBoolean(config?.debug, defaults.debug);
  const autoInjectValue = normalizeBoolean(config?.autoInject, defaults.autoInject);
  const debounceDelay = config?.debounceDelay ?? defaults.debounceDelay;

  const result: FaviconServiceConfig = {
    icons,
    appleIcons,
    splashScreens,
    ...(dynamicValue !== undefined && { dynamic: dynamicValue }),
    ...(enabledValue !== undefined && { enabled: enabledValue }),
    ...(debugValue !== undefined && { debug: debugValue }),
    ...(autoInjectValue !== undefined && { autoInject: autoInjectValue }),
    ...(debounceDelay !== undefined && { debounceDelay }),
    ...(config?.onInject !== undefined && { onInject: config.onInject }),
    ...(config?.onError !== undefined && { onError: config.onError }),
    ...(defaults.onInject !== undefined
      && config?.onInject === undefined
      && { onInject: defaults.onInject }),
    ...(defaults.onError !== undefined
      && config?.onError === undefined
      && { onError: defaults.onError }),
  };

  // Явная обработка manifest для exactOptionalPropertyTypes
  if (config?.manifest !== undefined) {
    return { ...result, manifest: config.manifest };
  }
  if (defaults.manifest !== undefined) {
    return { ...result, manifest: defaults.manifest };
  }

  return result;
}

/**
 * Обработка ошибок с callback и логированием в debug режиме
 * @param error Ошибка
 * @param onError Callback для ошибок
 * @param debug Флаг debug режима
 */
function handleError(error: unknown, onError?: (error: Error) => void, debug?: boolean): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (onError !== undefined) {
    onError(err);
  }
  // Логируем только в dev режиме, не в production
  if (debug === true && typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('[FAVICON] Ошибка вставки иконок:', err.message);
  }
}

/**
 * Логирование debug информации (обобщенное для разных типов логов)
 * Вызывает onInject callback и console.debug только в dev режиме
 */
function logDebug<T>(
  message: string,
  data: T,
  debug?: boolean,
  onInject?: (link: HTMLLinkElement) => void,
): void {
  if (onInject !== undefined && data instanceof HTMLLinkElement) {
    onInject(data);
  }
  // console.debug только в dev режиме
  if (debug === true && typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug('[FAVICON]', message, data);
  }
}

/**
 * Вставка всех favicon/PWA icons и splash screens
 * ⚠️ Только вставка элементов, не создает подписки на изменения темы.
 * Для dynamic mode с подпиской используйте initFaviconService.
 * @param config Конфигурация (будет объединена с DEFAULT_CONFIG immutable образом)
 * @returns Всегда undefined. Для получения unsubscribe используйте initFaviconService
 */
export function injectFaviconService(
  config?: FaviconServiceConfig,
): UnsubscribeFunction | undefined {
  // Создаем immutable копию конфигурации
  const cfg = createImmutableConfig(config, DEFAULT_CONFIG);

  // Policy object для детерминированной логики
  const policy = {
    enabled: cfg.enabled ?? true,
    dynamic: cfg.dynamic ?? false,
    debug: cfg.debug ?? false,
  };

  if (!isDocumentSupported() || !policy.enabled) {
    return undefined;
  }

  try {
    removeExistingLinks();
    const dark = isDarkMode();

    // Shallow clone массивов для защиты от side-effects
    const icons = cfg.icons !== undefined ? [...cfg.icons] : [];
    const appleIcons = cfg.appleIcons !== undefined ? [...cfg.appleIcons] : [];
    const splashScreens = cfg.splashScreens !== undefined ? [...cfg.splashScreens] : [];

    // Иконки с проверкой на пустой url
    icons.forEach((icon) => {
      if (icon.url === '') {
        return;
      }
      if (shouldInjectIcon(icon, dark, policy.dynamic)) {
        const link = createLink(icon);
        // Строгая проверка href перед вставкой
        if (link.href !== '') {
          document.head.appendChild(link);
          logDebug('Вставлен icon:', link, policy.debug, cfg.onInject);
        }
      }
    });

    // Apple Icons с проверкой на пустой url
    appleIcons.forEach((icon) => {
      if (icon.url === '') {
        return;
      }
      if (shouldInjectIcon(icon, dark, policy.dynamic)) {
        const link = createLink(icon);
        // Строгая проверка href перед вставкой
        if (link.href !== '') {
          document.head.appendChild(link);
          logDebug('Вставлен apple-touch-icon:', link, policy.debug, cfg.onInject);
        }
      }
    });

    // Manifest
    if (cfg.manifest !== undefined && cfg.manifest.url !== '') {
      const link = createManifestLink(cfg.manifest);
      if (link.href !== '') {
        document.head.appendChild(link);
        logDebug('Вставлен manifest:', link, policy.debug, cfg.onInject);
      }
    }

    // Splash Screens с проверкой на пустой url
    splashScreens.forEach((splash) => {
      if (splash.url === '') {
        return;
      }
      const link = createSplashLink(splash);
      // Строгая проверка href перед вставкой
      if (link.href !== '') {
        document.head.appendChild(link);
        logDebug('Вставлен splash screen:', link, policy.debug, cfg.onInject);
      }
    });

    // Если dynamic mode включен, возвращаем функцию для подписки
    // Примечание: для полной подписки используйте initFaviconService
    return undefined;
  } catch (error: unknown) {
    handleError(error, cfg.onError, policy.debug);
    return undefined;
  }
}

/**
 * Debounce функция для предотвращения множественных вызовов при быстрых переключениях темы
 * @param fn Функция для debounce
 * @param delay Задержка в миллисекундах
 */
function debounce(fn: () => void, delay: number): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn();
      timeoutId = undefined;
    }, delay);
  };
}

/**
 * Подписка на изменения темы с поддержкой Safari fallback и debounce
 * @param callback Callback при изменении темы
 * @param delay Задержка debounce в миллисекундах
 * @param onError Callback для ошибок (опционально)
 * @param debug Флаг debug режима (опционально)
 */
function subscribeToThemeChange(
  callback: () => void,
  delay: number,
  onError?: (error: Error) => void,
  debug?: boolean,
): UnsubscribeFunction {
  if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
    return () => {};
  }

  // Debounce callback для предотвращения множественных вызовов при быстрых переключениях
  const debouncedCallback = debounce(callback, delay);

  try {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Проверка поддержки addEventListener (современные браузеры)
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', debouncedCallback);
      return () => {
        mediaQuery.removeEventListener('change', debouncedCallback);
      };
    }

    // Fallback для старых Safari (addListener)
    if (
      typeof (mediaQuery as unknown as { addListener?: (callback: () => void) => void; })
        .addListener === 'function'
    ) {
      (mediaQuery as unknown as { addListener: (callback: () => void) => void; }).addListener(
        debouncedCallback,
      );
      return () => {
        if (
          typeof (mediaQuery as unknown as { removeListener?: (callback: () => void) => void; })
            .removeListener === 'function'
        ) {
          (mediaQuery as unknown as { removeListener: (callback: () => void) => void; })
            .removeListener(debouncedCallback);
        }
      };
    }
  } catch (error: unknown) {
    // Логирование ошибок в debug режиме или через onError
    const err = error instanceof Error ? error : new Error(String(error));
    if (onError !== undefined) {
      onError(err);
    }
    if (debug === true) {
      // eslint-disable-next-line no-console
      console.warn('[FAVICON] Ошибка подписки на изменения темы:', err.message);
    }
  }

  return () => {};
}

// Внутренний контроль подписок для предотвращения множественных подписок
const activeSubscriptions = new Set<UnsubscribeFunction>();

/**
 * Инициализация сервиса с подпиской на изменения темы
 * Очищает предыдущие подписки перед созданием новых
 * @param config Конфигурация
 */
export function initFaviconService(config?: FaviconServiceConfig): UnsubscribeFunction | undefined {
  const cfg = createImmutableConfig(config, DEFAULT_CONFIG);

  if (!isDocumentSupported() || cfg.enabled !== true) {
    return undefined;
  }

  // Очистка предыдущих подписок для этого конфига
  activeSubscriptions.forEach((unsubscribe) => {
    unsubscribe();
  });

  activeSubscriptions.clear();

  // Первоначальная вставка
  injectFaviconService(cfg);

  // Подписка на изменения темы, если dynamic mode включен
  if (cfg.dynamic === true) {
    const debounceDelay = cfg.debounceDelay ?? 100;
    const unsubscribe = subscribeToThemeChange(
      () => injectFaviconService(cfg),
      debounceDelay,
      cfg.onError,
      cfg.debug,
    );

    activeSubscriptions.add(unsubscribe);
    return unsubscribe;
  }

  return undefined;
}

/* ============================================================================
 * 🟢 AUTO-INJECT & OBSERVER
 * ========================================================================== */

let unsubscribeThemeChange: UnsubscribeFunction | undefined;

if (isDocumentSupported()) {
  const cfg = createImmutableConfig(undefined, DEFAULT_CONFIG);

  // Auto-inject только если включен
  if (cfg.autoInject !== false) {
    unsubscribeThemeChange = initFaviconService();
  }
}

// Экспорт функции для ручной очистки подписок
export function cleanupFaviconService(): void {
  if (unsubscribeThemeChange !== undefined) {
    unsubscribeThemeChange();
    unsubscribeThemeChange = undefined;
  }
  // Очистка всех активных подписок
  activeSubscriptions.forEach((unsubscribe) => {
    unsubscribe();
  });

  activeSubscriptions.clear();
}
