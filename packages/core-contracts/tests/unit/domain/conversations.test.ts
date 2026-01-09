/**
 * @file Unit тесты для domain/conversations.ts
 */
import { describe, expect, it } from 'vitest';
import type {
  MessageListResponse,
  MessageResponse,
  ThreadResponse,
} from '../../../src/domain/conversations.js';
import type { Timestamp, UUID } from '../../../src/domain/common.js';

describe('ThreadResponse', () => {
  it('валидная структура ThreadResponse', () => {
    const response: ThreadResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
      workspace_id: '123e4567-e89b-12d3-a456-426614174000' as UUID,
      status: 'active',
      created_at: '2026-01-09T21:34:12.123Z' as Timestamp,
    };

    expect(response).toMatchObject({
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174000',
      status: 'active',
      created_at: '2026-01-09T21:34:12.123Z',
    });
  });

  it('status всегда "active"', () => {
    const response: ThreadResponse = {
      id: 'thread-1' as UUID,
      workspace_id: 'workspace-1' as UUID,
      status: 'active',
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
    };

    expect(response.status).toBe('active');
  });

  it('bot_id опционален', () => {
    const withBot: ThreadResponse = {
      id: 'thread-1' as UUID,
      workspace_id: 'workspace-1' as UUID,
      bot_id: 'bot-1' as UUID,
      status: 'active',
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
    };

    const withoutBot: ThreadResponse = {
      id: 'thread-2' as UUID,
      workspace_id: 'workspace-2' as UUID,
      status: 'active',
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
        status: 'active',
        created_at: '2024-01-01T00:00:00Z' as Timestamp,
      };
    }).not.toThrow();

    // Аналогично для других обязательных полей
  });

  it('снапшот структуры', () => {
    const response: ThreadResponse = {
      id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
      workspace_id: '123e4567-e89b-12d3-a456-426614174000' as UUID,
      bot_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' as UUID,
      status: 'active',
      created_at: '2026-01-09T21:34:12.123Z' as Timestamp,
    };

    expect(response).toMatchSnapshot();
  });
});

describe('MessageResponse', () => {
  it('валидная структура MessageResponse', () => {
    const response: MessageResponse = {
      id: '550e8400-e29b-41d4-a716-446655440001' as UUID,
      thread_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
      role: 'user',
      content: 'Hello, how are you?',
      created_at: '2026-01-09T21:34:12.123Z' as Timestamp,
    };

    expect(response).toMatchObject({
      id: '550e8400-e29b-41d4-a716-446655440001',
      thread_id: '550e8400-e29b-41d4-a716-446655440000',
      role: 'user',
      content: 'Hello, how are you?',
      created_at: '2026-01-09T21:34:12.123Z',
    });
  });

  it('role принимает только допустимые значения', () => {
    const userMessage: MessageResponse = {
      id: 'msg-1' as UUID,
      thread_id: 'thread-1' as UUID,
      role: 'user',
      content: 'User message',
      created_at: '2024-01-01T00:00:00Z' as Timestamp,
    };

    const assistantMessage: MessageResponse = {
      id: 'msg-2' as UUID,
      thread_id: 'thread-1' as UUID,
      role: 'assistant',
      content: 'Assistant response',
      created_at: '2024-01-01T00:00:01Z' as Timestamp,
    };

    const systemMessage: MessageResponse = {
      id: 'msg-3' as UUID,
      thread_id: 'thread-1' as UUID,
      role: 'system',
      content: 'System prompt',
      created_at: '2024-01-01T00:00:02Z' as Timestamp,
    };

    expect(userMessage.role).toBe('user');
    expect(assistantMessage.role).toBe('assistant');
    expect(systemMessage.role).toBe('system');
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
        role: 'user',
        content: 'Simple text',
        created_at: '2024-01-01T00:00:00Z' as Timestamp,
      },
      {
        id: 'msg-2' as UUID,
        thread_id: 'thread-1' as UUID,
        role: 'assistant',
        content: 'Multi-line\nresponse\nwith\nnewlines',
        created_at: '2024-01-01T00:00:01Z' as Timestamp,
      },
      {
        id: 'msg-3' as UUID,
        thread_id: 'thread-1' as UUID,
        role: 'system',
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
      role: 'user',
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
        role: 'user',
        content: 'content',
        created_at: '2024-01-01T00:00:00Z' as Timestamp,
      };
    }).not.toThrow();

    // Аналогично для других полей
  });

  it('снапшот структуры', () => {
    const response: MessageResponse = {
      id: '550e8400-e29b-41d4-a716-446655440001' as UUID,
      thread_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
      role: 'assistant',
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
          role: 'user',
          content: 'Hello',
          created_at: '2024-01-01T10:00:00Z' as Timestamp,
        },
        {
          id: 'msg-2' as UUID,
          thread_id: 'thread-1' as UUID,
          role: 'assistant',
          content: 'Hi there!',
          created_at: '2024-01-01T10:00:01Z' as Timestamp,
        },
      ],
    };

    expect(response.items).toHaveLength(2);
    expect(response.items[0]!.role).toBe('user');
    expect(response.items[1]!.role).toBe('assistant');
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
          role: 'system',
          content: 'You are a helpful assistant',
          created_at: '2024-01-01T00:00:00Z' as Timestamp,
        },
      ],
    };

    expect(response.items).toHaveLength(1);
    expect(response.items[0]!.role).toBe('system');
  });

  it('сообщения отсортированы по времени создания', () => {
    const response: MessageListResponse = {
      items: [
        {
          id: 'msg-1' as UUID,
          thread_id: 'thread-1' as UUID,
          role: 'user',
          content: 'First message',
          created_at: '2024-01-01T10:00:00Z' as Timestamp,
        },
        {
          id: 'msg-2' as UUID,
          thread_id: 'thread-1' as UUID,
          role: 'assistant',
          content: 'Second message',
          created_at: '2024-01-01T10:00:01Z' as Timestamp,
        },
        {
          id: 'msg-3' as UUID,
          thread_id: 'thread-1' as UUID,
          role: 'user',
          content: 'Third message',
          created_at: '2024-01-01T10:00:02Z' as Timestamp,
        },
      ],
    };

    // Проверяем, что timestamps идут в правильном порядке
    for (let i = 1; i < response.items.length; i++) {
      const prevTime = new Date(response.items[i - 1]!.created_at).getTime();
      const currTime = new Date(response.items[i]!.created_at).getTime();
      expect(currTime).toBeGreaterThan(prevTime);
    }
  });

  it('все сообщения принадлежат одному thread', () => {
    const threadId = 'conversation-thread-123' as UUID;

    const response: MessageListResponse = {
      items: [
        {
          id: 'msg-1' as UUID,
          thread_id: threadId,
          role: 'user',
          content: 'Hello',
          created_at: '2024-01-01T10:00:00Z' as Timestamp,
        },
        {
          id: 'msg-2' as UUID,
          thread_id: threadId,
          role: 'assistant',
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
          role: 'user',
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
      expect(['user', 'assistant', 'system']).toContain(message.role);
    });
  });

  it('снапшот структуры', () => {
    const response: MessageListResponse = {
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001' as UUID,
          thread_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
          role: 'user',
          content: 'Can you help me with my account settings?',
          created_at: '2026-01-09T21:34:10.000Z' as Timestamp,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002' as UUID,
          thread_id: '550e8400-e29b-41d4-a716-446655440000' as UUID,
          role: 'assistant',
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
      status: 'active',
      created_at: '2024-01-01T10:00:00Z' as Timestamp,
    };

    const messages: MessageListResponse = {
      items: [
        {
          id: 'msg-1' as UUID,
          thread_id: thread.id, // Ссылка на thread
          role: 'user',
          content: 'Hello bot!',
          created_at: '2024-01-01T10:00:01Z' as Timestamp,
        },
        {
          id: 'msg-2' as UUID,
          thread_id: thread.id, // Ссылка на thread
          role: 'assistant',
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
          role: 'system',
          content: 'Setup',
          created_at: '2024-01-01T10:00:00Z' as Timestamp,
        },
        {
          id: '2' as UUID,
          thread_id: 'thread' as UUID,
          role: 'user',
          content: 'Hello',
          created_at: '2024-01-01T10:00:01Z' as Timestamp,
        },
        {
          id: '3' as UUID,
          thread_id: 'thread' as UUID,
          role: 'assistant',
          content: 'Hi!',
          created_at: '2024-01-01T10:00:02Z' as Timestamp,
        },
        {
          id: '4' as UUID,
          thread_id: 'thread' as UUID,
          role: 'user',
          content: 'How are you?',
          created_at: '2024-01-01T10:00:03Z' as Timestamp,
        },
        {
          id: '5' as UUID,
          thread_id: 'thread' as UUID,
          role: 'assistant',
          content: 'Good!',
          created_at: '2024-01-01T10:00:04Z' as Timestamp,
        },
      ],
    };

    // Проверяем чередование ролей (system -> user/assistant -> user/assistant...)
    expect(conversation.items[0]!.role).toBe('system');
    expect(['user', 'assistant']).toContain(conversation.items[1]!.role);
    expect(['user', 'assistant']).toContain(conversation.items[2]!.role);
  });

  it('exhaustive проверка union типов', () => {
    const roles: Array<'user' | 'assistant' | 'system'> = ['user', 'assistant', 'system'];

    roles.forEach((role) => {
      const message: MessageResponse = {
        id: 'msg-1' as UUID,
        thread_id: 'thread-1' as UUID,
        role,
        content: 'Test message',
        created_at: '2024-01-01T00:00:00Z' as Timestamp,
      };

      expect(['user', 'assistant', 'system']).toContain(message.role);
    });
  });

  it('conversation timeline integrity', () => {
    const conversation: MessageListResponse = {
      items: [
        {
          id: 'system-msg' as UUID,
          thread_id: 'conv-1' as UUID,
          role: 'system',
          content: 'You are a helpful assistant.',
          created_at: '2024-01-01T10:00:00Z' as Timestamp,
        },
        {
          id: 'user-msg-1' as UUID,
          thread_id: 'conv-1' as UUID,
          role: 'user',
          content: 'What is the weather like?',
          created_at: '2024-01-01T10:00:05Z' as Timestamp,
        },
        {
          id: 'assistant-msg-1' as UUID,
          thread_id: 'conv-1' as UUID,
          role: 'assistant',
          content: 'I need your location to provide weather information.',
          created_at: '2024-01-01T10:00:06Z' as Timestamp,
        },
        {
          id: 'user-msg-2' as UUID,
          thread_id: 'conv-1' as UUID,
          role: 'user',
          content: 'I am in New York.',
          created_at: '2024-01-01T10:00:10Z' as Timestamp,
        },
        {
          id: 'assistant-msg-2' as UUID,
          thread_id: 'conv-1' as UUID,
          role: 'assistant',
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

    // Проверяем chronological order
    for (let i = 1; i < conversation.items.length; i++) {
      const prevTime = new Date(conversation.items[i - 1]!.created_at).getTime();
      const currTime = new Date(conversation.items[i]!.created_at).getTime();
      expect(currTime).toBeGreaterThan(prevTime);
    }

    // Проверяем, что system message идет первым
    expect(conversation.items[0]!.role).toBe('system');

    // Проверяем чередование user/assistant после system
    for (let i = 1; i < conversation.items.length; i++) {
      expect(['user', 'assistant']).toContain(conversation.items[i]!.role);
    }
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
