/**
 * @file packages/feature-auth/src/stores/auth.ts
 * ============================================================================
 * 🧠 FEATURE-AUTH STORE — ЧИСТОЕ СОСТОЯНИЕ АУТЕНТИФИКАЦИИ (ZUSTAND)
 * ============================================================================
 * Архитектурная роль:
 * - Единственный источник правды для состояния аутентификации в feature-auth
 * - Чистое состояние без side-effects (effects вынесены в effects/)
 * - Микросервисно-нейтральный, vendor-agnostic
 * - SSR-safe, устойчивый к масштабированию
 * Принцип: store = state + sync transitions, без domain orchestration/effects
 * Гарантии:
 * - ❌ Нет async / side-effects
 * - ❌ Нет бизнес-логики
 * - ❌ Нет токенов (токены в httpOnly cookies или secure memory, не в store)
 * - ✅ Чёткие контракты типов
 * - ✅ Инфраструктура вынесена за пределы store
 * - ✅ Полная иммутабельность через readonly типы
 * - ✅ Versioning для миграций
 * - ✅ Persistence с безопасным merge и семантической валидацией
 * - ✅ Store хранит только: sessionId, expiresAt, status (без токенов)
 * Ключевые возможности:
 * - 🔒 Atomic transactions: actions.transaction() для атомарных обновлений (защита от race conditions)
 * - 🎯 Invariant rule engine: декларативная система правил с приоритетами (масштабируемо)
 * - 🔐 Security-first: токены не хранятся в store, только sessionId/expiresAt/status
 * - ⚡ Performance: permissions как ReadonlySet для constant-time lookup
 * - 🔌 Extensible: поддержка расширений через AuthStoreExtensions (SSO, device trust и т.д.)
 * - 💾 Safe persistence: валидация persisted state перед merge, Set ↔ array сериализация
 * - 🛡️ Deep clone: structuredClone в transaction для runtime безопасности
 * Использование:
 * - Effects (login.ts, logout.ts, refresh.ts) обновляют store через actions
 * - Hooks (useAuth.ts) инкапсулируют store + effects для React
 * - UI компоненты используют hooks, не store напрямую
 * - Store создаётся через factory (createAuthStore) для тестирования и SSR
 * @warning Store = чистое состояние + синхронные transitions. НЕ добавляйте side-effects,
 * бизнес-логику, async операции или доменные модели. См. @contract в конце файла.
 */

import type { ReadonlyDeep } from 'type-fest';
import type { StoreApi, UseBoundStore } from 'zustand';
import { create } from 'zustand';
import type { PersistOptions } from 'zustand/middleware';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';

import type {
  AuthEvent,
  AuthState,
  MfaState,
  OAuthState,
  PasswordRecoveryState,
  SecurityState,
  SessionState,
  VerificationState,
} from '../types/auth.js';

/* ============================================================================
 * 🧩 ТИПЫ СОСТОЯНИЯ
 * ============================================================================
 */

/** Версия store для миграций persistence */
export const authStoreVersion = 1 as const;

/** Расширяемые подсистемы store (enterprise SSO, device trust, behavioral biometrics и т.д.) */
export type AuthStoreExtensions = Readonly<Record<string, unknown>>;

/** Генерирует имя store для persistence с поддержкой подсистем. */
function getStoreName(
  subsystem: string = 'main', // опциональное имя подсистемы (например, 'oauth', 'sso', 'main')
): string { // имя store для localStorage
  return `@livai/feature-auth/store:${subsystem}`;
}

/** Имя store для основной auth подсистемы */
const STORE_NAME = getStoreName('main');

/** Чистое состояние auth store (без методов). Все поля readonly для гарантии иммутабельности. */
export type AuthStoreState = Readonly<{
  /** Версия store для миграций */
  readonly version: number;

  /** Основное состояние аутентификации */
  readonly auth: AuthState;

  /** Состояние MFA (Multi-Factor Authentication) */
  readonly mfa: MfaState;

  /** Состояние OAuth аутентификации */
  readonly oauth: OAuthState;

  /** Состояние безопасности (risk assessment, blocking) */
  readonly security: SecurityState;

  /** Состояние сессии (active/expired/revoked) */
  readonly session: SessionState | null;

  /** Состояние восстановления пароля */
  readonly passwordRecovery: PasswordRecoveryState;

  /** Состояние верификации (email/phone) */
  readonly verification: VerificationState;

  /** Легкий runtime-маркер последнего события (без полного journal) */
  readonly lastEventType?: AuthEvent['type'];

  /** Расширяемые подсистемы (enterprise SSO, device trust, behavioral biometrics и т.д.) */
  readonly extensions?: AuthStoreExtensions;
}>;

/**
 * Тип для полей, которые можно обновлять через patch.
 * Автоматически исключает runtime-only поля (version, lastEventType).
 */
export type PatchableAuthStoreState = Omit<AuthStoreState, 'version' | 'lastEventType'>;

/** Конфигурация для создания auth store с расширениями */
export type CreateAuthStoreConfig = Readonly<{
  /** Расширяемые подсистемы (enterprise SSO, device trust, behavioral biometrics и т.д.) */
  readonly extensions?: AuthStoreExtensions;
}>;

/* ============================================================================
 * 🎛️ ACTIONS
 * ============================================================================
 */

/**
 * Синхронные действия над состоянием. Не содержат side-effects.
 * Все actions принимают полные объекты состояния для discriminated unions.
 */
export type AuthStoreActions = Readonly<{
  /** Устанавливает основное состояние аутентификации (полное состояние AuthState, discriminated union, readonly). */
  readonly setAuthState: (authState: Readonly<AuthState>) => void;

  /** Устанавливает состояние MFA (полное состояние MfaState, discriminated union, readonly). */
  readonly setMfaState: (mfaState: Readonly<MfaState>) => void;

  /** Устанавливает состояние OAuth (полное состояние OAuthState, discriminated union, readonly). */
  readonly setOAuthState: (oauthState: Readonly<OAuthState>) => void;

  /** Устанавливает состояние безопасности (полное состояние SecurityState, discriminated union, readonly). */
  readonly setSecurityState: (securityState: Readonly<SecurityState>) => void;

  /** Устанавливает состояние сессии (SessionState или null, readonly). */
  readonly setSessionState: (sessionState: Readonly<SessionState | null>) => void;

  /** Устанавливает состояние восстановления пароля (полное состояние PasswordRecoveryState, discriminated union, readonly). */
  readonly setPasswordRecoveryState: (
    passwordRecoveryState: Readonly<PasswordRecoveryState>,
  ) => void;

  /** Устанавливает состояние верификации (полное состояние VerificationState, discriminated union, readonly). */
  readonly setVerificationState: (verificationState: Readonly<VerificationState>) => void;

  /**
   * Минимальный event-entrypoint (без replay/journal внутри store).
   * Устанавливает тип последнего события для легкого отслеживания.
   */
  readonly applyEventType: (
    eventType: Readonly<AuthEvent['type']>, // тип события AuthEvent (readonly)
  ) => void;

  /**
   * Атомарное обновление нескольких полей состояния.
   * @warning Discriminated unions (auth, mfa, oauth, security, session, passwordRecovery, verification) должны обновляться полностью, не частично. TypeScript требует все обязательные поля для выбранного status. Для обновления unions используйте set* методы (setAuthState, setMfaState и т.д.).
   */
  readonly patch: (
    next: ReadonlyDeep<Partial<PatchableAuthStoreState>>, // частичное обновление состояния (readonly для гарантии иммутабельности)
  ) => void;

  /** Атомарная транзакция для обновления нескольких полей состояния одновременно. */
  readonly transaction: (
    updater: (state: AuthStoreState) => void, // функция, которая мутирует состояние
  ) => void;

  /** Сбрасывает состояние к начальным значениям. Используется при logout и очистке состояния. */
  readonly reset: () => void;
}>;

/* ============================================================================
 * 🧱 ПОЛНЫЙ КОНТРАКТ STORE
 * ============================================================================
 */

/** Полный контракт auth store. Сочетает состояние и actions в единый интерфейс. */
export type AuthStore = AuthStoreState & {
  readonly actions: AuthStoreActions;
};

/* ============================================================================
 * 🏗️ НАЧАЛЬНОЕ СОСТОЯНИЕ
 * ============================================================================
 */

/** Создаёт начальное состояние auth store. Все состояния в "idle" или "unauthenticated" статусе. */
export function createInitialAuthStoreState(
  extensions?: AuthStoreExtensions,
): AuthStoreState {
  return {
    version: authStoreVersion,
    auth: { status: 'unauthenticated' },
    mfa: { status: 'not_setup' },
    oauth: { status: 'idle' },
    security: { status: 'secure' },
    session: null,
    passwordRecovery: { status: 'idle' },
    verification: { status: 'idle' },
    ...(extensions !== undefined && Object.keys(extensions).length > 0 ? { extensions } : {}),
  };
}

/* ============================================================================
 * ✅ INVARIANT RULE ENGINE
 * ============================================================================
 */

/**
 * Тип для обновления состояния правилом инварианта.
 * Требует полные union объекты для discriminated unions (auth, mfa, oauth, security, session, passwordRecovery, verification),
 * чтобы предотвратить потерю полей при shallow merge.
 */
type InvariantStateUpdate = Readonly<{
  version?: number;
  auth?: ReadonlyDeep<AuthState>; // Полный union объект
  mfa?: ReadonlyDeep<MfaState>; // Полный union объект
  oauth?: ReadonlyDeep<OAuthState>; // Полный union объект
  security?: ReadonlyDeep<SecurityState>; // Полный union объект
  session?: ReadonlyDeep<SessionState | null>; // Полный union объект или null
  passwordRecovery?: ReadonlyDeep<PasswordRecoveryState>; // Полный union объект
  verification?: ReadonlyDeep<VerificationState>; // Полный union объект
  lastEventType?: AuthEvent['type'];
  extensions?: AuthStoreExtensions;
}>;

/** Функция применения правила инварианта. */
export type InvariantRuleApply = (
  state: ReadonlyDeep<AuthStoreState>,
) => InvariantStateUpdate | null;

/**
 * Правило инварианта для декларативного rule-engine.
 * Применяется с приоритетом до стабильности состояния.
 */
export type InvariantRule = Readonly<
  & {
    /** Приоритет правила (меньше = выше приоритет) */
    readonly priority: number;
  }
  & {
    /** Функция применения правила. Возвращает частичное обновление состояния или null. */
    readonly apply: InvariantRuleApply;
  }
>;

/** Применяет правило и возвращает обновлённое состояние. */
function applyRule(
  state: ReadonlyDeep<AuthStoreState>, // текущее состояние
  rule: InvariantRule, // правило для применения
): ReadonlyDeep<AuthStoreState> { // обновлённое состояние
  const update = rule.apply(state);
  // Защита от edge-case: если правило вернуло пустой объект, не создаём новый state
  if (update === null || Object.keys(update).length === 0) {
    return state;
  }
  return { ...state, ...update };
}

/** Проверяет и обрабатывает обнаружение цикла в правилах */
function handleInvariantLoop(
  iterations: number,
  maxIterations: number,
  hasChanges: boolean,
  currentState: ReadonlyDeep<AuthStoreState>,
): void {
  if (iterations !== maxIterations || !hasChanges) {
    return;
  }

  const nodeEnv = process.env['NODE_ENV'];
  const isProduction = nodeEnv === 'production';
  if (!isProduction) {
    throw new Error(
      `Invariant loop detected: rules did not stabilize after ${maxIterations} iterations. This indicates conflicting invariant rules. Current state: auth=${currentState.auth.status}, session=${
        currentState.session?.status ?? 'null'
      }, mfa=${currentState.mfa.status}, oauth=${currentState.oauth.status}, security=${currentState.security.status}`,
    );
  }
  // В production логируем предупреждение, но не прерываем выполнение
  // eslint-disable-next-line no-console -- Production warning для диагностики
  console.warn(
    `[AuthStore] Invariant rules did not stabilize after ${maxIterations} iterations. State may be inconsistent.`,
  );
}

/**
 * Применяет правила до стабильности (пока есть изменения).
 * Правила сортируются по приоритету (меньше = выше приоритет).
 */
function applyRulesUntilStable(
  state: ReadonlyDeep<AuthStoreState>, // начальное состояние
  rules: readonly InvariantRule[], // правила для применения
): ReadonlyDeep<AuthStoreState> { // стабильное состояние
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
  let currentState = state;
  let hasChanges = true;
  const maxIterations = 20; // Защита от бесконечного цикла (увеличено для сложных состояний)
  let iterations = 0;

  while (hasChanges && iterations < maxIterations) {
    hasChanges = false;
    iterations += 1;

    for (const rule of sortedRules) {
      const nextState = applyRule(currentState, rule);
      if (nextState !== currentState) {
        currentState = nextState;
        hasChanges = true;
      }
    }
  }

  handleInvariantLoop(iterations, maxIterations, hasChanges, currentState);

  return currentState;
}

/** Правило 1: Session должен быть null, если auth не authenticated */
function createSessionRule(): InvariantRule {
  return {
    priority: 20,
    apply: (state): InvariantStateUpdate | null => {
      // Не применяем правило, если auth в error (обработано security rule с более высоким приоритетом)
      if (state.auth.status === 'error') {
        return null;
      }
      const fixedSession = state.auth.status !== 'authenticated' && state.session !== null
        ? null
        : state.session;
      return fixedSession !== state.session ? { session: fixedSession } : null;
    },
  };
}

/** Правило 2: Authenticated состояние должно иметь active session */
function createAuthForSessionRule(): InvariantRule {
  return {
    priority: 30,
    apply: (state): InvariantStateUpdate | null => {
      // Не применяем правило, если auth уже в error (обработано security rule с более высоким приоритетом)
      if (state.auth.status === 'error' || state.auth.status === 'unauthenticated') {
        return null;
      }
      if (state.auth.status === 'authenticated' && state.session?.status !== 'active') {
        const userId = state.auth.user.id;
        return {
          auth: {
            status: 'session_expired' as const,
            ...(userId ? { userId } : {}),
            error: {
              kind: 'session_expired' as const,
              message: 'Сессия отсутствует или истекла.',
            },
          } as ReadonlyDeep<AuthState>,
        };
      }
      return null;
    },
  };
}

/** Правило 3: Security blocked должен сбрасывать auth и session */
function createSecurityRule(): InvariantRule {
  return {
    priority: 10,
    apply: (state): InvariantStateUpdate | null => {
      if (
        state.security.status === 'blocked'
        && state.auth.status !== 'unauthenticated'
        && state.auth.status !== 'error'
      ) {
        return {
          auth: {
            status: 'error' as const,
            error: {
              kind: 'account_locked' as const,
              message: state.security.reason || 'Аккаунт заблокирован.',
            },
          } as ReadonlyDeep<AuthState>,
          session: null,
        };
      }
      return null;
    },
  };
}

/**
 * Правило 4: MFA transient состояния сбрасываются при authenticated/error.
 * Transient (challenged, verified, failed) — только во время аутентификации.
 */
function createMfaRule(): InvariantRule {
  return {
    priority: 40,
    apply: (state): InvariantStateUpdate | null => {
      // Если auth в error, сбрасываем MFA в not_setup (но только если не уже not_setup)
      if (state.auth.status === 'error' && state.mfa.status !== 'not_setup') {
        return { mfa: { status: 'not_setup' as const } as ReadonlyDeep<MfaState> };
      }
      const isMfaTransient = state.mfa.status === 'challenged'
        || state.mfa.status === 'verified'
        || state.mfa.status === 'failed';
      const shouldResetTransient = state.auth.status === 'authenticated' && isMfaTransient;
      const shouldBeNotSetup = state.auth.status === 'unauthenticated'
        && state.mfa.status !== 'not_setup';

      if (shouldResetTransient || shouldBeNotSetup) {
        return { mfa: { status: 'not_setup' as const } as ReadonlyDeep<MfaState> };
      }
      return null;
    },
  };
}

/** Правило 5: OAuth должен быть idle при authenticated/unauthenticated, не активен вне OAuth flow */
function createOAuthRule(): InvariantRule {
  return {
    priority: 50,
    apply: (state): InvariantStateUpdate | null => {
      // Если auth в error, сбрасываем OAuth в idle
      if (state.auth.status === 'error' && state.oauth.status !== 'idle') {
        return { oauth: { status: 'idle' as const } as ReadonlyDeep<OAuthState> };
      }
      const isOAuthActive = state.oauth.status === 'initiating'
        || state.oauth.status === 'redirecting'
        || state.oauth.status === 'processing';
      const isOAuthFlow = state.auth.status === 'authenticating'
        && state.auth.operation === 'oauth';
      const shouldBeIdle =
        (state.auth.status === 'authenticated' || state.auth.status === 'unauthenticated')
        && isOAuthActive
        && !isOAuthFlow;

      if (shouldBeIdle) {
        return { oauth: { status: 'idle' as const } as ReadonlyDeep<OAuthState> };
      }
      return null;
    },
  };
}

/** Правило 6: PasswordRecovery должен быть idle при authenticated */
function createPasswordRecoveryRule(): InvariantRule {
  return {
    priority: 60,
    apply: (state): InvariantStateUpdate | null => {
      // Если auth в error или authenticated, сбрасываем PasswordRecovery в idle
      if (
        (state.auth.status === 'authenticated' || state.auth.status === 'error')
        && state.passwordRecovery.status !== 'idle'
      ) {
        return {
          passwordRecovery: { status: 'idle' as const } as ReadonlyDeep<PasswordRecoveryState>,
        };
      }
      return null;
    },
  };
}

/** Правило 7: Verification должен быть idle при authenticated/unauthenticated */
function createVerificationRule(): InvariantRule {
  return {
    priority: 70,
    apply: (state): InvariantStateUpdate | null => {
      // Если auth в error, authenticated или unauthenticated, сбрасываем Verification в idle
      const shouldBeIdle = (state.auth.status === 'authenticated'
        || state.auth.status === 'unauthenticated'
        || state.auth.status === 'error')
        && state.verification.status !== 'idle';

      if (shouldBeIdle) {
        return { verification: { status: 'idle' as const } as ReadonlyDeep<VerificationState> };
      }
      return null;
    },
  };
}

/**
 * Registry всех правил инвариантов.
 * Правила применяются по приоритету (меньше = выше приоритет) до стабильности состояния.
 */
function createInvariantRulesRegistry(): readonly InvariantRule[] {
  return [
    createSecurityRule(), // priority: 10 - максимальный приоритет
    createSessionRule(), // priority: 20
    createAuthForSessionRule(), // priority: 30
    createMfaRule(), // priority: 40
    createOAuthRule(), // priority: 50
    createPasswordRecoveryRule(), // priority: 60
    createVerificationRule(), // priority: 70
  ];
}

/**
 * Применяет все правила инвариантов до стабильности состояния.
 * Правила сортируются по приоритету и применяются итеративно, пока есть изменения.
 */
export function enforceInvariants(
  state: ReadonlyDeep<AuthStoreState>, // текущее состояние
): ReadonlyDeep<AuthStoreState> { // исправленное состояние или исходное, если инварианты соблюдены
  const rules = createInvariantRulesRegistry();
  return applyRulesUntilStable(state, rules);
}

/* ============================================================================
 * 🏪 STORE FACTORY
 * ============================================================================
 */

/**
 * Тип для persisted state (без runtime полей).
 * permissions сериализуется как массив (Set не сериализуется в JSON).
 * @internal Экспортировано для тестирования
 */
export type PersistedAuthStoreState = Readonly<
  Pick<
    AuthStoreState,
    | 'version'
    | 'mfa'
    | 'oauth'
    | 'security'
    | 'session'
    | 'passwordRecovery'
    | 'verification'
    | 'extensions'
  > & {
    readonly auth: Readonly<
      | (Omit<Extract<AuthState, { readonly status: 'authenticated'; }>, 'permissions'> & {
        readonly permissions?: readonly string[]; // Set сериализуется как массив
      })
      | Exclude<AuthState, { readonly status: 'authenticated'; }>
    >;
  }
>;

/** Создаёт валидные статусы для быстрой проверки перед merge (изоляция context) */
function createValidStatuses(): {
  readonly auth: ReadonlySet<string>;
  readonly mfa: ReadonlySet<string>;
  readonly oauth: ReadonlySet<string>;
  readonly security: ReadonlySet<string>;
  readonly session: ReadonlySet<string>;
  readonly passwordRecovery: ReadonlySet<string>;
  readonly verification: ReadonlySet<string>;
} {
  return {
    auth: Object.freeze(
      new Set([
        'unauthenticated',
        'authenticating',
        'authenticated',
        'pending_secondary_verification',
        'session_expired',
        'error',
      ]),
    ),
    mfa: Object.freeze(
      new Set(['not_setup', 'setup_in_progress', 'setup_complete', 'challenged', 'verified']),
    ),
    oauth: Object.freeze(new Set(['idle', 'initiating', 'processing', 'error'])),
    security: Object.freeze(new Set(['secure', 'risk_detected', 'blocked', 'review_required'])),
    session: Object.freeze(new Set(['active', 'expired', 'revoked', 'suspended'])),
    passwordRecovery: Object.freeze(
      new Set(['idle', 'requested', 'verifying', 'completed', 'error']),
    ),
    verification: Object.freeze(
      new Set(['idle', 'sent', 'verifying', 'verified', 'expired', 'error']),
    ),
  } as const;
}

/** Проверяет семантическую валидность AuthState */
export function validateAuthSemantics(obj: Record<string, unknown>): boolean {
  const status = obj['status'];
  if (status === 'authenticated') {
    const hasUser = obj['user'] !== null && typeof obj['user'] === 'object';
    // permissions может быть Set (runtime) или массив (persisted), оба валидны
    const hasValidPermissions = obj['permissions'] === undefined
      || obj['permissions'] instanceof Set
      || Array.isArray(obj['permissions']);
    return hasUser && hasValidPermissions;
  }
  if (status === 'pending_secondary_verification') {
    return typeof obj['userId'] === 'string';
  }
  if (status === 'error') {
    return obj['error'] !== null && typeof obj['error'] === 'object';
  }
  return true;
}

/** Проверяет семантическую валидность SessionState */
export function validateSessionSemantics(obj: Record<string, unknown>): boolean {
  const status = obj['status'];
  if (status === 'active') {
    return typeof obj['sessionId'] === 'string'
      && typeof obj['expiresAt'] === 'string'
      && typeof obj['issuedAt'] === 'string';
  }
  if (status === 'expired' || status === 'revoked' || status === 'suspended') {
    return typeof obj['sessionId'] === 'string';
  }
  return true;
}

/** Проверяет семантическую валидность SecurityState */
export function validateSecuritySemantics(obj: Record<string, unknown>): boolean {
  const status = obj['status'];
  if (status === 'risk_detected') {
    return typeof obj['riskLevel'] === 'string' && typeof obj['riskScore'] === 'number';
  }
  if (status === 'blocked') {
    return typeof obj['reason'] === 'string';
  }
  return true;
}

/** Восстанавливает AuthState из persisted state: array → Set для permissions */
export function restoreAuthFromPersisted(
  persistedAuth: PersistedAuthStoreState['auth'],
): AuthState | undefined {
  if (persistedAuth.status === 'authenticated' && Array.isArray(persistedAuth.permissions)) {
    return {
      ...persistedAuth,
      permissions: new Set(persistedAuth.permissions),
    } as AuthState;
  }
  return persistedAuth as AuthState | undefined;
}

/**
 * Валидирует persisted state перед merge для защиты от localStorage corruption.
 * Проверяет структуру, статусы и семантическую валидность discriminated unions.
 * @internal Экспортировано для тестирования
 */
export function validatePersistedState(persisted: unknown): persisted is PersistedAuthStoreState {
  if (persisted === null || typeof persisted !== 'object') {
    return false;
  }

  const s = persisted as Record<string, unknown>;
  if (s['version'] !== authStoreVersion) {
    return false;
  }

  const validStatuses = createValidStatuses();
  const checkStatus = (obj: unknown, statusSet: ReadonlySet<string>): boolean =>
    obj !== null
    && typeof obj === 'object'
    && typeof (obj as Record<string, unknown>)['status'] === 'string'
    && statusSet.has((obj as Record<string, unknown>)['status'] as string);

  const checkWithSemantics = (
    obj: unknown,
    statusSet: ReadonlySet<string>,
    validator?: (obj: Record<string, unknown>) => boolean,
  ): boolean => {
    if (!checkStatus(obj, statusSet)) {
      return false;
    }
    return validator === undefined || validator(obj as Record<string, unknown>);
  };

  return checkWithSemantics(s['auth'], validStatuses.auth, validateAuthSemantics)
    && checkStatus(s['mfa'], validStatuses.mfa)
    && checkStatus(s['oauth'], validStatuses.oauth)
    && checkWithSemantics(s['security'], validStatuses.security, validateSecuritySemantics)
    && (s['session'] === null
      || checkWithSemantics(s['session'], validStatuses.session, validateSessionSemantics))
    && checkStatus(s['passwordRecovery'], validStatuses.passwordRecovery)
    && checkStatus(s['verification'], validStatuses.verification)
    && (s['extensions'] === undefined
      || (s['extensions'] !== null && typeof s['extensions'] === 'object'));
}

/** Создаёт Zustand store для состояния аутентификации. */
export function createAuthStore(
  config?: CreateAuthStoreConfig, // опциональная конфигурация с расширениями
): UseBoundStore<StoreApi<AuthStore>> {
  const initialExtensions = config?.extensions;
  return create<AuthStore>()(
    persist(
      subscribeWithSelector((set) => ({
        ...createInitialAuthStoreState(initialExtensions),

        actions: {
          // Zustand set() возвращает значение, которое не используется - это известная особенность API Zustand
          setAuthState: (next: ReadonlyDeep<AuthState>): void => {
            set((state: ReadonlyDeep<AuthStore>) => enforceInvariants({ ...state, auth: next }));
          },

          setMfaState: (next: Readonly<MfaState>): void => {
            set((state: ReadonlyDeep<AuthStore>) => enforceInvariants({ ...state, mfa: next }));
          },

          setOAuthState: (next: Readonly<OAuthState>): void => {
            set((state: ReadonlyDeep<AuthStore>) => enforceInvariants({ ...state, oauth: next }));
          },

          setSecurityState: (next: Readonly<SecurityState>): void => {
            set((state: ReadonlyDeep<AuthStore>) =>
              enforceInvariants({ ...state, security: next })
            );
          },

          setSessionState: (next: ReadonlyDeep<SessionState | null>): void => {
            set((state: ReadonlyDeep<AuthStore>) => enforceInvariants({ ...state, session: next }));
          },

          setPasswordRecoveryState: (next: Readonly<PasswordRecoveryState>): void => {
            set((state: ReadonlyDeep<AuthStore>) =>
              enforceInvariants({ ...state, passwordRecovery: next })
            );
          },

          setVerificationState: (next: Readonly<VerificationState>): void => {
            set((state: ReadonlyDeep<AuthStore>) =>
              enforceInvariants({ ...state, verification: next })
            );
          },

          applyEventType: (eventType: Readonly<AuthEvent['type']>): void => {
            set({ lastEventType: eventType });
          },

          patch: (next: ReadonlyDeep<Partial<PatchableAuthStoreState>>): void => {
            set((state: ReadonlyDeep<AuthStore>) => enforceInvariants({ ...state, ...next }));
            return undefined;
          },

          transaction: (updater: (state: AuthStoreState) => void): void => {
            set((state: ReadonlyDeep<AuthStore>) => {
              // Создаём deep clone состояния для транзакции (защита от мутации исходного state)
              // structuredClone создаёт полную копию всех вложенных объектов
              const draft = structuredClone({
                version: state.version,
                auth: state.auth,
                mfa: state.mfa,
                oauth: state.oauth,
                security: state.security,
                session: state.session,
                passwordRecovery: state.passwordRecovery,
                verification: state.verification,
                ...(state.lastEventType !== undefined
                  ? { lastEventType: state.lastEventType }
                  : {}),
                ...(state.extensions !== undefined ? { extensions: state.extensions } : {}),
              }) as AuthStoreState;

              // Применяем мутации через updater (теперь безопасно - мутируем только копию)
              updater(draft);

              // Применяем invariants к финальному состоянию
              const fixedState = enforceInvariants(draft);

              // Возвращаем AuthStore с сохранением actions (actions не изменяются в транзакции)
              return {
                ...fixedState,
                actions: state.actions,
              };
            });
            return undefined;
          },

          reset: (): void => {
            set(createInitialAuthStoreState(initialExtensions));
            return undefined;
          },
        },
      })),
      {
        name: STORE_NAME,
        version: authStoreVersion,
        // SSR-safe: используем localStorage только на клиенте (typeof window !== 'undefined')
        // На сервере создаем noop storage для безопасной работы persist middleware
        storage: createJSONStorage(() =>
          typeof window !== 'undefined'
            ? localStorage
            : {
              getItem: (): string | null => null,
              setItem: (): void => {},
              removeItem: (): void => {},
            }
        ),
        partialize: (state: Readonly<AuthStoreState>): PersistedAuthStoreState => {
          // Сериализуем permissions Set → array для JSON persistence (только для authenticated)
          const serializedAuth =
            state.auth.status === 'authenticated' && state.auth.permissions instanceof Set
              ? ({
                ...state.auth,
                permissions: Array.from(state.auth.permissions),
              } as
                & Omit<Extract<AuthState, { readonly status: 'authenticated'; }>, 'permissions'>
                & {
                  readonly permissions?: readonly string[];
                })
              : state.auth;

          return {
            // ✅ Персистентные поля (сохраняются в localStorage)
            version: state.version,
            auth: serializedAuth as PersistedAuthStoreState['auth'],
            mfa: state.mfa,
            oauth: state.oauth,
            security: state.security,
            session: state.session,
            passwordRecovery: state.passwordRecovery,
            verification: state.verification,
            ...(state.extensions !== undefined && Object.keys(state.extensions).length > 0
              ? { extensions: state.extensions }
              : {}),
            // ❌ Runtime-only поля НЕ сохраняются:
            // - lastEventType (легкий маркер, не нужен после перезагрузки)
            // - любые будущие debug flags, временные состояния и т.д.
          };
        },
        merge: (persisted: unknown, current: Readonly<AuthStore>): Readonly<AuthStore> => {
          const isValidPersisted = validatePersistedState(persisted) ? persisted : null;

          // Миграция: если версия изменилась, сбрасываем состояние (но сохраняем extensions)
          const persistedState = isValidPersisted === null
            ? null
            : isValidPersisted.version !== authStoreVersion
            ? null
            : isValidPersisted;

          if (persistedState === null) {
            return current;
          }

          // Восстанавливаем permissions: array → Set (только для authenticated)
          const restoredAuth = restoreAuthFromPersisted(persistedState.auth);

          const mergedState = {
            ...current,
            ...persistedState,
            auth: (restoredAuth ?? persistedState.auth) as AuthState,
            // Сохраняем extensions из конфигурации, если они не были в persisted state
            ...(initialExtensions !== undefined && persistedState.extensions === undefined
              ? { extensions: initialExtensions }
              : {}),
            // lastEventType всегда runtime-only (не включаем в merge)
          };

          // Применяем enforceInvariants для защиты от неконсистентного состояния (поврежденный localStorage, старая версия)
          const fixedState = enforceInvariants(mergedState);

          return {
            ...fixedState,
            actions: current.actions,
          };
        },
      } satisfies PersistOptions<AuthStore, PersistedAuthStoreState>,
    ),
  );
}

/* ============================================================================
 * 🎯 СЕЛЕКТОРЫ (чистые функции)
 * ============================================================================
 */

/**
 * Базовые селекторы состояния.
 * Чистые функции для типобезопасного доступа к полям state.
 * Экспортируются отдельно для избежания ошибок @livai/rag/context-leakage.
 */

/** Получить состояние аутентификации */
export function getAuth(store: Readonly<AuthStoreState>): Readonly<AuthState> {
  return store.auth;
}

/** Получить состояние MFA */
export function getMfa(store: Readonly<AuthStoreState>): Readonly<MfaState> {
  return store.mfa;
}

/** Получить состояние OAuth */
export function getOAuth(store: Readonly<AuthStoreState>): Readonly<OAuthState> {
  return store.oauth;
}

/** Получить состояние безопасности */
export function getSecurity(store: Readonly<AuthStoreState>): Readonly<SecurityState> {
  return store.security;
}

/** Получить состояние сессии */
export function getSession(store: Readonly<AuthStoreState>): Readonly<SessionState | null> {
  return store.session;
}

/** Получить состояние восстановления пароля */
export function getPasswordRecovery(
  store: Readonly<AuthStoreState>,
): Readonly<PasswordRecoveryState> {
  return store.passwordRecovery;
}

/** Получить состояние верификации */
export function getVerification(store: Readonly<AuthStoreState>): Readonly<VerificationState> {
  return store.verification;
}

/** Получить actions */
export function getAuthStoreActions(store: Readonly<AuthStore>): Readonly<AuthStoreActions> {
  return store.actions;
}

/**
 * Производные селекторы (derived state).
 * Чистые функции для вычисляемых значений на основе базового состояния.
 * Экспортируются отдельно для избежания ошибок @livai/rag/context-leakage.
 */

/** Пользователь аутентифицирован. */
export function isAuthenticated(store: Readonly<AuthStoreState>): boolean {
  return store.auth.status === 'authenticated';
}

/** Процесс аутентификации в процессе. */
export function isAuthenticating(store: Readonly<AuthStoreState>): boolean {
  return store.auth.status === 'authenticating';
}

/** Есть ошибка аутентификации. */
export function hasAuthError(store: Readonly<AuthStoreState>): boolean {
  return store.auth.status === 'error';
}

/** Требуется вторичная верификация (MFA/email/phone). */
export function needsVerification(store: Readonly<AuthStoreState>): boolean {
  return store.auth.status === 'pending_secondary_verification';
}

/** Сессия истекла, требуется refresh. */
export function isSessionExpired(store: Readonly<AuthStoreState>): boolean {
  return store.auth.status === 'session_expired';
}

/** Можно обновить токен (authenticated или session_expired). */
export function canRefresh(store: Readonly<AuthStoreState>): boolean {
  return store.auth.status === 'authenticated' || store.auth.status === 'session_expired';
}

/** Требуется MFA. */
export function needsMfa(store: Readonly<AuthStoreState>): boolean {
  return (
    store.mfa.status === 'challenged'
    || store.mfa.status === 'recovery_required'
    || store.auth.status === 'pending_secondary_verification'
  );
}

/** Высокий уровень риска безопасности. */
export function isHighRisk(store: Readonly<AuthStoreState>): boolean {
  return (
    store.security.status === 'blocked'
    || (store.security.status === 'risk_detected'
      && (store.security.riskLevel === 'high' || store.security.riskLevel === 'critical'))
  );
}

/** Сессия активна и валидна. */
export function isSessionValid(store: Readonly<AuthStoreState>): boolean {
  return store.session?.status === 'active' && store.auth.status === 'authenticated';
}

/** Пользователь имеет требуемое разрешение. */
export function hasPermission(store: Readonly<AuthStoreState>, permission: string): boolean {
  return (
    store.auth.status === 'authenticated'
    && store.auth.permissions instanceof Set
    && store.auth.permissions.has(permission)
  );
}

/* ============================================================================
 * 📦 GROUPED API
 * ============================================================================
 */

/** Тип для grouped API селекторов. */
type AuthSelectorsGroup = {
  readonly auth: typeof getAuth;
  readonly mfa: typeof getMfa;
  readonly oauth: typeof getOAuth;
  readonly security: typeof getSecurity;
  readonly session: typeof getSession;
  readonly passwordRecovery: typeof getPasswordRecovery;
  readonly verification: typeof getVerification;
  readonly actions: typeof getAuthStoreActions;
  readonly isAuthenticated: typeof isAuthenticated;
  readonly isAuthenticating: typeof isAuthenticating;
  readonly hasAuthError: typeof hasAuthError;
  readonly needsVerification: typeof needsVerification;
  readonly isSessionExpired: typeof isSessionExpired;
  readonly canRefresh: typeof canRefresh;
  readonly needsMfa: typeof needsMfa;
  readonly isHighRisk: typeof isHighRisk;
  readonly isSessionValid: typeof isSessionValid;
  readonly hasPermission: typeof hasPermission;
};

/**
 * Grouped API через функцию-фабрику (runtime object, FP-совместимо).
 * Создаёт объект с группировкой селекторов при вызове, не хранит глобальный контекст.
 * Используется для удобства в UI, когда нужен grouped API.
 */
export function createAuthSelectors(): AuthSelectorsGroup {
  return {
    auth: getAuth,
    mfa: getMfa,
    oauth: getOAuth,
    security: getSecurity,
    session: getSession,
    passwordRecovery: getPasswordRecovery,
    verification: getVerification,
    actions: getAuthStoreActions,

    isAuthenticated,
    isAuthenticating,
    hasAuthError,
    needsVerification,
    isSessionExpired,
    canRefresh,
    needsMfa,
    isHighRisk,
    isSessionValid,
    hasPermission,
  } satisfies AuthSelectorsGroup;
}

/* ============================================================================
 * 🏛️ ARCHITECTURAL CONTRACT — НЕОБХОДИМЫЕ ИНВАРИАНТЫ
 * ============================================================================
 *
 * @contract
 *
 * ЧТО МОЖНО КЛАСТЬ В STORE:
 * - Состояние аутентификации (AuthState, MfaState, OAuthState, etc.)
 * - UI-состояние связанное с auth (но не бизнес-данные)
 * - Синхронные, детерминированные данные
 *
 * RUNTIME-ONLY ПОЛЯ (не сохраняются в persistence):
 * - lastEventType — легкий маркер последнего события для отладки/логирования
 * - любые будущие debug flags, временные состояния, UI-метаданные
 * Эти поля существуют только в памяти и сбрасываются при перезагрузке страницы.
 *
 * ЧТО НЕЛЬЗЯ КЛАСТЬ В STORE:
 * - Бизнес-логика и правила валидации
 * - API-ключи и sensitive данные напрямую (только через типизированные DTO)
 * - Async операции и side-effects (в effects/)
 * - Компьютед свойства (кроме селекторов)
 * - Доменные модели напрямую (только через типизированные состояния)
 * - Event journal (для этого отдельный слой, если нужен)
 *
 * ОБНОВЛЕНИЕ СОСТОЯНИЯ:
 * - Всегда через actions (setAuthState, setMfaState, etc.)
 * - Discriminated unions обновляются полной заменой (нельзя частично обновить)
 * - Zustand автоматически создаёт новые объекты при set({ ... })
 * - Readonly типы гарантируют иммутабельность на уровне TypeScript
 * - Invariant gate автоматически исправляет критичные нарушения
 *
 * PERSISTENCE:
 * - Сохраняются только персистентные поля (без runtime-маркеров)
 * - Миграции через version и merge функцию
 * - Actions никогда не сохраняются (runtime-only)
 */
