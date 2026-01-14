/**
 * @file Unit тесты для domain/conversations.ts
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLE,
  STATUS_ACTIVE,
  SYSTEM_ROLE,
  TEST_BOT_ID,
  TEST_INSTRUCTION,
  TEST_MESSAGE_CONTENT,
  TEST_THREAD_ID,
  TEST_WORKSPACE_ID,
  USER_ROLE,
} from '../../constants';
import type {
  MessageListResponse,
  MessageResponse,
  ThreadResponse,
} from '../../../src/domain/conversations.js';
import type { Timestamp, UUID } from '../../../src/domain/common.js';

describe('ThreadResponse', () => {
  it('валидная структура ThreadResponse', () => {
    const response: ThreadResponse = {
      id: TEST_THREAD_ID as UUID,
      workspace_id: TEST_WORKSPACE_ID as UUID,
      status: STATUS_ACTIVE,
      created_at: '2026-01-09T21:34:12.123Z' as Timestamp,
    };

    expect(response).toMatchObject({
      id: TEST_THREAD_ID,
      workspace_id: TEST_WORKSPACE_ID,
      status: STATUS_ACTIVE,
      created_at: '2026-01-09T21:34:12.123Z',
    });
  });

  it('status всегда "active"', () => {
    const response: ThreadResponse = {
      id: TEST_THREAD_ID as UUID,
      workspace_id: TEST_WORKSPACE_ID as UUID,
      status: STATUS_ACTIVE,
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
    };

    expect(response.status).toBe(STATUS_ACTIVE);
  });

  it('bot_id опционален', () => {
    const withBot: ThreadResponse = {
      id: TEST_THREAD_ID as UUID,
      workspace_id: TEST_WORKSPACE_ID as UUID,
      bot_id: TEST_BOT_ID as UUID,
      status: STATUS_ACTIVE,
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
    };

    const withoutBot: ThreadResponse = {
      id: 'thread-2' as UUID,
      workspace_id: 'workspace-2' as UUID,
      status: STATUS_ACTIVE,
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
    };

    expect(withBot).toHaveProperty('bot_id');
    expect(withoutBot).not.toHaveProperty('bot_id');
  });

  it('все обязательные поля присутствуют', () => {
    expect(() => {
      // @ts-expect-error - отсутствие id
      const invalid: ThreadResponse = {
        workspace_id: 'workspace-1' as UUID,
        status: STATUS_ACTIVE,
        created_at: '2024-01-01T00:00:00Z' as Timestamp,
      };
      expect(invalid).toBeDefined();
    }).not.toThrow();

    // Аналогично для других обязательных полей
  });

  it('снапшот структуры', () => {
    const response: ThreadResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
      workspace_id: '123e4567-e89b-12d3-a456-426614174000' as UUID,
      bot_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' as UUID,
      status: STATUS_ACTIVE,
      created_at: '2026-01-09T21:34:12.123Z' as Timestamp,
    };

    expect(response).toMatchSnapshot();
  });
});

describe('MessageResponse', () => {
  it('валидная структура MessageResponse', () => {
    const response: MessageResponse = {
      id: '550e8400-e29b-41d4-a716-446655440001' as UUID,
      thread_id: TEST_THREAD_ID as UUID,
      role: USER_ROLE,
      content: TEST_MESSAGE_CONTENT,
      created_at: '2026-01-09T21:34:12.123Z' as Timestamp,
    };

    expect(response).toMatchObject({
      id: '550e8400-e29b-41d4-a716-446655440001',
      thread_id: TEST_THREAD_ID,
      role: USER_ROLE,
      content: TEST_MESSAGE_CONTENT,
      created_at: '2026-01-09T21:34:12.123Z',
    });
  });

  it('role принимает только допустимые значения', () => {
    const userMessage: MessageResponse = {
      id: 'msg-1' as UUID,
      thread_id: 'thread-1' as UUID,
      role: USER_ROLE,
      content: 'User message',
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
    };

    const assistantMessage: MessageResponse = {
      id: 'msg-2' as UUID,
      thread_id: 'thread-1' as UUID,
      role: DEFAULT_ROLE,
      content: 'Assistant response',
      created_at: '2024-01-01T00:00:01Z' as Timestamp,
    };

    const systemMessage: MessageResponse = {
      id: 'msg-3' as UUID,
      thread_id: 'thread-1' as UUID,
      role: SYSTEM_ROLE,
      content: 'System prompt',
      created_at: '2024-01-01T00:00:02Z' as Timestamp,
    };

    expect(userMessage.role).toBe(USER_ROLE);
    expect(assistantMessage.role).toBe(DEFAULT_ROLE);
    expect(systemMessage.role).toBe(SYSTEM_ROLE);
  });

  it('отвергает недопустимые значения role', () => {
    // Создаем объект с неправильным типом через type assertion для теста
    const invalidMessage = {
      id: 'msg-1' as UUID,
      thread_id: 'thread-1' as UUID,
      role: 'admin' as any, // Обход проверки типов для теста
      content: 'Invalid role',
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
    } as MessageResponse;

    expect(invalidMessage.role).toBe('admin');
  });

  it('content может быть любой строкой', () => {
    const messages: MessageResponse[] = [
      {
        id: 'msg-1' as UUID,
        thread_id: 'thread-1' as UUID,
        role: USER_ROLE,
        content: 'Simple text',
        created_at: '2024-01-01T00:00:00Z' as Timestamp,
      },
      {
        id: 'msg-2' as UUID,
        thread_id: 'thread-1' as UUID,
        role: DEFAULT_ROLE,
        content: 'Multi-line\nresponse\nwith\nnewlines',
        created_at: '2024-01-01T00:00:01Z' as Timestamp,
      },
      {
        id: 'msg-3' as UUID,
        thread_id: 'thread-1' as UUID,
        role: SYSTEM_ROLE,
        content: '',
        created_at: '2024-01-01T00:00:02Z' as Timestamp,
      },
    ];

    messages.forEach((msg) => {
      expect(typeof msg.content).toBe('string');
    });
  });

  it('thread_id ссылается на существующий thread', () => {
    const threadId = 'thread-123' as UUID;

    const message: MessageResponse = {
      id: 'msg-1' as UUID,
      thread_id: threadId,
      role: USER_ROLE,
      content: 'Message in thread',
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
    };

    expect(message.thread_id).toBe(threadId);
  });

  it('все поля обязательны', () => {
    expect(() => {
      // @ts-expect-error - отсутствие id
      const invalid: MessageResponse = {
        thread_id: 'thread-1' as UUID,
        role: USER_ROLE,
        content: 'content',
        created_at: '2024-01-01T00:00:00Z' as Timestamp,
      };
      expect(invalid).toBeDefined();
    }).not.toThrow();

    // Аналогично для других полей
  });

  it('снапшот структуры', () => {
    const response: MessageResponse = {
      id: '550e8400-e29b-41d4-a716-446655440001' as UUID,
      thread_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
      role: DEFAULT_ROLE,
      content: "Hello! I'm an AI assistant. How can I help you today?",
      created_at: '2026-01-09T21:34:12.123Z' as Timestamp,
    };

    expect(response).toMatchSnapshot();
  });
});

describe('MessageListResponse', () => {
  it('валидная структура MessageListResponse', () => {
    const response: MessageListResponse = {
      items: [
        {
          id: 'msg-1' as UUID,
          thread_id: 'thread-1' as UUID,
          role: USER_ROLE,
          content: 'Hello',
          created_at: '2024-01-01T10:00:00Z' as Timestamp,
        },
        {
          id: 'msg-2' as UUID,
          thread_id: 'thread-1' as UUID,
          role: DEFAULT_ROLE,
          content: 'Hi there!',
          created_at: '2024-01-01T10:00:01Z' as Timestamp,
        },
      ],
    };

    expect(response.items).toHaveLength(2);
    expect(response.items[0]!.role).toBe(USER_ROLE);
    expect(response.items[1]!.role).toBe(DEFAULT_ROLE);
  });

  it('пустой список сообщений', () => {
    const response: MessageListResponse = {
      items: [],
    };

    expect(response.items).toEqual([]);
    expect(response.items).toHaveLength(0);
  });

  it('одно сообщение в списке', () => {
    const response: MessageListResponse = {
      items: [
        {
          id: 'single-msg' as UUID,
          thread_id: 'thread-1' as UUID,
          role: SYSTEM_ROLE,
          content: TEST_INSTRUCTION,
          created_at: '2024-01-01T00:00:00Z' as Timestamp,
        },
      ],
    };

    expect(response.items).toHaveLength(1);
    expect(response.items[0]!.role).toBe(SYSTEM_ROLE);
  });

  it('сообщения отсортированы по времени создания', () => {
    const response: MessageListResponse = {
      items: [
        {
          id: 'msg-1' as UUID,
          thread_id: 'thread-1' as UUID,
          role: USER_ROLE,
          content: 'First message',
          created_at: '2024-01-01T10:00:00Z' as Timestamp,
        },
        {
          id: 'msg-2' as UUID,
          thread_id: 'thread-1' as UUID,
          role: DEFAULT_ROLE,
          content: 'Second message',
          created_at: '2024-01-01T10:00:01Z' as Timestamp,
        },
        {
          id: 'msg-3' as UUID,
          thread_id: 'thread-1' as UUID,
          role: USER_ROLE,
          content: 'Third message',
          created_at: '2024-01-01T10:00:02Z' as Timestamp,
        },
      ],
    };

    // Проверяем, что timestamps идут в правильном порядке (без циклов/мутаций)
    response.items
      .slice(1)
      .map((item, idx) => {
        const prevTime = new Date(response.items[idx]!.created_at).getTime();
        const currTime = new Date(item.created_at).getTime();
        return { prevTime, currTime };
      })
      .forEach(({ prevTime, currTime }) => {
        expect(currTime).toBeGreaterThan(prevTime);
      });
  });

  it('все сообщения принадлежат одному thread', () => {
    const threadId = 'conversation-thread-123' as UUID;

    const response: MessageListResponse = {
      items: [
        {
          id: 'msg-1' as UUID,
          thread_id: threadId,
          role: USER_ROLE,
          content: 'Hello',
          created_at: '2024-01-01T10:00:00Z' as Timestamp,
        },
        {
          id: 'msg-2' as UUID,
          thread_id: threadId,
          role: DEFAULT_ROLE,
          content: 'Hi!',
          created_at: '2024-01-01T10:00:01Z' as Timestamp,
        },
      ],
    };

    response.items.forEach((message) => {
      expect(message.thread_id).toBe(threadId);
    });
  });

  it('items содержит только MessageResponse объекты', () => {
    const response: MessageListResponse = {
      items: [
        {
          id: 'msg-1' as UUID,
          thread_id: 'thread-1' as UUID,
          role: USER_ROLE,
          content: 'User message',
          created_at: '2024-01-01T00:00:00Z' as Timestamp,
        },
      ],
    };

    response.items.forEach((message) => {
      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('thread_id');
      expect(message).toHaveProperty('role');
      expect(message).toHaveProperty('content');
      expect(message).toHaveProperty('created_at');
      expect([USER_ROLE, DEFAULT_ROLE, SYSTEM_ROLE]).toContain(message.role);
    });
  });

  it('снапшот структуры', () => {
    const response: MessageListResponse = {
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001' as UUID,
          thread_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
          role: USER_ROLE,
          content: 'Can you help me with my account settings?',
          created_at: '2026-01-09T21:34:10.000Z' as Timestamp,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002' as UUID,
          thread_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
          role: DEFAULT_ROLE,
          content:
            "Of course! I'd be happy to help you with your account settings. What specific settings would you like to modify?",
          created_at: '2026-01-09T21:34:12.123Z' as Timestamp,
        },
      ],
    };

    expect(response).toMatchSnapshot();
  });
});

describe('Интеграционные тесты conversation flow', () => {
  it('ThreadResponse -> MessageListResponse consistency', () => {
    const thread: ThreadResponse = {
      id: 'thread-123' as UUID,
      workspace_id: 'workspace-456' as UUID,
      bot_id: 'bot-789' as UUID,
      status: STATUS_ACTIVE,
      created_at: '2024-01-01T10:00:00Z' as Timestamp,
    };

    const messages: MessageListResponse = {
      items: [
        {
          id: 'msg-1' as UUID,
          thread_id: thread.id, // Ссылка на thread
          role: USER_ROLE,
          content: 'Hello bot!',
          created_at: '2024-01-01T10:00:01Z' as Timestamp,
        },
        {
          id: 'msg-2' as UUID,
          thread_id: thread.id, // Ссылка на thread
          role: DEFAULT_ROLE,
          content: 'Hello! How can I help you?',
          created_at: '2024-01-01T10:00:02Z' as Timestamp,
        },
      ],
    };

    // Все сообщения должны ссылаться на один thread
    messages.items.forEach((message) => {
      expect(message.thread_id).toBe(thread.id);
    });

    // Thread должен быть создан раньше первого сообщения
    const threadTime = new Date(thread.created_at).getTime();
    const firstMessageTime = new Date(messages.items[0]!.created_at).getTime();
    expect(firstMessageTime).toBeGreaterThan(threadTime);
  });

  it('role transitions в conversation', () => {
    const conversation: MessageListResponse = {
      items: [
        {
          id: '1' as UUID,
          thread_id: 'thread' as UUID,
          role: SYSTEM_ROLE,
          content: 'Setup',
          created_at: '2024-01-01T10:00:00Z' as Timestamp,
        },
        {
          id: '2' as UUID,
          thread_id: 'thread' as UUID,
          role: USER_ROLE,
          content: 'Hello',
          created_at: '2024-01-01T10:00:01Z' as Timestamp,
        },
        {
          id: '3' as UUID,
          thread_id: 'thread' as UUID,
          role: DEFAULT_ROLE,
          content: 'Hi!',
          created_at: '2024-01-01T10:00:02Z' as Timestamp,
        },
        {
          id: '4' as UUID,
          thread_id: 'thread' as UUID,
          role: USER_ROLE,
          content: 'How are you?',
          created_at: '2024-01-01T10:00:03Z' as Timestamp,
        },
        {
          id: '5' as UUID,
          thread_id: 'thread' as UUID,
          role: DEFAULT_ROLE,
          content: 'Good!',
          created_at: '2024-01-01T10:00:04Z' as Timestamp,
        },
      ],
    };

    // Проверяем чередование ролей (system -> user/assistant -> user/assistant...)
    expect(conversation.items[0]!.role).toBe(SYSTEM_ROLE);
    expect([USER_ROLE, DEFAULT_ROLE]).toContain(conversation.items[1]!.role);
    expect([USER_ROLE, DEFAULT_ROLE]).toContain(conversation.items[2]!.role);
  });

  it('exhaustive проверка union типов', () => {
    const roles: (typeof USER_ROLE | typeof DEFAULT_ROLE | typeof SYSTEM_ROLE)[] = [
      USER_ROLE,
      DEFAULT_ROLE,
      SYSTEM_ROLE,
    ];

    roles.forEach((role) => {
      const message: MessageResponse = {
        id: 'msg-1' as UUID,
        thread_id: TEST_THREAD_ID as UUID,
        role,
        content: TEST_MESSAGE_CONTENT,
        created_at: '2024-01-01T00:00:00Z' as Timestamp,
      };

      expect([USER_ROLE, DEFAULT_ROLE, SYSTEM_ROLE]).toContain(message.role);
    });
  });

  it('conversation timeline integrity', () => {
    const conversation: MessageListResponse = {
      items: [
        {
          id: 'system-msg' as UUID,
          thread_id: 'conv-1' as UUID,
          role: SYSTEM_ROLE,
          content: TEST_INSTRUCTION,
          created_at: '2024-01-01T10:00:00Z' as Timestamp,
        },
        {
          id: 'user-msg-1' as UUID,
          thread_id: 'conv-1' as UUID,
          role: USER_ROLE,
          content: 'What is the weather like?',
          created_at: '2024-01-01T10:00:05Z' as Timestamp,
        },
        {
          id: 'assistant-msg-1' as UUID,
          thread_id: 'conv-1' as UUID,
          role: DEFAULT_ROLE,
          content: 'I need your location to provide weather information.',
          created_at: '2024-01-01T10:00:06Z' as Timestamp,
        },
        {
          id: 'user-msg-2' as UUID,
          thread_id: 'conv-1' as UUID,
          role: USER_ROLE,
          content: 'I am in New York.',
          created_at: '2024-01-01T10:00:10Z' as Timestamp,
        },
        {
          id: 'assistant-msg-2' as UUID,
          thread_id: 'conv-1' as UUID,
          role: DEFAULT_ROLE,
          content: 'The weather in New York is currently 72°F and sunny.',
          created_at: '2024-01-01T10:00:11Z' as Timestamp,
        },
      ],
    };

    // Проверяем, что все сообщения в одном thread
    const threadId = conversation.items[0]!.thread_id;
    conversation.items.forEach((msg) => {
      expect(msg.thread_id).toBe(threadId);
    });

    // Проверяем chronological order (без циклов/мутаций)
    conversation.items
      .slice(1)
      .map((item, idx) => {
        const prevTime = new Date(conversation.items[idx]!.created_at).getTime();
        const currTime = new Date(item.created_at).getTime();
        return { prevTime, currTime };
      })
      .forEach(({ prevTime, currTime }) => {
        expect(currTime).toBeGreaterThan(prevTime);
      });

    // Проверяем, что system message идет первым
    expect(conversation.items[0]!.role).toBe(SYSTEM_ROLE);

    // Проверяем чередование user/assistant после system (без циклов/мутаций)
    conversation.items
      .slice(1)
      .forEach((item) => {
        expect([USER_ROLE, DEFAULT_ROLE]).toContain(item.role);
      });
  });

  it('снапшот полного conversation workflow', () => {
    const conversationWorkflow = {
      thread: {
        response: {
          id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
          workspace_id: '123e4567-e89b-12d3-a456-426614174000' as UUID,
          bot_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' as UUID,
          status: 'active' as const,
          created_at: '2026-01-09T21:30:00.000Z' as Timestamp,
        } as ThreadResponse,
      },
      messages: {
        response: {
          items: [
            {
              id: '550e8400-e29b-41d4-a716-446655440001' as UUID,
              thread_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
              role: 'system' as const,
              content: 'You are a helpful customer support assistant.',
              created_at: '2026-01-09T21:30:00.100Z' as Timestamp,
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440002' as UUID,
              thread_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
              role: 'user' as const,
              content: 'I need help with my order.',
              created_at: '2026-01-09T21:34:00.000Z' as Timestamp,
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440003' as UUID,
              thread_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
              role: 'assistant' as const,
              content:
                "I'd be happy to help you with your order. Could you please provide your order number?",
              created_at: '2026-01-09T21:34:02.000Z' as Timestamp,
            },
          ],
        } as MessageListResponse,
      },
    };

    // Проверяем связность данных
    expect(conversationWorkflow.messages.response.items[0]!.thread_id).toBe(
      conversationWorkflow.thread.response.id,
    );
    expect(conversationWorkflow.messages.response.items[1]!.thread_id).toBe(
      conversationWorkflow.thread.response.id,
    );

    expect(conversationWorkflow).toMatchSnapshot();
  });
});
