/**
 * @file Unit тесты для effects/logout/logout-effect.types.ts
 * Полное покрытие DI-типов logout-effect и security projection.
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  AbortControllerPort,
  AuthApiClientPort,
  ClockPort,
  ErrorMapperPort,
  EventIdGeneratorPort,
  LogoutAuditLoggerPort,
  LogoutConcurrency,
  LogoutEffectConfig,
  LogoutEffectDeps,
  LogoutFeatureFlags,
  LogoutMode,
  LogoutSecurityDecision,
  LogoutSecurityResult,
} from '../../../../src/effects/logout/logout-effect.types.js';
import {
  isLocalLogoutDeps,
  isRemoteLogoutDeps,
  validateLogoutConfig,
} from '../../../../src/effects/logout/logout-effect.types.js';
import type { AuthStorePort } from '../../../../src/effects/shared/auth-store.port.js';
import type { AuthError, AuthState, SecurityState } from '../../../../src/types/auth.js';
import type { RiskLevel } from '../../../../src/types/auth-risk.js';
import type { SecurityPipelineResult } from '../../../../src/lib/security-pipeline.js';
import type { AuditEventValues } from '../../../../src/schemas/index.js';

/* eslint-disable fp/no-mutation, functional/no-conditional-statements, @livai/rag/source-citation */

// ============================================================================
// 🔧 HELPERS
// ============================================================================

/**
 * Создает тестовый AuthState
 */
function createAuthState(): AuthState {
  return {
    status: 'authenticated',
    user: {
      id: 'user-123',
    },
  };
}

/**
 * Создает тестовый SecurityState
 */
function createSecurityState(): SecurityState {
  return {
    status: 'risk_detected',
    riskLevel: 'low' as RiskLevel,
    riskScore: 10,
  };
}

/**
 * Создает тестовый SecurityPipelineResult
 */
function createSecurityPipelineResult(): SecurityPipelineResult {
  return {
    deviceInfo: {
      deviceId: 'device-1',
      deviceType: 'desktop',
    },
    riskAssessment: {
      riskScore: 25,
      riskLevel: 'low' as RiskLevel,
      triggeredRules: [],
      decisionHint: { action: 'block' },
      assessment: {} as SecurityPipelineResult['riskAssessment']['assessment'],
    },
  };
}

// ============================================================================
// 📋 TYPE STRUCTURE TESTS
// ============================================================================

describe('effects/logout/logout-effect.types', () => {
  describe('LogoutMode', () => {
    it('поддерживает все варианты режима logout', () => {
      const modes: LogoutMode[] = ['local', 'remote'];

      expect(modes).toEqual(['local', 'remote']);
      expect(modes).toContain('local');
      expect(modes).toContain('remote');
    });

    it('обеспечивает compile-time safety для discriminated unions', () => {
      const localMode: LogoutMode = 'local';
      const remoteMode: LogoutMode = 'remote';

      // TypeScript обеспечивает типизацию
      expect(localMode).toBe('local');
      expect(remoteMode).toBe('remote');
    });
  });

  describe('LogoutSecurityDecision', () => {
    it('поддерживает все варианты discriminated union', () => {
      const decisions: LogoutSecurityDecision[] = [
        { type: 'allow' },
        { type: 'block', reason: 'High risk detected' },
        { type: 'block' },
        { type: 'custom', code: 'require_confirmation', metadata: { step: 'confirm' } },
        { type: 'custom', code: 'require_step_down' },
      ];

      const types = decisions.map((decision) => {
        switch (decision.type) {
          case 'allow':
            return 'allow';
          case 'block':
            return decision.reason != null ? 'block_with_reason' : 'block';
          case 'custom':
            return `custom_${decision.code}`;
          default: {
            // Exhaustiveness guard на уровне типов
            const _exhaustiveCheck: never = decision;
            throw new Error(`Unexpected decision: ${JSON.stringify(_exhaustiveCheck)}`);
          }
        }
      });

      expect(types).toEqual([
        'allow',
        'block_with_reason',
        'block',
        'custom_require_confirmation',
        'custom_require_step_down',
      ]);
    });

    it('поддерживает block decision с опциональным reason', () => {
      const blockWithReason: LogoutSecurityDecision = { type: 'block', reason: 'Risk too high' };
      const blockWithoutReason: LogoutSecurityDecision = { type: 'block' };

      expect(blockWithReason.type).toBe('block');
      expect(blockWithReason.reason).toBe('Risk too high');
      expect(blockWithoutReason.type).toBe('block');
      expect(blockWithoutReason.reason).toBeUndefined();
    });

    it('поддерживает custom decision с опциональным metadata', () => {
      // eslint-disable-next-line ai-security/model-poisoning
      const customWithMetadata: LogoutSecurityDecision = {
        type: 'custom',
        code: 'step_up_required',
        metadata: { level: 'high', reason: 'suspicious_activity' },
      };
      // eslint-disable-next-line ai-security/model-poisoning
      const customWithoutMetadata: LogoutSecurityDecision = {
        type: 'custom',
        code: 'force_logout',
      };

      expect(customWithMetadata.type).toBe('custom');
      expect(customWithMetadata.code).toBe('step_up_required');
      expect(customWithMetadata.metadata).toEqual({
        level: 'high',
        reason: 'suspicious_activity',
      });

      expect(customWithoutMetadata.type).toBe('custom');
      expect(customWithoutMetadata.code).toBe('force_logout');
      expect(customWithoutMetadata.metadata).toBeUndefined();
    });
  });

  describe('LogoutSecurityResult', () => {
    it('содержит все обязательные поля', () => {
      const pipelineResult = createSecurityPipelineResult();
      const result: LogoutSecurityResult = {
        decision: { type: 'allow' },
        riskScore: 25,
        riskLevel: 'low' as RiskLevel,
        pipelineResult,
      };

      expect(result.decision.type).toBe('allow');
      expect(result.riskScore).toBe(25);
      expect(result.riskLevel).toBe('low');
      expect(result.pipelineResult).toEqual(pipelineResult);
    });

    it('поддерживает все варианты LogoutSecurityDecision', () => {
      const pipelineResult = createSecurityPipelineResult();
      const decisions: LogoutSecurityDecision[] = [
        { type: 'allow' },
        { type: 'block', reason: 'High risk' },
        { type: 'custom', code: 'require_verification' },
      ];

      const results = decisions.map((decision) => {
        const result: LogoutSecurityResult = {
          decision,
          riskScore: 50,
          riskLevel: 'medium' as RiskLevel,
          pipelineResult,
        };
        return result;
      });

      expect(results).toHaveLength(3);
      expect(results[0]?.decision.type).toBe('allow');
      expect(results[1]?.decision.type).toBe('block');
      expect(results[2]?.decision.type).toBe('custom');
    });
  });

  describe('LogoutConcurrency', () => {
    it('поддерживает все стратегии конкурентных вызовов', () => {
      const strategies: LogoutConcurrency[] = ['ignore', 'cancel_previous', 'serialize'];

      expect(strategies).toEqual(['ignore', 'cancel_previous', 'serialize']);
      expect(strategies).toContain('ignore');
      expect(strategies).toContain('cancel_previous');
      expect(strategies).toContain('serialize');
    });

    it('обеспечивает compile-time safety', () => {
      const ignore: LogoutConcurrency = 'ignore';
      const cancelPrevious: LogoutConcurrency = 'cancel_previous';
      const serialize: LogoutConcurrency = 'serialize';

      expect(ignore).toBe('ignore');
      expect(cancelPrevious).toBe('cancel_previous');
      expect(serialize).toBe('serialize');
    });
  });

  describe('порты', () => {
    describe('ErrorMapperPort', () => {
      it('поддерживает map функцию для трансформации ошибок', () => {
        const errorMapper: ErrorMapperPort = {
          map: (unknownError: unknown): AuthError => ({
            kind: 'network',
            retryable: true,
            message: String(unknownError),
          }),
        };

        const error = new Error('Connection failed');
        const mappedError = errorMapper.map(error);

        expect(mappedError.kind).toBe('network');
        expect(mappedError.message).toBe('Error: Connection failed');
        expect((mappedError as { retryable: boolean; }).retryable).toBe(true);
      });

      it('может трансформировать любые unknown ошибки', () => {
        const errorMapper: ErrorMapperPort = {
          map: (unknownError: unknown): AuthError => ({
            kind: 'network',
            retryable: true,
            message: `Mapped: ${String(unknownError)}`,
          }),
        };

        const stringError = 'String error';
        const objectError = { code: 500, message: 'Server error' };
        const nullError = null;

        expect(errorMapper.map(stringError).message).toContain('Mapped: String error');
        expect(errorMapper.map(objectError).message).toContain('Mapped: [object Object]');
        expect(errorMapper.map(nullError).message).toContain('Mapped: null');
      });
    });

    describe('ClockPort', () => {
      it('предоставляет now функцию возвращающую UnixTimestampMs', () => {
        const clock: ClockPort = {
          now: () => 1704067200000, // 2024-01-01 00:00:00 UTC
        };

        const timestamp = clock.now();

        expect(timestamp).toBe(1704067200000);
        expect(typeof timestamp).toBe('number');
        expect(timestamp).toBeGreaterThan(0);
      });

      it('может возвращать текущий timestamp', () => {
        const realClock: ClockPort = {
          now: () => Date.now(),
        };

        const timestamp = realClock.now();
        const now = Date.now();

        // Разница должна быть минимальной (учитывая время выполнения)
        expect(Math.abs(timestamp - now)).toBeLessThan(100);
      });
    });

    describe('EventIdGeneratorPort', () => {
      it('предоставляет generate функцию возвращающую строку', () => {
        const eventIdGenerator: EventIdGeneratorPort = {
          generate: () => 'custom-event-id-123',
        };

        const eventId = eventIdGenerator.generate();

        expect(eventId).toBe('custom-event-id-123');
        expect(typeof eventId).toBe('string');
        expect(eventId.length).toBeGreaterThan(0);
      });

      it('может генерировать уникальные eventId', () => {
        const counter = { value: 0 };
        const eventIdGenerator: EventIdGeneratorPort = {
          generate: () => `event-${++counter.value}`,
        };

        const eventId1 = eventIdGenerator.generate();
        const eventId2 = eventIdGenerator.generate();
        const eventId3 = eventIdGenerator.generate();

        expect(eventId1).toBe('event-1');
        expect(eventId2).toBe('event-2');
        expect(eventId3).toBe('event-3');
        expect(eventId1).not.toBe(eventId2);
        expect(eventId2).not.toBe(eventId3);
      });

      it('может использовать crypto.randomUUID для генерации', () => {
        const eventIdGenerator: EventIdGeneratorPort = {
          generate: () => crypto.randomUUID(),
        };

        const eventId1 = eventIdGenerator.generate();
        const eventId2 = eventIdGenerator.generate();

        expect(eventId1).not.toBe(eventId2);
        expect(typeof eventId1).toBe('string');
        expect(typeof eventId2).toBe('string');
        // UUID формат: 8-4-4-4-12 символов
        expect(eventId1.length).toBe(36);
        expect(eventId2.length).toBe(36);
      });
    });

    describe('LogoutAuditLoggerPort', () => {
      it('поддерживает logLogoutEvent функцию', () => {
        const loggedEvents: AuditEventValues[] = [];

        const auditLogger: LogoutAuditLoggerPort = {
          logLogoutEvent: (event) => {
            loggedEvents.push(event);
          },
        };

        const successEvent: AuditEventValues = {
          eventId: 'event-1',
          timestamp: '2024-01-01T00:00:00.000Z',
          type: 'logout_success',
          userId: 'user-123',
        };

        const failureEvent: AuditEventValues = {
          eventId: 'event-2',
          timestamp: '2024-01-01T00:01:00.000Z',
          type: 'logout_failure',
          userId: 'user-456',
          errorCode: 'network',
        };

        const revokeErrorEvent: AuditEventValues = {
          eventId: 'event-3',
          timestamp: '2024-01-01T00:02:00.000Z',
          type: 'revoke_error',
          errorCode: 'network',
        };

        auditLogger.logLogoutEvent(successEvent);
        auditLogger.logLogoutEvent(failureEvent);
        auditLogger.logLogoutEvent(revokeErrorEvent);

        expect(loggedEvents).toHaveLength(3);
        expect(loggedEvents[0]).toEqual(successEvent);
        expect(loggedEvents[1]).toEqual(failureEvent);
        expect(loggedEvents[2]).toEqual(revokeErrorEvent);
      });

      it('поддерживает pre-auth logout сценарии (userId undefined)', () => {
        const loggedEvents: AuditEventValues[] = [];

        const auditLogger: LogoutAuditLoggerPort = {
          logLogoutEvent: (event) => {
            loggedEvents.push(event);
          },
        };

        const preAuthLogout: AuditEventValues = {
          eventId: 'event-1',
          timestamp: '2024-01-01T00:00:00.000Z',
          type: 'logout_success',
        };

        auditLogger.logLogoutEvent(preAuthLogout);

        expect(loggedEvents).toHaveLength(1);
        expect(loggedEvents[0]?.userId).toBeUndefined();
        expect(loggedEvents[0]?.timestamp).toBe('2024-01-01T00:00:00.000Z');
        expect(loggedEvents[0]?.type).toBe('logout_success');
      });
    });

    describe('AbortControllerPort', () => {
      it('предоставляет create функцию возвращающую AbortController', () => {
        const abortControllerPort: AbortControllerPort = {
          create: () => new AbortController(),
        };

        const controller = abortControllerPort.create();

        expect(controller).toBeInstanceOf(AbortController);
        expect(controller.signal).toBeInstanceOf(AbortSignal);
        expect(controller.signal.aborted).toBe(false);
      });

      it('может создавать несколько независимых контроллеров', () => {
        const abortControllerPort: AbortControllerPort = {
          create: () => new AbortController(),
        };

        const controller1 = abortControllerPort.create();
        const controller2 = abortControllerPort.create();

        expect(controller1).not.toBe(controller2);
        expect(controller1.signal).not.toBe(controller2.signal);

        // Abort одного не влияет на другой
        controller1.abort();
        expect(controller1.signal.aborted).toBe(true);
        expect(controller2.signal.aborted).toBe(false);
      });
    });
  });

  describe('LogoutEffectDeps', () => {
    it('поддерживает local mode с базовыми зависимостями', () => {
      const storeCalls: { auth?: AuthState; security?: SecurityState; } = {};

      const authStore: AuthStorePort = {
        setAuthState: (state: AuthState) => {
          storeCalls.auth = state;
        },
        setSessionState: () => {},
        setSecurityState: (state: SecurityState) => {
          storeCalls.security = state;
        },
        applyEventType: () => {},
        setStoreLocked: () => {},
        batchUpdate: () => {},
      };

      const auditLogger: LogoutAuditLoggerPort = {
        logLogoutEvent: () => {},
      };

      const clock: ClockPort = {
        now: () => 1704067200000,
      };

      const deps: LogoutEffectDeps = {
        mode: 'local',
        authStore,
        clock,
        auditLogger,
      };

      // Проверяем, что deps правильно типизированы
      expect(deps.mode).toBe('local');
      expect(deps.authStore).toBeDefined();
      expect(deps.clock).toBeDefined();
      expect(deps.auditLogger).toBeDefined();

      // Проверяем, что remote зависимости отсутствуют
      expect((deps as any).apiClient).toBeUndefined();
      expect((deps as any).errorMapper).toBeUndefined();
      expect((deps as any).abortController).toBeUndefined();

      // Используем deps для runtime проверки
      deps.authStore.setAuthState(createAuthState());
      deps.authStore.setSecurityState(createSecurityState());
      const now = deps.clock.now();

      expect(storeCalls.auth).toBeDefined();
      expect(storeCalls.security).toBeDefined();
      expect(now).toBe(1704067200000);
    });

    it('поддерживает remote mode с полными зависимостями', () => {
      const captured: { url?: string; body?: unknown; } = {};

      const apiClient: AuthApiClientPort = {
        post: vi.fn().mockImplementation((url: string, body: unknown) => {
          captured.url = url;
          captured.body = body;
          return async (): Promise<{ success: boolean; }> => ({ success: true });
        }) as any,
        get: vi.fn().mockImplementation(() => async (): Promise<{ data: string; }> => ({
          data: 'test',
        })) as any,
      };

      const errorMapper: ErrorMapperPort = {
        map: (error: unknown): AuthError => ({
          kind: 'network',
          retryable: true,
          message: String(error),
        }),
      };

      const abortController: AbortControllerPort = {
        create: () => new AbortController(),
      };

      const authStore: AuthStorePort = {
        setAuthState: () => {},
        setSessionState: () => {},
        setSecurityState: () => {},
        applyEventType: () => {},
        setStoreLocked: () => {},
        batchUpdate: () => {},
      };

      const auditLogger: LogoutAuditLoggerPort = {
        logLogoutEvent: () => {},
      };

      const clock: ClockPort = {
        now: () => 1704067200000,
      };

      const deps: LogoutEffectDeps = {
        mode: 'remote',
        authStore,
        clock,
        auditLogger,
        apiClient,
        errorMapper,
        abortController,
      };

      // Проверяем, что все зависимости присутствуют
      expect(deps.mode).toBe('remote');
      expect(deps.apiClient).toBeDefined();
      expect(deps.errorMapper).toBeDefined();
      expect(deps.abortController).toBeDefined();

      // Используем deps для runtime проверки
      const controller = deps.abortController!.create();
      const mappedError = deps.errorMapper.map(new Error('Test error'));
      const effect = deps.apiClient.post('/revoke', { token: 'test-token' });

      expect(controller).toBeInstanceOf(AbortController);
      expect(mappedError.kind).toBe('network');
      expect(typeof effect).toBe('function');
      expect(captured.url).toBe('/revoke');
      expect(captured.body).toEqual({ token: 'test-token' });
    });

    it('remote mode поддерживает опциональный abortController', () => {
      const apiClient: AuthApiClientPort = {
        post: vi.fn().mockImplementation(() => async (): Promise<{ success: boolean; }> => ({
          success: true,
        })) as any,
        get: vi.fn().mockImplementation(() => async (): Promise<{ data: string; }> => ({
          data: 'test',
        })) as any,
      };

      const errorMapper: ErrorMapperPort = {
        map: (error: unknown): AuthError => ({
          kind: 'network',
          retryable: true,
          message: String(error),
        }),
      };

      const authStore: AuthStorePort = {
        setAuthState: () => {},
        setSessionState: () => {},
        setSecurityState: () => {},
        applyEventType: () => {},
        setStoreLocked: () => {},
        batchUpdate: () => {},
      };

      const auditLogger: LogoutAuditLoggerPort = {
        logLogoutEvent: () => {},
      };

      const clock: ClockPort = {
        now: () => 1704067200000,
      };

      // Remote deps без abortController
      const deps: LogoutEffectDeps = {
        mode: 'remote',
        authStore,
        clock,
        auditLogger,
        apiClient,
        errorMapper,
      };

      expect(deps.mode).toBe('remote');
      expect(deps.abortController).toBeUndefined();
      expect(deps.apiClient).toBeDefined();
      expect(deps.errorMapper).toBeDefined();
    });
  });

  describe('LogoutEffectConfig', () => {
    describe('local mode', () => {
      it('поддерживает минимальную конфигурацию', () => {
        const config: LogoutEffectConfig = {
          mode: 'local',
        };

        expect(config.mode).toBe('local');
        expect(config.concurrency).toBeUndefined();
        expect(config.featureFlags).toBeUndefined();
      });

      it('поддерживает concurrency и featureFlags', () => {
        const featureFlags: LogoutFeatureFlags = {};

        const config: LogoutEffectConfig = {
          mode: 'local',
          concurrency: 'ignore',
          featureFlags,
        };

        expect(config.mode).toBe('local');
        expect(config.concurrency).toBe('ignore');
        expect(config.featureFlags).toEqual(featureFlags);
      });

      it('поддерживает все варианты concurrency для local mode', () => {
        const strategies: LogoutConcurrency[] = ['ignore', 'cancel_previous', 'serialize'];

        strategies.forEach((strategy) => {
          const config: LogoutEffectConfig = {
            mode: 'local',
            concurrency: strategy,
          };

          expect(config.mode).toBe('local');
          expect(config.concurrency).toBe(strategy);
        });
      });
    });

    describe('remote mode', () => {
      it('поддерживает минимальную конфигурацию', () => {
        const config: LogoutEffectConfig = {
          mode: 'remote',
        };

        expect(config.mode).toBe('remote');
        expect(config.concurrency).toBeUndefined();
        expect(config.timeout).toBeUndefined();
        expect(config.featureFlags).toBeUndefined();
      });

      it('поддерживает timeout, concurrency и featureFlags', () => {
        const featureFlags: LogoutFeatureFlags = {};

        const config: LogoutEffectConfig = {
          mode: 'remote',
          timeout: 5000,
          concurrency: 'cancel_previous',
          featureFlags,
        };

        expect(config.mode).toBe('remote');
        expect(config.timeout).toBe(5000);
        expect(config.concurrency).toBe('cancel_previous');
        expect(config.featureFlags).toEqual(featureFlags);
      });

      it('timeout может быть undefined', () => {
        const config: LogoutEffectConfig = {
          mode: 'remote',
          timeout: undefined,
        };

        expect(config.mode).toBe('remote');
        expect(config.timeout).toBeUndefined();
      });
    });
  });

  describe('LogoutFeatureFlags', () => {
    it('поддерживает пустой объект (резервирует под будущие флаги)', () => {
      const featureFlags: LogoutFeatureFlags = {};

      expect(featureFlags).toEqual({});
      expect(Object.keys(featureFlags)).toHaveLength(0);
    });
  });

  describe('validateLogoutConfig', () => {
    it('принимает валидную local конфигурацию', () => {
      const config: LogoutEffectConfig = {
        mode: 'local',
        concurrency: 'ignore',
      };

      expect(() => validateLogoutConfig(config)).not.toThrow();
    });

    it('принимает валидную remote конфигурацию без timeout', () => {
      const config: LogoutEffectConfig = {
        mode: 'remote',
        concurrency: 'serialize',
      };

      expect(() => validateLogoutConfig(config)).not.toThrow();
    });

    it('принимает валидную remote конфигурацию с положительным timeout', () => {
      const config: LogoutEffectConfig = {
        mode: 'remote',
        timeout: 5000,
      };

      expect(() => validateLogoutConfig(config)).not.toThrow();
    });

    it('отклоняет remote конфигурацию с нулевым timeout', () => {
      const config: LogoutEffectConfig = {
        mode: 'remote',
        timeout: 0,
      };

      expect(() => validateLogoutConfig(config)).toThrow('logout timeout must be > 0');
    });

    it('отклоняет remote конфигурацию с отрицательным timeout', () => {
      const config: LogoutEffectConfig = {
        mode: 'remote',
        timeout: -1000,
      };

      expect(() => validateLogoutConfig(config)).toThrow('logout timeout must be > 0');
    });

    it('игнорирует timeout в local mode', () => {
      const config: LogoutEffectConfig = {
        mode: 'local',
        // @ts-expect-error - timeout не должен быть доступен в local mode
        timeout: -5000,
      };

      // TypeScript не позволит добавить timeout в local config,
      // но если каким-то образом это произойдет, валидация его проигнорирует
      expect(() => validateLogoutConfig(config)).not.toThrow();
    });
  });

  describe('isRemoteLogoutDeps', () => {
    it('возвращает true для remote deps', () => {
      const deps: LogoutEffectDeps = {
        mode: 'remote',
        authStore: {} as AuthStorePort,
        clock: {} as ClockPort,
        auditLogger: {} as LogoutAuditLoggerPort,
        apiClient: {} as AuthApiClientPort,
        errorMapper: {} as ErrorMapperPort,
      };

      expect(isRemoteLogoutDeps(deps)).toBe(true);
    });

    it('возвращает false для local deps', () => {
      const deps: LogoutEffectDeps = {
        mode: 'local',
        authStore: {} as AuthStorePort,
        clock: {} as ClockPort,
        auditLogger: {} as LogoutAuditLoggerPort,
      };

      expect(isRemoteLogoutDeps(deps)).toBe(false);
    });

    it('обеспечивает type narrowing для remote deps', () => {
      const deps: LogoutEffectDeps = {
        mode: 'remote',
        authStore: {} as AuthStorePort,
        clock: {} as ClockPort,
        auditLogger: {} as LogoutAuditLoggerPort,
        apiClient: {} as AuthApiClientPort,
        errorMapper: {} as ErrorMapperPort,
        abortController: {} as AbortControllerPort,
      };

      if (isRemoteLogoutDeps(deps)) {
        // TypeScript должен знать, что deps имеют remote структуру
        expect(deps.mode).toBe('remote');
        expect(deps.apiClient).toBeDefined();
        expect(deps.errorMapper).toBeDefined();
        expect(deps.abortController).toBeDefined();
      } else {
        throw new Error('Expected remote deps');
      }
    });
  });

  describe('isLocalLogoutDeps', () => {
    it('возвращает true для local deps', () => {
      const deps: LogoutEffectDeps = {
        mode: 'local',
        authStore: {} as AuthStorePort,
        clock: {} as ClockPort,
        auditLogger: {} as LogoutAuditLoggerPort,
      };

      expect(isLocalLogoutDeps(deps)).toBe(true);
    });

    it('возвращает false для remote deps', () => {
      const deps: LogoutEffectDeps = {
        mode: 'remote',
        authStore: {} as AuthStorePort,
        clock: {} as ClockPort,
        auditLogger: {} as LogoutAuditLoggerPort,
        apiClient: {} as AuthApiClientPort,
        errorMapper: {} as ErrorMapperPort,
      };

      expect(isLocalLogoutDeps(deps)).toBe(false);
    });

    it('обеспечивает type narrowing для local deps', () => {
      const deps: LogoutEffectDeps = {
        mode: 'local',
        authStore: {} as AuthStorePort,
        clock: {} as ClockPort,
        auditLogger: {} as LogoutAuditLoggerPort,
      };

      if (isLocalLogoutDeps(deps)) {
        // TypeScript должен знать, что deps имеют local структуру
        expect(deps.mode).toBe('local');
        expect((deps as any).apiClient).toBeUndefined();
        expect((deps as any).errorMapper).toBeUndefined();
      } else {
        throw new Error('Expected local deps');
      }
    });
  });

  describe('Integration scenarios', () => {
    it('LogoutEffectDeps + LogoutEffectConfig работают вместе для local mode', () => {
      const config: LogoutEffectConfig = {
        mode: 'local',
        concurrency: 'ignore',
      };

      const deps: LogoutEffectDeps = {
        mode: 'local',
        authStore: {
          setAuthState: () => {},
          setSessionState: () => {},
          setSecurityState: () => {},
          applyEventType: () => {},
          setStoreLocked: () => {},
          batchUpdate: () => {},
        },
        clock: { now: () => Date.now() },
        auditLogger: { logLogoutEvent: () => {} },
      };

      // Конфигурация и deps совместимы по mode
      expect(config.mode).toBe(deps.mode);
      expect(config.mode).toBe('local');

      // Валидация проходит
      expect(() => validateLogoutConfig(config)).not.toThrow();

      // Type guards работают правильно
      expect(isLocalLogoutDeps(deps)).toBe(true);
      expect(isRemoteLogoutDeps(deps)).toBe(false);
    });

    it('LogoutEffectDeps + LogoutEffectConfig работают вместе для remote mode', () => {
      const config: LogoutEffectConfig = {
        mode: 'remote',
        timeout: 3000,
        concurrency: 'cancel_previous',
      };

      const deps: LogoutEffectDeps = {
        mode: 'remote',
        authStore: {
          setAuthState: () => {},
          setSessionState: () => {},
          setSecurityState: () => {},
          applyEventType: () => {},
          setStoreLocked: () => {},
          batchUpdate: () => {},
        },
        clock: { now: () => Date.now() },
        auditLogger: { logLogoutEvent: () => {} },
        apiClient: {
          post: vi.fn().mockImplementation(() => async () => ({ success: true })) as any,
          get: vi.fn().mockImplementation(() => async () => ({ data: 'test' })) as any,
        },
        errorMapper: {
          map: (error: unknown): AuthError => ({
            kind: 'network',
            retryable: true,
            message: String(error),
          }),
        },
        abortController: { create: () => new AbortController() },
      };

      // Конфигурация и deps совместимы по mode
      expect(config.mode).toBe(deps.mode);
      expect(config.mode).toBe('remote');

      // Валидация проходит
      expect(() => validateLogoutConfig(config)).not.toThrow();

      // Type guards работают правильно
      expect(isRemoteLogoutDeps(deps)).toBe(true);
      expect(isLocalLogoutDeps(deps)).toBe(false);
    });
  });
});

/* eslint-enable fp/no-mutation, functional/no-conditional-statements, @livai/rag/source-citation */
