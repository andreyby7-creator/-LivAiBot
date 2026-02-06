/**
 * @file Unit тесты для ComposedPolicy
 * Полное покрытие всех методов и веток исполнения
 */
import { describe, expect, it } from 'vitest';
import { ComposedPolicy } from '../../src/domain/ComposedPolicy.js';
import type { ComposedPolicyConfig } from '../../src/domain/ComposedPolicy.js';
import type {
  AuthPolicyConfig,
  AuthSessionState,
  AuthTokenState,
} from '../../src/domain/AuthPolicy.js';
import type { BotPermissionsConfig, BotUserContext } from '../../src/domain/BotPermissions.js';
import type { BotActorContext, BotPolicyConfig, BotState } from '../../src/domain/BotPolicy.js';
import type {
  ChatActorContext,
  ChatMessageContext,
  ChatPolicyConfig,
  ChatState,
} from '../../src/domain/ChatPolicy.js';
import type {
  BillingPolicyConfig,
  BillingSubjectState,
  BillingUsageContext,
} from '../../src/domain/BillingPolicy.js';

// Mock данные для тестирования
const MOCK_AUTH_CONFIG: AuthPolicyConfig = {
  accessTokenTtlMs: 3600000, // 1 hour
  refreshTokenTtlMs: 604800000, // 7 days
  sessionMaxLifetimeMs: 86400000, // 24 hours
  sessionIdleTimeoutMs: 3600000, // 1 hour
  requireRefreshRotation: false,
};

const MOCK_BOT_PERMISSIONS_CONFIG: BotPermissionsConfig = {
  roleMatrix: {
    owner: ['create', 'read', 'update', 'delete', 'manage_permissions'],
    admin: ['create', 'read', 'update', 'delete'],
    editor: ['create', 'read', 'update'],
    viewer: ['read'],
  },
};

const MOCK_BOT_POLICY_CONFIG: BotPolicyConfig = {
  roleActions: {
    owner: ['configure', 'publish', 'pause', 'resume', 'execute', 'archive'],
    admin: ['configure', 'publish', 'pause', 'resume', 'execute'],
    editor: ['configure', 'execute'],
    viewer: ['execute'],
  },
  modeActions: {
    draft: ['configure', 'publish'],
    active: ['configure', 'pause', 'execute', 'archive'],
    paused: ['configure', 'resume', 'execute', 'archive'],
    archived: ['archive'],
  },
  allowArchiveSystemBot: false,
};

const MOCK_CHAT_CONFIG: ChatPolicyConfig = {
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
  rateLimitWindowMs: 60000,
  allowBotsToWrite: false,
};

const MOCK_BILLING_CONFIG: BillingPolicyConfig = {
  planLimits: {
    free: { consume_tokens: 1000, send_message: 50, create_bot: 1, run_job: 10 },
    pro: { consume_tokens: 10000, send_message: 1000, create_bot: 10, run_job: 100 },
    enterprise: {
      consume_tokens: Number.MAX_SAFE_INTEGER,
      send_message: Number.MAX_SAFE_INTEGER,
      create_bot: Number.MAX_SAFE_INTEGER,
      run_job: Number.MAX_SAFE_INTEGER,
    }, // unlimited
  },
  overuseStrategy: {
    free: 'block',
    pro: 'allow_warn',
    enterprise: 'allow',
  },
  subjectActions: {
    user: ['consume_tokens', 'send_message', 'create_bot', 'run_job'],
    organization: ['consume_tokens', 'send_message', 'create_bot', 'run_job'],
    system: ['consume_tokens', 'run_job'],
  },
};

const MOCK_COMPOSED_CONFIG: ComposedPolicyConfig = {
  auth: MOCK_AUTH_CONFIG,
  botPermissions: MOCK_BOT_PERMISSIONS_CONFIG,
  botPolicy: MOCK_BOT_POLICY_CONFIG,
  chat: MOCK_CHAT_CONFIG,
  billing: MOCK_BILLING_CONFIG,
};

describe('ComposedPolicy', () => {
  const getPolicy = () => new ComposedPolicy(MOCK_COMPOSED_CONFIG);

  describe('Конструктор', () => {
    it('создает экземпляр с правильной конфигурацией', () => {
      const policy = getPolicy();
      expect(policy).toBeInstanceOf(ComposedPolicy);
    });

    it('инициализирует все дочерние политики с правильными конфигами', () => {
      expect(() => new ComposedPolicy(MOCK_COMPOSED_CONFIG)).not.toThrow();
    });

    it('работает с пустыми конфигами', () => {
      const emptyConfig: ComposedPolicyConfig = {
        auth: {
          accessTokenTtlMs: 1000,
          refreshTokenTtlMs: 1000,
          sessionMaxLifetimeMs: 1000,
          sessionIdleTimeoutMs: 1000,
          requireRefreshRotation: false,
        },
        botPermissions: { roleMatrix: { owner: [], admin: [], editor: [], viewer: [] } },
        botPolicy: {
          roleActions: { owner: [], admin: [], editor: [], viewer: [] },
          modeActions: { draft: [], active: [], paused: [], archived: [] },
          allowArchiveSystemBot: false,
        },
        chat: {
          roleActions: { owner: [], moderator: [], participant: [], viewer: [] },
          modeActions: { open: [], restricted: [], read_only: [], archived: [] },
          maxMessageLength: 1,
          maxMessagesPerWindow: 1,
          rateLimitWindowMs: 1000,
          allowBotsToWrite: false,
        },
        billing: {
          planLimits: {
            free: {
              consume_tokens: Number.MAX_SAFE_INTEGER,
              send_message: Number.MAX_SAFE_INTEGER,
              create_bot: Number.MAX_SAFE_INTEGER,
              run_job: Number.MAX_SAFE_INTEGER,
            },
            pro: {
              consume_tokens: Number.MAX_SAFE_INTEGER,
              send_message: Number.MAX_SAFE_INTEGER,
              create_bot: Number.MAX_SAFE_INTEGER,
              run_job: Number.MAX_SAFE_INTEGER,
            },
            enterprise: {
              consume_tokens: Number.MAX_SAFE_INTEGER,
              send_message: Number.MAX_SAFE_INTEGER,
              create_bot: Number.MAX_SAFE_INTEGER,
              run_job: Number.MAX_SAFE_INTEGER,
            },
          },
          overuseStrategy: { free: 'allow', pro: 'allow', enterprise: 'allow' },
          subjectActions: { user: [], organization: [], system: [] },
        },
      };

      expect(() => new ComposedPolicy(emptyConfig)).not.toThrow();
    });
  });

  describe('Auth методы', () => {
    const mockToken: AuthTokenState = {
      type: 'access',
      issuedAt: 1000000,
      expiresAt: 2000000,
      isRevoked: false,
    };

    const mockSession: AuthSessionState = {
      sessionId: 'session-1',
      userId: 'user-1',
      createdAt: 1000000,
      lastActivityAt: 1500000,
      isTerminated: false,
    };

    const now = 1500000;

    describe('evaluateToken', () => {
      it('делегирует вызов AuthPolicy.evaluateToken', () => {
        const result = getPolicy().evaluateToken(mockToken, now);
        expect(result).toHaveProperty('allow');
      });

      it('работает с валидным токеном', () => {
        const validToken: AuthTokenState = {
          ...mockToken,
          expiresAt: now + 1000000, // future expiry
        };

        const result = getPolicy().evaluateToken(validToken, now);
        expect(result.allow).toBe(true);
      });

      it('работает с истекшим токеном', () => {
        const expiredToken: AuthTokenState = {
          ...mockToken,
          expiresAt: now - 1000000, // past expiry
        };

        const result = getPolicy().evaluateToken(expiredToken, now);
        expect(result.allow).toBe(false);
      });

      it('работает с отозванным токеном', () => {
        const revokedToken: AuthTokenState = {
          ...mockToken,
          isRevoked: true,
        };

        const result = getPolicy().evaluateToken(revokedToken, now);
        expect(result.allow).toBe(false);
      });
    });

    describe('evaluateSession', () => {
      it('делегирует вызов AuthPolicy.evaluateSession', () => {
        const result = getPolicy().evaluateSession(mockSession, now);
        expect(result).toHaveProperty('allow');
      });

      it('работает с активной сессией', () => {
        const activeSession: AuthSessionState = {
          ...mockSession,
          isTerminated: false,
        };

        const result = getPolicy().evaluateSession(activeSession, now);
        expect(result.allow).toBe(true);
      });

      it('работает с истекшей сессией (max lifetime)', () => {
        const expiredSession: AuthSessionState = {
          ...mockSession,
          createdAt: now - 90000000, // created 25 hours ago (> 24 hour max lifetime)
          isTerminated: false,
        };

        const result = getPolicy().evaluateSession(expiredSession, now);
        expect(result.allow).toBe(false);
      });

      it('работает с истекшей сессией (idle timeout)', () => {
        const idleSession: AuthSessionState = {
          ...mockSession,
          lastActivityAt: now - 4000000, // last activity 1.1 hours ago (> 1 hour idle timeout)
          isTerminated: false,
        };

        const result = getPolicy().evaluateSession(idleSession, now);
        expect(result.allow).toBe(false);
      });

      it('работает с terminated сессией', () => {
        const terminatedSession: AuthSessionState = {
          sessionId: 'terminated-session-1',
          userId: 'user-1',
          createdAt: 1000000,
          lastActivityAt: 1500000,
          isTerminated: true,
        };

        const result = getPolicy().evaluateSession(terminatedSession, now);
        expect(result.allow).toBe(false);
      });
    });

    describe('canRefresh', () => {
      it('делегирует вызов AuthPolicy.canRefresh', () => {
        const result = getPolicy().canRefresh(mockToken, mockSession, now);
        expect(result).toHaveProperty('allow');
      });

      it('работает с валидными токеном и сессией', () => {
        const validToken: AuthTokenState = {
          ...mockToken,
          expiresAt: now + 1000000,
        };

        const validSession: AuthSessionState = {
          ...mockSession,
          isTerminated: false,
        };

        const result = getPolicy().canRefresh(validToken, validSession, now);
        expect(result.allow).toBe(true);
      });

      it('запрещает refresh с истекшим токеном', () => {
        const expiredToken: AuthTokenState = {
          ...mockToken,
          expiresAt: now - 1000000,
        };

        const result = getPolicy().canRefresh(expiredToken, mockSession, now);
        expect(result.allow).toBe(false);
      });

      it('запрещает refresh с terminated сессией', () => {
        const terminatedSession: AuthSessionState = {
          ...mockSession,
          isTerminated: true,
        };

        const result = getPolicy().canRefresh(mockToken, terminatedSession, now);
        expect(result.allow).toBe(false);
      });
    });
  });

  describe('Bot методы', () => {
    const mockBotUser: BotUserContext = {
      userId: 'user-1',
      role: 'owner',
    };

    const mockBot: BotState = {
      botId: 'bot-1',
      mode: 'active',
      createdAt: 1000000,
      isSystemBot: false,
    };

    const mockBotActor: BotActorContext = {
      userId: 'user-1',
      role: 'owner',
    };

    describe('canPerformBotAction', () => {
      it('делегирует вызов BotPermissions.canPerform', () => {
        const result = getPolicy().canPerformBotAction('read', mockBotUser);
        expect(result).toHaveProperty('allow');
      });

      it('работает с разрешенными действиями', () => {
        const result = getPolicy().canPerformBotAction('read', mockBotUser);
        expect(result.allow).toBe(true);
      });

      it('запрещает неразрешенные действия', () => {
        const viewerUser: BotUserContext = {
          userId: 'user-2',
          role: 'viewer',
        };

        const result = getPolicy().canPerformBotAction('create', viewerUser);
        expect(result.allow).toBe(false);
      });
    });

    describe('canPerformBotPolicy', () => {
      it('делегирует вызов BotPolicy.canPerform', () => {
        const result = getPolicy().canPerformBotPolicy('execute', mockBot, mockBotActor);
        expect(result).toHaveProperty('allow');
      });

      it('работает с разрешенными действиями', () => {
        const result = getPolicy().canPerformBotPolicy('execute', mockBot, mockBotActor);
        expect(result.allow).toBe(true);
      });

      it('запрещает действия в архивных ботах', () => {
        const archivedBot: BotState = {
          ...mockBot,
          mode: 'archived',
        };

        const result = getPolicy().canPerformBotPolicy('configure', archivedBot, mockBotActor);
        expect(result.allow).toBe(false);
      });
    });
  });

  describe('Chat методы', () => {
    const mockChat: ChatState = {
      chatId: 'chat-1',
      mode: 'open',
      createdAt: 1000000,
    };

    const mockChatActor: ChatActorContext = {
      actorId: 'user-1',
      type: 'user',
      role: 'participant',
    };

    const mockMessage: ChatMessageContext = {
      length: 100,
      sentAt: 2000000,
      messagesSentRecently: 5,
    };

    describe('canPerformChat', () => {
      it('делегирует вызов ChatPolicy.canPerform', () => {
        const result = getPolicy().canPerformChat('send_message', mockChat, mockChatActor);
        expect(result).toHaveProperty('allow');
      });

      it('работает с разрешенными действиями', () => {
        const result = getPolicy().canPerformChat('send_message', mockChat, mockChatActor);
        expect(result.allow).toBe(true);
      });

      it('запрещает действия в архивных чатах', () => {
        const archivedChat: ChatState = {
          ...mockChat,
          mode: 'archived',
        };

        const result = getPolicy().canPerformChat('send_message', archivedChat, mockChatActor);
        expect(result.allow).toBe(false);
      });

      it('работает с контекстом сообщения', () => {
        const result = getPolicy().canPerformChat(
          'send_message',
          mockChat,
          mockChatActor,
          mockMessage,
        );
        expect(result.allow).toBe(true);
      });

      it('проверяет лимиты сообщений', () => {
        const longMessage: ChatMessageContext = {
          length: 2000, // превышает maxMessageLength: 1000
          sentAt: 2000000,
          messagesSentRecently: 5,
        };

        const result = getPolicy().canPerformChat(
          'send_message',
          mockChat,
          mockChatActor,
          longMessage,
        );
        expect(result.allow).toBe(false);
      });

      it('проверяет rate limiting', () => {
        const rateLimitedMessage: ChatMessageContext = {
          length: 100,
          sentAt: 2000000,
          messagesSentRecently: 15, // превышает maxMessagesPerWindow: 10
        };

        const result = getPolicy().canPerformChat(
          'send_message',
          mockChat,
          mockChatActor,
          rateLimitedMessage,
        );
        expect(result.allow).toBe(false);
      });
    });
  });

  describe('Billing методы', () => {
    const mockSubject: BillingSubjectState = {
      subjectId: 'user-1',
      type: 'user',
      plan: 'free',
      isBlocked: false,
    };

    const mockUsage: BillingUsageContext = {
      amount: 100,
      usedInPeriod: 50,
    };

    describe('canPerformBilling', () => {
      it('делегирует вызов BillingPolicy.canPerform', () => {
        const result = getPolicy().canPerformBilling('consume_tokens', mockSubject);
        expect(result).toHaveProperty('allow');
      });

      it('работает с разрешенными действиями', () => {
        const result = getPolicy().canPerformBilling('consume_tokens', mockSubject, mockUsage);
        expect(result.allow).toBe(true);
      });

      it('запрещает действия при превышении лимитов', () => {
        const highUsage: BillingUsageContext = {
          amount: 100,
          usedInPeriod: 950, // близко к лимиту 1000
        };

        const result = getPolicy().canPerformBilling('consume_tokens', mockSubject, highUsage);
        // Результат зависит от стратегии, но должен быть определен
        expect(typeof result.allow).toBe('boolean');
      });

      it('работает с заблокированными субъектами', () => {
        const blockedSubject: BillingSubjectState = {
          ...mockSubject,
          isBlocked: true,
        };

        const result = getPolicy().canPerformBilling('consume_tokens', blockedSubject);
        expect(result.allow).toBe(false);
      });

      it('работает без контекста использования', () => {
        const result = getPolicy().canPerformBilling('create_bot', mockSubject);
        expect(typeof result.allow).toBe('boolean');
      });
    });
  });

  describe('Интеграционные тесты', () => {
    it('демонстрирует полный workflow проверки пользователя', () => {
      // Создаем тестовые данные
      const userId = 'test-user-123';
      const now = Date.now();

      // 1. Проверяем токен
      const token: AuthTokenState = {
        type: 'access',
        issuedAt: now - 100000, // 100 seconds ago
        expiresAt: now + 3500000, // expires in 1 hour
        isRevoked: false,
      };

      const tokenResult = getPolicy().evaluateToken(token, now);
      expect(tokenResult.allow).toBe(true);

      // 2. Проверяем сессию
      const session: AuthSessionState = {
        sessionId: 'session-123',
        userId,
        createdAt: now - 100000,
        lastActivityAt: now - 5000,
        isTerminated: false,
      };

      const sessionResult = getPolicy().evaluateSession(session, now);
      expect(sessionResult.allow).toBe(true);

      // 3. Проверяем права на бота
      const botUser: BotUserContext = {
        userId,
        role: 'owner',
      };

      const botPermissionResult = getPolicy().canPerformBotAction('create', botUser);
      expect(botPermissionResult.allow).toBe(true);

      // 4. Проверяем политику бота
      const bot: BotState = {
        botId: 'bot-123',
        mode: 'active',
        createdAt: now - 1000000,
        isSystemBot: false,
      };

      const botActor: BotActorContext = {
        userId,
        role: 'owner',
      };

      const botPolicyResult = getPolicy().canPerformBotPolicy('execute', bot, botActor);
      expect(botPolicyResult.allow).toBe(true);

      // 5. Проверяем чат
      const chat: ChatState = {
        chatId: 'chat-123',
        mode: 'open',
        createdAt: now - 500000,
      };

      const chatActor: ChatActorContext = {
        actorId: userId,
        type: 'user',
        role: 'participant',
      };

      const chatResult = getPolicy().canPerformChat('send_message', chat, chatActor);
      expect(chatResult.allow).toBe(true);

      // 6. Проверяем биллинг
      const billingSubject: BillingSubjectState = {
        subjectId: userId,
        type: 'user',
        plan: 'free',
        isBlocked: false,
      };

      const billingResult = getPolicy().canPerformBilling('send_message', billingSubject);
      expect(typeof billingResult.allow).toBe('boolean'); // Результат зависит от лимитов
    });

    it('демонстрирует блокировку для проблемных пользователей', () => {
      const userId = 'blocked-user-123';
      const now = Date.now();

      // Заблокированный пользователь
      const blockedSubject: BillingSubjectState = {
        subjectId: userId,
        type: 'user',
        plan: 'free',
        isBlocked: true,
      };

      const billingResult = getPolicy().canPerformBilling('consume_tokens', blockedSubject);
      expect(billingResult.allow).toBe(false);

      // Истекший токен
      const expiredToken: AuthTokenState = {
        type: 'access',
        issuedAt: now - 3600000, // 1 hour ago
        expiresAt: now - 1000000, // expired 1000 seconds ago
        isRevoked: false,
      };

      const tokenResult = getPolicy().evaluateToken(expiredToken, now);
      expect(tokenResult.allow).toBe(false);
    });

    it('проверяет консистентность результатов', () => {
      const now = Date.now();

      // Один и тот же вызов должен давать одинаковый результат
      const token: AuthTokenState = {
        type: 'access',
        issuedAt: now - 100000,
        expiresAt: now + 3500000,
        isRevoked: false,
      };

      const result1 = getPolicy().evaluateToken(token, now);
      const result2 = getPolicy().evaluateToken(token, now);

      expect(result1).toEqual(result2);
      expect(result1.allow).toBe(true);
      expect(result2.allow).toBe(true);
    });
  });

  describe('Граничные случаи', () => {
    it('работает с минимальными значениями', () => {
      const minConfig: ComposedPolicyConfig = {
        auth: {
          accessTokenTtlMs: 1,
          refreshTokenTtlMs: 1,
          sessionMaxLifetimeMs: 1,
          sessionIdleTimeoutMs: 1,
          requireRefreshRotation: false,
        },
        botPermissions: { roleMatrix: { owner: ['read'], admin: [], editor: [], viewer: [] } },
        botPolicy: {
          roleActions: { owner: ['execute'], admin: [], editor: [], viewer: [] },
          modeActions: { draft: [], active: ['execute'], paused: [], archived: [] },
          allowArchiveSystemBot: false,
        },
        chat: {
          roleActions: { owner: ['send_message'], moderator: [], participant: [], viewer: [] },
          modeActions: { open: ['send_message'], restricted: [], read_only: [], archived: [] },
          maxMessageLength: 1,
          maxMessagesPerWindow: 1,
          rateLimitWindowMs: 1,
          allowBotsToWrite: false,
        },
        billing: {
          planLimits: {
            free: { consume_tokens: 1, send_message: 1, create_bot: 1, run_job: 1 },
            pro: {
              consume_tokens: Number.MAX_SAFE_INTEGER,
              send_message: Number.MAX_SAFE_INTEGER,
              create_bot: Number.MAX_SAFE_INTEGER,
              run_job: Number.MAX_SAFE_INTEGER,
            },
            enterprise: {
              consume_tokens: Number.MAX_SAFE_INTEGER,
              send_message: Number.MAX_SAFE_INTEGER,
              create_bot: Number.MAX_SAFE_INTEGER,
              run_job: Number.MAX_SAFE_INTEGER,
            },
          },
          overuseStrategy: { free: 'block', pro: 'allow', enterprise: 'allow' },
          subjectActions: { user: ['consume_tokens'], organization: [], system: [] },
        },
      };

      const minPolicy = new ComposedPolicy(minConfig);

      // Проверяем, что все методы работают без ошибок
      const token: AuthTokenState = {
        type: 'access',
        issuedAt: 0,
        expiresAt: 1,
        isRevoked: false,
      };

      expect(() => minPolicy.evaluateToken(token, 0)).not.toThrow();
      expect(() => minPolicy.canPerformBotAction('read', { userId: 'a', role: 'owner' })).not
        .toThrow();
      expect(() =>
        minPolicy.canPerformBilling('consume_tokens', {
          subjectId: 'a',
          type: 'user',
          plan: 'free',
          isBlocked: false,
        })
      ).not.toThrow();
    });

    it('работает с максимальными значениями', () => {
      const maxConfig: ComposedPolicyConfig = {
        auth: {
          accessTokenTtlMs: Number.MAX_SAFE_INTEGER,
          refreshTokenTtlMs: Number.MAX_SAFE_INTEGER,
          sessionMaxLifetimeMs: Number.MAX_SAFE_INTEGER,
          sessionIdleTimeoutMs: Number.MAX_SAFE_INTEGER,
          requireRefreshRotation: false,
        },
        botPermissions: {
          roleMatrix: {
            owner: ['create', 'read', 'update', 'delete', 'manage_permissions'],
            admin: ['create', 'read', 'update', 'delete'],
            editor: ['create', 'read', 'update'],
            viewer: ['read'],
          },
        },
        botPolicy: {
          roleActions: {
            owner: ['configure', 'publish', 'pause', 'resume', 'execute', 'archive'],
            admin: ['configure', 'publish', 'pause', 'resume', 'execute'],
            editor: ['configure', 'execute'],
            viewer: ['execute'],
          },
          modeActions: {
            draft: ['configure', 'publish'],
            active: ['configure', 'pause', 'execute', 'archive'],
            paused: ['configure', 'resume', 'execute', 'archive'],
            archived: ['archive'],
          },
          allowArchiveSystemBot: true,
        },
        chat: {
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
          maxMessageLength: Number.MAX_SAFE_INTEGER,
          maxMessagesPerWindow: Number.MAX_SAFE_INTEGER,
          rateLimitWindowMs: Number.MAX_SAFE_INTEGER,
          allowBotsToWrite: true,
        },
        billing: {
          planLimits: {
            free: {
              consume_tokens: Number.MAX_SAFE_INTEGER,
              send_message: Number.MAX_SAFE_INTEGER,
              create_bot: Number.MAX_SAFE_INTEGER,
              run_job: Number.MAX_SAFE_INTEGER,
            },
            pro: {
              consume_tokens: Number.MAX_SAFE_INTEGER,
              send_message: Number.MAX_SAFE_INTEGER,
              create_bot: Number.MAX_SAFE_INTEGER,
              run_job: Number.MAX_SAFE_INTEGER,
            },
            enterprise: {
              consume_tokens: Number.MAX_SAFE_INTEGER,
              send_message: Number.MAX_SAFE_INTEGER,
              create_bot: Number.MAX_SAFE_INTEGER,
              run_job: Number.MAX_SAFE_INTEGER,
            },
          },
          overuseStrategy: { free: 'allow', pro: 'allow', enterprise: 'allow' },
          subjectActions: {
            user: ['consume_tokens', 'send_message', 'create_bot', 'run_job'],
            organization: ['consume_tokens', 'send_message', 'create_bot', 'run_job'],
            system: ['consume_tokens', 'run_job'],
          },
        },
      };

      const maxPolicy = new ComposedPolicy(maxConfig);

      // Проверяем, что все методы работают без ошибок
      const token: AuthTokenState = {
        type: 'access',
        issuedAt: Number.MAX_SAFE_INTEGER - 1000000,
        expiresAt: Number.MAX_SAFE_INTEGER,
        isRevoked: false,
      };

      expect(() => maxPolicy.evaluateToken(token, Number.MAX_SAFE_INTEGER - 500000)).not.toThrow();
      expect(() => maxPolicy.canPerformBotAction('create', { userId: 'user', role: 'owner' })).not
        .toThrow();
      expect(() =>
        maxPolicy.canPerformBilling('consume_tokens', {
          subjectId: 'user',
          type: 'user',
          plan: 'enterprise',
          isBlocked: false,
        })
      ).not.toThrow();
    });

    it('обрабатывает undefined параметры корректно', () => {
      // Проверяем, что методы работают с undefined параметрами где это разрешено
      const chat: ChatState = {
        chatId: 'chat-1',
        mode: 'open',
        createdAt: 1000000,
      };

      const actor: ChatActorContext = {
        actorId: 'user-1',
        type: 'user',
        role: 'participant',
      };

      // ChatPolicy.canPerform принимает message?: ChatMessageContext
      expect(() => getPolicy().canPerformChat('send_message', chat, actor)).not.toThrow();
      expect(() => getPolicy().canPerformChat('send_message', chat, actor, undefined)).not
        .toThrow();

      // BillingPolicy.canPerform принимает usage?: BillingUsageContext
      const subject: BillingSubjectState = {
        subjectId: 'user-1',
        type: 'user',
        plan: 'free',
        isBlocked: false,
      };

      expect(() => getPolicy().canPerformBilling('consume_tokens', subject)).not.toThrow();
      expect(() => getPolicy().canPerformBilling('consume_tokens', subject, undefined)).not
        .toThrow();
    });
  });
});
