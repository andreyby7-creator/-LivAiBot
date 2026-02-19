/**
 * @file packages/feature-auth/src/lib/security-pipeline/risk-sources/remote-provider.source.ts
 * ============================================================================
 * 🛡️ FEATURE-AUTH — Risk Sources (Remote Provider)
 * ============================================================================
 *
 * Архитектурная роль:
 * - External risk provider source для v2 pipeline
 * - Параллельная оценка риска через внешний сервис
 * - Причина изменения: external risk provider integration
 *
 * Принципы:
 * - ✅ Timeout isolation — изоляция timeout для внешних вызовов
 * - ✅ Fail-closed — при ошибке возвращаем максимальный риск
 * - ✅ Optional — не блокирует pipeline при недоступности
 */

import { withTimeout } from '@livai/app/lib/effect-timeout.js';
import type { Effect } from '@livai/app/lib/effect-utils.js';

import type { DeviceInfo } from '../../../domain/DeviceInfo.js';
import type { RiskAssessmentResult } from '../../../types/risk.js';
import type { SecurityPipelineContext } from '../security-pipeline.js';

/**
 * Результат оценки риска из удаленного источника
 */
export type RemoteRiskResult = RiskAssessmentResult & {
  /** Источник результата */
  readonly source: 'remote_provider';
  /** Уровень уверенности (0-1) */
  readonly confidence: number;
};

/**
 * Конфигурация удаленного источника риска
 */
export type RemoteProviderSourceConfig = {
  /** Контекст для оценки риска (SecurityPipelineContext расширяет RiskContext) */
  readonly context: SecurityPipelineContext;
  /** Device info для оценки */
  readonly deviceInfo: DeviceInfo;
  /** Timeout для внешнего вызова (мс) */
  readonly timeoutMs?: number;
};

/**
 * Тип для функции вызова внешнего провайдера риска
 * @note Принимает SecurityPipelineContext (расширяет RiskContext с operation)
 */
export type RemoteRiskProvider = (
  deviceInfo: DeviceInfo,
  context: SecurityPipelineContext,
) => Promise<RiskAssessmentResult>;

/**
 * Оценивает риск через удаленный провайдер
 * @note Timeout isolation: изоляция timeout для внешних вызовов
 * @note Fail-closed: при ошибке возвращаем максимальный риск
 */
const DEFAULT_REMOTE_PROVIDER_TIMEOUT_MS = 5000; // Default timeout 5s для remote provider

export function assessRemoteRisk(
  config: RemoteProviderSourceConfig,
  provider: RemoteRiskProvider,
): Effect<RemoteRiskResult> {
  const { deviceInfo, context, timeoutMs = DEFAULT_REMOTE_PROVIDER_TIMEOUT_MS } = config;

  const riskAssessmentEffect = async (): Promise<RemoteRiskResult> => {
    try {
      // eslint-disable-next-line @livai/multiagent/orchestration-safety -- Timeout установлен через withTimeout ниже
      const result = await provider(deviceInfo, context);
      return {
        ...result,
        source: 'remote_provider' as const,
        confidence: 0.8, // Default confidence для удаленного источника
      };
    } catch {
      // Fail-closed: при ошибке возвращаем максимальный риск
      return {
        riskScore: 100,
        riskLevel: 'critical',
        triggeredRules: [],
        decisionHint: {
          action: 'block',
          blockReason: 'critical_risk',
        },
        assessment: {
          device: {
            deviceId: deviceInfo.deviceId,
            platform: deviceInfo.deviceType === 'desktop' ? 'desktop' : 'web',
          },
        },
        source: 'remote_provider' as const,
        confidence: 0.0, // Низкая уверенность при ошибке
      };
    }
  };

  // Применяем timeout для изоляции внешних вызовов
  const effectWithTimeout = withTimeout(riskAssessmentEffect, {
    timeoutMs,
    tag: 'security-pipeline:remote-risk-provider',
  });

  return effectWithTimeout;
}
