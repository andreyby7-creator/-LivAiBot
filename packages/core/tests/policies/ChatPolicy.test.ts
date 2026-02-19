/**
 * @file Unit тесты для ChatPolicy
 * Полное покрытие всех методов и веток исполнения
 */
import { describe, expect, it } from 'vitest';
import { ChatPolicy } from '../../src/policies/ChatPolicy.js';
import type {
  ChatAction,
  ChatActorContext,
  ChatMessageContext,
  ChatMode,
  ChatPolicyConfig,
  ChatRole,
  ChatState,
} from '../../src/policies/ChatPolicy.js';

// Mock данные для тестирования
const MOCK_CONFIG: ChatPolicyConfig = {
  roleActions: {
    owner: ['send_message', 'edit_message', 'delete_message'],
    moderator: ['send_message', 'edit_message', 'delete_message'],
    participant: ['send_message', 'edit_message'],
    viewer: [],
  },
  modeActions: {
    open: ['send_message', 'edit_message', 'delete_message'],
    restricted: ['send_message', 'edit_message'],
    read_only: ['edit_message', 'delete_message'],
    archived: [],
  },
  maxMessageLength: 1000,
  maxMessagesPerWindow: 10,
  rateLimitWindowMs: 60000, // 1 minute
  allowBotsToWrite: false,
};

const MOCK_CONFIG_ALLOW_BOTS: ChatPolicyConfig = {
  ...MOCK_CONFIG,
  allowBotsToWrite: true,
};

describe('ChatPolicy', () => {
  const policy = new ChatPolicy(MOCK_CONFIG);
  const policyAllowBots = new ChatPolicy(MOCK_CONFIG_ALLOW_BOTS);

  describe('Конструктор', () => {
    it('создает экземпляр с правильной конфигурацией', () => {
      expect(policy).toBeInstanceOf(ChatPolicy);
    });

    it('принимает конфиг без разрешения ботам писать', () => {
      expect(() => new ChatPolicy(MOCK_CONFIG)).not.toThrow();
    });

    it('принимает конфиг с разрешением ботам писать', () => {
      expect(() => new ChatPolicy(MOCK_CONFIG_ALLOW_BOTS)).not.toThrow();
    });
  });

  describe('canPerform', () => {
    describe('Архивные чаты', () => {
      const archivedChat: ChatState = {
        chatId: 'chat-1',
        mode: 'archived',
        createdAt: 1000000,
      };

      const ownerActor: ChatActorContext = {
        actorId: 'user-1',
        type: 'user',
        role: 'owner',
      };

      it('запрещает все действия в архивном чате', () => {
        const actions: ChatAction[] = ['send_message', 'edit_message', 'delete_message'];

        actions.forEach((action) => {
          const result = policy.canPerform(action, archivedChat, ownerActor);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('chat_archived');
        });
      });

      it('запрещает действия в архивном чате независимо от роли', () => {
        const viewerActor: ChatActorContext = {
          actorId: 'user-2',
          type: 'user',
          role: 'viewer',
        };

        const result = policy.canPerform('send_message', archivedChat, viewerActor);
        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('chat_archived');
      });
    });

    describe('Read-only чаты', () => {
      const readOnlyChat: ChatState = {
        chatId: 'chat-1',
        mode: 'read_only',
        createdAt: 1000000,
      };

      const participantActor: ChatActorContext = {
        actorId: 'user-1',
        type: 'user',
        role: 'participant',
      };

      it('запрещает send_message в read-only чате', () => {
        const result = policy.canPerform('send_message', readOnlyChat, participantActor);
        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('chat_read_only');
      });

      it('разрешает edit_message но запрещает delete_message в read-only чате для participant', () => {
        // edit_message разрешен для participant в read_only режиме
        const editResult = policy.canPerform('edit_message', readOnlyChat, participantActor);
        expect(editResult.allow).toBe(true);
        expect(editResult.reason).toBe('ACTION_ALLOWED');

        // delete_message запрещен для participant роли, даже в read_only режиме
        const deleteResult = policy.canPerform('delete_message', readOnlyChat, participantActor);
        expect(deleteResult.allow).toBe(false);
        expect((deleteResult as { allow: false; reason: any; }).reason).toBe('insufficient_role');
      });
    });

    describe('Ограничения по типам акторов', () => {
      const openChat: ChatState = {
        chatId: 'chat-1',
        mode: 'open',
        createdAt: 1000000,
      };

      const botActor: ChatActorContext = {
        actorId: 'bot-1',
        type: 'bot',
        role: 'participant',
      };

      it('запрещает ботам писать когда allowBotsToWrite = false', () => {
        const result = policy.canPerform('send_message', openChat, botActor);
        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('actor_not_allowed');
      });

      it('разрешает ботам писать когда allowBotsToWrite = true', () => {
        const result = policyAllowBots.canPerform('send_message', openChat, botActor);
        expect(result.allow).toBe(true);
        expect(result.reason).toBe('ACTION_ALLOWED');
      });

      it('запрещает все действия бота когда allowBotsToWrite = false', () => {
        const actions: ChatAction[] = ['send_message', 'edit_message', 'delete_message'];

        actions.forEach((action) => {
          const result = policy.canPerform(action, openChat, botActor);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('actor_not_allowed');
        });
      });

      it('разрешает system акторам все действия', () => {
        const systemActor: ChatActorContext = {
          actorId: 'system-1',
          type: 'system',
          role: 'owner',
        };

        const actions: ChatAction[] = ['send_message', 'edit_message', 'delete_message'];

        actions.forEach((action) => {
          const result = policy.canPerform(action, openChat, systemActor);
          expect(result.allow).toBe(true);
          expect(result.reason).toBe('ACTION_ALLOWED');
        });
      });
    });

    describe('Ограничения по участию', () => {
      const openChat: ChatState = {
        chatId: 'chat-1',
        mode: 'open',
        createdAt: 1000000,
      };

      it('запрещает действия акторам без роли', () => {
        const noRoleActor: ChatActorContext = {
          actorId: 'user-1',
          type: 'user',
        };

        const actions: ChatAction[] = ['send_message', 'edit_message', 'delete_message'];

        actions.forEach((action) => {
          const result = policy.canPerform(action, openChat, noRoleActor);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('not_a_participant');
        });
      });

      it('разрешает действия акторам с ролью', () => {
        const participantActor: ChatActorContext = {
          actorId: 'user-1',
          type: 'user',
          role: 'participant',
        };

        const result = policy.canPerform('send_message', openChat, participantActor);
        expect(result.allow).toBe(true);
        expect(result.reason).toBe('ACTION_ALLOWED');
      });
    });

    describe('Ограничения по режимам чата', () => {
      const ownerActor: ChatActorContext = {
        actorId: 'user-1',
        type: 'user',
        role: 'owner',
      };

      describe('open режим', () => {
        const openChat: ChatState = {
          chatId: 'chat-1',
          mode: 'open',
          createdAt: 1000000,
        };

        it('разрешает все действия в open режиме для owner', () => {
          const actions: ChatAction[] = ['send_message', 'edit_message', 'delete_message'];

          actions.forEach((action) => {
            const result = policy.canPerform(action, openChat, ownerActor);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });
      });

      describe('restricted режим', () => {
        const restrictedChat: ChatState = {
          chatId: 'chat-1',
          mode: 'restricted',
          createdAt: 1000000,
        };

        it('разрешает send_message и edit_message в restricted режиме для owner', () => {
          const allowedActions: ChatAction[] = ['send_message', 'edit_message'];

          allowedActions.forEach((action) => {
            const result = policy.canPerform(action, restrictedChat, ownerActor);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });

        it('запрещает delete_message в restricted режиме', () => {
          const result = policy.canPerform('delete_message', restrictedChat, ownerActor);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('chat_read_only');
        });
      });

      describe('read_only режим', () => {
        const readOnlyChat: ChatState = {
          chatId: 'chat-1',
          mode: 'read_only',
          createdAt: 1000000,
        };

        it('запрещает send_message в read_only режиме', () => {
          const result = policy.canPerform('send_message', readOnlyChat, ownerActor);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('chat_read_only');
        });

        it('разрешает edit_message и delete_message в read_only режиме для owner', () => {
          const allowedActions: ChatAction[] = ['edit_message', 'delete_message'];

          allowedActions.forEach((action) => {
            const result = policy.canPerform(action, readOnlyChat, ownerActor);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });
      });
    });

    describe('Ограничения по ролям', () => {
      const openChat: ChatState = {
        chatId: 'chat-1',
        mode: 'open',
        createdAt: 1000000,
      };

      describe('owner роль', () => {
        const ownerActor: ChatActorContext = {
          actorId: 'user-1',
          type: 'user',
          role: 'owner',
        };

        it('разрешает все действия для owner', () => {
          const actions: ChatAction[] = ['send_message', 'edit_message', 'delete_message'];

          actions.forEach((action) => {
            const result = policy.canPerform(action, openChat, ownerActor);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });
      });

      describe('moderator роль', () => {
        const moderatorActor: ChatActorContext = {
          actorId: 'user-1',
          type: 'user',
          role: 'moderator',
        };

        it('разрешает все действия для moderator', () => {
          const actions: ChatAction[] = ['send_message', 'edit_message', 'delete_message'];

          actions.forEach((action) => {
            const result = policy.canPerform(action, openChat, moderatorActor);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });
      });

      describe('participant роль', () => {
        const participantActor: ChatActorContext = {
          actorId: 'user-1',
          type: 'user',
          role: 'participant',
        };

        it('разрешает send_message и edit_message для participant', () => {
          const allowedActions: ChatAction[] = ['send_message', 'edit_message'];

          allowedActions.forEach((action) => {
            const result = policy.canPerform(action, openChat, participantActor);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });

        it('запрещает delete_message для participant', () => {
          const result = policy.canPerform('delete_message', openChat, participantActor);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
        });
      });

      describe('viewer роль', () => {
        const viewerActor: ChatActorContext = {
          actorId: 'user-1',
          type: 'user',
          role: 'viewer',
        };

        it('запрещает все действия для viewer', () => {
          const actions: ChatAction[] = ['send_message', 'edit_message', 'delete_message'];

          actions.forEach((action) => {
            const result = policy.canPerform(action, openChat, viewerActor);
            expect(result.allow).toBe(false);
            expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
          });
        });
      });
    });

    describe('Ограничения сообщений', () => {
      const openChat: ChatState = {
        chatId: 'chat-1',
        mode: 'open',
        createdAt: 1000000,
      };

      const ownerActor: ChatActorContext = {
        actorId: 'user-1',
        type: 'user',
        role: 'owner',
      };

      describe('ограничение длины сообщения', () => {
        it('запрещает сообщения длиннее maxMessageLength', () => {
          const longMessage: ChatMessageContext = {
            length: 1500, // больше 1000
            sentAt: 2000000,
            messagesSentRecently: 0,
          };

          const result = policy.canPerform('send_message', openChat, ownerActor, longMessage);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('message_too_large');
        });

        it('разрешает сообщения в пределах maxMessageLength', () => {
          const normalMessage: ChatMessageContext = {
            length: 500,
            sentAt: 2000000,
            messagesSentRecently: 0,
          };

          const result = policy.canPerform('send_message', openChat, ownerActor, normalMessage);
          expect(result.allow).toBe(true);
          expect(result.reason).toBe('ACTION_ALLOWED');
        });

        it('игнорирует длину для edit_message и delete_message', () => {
          const longMessage: ChatMessageContext = {
            length: 1500,
            sentAt: 2000000,
            messagesSentRecently: 0,
          };

          const actions: ChatAction[] = ['edit_message', 'delete_message'];

          actions.forEach((action) => {
            const result = policy.canPerform(action, openChat, ownerActor, longMessage);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });
      });

      describe('rate limiting', () => {
        it('запрещает отправку при превышении лимита сообщений', () => {
          const rateLimitedMessage: ChatMessageContext = {
            length: 100,
            sentAt: 2000000,
            messagesSentRecently: 10, // равно maxMessagesPerWindow
          };

          const result = policy.canPerform(
            'send_message',
            openChat,
            ownerActor,
            rateLimitedMessage,
          );
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('rate_limit_exceeded');
        });

        it('разрешает отправку в пределах лимита', () => {
          const normalMessage: ChatMessageContext = {
            length: 100,
            sentAt: 2000000,
            messagesSentRecently: 5,
          };

          const result = policy.canPerform('send_message', openChat, ownerActor, normalMessage);
          expect(result.allow).toBe(true);
          expect(result.reason).toBe('ACTION_ALLOWED');
        });

        it('игнорирует rate limit для edit_message и delete_message', () => {
          const rateLimitedMessage: ChatMessageContext = {
            length: 100,
            sentAt: 2000000,
            messagesSentRecently: 15,
          };

          const actions: ChatAction[] = ['edit_message', 'delete_message'];

          actions.forEach((action) => {
            const result = policy.canPerform(action, openChat, ownerActor, rateLimitedMessage);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });
      });

      it('работает без контекста сообщения', () => {
        const result = policy.canPerform('send_message', openChat, ownerActor);
        expect(result.allow).toBe(true);
        expect(result.reason).toBe('ACTION_ALLOWED');
      });
    });

    describe('Комплексные сценарии', () => {
      it('полная проверка цепочки ограничений', () => {
        const archivedChat: ChatState = {
          chatId: 'chat-1',
          mode: 'archived',
          createdAt: 1000000,
        };

        const ownerActor: ChatActorContext = {
          actorId: 'user-1',
          type: 'user',
          role: 'owner',
        };

        // Архивный чат должен заблокировать на первом шаге
        const result = policy.canPerform('send_message', archivedChat, ownerActor);
        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('chat_archived');
      });

      it('проверка приоритета ограничений', () => {
        const readOnlyChat: ChatState = {
          chatId: 'chat-1',
          mode: 'read_only',
          createdAt: 1000000,
        };

        const viewerActor: ChatActorContext = {
          actorId: 'user-1',
          type: 'user',
          role: 'viewer',
        };

        // Сначала проверяется archived (пропускается), потом read_only блокирует send_message
        const result = policy.canPerform('send_message', readOnlyChat, viewerActor);
        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('chat_read_only');
      });
    });

    describe('Все комбинации режимов, ролей и действий', () => {
      const modes: ChatMode[] = ['open', 'restricted', 'read_only', 'archived'];
      const roles: ChatRole[] = ['owner', 'moderator', 'participant', 'viewer'];
      const actions: ChatAction[] = ['send_message', 'edit_message', 'delete_message'];

      it.each(
        modes.flatMap((mode) =>
          roles.flatMap((role) =>
            actions.map((action) => [mode, role, action] as [ChatMode, ChatRole, ChatAction])
          )
        ),
      )('проверяет комбинацию %s + %s + %s', (mode, role, action) => {
        const chat: ChatState = {
          chatId: 'test-chat',
          mode,
          createdAt: 1000000,
        };

        const actor: ChatActorContext = {
          actorId: 'test-user',
          type: 'user',
          role,
        };

        const result = policy.canPerform(action, chat, actor);

        // Определяем ожидаемый результат по приоритету проверок
        const expected = (() => {
          // 1. Archived check
          if (mode === 'archived') {
            return { allow: false as const, reason: 'chat_archived' as const };
          }
          // 2. Read-only check
          if (mode === 'read_only' && action === 'send_message') {
            return { allow: false as const, reason: 'chat_read_only' as const };
          }
          // 3. Mode check (must be before role check according to ChatPolicy.canPerform)
          if (!MOCK_CONFIG.modeActions[mode].includes(action)) {
            return { allow: false as const, reason: 'chat_read_only' as const };
          }
          // 4. Role check
          if (!MOCK_CONFIG.roleActions[role].includes(action)) {
            return { allow: false as const, reason: 'insufficient_role' as const };
          }
          return { allow: true as const };
        })();

        expect(result.allow).toBe(expected.allow);
        if (!expected.allow) {
          expect((result as { allow: false; reason: any; }).reason).toBe(expected.reason);
        }
      });
    });

    describe('Граничные случаи', () => {
      it('работает с минимальными значениями', () => {
        const chat: ChatState = {
          chatId: 'a',
          mode: 'open',
          createdAt: 0,
        };

        const actor: ChatActorContext = {
          actorId: 'a',
          type: 'user',
          role: 'viewer',
        };

        const result = policy.canPerform('send_message', chat, actor);
        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
      });

      it('работает с длинными идентификаторами', () => {
        const chat: ChatState = {
          chatId: 'very-long-chat-id-that-should-still-work-fine',
          mode: 'open',
          createdAt: 1000000,
        };

        const actor: ChatActorContext = {
          actorId: 'very-long-actor-id-that-should-still-work-fine',
          type: 'system',
          role: 'owner',
        };

        const result = policy.canPerform('delete_message', chat, actor);
        expect(result.allow).toBe(true);
        expect(result.reason).toBe('ACTION_ALLOWED');
      });

      it('работает с максимальными значениями сообщений', () => {
        const chat: ChatState = {
          chatId: 'chat-1',
          mode: 'open',
          createdAt: 1000000,
        };

        const actor: ChatActorContext = {
          actorId: 'user-1',
          type: 'user',
          role: 'owner',
        };

        const maxLengthMessage: ChatMessageContext = {
          length: 1000, // exactly maxMessageLength
          sentAt: 2000000,
          messagesSentRecently: 9, // maxMessagesPerWindow - 1
        };

        const result = policy.canPerform('send_message', chat, actor, maxLengthMessage);
        expect(result.allow).toBe(true);
        expect(result.reason).toBe('ACTION_ALLOWED');
      });
    });

    describe('Конфигурационные edge cases', () => {
      it('работает с пустыми массивами действий', () => {
        const emptyConfig: ChatPolicyConfig = {
          ...MOCK_CONFIG,
          roleActions: {
            owner: [],
            moderator: [],
            participant: [],
            viewer: [],
          },
          modeActions: {
            open: ['send_message'],
            restricted: [],
            read_only: [],
            archived: [],
          },
        };

        const emptyPolicy = new ChatPolicy(emptyConfig);
        const chat: ChatState = {
          chatId: 'chat-1',
          mode: 'open',
          createdAt: 1000000,
        };

        const actor: ChatActorContext = {
          actorId: 'user-1',
          type: 'user',
          role: 'owner',
        };

        const result = emptyPolicy.canPerform('send_message', chat, actor);
        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
      });
    });
  });

  describe('Интеграционные тесты', () => {
    it('демонстрирует реальные сценарии использования', () => {
      const openChat: ChatState = {
        chatId: 'public-chat',
        mode: 'open',
        createdAt: 1000000,
      };

      // Сценарий 1: Owner пишет в открытый чат
      const owner: ChatActorContext = { actorId: 'owner-1', type: 'user', role: 'owner' };
      expect(policy.canPerform('send_message', openChat, owner).allow).toBe(true);

      // Сценарий 2: Participant пытается удалить сообщение в открытый чат (запрещено)
      const participant: ChatActorContext = {
        actorId: 'user-1',
        type: 'user',
        role: 'participant',
      };
      expect(policy.canPerform('delete_message', openChat, participant).allow).toBe(false);

      // Сценарий 3: Viewer пытается писать в открытый чат (запрещено)
      const viewer: ChatActorContext = { actorId: 'viewer-1', type: 'user', role: 'viewer' };
      expect(policy.canPerform('send_message', openChat, viewer).allow).toBe(false);

      // Сценарий 4: Moderator модерирует в restricted чат
      const restrictedChat: ChatState = {
        chatId: 'restricted-chat',
        mode: 'restricted',
        createdAt: 1000000,
      };

      const moderator: ChatActorContext = { actorId: 'mod-1', type: 'user', role: 'moderator' };
      expect(policy.canPerform('delete_message', restrictedChat, moderator).allow).toBe(false); // restricted не позволяет delete
      expect(policy.canPerform('send_message', restrictedChat, moderator).allow).toBe(true);

      // Сценарий 5: Попытка писать в read-only чат
      const readOnlyChat: ChatState = {
        chatId: 'readonly-chat',
        mode: 'read_only',
        createdAt: 1000000,
      };

      expect(policy.canPerform('send_message', readOnlyChat, owner).allow).toBe(false);
      expect(policy.canPerform('edit_message', readOnlyChat, owner).allow).toBe(true);

      // Сценарий 6: Попытка взаимодействовать с archived чатом
      const archivedChat: ChatState = {
        chatId: 'archived-chat',
        mode: 'archived',
        createdAt: 1000000,
      };

      expect(policy.canPerform('send_message', archivedChat, owner).allow).toBe(false);
    });

    it('проверяет консистентность результатов', () => {
      const chat: ChatState = {
        chatId: 'test-chat',
        mode: 'open',
        createdAt: 1000000,
      };

      const actor: ChatActorContext = {
        actorId: 'test-user',
        type: 'user',
        role: 'participant',
      };

      // Один и тот же вызов должен давать одинаковый результат
      const result1 = policy.canPerform('send_message', chat, actor);
      const result2 = policy.canPerform('send_message', chat, actor);

      expect(result1).toEqual(result2);
      expect(result1.allow).toBe(true);
      expect(result2.allow).toBe(true);
    });

    it('тестирует rate limiting edge cases', () => {
      const chat: ChatState = {
        chatId: 'chat-1',
        mode: 'open',
        createdAt: 1000000,
      };

      const actor: ChatActorContext = {
        actorId: 'user-1',
        type: 'user',
        role: 'owner',
      };

      // Точное попадание в лимит
      const atLimitMessage: ChatMessageContext = {
        length: 1000,
        sentAt: 2000000,
        messagesSentRecently: 10,
      };

      const result = policy.canPerform('send_message', chat, actor, atLimitMessage);
      expect(result.allow).toBe(false);
      expect((result as { allow: false; reason: any; }).reason).toBe('rate_limit_exceeded');

      // Один меньше лимита
      const underLimitMessage: ChatMessageContext = {
        length: 1000,
        sentAt: 2000000,
        messagesSentRecently: 9,
      };

      const result2 = policy.canPerform('send_message', chat, actor, underLimitMessage);
      expect(result2.allow).toBe(true);
    });
  });
});
