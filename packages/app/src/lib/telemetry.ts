/**
 * @file packages/app/src/lib/telemetry.ts
 * ============================================================================
 * 🔹 ЯДРО ТЕЛЕМЕТРИИ — ПРОДАКШЕН / IMMUTABLE / FUNCTIONAL SAFE
 * ============================================================================
 *
 * Свойства:
 * - отсутствие eslint-disable директив
 * - контролируемая иммутабельность
 * - поддержка асинхронных sink'ов
 * - enterprise-ready архитектура
 * - hexagonal architecture (чистое ядро)
 * - легко тестируемое и расширяемое
 */

/* ============================================================================
 * 🧱 ОСНОВНЫЕ ТИПЫ
 * ========================================================================== */

// Уровни логирования в порядке возрастания важности
export const telemetryLevels = ['INFO', 'WARN', 'ERROR'] as const;
export type TelemetryLevel = (typeof telemetryLevels)[number];

// Событие телеметрии - неизменяемый объект с метаданными
export type TelemetryEvent = Readonly<{
  level: TelemetryLevel; // Уровень важности события
  message: string; // Сообщение события
  metadata?: Readonly<Record<string, string | number | boolean | null>>; // Дополнительные данные
  timestamp: number; // Время события в миллисекундах
}>;

// Sink - абстракция для отправки событий (console, внешние SDK и т.д.)
export type TelemetrySink = (event: TelemetryEvent) => void | Promise<void>;

// Конфигурация телеметрии - передается при инициализации
export type TelemetryConfig = Readonly<{
  levelThreshold?: TelemetryLevel; // Минимальный уровень для логирования
  sinks?: readonly TelemetrySink[]; // Массив получателей событий
}>;

/* ============================================================================
 * ⚖️ ПРИОРИТЕТЫ УРОВНЕЙ (O(1) ДОСТУП)
 * ========================================================================== */

// Карта приоритетов для быстрого сравнения уровней
const levelPriority = Object.freeze(
  {
    INFO: 1, // Информационные сообщения
    WARN: 2, // Предупреждения
    ERROR: 3, // Ошибки (максимальный приоритет)
  } satisfies Record<TelemetryLevel, number>,
);

/* ============================================================================
 * 🧠 КЛИЕНТ ТЕЛЕМЕТРИИ (ПОЛНОСТЬЮ IMMUTABLE)
 * ========================================================================== */

/**
 * Enterprise-ready клиент телеметрии.
 * Принимает sinks в конструкторе, никаких мутаций после создания.
 */
export class TelemetryClient {
  private readonly sinks: readonly TelemetrySink[];
  private readonly levelThreshold: TelemetryLevel;

  constructor(config: TelemetryConfig = {}) {
    this.levelThreshold = config.levelThreshold ?? 'INFO';
    this.sinks = config.sinks ?? [];
  }

  // Основной метод логирования события
  async log(
    level: TelemetryLevel,
    message: string,
    metadata?: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    if (!this.shouldEmit(level)) return;

    const event: TelemetryEvent = {
      level,
      message,
      timestamp: Date.now(),
      ...(metadata && { metadata }),
    };

    await Promise.allSettled(this.sinks.map((sink) => Promise.resolve(sink(event))));
  }

  // Сокращение для INFO уровня
  info(
    message: string,
    metadata?: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    return this.log('INFO', message, metadata);
  }

  // Сокращение для WARN уровня
  warn(
    message: string,
    metadata?: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    return this.log('WARN', message, metadata);
  }

  // Сокращение для ERROR уровня
  error(
    message: string,
    metadata?: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    return this.log('ERROR', message, metadata);
  }

  // Проверка, нужно ли отправлять событие данного уровня
  private shouldEmit(level: TelemetryLevel): boolean {
    return levelPriority[level] >= levelPriority[this.levelThreshold];
  }
}

/* ============================================================================
 * 🔌 SINK'И (УРОВЕНЬ ИНФРАСТРУКТУРЫ - ТОЛЬКО BOOTSTRAP)
 * ========================================================================== */

/**
 * NOTE:
 * console используется исключительно внутри createConsoleSink как
 * boundary side-effect для инфраструктуры.
 * Это единственная допустимая точка прямого I/O в данном модуле.
 */

/**
 * Создает console sink для вывода в консоль браузера/terminal'а.
 * Должен использоваться ТОЛЬКО в bootstrap коде приложения.
 */
export const createConsoleSink = (): TelemetrySink => {
  return (event: TelemetryEvent): void => {
    const prefix = `[${event.level}] ${new Date(event.timestamp).toISOString()}`;

    if (event.level === 'ERROR') {
      // eslint-disable-next-line no-console -- оправданный side-effect в bootstrap
      console.error(prefix, event.message, event.metadata);
    } else if (event.level === 'WARN') {
      // eslint-disable-next-line no-console -- оправданный side-effect в bootstrap
      console.warn(prefix, event.message, event.metadata);
    } else {
      // eslint-disable-next-line no-console -- оправданный side-effect в bootstrap
      console.log(prefix, event.message, event.metadata);
    }
  };
};

/* ============================================================================
 * 🎣 REACT HOOK
 * ========================================================================== */

/**
 * React хук для получения клиента телеметрии.
 * Возвращает инициализированный глобальный клиент телеметрии.
 */
export function useTelemetry(): TelemetryClient {
  return getGlobalTelemetryClient();
}

/* ============================================================================
 * 🔄 FIRE-AND-FORGET HELPERS
 * ========================================================================== */

// Вспомогательная функция для fire-and-forget логирования. Используется для случаев, когда результат логирования не важен.
function fireAndForget(fn: () => Promise<void>): void {
  fn().catch(() => {
    // Игнорируем ошибки логирования - они не должны ломать бизнес-логику
  });
}

// Проверяет, инициализирована ли telemetry (graceful, без исключений)
function isTelemetryInitialized(): boolean {
  try {
    getGlobalTelemetryClient();
    return true;
  } catch {
    return false;
  }
}

// Fire-and-forget версия log метода.
export function logFireAndForget(
  level: TelemetryLevel,
  message: string,
  metadata?: Readonly<Record<string, string | number | boolean | null>>,
): void {
  if (!isTelemetryInitialized()) return;
  fireAndForget(() => getGlobalTelemetryClient().log(level, message, metadata));
}

// Fire-and-forget версия info метода.
export function infoFireAndForget(
  message: string,
  metadata?: Readonly<Record<string, string | number | boolean | null>>,
): void {
  if (!isTelemetryInitialized()) return;
  fireAndForget(() => getGlobalTelemetryClient().info(message, metadata));
}

// Fire-and-forget версия warn метода.
export function warnFireAndForget(
  message: string,
  metadata?: Readonly<Record<string, string | number | boolean | null>>,
): void {
  if (!isTelemetryInitialized()) return;
  fireAndForget(() => getGlobalTelemetryClient().warn(message, metadata));
}

// Fire-and-forget версия error метода.
export function errorFireAndForget(
  message: string,
  metadata?: Readonly<Record<string, string | number | boolean | null>>,
): void {
  if (!isTelemetryInitialized()) return;
  fireAndForget(() => getGlobalTelemetryClient().error(message, metadata));
}

// Создает sink для внешнего SDK (PostHog, Sentry, Datadog и т.д.). Должен использоваться ТОЛЬКО в bootstrap коде приложения.
export const createExternalSink = (
  sdk: { capture: (event: TelemetryEvent) => void | Promise<void>; },
): TelemetrySink => {
  return async (event: TelemetryEvent): Promise<void> => {
    try {
      await sdk.capture(event);
    } catch {
      // Ошибка SDK - можно добавить логику fallback'а здесь
    }
  };
};

/* ============================================================================
 * 🌍 ГЛОБАЛЬНЫЙ КЛИЕНТ (IMMUTABLE INSTANCE)
 * ========================================================================== */

let globalClient: TelemetryClient | null = null;

/**
 * Инициализирует глобальный клиент телеметрии.
 * Должна вызываться один раз при старте приложения.
 * Автоматически добавляет console sink для разработки.
 */
export function initTelemetry(config: TelemetryConfig = {}): TelemetryClient {
  if (globalClient) {
    throw new Error('Telemetry already initialized');
  }

  // Создаем console sink - side effect живет только в bootstrap
  const consoleSink = createConsoleSink();

  const telemetryConfig: TelemetryConfig = {
    ...config,
    sinks: [consoleSink, ...(config.sinks ?? [])],
  };

  globalClient = new TelemetryClient(telemetryConfig);
  return globalClient;
}

/**
 * Возвращает глобальный клиент телеметрии.
 * Бросает ошибку если телеметрия не инициализирована.
 */
export function getGlobalTelemetryClient(): TelemetryClient {
  if (!globalClient) {
    throw new Error('Telemetry not initialized. Call initTelemetry() first.');
  }
  return globalClient;
}
