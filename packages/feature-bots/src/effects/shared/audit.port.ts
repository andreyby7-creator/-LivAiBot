/**
 * @file packages/feature-bots/src/effects/shared/audit.port.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Audit Port (Shared)
 * ============================================================================
 *
 * Архитектурная роль:
 * - DI-порт наблюдаемости для bot-эффектов: единая точка, через которую orchestrator'ы и audit-mapper'ы
 *   передают audit/telemetry события во внешний sink (SIEM/логирование/метрики).
 * - Изолирует effects от конкретной реализации доставки (console/http/kafka/…).
 *
 * Принципы:
 * - ✅ SRP: только порт/adapter-обвязка, без бизнес-логики и без знания о сторах/HTTP.
 * - ✅ Deterministic: конфигурация передаётся явно, без глобального состояния.
 * - ✅ Extensible: реализацию можно подменять без изменения orchestrator'ов.
 *
 * @remarks
 * Реальная схема/нормализация audit-событий живёт в lib-layer (`lib/bot-audit.ts`).
 * Этот модуль лишь предоставляет effect-friendly порт и thin adapter поверх lib API.
 */

import type {
  BotAuditSink,
  EmitBotAuditEventOptions,
  EmitBotAuditEventResult,
} from '../../lib/bot-audit.js';
import { emitBotAuditEvent } from '../../lib/bot-audit.js';

/* ============================================================================
 * 🧭 PORT
 * ============================================================================
 */

/**
 * Порт эмита audit-событий для bot-эффектов.
 *
 * @remarks
 * - Вход типизирован как `unknown`, потому что upstream может собирать событие из разных источников
 *   (domain/event template/transport), а строгая runtime-валидация выполняется downstream в lib (`emitBotAuditEvent`).
 * - Метод возвращает результат (ok/err), чтобы consumers могли делать observability без throw/side-effects.
 * - Для high-throughput сценариев используйте sink с очередью/backpressure на infra-уровне
 *   (этот порт intentionally lightweight и синхронный).
 * - PII/секреты: upstream обязан передавать уже санитизированные поля в событиях.
 */
export type BotAuditPort<TEvent = unknown> = Readonly<{
  readonly emit: (
    value: TEvent,
    options?: Readonly<EmitBotAuditEventOptions>,
  ) => EmitBotAuditEventResult;
}>;

/* ============================================================================
 * 🔧 ADAPTER — BotAuditSink → BotAuditPort
 * ============================================================================
 */

export function createBotAuditPortAdapter(
  sink: BotAuditSink,
  defaultOptions?: Readonly<EmitBotAuditEventOptions>,
): BotAuditPort {
  // Snapshot опций на момент создания adapter'а: внешние мутации не должны менять поведение порта.
  const immutableDefaultOptions = defaultOptions === undefined
    ? undefined
    : Object.freeze({ ...defaultOptions });

  return Object.freeze({
    emit: (value, options) => emitBotAuditEvent(value, sink, options ?? immutableDefaultOptions),
  });
}

export const createNoopBotAuditPort = <TEvent = unknown>(): BotAuditPort<TEvent> =>
  Object.freeze({
    emit: () => Object.freeze({ ok: true }),
  });
