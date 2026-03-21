/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import {
  buildOperationIdSource,
  buildOperationIdSourceWithStableJson,
  fnv1a32,
  operationIdSalt,
  stableJsonFingerprint,
  toDeterministicOperationId,
} from '../../../../src/effects/shared/operation-id-fingerprint.js';

describe('operation-id-fingerprint', () => {
  describe('канонический JSON fingerprint', () => {
    it('одинаковая логика при разном порядке ключей (вложенность)', () => {
      const a = { z: 1, a: 2, m: { y: 1, x: 2 } };
      const b = { a: 2, m: { x: 2, y: 1 }, z: 1 };
      expect(stableJsonFingerprint(a)).toBe(stableJsonFingerprint(b));
    });
  });

  describe('склейка source из соли и сегментов', () => {
    it('бросает TypeError, если сегмент не строка (runtime boundary)', () => {
      expect(() => buildOperationIdSource('salt', ['ok', null as unknown as string])).toThrow(
        TypeError,
      );
      expect(() => buildOperationIdSource(null as unknown as string, ['a'])).toThrow(Error);
    });
  });

  describe('golden toDeterministicOperationId', () => {
    it('from-template salt v1: бит-в-бит с прежней склейкой', () => {
      const source = buildOperationIdSource(operationIdSalt.createBotFromTemplate, [
        'ws1',
        'tpl1',
        'BotName',
        'override',
      ]);
      expect(toDeterministicOperationId(source)).toBe('op_85d61ea3');
    });

    it('custom-bot salt v2: соль + сегменты + stable JSON settings', () => {
      const source = buildOperationIdSourceWithStableJson(
        operationIdSalt.createCustomBot,
        ['ws1', 'MyBot', 'do things', ''],
        { foo: 1 },
      );
      expect(toDeterministicOperationId(source)).toBe('op_5ddfb22d');
    });
  });

  describe('разные сегменты → разные operationId (страховка от случайной поломки склейки)', () => {
    it('различает наборы строковых сегментов', () => {
      const salt = operationIdSalt.createBotFromTemplate;
      const a = toDeterministicOperationId(buildOperationIdSource(salt, ['w', 't', 'n', '']));
      const b = toDeterministicOperationId(buildOperationIdSource(salt, ['w', 't', 'n', 'x']));
      expect(a).not.toBe(b);
    });

    it('различает JSON tail при прочих равных строках', () => {
      const salt = operationIdSalt.createCustomBot;
      const base = ['ws', 'n', 'i', ''] as const;
      const x = toDeterministicOperationId(
        buildOperationIdSourceWithStableJson(salt, base, { a: 1 }),
      );
      const y = toDeterministicOperationId(
        buildOperationIdSourceWithStableJson(salt, base, { a: 2 }),
      );
      expect(x).not.toBe(y);
    });
  });

  describe('хелпер: stable JSON последним сегментом', () => {
    it('совпадает с ручной склейкой: канонический JSON последним сегментом', () => {
      const salt = operationIdSalt.createCustomBot;
      const segs = ['a', 'b', 'c', ''] as const;
      const payload = { k: [3, 2, 1] };
      const manual = buildOperationIdSource(salt, [...segs, stableJsonFingerprint(payload)]);
      const helper = buildOperationIdSourceWithStableJson(salt, segs, payload);
      expect(helper).toBe(manual);
      expect(toDeterministicOperationId(helper)).toBe(toDeterministicOperationId(manual));
    });
  });

  describe('FNV-1a 32-bit', () => {
    it('детерминирован на одной и той же строке', () => {
      const s = 'redact-me';
      expect(fnv1a32(s)).toBe(fnv1a32(s));
    });
  });
});
