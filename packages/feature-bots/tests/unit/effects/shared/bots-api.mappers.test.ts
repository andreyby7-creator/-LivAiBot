/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import {
  mapBotResponseToBotInfo,
  mapBotsListResponseToBotInfos,
} from '../../../../src/effects/shared/bots-api.mappers.js';

type BotDto = Record<string, unknown> & {
  id: string;
  name: string;
  workspace_id: string;
  current_version: number;
  created_at: string;
  status: string;
};

const createBaseDto = (overrides: Record<string, unknown> = {}): BotDto =>
  ({
    id: 'bot-1',
    name: 'Bot',
    workspace_id: 'ws-1',
    current_version: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    status: 'draft',
    ...overrides,
  }) as BotDto;

describe('bots-api.mappers', () => {
  it('mapBotResponseToBotInfo: draft + optional updatedAt (snake_case)', () => {
    const dto = createBaseDto({ updated_at: '2024-01-02T00:00:00.000Z' });
    const result = mapBotResponseToBotInfo(dto as any);

    expect(result.status).toEqual({ type: 'draft' });
    expect(result.updatedAt).toBe('2024-01-02T00:00:00.000Z');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('mapBotResponseToBotInfo: active читает publishedAt из camelCase', () => {
    const dto = createBaseDto({
      status: 'active',
      publishedAt: '2024-01-03T00:00:00.000Z',
    });
    const result = mapBotResponseToBotInfo(dto as any);
    expect(result.status).toEqual({
      type: 'active',
      publishedAt: '2024-01-03T00:00:00.000Z',
    });
  });

  it('mapBotResponseToBotInfo: paused (валидная причина)', () => {
    const dto = createBaseDto({
      status: 'paused',
      paused_at: '2024-01-04T00:00:00.000Z',
      reason: 'manual',
    });
    const result = mapBotResponseToBotInfo(dto as any);
    expect(result.status).toEqual({
      type: 'paused',
      pausedAt: '2024-01-04T00:00:00.000Z',
      reason: 'manual',
    });
  });

  it('mapBotResponseToBotInfo: archived/deleted/suspended/deprecated (+replacementBotId)', () => {
    const archived = mapBotResponseToBotInfo(
      createBaseDto({
        status: 'archived',
        archived_at: '2024-01-05T00:00:00.000Z',
      }) as any,
    );
    expect(archived.status).toEqual({
      type: 'archived',
      archivedAt: '2024-01-05T00:00:00.000Z',
    });

    const deleted = mapBotResponseToBotInfo(
      createBaseDto({
        status: 'deleted',
        deletedAt: '2024-01-06T00:00:00.000Z',
      }) as any,
    );
    expect(deleted.status).toEqual({
      type: 'deleted',
      deletedAt: '2024-01-06T00:00:00.000Z',
    });

    const suspended = mapBotResponseToBotInfo(
      createBaseDto({
        status: 'suspended',
        suspended_at: '2024-01-07T00:00:00.000Z',
        enforcementReason: 'security_risk',
      }) as any,
    );
    expect(suspended.status).toEqual({
      type: 'suspended',
      suspendedAt: '2024-01-07T00:00:00.000Z',
      reason: 'security_risk',
    });

    const deprecated = mapBotResponseToBotInfo(
      createBaseDto({
        status: 'deprecated',
        deprecatedAt: '2024-01-08T00:00:00.000Z',
        replacement_bot_id: 'bot-2',
      }) as any,
    );
    expect(deprecated.status).toEqual({
      type: 'deprecated',
      deprecatedAt: '2024-01-08T00:00:00.000Z',
      replacementBotId: 'bot-2',
    });
  });

  it('mapBotResponseToBotInfo: deprecated без replacementBotId', () => {
    const dto = createBaseDto({
      status: 'deprecated',
      deprecated_at: '2024-01-08T00:00:00.000Z',
    });
    const result = mapBotResponseToBotInfo(dto as any);
    expect(result.status).toEqual({
      type: 'deprecated',
      deprecatedAt: '2024-01-08T00:00:00.000Z',
    });
  });

  it('mapBotResponseToBotInfo: fail-closed на неизвестный статус', () => {
    const dto = createBaseDto({ status: 'mystery' });
    expect(() => mapBotResponseToBotInfo(dto as any)).toThrow();
  });

  it('mapBotResponseToBotInfo: fail-closed когда статус отсутствует', () => {
    const dto = createBaseDto();
    delete (dto as any).status;
    expect(() => mapBotResponseToBotInfo(dto as any)).toThrow();
  });

  it('mapBotResponseToBotInfo: fail-closed когда обязательные timestamp/reason отсутствуют или невалидны', () => {
    expect(() => mapBotResponseToBotInfo(createBaseDto({ status: 'active' }) as any)).toThrow();
    expect(() =>
      mapBotResponseToBotInfo(
        createBaseDto({
          status: 'paused',
          paused_at: '2024-01-01T00:00:00.000Z',
          reason: 'bad',
        }) as any,
      )
    ).toThrow();
    expect(() =>
      mapBotResponseToBotInfo(
        createBaseDto({
          status: 'suspended',
          suspended_at: '2024-01-01T00:00:00.000Z',
          reason: 'bad',
        }) as any,
      )
    ).toThrow();
  });

  it('mapBotResponseToBotInfo: не-object input -> transport mapping error', () => {
    expect(() => mapBotResponseToBotInfo(null as any)).toThrow();
  });

  it('mapBotsListResponseToBotInfos: map + freeze, пустой и непустой массив', () => {
    const empty = mapBotsListResponseToBotInfos({ items: [] } as any);
    expect(empty).toEqual([]);
    expect(Object.isFrozen(empty)).toBe(true);

    const list = mapBotsListResponseToBotInfos({
      items: [
        createBaseDto({ id: 'bot-a', status: 'draft' }),
        createBaseDto({ id: 'bot-b', status: 'active', published_at: '2024-01-03T00:00:00.000Z' }),
      ],
    } as any);

    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe('bot-a');
    expect(list[1]?.status).toEqual({
      type: 'active',
      publishedAt: '2024-01-03T00:00:00.000Z',
    });
    expect(Object.isFrozen(list)).toBe(true);
  });

  it('mapBotsListResponseToBotInfos: items не массив -> ошибка', () => {
    expect(() => mapBotsListResponseToBotInfos({ items: 'not-array' } as any)).toThrow();
  });

  it('mapBotsListResponseToBotInfos: не-object input -> ошибка', () => {
    expect(() => mapBotsListResponseToBotInfos(undefined as any)).toThrow();
  });
});
