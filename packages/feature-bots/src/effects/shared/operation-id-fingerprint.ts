/**
 * @file packages/feature-bots/src/effects/shared/operation-id-fingerprint.ts
 * ============================================================================
 * Deterministic `operationId` material (FNV-1a + canonical JSON)
 * ============================================================================
 *
 * Назначение:
 * - Единый SSOT для построения детерминированных `operationId` (`op_<hex>`) в bot-эффектах.
 * - Для вложенных объектов в fingerprint используйте канонический JSON из этого модуля, не «сырой» JSON.stringify:
 *   порядок ключей в plain objects не гарантирован между источниками; stable stringify канонизирует.
 *
 * Контракт:
 * - В функцию склейки строки `source` передавайте только **строковые сегменты** (и соль), плюс при необходимости
 *   один сегмент как результат канонического JSON (см. экспорт ниже) для **небольшого JSON-serializable domain-объекта**
 *   (например `BotSettings`). Не передавайте сюда произвольные большие графы, бинарные буферы и не-domain данные —
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
 * - Если понадобится collision-resistant или криптостойкий хэш — введите **отдельную** функцию/модуль (например SHA-256 + HMAC),
 *   не расширяя смысл этих утилит.
 *
 * Тип {@link OperationId} определён в `types/bot-commands`; здесь только генерация строки id.
 */

import stableStringify from 'fast-json-stable-stringify';

import type { OperationId } from '../../types/bot-commands.js';

/* ============================================================================
 * Соли по эффектам — изоляция idempotency (не одна глобальная соль на пакет)
 *
 * Реестр (добавляйте новые эффекты сюда + новая строка при смене формулы fingerprint):
 * - `createBotFromTemplate` — create-bot-from-template (`create-bot-operation-v1`)
 * - `createCustomBot` — create-custom-bot (`create-custom-bot-operation-v2`, stable JSON для settings)
 * ========================================================================== */

/** Соли для детерминированного `operationId` по видам create-flow / будущим эффектам. */
export const operationIdSalt = {
  createBotFromTemplate: 'create-bot-operation-v1',
  createCustomBot: 'create-custom-bot-operation-v2',
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

/**
 * FNV-1a 32-bit — детерминированный хэш строки (`operationId`, audit redaction surrogate и т.д.).
 *
 * @remarks Не криптографический; см. security в файловом докблоке.
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

/**
 * Каноническая JSON-строка для fingerprint (сортировка ключей на всех уровнях).
 * Используйте для **небольших** JSON-serializable domain-структур (DTO/settings), не для произвольных больших payload.
 */
export function stableJsonFingerprint(value: unknown): string {
  return stableStringify(value);
}

/**
 * Склеивает соль и сегменты через `:` — единый формат источника для {@link toDeterministicOperationId}.
 * Runtime-проверка: `salt` и каждый сегмент — строка (защита от misuse с границы JS).
 */
export function buildOperationIdSource(salt: string, segments: readonly string[]): string {
  assertSaltAndStringSegments(salt, segments);
  return [salt, ...segments].join(':');
}

/**
 * Удобная сборка, когда JSON-serializable domain-объект — **последний** сегмент (например `settings` в create-custom-bot).
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

/**
 * Детерминированный `operationId`: префикс `op_` + hex от {@link fnv1a32} по полной строке `source`.
 */
export function toDeterministicOperationId(source: string): OperationId {
  const hashHex = fnv1a32(source).toString(ID_HASH_HEX_BASE);
  return (`op_${hashHex}` as unknown) as OperationId;
}
