/**
 * @file Unit тесты для BillingPolicy
 * Полное покрытие всех методов и веток исполнения
 */
import { describe, expect, it } from 'vitest';
import { BillingPolicy } from '../../src/domain/BillingPolicy.js';
import type {
  BillingAction,
  BillingPlan,
  BillingPolicyConfig,
  BillingSubjectState,
  BillingSubjectType,
  BillingUsageContext,
} from '../../src/domain/BillingPolicy.js';

// Mock данные для тестирования
const MOCK_CONFIG: BillingPolicyConfig = {
  planLimits: {
    free: {
      consume_tokens: 1000,
      send_message: 10,
      create_bot: 1,
      run_job: 5,
    },
    pro: {
      consume_tokens: 10000,
      send_message: 100,
      create_bot: 5,
      run_job: 50,
    },
    enterprise: {
      consume_tokens: 100000,
      send_message: 1000,
      create_bot: 50,
      run_job: 500,
    },
  },
  overuseStrategy: {
    free: 'block',
    pro: 'allow_warn',
    enterprise: 'allow',
  },
  subjectActions: {
    user: ['consume_tokens', 'send_message', 'create_bot'],
    organization: ['consume_tokens', 'send_message', 'create_bot', 'run_job'],
    system: ['consume_tokens', 'run_job'],
  },
};

const PAST_TIME = 1000000000000; // Прошлое время
const FUTURE_TIME = 2000000000000; // Будущее время

describe('BillingPolicy', () => {
  const policy = new BillingPolicy(MOCK_CONFIG);

  describe('Конструктор', () => {
    it('создает экземпляр с правильной конфигурацией', () => {
      expect(policy).toBeInstanceOf(BillingPolicy);
    });

    it('принимает полную конфигурацию', () => {
      expect(() => new BillingPolicy(MOCK_CONFIG)).not.toThrow();
    });
  });

  describe('canPerform', () => {
    describe('Блокировка субъекта', () => {
      it('возвращает billing_blocked для заблокированного субъекта', () => {
        const blockedSubject: BillingSubjectState = {
          subjectId: 'subject-1',
          type: 'user',
          plan: 'free',
          isBlocked: true,
          validUntil: FUTURE_TIME,
        };

        const result = policy.canPerform('consume_tokens', blockedSubject);

        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('billing_blocked');
      });

      it('пропускает проверку блокировки для активного субъекта', () => {
        const activeSubject: BillingSubjectState = {
          subjectId: 'subject-1',
          type: 'user',
          plan: 'free',
          isBlocked: false,
          validUntil: FUTURE_TIME,
        };

        const result = policy.canPerform('consume_tokens', activeSubject);

        expect(result.allow).toBe(true);
        expect(result.reason).toBe('BILLING_ALLOWED');
      });
    });

    describe('Истекший план', () => {
      it('возвращает plan_expired для субъекта с истекшим планом', () => {
        const expiredSubject: BillingSubjectState = {
          subjectId: 'subject-1',
          type: 'user',
          plan: 'free',
          isBlocked: false,
          validUntil: PAST_TIME, // Уже истек
        };

        const result = policy.canPerform('consume_tokens', expiredSubject);

        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('plan_expired');
      });

      it('пропускает проверку срока для субъекта без validUntil', () => {
        const subjectWithoutExpiry: BillingSubjectState = {
          subjectId: 'subject-1',
          type: 'user',
          plan: 'free',
          isBlocked: false,
          // validUntil не указан
        };

        const result = policy.canPerform('consume_tokens', subjectWithoutExpiry);

        expect(result.allow).toBe(true);
        expect(result.reason).toBe('BILLING_ALLOWED');
      });

      it('пропускает проверку срока для субъекта с будущим validUntil', () => {
        const subjectWithFutureExpiry: BillingSubjectState = {
          subjectId: 'subject-1',
          type: 'user',
          plan: 'free',
          isBlocked: false,
          validUntil: FUTURE_TIME,
        };

        const result = policy.canPerform('consume_tokens', subjectWithFutureExpiry);

        expect(result.allow).toBe(true);
        expect(result.reason).toBe('BILLING_ALLOWED');
      });

      it('отдает приоритет billing_blocked перед plan_expired', () => {
        const blockedExpiredSubject: BillingSubjectState = {
          subjectId: 'subject-1',
          type: 'user',
          plan: 'free',
          isBlocked: true, // Заблокирован
          validUntil: PAST_TIME, // И истек
        };

        const result = policy.canPerform('consume_tokens', blockedExpiredSubject);

        expect(result.allow).toBe(false);
        expect((result as { allow: false; reason: any; }).reason).toBe('billing_blocked');
      });
    });

    describe('Ограничения по типу субъекта', () => {
      describe('user тип', () => {
        const userSubject: BillingSubjectState = {
          subjectId: 'user-1',
          type: 'user',
          plan: 'free',
          isBlocked: false,
          validUntil: FUTURE_TIME,
        };

        it('разрешает действия user: consume_tokens, send_message, create_bot', () => {
          const allowedActions: BillingAction[] = ['consume_tokens', 'send_message', 'create_bot'];

          allowedActions.forEach((action) => {
            const result = policy.canPerform(action, userSubject);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('BILLING_ALLOWED');
          });
        });

        it('запрещает run_job для user', () => {
          const result = policy.canPerform('run_job', userSubject);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('subject_not_allowed');
        });
      });

      describe('organization тип', () => {
        const orgSubject: BillingSubjectState = {
          subjectId: 'org-1',
          type: 'organization',
          plan: 'pro',
          isBlocked: false,
          validUntil: FUTURE_TIME,
        };

        it('разрешает все действия для organization', () => {
          const allActions: BillingAction[] = [
            'consume_tokens',
            'send_message',
            'create_bot',
            'run_job',
          ];

          allActions.forEach((action) => {
            const result = policy.canPerform(action, orgSubject);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('BILLING_ALLOWED');
          });
        });
      });

      describe('system тип', () => {
        const systemSubject: BillingSubjectState = {
          subjectId: 'system-1',
          type: 'system',
          plan: 'enterprise',
          isBlocked: false,
          validUntil: FUTURE_TIME,
        };

        it('разрешает действия system: consume_tokens, run_job', () => {
          const allowedActions: BillingAction[] = ['consume_tokens', 'run_job'];

          allowedActions.forEach((action) => {
            const result = policy.canPerform(action, systemSubject);
            expect(result.allow).toBe(true);
            expect(result.reason).toBe('BILLING_ALLOWED');
          });
        });

        it('запрещает send_message для system', () => {
          const result = policy.canPerform('send_message', systemSubject);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('subject_not_allowed');
        });

        it('запрещает create_bot для system', () => {
          const result = policy.canPerform('create_bot', systemSubject);
          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('subject_not_allowed');
        });
      });
    });

    describe('Лимиты планов и overuse', () => {
      describe('Без usage контекста', () => {
        it('разрешает действие без проверки лимитов', () => {
          const subject: BillingSubjectState = {
            subjectId: 'subject-1',
            type: 'user',
            plan: 'free',
            isBlocked: false,
            validUntil: FUTURE_TIME,
          };

          const result = policy.canPerform('consume_tokens', subject);

          expect(result.allow).toBe(true);
          expect(result.reason).toBe('BILLING_ALLOWED');
        });
      });

      describe('free план (block стратегия)', () => {
        const freeSubject: BillingSubjectState = {
          subjectId: 'free-user',
          type: 'user',
          plan: 'free',
          isBlocked: false,
          validUntil: FUTURE_TIME,
        };

        it('разрешает действие в пределах лимита', () => {
          const usage: BillingUsageContext = {
            amount: 100,
            usedInPeriod: 500, // 500 + 100 = 600 < 1000
          };

          const result = policy.canPerform('consume_tokens', freeSubject, usage);

          expect(result.allow).toBe(true);
          expect(result.reason).toBe('BILLING_ALLOWED');
        });

        it('запрещает действие при превышении лимита (block)', () => {
          const usage: BillingUsageContext = {
            amount: 600,
            usedInPeriod: 900, // 900 + 600 = 1500 > 1000
          };

          const result = policy.canPerform('consume_tokens', freeSubject, usage);

          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('plan_limit_exceeded');
        });

        it('блокирует на границе лимита', () => {
          const usage: BillingUsageContext = {
            amount: 1,
            usedInPeriod: 1000, // 1000 + 1 = 1001 > 1000
          };

          const result = policy.canPerform('consume_tokens', freeSubject, usage);

          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('plan_limit_exceeded');
        });
      });

      describe('pro план (allow_warn стратегия)', () => {
        const proSubject: BillingSubjectState = {
          subjectId: 'pro-user',
          type: 'organization',
          plan: 'pro',
          isBlocked: false,
          validUntil: FUTURE_TIME,
        };

        it('разрешает действие в пределах лимита', () => {
          const usage: BillingUsageContext = {
            amount: 1000,
            usedInPeriod: 5000, // 5000 + 1000 = 6000 < 10000
          };

          const result = policy.canPerform('consume_tokens', proSubject, usage);

          expect(result.allow).toBe(true);
          expect(result.reason).toBe('BILLING_ALLOWED');
        });

        it('разрешает overuse для allow_warn стратегии', () => {
          const usage: BillingUsageContext = {
            amount: 2000,
            usedInPeriod: 9000, // 9000 + 2000 = 11000 > 10000
          };

          const result = policy.canPerform('consume_tokens', proSubject, usage);

          expect(result.allow).toBe(true);
          expect(result.reason).toBe('BILLING_ALLOWED');
        });
      });

      describe('enterprise план (allow стратегия)', () => {
        const enterpriseSubject: BillingSubjectState = {
          subjectId: 'enterprise-org',
          type: 'organization',
          plan: 'enterprise',
          isBlocked: false,
          validUntil: FUTURE_TIME,
        };

        it('разрешает действие в пределах лимита', () => {
          const usage: BillingUsageContext = {
            amount: 10000,
            usedInPeriod: 50000, // 50000 + 10000 = 60000 < 100000
          };

          const result = policy.canPerform('consume_tokens', enterpriseSubject, usage);

          expect(result.allow).toBe(true);
          expect(result.reason).toBe('BILLING_ALLOWED');
        });

        it('разрешает безлимитный overuse для allow стратегии', () => {
          const usage: BillingUsageContext = {
            amount: 50000,
            usedInPeriod: 100000, // 100000 + 50000 = 150000 > 100000
          };

          const result = policy.canPerform('consume_tokens', enterpriseSubject, usage);

          expect(result.allow).toBe(true);
          expect(result.reason).toBe('BILLING_ALLOWED');
        });
      });

      describe('Неконфигурированные действия', () => {
        it('возвращает action_not_configured для неизвестного действия', () => {
          const configWithoutAction: BillingPolicyConfig = {
            ...MOCK_CONFIG,
            planLimits: {
              ...MOCK_CONFIG.planLimits,
              free: {
                ...MOCK_CONFIG.planLimits.free,
                consume_tokens: undefined as any, // Убираем лимит
              },
            },
          };
          const policyWithoutLimit = new BillingPolicy(configWithoutAction);

          const subject: BillingSubjectState = {
            subjectId: 'subject-1',
            type: 'user',
            plan: 'free',
            isBlocked: false,
            validUntil: FUTURE_TIME,
          };

          const usage: BillingUsageContext = {
            amount: 100,
            usedInPeriod: 0,
          };

          const result = policyWithoutLimit.canPerform('consume_tokens', subject, usage);

          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('action_not_configured');
        });

        it('возвращает action_not_configured для NaN лимита', () => {
          const configWithNaN: BillingPolicyConfig = {
            ...MOCK_CONFIG,
            planLimits: {
              ...MOCK_CONFIG.planLimits,
              free: {
                ...MOCK_CONFIG.planLimits.free,
                consume_tokens: NaN,
              },
            },
          };
          const policyWithNaN = new BillingPolicy(configWithNaN);

          const subject: BillingSubjectState = {
            subjectId: 'subject-1',
            type: 'user',
            plan: 'free',
            isBlocked: false,
            validUntil: FUTURE_TIME,
          };

          const usage: BillingUsageContext = {
            amount: 100,
            usedInPeriod: 0,
          };

          const result = policyWithNaN.canPerform('consume_tokens', subject, usage);

          expect(result.allow).toBe(false);
          expect((result as { allow: false; reason: any; }).reason).toBe('action_not_configured');
        });
      });
    });

    describe('Все комбинации планов, действий и overuse стратегий', () => {
      const plans: BillingPlan[] = ['free', 'pro', 'enterprise'];
      const actions: BillingAction[] = ['consume_tokens', 'send_message', 'create_bot', 'run_job'];

      it.each(
        plans.flatMap((plan) =>
          actions.map((action) => [plan, action] as [BillingPlan, BillingAction])
        ),
      )('проверяет комбинацию %s + %s без usage', (plan, action) => {
        const subject: BillingSubjectState = {
          subjectId: 'test-subject',
          type: plan === 'enterprise' ? 'organization' : 'user',
          plan,
          isBlocked: false,
          validUntil: FUTURE_TIME,
        };

        const result = policy.canPerform(action, subject);

        // Без usage всегда должно быть разрешено (если проходит проверки типа субъекта)
        const allowedSubjectTypes: Record<BillingAction, BillingSubjectType[]> = {
          consume_tokens: ['user', 'organization', 'system'],
          send_message: ['user', 'organization'],
          create_bot: ['user', 'organization'],
          run_job: ['organization', 'system'],
        };

        const expectedAllow = allowedSubjectTypes[action].includes(subject.type);

        expect(result.allow).toBe(expectedAllow);
        if (!expectedAllow) {
          expect((result as { allow: false; reason: any; }).reason).toBe('subject_not_allowed');
        }
      });
    });

    describe('Граничные случаи', () => {
      it('работает с нулевым usage', () => {
        const subject: BillingSubjectState = {
          subjectId: 'subject-1',
          type: 'user',
          plan: 'free',
          isBlocked: false,
          validUntil: FUTURE_TIME,
        };

        const usage: BillingUsageContext = {
          amount: 0,
          usedInPeriod: 0,
        };

        const result = policy.canPerform('consume_tokens', subject, usage);

        expect(result.allow).toBe(true);
        expect(result.reason).toBe('BILLING_ALLOWED');
      });

      it('работает с отрицательным usage', () => {
        const subject: BillingSubjectState = {
          subjectId: 'subject-1',
          type: 'user',
          plan: 'free',
          isBlocked: false,
          validUntil: FUTURE_TIME,
        };

        const usage: BillingUsageContext = {
          amount: -100,
          usedInPeriod: 500,
        };

        const result = policy.canPerform('consume_tokens', subject, usage);

        expect(result.allow).toBe(true);
        expect(result.reason).toBe('BILLING_ALLOWED');
      });

      it('работает с очень большими числами', () => {
        const subject: BillingSubjectState = {
          subjectId: 'subject-1',
          type: 'organization',
          plan: 'enterprise',
          isBlocked: false,
          validUntil: FUTURE_TIME,
        };

        const usage: BillingUsageContext = {
          amount: Number.MAX_SAFE_INTEGER / 2,
          usedInPeriod: Number.MAX_SAFE_INTEGER / 2,
        };

        const result = policy.canPerform('consume_tokens', subject, usage);

        expect(result.allow).toBe(true);
        expect(result.reason).toBe('BILLING_ALLOWED');
      });
    });
  });

  describe('Интеграционные тесты', () => {
    it('полный цикл: создание политики и комплексные проверки', () => {
      const customConfig: BillingPolicyConfig = {
        planLimits: {
          free: { consume_tokens: 100, send_message: 5, create_bot: 0, run_job: 0 },
          pro: { consume_tokens: 1000, send_message: 50, create_bot: 3, run_job: 10 },
          enterprise: { consume_tokens: 10000, send_message: 500, create_bot: 100, run_job: 1000 },
        },
        overuseStrategy: {
          free: 'block',
          pro: 'allow_warn',
          enterprise: 'allow',
        },
        subjectActions: {
          user: ['consume_tokens', 'send_message'],
          organization: ['consume_tokens', 'send_message', 'create_bot', 'run_job'],
          system: ['consume_tokens', 'run_job'],
        },
      };

      const customPolicy = new BillingPolicy(customConfig);

      // Тестовые сценарии
      const scenarios = [
        // Free user в лимите
        {
          subject: {
            subjectId: 'free-user',
            type: 'user' as BillingSubjectType,
            plan: 'free' as BillingPlan,
            isBlocked: false,
            validUntil: FUTURE_TIME,
          },
          action: 'consume_tokens' as BillingAction,
          usage: { amount: 50, usedInPeriod: 30 },
          expected: true,
        },
        // Free user превышает лимит
        {
          subject: {
            subjectId: 'free-user',
            type: 'user' as BillingSubjectType,
            plan: 'free' as BillingPlan,
            isBlocked: false,
            validUntil: FUTURE_TIME,
          },
          action: 'consume_tokens' as BillingAction,
          usage: { amount: 50, usedInPeriod: 80 },
          expected: false,
        },
        // Pro org в overuse (allow_warn)
        {
          subject: {
            subjectId: 'pro-org',
            type: 'organization' as BillingSubjectType,
            plan: 'pro' as BillingPlan,
            isBlocked: false,
            validUntil: FUTURE_TIME,
          },
          action: 'consume_tokens' as BillingAction,
          usage: { amount: 200, usedInPeriod: 900 },
          expected: true,
        },
        // Enterprise system без лимитов
        {
          subject: {
            subjectId: 'enterprise-system',
            type: 'system' as BillingSubjectType,
            plan: 'enterprise' as BillingPlan,
            isBlocked: false,
            validUntil: FUTURE_TIME,
          },
          action: 'run_job' as BillingAction,
          usage: { amount: 10000, usedInPeriod: 100000 },
          expected: true,
        },
        // Заблокированный субъект
        {
          subject: {
            subjectId: 'blocked-user',
            type: 'user' as BillingSubjectType,
            plan: 'free' as BillingPlan,
            isBlocked: true,
            validUntil: FUTURE_TIME,
          },
          action: 'consume_tokens' as BillingAction,
          usage: { amount: 10, usedInPeriod: 0 },
          expected: false,
        },
        // Истекший план
        {
          subject: {
            subjectId: 'expired-user',
            type: 'user' as BillingSubjectType,
            plan: 'free' as BillingPlan,
            isBlocked: false,
            validUntil: PAST_TIME,
          },
          action: 'consume_tokens' as BillingAction,
          usage: { amount: 10, usedInPeriod: 0 },
          expected: false,
        },
      ];

      scenarios.forEach((scenario, index) => {
        const result = customPolicy.canPerform(scenario.action, scenario.subject, scenario.usage);
        expect(result.allow, `Scenario ${index + 1} failed`).toBe(scenario.expected);
      });
    });

    it('демонстрирует реальные сценарии использования', () => {
      // Сценарий 1: Пользователь отправляет сообщение
      const user: BillingSubjectState = {
        subjectId: 'user-1',
        type: 'user',
        plan: 'free',
        isBlocked: false,
        validUntil: FUTURE_TIME,
      };

      const messageUsage: BillingUsageContext = { amount: 1, usedInPeriod: 5 };
      expect(policy.canPerform('send_message', user, messageUsage).allow).toBe(true);

      // Сценарий 2: Организация создает бота
      const org: BillingSubjectState = {
        subjectId: 'org-1',
        type: 'organization',
        plan: 'pro',
        isBlocked: false,
        validUntil: FUTURE_TIME,
      };

      const botUsage: BillingUsageContext = { amount: 1, usedInPeriod: 2 };
      expect(policy.canPerform('create_bot', org, botUsage).allow).toBe(true);

      // Сценарий 3: Система выполняет задачу
      const system: BillingSubjectState = {
        subjectId: 'system-1',
        type: 'system',
        plan: 'enterprise',
        isBlocked: false,
        validUntil: FUTURE_TIME,
      };

      const jobUsage: BillingUsageContext = { amount: 100, usedInPeriod: 1000 };
      expect(policy.canPerform('run_job', system, jobUsage).allow).toBe(true);

      // Сценарий 4: Превышение лимита блокирует free пользователя
      const freeUser: BillingSubjectState = {
        subjectId: 'free-user',
        type: 'user',
        plan: 'free',
        isBlocked: false,
        validUntil: FUTURE_TIME,
      };

      const overuseUsage: BillingUsageContext = { amount: 200, usedInPeriod: 900 };
      expect(policy.canPerform('consume_tokens', freeUser, overuseUsage).allow).toBe(false);
    });

    it('проверяет консистентность результатов', () => {
      const subject: BillingSubjectState = {
        subjectId: 'test-subject',
        type: 'user',
        plan: 'free',
        isBlocked: false,
        validUntil: FUTURE_TIME,
      };

      const usage: BillingUsageContext = { amount: 50, usedInPeriod: 400 };

      // Один и тот же вызов должен давать одинаковый результат
      const result1 = policy.canPerform('consume_tokens', subject, usage);
      const result2 = policy.canPerform('consume_tokens', subject, usage);

      expect(result1).toEqual(result2);
      expect(result1.allow).toBe(true);
      expect(result2.allow).toBe(true);
    });
  });
});
