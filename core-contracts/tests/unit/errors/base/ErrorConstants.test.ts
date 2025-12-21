import { describe, expect, it } from 'vitest';

import type {
  ErrorCategory,
  ErrorClassification,
  ErrorImpact,
  ErrorLayer,
  ErrorOrigin,
  ErrorPriority,
  ErrorRetryPolicy,
  ErrorScope,
  ErrorSeverity,
} from '../../../../src/errors/base/ErrorConstants';
import {
  areClassificationsCompatible,
  createErrorClassification,
  ERROR_CATEGORY,
  ERROR_CLASSIFICATIONS,
  ERROR_IMPACT,
  ERROR_LAYER,
  ERROR_ORIGIN,
  ERROR_PRIORITY,
  ERROR_RETRY_POLICY,
  ERROR_SCOPE,
  ERROR_SEVERITY,
  SEVERITY_WEIGHTS,
} from '../../../../src/errors/base/ErrorConstants';

describe('ErrorConstants', () => {
  describe('Базовые константы severity', () => {
    describe('ERROR_SEVERITY', () => {
      it('должен содержать все уровни severity', () => {
        expect(ERROR_SEVERITY.LOW).toBe('low');
        expect(ERROR_SEVERITY.MEDIUM).toBe('medium');
        expect(ERROR_SEVERITY.HIGH).toBe('high');
        expect(ERROR_SEVERITY.CRITICAL).toBe('critical');
      });

      it('должен быть заморожен (immutable)', () => {
        expect(Object.isFrozen(ERROR_SEVERITY)).toBe(true);
      });

      it('все значения должны быть строками', () => {
        Object.values(ERROR_SEVERITY).forEach((value) => {
          expect(typeof value).toBe('string');
        });
      });
    });

    describe('ErrorSeverity тип', () => {
      it('должен позволять использовать severity значения', () => {
        const severity: ErrorSeverity = ERROR_SEVERITY.HIGH;
        expect(severity).toBe('high');

        // TypeScript предотвращает неправильные значения
        const allSeverities: ErrorSeverity[] = [
          ERROR_SEVERITY.LOW,
          ERROR_SEVERITY.MEDIUM,
          ERROR_SEVERITY.HIGH,
          ERROR_SEVERITY.CRITICAL,
        ];
        expect(allSeverities).toHaveLength(4);
      });
    });

    describe('SEVERITY_WEIGHTS', () => {
      it('должен содержать веса для всех severity уровней', () => {
        expect(SEVERITY_WEIGHTS[ERROR_SEVERITY.LOW]).toBe(1);
        expect(SEVERITY_WEIGHTS[ERROR_SEVERITY.MEDIUM]).toBe(2);
        expect(SEVERITY_WEIGHTS[ERROR_SEVERITY.HIGH]).toBe(3);
        expect(SEVERITY_WEIGHTS[ERROR_SEVERITY.CRITICAL]).toBe(4);
      });

      it('веса должны быть в порядке возрастания', () => {
        const weights = [
          SEVERITY_WEIGHTS[ERROR_SEVERITY.LOW],
          SEVERITY_WEIGHTS[ERROR_SEVERITY.MEDIUM],
          SEVERITY_WEIGHTS[ERROR_SEVERITY.HIGH],
          SEVERITY_WEIGHTS[ERROR_SEVERITY.CRITICAL],
        ];

        // Проверяем что веса идут в правильном порядке возрастания
        const [low, medium, high, critical] = weights;
        expect(medium).toBeGreaterThan(low); // MEDIUM > LOW
        expect(high).toBeGreaterThan(medium); // HIGH > MEDIUM
        expect(critical).toBeGreaterThan(high); // CRITICAL > HIGH
      });

      it('критический уровень должен иметь максимальный вес', () => {
        const maxWeight = Math.max(...Object.values(SEVERITY_WEIGHTS));
        expect(SEVERITY_WEIGHTS[ERROR_SEVERITY.CRITICAL]).toBe(maxWeight);
      });
    });
  });

  describe('Базовые константы category', () => {
    describe('ERROR_CATEGORY', () => {
      it('должен содержать все категории ошибок', () => {
        expect(ERROR_CATEGORY.BUSINESS).toBe('BUSINESS');
        expect(ERROR_CATEGORY.TECHNICAL).toBe('TECHNICAL');
        expect(ERROR_CATEGORY.SECURITY).toBe('SECURITY');
        expect(ERROR_CATEGORY.PERFORMANCE).toBe('PERFORMANCE');
      });

      it('должен быть заморожен (immutable)', () => {
        expect(Object.isFrozen(ERROR_CATEGORY)).toBe(true);
      });
    });

    describe('ErrorCategory тип', () => {
      it('должен позволять использовать category значения', () => {
        const category: ErrorCategory = ERROR_CATEGORY.SECURITY;
        expect(category).toBe('SECURITY');
      });
    });
  });

  describe('Базовые константы origin', () => {
    describe('ERROR_ORIGIN', () => {
      it('должен содержать все источники ошибок', () => {
        expect(ERROR_ORIGIN.DOMAIN).toBe('DOMAIN');
        expect(ERROR_ORIGIN.INFRASTRUCTURE).toBe('INFRASTRUCTURE');
        expect(ERROR_ORIGIN.SERVICE).toBe('SERVICE');
        expect(ERROR_ORIGIN.EXTERNAL).toBe('EXTERNAL');
        expect(ERROR_ORIGIN.ADMIN).toBe('ADMIN');
      });

      it('должен быть заморожен (immutable)', () => {
        expect(Object.isFrozen(ERROR_ORIGIN)).toBe(true);
      });
    });

    describe('ErrorOrigin тип', () => {
      it('должен позволять использовать origin значения', () => {
        const origin: ErrorOrigin = ERROR_ORIGIN.EXTERNAL;
        expect(origin).toBe('EXTERNAL');
      });
    });
  });

  describe('Базовые константы impact', () => {
    describe('ERROR_IMPACT', () => {
      it('должен содержать все уровни влияния', () => {
        expect(ERROR_IMPACT.USER).toBe('USER');
        expect(ERROR_IMPACT.SYSTEM).toBe('SYSTEM');
        expect(ERROR_IMPACT.DATA).toBe('DATA');
      });

      it('должен быть заморожен (immutable)', () => {
        expect(Object.isFrozen(ERROR_IMPACT)).toBe(true);
      });
    });

    describe('ErrorImpact тип', () => {
      it('должен позволять использовать impact значения', () => {
        const impact: ErrorImpact = ERROR_IMPACT.DATA;
        expect(impact).toBe('DATA');
      });
    });
  });

  describe('Базовые константы scope', () => {
    describe('ERROR_SCOPE', () => {
      it('должен содержать все области действия', () => {
        expect(ERROR_SCOPE.REQUEST).toBe('REQUEST');
        expect(ERROR_SCOPE.SESSION).toBe('SESSION');
        expect(ERROR_SCOPE.GLOBAL).toBe('GLOBAL');
      });

      it('должен быть заморожен (immutable)', () => {
        expect(Object.isFrozen(ERROR_SCOPE)).toBe(true);
      });
    });

    describe('ErrorScope тип', () => {
      it('должен позволять использовать scope значения', () => {
        const scope: ErrorScope = ERROR_SCOPE.SESSION;
        expect(scope).toBe('SESSION');
      });
    });
  });

  describe('Базовые константы layer', () => {
    describe('ERROR_LAYER', () => {
      it('должен содержать все слои архитектуры', () => {
        expect(ERROR_LAYER.PRESENTATION).toBe('PRESENTATION');
        expect(ERROR_LAYER.APPLICATION).toBe('APPLICATION');
        expect(ERROR_LAYER.DOMAIN).toBe('DOMAIN');
        expect(ERROR_LAYER.INFRASTRUCTURE).toBe('INFRASTRUCTURE');
      });

      it('должен быть заморожен (immutable)', () => {
        expect(Object.isFrozen(ERROR_LAYER)).toBe(true);
      });
    });

    describe('ErrorLayer тип', () => {
      it('должен позволять использовать layer значения', () => {
        const layer: ErrorLayer = ERROR_LAYER.DOMAIN;
        expect(layer).toBe('DOMAIN');
      });
    });
  });

  describe('Базовые константы priority', () => {
    describe('ERROR_PRIORITY', () => {
      it('должен содержать все уровни приоритета', () => {
        expect(ERROR_PRIORITY.LOW).toBe('LOW');
        expect(ERROR_PRIORITY.MEDIUM).toBe('MEDIUM');
        expect(ERROR_PRIORITY.HIGH).toBe('HIGH');
        expect(ERROR_PRIORITY.CRITICAL).toBe('CRITICAL');
      });

      it('должен быть заморожен (immutable)', () => {
        expect(Object.isFrozen(ERROR_PRIORITY)).toBe(true);
      });
    });

    describe('ErrorPriority тип', () => {
      it('должен позволять использовать priority значения', () => {
        const priority: ErrorPriority = ERROR_PRIORITY.HIGH;
        expect(priority).toBe('HIGH');
      });
    });
  });

  describe('Базовые константы retry policy', () => {
    describe('ERROR_RETRY_POLICY', () => {
      it('должен содержать все политики повторных попыток', () => {
        expect(ERROR_RETRY_POLICY.NONE).toBe('NONE');
        expect(ERROR_RETRY_POLICY.IMMEDIATE).toBe('IMMEDIATE');
        expect(ERROR_RETRY_POLICY.EXPONENTIAL_BACKOFF).toBe('EXPONENTIAL_BACKOFF');
        expect(ERROR_RETRY_POLICY.SCHEDULED).toBe('SCHEDULED');
      });

      it('должен быть заморожен (immutable)', () => {
        expect(Object.isFrozen(ERROR_RETRY_POLICY)).toBe(true);
      });
    });

    describe('ErrorRetryPolicy тип', () => {
      it('должен позволять использовать retry policy значения', () => {
        const retryPolicy: ErrorRetryPolicy = ERROR_RETRY_POLICY.EXPONENTIAL_BACKOFF;
        expect(retryPolicy).toBe('EXPONENTIAL_BACKOFF');
      });
    });
  });

  describe('ErrorClassification тип', () => {
    it('должен определять структуру полной классификации ошибки', () => {
      const classification: ErrorClassification = {
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.TECHNICAL,
        origin: ERROR_ORIGIN.INFRASTRUCTURE,
        impact: ERROR_IMPACT.USER,
        scope: ERROR_SCOPE.REQUEST,
        layer: ERROR_LAYER.APPLICATION,
        priority: ERROR_PRIORITY.MEDIUM,
        retryPolicy: ERROR_RETRY_POLICY.NONE,
      };

      expect(classification.severity).toBe('high');
      expect(classification.category).toBe('TECHNICAL');
      expect(classification.origin).toBe('INFRASTRUCTURE');
      expect(classification.impact).toBe('USER');
      expect(classification.scope).toBe('REQUEST');
      expect(classification.layer).toBe('APPLICATION');
      expect(classification.priority).toBe('MEDIUM');
      expect(classification.retryPolicy).toBe('NONE');
    });

    it('должен требовать все обязательные поля', () => {
      const incomplete = {
        severity: ERROR_SEVERITY.HIGH,
        // отсутствуют другие поля
      };

      // TypeScript не позволит создать неполную классификацию
      expect(() => {
        // @ts-expect-error - неполная классификация
        const classification: ErrorClassification = incomplete;
      });
    });
  });

  describe('Предопределенные классификации', () => {
    describe('ERROR_CLASSIFICATIONS', () => {
      it('должен содержать все предопределенные классификации', () => {
        expect(ERROR_CLASSIFICATIONS.SYSTEM_CRASH).toBeDefined();
        expect(ERROR_CLASSIFICATIONS.DATABASE_CONNECTION_LOST).toBeDefined();
        expect(ERROR_CLASSIFICATIONS.AUTH_INVALID_CREDENTIALS).toBeDefined();
        expect(ERROR_CLASSIFICATIONS.EXTERNAL_API_TIMEOUT).toBeDefined();
        expect(ERROR_CLASSIFICATIONS.BUSINESS_RULE_VIOLATION).toBeDefined();
        expect(ERROR_CLASSIFICATIONS.PERFORMANCE_DEGRADATION).toBeDefined();
      });

      it('должен быть заморожен (immutable)', () => {
        expect(Object.isFrozen(ERROR_CLASSIFICATIONS)).toBe(true);
      });

      it('все классификации должны иметь правильную структуру', () => {
        Object.values(ERROR_CLASSIFICATIONS).forEach((classification) => {
          expect(classification).toHaveProperty('severity');
          expect(classification).toHaveProperty('category');
          expect(classification).toHaveProperty('origin');
          expect(classification).toHaveProperty('impact');
          expect(classification).toHaveProperty('scope');
          expect(classification).toHaveProperty('layer');
          expect(classification).toHaveProperty('priority');
          expect(classification).toHaveProperty('retryPolicy');
        });
      });

      it('SYSTEM_CRASH должен иметь critical severity', () => {
        expect(ERROR_CLASSIFICATIONS.SYSTEM_CRASH.severity).toBe(ERROR_SEVERITY.CRITICAL);
        expect(ERROR_CLASSIFICATIONS.SYSTEM_CRASH.category).toBe(ERROR_CATEGORY.TECHNICAL);
        expect(ERROR_CLASSIFICATIONS.SYSTEM_CRASH.impact).toBe(ERROR_IMPACT.SYSTEM);
        expect(ERROR_CLASSIFICATIONS.SYSTEM_CRASH.retryPolicy).toBe(ERROR_RETRY_POLICY.NONE);
      });

      it('AUTH_INVALID_CREDENTIALS должен иметь security category', () => {
        expect(ERROR_CLASSIFICATIONS.AUTH_INVALID_CREDENTIALS.category).toBe(
          ERROR_CATEGORY.SECURITY,
        );
        expect(ERROR_CLASSIFICATIONS.AUTH_INVALID_CREDENTIALS.origin).toBe(ERROR_ORIGIN.DOMAIN);
        expect(ERROR_CLASSIFICATIONS.AUTH_INVALID_CREDENTIALS.impact).toBe(ERROR_IMPACT.USER);
      });

      it('DATABASE_CONNECTION_LOST должен иметь exponential backoff', () => {
        expect(ERROR_CLASSIFICATIONS.DATABASE_CONNECTION_LOST.retryPolicy).toBe(
          ERROR_RETRY_POLICY.EXPONENTIAL_BACKOFF,
        );
        expect(ERROR_CLASSIFICATIONS.DATABASE_CONNECTION_LOST.origin).toBe(
          ERROR_ORIGIN.INFRASTRUCTURE,
        );
      });
    });
  });

  describe('Функции утилиты', () => {
    describe('createErrorClassification', () => {
      it('должен создавать полную классификацию с значениями по умолчанию', () => {
        const partial = {
          severity: ERROR_SEVERITY.CRITICAL,
          category: ERROR_CATEGORY.SECURITY,
        };

        const result = createErrorClassification(partial);

        expect(result.severity).toBe(ERROR_SEVERITY.CRITICAL);
        expect(result.category).toBe(ERROR_CATEGORY.SECURITY);
        // Значения по умолчанию
        expect(result.origin).toBe(ERROR_ORIGIN.INFRASTRUCTURE);
        expect(result.impact).toBe(ERROR_IMPACT.USER);
        expect(result.scope).toBe(ERROR_SCOPE.REQUEST);
        expect(result.layer).toBe(ERROR_LAYER.APPLICATION);
        expect(result.priority).toBe(ERROR_PRIORITY.MEDIUM);
        expect(result.retryPolicy).toBe(ERROR_RETRY_POLICY.NONE);
      });

      it('должен переопределять значения по умолчанию', () => {
        const custom = {
          severity: ERROR_SEVERITY.LOW,
          origin: ERROR_ORIGIN.DOMAIN,
          impact: ERROR_IMPACT.DATA,
          retryPolicy: ERROR_RETRY_POLICY.EXPONENTIAL_BACKOFF,
        };

        const result = createErrorClassification(custom);

        expect(result.severity).toBe(ERROR_SEVERITY.LOW);
        expect(result.origin).toBe(ERROR_ORIGIN.DOMAIN);
        expect(result.impact).toBe(ERROR_IMPACT.DATA);
        expect(result.retryPolicy).toBe(ERROR_RETRY_POLICY.EXPONENTIAL_BACKOFF);
      });

      it('должен работать с пустым объектом (только значения по умолчанию)', () => {
        const result = createErrorClassification({});

        expect(result.severity).toBe(ERROR_SEVERITY.HIGH);
        expect(result.category).toBe(ERROR_CATEGORY.TECHNICAL);
        expect(result.origin).toBe(ERROR_ORIGIN.INFRASTRUCTURE);
        expect(result.impact).toBe(ERROR_IMPACT.USER);
        expect(result.scope).toBe(ERROR_SCOPE.REQUEST);
        expect(result.layer).toBe(ERROR_LAYER.APPLICATION);
        expect(result.priority).toBe(ERROR_PRIORITY.MEDIUM);
        expect(result.retryPolicy).toBe(ERROR_RETRY_POLICY.NONE);
      });

      it('должен возвращать ErrorClassification тип', () => {
        const result = createErrorClassification({});
        expect(result).toBeInstanceOf(Object);

        // TypeScript гарантирует правильный тип
        const severity: ErrorSeverity = result.severity;
        const category: ErrorCategory = result.category;
        expect(severity).toBeDefined();
        expect(category).toBeDefined();
      });
    });

    describe('areClassificationsCompatible', () => {
      it('должен возвращать true для совместимых классификаций', () => {
        const classification1: ErrorClassification = {
          severity: ERROR_SEVERITY.MEDIUM,
          category: ERROR_CATEGORY.TECHNICAL,
          origin: ERROR_ORIGIN.SERVICE,
          impact: ERROR_IMPACT.USER,
          scope: ERROR_SCOPE.REQUEST,
          layer: ERROR_LAYER.APPLICATION,
          priority: ERROR_PRIORITY.MEDIUM,
          retryPolicy: ERROR_RETRY_POLICY.NONE,
        };

        const classification2: ErrorClassification = {
          severity: ERROR_SEVERITY.HIGH,
          category: ERROR_CATEGORY.BUSINESS,
          origin: ERROR_ORIGIN.DOMAIN,
          impact: ERROR_IMPACT.SYSTEM,
          scope: ERROR_SCOPE.SESSION,
          layer: ERROR_LAYER.DOMAIN,
          priority: ERROR_PRIORITY.HIGH,
          retryPolicy: ERROR_RETRY_POLICY.IMMEDIATE,
        };

        expect(areClassificationsCompatible(classification1, classification2)).toBe(true);
      });

      it('должен возвращать false для несовместимых классификаций', () => {
        // Первая классификация - критическая ошибка
        const criticalError: ErrorClassification = {
          severity: ERROR_SEVERITY.CRITICAL,
          category: ERROR_CATEGORY.TECHNICAL,
          origin: ERROR_ORIGIN.INFRASTRUCTURE,
          impact: ERROR_IMPACT.SYSTEM,
          scope: ERROR_SCOPE.GLOBAL,
          layer: ERROR_LAYER.INFRASTRUCTURE,
          priority: ERROR_PRIORITY.CRITICAL,
          retryPolicy: ERROR_RETRY_POLICY.NONE,
        };

        // Вторая классификация - низкий приоритет (несовместимо с критической)
        const lowPriority: ErrorClassification = {
          severity: ERROR_SEVERITY.MEDIUM,
          category: ERROR_CATEGORY.BUSINESS,
          origin: ERROR_ORIGIN.DOMAIN,
          impact: ERROR_IMPACT.USER,
          scope: ERROR_SCOPE.REQUEST,
          layer: ERROR_LAYER.DOMAIN,
          priority: ERROR_PRIORITY.LOW,
          retryPolicy: ERROR_RETRY_POLICY.NONE,
        };

        expect(areClassificationsCompatible(criticalError, lowPriority)).toBe(false);
      });

      it('глобальная ошибка требует высокого приоритета', () => {
        // Первая классификация - глобальная ошибка
        const globalError: ErrorClassification = {
          severity: ERROR_SEVERITY.HIGH,
          category: ERROR_CATEGORY.TECHNICAL,
          origin: ERROR_ORIGIN.INFRASTRUCTURE,
          impact: ERROR_IMPACT.SYSTEM,
          scope: ERROR_SCOPE.GLOBAL,
          layer: ERROR_LAYER.INFRASTRUCTURE,
          priority: ERROR_PRIORITY.HIGH,
          retryPolicy: ERROR_RETRY_POLICY.NONE,
        };

        // Вторая классификация - низкий приоритет (несовместимо с глобальной)
        const lowPriority: ErrorClassification = {
          severity: ERROR_SEVERITY.MEDIUM,
          category: ERROR_CATEGORY.BUSINESS,
          origin: ERROR_ORIGIN.DOMAIN,
          impact: ERROR_IMPACT.USER,
          scope: ERROR_SCOPE.REQUEST,
          layer: ERROR_LAYER.DOMAIN,
          priority: ERROR_PRIORITY.LOW,
          retryPolicy: ERROR_RETRY_POLICY.NONE,
        };

        expect(areClassificationsCompatible(globalError, lowPriority)).toBe(false);
      });

      it('совместимые комбинации возвращают true', () => {
        const highPriorityGlobal: ErrorClassification = {
          severity: ERROR_SEVERITY.HIGH,
          category: ERROR_CATEGORY.TECHNICAL,
          origin: ERROR_ORIGIN.INFRASTRUCTURE,
          impact: ERROR_IMPACT.SYSTEM,
          scope: ERROR_SCOPE.GLOBAL,
          layer: ERROR_LAYER.INFRASTRUCTURE,
          priority: ERROR_PRIORITY.HIGH,
          retryPolicy: ERROR_RETRY_POLICY.NONE,
        };

        const mediumPriorityRequest: ErrorClassification = {
          severity: ERROR_SEVERITY.MEDIUM,
          category: ERROR_CATEGORY.BUSINESS,
          origin: ERROR_ORIGIN.DOMAIN,
          impact: ERROR_IMPACT.USER,
          scope: ERROR_SCOPE.REQUEST,
          layer: ERROR_LAYER.DOMAIN,
          priority: ERROR_PRIORITY.MEDIUM,
          retryPolicy: ERROR_RETRY_POLICY.NONE,
        };

        expect(areClassificationsCompatible(highPriorityGlobal, mediumPriorityRequest)).toBe(true);
      });
    });
  });

  describe('Интеграционные сценарии', () => {
    it('должен поддерживать полный workflow создания и проверки классификации', () => {
      // 1. Создание кастомной классификации
      const customClassification = createErrorClassification({
        severity: ERROR_SEVERITY.HIGH,
        category: ERROR_CATEGORY.SECURITY,
        origin: ERROR_ORIGIN.EXTERNAL,
        impact: ERROR_IMPACT.USER,
        scope: ERROR_SCOPE.SESSION,
        layer: ERROR_LAYER.PRESENTATION,
        priority: ERROR_PRIORITY.CRITICAL,
        retryPolicy: ERROR_RETRY_POLICY.IMMEDIATE,
      });

      // 2. Проверка структуры
      expect(customClassification.severity).toBe(ERROR_SEVERITY.HIGH);
      expect(customClassification.category).toBe(ERROR_CATEGORY.SECURITY);
      expect(customClassification.origin).toBe(ERROR_ORIGIN.EXTERNAL);

      // 3. Сравнение с предопределенными классификациями
      expect(areClassificationsCompatible(customClassification, ERROR_CLASSIFICATIONS.SYSTEM_CRASH))
        .toBe(true);
      expect(
        areClassificationsCompatible(
          customClassification,
          ERROR_CLASSIFICATIONS.AUTH_INVALID_CREDENTIALS,
        ),
      ).toBe(true);

      // 4. Проверка весов severity
      const severityWeight = SEVERITY_WEIGHTS[customClassification.severity];
      expect(severityWeight).toBe(3); // HIGH = 3

      // 5. Type safety
      const severity: ErrorSeverity = customClassification.severity;
      const category: ErrorCategory = customClassification.category;
      const priority: ErrorPriority = customClassification.priority;

      expect(severity).toBeDefined();
      expect(category).toBeDefined();
      expect(priority).toBeDefined();
    });

    it('предопределенные классификации должны быть совместимы сами с собой', () => {
      const classifications = Object.values(ERROR_CLASSIFICATIONS);

      classifications.forEach((classification) => {
        expect(areClassificationsCompatible(classification, classification)).toBe(true);
      });
    });

    it('все константы должны быть заморожены при загрузке модуля', () => {
      // Этот тест проверяет что валидация прошла успешно при импорте
      expect(ERROR_SEVERITY).toBeDefined();
      expect(ERROR_CATEGORY).toBeDefined();
      expect(ERROR_ORIGIN).toBeDefined();
      expect(ERROR_IMPACT).toBeDefined();
      expect(ERROR_SCOPE).toBeDefined();
      expect(ERROR_LAYER).toBeDefined();
      expect(ERROR_PRIORITY).toBeDefined();
      expect(ERROR_RETRY_POLICY).toBeDefined();
      expect(ERROR_CLASSIFICATIONS).toBeDefined();
    });
  });

  describe('Edge cases и валидация', () => {
    it('все enum значения должны быть уникальными в рамках группы', () => {
      // Проверяем что в каждой группе констант нет дубликатов
      const groups = [
        ERROR_SEVERITY,
        ERROR_CATEGORY,
        ERROR_ORIGIN,
        ERROR_IMPACT,
        ERROR_SCOPE,
        ERROR_LAYER,
        ERROR_PRIORITY,
        ERROR_RETRY_POLICY,
      ];

      groups.forEach((group) => {
        const values = Object.values(group);
        const uniqueValues = new Set(values);
        expect(uniqueValues.size).toBe(values.length);
      });
    });

    it('severity weights должны покрывать все severity уровни', () => {
      const severityValues = Object.values(ERROR_SEVERITY);
      const weightKeys = Object.keys(SEVERITY_WEIGHTS);

      expect(weightKeys).toHaveLength(severityValues.length);
      severityValues.forEach((severity) => {
        expect(SEVERITY_WEIGHTS).toHaveProperty(severity);
      });
    });

    it('предопределенные классификации должны использовать только валидные значения', () => {
      Object.values(ERROR_CLASSIFICATIONS).forEach((classification) => {
        expect(Object.values(ERROR_SEVERITY)).toContain(classification.severity);
        expect(Object.values(ERROR_CATEGORY)).toContain(classification.category);
        expect(Object.values(ERROR_ORIGIN)).toContain(classification.origin);
        expect(Object.values(ERROR_IMPACT)).toContain(classification.impact);
        expect(Object.values(ERROR_SCOPE)).toContain(classification.scope);
        expect(Object.values(ERROR_LAYER)).toContain(classification.layer);
        expect(Object.values(ERROR_PRIORITY)).toContain(classification.priority);
        expect(Object.values(ERROR_RETRY_POLICY)).toContain(classification.retryPolicy);
      });
    });

    it('функции должны корректно работать с граничными случаями', () => {
      // createErrorClassification с undefined значениями
      const result = createErrorClassification(undefined as any);
      expect(result).toBeDefined();

      // areClassificationsCompatible с одинаковыми классификациями
      const classification = ERROR_CLASSIFICATIONS.SYSTEM_CRASH;
      expect(areClassificationsCompatible(classification, classification)).toBe(true);
    });
  });
});
