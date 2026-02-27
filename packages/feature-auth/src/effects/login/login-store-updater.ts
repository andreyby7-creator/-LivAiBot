/**
 * @file packages/feature-auth/src/effects/login/login-store-updater.ts
 * ============================================================================
 * 🔐 FEATURE-AUTH — Login Store Updater
 * ============================================================================
 *
 * Назначение файла:
 * - Единственная точка применения результата login-flow к auth/session/security состояниям стора
 * - Явный мост между:
 *   - финальным security-решением (`SecurityPipelineResult`) из security-pipeline
 *   - доменным результатом логина (`DomainLoginResult`) из оркестратора login-flow
 *   - уже обогащёнными login-метаданными (`LoginMetadata[]`), которые просто прокидываются дальше (audit/telemetry)
 *
 * Гарантии уровня файла:
 * - ❌ Не пересчитывает риск и не выполняет rule-engine (использует готовый `SecurityPipelineResult`)
 * - ❌ Не читает текущее состояние store и не принимает решений (decision уже принят выше по пайплайну)
 * - ❌ Не вводит fallback-значения (`id: ''` и подобные заглушки запрещены)
 * - ✅ Обновляет только через порт `LoginStorePort` (никаких прямых обращений к конкретной реализации стора)
 * - ✅ Для ветки success `DomainLoginResult` гарантирует наличие и `tokenPair`, и `me` (нет partial состояний)
 * - ✅ Обновление auth/session/security выполняется как одна логическая транзакция на уровне вызовов портов
 */

import type { LoginStorePort } from './login-effect.types.js';
import type { LoginMetadata } from './login-metadata.enricher.js';
import type { DomainLoginResult } from '../../domain/LoginResult.js';
import type { SecurityPipelineResult } from '../../lib/security-pipeline.js';
import type { RiskAssessmentResult } from '../../types/auth-risk.js';
import type { SessionState } from '../../types/auth.js';

/* ============================================================================
 * 🔧 INTERNAL HELPERS
 * ========================================================================== */

/**
 * Выводит список требуемых действий (`requiredActions`) на основе решения rule-engine.
 *
 * @param decisionHint - агрегированное решение по действию из `RiskAssessmentResult`
 * @returns Массив строк с требуемыми действиями для `SecurityState.requiredActions`
 */
function deriveRequiredActions(
  decisionHint: RiskAssessmentResult['decisionHint'],
): readonly string[] {
  switch (decisionHint.action) {
    case 'login':
      return [];
    case 'mfa':
      return ['mfa'];
    case 'block':
      return ['block'];
    default: {
      const _exhaustive: never = decisionHint.action;
      throw new Error(
        `[login-store-updater] Unsupported decisionHint.action: ${String(_exhaustive)}`,
      );
    }
  }
}

/**
 * Применяет success-результат логина к auth/session/security состоянию.
 *
 * Инварианты:
 * - `DomainLoginResult.success` содержит валидированные `tokenPair` и `me`
 * - `SecurityPipelineResult` уже прошёл через rule-engine и содержит финальную оценку риска
 * - Проверяет согласованность дат сессии (`issuedAt <= expiresAt`) и падает fail-closed при нарушении
 *
 * @param store - порт стора аутентификации
 * @param securityResult - результат security-pipeline c оценкой риска и device-информацией
 * @param result - доменный результат логина в ветке `type: 'success'`
 */
function applySuccessState(
  store: LoginStorePort,
  securityResult: SecurityPipelineResult,
  result: Extract<DomainLoginResult, { readonly type: 'success'; }>,
): void {
  const { tokenPair, me } = result;

  // AuthState: authenticated
  const newAuthState = {
    status: 'authenticated' as const,
    user: me.user,
    ...(me.session !== undefined ? { session: me.session } : {}),
    roles: me.roles,
    permissions: new Set(me.permissions),
    ...(me.features !== undefined ? { features: me.features } : {}),
    ...(me.context !== undefined ? { context: me.context } : {}),
  };

  // SessionState: active
  const newSessionState = me.session
    ? ((): SessionState => {
      const issuedAt = me.session.issuedAt ?? tokenPair.issuedAt ?? tokenPair.expiresAt;
      const expiresAt = me.session.expiresAt ?? tokenPair.expiresAt;

      if (issuedAt > expiresAt) {
        throw new Error(
          `[login-store-updater] Invariant violated: issuedAt (${issuedAt}) > expiresAt (${expiresAt})`,
        );
      }
      return {
        status: 'active' as const,
        sessionId: me.session.sessionId,
        device: securityResult.deviceInfo,
        issuedAt,
        expiresAt,
      };
    })()
    : null;

  // SecurityState: risk_detected/secure в зависимости от riskAssessment
  const { riskAssessment } = securityResult;
  const newSecurityState = riskAssessment.riskLevel === 'low'
    ? {
      status: 'secure' as const,
      riskScore: riskAssessment.riskScore,
    }
    : {
      status: 'risk_detected' as const,
      riskLevel: riskAssessment.riskLevel,
      riskScore: riskAssessment.riskScore,
      riskAssessment: riskAssessment.assessment.result,
      requiredActions: deriveRequiredActions(riskAssessment.decisionHint),
    };

  store.setAuthState(newAuthState);
  store.setSessionState(newSessionState);
  store.setSecurityState(newSecurityState);
  store.applyEventType('user_logged_in');
}

/**
 * Применяет результат `mfa_required` к auth/security состоянию.
 *
 * Инварианты:
 * - Пользователь переводится в состояние `pending_secondary_verification` без активной сессии
 * - Security-состояние отражает риск и список требуемых действий из rule-engine (через `decisionHint`)
 *
 * @param store - порт стора аутентификации
 * @param securityResult - результат security-pipeline c оценкой риска
 * @param result - доменный результат логина в ветке `type: 'mfa_required'`
 */
function applyMfaState(
  store: LoginStorePort,
  securityResult: SecurityPipelineResult,
  result: Extract<DomainLoginResult, { readonly type: 'mfa_required'; }>,
): void {
  // На данный момент login-flow ещё не завершён успешным login, пользователь в pending state.
  const newAuthState = {
    status: 'pending_secondary_verification' as const,
    userId: result.challenge.userId,
    verificationType: 'mfa' as const,
  };

  const newSecurityState = {
    status: 'risk_detected' as const,
    riskLevel: securityResult.riskAssessment.riskLevel,
    riskScore: securityResult.riskAssessment.riskScore,
    riskAssessment: securityResult.riskAssessment.assessment.result,
    requiredActions: deriveRequiredActions(securityResult.riskAssessment.decisionHint),
  };

  store.setAuthState(newAuthState);
  store.setSessionState(null);
  store.setSecurityState(newSecurityState);
  store.applyEventType('mfa_challenge_sent');
}

/**
 * Применяет результат блокировки логина к auth/security состоянию.
 *
 * @remarks
 * Сейчас `DomainLoginResult` не содержит явной ветки `blocked`, поэтому helper ориентирован
 * на `SecurityPipelineResult` и может вызываться из login-security-policy или других эффектов.
 *
 * Инварианты:
 * - AuthState переводится в `unauthenticated` без сессии
 * - SecurityState переводится в `blocked` c причиной из `decisionHint.blockReason` (или дефолтной)
 *
 * @param store - порт стора аутентификации
 * @param securityResult - результат security-pipeline с решением `action: 'block'`
 */
export function applyBlockedState(
  store: LoginStorePort,
  securityResult: SecurityPipelineResult,
): void {
  const reason = securityResult.riskAssessment.decisionHint.blockReason
    ?? 'blocked_by_security_policy';

  const newSecurityState = {
    status: 'blocked' as const,
    reason,
  };

  store.setAuthState({ status: 'unauthenticated' });
  store.setSessionState(null);
  store.setSecurityState(newSecurityState);
  // Отдельное событие для блокировки не определено, поэтому используем risk_detected для observability
  store.applyEventType('risk_detected');
}

/* ============================================================================
 * 🎯 PUBLIC API
 * ========================================================================== */

/**
 * Обновляет auth/session/security состояние на основе результатов security pipeline и login-flow.
 *
 * Инварианты:
 * - Использует готовые `SecurityPipelineResult` и `DomainLoginResult` — не считает риск заново и не выполняет rule-engine
 * - Не читает текущее состояние store, только применяет новое (pure sink над портом стора)
 * - Не содержит fallback-логики: на вход приходят уже валидированные domain-данные
 *
 * @param store - порт стора аутентификации, через который применяются все изменения
 * @param securityResult - итоговый результат security-pipeline c оценкой риска
 * @param domainResult - доменный результат login-flow (discriminated union)
 * @param metadata - опциональные login-метаданные (trace/device/risk/identifier/timestamp/mfa), прокидываемые дальше
 * @returns Те же `metadata`, которые были переданы на вход (для последующей интеграции с audit/telemetry-слоем)
 */
export function updateLoginState(
  store: LoginStorePort,
  securityResult: SecurityPipelineResult,
  domainResult: DomainLoginResult,
  metadata?: readonly LoginMetadata[],
): readonly LoginMetadata[] | undefined {
  switch (domainResult.type) {
    case 'success': {
      if (store.batchUpdate !== undefined) {
        store.batchUpdate((batchedStore: LoginStorePort) => {
          applySuccessState(batchedStore, securityResult, domainResult);
        });
      } else {
        applySuccessState(store, securityResult, domainResult);
      }
      return metadata;
    }
    case 'mfa_required': {
      if (store.batchUpdate !== undefined) {
        store.batchUpdate((batchedStore: LoginStorePort) => {
          applyMfaState(batchedStore, securityResult, domainResult);
        });
      } else {
        applyMfaState(store, securityResult, domainResult);
      }
      return metadata;
    }
    default: {
      // Exhaustiveness guard для будущих веток DomainLoginResult
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const _exhaustive: never = domainResult as never;
      throw new Error(
        `[login-store-updater] Unsupported DomainLoginResult variant: ${
          JSON.stringify(_exhaustive)
        }`,
      );
    }
  }
}
