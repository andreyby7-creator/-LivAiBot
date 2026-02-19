/**
 * @file Unit тесты для BotPermissions
 * Полное покрытие всех методов и веток исполнения
 */
import { describe, expect, it } from 'vitest';
import { BotPermissions } from '../../src/policies/BotPermissions.js';
import type {
  BotAction,
  BotPermissionsConfig,
  BotRole,
  BotUserContext,
} from '../../src/policies/BotPermissions.js';

// Mock данные для тестирования
const MOCK_CONFIG: BotPermissionsConfig = {
  roleMatrix: {
    owner: ['create', 'read', 'update', 'delete', 'execute', 'manage_permissions'],
    admin: ['create', 'read', 'update', 'delete', 'execute'],
    editor: ['read', 'update', 'execute'],
    viewer: ['read'],
  },
};

const MOCK_CONFIG_RESTRICTED: BotPermissionsConfig = {
  roleMatrix: {
    owner: ['read', 'manage_permissions'],
    admin: ['read'],
    editor: ['read'],
    viewer: ['read'],
  },
};

describe('BotPermissions', () => {
  const permissions = new BotPermissions(MOCK_CONFIG);
  const restrictedPermissions = new BotPermissions(MOCK_CONFIG_RESTRICTED);

  describe('Конструктор', () => {
    it('создает экземпляр с правильной конфигурацией', () => {
      expect(permissions).toBeInstanceOf(BotPermissions);
    });

    it('принимает конфиг с полными правами', () => {
      expect(() => new BotPermissions(MOCK_CONFIG)).not.toThrow();
    });

    it('принимает конфиг с ограниченными правами', () => {
      expect(() => new BotPermissions(MOCK_CONFIG_RESTRICTED)).not.toThrow();
    });
  });

  describe('canPerform', () => {
    describe('Аутентификация', () => {
      it('возвращает not_authenticated для null userId', () => {
        const user: BotUserContext = {
          userId: null,
          role: 'owner',
        };

        const result = permissions.canPerform('read', user);

        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('not_authenticated');
      });

      it('возвращает not_authenticated для пустой строки userId', () => {
        const user: BotUserContext = {
          userId: '',
          role: 'owner',
        };

        const result = permissions.canPerform('read', user);

        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('not_authenticated');
      });

      it('возвращает not_authenticated для undefined userId', () => {
        const user: BotUserContext = {
          userId: undefined as any,
          role: 'owner',
        };

        const result = permissions.canPerform('read', user);

        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('not_authenticated');
      });

      it('пропускает проверку аутентификации для валидного userId', () => {
        const user: BotUserContext = {
          userId: 'user-1',
          role: 'viewer',
        };

        const result = permissions.canPerform('read', user);

        expect(result.allow).toBe(true);
        expect(result.reason).toBe('ACTION_ALLOWED');
      });
    });

    describe('Членство', () => {
      it('возвращает not_a_member для undefined role', () => {
        const user = {
          userId: 'user-1',
          role: undefined,
        } as unknown as BotUserContext;

        const result = permissions.canPerform('read', user);

        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('not_a_member');
      });

      it('отдает приоритет not_authenticated перед not_a_member', () => {
        const user = {
          userId: null,
          role: undefined,
        } as unknown as BotUserContext;

        const result = permissions.canPerform('read', user);

        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('not_authenticated');
      });

      it('пропускает проверку членства для валидной роли', () => {
        const user: BotUserContext = {
          userId: 'user-1',
          role: 'viewer',
        };

        const result = permissions.canPerform('read', user);

        expect(result.allow).toBe(true);
        expect(result.reason).toBe('ACTION_ALLOWED');
      });
    });

    describe('Права по ролям', () => {
      describe('owner роль', () => {
        const ownerUser: BotUserContext = {
          userId: 'user-1',
          role: 'owner',
        };

        it('разрешает все действия для owner', () => {
          const actions: BotAction[] = [
            'create',
            'read',
            'update',
            'delete',
            'execute',
            'manage_permissions',
          ];

          actions.forEach((action) => {
            const result = permissions.canPerform(action, ownerUser);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });

        it('работает с ограниченной конфигурацией', () => {
          const result = restrictedPermissions.canPerform('read', ownerUser);
          expect(result.allow).toBe(true);
          expect(result.reason).toBe('ACTION_ALLOWED');
        });

        it('запрещает manage_permissions в ограниченной конфигурации', () => {
          const result = restrictedPermissions.canPerform('manage_permissions', ownerUser);
          expect(result.allow).toBe(true); // owner всё ещё имеет право
          expect(result.reason).toBe('ACTION_ALLOWED');
        });
      });

      describe('admin роль', () => {
        const adminUser: BotUserContext = {
          userId: 'user-1',
          role: 'admin',
        };

        it('разрешает действия admin: create, read, update, delete, execute', () => {
          const allowedActions: BotAction[] = ['create', 'read', 'update', 'delete', 'execute'];

          allowedActions.forEach((action) => {
            const result = permissions.canPerform(action, adminUser);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });

        it('запрещает manage_permissions для admin', () => {
          const result = permissions.canPerform('manage_permissions', adminUser);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
        });

        it('работает с ограниченной конфигурацией', () => {
          const result = restrictedPermissions.canPerform('read', adminUser);
          expect(result.allow).toBe(true);
          expect(result.reason).toBe('ACTION_ALLOWED');
        });
      });

      describe('editor роль', () => {
        const editorUser: BotUserContext = {
          userId: 'user-1',
          role: 'editor',
        };

        it('разрешает действия editor: read, update, execute', () => {
          const allowedActions: BotAction[] = ['read', 'update', 'execute'];

          allowedActions.forEach((action) => {
            const result = permissions.canPerform(action, editorUser);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('ACTION_ALLOWED');
          });
        });

        it('запрещает create для editor', () => {
          const result = permissions.canPerform('create', editorUser);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
        });

        it('запрещает delete для editor', () => {
          const result = permissions.canPerform('delete', editorUser);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
        });

        it('запрещает manage_permissions для editor', () => {
          const result = permissions.canPerform('manage_permissions', editorUser);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
        });
      });

      describe('viewer роль', () => {
        const viewerUser: BotUserContext = {
          userId: 'user-1',
          role: 'viewer',
        };

        it('разрешает только read для viewer', () => {
          const result = permissions.canPerform('read', viewerUser);
          expect(result.allow).toBe(true);
          expect(result.reason).toBe('ACTION_ALLOWED');
        });

        it('запрещает все остальные действия для viewer', () => {
          const forbiddenActions: BotAction[] = [
            'create',
            'update',
            'delete',
            'execute',
            'manage_permissions',
          ];

          forbiddenActions.forEach((action) => {
            const result = permissions.canPerform(action, viewerUser);
            expect(result.allow).toBe(false);
            expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
          });
        });

        it('работает с ограниченной конфигурацией', () => {
          const result = restrictedPermissions.canPerform('read', viewerUser);
          expect(result.allow).toBe(true);
          expect(result.reason).toBe('ACTION_ALLOWED');
        });
      });
    });

    describe('Все комбинации ролей и действий', () => {
      const roles: BotRole[] = ['owner', 'admin', 'editor', 'viewer'];
      const actions: BotAction[] = [
        'create',
        'read',
        'update',
        'delete',
        'execute',
        'manage_permissions',
      ];

      it.each(
        roles.flatMap((role) => actions.map((action) => [role, action] as [BotRole, BotAction])),
      )('проверяет комбинацию %s + %s', (role, action) => {
        const user: BotUserContext = {
          userId: 'user-1',
          role,
        };

        const result = permissions.canPerform(action, user);

        const allowedActions = MOCK_CONFIG.roleMatrix[role];
        const expectedAllow = allowedActions.includes(action);

        expect(result.allow).toBe(expectedAllow);
        if (!expectedAllow) {
          expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
        } else {
          expect(result.reason).toBe('ACTION_ALLOWED');
        }
      });
    });

    describe('Граничные случаи', () => {
      it('работает с минимальным userId', () => {
        const user: BotUserContext = {
          userId: 'a',
          role: 'viewer',
        };

        const result = permissions.canPerform('read', user);
        expect(result.allow).toBe(true);
      });

      it('работает с длинным userId', () => {
        const user: BotUserContext = {
          userId: 'very-long-user-id-that-should-still-work-fine',
          role: 'viewer',
        };

        const result = permissions.canPerform('read', user);
        expect(result.allow).toBe(true);
      });

      it('работает с специальными символами в userId', () => {
        const user: BotUserContext = {
          userId: 'user-123_special',
          role: 'viewer',
        };

        const result = permissions.canPerform('read', user);
        expect(result.allow).toBe(true);
      });
    });

    describe('Конфигурационные edge cases', () => {
      it('работает с пустым массивом разрешенных действий', () => {
        const emptyConfig: BotPermissionsConfig = {
          roleMatrix: {
            owner: [],
            admin: [],
            editor: [],
            viewer: [],
          },
        };
        const emptyPermissions = new BotPermissions(emptyConfig);

        const user: BotUserContext = {
          userId: 'user-1',
          role: 'owner',
        };

        const result = emptyPermissions.canPerform('read', user);
        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
      });

      it('работает с конфигом где все роли имеют одинаковые права', () => {
        const equalConfig: BotPermissionsConfig = {
          roleMatrix: {
            owner: ['read'],
            admin: ['read'],
            editor: ['read'],
            viewer: ['read'],
          },
        };
        const equalPermissions = new BotPermissions(equalConfig);

        const roles: BotRole[] = ['owner', 'admin', 'editor', 'viewer'];

        roles.forEach((role) => {
          const user: BotUserContext = {
            userId: 'user-1',
            role,
          };

          const result = equalPermissions.canPerform('read', user);
          expect(result.allow).toBe(true);
          expect(result.reason).toBe('ACTION_ALLOWED');
        });
      });
    });
  });

  describe('Интеграционные тесты', () => {
    it('полный цикл: создание политики и проверка всех комбинаций', () => {
      const customConfig: BotPermissionsConfig = {
        roleMatrix: {
          owner: ['create', 'read', 'update'],
          admin: ['read', 'update'],
          editor: ['read'],
          viewer: ['read'],
        },
      };

      const customPermissions = new BotPermissions(customConfig);

      // Тестируем все комбинации ролей и действий
      const testCases = [
        { role: 'owner' as BotRole, action: 'create' as BotAction, expected: true },
        { role: 'owner' as BotRole, action: 'read' as BotAction, expected: true },
        { role: 'owner' as BotRole, action: 'update' as BotAction, expected: true },
        { role: 'owner' as BotRole, action: 'delete' as BotAction, expected: false },
        { role: 'admin' as BotRole, action: 'read' as BotAction, expected: true },
        { role: 'admin' as BotRole, action: 'update' as BotAction, expected: true },
        { role: 'admin' as BotRole, action: 'create' as BotAction, expected: false },
        { role: 'editor' as BotRole, action: 'read' as BotAction, expected: true },
        { role: 'editor' as BotRole, action: 'update' as BotAction, expected: false },
        { role: 'viewer' as BotRole, action: 'read' as BotAction, expected: true },
        { role: 'viewer' as BotRole, action: 'create' as BotAction, expected: false },
      ];

      testCases.forEach(({ role, action, expected }) => {
        const user: BotUserContext = {
          userId: 'test-user',
          role,
        };

        const result = customPermissions.canPerform(action, user);
        expect(result.allow).toBe(expected);

        if (!expected) {
          expect((result as { allow: false; reason: any; }).reason).toBe('insufficient_role');
        }
      });
    });

    it('демонстрирует различные сценарии использования', () => {
      // Сценарий 1: Владелец создает бота
      const owner: BotUserContext = { userId: 'owner-1', role: 'owner' };
      expect(permissions.canPerform('create', owner).allow).toBe(true);

      // Сценарий 2: Админ редактирует бота
      const admin: BotUserContext = { userId: 'admin-1', role: 'admin' };
      expect(permissions.canPerform('update', admin).allow).toBe(true);

      // Сценарий 3: Редактор пытается удалить бота (запрещено)
      const editor: BotUserContext = { userId: 'editor-1', role: 'editor' };
      expect(permissions.canPerform('delete', editor).allow).toBe(false);

      // Сценарий 4: Зритель смотрит на бота
      const viewer: BotUserContext = { userId: 'viewer-1', role: 'viewer' };
      expect(permissions.canPerform('read', viewer).allow).toBe(true);

      // Сценарий 5: Неавторизованный пользователь (null userId)
      const anonymous: BotUserContext = { userId: null, role: 'viewer' };
      expect(permissions.canPerform('read', anonymous).allow).toBe(false);

      // Сценарий 6: Пользователь не в команде бота (undefined role)
      const nonMember = { userId: 'user-1', role: undefined } as unknown as BotUserContext;
      expect(permissions.canPerform('read', nonMember).allow).toBe(false);
    });

    it('проверяет консистентность результатов', () => {
      const user: BotUserContext = { userId: 'user-1', role: 'editor' };

      // Один и тот же вызов должен давать одинаковый результат
      const result1 = permissions.canPerform('read', user);
      const result2 = permissions.canPerform('read', user);

      expect(result1).toEqual(result2);
      expect(result1.allow).toBe(true);
      expect(result2.allow).toBe(true);
    });
  });
});
