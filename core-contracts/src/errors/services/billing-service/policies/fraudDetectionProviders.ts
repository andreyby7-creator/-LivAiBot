/**
 * @file fraudDetectionProviders.ts - Production-ready реализации интерфейсов fraud detection
 *
 * Предоставляет готовые реализации интерфейсов для dependency injection и замены компонентов.
 * Включает встроенные правила мошенничества, external API интеграцию, multi-tenant поддержку.
 *
 * Архитектурные принципы:
 * - Production-ready: готовые реализации с error handling и resilience patterns
 * - Multi-tenant: изоляция данных и конфигураций по tenant
 * - Graceful degradation: устойчивость к внешним сбоям
 * - Effect-based: функциональный подход с обработкой ошибок через Effect
 */

import { Effect, Schedule } from 'effect';

import {
  EXCESSIVE_RETRY_THRESHOLD,
  MIN_PAYMENTS_FOR_HISTORY_ANALYSIS,
  PAYMENT_METHOD_HISTORY_LENGTH,
  RAPID_ATTEMPTS_PERIOD_MINUTES,
  RAPID_ATTEMPTS_THRESHOLD,
  UNUSUAL_AMOUNT_DEVIATION,
  VELOCITY_ATTACK_PERIOD_MINUTES,
  VELOCITY_ATTACK_THRESHOLD,
} from './fraudDetectionPolicy.js';
import { RULE_PRIORITIES } from './fraudDetectionTypes.js';

import type {
  DeviceFingerprintData,
  DeviceFingerprintResult,
  ExternalCallOptions,
  ExternalDataProvider,
  ExternalDataService,
  FraudDetectionError,
  FraudRuleEngine,
  FraudRuleEngineError,
  FraudRuleEngineResult,
  FraudRuleProvider,
  FraudRuleProviderError,
  GeolocationData,
  JsonFraudRule,
  ProviderResult,
  RuleLoader,
  RuleLoadError,
  RuleSource,
  RuleVersionInfo,
  RuleVersionManager,
  RuleVersionManagerError,
  UserContext,
} from './fraudDetectionInterfaces.js';
import type {
  FraudContext,
  FraudDecision,
  FraudPolicyConfig,
  FraudReason,
  FraudRule,
} from './fraudDetectionPolicy.js';

// ==================== CONSTANTS ====================

const DEFAULT_TIMEOUT_MS = 5000;
const HIGH_SUSPICIOUS_CONFIDENCE = 0.8;
const MAX_RETRY_ATTEMPTS = 3;
const LOW_SUSPICIOUS_CONFIDENCE = 0.2;
const MILLISECONDS_PER_MINUTE = 60000;

// ==================== SERVICE TYPES ====================

/** Набор сервисов fraud detection для dependency injection */
export type FraudDetectionServices = {
  readonly ruleProvider: FraudRuleProvider;
  readonly externalDataProvider: ExternalDataProvider;
  readonly ruleEngine: FraudRuleEngine;
  readonly externalDataService: ExternalDataService;
};

// ==================== BUILT-IN FRAUD RULES ====================

/** Встроенные правила обнаружения мошенничества с различными приоритетами */
export const FRAUD_RULES: readonly FraudRule[] = [
  // Приоритет 10: Velocity атака
  {
    id: 'velocity_attack_detection',
    name: 'Velocity Attack Detection',
    condition: (context: FraudContext) =>
      context.userHistory.recentAttempts.filter(
        (a) => a.timestamp > Date.now() - VELOCITY_ATTACK_PERIOD_MINUTES * MILLISECONDS_PER_MINUTE,
      ).length > VELOCITY_ATTACK_THRESHOLD,
    score: 50,
    reason: 'velocity_attack',
    priority: RULE_PRIORITIES.VELOCITY_ATTACK,
    enabled: true,
    version: '1.0.0',
    description: 'Обнаружение скоординированных velocity атак',
  },
  // Приоритет 9: Чрезмерные повторы
  {
    id: 'excessive_retry_detection',
    name: 'Excessive Retry Detection',
    condition: (context: FraudContext) =>
      (context.retryContext?.attemptCount ?? 1) > EXCESSIVE_RETRY_THRESHOLD,
    score: 35,
    reason: 'excessive_retries',
    priority: RULE_PRIORITIES.EXCESSIVE_RETRIES,
    enabled: true,
    version: '1.0.0',
    description: 'Чрезмерные попытки retry',
  },
  // Приоритет 8: Несоответствие геолокации
  {
    id: 'geolocation_mismatch_detection',
    name: 'Geolocation Mismatch Detection',
    condition: (context: FraudContext) =>
      !!context.geolocation
      && context.userHistory.knownGeolocations.length > 0
      && !context.userHistory.knownGeolocations.includes(context.geolocation.country),
    score: 30,
    reason: 'geolocation_mismatch',
    priority: RULE_PRIORITIES.GEOLOCATION_MISMATCH,
    enabled: true,
    version: '1.0.0',
    description: 'Несоответствие геолокации известной истории',
  },
  // Приоритет 7: Аномалия device fingerprint
  {
    id: 'device_fingerprint_detection',
    name: 'Device Fingerprint Detection',
    condition: (context: FraudContext) =>
      !!context.deviceFingerprint
      && context.userHistory.knownDeviceFingerprints.length > 0
      && !context.userHistory.knownDeviceFingerprints.includes(
        context.deviceFingerprint.fingerprintHash ?? 'unknown',
      ),
    score: 25,
    reason: 'device_fingerprint',
    priority: RULE_PRIORITIES.DEVICE_FINGERPRINT,
    enabled: true,
    version: '1.0.0',
    description: 'Подозрительный device fingerprint',
  },
  // Приоритет 6: Необычная сумма платежа
  {
    id: 'unusual_amount_detection',
    name: 'Unusual Amount Detection',
    condition: (context: FraudContext): boolean => {
      const avg = context.userHistory.averageAmount;
      if (!avg) return false;
      const deviation = Math.abs(context.paymentDetails.amount - avg) / avg;
      return deviation > UNUSUAL_AMOUNT_DEVIATION;
    },
    score: 20,
    reason: 'unusual_amount',
    priority: RULE_PRIORITIES.UNUSUAL_AMOUNT,
    enabled: true,
    version: '1.0.0',
    description: 'Сумма платежа отклоняется от среднего',
  },
  // Приоритет 5: Быстрые попытки
  {
    id: 'rapid_attempts_detection',
    name: 'Rapid Attempts Detection',
    condition: (context: FraudContext) =>
      context.userHistory.recentAttempts.filter(
        (a) => a.timestamp > Date.now() - RAPID_ATTEMPTS_PERIOD_MINUTES * MILLISECONDS_PER_MINUTE,
      ).length > RAPID_ATTEMPTS_THRESHOLD,
    score: 15,
    reason: 'rapid_attempts',
    priority: RULE_PRIORITIES.RAPID_ATTEMPTS,
    enabled: true,
    version: '1.0.0',
    description: 'Чрезмерное количество попыток платежа',
  },
  // Приоритет 4: Несоответствие метода оплаты
  {
    id: 'payment_method_mismatch_detection',
    name: 'Payment Method Mismatch Detection',
    condition: (context: FraudContext): boolean => {
      if (context.userHistory.totalPayments < MIN_PAYMENTS_FOR_HISTORY_ANALYSIS) return false;
      const known = new Set(
        [...context.userHistory.recentAttempts].reverse().slice(0, PAYMENT_METHOD_HISTORY_LENGTH)
          .map((a) => a.paymentMethod),
      );
      return !known.has(context.paymentDetails.paymentMethod);
    },
    score: 10,
    reason: 'payment_method_mismatch',
    priority: RULE_PRIORITIES.PAYMENT_METHOD_MISMATCH,
    enabled: true,
    version: '1.0.0',
    description: 'Метод оплаты не соответствует истории',
  },
];

// ==================== FRAUD RULE PROVIDER ====================

/** Реализация FraudRuleProvider с встроенными правилами */
export const defaultFraudRuleProvider: FraudRuleProvider = {
  loadRules: (config: FraudPolicyConfig) =>
    Effect.succeed(FRAUD_RULES.filter((r) => r.enabled && config.rules[r.id]?.enabled !== false)),
};

// ==================== JSON RULE LOADER ====================

/** Загрузчик правил на основе JSON для внешней конфигурации */
export class JsonRuleLoader implements RuleLoader {
  constructor(
    private readonly jsonParser: (jsonRule: JsonFraudRule) => FraudRule = jsonRuleToFraudRule,
  ) {}

  loadRules = (
    config: { source: RuleSource; context?: UserContext; },
  ): ProviderResult<readonly FraudRule[], RuleLoadError> => {
    const { source } = config;
    const parser = this.jsonParser;

    return Effect.gen(function*(_) {
      switch (source._tag) {
        case 'json':
          return yield* _(parseJsonRules(source.rules, parser));

        case 'hardcoded':
          return source.rules;

        case 'mixed':
          const jsonRules = source.jsonRules
            ? yield* _(parseJsonRules(source.jsonRules, parser))
            : [];
          const hardcodedRules = source.hardcodedRules ?? [];
          return [...jsonRules, ...hardcodedRules];

        default:
          const unknownSource = source as { _tag: string; };
          return yield* _(Effect.fail<RuleLoadError>({
            _tag: 'SourceUnavailable',
            message: `Unknown rule source type: ${unknownSource._tag}`,
            source: unknownSource._tag,
          }));
      }
    });
  };
}

/** Экземпляр загрузчика правил JSON по умолчанию */
export const defaultJsonRuleLoader = new JsonRuleLoader();

/** Type guard для FraudDetectionError */
const isFraudError = (u: unknown): u is FraudDetectionError =>
  typeof u === 'object' && u !== null && '_tag' in u;

/** Определяет retryable ошибки (transient/network) vs non-retryable (business/auth) */
const isRetryableError = (error: FraudDetectionError): boolean => {
  switch (error._tag) {
    // 🔥 RETRYABLE: Transient/network ошибки
    case 'NetworkError':
    case 'TimeoutError':
    case 'RateLimitError':
    case 'ServiceUnavailableError':
      return true;

    // ❌ NON-RETRYABLE: Business/auth/validation ошибки
    case 'InvalidInputError':
    case 'ConfigurationError':
    case 'ValidationError':
    default:
      return false;
  }
};

/** Production-ready resilience helper для external API calls */
const withExternalResilience = <T>(
  effect: Effect.Effect<T, FraudDetectionError>,
): Effect.Effect<T | null, never> => {
  // 🔥 Timeout прерывает fiber или кидает TimeoutException как defect/unknown
  // Не добавляет typed error в систему типов Effect
  const withTimeout = effect.pipe(Effect.timeout(DEFAULT_TIMEOUT_MS));

  // 🔥 Production-ready resilience: jitter + selective retry
  // TODO: Добавить экспоненциальную задержку при стабилизации типов Effect
  const retrySchedule = Schedule.recurs(MAX_RETRY_ATTEMPTS)
    .pipe(Schedule.jittered)
    .pipe(Schedule.whileInput((error: unknown) =>
      // ❗ Только retryable ошибки: network/transient, не business/auth
      error instanceof Error && error.name === 'TimeoutException'
        ? true
        : isFraudError(error) && isRetryableError(error)
    ));

  return withTimeout.pipe(
    Effect.retry(retrySchedule),
    Effect.catchAll((error: unknown) =>
      Effect.logWarning('External service degraded - graceful fallback to null', {
        service: 'fraud-detection-external-api',
        operation: 'geolocation-or-fingerprint-check',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }).pipe(Effect.as<T | null>(null))
    ),
  );
};

/** Преобразует JSON правило в FraudRule с оценкой выражения */
function jsonRuleToFraudRule(jsonRule: JsonFraudRule): FraudRule {
  return {
    id: jsonRule.id,
    name: jsonRule.name,
    description: jsonRule.description,
    condition: createConditionFunction(jsonRule.condition),
    score: jsonRule.score,
    reason: jsonRule.reason,
    priority: jsonRule.priority,
    enabled: jsonRule.enabled,
    version: jsonRule.version,
  };
}

/** Разбирает массив JSON правил в массив FraudRule */
function parseJsonRules(
  jsonRules: readonly JsonFraudRule[],
  parser: (jsonRule: JsonFraudRule) => FraudRule,
): ProviderResult<readonly FraudRule[], RuleLoadError> {
  return Effect.gen(function*(_) {
    const parseResult = jsonRules.reduce(
      (acc: { rules: FraudRule[]; error?: RuleLoadError; }, jsonRule) => {
        if (acc.error) return acc;

        try {
          const rule = parser(jsonRule);
          return { rules: [...acc.rules, rule] };
        } catch (error) {
          return {
            rules: [],
            error: {
              _tag: 'ParseError' as const,
              message: error instanceof Error ? error.message : 'Unknown parse error',
              ruleId: jsonRule.id,
              expression: jsonRule.condition,
            },
          };
        }
      },
      { rules: [] },
    );

    if (parseResult.error) {
      return yield* _(Effect.fail(parseResult.error));
    }

    return parseResult.rules;
  });
}

/** Создает функцию условия из строки выражения JavaScript */
function createConditionFunction(expression: string): (context: FraudContext) => boolean {
  // Создает безопасный контекст оценки
  return function(context: FraudContext): boolean {
    try {
      // Создает функцию с контекстом в качестве параметра
      // Примечание: Используется конструктор Function для динамической оценки правил
      // Это необходимо для правил на основе JSON, но следует использовать осторожно
      const conditionFn = new Function('context', `return ${expression};`) as (
        ctx: FraudContext,
      ) => unknown;
      return Boolean(conditionFn(context));
    } catch (error) {
      console.error(
        `Rule condition evaluation error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false; // Fail-safe: invalid rules don't trigger
    }
  };
}

// ==================== ENHANCED RULE PROVIDER ====================

/** Расширенный провайдер правил, который поддерживает как JSON, так и жестко закодированные правила */
export class EnhancedFraudRuleProvider implements FraudRuleProvider {
  constructor(
    private readonly ruleLoader: RuleLoader,
    private readonly fallbackRules: readonly FraudRule[] = FRAUD_RULES,
  ) {}

  loadRules = (
    config: FraudPolicyConfig,
    version?: string,
  ): ProviderResult<readonly FraudRule[], FraudRuleProviderError> => {
    // Параметры зарезервированы для будущего использования
    void version;

    const loader = this.ruleLoader;
    const fallbacks = this.fallbackRules;

    return Effect.gen(function*(_) {
      // Сначала пытается загрузить из внешнего источника
      const externalRules = yield* _(Effect.either(
        loader.loadRules({
          source: { _tag: 'mixed', hardcodedRules: fallbacks },
        }),
      ));

      if (externalRules._tag === 'Right') {
        // Фильтрует по конфигу и возвращает
        const enabledRules = externalRules.right.filter((r: FraudRule) =>
          r.enabled && config.rules[r.id]?.enabled !== false
        );
        return enabledRules;
      }

      // Fallback на жестко закодированные правила при сбое внешней загрузки
      console.warn('Failed to load external rules, using fallback:', externalRules.left);
      return fallbacks.filter((r: FraudRule) => r.enabled && config.rules[r.id]?.enabled !== false);
    });
  };
}

/** Экземпляр расширенного провайдера правил */
export const enhancedFraudRuleProvider = new EnhancedFraudRuleProvider(defaultJsonRuleLoader);

// ==================== JSON RULE CONFIGURATIONS ====================

/** JSON версия жестко закодированных правил мошенничества для внешней конфигурации */
export const FRAUD_RULES_JSON: readonly JsonFraudRule[] = [
  {
    id: 'velocity_attack_detection',
    name: 'Velocity Attack Detection',
    description: 'Обнаружение скоординированных velocity атак',
    condition:
      'context.userHistory.recentAttempts.filter(a => a.timestamp > Date.now() - VELOCITY_ATTACK_PERIOD_MINUTES * 60000).length > VELOCITY_ATTACK_THRESHOLD',
    score: 50,
    reason: 'velocity_attack',
    priority: RULE_PRIORITIES.VELOCITY_ATTACK,
    enabled: true,
    version: '1.0.0',
  },
  {
    id: 'excessive_retry_detection',
    name: 'Excessive Retry Detection',
    description: 'Чрезмерные попытки retry',
    condition: '(context.retryContext?.attemptCount ?? 1) > EXCESSIVE_RETRY_THRESHOLD',
    score: 35,
    reason: 'excessive_retries',
    priority: RULE_PRIORITIES.EXCESSIVE_RETRIES,
    enabled: true,
    version: '1.0.0',
  },
  {
    id: 'geolocation_mismatch_detection',
    name: 'Geolocation Mismatch Detection',
    description: 'Несоответствие геолокации известной истории',
    condition:
      '!!context.geolocation && context.userHistory.knownGeolocations.length > 0 && !context.userHistory.knownGeolocations.includes(context.geolocation.country)',
    score: 30,
    reason: 'geolocation_mismatch',
    priority: RULE_PRIORITIES.GEOLOCATION_MISMATCH,
    enabled: true,
    version: '1.0.0',
  },
  {
    id: 'device_fingerprint_detection',
    name: 'Device Fingerprint Detection',
    description: 'Подозрительный device fingerprint',
    condition:
      "!!context.deviceFingerprint && context.userHistory.knownDeviceFingerprints.length > 0 && !context.userHistory.knownDeviceFingerprints.includes(context.deviceFingerprint.fingerprintHash ?? 'unknown')",
    score: 25,
    reason: 'device_fingerprint',
    priority: RULE_PRIORITIES.DEVICE_FINGERPRINT,
    enabled: true,
    version: '1.0.0',
  },
  {
    id: 'unusual_amount_detection',
    name: 'Unusual Amount Detection',
    description: 'Сумма платежа отклоняется от среднего',
    condition:
      '(() => { const avg = context.userHistory.averageAmount; if (!avg) return false; const deviation = Math.abs(context.paymentDetails.amount - avg) / avg; return deviation > UNUSUAL_AMOUNT_DEVIATION; })()',
    score: 20,
    reason: 'unusual_amount',
    priority: RULE_PRIORITIES.UNUSUAL_AMOUNT,
    enabled: true,
    version: '1.0.0',
  },
  {
    id: 'rapid_attempts_detection',
    name: 'Rapid Attempts Detection',
    description: 'Чрезмерное количество попыток платежа',
    condition:
      'context.userHistory.recentAttempts.filter(a => a.timestamp > Date.now() - RAPID_ATTEMPTS_PERIOD_MINUTES * 60000).length > RAPID_ATTEMPTS_THRESHOLD',
    score: 15,
    reason: 'rapid_attempts',
    priority: RULE_PRIORITIES.RAPID_ATTEMPTS,
    enabled: true,
    version: '1.0.0',
  },
  {
    id: 'payment_method_mismatch_detection',
    name: 'Payment Method Mismatch Detection',
    description: 'Метод оплаты не соответствует истории',
    condition:
      '(() => { if (context.userHistory.totalPayments < MIN_PAYMENTS_FOR_HISTORY_ANALYSIS) return false; const known = new Set([...context.userHistory.recentAttempts].reverse().slice(0, PAYMENT_METHOD_HISTORY_LENGTH).map(a => a.paymentMethod)); return !known.has(context.paymentDetails.paymentMethod); })()',
    score: 10,
    reason: 'payment_method_mismatch',
    priority: RULE_PRIORITIES.PAYMENT_METHOD_MISMATCH,
    enabled: true,
    version: '1.0.0',
  },
];

/** Пример использования JSON правил */
export const exampleJsonRuleConfig: RuleSource = {
  _tag: 'json',
  rules: FRAUD_RULES_JSON,
};

/** Пример смешанной конфигурации (JSON + жестко закодированный fallback) */
export const exampleMixedRuleConfig: RuleSource = {
  _tag: 'mixed',
  jsonRules: FRAUD_RULES_JSON,
  hardcodedRules: FRAUD_RULES,
};

// ==================== EXTERNAL DATA PROVIDER ====================

/** Реализация ExternalDataProvider с mock данными */
export const defaultExternalDataProvider: ExternalDataProvider = {
  getGeolocation: (ipAddress, correlationId, context, options?: ExternalCallOptions) => {
    // Provider только делает API вызов - без resilience
    // Параметры зарезервированы для будущей функциональности
    void ipAddress;
    void correlationId;
    void context;
    void options;

    return Effect.succeed<GeolocationData>({
      country: 'US',
      city: 'New York',
      coordinates: { lat: 40.7128, lng: -74.006 },
      timezone: 'America/New_York',
      confidence: 0.95,
      source: 'mock-api',
      timestamp: Date.now(),
    });
  },

  validateDeviceFingerprint: (
    fingerprint,
    correlationId,
    context,
    options?: ExternalCallOptions,
  ) => {
    // Provider только делает API вызов - без resilience
    // Параметры correlationId, context, options зарезервированы для будущей функциональности
    void correlationId;
    void context;
    void options;

    const isSuspicious = fingerprint.fingerprintHash?.includes('suspicious') ?? false;
    const confidence = isSuspicious ? HIGH_SUSPICIOUS_CONFIDENCE : LOW_SUSPICIOUS_CONFIDENCE;
    const result: DeviceFingerprintResult = {
      isSuspicious,
      confidence,
      reasons: isSuspicious ? ['Known suspicious fingerprint pattern'] : [],
      metadata: { checkedAt: Date.now(), algorithm: 'mock-sha256' },
    };

    return Effect.succeed(result);
  },
};

// ==================== FRAUD RULE ENGINE ====================

/** Реализация FraudRuleEngine с приоритетной оценкой правил */
export class DefaultFraudRuleEngine implements FraudRuleEngine {
  constructor(private readonly ruleVersionManager?: RuleVersionManager) {}
  evaluateRules = (
    context: FraudContext,
    rules: readonly FraudRule[],
    config: FraudPolicyConfig,
  ): FraudRuleEngineResult<FraudDecision> => {
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority).slice(
      0,
      config.performance.maxRulesEvaluation,
    );
    let totalScore = 0;
    let triggeredReasons: FraudReason[] = [];
    let triggeredRuleIds: string[] = [];
    let evaluatedRules = 0;

    for (const rule of sortedRules) {
      evaluatedRules++;
      try {
        if (rule.condition(context)) {
          totalScore += rule.score;
          triggeredReasons = [...triggeredReasons, rule.reason];
          triggeredRuleIds = [...triggeredRuleIds, rule.id];
          if (totalScore >= config.performance.shortCircuitThreshold) break;
        }
      } catch (error) {
        return Effect.fail<FraudRuleEngineError>({
          _tag: 'RuleEvaluationError',
          message: error instanceof Error ? error.message : 'Unknown',
          ruleId: rule.id,
          context,
        });
      }
    }

    const normalizedScore = Math.min(totalScore, config.maxScore);
    let decision: FraudDecision;

    if (normalizedScore < config.thresholds.lowRisk) {
      decision = { _tag: 'Clean', score: normalizedScore, evaluatedRules };
    } else if (normalizedScore < config.thresholds.highRisk) {
      decision = {
        _tag: 'Suspicious',
        score: normalizedScore,
        reasons: triggeredReasons,
        evaluatedRules,
        triggeredRules: triggeredRuleIds,
      };
    } else {
      decision = {
        _tag: 'HighRisk',
        score: normalizedScore,
        reasons: triggeredReasons,
        evaluatedRules,
        triggeredRules: triggeredRuleIds,
      };
    }

    return Effect.succeed(decision);
  };

  getRulesForVersion = (requestedVersion?: string): ProviderResult<{
    readonly rules: readonly FraudRule[];
    readonly version: string;
    readonly info: RuleVersionInfo;
  }, FraudRuleEngineError | RuleVersionManagerError> => {
    if (!this.ruleVersionManager) {
      return Effect.fail<FraudRuleEngineError>({
        _tag: 'ConfigurationError',
        message: 'RuleVersionManager not configured',
        configIssue: 'versionManager',
      });
    }

    const version = requestedVersion ?? 'active';
    const manager = this.ruleVersionManager;

    if (version === 'active') {
      return manager.getActiveVersion().pipe(
        Effect.map((activeVersion) => ({
          rules: activeVersion.rules,
          version: activeVersion.version,
          info: activeVersion.info,
        })),
      );
    }

    return manager.getVersion(version).pipe(
      Effect.map((versionData) => ({
        rules: versionData.rules,
        version,
        info: versionData.info,
      })),
    );
  };

  prepareRules = (rules: readonly FraudRule[]): FraudRuleEngineResult<void> => {
    // Параметр 'rules' зарезервирован для будущей функциональности
    // Например, кеширование, оптимизация или валидация правил
    void rules; // Явно игнорируем параметр для совместимости с интерфейсом
    return Effect.succeed(undefined);
  };

  setVersionManager = (manager: RuleVersionManager): FraudRuleEngineResult<void> => {
    // В классе versionManager устанавливается через constructor
    // Этот метод оставлен для совместимости с интерфейсом, но не используется
    void manager; // Явно игнорируем параметр для совместимости с интерфейсом
    return Effect.succeed(undefined);
  };
}

// ==================== EXTERNAL DATA SERVICE ====================

/** Сервис external данных с resilience patterns и graceful degradation */
export class DefaultExternalDataService implements ExternalDataService {
  constructor(private readonly provider: ExternalDataProvider) {}

  /** Получает геолокацию с production-ready resilience
   * @param ip IP адрес
   * @param correlationId ID для tracing
   * @param context Контекст пользователя
   * @param options Опции external call (пока не используются, зарезервированы)
   * @returns Геолокация или null при ошибке */
  getGeolocationWithFallback = (
    ip: string,
    correlationId: string,
    context?: UserContext,
    options?: ExternalCallOptions,
  ): Effect.Effect<GeolocationData | null, never> => {
    // Опции зарезервированы для будущей расширенной конфигурации
    void options;

    const apiCall = this.provider.getGeolocation(ip, correlationId, context, options);
    return withExternalResilience(apiCall);
  };

  /** Проверяет device fingerprint с production-ready resilience
   * @param fp Данные fingerprint
   * @param correlationId ID для tracing
   * @param context Контекст пользователя
   * @param options Опции external call (пока не используются, зарезервированы)
   * @returns Результат проверки или null при ошибке */
  validateDeviceFingerprintWithFallback = (
    fp: DeviceFingerprintData,
    correlationId: string,
    context?: UserContext,
    options?: ExternalCallOptions,
  ): Effect.Effect<DeviceFingerprintResult | null, never> => {
    // Опции зарезервированы для будущей расширенной конфигурации
    void options;

    const apiCall = this.provider.validateDeviceFingerprint(fp, correlationId, context, options);
    return withExternalResilience(apiCall);
  };
}

// ==================== MULTI-TENANT SERVICE REGISTRY ====================

/** Реестр сервисов fraud detection с multi-tenant поддержкой */
export class MultiTenantFraudDetectionRegistry {
  private readonly tenantServices: ReadonlyMap<string, FraudDetectionServices>;

  constructor(
    private readonly defaultServices: FraudDetectionServices,
    tenantServices: ReadonlyMap<string, FraudDetectionServices> = new Map(),
  ) {
    this.tenantServices = tenantServices;
  }

  /** Регистрирует сервисы для tenant
   * @param tenantId ID tenant
   * @param services Переопределение сервисов
   * @returns Новый immutable registry */
  registerTenant(
    tenantId: string,
    services: Partial<FraudDetectionServices>,
  ): MultiTenantFraudDetectionRegistry {
    const newTenantServices = new Map([...this.tenantServices, [tenantId, {
      ...this.defaultServices,
      ...services,
    }]]);
    return new MultiTenantFraudDetectionRegistry(this.defaultServices, newTenantServices);
  }

  /** Получает сервисы для tenant
   * @param tenantId ID tenant (опционально)
   * @returns Сервисы для tenant или по умолчанию */
  getServices(tenantId?: string): FraudDetectionServices {
    return tenantId !== undefined
      ? this.tenantServices.get(tenantId) ?? this.defaultServices
      : this.defaultServices;
  }

  /** Удаляет tenant из registry
   * @param tenantId ID tenant для удаления
   * @returns Новый immutable registry */
  unregisterTenant(tenantId: string): MultiTenantFraudDetectionRegistry {
    const newTenantServices = new Map([...this.tenantServices].filter(([key]) => key !== tenantId));
    return new MultiTenantFraudDetectionRegistry(this.defaultServices, newTenantServices);
  }

  /** Проверяет наличие tenant
   * @param tenantId ID tenant для проверки
   * @returns true если tenant зарегистрирован */
  hasTenant(tenantId: string): boolean {
    return this.tenantServices.has(tenantId);
  }
}

// ==================== DEFAULT SERVICES ====================

/** Набор сервисов fraud detection по умолчанию */
export const defaultFraudDetectionServices: FraudDetectionServices = {
  ruleProvider: defaultFraudRuleProvider,
  externalDataProvider: defaultExternalDataProvider,
  ruleEngine: new DefaultFraudRuleEngine(),
  externalDataService: new DefaultExternalDataService(defaultExternalDataProvider),
};

/** Реестр сервисов с multi-tenant поддержкой */
export const multiTenantRegistry = new MultiTenantFraudDetectionRegistry(
  defaultFraudDetectionServices,
  new Map(),
);
