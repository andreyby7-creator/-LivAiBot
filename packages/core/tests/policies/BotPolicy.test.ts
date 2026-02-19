/**
 * @file Unit тесты для BotPolicy
 * Полное покрытие всех методов и веток исполнения
 */
import { describe, expect, it } from 'vitest';
import { BotPolicy } from '../../src/policies/BotPolicy.js';
import type {
  BotActorContext,
  BotMode,
  BotPolicyAction,
  BotPolicyConfig,
  BotRole,
  BotState,
} from '../../src/policies/BotPolicy.js';

// Mock данные для тестирования
const MOCK_CONFIG: BotPolicyConfig = {
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

const MOCK_CONFIG_ALLOW_SYSTEM_ARCHIVE: BotPolicyConfig = {
  ...MOCK_CONFIG,
  allowArchiveSystemBot: true,
};

describe('BotPolicy', () => {
  const policy = new BotPolicy(MOCK_CONFIG);
  const policyAllowSystem = new BotPolicy(MOCK_CONFIG_ALLOW_SYSTEM_ARCHIVE);

  describe('Конструктор', () => {
    it('создает экземпляр с правильной конфигурацией', () => {
      expect(policy).toBeInstanceOf(BotPolicy);
    });

    it('принимает конфиг с запретом архивации system ботов', () => {
      expect(() => new BotPolicy(MOCK_CONFIG)).not.toThrow();
    });

    it('принимает конфиг с разрешением архивации system ботов', () => {
      expect(() => new BotPolicy(MOCK_CONFIG_ALLOW_SYSTEM_ARCHIVE)).not.toThrow();
    });
  });

  describe('canPerform', () => {
    describe('Архивные боты', () => {
      const archivedBot: BotState = {
        botId: 'bot-1',
        mode: 'archived',
        createdAt: 1000000,
        isSystemBot: false,
      };

      const archivedSystemBot: BotState = {
        ...archivedBot,
        isSystemBot: true,
      };

      const ownerActor: BotActorContext = {
        userId: 'user-1',
        role: 'owner',
      };

      it('запрещает любые действия кроме archive для архивного бота', () => {
        const forbiddenActions: BotPolicyAction[] = [
          'configure',
          'publish',
          'pause',
          'resume',
          'execute',
        ];

        forbiddenActions.forEach((action) => {
          const result = policy.canPerform(action, archivedBot, ownerActor);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('bot_archived');
        });
      });

      it('разрешает archive для архивного бота', () => {
        const result = policy.canPerform('archive', archivedBot, ownerActor);
        expect(result.allow).toBe(true);
        expect(result.reason).toBe('ACTION_ALLOWED');
      });

      it('запрещает archive system бота когда allowArchiveSystemBot = false', () => {
        const result = policy.canPerform('archive', archivedSystemBot, ownerActor);
        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('action_not_allowed');
      });

      it('разрешает archive system бота когда allowArchiveSystemBot = true', () => {
        const result = policyAllowSystem.canPerform('archive', archivedSystemBot, ownerActor);
        expect(result.allow).toBe(true);
        expect(result.reason).toBe('ACTION_ALLOWED');
      });
    });

    describe('Ограничения по режимам бота', () => {
      const ownerActor: BotActorContext = {
        userId: 'user-1',
        role: 'owner',
      };

      describe('draft режим', () => {
        const draftBot: BotState = {
          botId: 'bot-1',
          mode: 'draft',
          createdAt: 1000000,
          isSystemBot: false,
        };

        it('разрешает действия draft: configure, publish', () => {
          const allowedActions: BotPolicyAction[] = ['configure', 'publish'];

          allowedActions.forEach((action) => {
            const result = policy.canPerform(action, draftBot, ownerActor);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });

        it('запрещает остальные действия для draft', () => {
          const forbiddenActions: BotPolicyAction[] = ['pause', 'resume', 'execute', 'archive'];

          forbiddenActions.forEach((action) => {
            const result = policy.canPerform(action, draftBot, ownerActor);
            expect(result.allow).toBe(false);
            expect((result as { allow: false; reason: any; }).reason).toBe('invalid_bot_mode');
          });
        });
      });

      describe('active режим', () => {
        const activeBot: BotState = {
          botId: 'bot-1',
          mode: 'active',
          createdAt: 1000000,
          isSystemBot: false,
        };

        it('разрешает действия active: configure, pause, execute, archive', () => {
          const allowedActions: BotPolicyAction[] = ['configure', 'pause', 'execute', 'archive'];

          allowedActions.forEach((action) => {
            const result = policy.canPerform(action, activeBot, ownerActor);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });

        it('запрещает publish и resume для active', () => {
          const forbiddenActions: BotPolicyAction[] = ['publish', 'resume'];

          forbiddenActions.forEach((action) => {
            const result = policy.canPerform(action, activeBot, ownerActor);
            expect(result.allow).toBe(false);
            expect((result as { allow: false; reason: any; }).reason).toBe('invalid_bot_mode');
          });
        });
      });

      describe('paused режим', () => {
        const pausedBot: BotState = {
          botId: 'bot-1',
          mode: 'paused',
          createdAt: 1000000,
          isSystemBot: false,
        };

        it('разрешает действия paused: configure, resume, execute, archive', () => {
          const allowedActions: BotPolicyAction[] = ['configure', 'resume', 'execute', 'archive'];

          allowedActions.forEach((action) => {
            const result = policy.canPerform(action, pausedBot, ownerActor);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });

        it('запрещает publish и pause для paused', () => {
          const forbiddenActions: BotPolicyAction[] = ['publish', 'pause'];

          forbiddenActions.forEach((action) => {
            const result = policy.canPerform(action, pausedBot, ownerActor);
            expect(result.allow).toBe(false);
            expect((result as { allow: false; reason: any; }).reason).toBe('invalid_bot_mode');
          });
        });
      });

      describe('archived режим', () => {
        const archivedBot: BotState = {
          botId: 'bot-1',
          mode: 'archived',
          createdAt: 1000000,
          isSystemBot: false,
        };

        it('разрешает только archive для archived', () => {
          const result = policy.canPerform('archive', archivedBot, ownerActor);
          expect(result.allow).toBe(true);
          expect(result.reason).toBe('ACTION_ALLOWED');
        });

        it('запрещает все остальные действия для archived', () => {
          const forbiddenActions: BotPolicyAction[] = [
            'configure',
            'publish',
            'pause',
            'resume',
            'execute',
          ];

          forbiddenActions.forEach((action) => {
            const result = policy.canPerform(action, archivedBot, ownerActor);
            expect(result.allow).toBe(false);
            expect((result as { allow: false; reason: any; }).reason).toBe('bot_archived');
          });
        });
      });
    });

    describe('Ограничения по ролям', () => {
      const activeBot: BotState = {
        botId: 'bot-1',
        mode: 'active',
        createdAt: 1000000,
        isSystemBot: false,
      };

      describe('owner роль', () => {
        const ownerActor: BotActorContext = {
          userId: 'user-1',
          role: 'owner',
        };

        it('разрешает действия owner в active режиме', () => {
          // owner может делать всё, что разрешено в active режиме
          const allowedActions: BotPolicyAction[] = ['configure', 'pause', 'execute', 'archive'];

          allowedActions.forEach((action) => {
            const result = policy.canPerform(action, activeBot, ownerActor);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });

        it('запрещает действия, не разрешенные в active режиме', () => {
          const forbiddenActions: BotPolicyAction[] = ['publish', 'resume'];

          forbiddenActions.forEach((action) => {
            const result = policy.canPerform(action, activeBot, ownerActor);
            expect(result.allow).toBe(false);
            expect((result as { allow: false; reason: any; }).reason).toBe('invalid_bot_mode');
          });
        });
      });

      describe('admin роль', () => {
        const adminActor: BotActorContext = {
          userId: 'user-1',
          role: 'admin',
        };

        it('разрешает действия admin в active режиме', () => {
          // admin может делать то, что разрешено в active режиме И для admin роли
          const allowedActions: BotPolicyAction[] = ['configure', 'pause', 'execute'];

          allowedActions.forEach((action) => {
            const result = policy.canPerform(action, activeBot, adminActor);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });

        it('запрещает archive для admin', () => {
          const result = policy.canPerform('archive', activeBot, adminActor);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
        });
      });

      describe('editor роль', () => {
        const editorActor: BotActorContext = {
          userId: 'user-1',
          role: 'editor',
        };

        it('разрешает действия editor: configure, execute', () => {
          const allowedActions: BotPolicyAction[] = ['configure', 'execute'];

          allowedActions.forEach((action) => {
            const result = policy.canPerform(action, activeBot, editorActor);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });

        it('запрещает действия, не разрешенные для editor роли', () => {
          // pause - не разрешен для editor роли (но разрешен в active режиме)
          const result1 = policy.canPerform('pause', activeBot, editorActor);
          expect(result1.allow).toBe(false);
          expect((result1 as { allow: false; reason: any; }).reason).toBe('insufficient_role');

          // archive - не разрешен для editor роли (но разрешен в active режиме)
          const result2 = policy.canPerform('archive', activeBot, editorActor);
          expect(result2.allow).toBe(false);
          expect((result2 as { allow: false; reason: any; }).reason).toBe('insufficient_role');
        });
      });

      describe('viewer роль', () => {
        const viewerActor: BotActorContext = {
          userId: 'user-1',
          role: 'viewer',
        };

        it('разрешает только execute для viewer', () => {
          const result = policy.canPerform('execute', activeBot, viewerActor);
          expect(result.allow).toBe(true);
          expect(result.reason).toBe('ACTION_ALLOWED');
        });

        it('запрещает действия, не разрешенные для viewer роли', () => {
          // configure - не разрешен для viewer роли (но разрешен в active режиме)
          const result1 = policy.canPerform('configure', activeBot, viewerActor);
          expect(result1.allow).toBe(false);
          expect((result1 as { allow: false; reason: any; }).reason).toBe('insufficient_role');

          // pause - не разрешен для viewer роли (но разрешен в active режиме)
          const result2 = policy.canPerform('pause', activeBot, viewerActor);
          expect(result2.allow).toBe(false);
          expect((result2 as { allow: false; reason: any; }).reason).toBe('insufficient_role');

          // archive - не разрешен для viewer роли (но разрешен в active режиме)
          const result3 = policy.canPerform('archive', activeBot, viewerActor);
          expect(result3.allow).toBe(false);
          expect((result3 as { allow: false; reason: any; }).reason).toBe('insufficient_role');
        });
      });
    });

    describe('Все комбинации режимов, ролей и действий', () => {
      const modes: BotMode[] = ['draft', 'active', 'paused', 'archived'];
      const roles: BotRole[] = ['owner', 'admin', 'editor', 'viewer'];
      const actions: BotPolicyAction[] = [
        'configure',
        'publish',
        'pause',
        'resume',
        'execute',
        'archive',
      ];

      it.each(
        modes.flatMap((mode) =>
          roles.flatMap((role) =>
            actions.map((action) => [mode, role, action] as [BotMode, BotRole, BotPolicyAction])
          )
        ),
      )('проверяет комбинацию %s + %s + %s', (mode, role, action) => {
        const bot: BotState = {
          botId: 'test-bot',
          mode,
          createdAt: 1000000,
          isSystemBot: false,
        };

        const actor: BotActorContext = {
          userId: 'test-user',
          role,
        };

        const result = policy.canPerform(action, bot, actor);

        // Определяем ожидаемый результат по приоритету проверок
        const isArchivedMode = mode === 'archived';
        const isArchiveAction = action === 'archive';
        const allowedInMode = MOCK_CONFIG.modeActions[mode].includes(action);
        const allowedForRole = MOCK_CONFIG.roleActions[role].includes(action);

        // eslint-disable-next-line sonarjs/cognitive-complexity
        const expected = (() => {
          if (isArchivedMode) {
            if (isArchiveAction) {
              if (!allowedForRole) {
                return { allow: false as const, reason: 'insufficient_role' as const };
              }
              if (bot.isSystemBot && !MOCK_CONFIG.allowArchiveSystemBot) {
                return { allow: false as const, reason: 'action_not_allowed' as const };
              }
              return { allow: true as const };
            }
            return { allow: false as const, reason: 'bot_archived' as const };
          }

          if (!allowedInMode) {
            return { allow: false as const, reason: 'invalid_bot_mode' as const };
          }

          if (!allowedForRole) {
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
        const bot: BotState = {
          botId: 'a',
          mode: 'draft',
          createdAt: 0,
          isSystemBot: false,
        };

        const actor: BotActorContext = {
          userId: 'a',
          role: 'viewer',
        };

        const result = policy.canPerform('execute', bot, actor);
        expect(result.allow).toBe(false); // draft не позволяет execute
        expect((result as { allow: false; reason: any; }).reason).toBe('invalid_bot_mode');
      });

      it('работает с длинными идентификаторами', () => {
        const bot: BotState = {
          botId: 'very-long-bot-id-that-should-still-work-fine',
          mode: 'active',
          createdAt: 1000000,
          isSystemBot: false,
        };

        const actor: BotActorContext = {
          userId: 'very-long-user-id-that-should-still-work-fine',
          role: 'owner',
        };

        const result = policy.canPerform('configure', bot, actor);
        expect(result.allow).toBe(true);
        expect(result.reason).toBe('ACTION_ALLOWED');
      });

      it('работает с system ботами в разных режимах', () => {
        const systemBot: BotState = {
          botId: 'system-bot',
          mode: 'active',
          createdAt: 1000000,
          isSystemBot: true,
        };

        const ownerActor: BotActorContext = {
          userId: 'admin-user',
          role: 'owner',
        };

        const result = policy.canPerform('execute', systemBot, ownerActor);
        expect(result.allow).toBe(true);
        expect(result.reason).toBe('ACTION_ALLOWED');
      });
    });

    describe('Конфигурационные edge cases', () => {
      it('работает с пустым массивом разрешенных действий', () => {
        const emptyConfig: BotPolicyConfig = {
          roleActions: {
            owner: [],
            admin: [],
            editor: [],
            viewer: [],
          },
          modeActions: {
            draft: ['configure'],
            active: [],
            paused: [],
            archived: [],
          },
          allowArchiveSystemBot: false,
        };
        const emptyPolicy = new BotPolicy(emptyConfig);

        const bot: BotState = {
          botId: 'bot-1',
          mode: 'active',
          createdAt: 1000000,
          isSystemBot: false,
        };

        const actor: BotActorContext = {
          userId: 'user-1',
          role: 'owner',
        };

        const result = emptyPolicy.canPerform('configure', bot, actor);
        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('invalid_bot_mode');
      });
    });
  });

  describe('Интеграционные тесты', () => {
    it('полный цикл: создание политики и комплексные проверки', () => {
      const customConfig: BotPolicyConfig = {
        roleActions: {
          owner: ['configure', 'publish', 'pause', 'execute', 'archive'],
          admin: ['configure', 'pause', 'execute'],
          editor: ['configure', 'execute'],
          viewer: ['execute'],
        },
        modeActions: {
          draft: ['configure', 'publish'],
          active: ['configure', 'pause', 'execute', 'archive'],
          paused: ['configure', 'execute', 'archive'],
          archived: ['archive'],
        },
        allowArchiveSystemBot: true,
      };

      const customPolicy = new BotPolicy(customConfig);

      // Тестовые сценарии
      const scenarios = [
        // Owner на active боте - все действия
        {
          bot: {
            botId: 'bot-1',
            mode: 'active' as BotMode,
            createdAt: 1000000,
            isSystemBot: false,
          },
          actor: { userId: 'owner-1', role: 'owner' as BotRole },
          action: 'configure' as BotPolicyAction,
          expected: true,
        },
        // Admin на active боте - ограниченные действия
        {
          bot: {
            botId: 'bot-1',
            mode: 'active' as BotMode,
            createdAt: 1000000,
            isSystemBot: false,
          },
          actor: { userId: 'admin-1', role: 'admin' as BotRole },
          action: 'pause' as BotPolicyAction,
          expected: true,
        },
        // Viewer на draft боте - запрещено
        {
          bot: { botId: 'bot-1', mode: 'draft' as BotMode, createdAt: 1000000, isSystemBot: false },
          actor: { userId: 'viewer-1', role: 'viewer' as BotRole },
          action: 'configure' as BotPolicyAction,
          expected: false,
        },
        // Owner на archived system боте - разрешено с allowArchiveSystemBot
        {
          bot: {
            botId: 'system-bot',
            mode: 'archived' as BotMode,
            createdAt: 1000000,
            isSystemBot: true,
          },
          actor: { userId: 'owner-1', role: 'owner' as BotRole },
          action: 'archive' as BotPolicyAction,
          expected: true,
        },
      ];

      scenarios.forEach((scenario, index) => {
        const result = customPolicy.canPerform(scenario.action, scenario.bot, scenario.actor);
        expect(result.allow, `Scenario ${index + 1} failed`).toBe(scenario.expected);
      });
    });

    it('демонстрирует реальные сценарии использования', () => {
      // Сценарий 1: Owner публикует черновик бота
      const draftBot: BotState = {
        botId: 'draft-bot',
        mode: 'draft',
        createdAt: 1000000,
        isSystemBot: false,
      };

      const owner: BotActorContext = { userId: 'owner-1', role: 'owner' };
      expect(policy.canPerform('publish', draftBot, owner).allow).toBe(true);

      // Сценарий 2: Editor пытается опубликовать бота (запрещено)
      const editor: BotActorContext = { userId: 'editor-1', role: 'editor' };
      expect(policy.canPerform('publish', draftBot, editor).allow).toBe(false);

      // Сценарий 3: Admin ставит active бота на паузу
      const activeBot: BotState = {
        botId: 'active-bot',
        mode: 'active',
        createdAt: 1000000,
        isSystemBot: false,
      };

      const admin: BotActorContext = { userId: 'admin-1', role: 'admin' };
      expect(policy.canPerform('pause', activeBot, admin).allow).toBe(true);

      // Сценарий 4: Viewer выполняет бота
      const viewer: BotActorContext = { userId: 'viewer-1', role: 'viewer' };
      expect(policy.canPerform('execute', activeBot, viewer).allow).toBe(true);

      // Сценарий 5: Owner архивирует paused бота
      const pausedBot: BotState = {
        botId: 'paused-bot',
        mode: 'paused',
        createdAt: 1000000,
        isSystemBot: false,
      };

      expect(policy.canPerform('archive', pausedBot, owner).allow).toBe(true);

      // Сценарий 6: Попытка выполнить действие над archived ботом
      const archivedBot: BotState = {
        botId: 'archived-bot',
        mode: 'archived',
        createdAt: 1000000,
        isSystemBot: false,
      };

      expect(policy.canPerform('execute', archivedBot, owner).allow).toBe(false);
    });

    it('проверяет консистентность результатов', () => {
      const bot: BotState = {
        botId: 'test-bot',
        mode: 'active',
        createdAt: 1000000,
        isSystemBot: false,
      };

      const actor: BotActorContext = {
        userId: 'test-user',
        role: 'editor',
      };

      // Один и тот же вызов должен давать одинаковый результат
      const result1 = policy.canPerform('configure', bot, actor);
      const result2 = policy.canPerform('configure', bot, actor);

      expect(result1).toEqual(result2);
      expect(result1.allow).toBe(true);
      expect(result2.allow).toBe(true);
    });
  });
});
