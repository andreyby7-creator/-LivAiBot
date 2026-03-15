/**
 * @file Unit тесты для dto/TestBotRequest.ts
 * Покрывают TestBotRequest тип.
 * Цель: 100% покрытие кода.
 */

import { describe, expect, it } from 'vitest';

import type { ID, JsonObject } from '@livai/core-contracts';

import type { TestBotRequest } from '../../../src/dto/TestBotRequest.js';

// ============================================================================
// Helper functions для создания тестовых данных
// ============================================================================

const createConversationId = (value = 'conv-123'): ID<'Conversation'> =>
  value as ID<'Conversation'>;

const createJsonObject = (value: Record<string, unknown> = { test: 'value' }): JsonObject =>
  value as JsonObject;

// ============================================================================
// Тесты для TestBotRequest
// ============================================================================

describe('TestBotRequest', () => {
  it('создаёт минимальный запрос только с message', () => {
    const request: TestBotRequest = {
      message: 'Hello, bot!',
    };

    expect(request.message).toBe('Hello, bot!');
    expect(request.conversationId).toBeUndefined();
    expect(request.context).toBeUndefined();
  });

  it('создаёт запрос с message и conversationId', () => {
    const request: TestBotRequest = {
      message: 'Test message',
      conversationId: createConversationId('conv-1'),
    };

    expect(request.message).toBe('Test message');
    expect(request.conversationId).toBe('conv-1');
    expect(request.context).toBeUndefined();
  });

  it('создаёт запрос с message и context', () => {
    const request: TestBotRequest = {
      message: 'Test message',
      context: createJsonObject({ key: 'value' }),
    };

    expect(request.message).toBe('Test message');
    expect(request.conversationId).toBeUndefined();
    expect(request.context).toEqual({ key: 'value' });
  });

  it('создаёт запрос со всеми полями', () => {
    const request: TestBotRequest = {
      message: 'Complete test message',
      conversationId: createConversationId('conv-complete'),
      context: createJsonObject({ test: 'data', nested: { value: 123 } }),
    };

    expect(request.message).toBe('Complete test message');
    expect(request.conversationId).toBe('conv-complete');
    expect(request.context).toEqual({ test: 'data', nested: { value: 123 } });
  });

  it('создаёт запрос с различными сообщениями', () => {
    const messages = [
      'Simple message',
      'Message with special chars: !@#$%^&*()',
      `Long message ${'a'.repeat(1000)}`,
      'Message with\nnewlines',
      'Message with\t tabs',
    ];

    messages.forEach((message) => {
      const request: TestBotRequest = {
        message,
      };

      expect(request.message).toBe(message);
    });
  });

  it('создаёт запрос с различными conversationId', () => {
    const conversationIds = [
      createConversationId('conv-1'),
      createConversationId('conv-abc-123'),
      createConversationId('conv-xyz-456'),
    ];

    conversationIds.forEach((conversationId) => {
      const request: TestBotRequest = {
        message: 'Test',
        conversationId,
      };

      expect(request.conversationId).toBe(conversationId);
    });
  });

  it('создаёт запрос с различными context', () => {
    const contexts = [
      createJsonObject({}),
      createJsonObject({ key: 'value' }),
      createJsonObject({ nested: { deep: { value: 123 } } }),
      createJsonObject({ array: [1, 2, 3] }),
      createJsonObject({ boolean: true, number: 42, string: 'test' }),
    ];

    contexts.forEach((context) => {
      const request: TestBotRequest = {
        message: 'Test',
        context,
      };

      expect(request.context).toEqual(context);
    });
  });

  it('создаёт запрос с пустым context объектом', () => {
    const request: TestBotRequest = {
      message: 'Test message',
      context: createJsonObject({}),
    };

    expect(request.context).toEqual({});
  });

  it('создаёт запрос с длинными сообщениями', () => {
    const longMessage = 'a'.repeat(10000);
    const request: TestBotRequest = {
      message: longMessage,
    };

    expect(request.message).toBe(longMessage);
    expect(request.message.length).toBe(10000);
  });

  it('создаёт запрос для нового разговора (без conversationId)', () => {
    const request: TestBotRequest = {
      message: 'Start new conversation',
    };

    expect(request.conversationId).toBeUndefined();
    expect(request.message).toBe('Start new conversation');
  });

  it('создаёт запрос для существующего разговора (с conversationId)', () => {
    const request: TestBotRequest = {
      message: 'Continue conversation',
      conversationId: createConversationId('existing-conv'),
    };

    expect(request.conversationId).toBe('existing-conv');
    expect(request.message).toBe('Continue conversation');
  });

  it('создаёт запрос с контекстом для тестирования', () => {
    const request: TestBotRequest = {
      message: 'Test with context',
      context: createJsonObject({
        userId: 'user-123',
        sessionId: 'session-456',
        metadata: { origin: 'test' },
      }),
    };

    expect(request.context).toEqual({
      userId: 'user-123',
      sessionId: 'session-456',
      metadata: { origin: 'test' },
    });
  });

  it('создаёт запрос с корректной структурой', () => {
    const request: TestBotRequest = {
      message: 'Test',
    };

    expect(request).toHaveProperty('message');
    expect(typeof request.message).toBe('string');
  });

  it('создаёт запрос с различными комбинациями полей', () => {
    // Только message
    const request1: TestBotRequest = {
      message: 'Message 1',
    };

    // message + conversationId
    const request2: TestBotRequest = {
      message: 'Message 2',
      conversationId: createConversationId('conv-2'),
    };

    // message + context
    const request3: TestBotRequest = {
      message: 'Message 3',
      context: createJsonObject({ data: 'value' }),
    };

    // Все поля
    const request4: TestBotRequest = {
      message: 'Message 4',
      conversationId: createConversationId('conv-4'),
      context: createJsonObject({ full: 'context' }),
    };

    expect(request1.message).toBe('Message 1');
    expect(request1.conversationId).toBeUndefined();
    expect(request1.context).toBeUndefined();

    expect(request2.message).toBe('Message 2');
    expect(request2.conversationId).toBe('conv-2');
    expect(request2.context).toBeUndefined();

    expect(request3.message).toBe('Message 3');
    expect(request3.conversationId).toBeUndefined();
    expect(request3.context).toEqual({ data: 'value' });

    expect(request4.message).toBe('Message 4');
    expect(request4.conversationId).toBe('conv-4');
    expect(request4.context).toEqual({ full: 'context' });
  });

  it('проверяет readonly свойства request', () => {
    const request: TestBotRequest = {
      message: 'Test',
    };

    expect(request).toHaveProperty('message');
    expect(Object.isFrozen(request) || Object.isSealed(request)).toBe(false); // TypeScript readonly не делает объект frozen
  });

  it('создаёт запрос с сообщениями, содержащими пробелы', () => {
    const messagesWithSpaces = [
      'Message with spaces',
      '  Message with leading spaces  ',
      'Message   with   multiple   spaces',
    ];

    messagesWithSpaces.forEach((message) => {
      const request: TestBotRequest = {
        message,
      };

      expect(request.message).toBe(message);
    });
  });

  it('создаёт запрос с сообщениями, содержащими специальные символы', () => {
    const specialMessages = [
      'Message!@#$%^&*()',
      'Message with "quotes"',
      "Message with 'single quotes'",
      'Message with {braces}',
      'Message with [brackets]',
    ];

    specialMessages.forEach((message) => {
      const request: TestBotRequest = {
        message,
      };

      expect(request.message).toBe(message);
    });
  });

  it('создаёт запрос с вложенным context', () => {
    const request: TestBotRequest = {
      message: 'Test with nested context',
      context: createJsonObject({
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      }),
    };

    expect(request.context).toEqual({
      level1: {
        level2: {
          level3: {
            value: 'deep',
          },
        },
      },
    });
  });

  it('создаёт запрос с context, содержащим массивы', () => {
    const request: TestBotRequest = {
      message: 'Test with array context',
      context: createJsonObject({
        items: [1, 2, 3],
        tags: ['tag1', 'tag2', 'tag3'],
        nested: {
          array: [{ id: 1 }, { id: 2 }],
        },
      }),
    };

    expect(request.context).toEqual({
      items: [1, 2, 3],
      tags: ['tag1', 'tag2', 'tag3'],
      nested: {
        array: [{ id: 1 }, { id: 2 }],
      },
    });
  });

  it('создаёт запрос для воспроизводимого теста (с conversationId)', () => {
    // Для воспроизводимых тестов рекомендуется явно указывать conversationId
    const request: TestBotRequest = {
      message: 'Reproducible test',
      conversationId: createConversationId('reproducible-conv'),
    };

    expect(request.conversationId).toBe('reproducible-conv');
    expect(request.message).toBe('Reproducible test');
  });

  it('создаёт запрос для нового теста (без conversationId)', () => {
    // Если conversationId не задан, создаётся новый разговор для теста
    const request: TestBotRequest = {
      message: 'New test',
    };

    expect(request.conversationId).toBeUndefined();
    expect(request.message).toBe('New test');
  });
});
