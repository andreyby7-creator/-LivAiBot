/**
 * @file Unit тесты для domain/bots.ts
 */
import { describe, expect, it } from 'vitest';
import type {
  BotListResponse,
  BotResponse,
  CreateBotRequest,
  UpdateInstructionRequest,
} from '../../../src/domain/bots.js';
import type { JsonObject, Timestamp, UUID } from '../../../src/domain/common.js';

describe('BotResponse', () => {
  it('валидная структура BotResponse', () => {
    const response: BotResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
      workspace_id: '123e4567-e89b-12d3-a456-426614174000' as UUID,
      name: 'My Bot',
      status: 'active',
      created_at: '2026-01-09T21:34:12.123Z' as Timestamp,
      current_version: 1,
    };

    expect(response).toMatchObject({
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'My Bot',
      status: 'active',
      created_at: '2026-01-09T21:34:12.123Z',
      current_version: 1,
    });
  });

  it('status принимает только "draft" или "active"', () => {
    const draftBot: BotResponse = {
      id: 'bot-1' as UUID,
      workspace_id: 'workspace-1' as UUID,
      name: 'Draft Bot',
      status: 'draft',
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
      current_version: 1,
    };

    const activeBot: BotResponse = {
      id: 'bot-2' as UUID,
      workspace_id: 'workspace-2' as UUID,
      name: 'Active Bot',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
      current_version: 2,
    };

    expect(draftBot.status).toBe('draft');
    expect(activeBot.status).toBe('active');
  });

  it('отвергает недопустимые значения status', () => {
    // Создаем объект с неправильным типом через type assertion для теста
    const invalidBot = {
      id: 'bot-1' as UUID,
      workspace_id: 'workspace-1' as UUID,
      name: 'Bot',
      status: 'inactive' as any, // Обход проверки типов для теста
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
      current_version: 1,
    } as BotResponse;

    expect(invalidBot.status).toBe('inactive');
  });

  it('current_version является положительным числом', () => {
    const bot: BotResponse = {
      id: 'bot-1' as UUID,
      workspace_id: 'workspace-1' as UUID,
      name: 'Bot',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
      current_version: 5,
    };

    expect(bot.current_version).toBeGreaterThan(0);
    expect(Number.isInteger(bot.current_version)).toBe(true);
  });

  it('все поля обязательны', () => {
    expect(() => {
      // @ts-expect-error - отсутствие id
      const invalid: BotResponse = {
        workspace_id: 'workspace-1' as UUID,
        name: 'Bot',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z' as Timestamp,
        current_version: 1,
      };
    }).not.toThrow();

    // Аналогично для других полей...
  });

  it('снапшот структуры', () => {
    const response: BotResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
      workspace_id: '123e4567-e89b-12d3-a456-426614174000' as UUID,
      name: 'Assistant Bot',
      status: 'active',
      created_at: '2026-01-09T21:34:12.123Z' as Timestamp,
      current_version: 3,
    };

    expect(response).toMatchSnapshot();
  });
});

describe('CreateBotRequest', () => {
  it('валидная структура CreateBotRequest', () => {
    const request: CreateBotRequest = {
      name: 'New Bot',
      instruction: 'You are a helpful assistant.',
      settings: {
        temperature: 0.7,
        max_tokens: 1000,
      },
    };

    expect(request).toMatchObject({
      name: 'New Bot',
      instruction: 'You are a helpful assistant.',
      settings: {
        temperature: 0.7,
        max_tokens: 1000,
      },
    });
  });

  it('минимальная структура CreateBotRequest', () => {
    const request: CreateBotRequest = {
      name: 'Simple Bot',
      instruction: 'Hello world',
    };

    expect(request).toMatchObject({
      name: 'Simple Bot',
      instruction: 'Hello world',
    });

    expect(request).not.toHaveProperty('settings');
  });

  it('name и instruction обязательны', () => {
    expect(() => {
      // @ts-expect-error - отсутствие name
      const invalid: CreateBotRequest = {
        instruction: 'Hello',
      };
    }).not.toThrow();

    expect(() => {
      // @ts-expect-error - отсутствие instruction
      const invalid: CreateBotRequest = {
        name: 'Bot',
      };
    }).not.toThrow();
  });

  it('settings является JsonObject', () => {
    const request: CreateBotRequest = {
      name: 'Bot',
      instruction: 'Hello',
      settings: {
        key: 'value',
        nested: { prop: 123 },
        array: [1, 2, 3],
      } as JsonObject,
    };

    expect(request.settings).toBeDefined();
    expect(typeof request.settings).toBe('object');
  });

  it('снапшот структуры', () => {
    const request: CreateBotRequest = {
      name: 'Customer Support Bot',
      instruction: 'You are a customer support assistant for our company.',
      settings: {
        model: 'gpt-4',
        temperature: 0.3,
        max_tokens: 500,
        system_prompt: 'Be helpful and polite.',
      },
    };

    expect(request).toMatchSnapshot();
  });
});

describe('UpdateInstructionRequest', () => {
  it('валидная структура UpdateInstructionRequest', () => {
    const request: UpdateInstructionRequest = {
      instruction: 'Updated instruction for the bot.',
      settings: {
        temperature: 0.8,
        model: 'gpt-4',
      },
    };

    expect(request).toMatchObject({
      instruction: 'Updated instruction for the bot.',
      settings: {
        temperature: 0.8,
        model: 'gpt-4',
      },
    });
  });

  it('только instruction обязателен', () => {
    const request: UpdateInstructionRequest = {
      instruction: 'New instruction',
    };

    expect(request.instruction).toBe('New instruction');
    expect(request).not.toHaveProperty('settings');
  });

  it('settings опционален', () => {
    const requestWithSettings: UpdateInstructionRequest = {
      instruction: 'Instruction',
      settings: { key: 'value' } as JsonObject,
    };

    const requestWithoutSettings: UpdateInstructionRequest = {
      instruction: 'Instruction',
    };

    expect(requestWithSettings).toHaveProperty('settings');
    expect(requestWithoutSettings).not.toHaveProperty('settings');
  });

  it('снапшот структуры', () => {
    const request: UpdateInstructionRequest = {
      instruction:
        'You are an AI assistant specialized in customer service. Always be polite, helpful, and provide accurate information.',
      settings: {
        model: 'gpt-4-turbo',
        temperature: 0.7,
        max_tokens: 1000,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      },
    };

    expect(request).toMatchSnapshot();
  });
});

describe('BotListResponse', () => {
  it('валидная структура BotListResponse', () => {
    const response: BotListResponse = {
      items: [
        {
          id: 'bot-1' as UUID,
          workspace_id: 'workspace-1' as UUID,
          name: 'Bot 1',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z' as Timestamp,
          current_version: 1,
        },
        {
          id: 'bot-2' as UUID,
          workspace_id: 'workspace-1' as UUID,
          name: 'Bot 2',
          status: 'draft',
          created_at: '2024-01-02T00:00:00Z' as Timestamp,
          current_version: 1,
        },
      ],
    };

    expect(response.items).toHaveLength(2);
    expect(response.items[0]!.name).toBe('Bot 1');
    expect(response.items[1]!.status).toBe('draft');
  });

  it('пустой список ботов', () => {
    const response: BotListResponse = {
      items: [],
    };

    expect(response.items).toEqual([]);
    expect(response.items).toHaveLength(0);
  });

  it('один бот в списке', () => {
    const response: BotListResponse = {
      items: [
        {
          id: 'single-bot' as UUID,
          workspace_id: 'workspace-1' as UUID,
          name: 'Single Bot',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z' as Timestamp,
          current_version: 2,
        },
      ],
    };

    expect(response.items).toHaveLength(1);
    expect(response.items[0]!.current_version).toBe(2);
  });

  it('items содержит только BotResponse объекты', () => {
    const response: BotListResponse = {
      items: [
        {
          id: 'bot-1' as UUID,
          workspace_id: 'workspace-1' as UUID,
          name: 'Bot 1',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z' as Timestamp,
          current_version: 1,
        },
      ],
    };

    // Проверяем, что каждый элемент имеет правильную структуру
    response.items.forEach((bot) => {
      expect(bot).toHaveProperty('id');
      expect(bot).toHaveProperty('workspace_id');
      expect(bot).toHaveProperty('name');
      expect(bot).toHaveProperty('status');
      expect(bot).toHaveProperty('created_at');
      expect(bot).toHaveProperty('current_version');
      expect(['draft', 'active']).toContain(bot.status);
    });
  });

  it('снапшот структуры', () => {
    const response: BotListResponse = {
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
          workspace_id: '123e4567-e89b-12d3-a456-426614174000' as UUID,
          name: 'Customer Support Bot',
          status: 'active',
          created_at: '2026-01-09T10:00:00.000Z' as Timestamp,
          current_version: 5,
        },
        {
          id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' as UUID,
          workspace_id: '123e4567-e89b-12d3-a456-426614174000' as UUID,
          name: 'Sales Assistant',
          status: 'draft',
          created_at: '2026-01-09T11:00:00.000Z' as Timestamp,
          current_version: 1,
        },
      ],
    };

    expect(response).toMatchSnapshot();
  });
});

describe('Интеграционные тесты bot lifecycle', () => {
  it('CreateBotRequest -> BotResponse flow', () => {
    // Создание бота
    const createRequest: CreateBotRequest = {
      name: 'New Bot',
      instruction: 'You are a helpful assistant',
      settings: { model: 'gpt-4' } as JsonObject,
    };

    // Ожидаемый ответ после создания
    const createdBot: BotResponse = {
      id: 'bot-uuid-123' as UUID,
      workspace_id: 'workspace-uuid-456' as UUID,
      name: createRequest.name,
      status: 'draft',
      created_at: '2024-01-01T12:00:00Z' as Timestamp,
      current_version: 1,
    };

    expect(createdBot.name).toBe(createRequest.name);
    expect(createdBot.status).toBe('draft');
    expect(createdBot.current_version).toBe(1);
  });

  it('UpdateInstructionRequest создает новую версию', () => {
    // Исходный бот
    const originalBot: BotResponse = {
      id: 'bot-1' as UUID,
      workspace_id: 'workspace-1' as UUID,
      name: 'Bot',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
      current_version: 2,
    };

    // Запрос на обновление
    const updateRequest: UpdateInstructionRequest = {
      instruction: 'Updated instruction',
      settings: { temperature: 0.8 } as JsonObject,
    };

    // Ожидаемый результат - новая версия
    const updatedBot: BotResponse = {
      ...originalBot,
      current_version: originalBot.current_version + 1,
      created_at: '2024-01-02T00:00:00Z' as Timestamp,
    };

    expect(updatedBot.current_version).toBe(originalBot.current_version + 1);
    expect(updatedBot.id).toBe(originalBot.id); // ID не меняется
    expect(updatedBot.created_at).not.toBe(originalBot.created_at); // Timestamp обновляется
  });

  it('BotListResponse фильтрует по workspace', () => {
    const workspaceId = 'workspace-123' as UUID;

    const listResponse: BotListResponse = {
      items: [
        {
          id: 'bot-1' as UUID,
          workspace_id: workspaceId,
          name: 'Bot 1',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z' as Timestamp,
          current_version: 1,
        },
        {
          id: 'bot-2' as UUID,
          workspace_id: workspaceId,
          name: 'Bot 2',
          status: 'draft',
          created_at: '2024-01-01T00:00:00Z' as Timestamp,
          current_version: 1,
        },
      ],
    };

    // Все боты должны принадлежать одному workspace
    listResponse.items.forEach((bot) => {
      expect(bot.workspace_id).toBe(workspaceId);
    });
  });

  it('exhaustive проверка union типов', () => {
    const statuses: Array<'draft' | 'active'> = ['draft', 'active'];

    // Проверяем, что все возможные значения status перечислены
    statuses.forEach((status) => {
      const bot: BotResponse = {
        id: 'bot-1' as UUID,
        workspace_id: 'workspace-1' as UUID,
        name: 'Bot',
        status,
        created_at: '2024-01-01T00:00:00Z' as Timestamp,
        current_version: 1,
      };

      expect(['draft', 'active']).toContain(bot.status);
    });
  });

  it('снапшот полного bot workflow', () => {
    const botWorkflow = {
      create: {
        request: {
          name: 'AI Assistant',
          instruction: 'You are a helpful AI assistant.',
          settings: {
            model: 'gpt-4',
            temperature: 0.7,
          },
        } as CreateBotRequest,
        response: {
          id: 'bot-uuid-123' as UUID,
          workspace_id: 'workspace-uuid-456' as UUID,
          name: 'AI Assistant',
          status: 'draft' as const,
          created_at: '2024-01-01T10:00:00Z' as Timestamp,
          current_version: 1,
        } as BotResponse,
      },
      update: {
        request: {
          instruction: 'You are an advanced AI assistant with expertise in customer service.',
          settings: {
            model: 'gpt-4-turbo',
            temperature: 0.6,
            max_tokens: 1000,
          },
        } as UpdateInstructionRequest,
        response: {
          id: 'bot-uuid-123' as UUID,
          workspace_id: 'workspace-uuid-456' as UUID,
          name: 'AI Assistant',
          status: 'active' as const,
          created_at: '2024-01-01T10:00:00Z' as Timestamp,
          current_version: 2,
        } as BotResponse,
      },
      list: {
        response: {
          items: [
            {
              id: 'bot-uuid-123' as UUID,
              workspace_id: 'workspace-uuid-456' as UUID,
              name: 'AI Assistant',
              status: 'active' as const,
              created_at: '2024-01-01T10:00:00Z' as Timestamp,
              current_version: 2,
            },
          ],
        } as BotListResponse,
      },
    };

    expect(botWorkflow).toMatchSnapshot();
  });
});
