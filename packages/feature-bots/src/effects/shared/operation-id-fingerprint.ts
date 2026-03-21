/**
 * @file packages/feature-bots/src/effects/shared/operation-id-fingerprint.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Deterministic Operation ID (FNV-1a + canonical JSON)
 * ============================================================================
 *
 * SSOT для материала детерминированных `operationId` (`op_<hex>`) в bot-эффектах:
 * хэш FNV-1a, канонический JSON, реестр солей. Тип {@link OperationId} — в `types/bot-commands`;
 * здесь — только генерация строки id и вспомогательные утилиты (в т.ч. audit surrogate).
 */

import stableStringify from 'fast-json-stable-stringify';

import type { OperationId } from '../../types/bot-commands.js';

/* ============================================================================
 * 📌 ИНВАРИАНТЫ — НАЗНАЧЕНИЕ, КОНТРАКТ, БЕЗОПАСНОСТЬ
 * ============================================================================
 */

/*
 * Назначение:
 * - Единый SSOT для построения детерминированных `operationId` (`op_<hex>`) в bot-эффектах.
 * - Для вложенных объектов в fingerprint используйте канонический JSON из этого модуля, не «сырой»
 *   `JSON.stringify`: порядок ключей в plain objects не гарантирован между источниками; stable stringify
 *   канонизирует.
 * - Склейка: {@link buildOperationIdSource} — только строковые сегменты (при необходимости каждый сегмент —
 *   результат {@link stableJsonFingerprint} для строки/примитива/`null`). Отдельный builder в секции «SOURCE BUILDERS»
 *   ниже — когда **последний** вклад в source — целый JSON-serializable **объект** (например `BotSettings`): canonical JSON
 *   последним сегментом после `stringSegments`.
 *
 * Контракт:
 * - В функцию склейки строки `source` передавайте только **строковые сегменты** (и соль), плюс при необходимости
 *   один сегмент как результат канонического JSON для **небольшого JSON-serializable domain-объекта**
 *   (например `BotSettings`). Не передавайте произвольные большие графы, бинарные буферы и не-domain данные —
 *   это не контент-хранилище, а материал для idempotency-ключа.
 * - Любое изменение формулы (алгоритм FNV, разделитель, stable JSON, порядок сегментов) требует **новой соли**
 *   для затронутого эффекта — иначе ломается изоляция idempotency-ключей.
 *
 * Реестр солей — {@link operationIdSalt}: при добавлении нового оркестратора заведите новый ключ и документируйте
 * его в комментарии к объекту (масштабируемость без потери «где какая соль»).
 *
 * Безопасность:
 * - **FNV-1a 32-bit не криптографический.** Не используйте для защиты секретов, PII или MAC; только для
 *   детерминированных идентификаторов idempotency / нечувствительных surrogate-строк (например redacted id в audit).
 * - Не вкладывайте в fingerprint сырой секретный материал: при компрометации `source` возможен offline перебор
 *   только для слабых входов — проектируйте входы как публичные/конфигурационные domain-поля.
 * - Если понадобится collision-resistant или криптостойкий хэш — введите **отдельную** функцию/модуль
 *   (например SHA-256 + HMAC), не расширяя смысл этих утилит.
 */

/* ============================================================================
 * 🧂 SALTS — РЕЕСТР (изоляция idempotency по эффектам)
 * ============================================================================
 */

/**
 * Соли для детерминированного `operationId` по видам create-flow / будущим эффектам.
 *
 * @remarks
 * При добавлении оркестратора — новый ключ здесь + новая строка при смене формулы fingerprint:
 * - `createBotFromTemplate` — create-bot-from-template (`create-bot-operation-v2`, последний сегмент — stable JSON строки `instructionOverride`)
 * - `createCustomBot` — create-custom-bot (`create-custom-bot-operation-v3`, stable JSON для instruction/templateId/optional `null` + объект settings)
 */
export const operationIdSalt = {
  createBotFromTemplate: 'create-bot-operation-v2',
  createCustomBot: 'create-custom-bot-operation-v3',
} as const;

/** Ключи {@link operationIdSalt} — для типизации новых оркестраторов. */
export type OperationIdSaltKey = keyof typeof operationIdSalt;

const ID_HASH_HEX_BASE = 16;

function assertSaltAndStringSegments(salt: string, segments: readonly string[]): void {
  if (typeof salt !== 'string') {
    throw new Error('operation-id-fingerprint: salt must be a string');
  }
  let index = 0;
  for (const seg of segments) {
    if (typeof seg !== 'string') {
      throw new TypeError(
        `operation-id-fingerprint: segment[${String(index)}] must be string, got ${typeof seg}`,
      );
    }
    index += 1;
  }
}

/* ============================================================================
 * 🔢 HASH — FNV-1a 32-bit
 * ============================================================================
 */

/**
 * FNV-1a 32-bit — детерминированный хэш строки (`operationId`, audit redaction surrogate и т.д.).
 *
 * @remarks Не криптографический; см. security в секции «Инварианты» в начале файла.
 */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  const FNV_PRIME = 0x01000193;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
}

/* ============================================================================
 * 📦 STABLE JSON — КАНОНИЧЕСКИЙ FINGERPRINT
 * ============================================================================
 */

/**
 * Каноническая JSON-строка для fingerprint (сортировка ключей на всех уровнях).
 * Используйте для **небольших** JSON-serializable domain-структур (DTO/settings), не для произвольных больших payload.
 */
export function stableJsonFingerprint(value: unknown): string {
  return stableStringify(value);
}

/* ============================================================================
 * 🧱 SOURCE BUILDERS — СКЛЕЙКА `source` ДЛЯ `op_*`
 * ============================================================================
 */

/**
 * Склеивает соль и сегменты через `:` — единый формат источника для {@link toDeterministicOperationId}.
 * Runtime-проверка: `salt` и каждый сегмент — строка (защита от misuse с границы JS).
 */
export function buildOperationIdSource(salt: string, segments: readonly string[]): string {
  assertSaltAndStringSegments(salt, segments);
  return [salt, ...segments].join(':');
}

/**
 * Сборка `source`, когда последний материал — **целый JSON-serializable объект** (DTO), например `BotSettings` в create-custom-bot.
 * Строковые поля с префикса оркестратора кладите в `stringSegments` как отдельные сегменты; при необходимости канонизируйте
 * каждую строку через {@link stableJsonFingerprint} (как для `instruction`), чтобы не смешивать с «сырым» текстом в hash.
 *
 * @remarks
 * Не используйте этот хелпер «просто ради строки» — для одной строки достаточно {@link stableJsonFingerprint} внутри
 * {@link buildOperationIdSource} (см. докблок «Инварианты»).
 */
export function buildOperationIdSourceWithStableJson(
  salt: string,
  stringSegments: readonly string[],
  domainJsonPayload: unknown,
): string {
  return buildOperationIdSource(salt, [
    ...stringSegments,
    stableJsonFingerprint(domainJsonPayload),
  ]);
}

/* ============================================================================
 * 🆔 OPERATION ID — `op_<hex>`
 * ============================================================================
 */

/**
 * Детерминированный `operationId`: префикс `op_` + hex от {@link fnv1a32} по полной строке `source`.
 */
export function toDeterministicOperationId(source: string): OperationId {
  const hashHex = fnv1a32(source).toString(ID_HASH_HEX_BASE);
  return (`op_${hashHex}` as unknown) as OperationId;
}
