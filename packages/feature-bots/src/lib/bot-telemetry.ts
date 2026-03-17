/**
 * @file packages/feature-bots/src/lib/bot-telemetry.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Bot Telemetry Hooks (pure builders + DI sink)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Lib-layer хелперы для метрик ботов: построение типизированных telemetry-событий и
 *   опциональная отправка в sink через DI.
 * - Не содержит runtime клиента телеметрии, batching и PII-sanitization — это ответственность
 *   core telemetry слоя; здесь мы только формируем безопасный (primitive-only) payload.
 *
 * Принципы:
 * - ✅ SRP: только построение событий и отправка в DI sink.
 * - ✅ Deterministic: нет `Date.now()`, timestamp задаётся явно.
 * - ✅ Immutable: событие и metadata замораживаются (shallow freeze).
 * - ✅ Microservice-ready: vendor-agnostic контракт через DI sink (функция) без привязки к конкретному SDK.
 *
 * @remarks
 * Этот модуль intentionally не пытается «умничать» и угадывать/генерировать trace IDs —
 * boundary слой должен передать correlation/trace/span при наличии.
 */
import type { TelemetryEvent, TelemetryLevel, TelemetryMetadata } from '@livai/core-contracts';

import type { BotInfo } from '../types/bots.js';

/* ============================================================================
 * 🧩 PUBLIC TYPES
 * ========================================================================== */

/**
 * Канонические метрики ботов (SSOT для UI/effects слоя).
 *
 * @remarks
 * - Значения — стабильные имена метрик для sinks/дашбордов.
 * - Не включайте сюда динамические части (ID и т.п.) — они должны быть в metadata.
 */
export const BotTelemetryMetricNames = [
  'llm_tokens',
  'conversations_started',
  'messages_processed',
  'webhook_events',
  'integration_calls',
  'performance',
  'conversion',
  'token_spend',
] as const;

export type BotTelemetryMetricName = (typeof BotTelemetryMetricNames)[number];

/**
 * Минимальный контекст бота, используемый в метаданных.
 * Берём из `BotInfo`, чтобы не добавлять лишних зависимостей на core-contracts ID-типы.
 */
export type BotTelemetryEntityRef = Readonly<
  Pick<BotInfo, 'id' | 'workspaceId'>
>;

/**
 * Метаданные телеметрии feature-bots.
 *
 * @remarks
 * - Только примитивы (TelemetryPrimitive) в соответствии с core-contracts.
 * - PII должен быть отфильтрован выше (в core telemetry sanitizeMetadata).
 */
export type BotTelemetryMetadata = TelemetryMetadata;

/**
 * Контракт sink для bot telemetry событий.
 *
 * @remarks
 * Мы фиксируем контракт как функцию (а не объект с методом), чтобы исключить runtime-двусмысленность.
 * Если у вас sink в форме `{ emit(event) }`, используйте `createBotTelemetrySinkAdapter`.
 */
export type BotTelemetrySink = (
  event: BotTelemetryEvent,
) => void | Promise<void>;

/** Runtime-friendly форма sink: функция или объект с методом `emit`. */
export type BotTelemetrySinkLike =
  | BotTelemetrySink
  | Readonly<{ readonly emit: BotTelemetrySink; }>;

/** Результат попытки эмита. */
export type EmitBotTelemetryEventResult =
  | Readonly<{ readonly ok: true; }>
  | Readonly<{ readonly ok: false; readonly error: unknown; }>;

/** Базовые опции эмита (без хуков). */
export type EmitBotTelemetryEventOptionsBase = Readonly<{
  /**
   * Если true — ошибка из sink пробрасывается наружу.
   * По умолчанию false: возвращаем `{ ok: false }` для наблюдаемости без исключений.
   */
  readonly strict?: boolean;
  /**
   * Таймаут на выполнение sink в миллисекундах.
   *
   * @remarks
   * Нужен для orchestration-safety: DI sink может зависнуть из-за внешнего SDK/сети.
   * При срабатывании таймаута возвращается `{ ok: false }` (или бросается ошибка при `strict=true`).
   */
  readonly timeoutMs?: number;
  /** Максимальный размер payload (в символах JSON.stringify) для защиты от log/telemetry explosion. */
  readonly maxSerializedSize?: number;
}>;

/** Хуки наблюдаемости. */
export type EmitBotTelemetryEventOptionsHooks = Readonly<{
  /** Вызывается при ошибке sink (до возврата результата). */
  readonly onError?: (error: unknown, event: BotTelemetryEvent) => void;
  /** Вызывается при невалидном событии/metadata/size до отправки в sink. */
  readonly onInvalid?: (error: BotTelemetryError, event: BotTelemetryEvent) => void;
}>;

export type EmitBotTelemetryEventOptions =
  & EmitBotTelemetryEventOptionsBase
  & EmitBotTelemetryEventOptionsHooks;

/**
 * Bot telemetry событие.
 *
 * @remarks
 * `message` в telemetry — текст для людей; для аналитики используйте `metadata.metric`.
 */
export type BotTelemetryEvent = TelemetryEvent<BotTelemetryMetadata>;

export type BotTelemetryErrorCode =
  | 'TELEMETRY_METADATA_INVALID'
  | 'TELEMETRY_PAYLOAD_TOO_LARGE'
  | 'TELEMETRY_SINK_INVALID'
  | 'TELEMETRY_TIMEOUT';

/**
 * Ошибка телеметрии с устойчивым discriminator `code`.
 *
 * @remarks
 * Важно для мониторинга/алёртов: используйте `code` вместо парсинга `message`.
 */
export type BotTelemetryError = Readonly<
  Error & {
    readonly code: BotTelemetryErrorCode;
    readonly details?: Readonly<Record<string, string | number | boolean | null>>;
  }
>;

/**
 * Создаёт иммутабельную ошибку телеметрии (stable `code` + optional details).
 */
const createBotTelemetryError = (
  code: BotTelemetryErrorCode,
  message: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): BotTelemetryError => {
  const err = Object.assign(
    new Error(message),
    {
      name: 'BotTelemetryError',
      code,
      ...(details !== undefined ? { details } : {}),
    } as const,
  );
  return Object.freeze(err);
};

/* ============================================================================
 * 🧱 BUILDERS (PURE)
 * ========================================================================== */

type CreateBotTelemetryEventInputBase = Readonly<{
  readonly timestamp: number;
  readonly level: TelemetryLevel;
  readonly message: string;
  readonly metric: BotTelemetryMetricName;
  readonly entity: BotTelemetryEntityRef;
}>;

type CreateBotTelemetryEventInputTracing = Readonly<{
  readonly spanId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
}>;

type CreateBotTelemetryEventInputMetadata = Readonly<{
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type CreateBotTelemetryEventInput =
  & CreateBotTelemetryEventInputBase
  & CreateBotTelemetryEventInputTracing
  & CreateBotTelemetryEventInputMetadata;

/**
 * Формирует tracing поля, не создавая ключей со значением `undefined`.
 *
 * @remarks
 * Нужен из-за `exactOptionalPropertyTypes`: опциональные поля должны отсутствовать,
 * а не быть заданными как `undefined`.
 */
const tracingFields = (
  input: Readonly<
    Pick<CreateBotTelemetryEventInputTracing, 'spanId' | 'correlationId' | 'traceId'>
  >,
): Readonly<{
  readonly spanId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
}> =>
  Object.freeze({
    ...(input.spanId !== undefined ? { spanId: input.spanId } : {}),
    ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    ...(input.traceId !== undefined ? { traceId: input.traceId } : {}),
  });

// eslint-disable-next-line ai-security/model-poisoning -- metadata типизирована как primitive-only; runtime PII/sanitization и allow-list живут в core telemetry boundary
const freezeMetadata = (metadata: BotTelemetryMetadata): BotTelemetryMetadata =>
  Object.isFrozen(metadata) ? metadata : Object.freeze({ ...metadata });

/** Runtime guard для примитивов TelemetryMetadata (primitive-only, без nested объектов). */
const isTelemetryPrimitive = (value: unknown): value is string | number | boolean | null =>
  value === null
  || typeof value === 'string'
  || typeof value === 'number'
  || typeof value === 'boolean';

/**
 * Runtime проверка пользовательских metadata на primitive-only shape.
 *
 * @remarks
 * Это защитный слой на boundary: типы TS можно обойти в runtime.
 * Возвращает исходный объект (без копирования) — вызывающий код решает, когда/что freeze-ить.
 */
// eslint-disable-next-line ai-security/model-poisoning -- runtime guard валидирует входные данные (primitive-only) перед использованием; это защита от metadata drift/poisoning
const validatePrimitiveMetadata = (
  metadata: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string | number | boolean | null>> => {
  const invalidKeys: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (!isTelemetryPrimitive(value)) invalidKeys.push(key);
  }
  if (invalidKeys.length > 0) {
    throw createBotTelemetryError(
      'TELEMETRY_METADATA_INVALID',
      `Telemetry metadata must be primitive-only; invalid keys: ${invalidKeys.join(', ')}`,
      { invalidKeys: invalidKeys.join(', ') },
    );
  }
  return metadata as Readonly<Record<string, string | number | boolean | null>>;
};

/**
 * Строит каноническое telemetry-событие для bot метрики.
 *
 * @remarks
 * - Детерминированно: порядок ключей не гарантируется JS-рантаймом, но значения фиксированы.
 * - Metadata: только примитивы; entity ID добавляется как строки.
 */
export function createBotTelemetryEvent(input: CreateBotTelemetryEventInput): BotTelemetryEvent {
  const validatedExtra = input.metadata !== undefined
    ? validatePrimitiveMetadata(input.metadata as Readonly<Record<string, unknown>>)
    : undefined;

  const baseMeta: BotTelemetryMetadata = {
    metric: input.metric,
    botId: String(input.entity.id),
    workspaceId: String(input.entity.workspaceId),
    ...(validatedExtra ?? {}),
  };

  const event: BotTelemetryEvent = {
    level: input.level,
    message: input.message,
    timestamp: input.timestamp,
    metadata: freezeMetadata(baseMeta),
    ...(input.spanId !== undefined ? { spanId: input.spanId } : {}),
    ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
    ...(input.traceId !== undefined ? { traceId: input.traceId } : {}),
  };

  return Object.freeze(event);
}

/* ============================================================================
 * 🎯 METRIC-SPECIFIC HELPERS (PURE)
 * ========================================================================== */

export type CreateLlmTokensTelemetryInput =
  & Readonly<{
    readonly entity: BotTelemetryEntityRef;
    readonly timestamp: number;
    readonly tokens: number;
    readonly model?: string;
  }>
  & CreateBotTelemetryEventInputTracing;

/**
 * Метрика `llm_tokens`.
 *
 * @remarks
 * `tokens` — абсолютное значение (не delta). Агрегация/rollup — ответственность sinks/аналитики.
 */
export function createLlmTokensTelemetryEvent(
  input: CreateLlmTokensTelemetryInput,
): BotTelemetryEvent {
  const tracing = tracingFields(input);
  return createBotTelemetryEvent({
    timestamp: input.timestamp,
    level: 'INFO',
    message: 'LLM tokens consumed',
    metric: 'llm_tokens',
    entity: input.entity,
    ...tracing,
    metadata: {
      tokens: input.tokens,
      ...(input.model !== undefined ? { model: input.model } : {}),
    },
  });
}

export type CreateConversationsStartedTelemetryInput =
  & Readonly<{
    readonly entity: BotTelemetryEntityRef;
    readonly timestamp: number;
    readonly count?: number;
  }>
  & CreateBotTelemetryEventInputTracing;

/** Метрика `conversations_started` (по умолчанию count=1). */
export function createConversationsStartedTelemetryEvent(
  input: CreateConversationsStartedTelemetryInput,
): BotTelemetryEvent {
  const tracing = tracingFields(input);
  return createBotTelemetryEvent({
    timestamp: input.timestamp,
    level: 'INFO',
    message: 'Conversation started',
    metric: 'conversations_started',
    entity: input.entity,
    ...tracing,
    metadata: {
      count: input.count ?? 1,
    },
  });
}

export type CreateMessagesProcessedTelemetryInput =
  & Readonly<{
    readonly entity: BotTelemetryEntityRef;
    readonly timestamp: number;
    readonly count?: number;
  }>
  & CreateBotTelemetryEventInputTracing;

/** Метрика `messages_processed` (по умолчанию count=1). */
export function createMessagesProcessedTelemetryEvent(
  input: CreateMessagesProcessedTelemetryInput,
): BotTelemetryEvent {
  const tracing = tracingFields(input);
  return createBotTelemetryEvent({
    timestamp: input.timestamp,
    level: 'INFO',
    message: 'Message processed',
    metric: 'messages_processed',
    entity: input.entity,
    ...tracing,
    metadata: {
      count: input.count ?? 1,
    },
  });
}

export type CreateWebhookTelemetryInput =
  & Readonly<{
    readonly entity: BotTelemetryEntityRef;
    readonly timestamp: number;
    readonly status: 'success' | 'failed';
    readonly provider?: string;
  }>
  & CreateBotTelemetryEventInputTracing;

/** Метрика `webhook_events` (status влияет на level: INFO/WARN). */
export function createWebhookTelemetryEvent(input: CreateWebhookTelemetryInput): BotTelemetryEvent {
  const tracing = tracingFields(input);
  return createBotTelemetryEvent({
    timestamp: input.timestamp,
    level: input.status === 'success' ? 'INFO' : 'WARN',
    message: 'Webhook event processed',
    metric: 'webhook_events',
    entity: input.entity,
    ...tracing,
    metadata: {
      status: input.status,
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
    },
  });
}

export type CreateIntegrationCallTelemetryInput =
  & Readonly<{
    readonly entity: BotTelemetryEntityRef;
    readonly timestamp: number;
    readonly status: 'success' | 'failed';
    readonly integration: string;
    readonly latencyMs?: number;
  }>
  & CreateBotTelemetryEventInputTracing;

/** Метрика `integration_calls` (status влияет на level: INFO/WARN). */
export function createIntegrationCallTelemetryEvent(
  input: CreateIntegrationCallTelemetryInput,
): BotTelemetryEvent {
  const tracing = tracingFields(input);
  return createBotTelemetryEvent({
    timestamp: input.timestamp,
    level: input.status === 'success' ? 'INFO' : 'WARN',
    message: 'Integration call',
    metric: 'integration_calls',
    entity: input.entity,
    ...tracing,
    metadata: {
      status: input.status,
      integration: input.integration,
      ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
    },
  });
}

/* ============================================================================
 * 🚀 EMIT (DI)
 * ========================================================================== */

/**
 * Отправляет telemetry-событие в sink.
 *
 * @remarks
 * - По умолчанию не бросает исключения (возвращает `{ ok: false }`).
 * - `strict=true` делает поведение boundary-friendly (явная ошибка вместо silent fail).
 * - Перед отправкой выполняются защитные проверки:
 *   - runtime проверка сериализуемости payload
 *   - ограничение размера payload (`maxSerializedSize`)
 */
export async function emitBotTelemetryEvent(
  sink: BotTelemetrySinkLike,
  event: BotTelemetryEvent,
  options?: EmitBotTelemetryEventOptions,
): Promise<EmitBotTelemetryEventResult> {
  const DEFAULT_MAX_SERIALIZED_SIZE = 100_000;
  const DEFAULT_SINK_TIMEOUT_MS = 10_000;

  const resolveSink = (value: BotTelemetrySinkLike): BotTelemetrySink => {
    if (typeof value === 'function') return value;
    if (typeof value.emit === 'function') return value.emit;
    throw createBotTelemetryError(
      'TELEMETRY_SINK_INVALID',
      'Telemetry sink is invalid: expected a function or { emit: function }',
    );
  };

  const trySerializeSize = (value: unknown): number | null => {
    try {
      // NOTE: JSON.stringify.length считает UTF-16 code units; достаточно для защитного лимита.
      return JSON.stringify(value).length;
    } catch {
      return null;
    }
  };

  const sinkFn = resolveSink(sink);
  const run = async (): Promise<void> => {
    const payloadSize = trySerializeSize(event);
    if (payloadSize === null) {
      const err = createBotTelemetryError(
        'TELEMETRY_METADATA_INVALID',
        'Telemetry payload is not serializable',
      );
      options?.onInvalid?.(err, event);
      throw err;
    }
    const maxSerializedSize = options?.maxSerializedSize ?? DEFAULT_MAX_SERIALIZED_SIZE;
    if (payloadSize > maxSerializedSize) {
      const err = createBotTelemetryError(
        'TELEMETRY_PAYLOAD_TOO_LARGE',
        `Telemetry payload too large: ${payloadSize} > ${maxSerializedSize}`,
        { payloadSize, maxSerializedSize },
      );
      options?.onInvalid?.(err, event);
      throw err;
    }

    const promise = sinkFn(event);
    const timeoutMsRaw = options?.timeoutMs;
    const timeoutMs = Number.isFinite(timeoutMsRaw ?? DEFAULT_SINK_TIMEOUT_MS)
        && (timeoutMsRaw ?? DEFAULT_SINK_TIMEOUT_MS) > 0
      ? (timeoutMsRaw ?? DEFAULT_SINK_TIMEOUT_MS)
      : DEFAULT_SINK_TIMEOUT_MS;

    const timeoutError = createBotTelemetryError(
      'TELEMETRY_TIMEOUT',
      `BotTelemetry sink timed out after ${timeoutMs}ms`,
      { timeoutMs },
    );

    let timeoutId!: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(timeoutError);
      }, timeoutMs);
    });

    try {
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- bounded by timeoutPromise in Promise.race
      await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    // eslint-disable-next-line @livai/multiagent/orchestration-safety -- run() содержит timeout-guard (Promise.race + clearTimeout); правило не распознаёт это через функцию-обёртку
    await run();
    return Object.freeze({ ok: true });
  } catch (error: unknown) {
    options?.onError?.(error, event);
    if (options?.strict === true) throw error;
    return Object.freeze({ ok: false, error });
  }
}

export type CreateBotTelemetrySinkAdapterInput = Readonly<{
  readonly emit: BotTelemetrySink;
}>;

export const createBotTelemetrySinkAdapter = (
  input: CreateBotTelemetrySinkAdapterInput,
): BotTelemetrySinkLike => Object.freeze({ emit: input.emit });
