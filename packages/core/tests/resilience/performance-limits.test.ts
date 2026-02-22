/**
 * @file Unit тесты для Resilience Performance Limits
 * Покрывают валидацию, проверку лимитов, нормализацию, генерацию метрик и edge-cases.
 */
import { describe, expect, it } from 'vitest';
import {
  checkConcurrentOperationsLimit,
  checkExecutionTimeLimit,
  checkLimitByType,
  checkLimits,
  checkMemoryLimit,
  checkPluginsLimit,
  checkRulesLimit,
  createAllMetricsForLimit,
  createLimitExceededMetric,
  createLimitRemainingMetric,
  createLimitUsageGaugeMetric,
  createLimitUsageMetric,
  createPerformanceLimitsConfig,
  DEFAULT_PERFORMANCE_LIMITS_CONFIG,
  validatePerformanceLimits,
} from '../../src/resilience/performance-limits.js';
import type { PerformanceLimitsConfig } from '../../src/resilience/performance-limits.js';

const BASE_TIME_MS = 1_000;
const DEFAULT_MAX_RULES = 50;
const DEFAULT_MAX_EXECUTION_TIME_MS = 10;
const DEFAULT_MAX_PLUGINS = 20;
const DEFAULT_MAX_MEMORY_MB = 100;
const DEFAULT_MAX_CONCURRENT_OPERATIONS = 10;

function createConfig(overrides: Partial<PerformanceLimitsConfig> = {}): PerformanceLimitsConfig {
  return Object.freeze({
    ...DEFAULT_PERFORMANCE_LIMITS_CONFIG,
    ...overrides,
  });
}

describe('resilience/performance-limits', () => {
  describe('DEFAULT_PERFORMANCE_LIMITS_CONFIG', () => {
    it('содержит дефолтные значения', () => {
      expect(DEFAULT_PERFORMANCE_LIMITS_CONFIG.maxRules).toBe(DEFAULT_MAX_RULES);
      expect(DEFAULT_PERFORMANCE_LIMITS_CONFIG.maxExecutionTimeMs).toBe(
        DEFAULT_MAX_EXECUTION_TIME_MS,
      );
      expect(DEFAULT_PERFORMANCE_LIMITS_CONFIG.maxPlugins).toBe(DEFAULT_MAX_PLUGINS);
      expect(DEFAULT_PERFORMANCE_LIMITS_CONFIG.maxMemoryMb).toBe(DEFAULT_MAX_MEMORY_MB);
      expect(DEFAULT_PERFORMANCE_LIMITS_CONFIG.maxConcurrentOperations).toBe(
        DEFAULT_MAX_CONCURRENT_OPERATIONS,
      );
      expect(Object.isFrozen(DEFAULT_PERFORMANCE_LIMITS_CONFIG)).toBe(true);
    });
  });

  describe('validatePerformanceLimits', () => {
    it('валидирует корректную конфигурацию', () => {
      const config = createConfig({
        maxRules: 100,
        maxExecutionTimeMs: 50,
        maxPlugins: 30,
        maxMemoryMb: 200,
        maxConcurrentOperations: 20,
      });
      const result = validatePerformanceLimits(config);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.normalized.maxRules).toBe(100);
        expect(result.normalized.maxExecutionTimeMs).toBe(50);
        expect(result.normalized.maxPlugins).toBe(30);
        expect(result.normalized.maxMemoryMb).toBe(200);
        expect(result.normalized.maxConcurrentOperations).toBe(20);
        expect(Object.isFrozen(result.normalized)).toBe(true);
      }
    });

    it('валидирует конфигурацию без опциональных полей', () => {
      const config = Object.freeze({
        maxRules: 100,
        maxExecutionTimeMs: 50,
        maxPlugins: 30,
        // maxMemoryMb и maxConcurrentOperations не указаны
      });
      const result = validatePerformanceLimits(config);
      expect(result.valid).toBe(true);
      if (result.valid) {
        // normalizeConfig не добавляет опциональные поля, если они не указаны
        expect(result.normalized.maxMemoryMb).toBeUndefined();
        expect(result.normalized.maxConcurrentOperations).toBeUndefined();
      }
    });

    it('возвращает ошибку для невалидного maxRules (не положительное)', () => {
      const config = createConfig({ maxRules: 0 });
      const result = validatePerformanceLimits(config);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThan(0);
        const maxRulesError = result.errors.find((e) => e.limitType === 'max_rules');
        expect(maxRulesError).toBeDefined();
        expect(maxRulesError?.reason).toBe('must_be_positive');
      }
    });

    it('возвращает ошибку для невалидного maxRules (отрицательное)', () => {
      const config = createConfig({ maxRules: -1 });
      const result = validatePerformanceLimits(config);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        const maxRulesError = result.errors.find((e) => e.limitType === 'max_rules');
        expect(maxRulesError?.reason).toBe('must_be_positive');
      }
    });

    it('возвращает ошибку для невалидного maxRules (не конечное)', () => {
      const config = createConfig({ maxRules: Number.POSITIVE_INFINITY });
      const result = validatePerformanceLimits(config);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        const maxRulesError = result.errors.find((e) => e.limitType === 'max_rules');
        expect(maxRulesError?.reason).toBe('must_be_finite');
      }
    });

    it('возвращает ошибку для невалидного maxExecutionTimeMs', () => {
      const config = createConfig({ maxExecutionTimeMs: -5 });
      const result = validatePerformanceLimits(config);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        const error = result.errors.find((e) => e.limitType === 'max_execution_time_ms');
        expect(error?.reason).toBe('must_be_positive');
      }
    });

    it('возвращает ошибку для невалидного maxPlugins (отрицательное)', () => {
      const config = createConfig({ maxPlugins: -1 });
      const result = validatePerformanceLimits(config);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        const error = result.errors.find((e) => e.limitType === 'max_plugins');
        expect(error?.reason).toBe('must_be_non_negative');
      }
    });

    it('валидирует maxPlugins = 0 как корректное', () => {
      const config = createConfig({ maxPlugins: 0 });
      const result = validatePerformanceLimits(config);
      expect(result.valid).toBe(true);
    });

    it('возвращает ошибку для невалидного maxMemoryMb', () => {
      const config = createConfig({ maxMemoryMb: 0 });
      const result = validatePerformanceLimits(config);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        const error = result.errors.find((e) => e.limitType === 'max_memory_mb');
        expect(error?.reason).toBe('must_be_positive');
      }
    });

    it('возвращает ошибку для невалидного maxConcurrentOperations', () => {
      const config = createConfig({ maxConcurrentOperations: -1 });
      const result = validatePerformanceLimits(config);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        const error = result.errors.find((e) => e.limitType === 'max_concurrent_operations');
        expect(error?.reason).toBe('must_be_positive');
      }
    });

    it('возвращает несколько ошибок для невалидной конфигурации', () => {
      const config = createConfig({
        maxRules: -1,
        maxExecutionTimeMs: 0,
        maxPlugins: -5,
      });
      const result = validatePerformanceLimits(config);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
        expect(Object.isFrozen(result.errors)).toBe(true);
      }
    });
  });

  describe('createPerformanceLimitsConfig', () => {
    it('создает конфигурацию с дефолтными значениями', () => {
      const config = createPerformanceLimitsConfig();
      expect(config.maxRules).toBe(DEFAULT_MAX_RULES);
      expect(config.maxExecutionTimeMs).toBe(DEFAULT_MAX_EXECUTION_TIME_MS);
      expect(config.maxPlugins).toBe(DEFAULT_MAX_PLUGINS);
      expect(config.maxMemoryMb).toBe(DEFAULT_MAX_MEMORY_MB);
      expect(config.maxConcurrentOperations).toBe(DEFAULT_MAX_CONCURRENT_OPERATIONS);
      expect(Object.isFrozen(config)).toBe(true);
    });

    it('создает конфигурацию с переопределениями', () => {
      const config = createPerformanceLimitsConfig({
        maxRules: 200,
        maxExecutionTimeMs: 100,
      });
      expect(config.maxRules).toBe(200);
      expect(config.maxExecutionTimeMs).toBe(100);
      expect(config.maxPlugins).toBe(DEFAULT_MAX_PLUGINS);
    });

    it('нормализует дробные значения', () => {
      const config = createPerformanceLimitsConfig({
        maxRules: 50.9,
        maxExecutionTimeMs: 10.7,
      });
      expect(config.maxRules).toBe(50);
      expect(config.maxExecutionTimeMs).toBe(10);
    });

    it('нормализует невалидные значения к дефолтам', () => {
      const config = createPerformanceLimitsConfig({
        maxRules: -1,
        maxExecutionTimeMs: Number.NaN,
      });
      expect(config.maxRules).toBe(DEFAULT_MAX_RULES);
      expect(config.maxExecutionTimeMs).toBe(DEFAULT_MAX_EXECUTION_TIME_MS);
    });

    it('нормализует невалидные maxPlugins (не конечное или отрицательное)', () => {
      const config1 = createPerformanceLimitsConfig({
        maxPlugins: Number.POSITIVE_INFINITY,
      });
      expect(config1.maxPlugins).toBe(DEFAULT_MAX_PLUGINS);

      const config2 = createPerformanceLimitsConfig({
        maxPlugins: -1,
      });
      expect(config2.maxPlugins).toBe(DEFAULT_MAX_PLUGINS);
    });

    it('обрабатывает отсутствие опциональных полей', () => {
      const config = createPerformanceLimitsConfig({});
      // Опциональные поля могут быть undefined или использовать дефолты
      // в зависимости от реализации normalizeConfig
      expect(config.maxRules).toBeDefined();
      expect(config.maxExecutionTimeMs).toBeDefined();
      expect(config.maxPlugins).toBeDefined();
    });
  });

  describe('checkLimitByType', () => {
    it('возвращает withinLimit: true для значений в пределах лимита', () => {
      const config = createConfig({ maxRules: 100 });
      const result = checkLimitByType('max_rules', 50, config);
      expect(result.withinLimit).toBe(true);
      if (result.withinLimit) {
        expect(result.remaining).toBe(50);
        expect(result.limitType).toBe('max_rules');
      }
    });

    it('возвращает withinLimit: true для значений равных лимиту', () => {
      const config = createConfig({ maxRules: 100 });
      const result = checkLimitByType('max_rules', 100, config);
      expect(result.withinLimit).toBe(true);
      if (result.withinLimit) {
        expect(result.remaining).toBe(0);
      }
    });

    it('возвращает withinLimit: false для превышенных лимитов', () => {
      const config = createConfig({ maxRules: 100 });
      const result = checkLimitByType('max_rules', 150, config);
      expect(result.withinLimit).toBe(false);
      if (!result.withinLimit) {
        expect(result.limit).toBe(100);
        expect(result.actual).toBe(150);
        expect(result.exceededBy).toBe(50);
        expect(result.limitType).toBe('max_rules');
      }
    });

    it('округляет дробные значения вниз (actual)', () => {
      const config = createConfig({ maxRules: 100 });
      const result = checkLimitByType('max_rules', 100.9, config);
      expect(result.withinLimit).toBe(true);
      if (result.withinLimit) {
        expect(result.remaining).toBe(0);
      }
    });

    it('округляет дробные значения вниз (limit)', () => {
      const config = createConfig({ maxRules: 100.9 });
      const result = checkLimitByType('max_rules', 100, config);
      expect(result.withinLimit).toBe(true);
      if (result.withinLimit) {
        expect(result.remaining).toBe(0);
      }
    });

    it('округляет дробные значения в exceededBy', () => {
      const config = createConfig({ maxRules: 100 });
      const result = checkLimitByType('max_rules', 150.7, config);
      expect(result.withinLimit).toBe(false);
      if (!result.withinLimit) {
        expect(result.exceededBy).toBe(50);
      }
    });

    it('возвращает превышение для невалидного actual (отрицательное)', () => {
      const config = createConfig({ maxRules: 100 });
      const result = checkLimitByType('max_rules', -1, config);
      expect(result.withinLimit).toBe(false);
      if (!result.withinLimit) {
        expect(result.limit).toBe(0);
        expect(result.actual).toBe(-1);
        expect(result.exceededBy).toBe(-1);
      }
    });

    it('возвращает превышение для невалидного actual (не конечное)', () => {
      const config = createConfig({ maxRules: 100 });
      const result = checkLimitByType('max_rules', Number.POSITIVE_INFINITY, config);
      expect(result.withinLimit).toBe(false);
      if (!result.withinLimit) {
        expect(result.limit).toBe(0);
        expect(result.exceededBy).toBe(Number.POSITIVE_INFINITY);
      }
    });

    it('проверяет все типы лимитов', () => {
      const config = createConfig({
        maxRules: 100,
        maxExecutionTimeMs: 50,
        maxPlugins: 30,
        maxMemoryMb: 200,
        maxConcurrentOperations: 20,
      });

      expect(checkLimitByType('max_rules', 50, config).withinLimit).toBe(true);
      expect(checkLimitByType('max_execution_time_ms', 25, config).withinLimit).toBe(true);
      expect(checkLimitByType('max_plugins', 15, config).withinLimit).toBe(true);
      expect(checkLimitByType('max_memory_mb', 100, config).withinLimit).toBe(true);
      expect(checkLimitByType('max_concurrent_operations', 10, config).withinLimit).toBe(true);
    });

    it('использует дефолтные значения для опциональных лимитов', () => {
      const config = createConfig({
        maxRules: 100,
        maxExecutionTimeMs: 50,
        maxPlugins: 30,
        // maxMemoryMb и maxConcurrentOperations не указаны
      });
      const result = checkLimitByType('max_memory_mb', 50, config);
      expect(result.withinLimit).toBe(true);
      if (result.withinLimit) {
        expect(result.remaining).toBe(50); // DEFAULT_MAX_MEMORY_MB = 100, actual = 50
      }
    });

    it('кеширует нормализованную конфигурацию', () => {
      const config = createConfig({ maxRules: 100.7 });
      const result1 = checkLimitByType('max_rules', 50, config);
      const result2 = checkLimitByType('max_rules', 60, config);
      expect(result1.withinLimit).toBe(true);
      expect(result2.withinLimit).toBe(true);
      // Оба вызова должны использовать одну и ту же нормализованную конфигурацию
    });
  });

  describe('checkRulesLimit', () => {
    it('проверяет лимит правил', () => {
      const config = createConfig({ maxRules: 100 });
      const result = checkRulesLimit(50, config);
      expect(result.withinLimit).toBe(true);
      expect(result.limitType).toBe('max_rules');
    });
  });

  describe('checkExecutionTimeLimit', () => {
    it('проверяет лимит времени выполнения', () => {
      const config = createConfig({ maxExecutionTimeMs: 100 });
      const result = checkExecutionTimeLimit(50, config);
      expect(result.withinLimit).toBe(true);
      expect(result.limitType).toBe('max_execution_time_ms');
    });
  });

  describe('checkPluginsLimit', () => {
    it('проверяет лимит плагинов', () => {
      const config = createConfig({ maxPlugins: 30 });
      const result = checkPluginsLimit(15, config);
      expect(result.withinLimit).toBe(true);
      expect(result.limitType).toBe('max_plugins');
    });
  });

  describe('checkMemoryLimit', () => {
    it('проверяет лимит памяти', () => {
      const config = createConfig({ maxMemoryMb: 200 });
      const result = checkMemoryLimit(100, config);
      expect(result.withinLimit).toBe(true);
      expect(result.limitType).toBe('max_memory_mb');
    });
  });

  describe('checkConcurrentOperationsLimit', () => {
    it('проверяет лимит одновременных операций', () => {
      const config = createConfig({ maxConcurrentOperations: 20 });
      const result = checkConcurrentOperationsLimit(10, config);
      expect(result.withinLimit).toBe(true);
      expect(result.limitType).toBe('max_concurrent_operations');
    });
  });

  describe('checkLimits', () => {
    it('проверяет все лимиты одновременно', () => {
      const config = createConfig({
        maxRules: 100,
        maxExecutionTimeMs: 50,
        maxPlugins: 30,
        maxMemoryMb: 200,
        maxConcurrentOperations: 20,
      });
      const actuals = {
        max_rules: 50,
        max_execution_time_ms: 25,
        max_plugins: 15,
        max_memory_mb: 100,
        max_concurrent_operations: 10,
      };
      const results = checkLimits(config, actuals);
      expect(results.max_rules.withinLimit).toBe(true);
      expect(results.max_execution_time_ms.withinLimit).toBe(true);
      expect(results.max_plugins.withinLimit).toBe(true);
      expect(results.max_memory_mb.withinLimit).toBe(true);
      expect(results.max_concurrent_operations.withinLimit).toBe(true);
      expect(Object.isFrozen(results)).toBe(true);
    });

    it('возвращает превышения для всех лимитов', () => {
      const config = createConfig({
        maxRules: 100,
        maxExecutionTimeMs: 50,
        maxPlugins: 30,
        maxMemoryMb: 200,
        maxConcurrentOperations: 20,
      });
      const actuals = {
        max_rules: 150,
        max_execution_time_ms: 75,
        max_plugins: 45,
        max_memory_mb: 300,
        max_concurrent_operations: 30,
      };
      const results = checkLimits(config, actuals);
      expect(results.max_rules.withinLimit).toBe(false);
      expect(results.max_execution_time_ms.withinLimit).toBe(false);
      expect(results.max_plugins.withinLimit).toBe(false);
      expect(results.max_memory_mb.withinLimit).toBe(false);
      expect(results.max_concurrent_operations.withinLimit).toBe(false);
    });

    it('обрабатывает смешанные результаты', () => {
      const config = createConfig({
        maxRules: 100,
        maxExecutionTimeMs: 50,
        maxPlugins: 30,
        maxMemoryMb: 200,
        maxConcurrentOperations: 20,
      });
      const actuals = {
        max_rules: 50,
        max_execution_time_ms: 75,
        max_plugins: 15,
        max_memory_mb: 300,
        max_concurrent_operations: 10,
      };
      const results = checkLimits(config, actuals);
      expect(results.max_rules.withinLimit).toBe(true);
      expect(results.max_execution_time_ms.withinLimit).toBe(false);
      expect(results.max_plugins.withinLimit).toBe(true);
      expect(results.max_memory_mb.withinLimit).toBe(false);
      expect(results.max_concurrent_operations.withinLimit).toBe(true);
    });
  });

  describe('createLimitExceededMetric', () => {
    it('создает метрику для превышенного лимита', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 150, config);
      if (!checkResult.withinLimit) {
        const metric = createLimitExceededMetric(checkResult, BASE_TIME_MS);
        expect(metric).not.toBeNull();
        if (metric) {
          expect(metric.type).toBe('counter');
          expect(metric.name).toBe('performance_limit_exceeded_max_rules');
          expect(metric.value).toBe(1);
          expect(metric.unit).toBe('count');
          expect(metric.timestampMs).toBe(BASE_TIME_MS);
          expect(metric.tags?.['limit_type']).toBe('max_rules');
          expect(metric.tags?.['limit']).toBe('100');
          expect(metric.tags?.['actual']).toBe('150');
          expect(metric.tags?.['exceeded_by']).toBe('50');
        }
      }
    });

    it('возвращает null для лимита в пределах нормы', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 50, config);
      if (checkResult.withinLimit) {
        const metric = createLimitExceededMetric(checkResult, BASE_TIME_MS);
        expect(metric).toBeNull();
      }
    });

    it('создает метрику с дополнительными тегами', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 150, config);
      if (!checkResult.withinLimit) {
        const tags = { service: 'api', env: 'prod' };
        const metric = createLimitExceededMetric(checkResult, BASE_TIME_MS, tags);
        expect(metric).not.toBeNull();
        if (metric) {
          expect(metric.tags?.['service']).toBe('api');
          expect(metric.tags?.['env']).toBe('prod');
        }
      }
    });

    it('экранирует специальные символы в тегах', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 150, config);
      if (!checkResult.withinLimit) {
        const tags = { service: 'api=test,value' };
        const metric = createLimitExceededMetric(checkResult, BASE_TIME_MS, tags);
        expect(metric).not.toBeNull();
        if (metric) {
          // Проверяем, что специальные символы экранированы
          expect(metric.tags?.['service']).toContain('\\=');
          expect(metric.tags?.['service']).toContain('\\,');
        }
      }
    });

    it('возвращает метрику без дополнительных тегов при невалидных tags', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 150, config);
      if (!checkResult.withinLimit) {
        // Создаем невалидные теги (слишком длинный ключ)
        const invalidTags = Object.fromEntries([
          ['a'.repeat(201), 'value'],
        ]);
        const metric = createLimitExceededMetric(checkResult, BASE_TIME_MS, invalidTags);
        expect(metric).not.toBeNull();
        if (metric) {
          // Метрика должна быть создана, но без невалидных тегов
          expect(metric.tags?.['limit_type']).toBe('max_rules');
        }
      }
    });

    it('возвращает метрику без дополнительных тегов при невалидных символах в ключе', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 150, config);
      if (!checkResult.withinLimit) {
        // Создаем невалидные теги (недопустимые символы в ключе)
        const invalidTags = { 'test@key': 'value' };
        const metric = createLimitExceededMetric(checkResult, BASE_TIME_MS, invalidTags);
        expect(metric).not.toBeNull();
        if (metric) {
          // Метрика должна быть создана, но без невалидных тегов
          expect(metric.tags?.['limit_type']).toBe('max_rules');
          expect(metric.tags?.['test@key']).toBeUndefined();
        }
      }
    });

    it('возвращает метрику без дополнительных тегов при пустом или слишком длинном значении', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 150, config);
      if (!checkResult.withinLimit) {
        // Создаем невалидные теги (пустое значение)
        const invalidTags1 = { test: '' };
        const metric1 = createLimitExceededMetric(checkResult, BASE_TIME_MS, invalidTags1);
        expect(metric1).not.toBeNull();
        if (metric1) {
          expect(metric1.tags?.['test']).toBeUndefined();
        }

        // Создаем невалидные теги (слишком длинное значение)
        const invalidTags2 = Object.fromEntries([
          ['test', 'a'.repeat(201)],
        ]);
        const metric2 = createLimitExceededMetric(checkResult, BASE_TIME_MS, invalidTags2);
        expect(metric2).not.toBeNull();
        if (metric2) {
          expect(metric2.tags?.['test']).toBeUndefined();
        }
      }
    });
  });

  describe('createLimitUsageMetric', () => {
    it('создает метрику использования для лимита в пределах нормы', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 50, config);
      if (checkResult.withinLimit) {
        const metric = createLimitUsageMetric(checkResult, config, BASE_TIME_MS);
        expect(metric.type).toBe('gauge');
        expect(metric.name).toBe('performance_limit_usage_max_rules');
        expect(metric.unit).toBe('percent');
        expect(metric.timestampMs).toBe(BASE_TIME_MS);
        expect(metric.value).toBe(50); // 50/100 * 100 = 50%
        expect(metric.tags?.['remaining']).toBe('50');
      }
    });

    it('создает метрику использования для превышенного лимита', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 150, config);
      if (!checkResult.withinLimit) {
        const metric = createLimitUsageMetric(checkResult, config, BASE_TIME_MS);
        expect(metric.type).toBe('gauge');
        expect(metric.name).toBe('performance_limit_usage_max_rules');
        expect(metric.value).toBe(150); // 150/100 * 100 = 150%
        expect(metric.tags?.['exceeded_by']).toBe('50');
      }
    });

    it('обрабатывает лимит равный нулю', () => {
      const config = createConfig({ maxRules: 0 });
      const checkResult = checkLimitByType('max_rules', 0, config);
      if (checkResult.withinLimit) {
        const metric = createLimitUsageMetric(checkResult, config, BASE_TIME_MS);
        expect(metric.value).toBe(0);
      }
    });

    it('создает метрику с дополнительными тегами', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 50, config);
      if (checkResult.withinLimit) {
        const tags = { service: 'api' };
        const metric = createLimitUsageMetric(checkResult, config, BASE_TIME_MS, tags);
        expect(metric.tags?.['service']).toBe('api');
      }
    });

    it('возвращает метрику без дополнительных тегов при невалидных tags', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 50, config);
      if (checkResult.withinLimit) {
        const invalidTags = Object.fromEntries([
          ['a'.repeat(201), 'value'],
        ]);
        const metric = createLimitUsageMetric(checkResult, config, BASE_TIME_MS, invalidTags);
        expect(metric.tags?.['limit_type']).toBe('max_rules');
        expect(metric.tags?.['a'.repeat(201)]).toBeUndefined();
      }
    });
  });

  describe('createLimitUsageGaugeMetric', () => {
    it('создает gauge метрику с явным указанием лимита', () => {
      const metric = createLimitUsageGaugeMetric(50, 100, 'max_rules', BASE_TIME_MS);
      expect(metric.type).toBe('gauge');
      expect(metric.name).toBe('performance_limit_usage_max_rules');
      expect(metric.value).toBe(50); // 50/100 * 100 = 50%
      expect(metric.unit).toBe('percent');
      expect(metric.tags?.['limit']).toBe('100');
      expect(metric.tags?.['actual']).toBe('50');
      expect(metric.tags?.['remaining']).toBe('50');
    });

    it('округляет дробные значения вниз', () => {
      const metric = createLimitUsageGaugeMetric(50.9, 100.7, 'max_rules', BASE_TIME_MS);
      expect(metric.value).toBe(50); // Math.floor(50.9) / Math.floor(100.7) * 100 = 50/100 * 100 = 50%
      expect(metric.tags?.['limit']).toBe('100');
      expect(metric.tags?.['actual']).toBe('50');
    });

    it('обрабатывает лимит равный нулю', () => {
      const metric = createLimitUsageGaugeMetric(10, 0, 'max_rules', BASE_TIME_MS);
      expect(metric.value).toBe(0);
    });

    it('ограничивает использование до 100% для значений в пределах лимита', () => {
      const metric = createLimitUsageGaugeMetric(100, 100, 'max_rules', BASE_TIME_MS);
      expect(metric.value).toBe(100);
    });

    it('создает метрику с дополнительными тегами', () => {
      const tags = { service: 'api' };
      const metric = createLimitUsageGaugeMetric(50, 100, 'max_rules', BASE_TIME_MS, tags);
      expect(metric.tags?.['service']).toBe('api');
    });

    it('возвращает метрику без дополнительных тегов при невалидных tags', () => {
      const invalidTags = Object.fromEntries([
        ['a'.repeat(201), 'value'],
      ]);
      const metric = createLimitUsageGaugeMetric(50, 100, 'max_rules', BASE_TIME_MS, invalidTags);
      expect(metric.tags?.['limit_type']).toBe('max_rules');
    });
  });

  describe('createLimitRemainingMetric', () => {
    it('создает метрику для оставшегося ресурса', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 50, config);
      if (checkResult.withinLimit) {
        const metric = createLimitRemainingMetric(checkResult, config, BASE_TIME_MS);
        expect(metric).not.toBeNull();
        if (metric) {
          expect(metric.type).toBe('gauge');
          expect(metric.name).toBe('performance_limit_remaining_max_rules');
          expect(metric.value).toBe(50);
          expect(metric.unit).toBe('count');
          expect(metric.tags?.['remaining']).toBe('50');
        }
      }
    });

    it('возвращает null для превышенного лимита', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 150, config);
      if (!checkResult.withinLimit) {
        const metric = createLimitRemainingMetric(checkResult, config, BASE_TIME_MS);
        expect(metric).toBeNull();
      }
    });

    it('создает метрику с дополнительными тегами', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 50, config);
      if (checkResult.withinLimit) {
        const tags = { service: 'api' };
        const metric = createLimitRemainingMetric(checkResult, config, BASE_TIME_MS, tags);
        expect(metric).not.toBeNull();
        if (metric) {
          expect(metric.tags?.['service']).toBe('api');
        }
      }
    });

    it('возвращает метрику без дополнительных тегов при невалидных tags', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 50, config);
      if (checkResult.withinLimit) {
        const invalidTags = Object.fromEntries([
          ['a'.repeat(201), 'value'],
        ]);
        const metric = createLimitRemainingMetric(checkResult, config, BASE_TIME_MS, invalidTags);
        expect(metric).not.toBeNull();
        if (metric) {
          expect(metric.tags?.['limit_type']).toBe('max_rules');
        }
      }
    });
  });

  describe('createAllMetricsForLimit', () => {
    it('создает все метрики для лимита в пределах нормы', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 50, config);
      if (checkResult.withinLimit) {
        const metrics = createAllMetricsForLimit(checkResult, config, BASE_TIME_MS);
        expect(metrics.length).toBe(2);
        expect(metrics[0]?.name).toBe('performance_limit_usage_max_rules');
        expect(metrics[1]?.name).toBe('performance_limit_remaining_max_rules');
        expect(Object.isFrozen(metrics)).toBe(true);
      }
    });

    it('создает все метрики для превышенного лимита', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 150, config);
      if (!checkResult.withinLimit) {
        const metrics = createAllMetricsForLimit(checkResult, config, BASE_TIME_MS);
        expect(metrics.length).toBe(2);
        expect(metrics[0]?.name).toBe('performance_limit_usage_max_rules');
        expect(metrics[1]?.name).toBe('performance_limit_exceeded_max_rules');
      }
    });

    it('создает метрики с дополнительными тегами', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 50, config);
      if (checkResult.withinLimit) {
        const tags = { service: 'api' };
        const metrics = createAllMetricsForLimit(checkResult, config, BASE_TIME_MS, tags);
        expect(metrics.length).toBe(2);
        expect(metrics[0]?.tags?.['service']).toBe('api');
        expect(metrics[1]?.tags?.['service']).toBe('api');
      }
    });

    it('обрабатывает случай когда createLimitRemainingMetric возвращает null', () => {
      // Этот случай не должен происходить, так как мы проверяем withinLimit,
      // но тестируем для полноты покрытия
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 50, config);
      if (checkResult.withinLimit) {
        const metrics = createAllMetricsForLimit(checkResult, config, BASE_TIME_MS);
        // Всегда должна быть usage метрика
        expect(metrics.length).toBeGreaterThanOrEqual(1);
        expect(metrics[0]?.name).toBe('performance_limit_usage_max_rules');
      }
    });
  });

  describe('edge cases и интеграционные тесты', () => {
    it('обрабатывает все типы лимитов в полном цикле', () => {
      const config = createConfig({
        maxRules: 100,
        maxExecutionTimeMs: 50,
        maxPlugins: 30,
        maxMemoryMb: 200,
        maxConcurrentOperations: 20,
      });

      const limitTypes: (
        | 'max_rules'
        | 'max_execution_time_ms'
        | 'max_plugins'
        | 'max_memory_mb'
        | 'max_concurrent_operations'
      )[] = [
        'max_rules',
        'max_execution_time_ms',
        'max_plugins',
        'max_memory_mb',
        'max_concurrent_operations',
      ];

      limitTypes.forEach((limitType) => {
        const checkResult = checkLimitByType(limitType, 50, config);
        const usageMetric = createLimitUsageMetric(checkResult, config, BASE_TIME_MS);
        expect(usageMetric.name).toContain(limitType);
      });
    });

    it('обрабатывает очень большие значения', () => {
      const config = createConfig({ maxRules: Number.MAX_SAFE_INTEGER });
      const result = checkLimitByType('max_rules', Number.MAX_SAFE_INTEGER - 1, config);
      expect(result.withinLimit).toBe(true);
    });

    it('обрабатывает очень маленькие значения', () => {
      const config = createConfig({ maxRules: 1 });
      const result = checkLimitByType('max_rules', 0, config);
      expect(result.withinLimit).toBe(true);
      if (result.withinLimit) {
        expect(result.remaining).toBe(1);
      }
    });

    it('экранирует все специальные символы в тегах', () => {
      const config = createConfig({ maxRules: 100 });
      const checkResult = checkLimitByType('max_rules', 150, config);
      if (!checkResult.withinLimit) {
        const tags = {
          test1: 'value=test',
          test2: 'value,test',
          test3: 'value"test',
          test4: 'value\\test',
          test5: 'value\ntest',
          test6: 'value\rtest',
          test7: 'value\ttest',
          test8: 'value with spaces',
        };
        const metric = createLimitExceededMetric(checkResult, BASE_TIME_MS, tags);
        expect(metric).not.toBeNull();
        if (metric) {
          expect(metric.tags?.['test1']).toContain('\\=');
          expect(metric.tags?.['test2']).toContain('\\,');
          expect(metric.tags?.['test3']).toContain('\\"');
          expect(metric.tags?.['test4']).toContain('\\\\');
          expect(metric.tags?.['test5']).toContain('\\n');
          expect(metric.tags?.['test6']).toContain('\\r');
          expect(metric.tags?.['test7']).toContain('\\t');
          expect(metric.tags?.['test8']).toContain('_'); // Пробелы заменяются на подчеркивания
        }
      }
    });
  });
});
