/**
 * @file packages/feature-bots/src/effects/shared/bots-api.mappers.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Bots API Mappers (transport DTO → feature/store)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Чистые (pure) мапперы для преобразования *validated transport DTO* (`bots-service`)
 *   в типы feature-bots для store/effects/UI.
 * - Boundary safety: fail-closed при форме, не позволяющей построить корректный `BotStatus`.
 * - Детерминизм: один и тот же input → один и тот же output/ошибка без скрытого state.
 *
 * Принципы:
 * - ✅ SRP: только маппинг DTO → feature-level types (без IO, без store доступа).
 * - ✅ Copy-on-write: не мутирует входные DTO, возвращает новые readonly объекты.
 * - ✅ No transport leakage: наружу не прокидываются snake_case поля; только feature-формат.
 * - ✅ Scalable mapping: map-based правила без if/else-монолита для статусов.
 *
 * @remarks
 * Zod-схемы `generatedBots.*Schema` помечены `.passthrough()`, поэтому backend может присылать
 * дополнительные поля, не отражённые в текущем OpenAPI. Здесь мы используем такие поля
 * (например timestamps/reasons для статусов) только при их наличии и валидности.
 *
 * Возвращаемые объекты замораживаются shallow (`Object.freeze`): этого достаточно, потому что
 * вложенные структуры создаются внутри маппера и не разделяются с входным DTO.
 */

import type { ISODateString } from '@livai/core-contracts';

import type { BotErrorResponse } from '../../contracts/BotErrorResponse.js';
import { createBotErrorResponse } from '../../lib/bot-errors.js';
import type { BotEnforcementReason, BotPauseReason } from '../../types/bot-lifecycle.js';
import type { BotInfo, BotStatus } from '../../types/bots.js';
import type { BotResponseTransport, BotsListResponseTransport } from './api-client.port.js';

/* ============================================================================
 * 🔎 INTERNAL VALIDATION HELPERS (boundary guardrails)
 * ============================================================================
 *
 * @remarks
 * Мы не дублируем проверки полей, уже покрытых `generatedBots.BotResponseSchema`.
 * Guard'ы ниже остаются только для passthrough-полей, необходимых для сборки `BotStatus`.
 */

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object';
}

function asRecord(value: unknown, label: string): UnknownRecord {
  if (!isRecord(value)) {
    // eslint-disable-next-line ai-security/data-leakage -- label: внутренний идентификатор поля/секции (не пользовательские данные, без PII/secrets)
    throw createTransportMappingError(`Ожидался объект для ${label}`, { label });
  }
  return value;
}

function readStringField(
  record: UnknownRecord,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    // eslint-disable-next-line security/detect-object-injection -- key: фиксированный allow-list ключей
    const v = record[key];
    if (typeof v === 'string') return v;
  }
  return undefined;
}

const ALLOWED_DETAIL_KEYS = ['label', 'status', 'field', 'mapper'] as const;
type AllowedDetailKey = (typeof ALLOWED_DETAIL_KEYS)[number];

function toSafeDetailString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return String(value);
  }
  try {
    // После раннего возврата для undefined/function/symbol JSON.stringify даёт string.
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createTransportMappingError(
  message: string,
  details?: Readonly<Record<string, unknown>> | undefined,
): BotErrorResponse {
  const filteredDetails: Partial<Record<AllowedDetailKey, string>> = Object.freeze(
    details === undefined
      ? {}
      : Object.fromEntries(
        Object.entries(details)
          .filter(([k]) => (ALLOWED_DETAIL_KEYS as readonly string[]).includes(k))
          .map(([k, v]) => [k, toSafeDetailString(v)]),
      ) as Partial<Record<AllowedDetailKey, string>>,
  );

  const safeDetails: Readonly<Partial<Record<AllowedDetailKey, string>>> = Object.freeze({
    mapper: 'bots-api-mappers',
    ...filteredDetails,
  });

  return createBotErrorResponse({
    code: 'BOT_PARSING_JSON_INVALID',
    context: Object.freeze({
      details: Object.freeze({
        message,
        transportDetails: safeDetails,
      }),
    }),
  });
}

function assertISODateString(
  value: string | undefined,
  label: string,
  details?: Readonly<Record<string, unknown>> | undefined,
): asserts value is ISODateString {
  assertRequired(value, label, details);
  // Минимальная проверка: на runtime не делаем full ISO-валидацию (это уже забота transport/Zod).
  // Здесь фиксируем бренд для feature-level типов, предполагая, что boundary отдаёт ISO-строки.
}

function asISODateString(value: string): ISODateString {
  return value as ISODateString;
}

function assertRequired<T>(
  value: T | undefined,
  label: string,
  details?: Readonly<Record<string, unknown>> | undefined,
): asserts value is T {
  if (value === undefined) {
    /* eslint-disable ai-security/data-leakage -- label/details: внутренние технические метки (не пользовательские данные, без PII/secrets) */
    throw createTransportMappingError(`Отсутствует обязательное поле: ${label}`, {
      label,
      ...(details ?? {}),
    });
    /* eslint-enable ai-security/data-leakage -- label/details: внутренние технические метки (не пользовательские данные, без PII/secrets) */
  }
}

function isBotPauseReason(value: unknown): value is BotPauseReason {
  return value === 'manual'
    || value === 'rate_limit'
    || value === 'integration_error'
    || value === 'quota_exceeded';
}

function isBotEnforcementReason(value: unknown): value is BotEnforcementReason {
  return value === 'policy_violation'
    || value === 'security_risk'
    || value === 'billing_issue';
}

/* ============================================================================
 * 🧭 BotStatus mapping (rule-map, fail-closed)
 * ============================================================================
 */

type StatusMapper = (record: UnknownRecord) => BotStatus;

type TransportStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'archived'
  | 'deleted'
  | 'suspended'
  | 'deprecated';

const FIELDS = Object.freeze({
  // backward-compat for API transition: поддерживаем snake_case и camelCase, пока API не стабилизирован
  publishedAt: ['published_at', 'publishedAt'] as const,
  pausedAt: ['paused_at', 'pausedAt'] as const,
  pauseReason: ['reason', 'pause_reason', 'pauseReason'] as const,
  archivedAt: ['archived_at', 'archivedAt'] as const,
  deletedAt: ['deleted_at', 'deletedAt'] as const,
  suspendedAt: ['suspended_at', 'suspendedAt'] as const,
  enforcementReason: ['reason', 'enforcement_reason', 'enforcementReason'] as const,
  deprecatedAt: ['deprecated_at', 'deprecatedAt'] as const,
  replacementBotId: ['replacement_bot_id', 'replacementBotId'] as const,
  updatedAt: ['updated_at', 'updatedAt'] as const,
});

const STATUS_MAPPERS: Readonly<Record<TransportStatus, StatusMapper>> = Object.freeze({
  draft: () => ({ type: 'draft' } as const),

  active: (record) => {
    const publishedAt = readStringField(record, FIELDS.publishedAt);
    assertISODateString(publishedAt, 'published_at|publishedAt', { status: 'active' });
    return { type: 'active', publishedAt: asISODateString(publishedAt) } as const;
  },

  paused: (record) => {
    const pausedAt = readStringField(record, FIELDS.pausedAt);
    assertISODateString(pausedAt, 'paused_at|pausedAt', { status: 'paused' });

    const rawReason = readStringField(record, FIELDS.pauseReason);
    if (!isBotPauseReason(rawReason)) {
      throw createTransportMappingError('Некорректная причина паузы', {
        status: 'paused',
        field: 'reason|pause_reason|pauseReason',
      });
    }

    return { type: 'paused', pausedAt: asISODateString(pausedAt), reason: rawReason } as const;
  },

  archived: (record) => {
    const archivedAt = readStringField(record, FIELDS.archivedAt);
    assertISODateString(archivedAt, 'archived_at|archivedAt', { status: 'archived' });
    return { type: 'archived', archivedAt: asISODateString(archivedAt) } as const;
  },

  deleted: (record) => {
    const deletedAt = readStringField(record, FIELDS.deletedAt);
    assertISODateString(deletedAt, 'deleted_at|deletedAt', { status: 'deleted' });
    return { type: 'deleted', deletedAt: asISODateString(deletedAt) } as const;
  },

  suspended: (record) => {
    const suspendedAt = readStringField(record, FIELDS.suspendedAt);
    assertISODateString(suspendedAt, 'suspended_at|suspendedAt', { status: 'suspended' });

    const rawReason = readStringField(record, FIELDS.enforcementReason);
    if (!isBotEnforcementReason(rawReason)) {
      throw createTransportMappingError('Некорректная причина enforcement', {
        status: 'suspended',
        field: 'reason|enforcement_reason|enforcementReason',
      });
    }

    return {
      type: 'suspended',
      suspendedAt: asISODateString(suspendedAt),
      reason: rawReason,
    } as const;
  },

  deprecated: (record) => {
    const deprecatedAt = readStringField(record, FIELDS.deprecatedAt);
    assertISODateString(deprecatedAt, 'deprecated_at|deprecatedAt', { status: 'deprecated' });

    const replacementBotId = readStringField(record, FIELDS.replacementBotId);
    return {
      type: 'deprecated',
      deprecatedAt: asISODateString(deprecatedAt),
      ...(replacementBotId !== undefined
        ? { replacementBotId: replacementBotId as BotInfo['id'] }
        : {}),
    } as const;
  },
});

function isTransportStatus(value: string): value is TransportStatus {
  return Object.hasOwn(STATUS_MAPPERS, value);
}

function mapStatus(record: UnknownRecord): BotStatus {
  const status = readStringField(record, ['status']);
  assertRequired(status, 'status');

  if (!isTransportStatus(status)) {
    throw createTransportMappingError('Неизвестный статус бота', { status });
  }

  // eslint-disable-next-line security/detect-object-injection -- status валидирован через isTransportStatus (allow-list ключей)
  const mapper = STATUS_MAPPERS[status];
  return mapper(record);
}

/* ============================================================================
 * 🎯 PUBLIC API — transport DTO → BotInfo
 * ============================================================================
 */

/**
 * Преобразует transport DTO бота в `BotInfo` для store/effects/UI.
 *
 * @remarks
 * Fail-closed: если backend прислал форму, которая не позволяет построить корректный `BotStatus`,
 * выбрасывает `BotErrorResponse` с кодом парсинга.
 */
export function mapBotResponseToBotInfo(dto: Readonly<BotResponseTransport>): BotInfo {
  // Базовые поля гарантированы Zod-схемой (BotResponseSchema). Не дублируем проверки.
  const record = asRecord(dto, 'BotResponseTransport');

  const status = mapStatus(record);
  const updatedAt = readStringField(record, FIELDS.updatedAt);

  return Object.freeze({
    id: dto.id as BotInfo['id'],
    name: dto.name,
    status,
    workspaceId: dto.workspace_id as BotInfo['workspaceId'],
    currentVersion: dto.current_version,
    createdAt: asISODateString(dto.created_at),
    ...(updatedAt !== undefined ? { updatedAt: asISODateString(updatedAt) } : {}),
  });
}

/**
 * Преобразует transport DTO списка ботов в список `BotInfo`.
 * Возвращает замороженный массив для защиты от мутаций в store/UI.
 */
export function mapBotsListResponseToBotInfos(
  dto: Readonly<BotsListResponseTransport>,
): readonly BotInfo[] {
  const record = asRecord(dto, 'BotsListResponseTransport');

  const items = record['items'];

  if (!Array.isArray(items)) {
    throw createTransportMappingError('Некорректный список ботов: items должен быть массивом', {
      field: 'items',
    });
  }

  const bots: BotInfo[] = [];
  for (const item of items) {
    bots.push(mapBotResponseToBotInfo(item as BotResponseTransport));
  }

  return Object.freeze(bots);
}
