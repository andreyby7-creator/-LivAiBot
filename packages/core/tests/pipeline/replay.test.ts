/* eslint-disable ai-security/model-poisoning -- В тестах используются контролируемые данные, не требующие валидации на model poisoning */
/**
 * @file Unit тесты для Replay (Dependency-Driven Pipeline Engine)
 * Полное покрытие всех функций и веток исполнения (100%)
 */
import { describe, expect, it, vi } from 'vitest';

import type {
  ContextSanitizer,
  MetadataFactory,
  ReplayCaptureConfig,
  ReplayEvent,
  ReplayEventFilter,
} from '../../src/pipeline/replay.js';
import {
  applyFilters,
  captureReplayEvent,
  createCombinedFilter,
  createCombinedSanitizer,
  createFieldRemovalSanitizer,
  createReplayEvent,
  createTransformSanitizer,
  DEFAULT_INCLUDE_PII,
  DEFAULT_MAX_EVENTS_PER_MINUTE,
  defaultEventIdGenerator,
  deterministicEventIdGenerator,
  formatTimestamp,
  shouldCaptureEvent,
} from '../../src/pipeline/replay.js';

/* ============================================================================
 * 🔧 HELPER FUNCTIONS FOR TEST DATA
 * ============================================================================
 */

type TestEventData = Readonly<{
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
}>;

type TestContext = Readonly<{
  readonly userId: string;
  readonly sessionId: string;
  readonly ipAddress: string;
  readonly userAgent: string;
}>;

type TestMetadata = Readonly<{
  readonly priority: 'low' | 'medium' | 'high';
  readonly category: string;
  readonly tags: readonly string[];
}>;

type TestReplayConfig = ReplayCaptureConfig<TestEventData, TestContext, TestMetadata>;

function createTestEventData(overrides: Partial<TestEventData> = {}): TestEventData {
  return {
    eventType: 'pipeline_execution',
    payload: { step: 'validation', result: 'success' },
    ...overrides,
  };
}

function createTestContext(overrides: Partial<TestContext> = {}): TestContext {
  return {
    userId: 'user123',
    sessionId: 'session456',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (compatible; TestBot/1.0)',
    ...overrides,
  };
}

function createTestMetadata(overrides: Partial<TestMetadata> = {}): TestMetadata {
  return {
    priority: 'medium',
    category: 'pipeline',
    tags: ['test', 'execution'],
    ...overrides,
  };
}

function createTestReplayConfig(overrides: Partial<TestReplayConfig> = {}): TestReplayConfig {
  return {
    enabled: true,
    maxEventsPerMinute: 100,
    includePII: false,
    sanitizeContext: createFieldRemovalSanitizer(['ipAddress', 'userAgent']),
    ...overrides,
  };
}

function createTestReplayEvent(
  overrides: Partial<ReplayEvent<TestEventData, TestContext, TestMetadata>> = {},
): ReplayEvent<TestEventData, TestContext, TestMetadata> {
  return {
    eventId: 'test-event-123',
    timestamp: '2024-01-01T12:00:00.000Z',
    eventData: createTestEventData(),
    context: createTestContext(),
    metadata: createTestMetadata(),
    ...overrides,
  };
}

function createTestFilter(
  overrides: Partial<ReplayEventFilter<TestEventData, TestContext, TestMetadata>> = {},
): ReplayEventFilter<TestEventData, TestContext, TestMetadata> {
  return {
    filterId: 'test_filter',
    evaluate: vi.fn().mockReturnValue(true),
    ...overrides,
  };
}

/* ============================================================================
 * 🧪 CONSTANTS & TYPES — TESTS
 * ============================================================================
 */

describe('Constants & Types', () => {
  describe('DEFAULT_MAX_EVENTS_PER_MINUTE', () => {
    it('должен быть 1000', () => {
      expect(DEFAULT_MAX_EVENTS_PER_MINUTE).toBe(1000);
    });
  });

  describe('DEFAULT_INCLUDE_PII', () => {
    it('должен быть false', () => {
      expect(DEFAULT_INCLUDE_PII).toBe(false);
    });
  });
});

/* ============================================================================
 * 🧪 HELPERS — UTILITY FUNCTIONS
 * ============================================================================
 */

describe('Helpers - Utility Functions', () => {
  describe('defaultEventIdGenerator', () => {
    it('должен генерировать ID с timestamp и random частью', () => {
      const now = 1640995200000; // 2022-01-01T00:00:00.000Z
      const id = defaultEventIdGenerator(now);

      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
      expect(id).toContain(now.toString());
    });

    it('должен использовать Date.now() по умолчанию', () => {
      const id = defaultEventIdGenerator();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    });

    it('должен генерировать уникальные ID при последовательных вызовах', () => {
      const now = 1640995200000;
      const id1 = defaultEventIdGenerator(now);
      const id2 = defaultEventIdGenerator(now);

      expect(id1).not.toBe(id2);
      expect(id1).toContain(now.toString());
      expect(id2).toContain(now.toString());
    });
  });

  describe('deterministicEventIdGenerator', () => {
    it('должен генерировать ID только с timestamp', () => {
      const now = 1640995200000;
      const id = deterministicEventIdGenerator(now);

      expect(id).toBe(now.toString());
    });

    it('должен использовать Date.now() по умолчанию', () => {
      const id = deterministicEventIdGenerator();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^\d+$/);
    });
  });

  describe('formatTimestamp', () => {
    it('должен форматировать timestamp в ISO 8601', () => {
      const timestamp = 1640995200000; // 2022-01-01T00:00:00.000Z
      const result = formatTimestamp(timestamp);

      expect(result).toBe('2022-01-01T00:00:00.000Z');
    });

    it('должен использовать Date.now() по умолчанию', () => {
      const result = formatTimestamp();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('shouldCaptureEvent', () => {
    it('должен возвращать true когда количество событий меньше лимита', () => {
      expect(shouldCaptureEvent(50, 100)).toBe(true);
      expect(shouldCaptureEvent(0, 100)).toBe(true);
      expect(shouldCaptureEvent(99, 100)).toBe(true);
    });

    it('должен возвращать false когда количество событий равно лимиту', () => {
      expect(shouldCaptureEvent(100, 100)).toBe(false);
      expect(shouldCaptureEvent(1000, 1000)).toBe(false);
    });

    it('должен возвращать false когда количество событий превышает лимит', () => {
      expect(shouldCaptureEvent(150, 100)).toBe(false);
      expect(shouldCaptureEvent(1001, 1000)).toBe(false);
    });

    it('должен использовать DEFAULT_MAX_EVENTS_PER_MINUTE когда лимит не указан', () => {
      expect(shouldCaptureEvent(999)).toBe(true);
      expect(shouldCaptureEvent(1000)).toBe(false);
      expect(shouldCaptureEvent(1001)).toBe(false);
    });
  });

  describe('applyFilters', () => {
    it('должен возвращать true когда нет фильтров', () => {
      const event = createTestReplayEvent();
      const result = applyFilters(event, []);
      expect(result).toBe(true);
    });

    it('должен возвращать true когда все фильтры проходят', () => {
      const event = createTestReplayEvent();
      const filter1 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
      const filter2 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
      const filters = [filter1, filter2];

      const result = applyFilters(event, filters);

      expect(result).toBe(true);
      expect(filter1.evaluate).toHaveBeenCalledWith(event);
      expect(filter2.evaluate).toHaveBeenCalledWith(event);
    });

    it('должен возвращать false когда первый фильтр не проходит', () => {
      const event = createTestReplayEvent();
      const filter1 = createTestFilter({ evaluate: vi.fn().mockReturnValue(false) });
      const filter2 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
      const filters = [filter1, filter2];

      const result = applyFilters(event, filters);

      expect(result).toBe(false);
      expect(filter1.evaluate).toHaveBeenCalledWith(event);
      expect(filter2.evaluate).not.toHaveBeenCalled();
    });

    it('должен возвращать false когда промежуточный фильтр не проходит', () => {
      const event = createTestReplayEvent();
      const filter1 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
      const filter2 = createTestFilter({ evaluate: vi.fn().mockReturnValue(false) });
      const filter3 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
      const filters = [filter1, filter2, filter3];

      const result = applyFilters(event, filters);

      expect(result).toBe(false);
      expect(filter1.evaluate).toHaveBeenCalledWith(event);
      expect(filter2.evaluate).toHaveBeenCalledWith(event);
      expect(filter3.evaluate).not.toHaveBeenCalled();
    });

    it('должен вызывать onFilterApplied callback для каждого фильтра', () => {
      const event = createTestReplayEvent();
      const filter1 = createTestFilter({
        filterId: 'filter1',
        evaluate: vi.fn().mockReturnValue(true),
      });
      const filter2 = createTestFilter({
        filterId: 'filter2',
        evaluate: vi.fn().mockReturnValue(true),
      });
      const filters = [filter1, filter2];
      const onFilterApplied = vi.fn();
      const now = 1000;

      applyFilters(event, filters, onFilterApplied, now);

      expect(onFilterApplied).toHaveBeenCalledTimes(2);
      expect(onFilterApplied).toHaveBeenNthCalledWith(1, {
        filterId: 'filter1',
        passed: true,
        timestamp: now,
      });
      expect(onFilterApplied).toHaveBeenNthCalledWith(2, {
        filterId: 'filter2',
        passed: true,
        timestamp: now,
      });
    });

    it('должен использовать Date.now() по умолчанию для timestamp', () => {
      const event = createTestReplayEvent();
      const filter = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
      const onFilterApplied = vi.fn();

      applyFilters(event, [filter], onFilterApplied);

      expect(onFilterApplied).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
        }),
      );
    });
  });
});

/* ============================================================================
 * 🧪 FILTERS — FILTER FACTORIES
 * ============================================================================
 */

describe('Filters - Filter Factories', () => {
  describe('createCombinedFilter', () => {
    it('должен возвращать true когда все фильтры проходят', () => {
      const event = createTestReplayEvent();
      const filter1 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
      const filter2 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
      const combinedFilter = createCombinedFilter([filter1, filter2], 'combined');

      const result = combinedFilter.evaluate(event);

      expect(result).toBe(true);
      expect(filter1.evaluate).toHaveBeenCalledWith(event);
      expect(filter2.evaluate).toHaveBeenCalledWith(event);
    });

    it('должен возвращать false когда хотя бы один фильтр не проходит', () => {
      const event = createTestReplayEvent();
      const filter1 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
      const filter2 = createTestFilter({ evaluate: vi.fn().mockReturnValue(false) });
      const filter3 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
      const combinedFilter = createCombinedFilter([filter1, filter2, filter3], 'combined');

      const result = combinedFilter.evaluate(event);

      expect(result).toBe(false);
      expect(filter1.evaluate).toHaveBeenCalledWith(event);
      expect(filter2.evaluate).toHaveBeenCalledWith(event);
      expect(filter3.evaluate).not.toHaveBeenCalled();
    });

    it('должен иметь правильный filterId', () => {
      const filter1 = createTestFilter();
      const combinedFilter = createCombinedFilter([filter1], 'my_combined_filter');

      expect(combinedFilter.filterId).toBe('my_combined_filter');
    });

    it('должен использовать дефолтный filterId', () => {
      const filter1 = createTestFilter();
      const combinedFilter = createCombinedFilter([filter1]);

      expect(combinedFilter.filterId).toBe('combined_filter');
    });

    it('должен работать с пустым массивом фильтров', () => {
      const event = createTestReplayEvent();
      const combinedFilter = createCombinedFilter([], 'empty');

      const result = combinedFilter.evaluate(event);

      expect(result).toBe(true); // AND логика с пустым массивом = true
    });
  });
});

/* ============================================================================
 * 🧪 SANITIZERS — SANITIZER FACTORIES
 * ============================================================================
 */

describe('Sanitizers - Sanitizer Factories', () => {
  describe('createFieldRemovalSanitizer', () => {
    it('должен удалять указанные поля из контекста', () => {
      const sanitizer = createFieldRemovalSanitizer(['ipAddress', 'userAgent']);
      const context = createTestContext({
        userId: 'user123',
        sessionId: 'session456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      const result = sanitizer(context);

      expect(result).toEqual({
        userId: 'user123',
        sessionId: 'session456',
      });
      expect(result).not.toHaveProperty('ipAddress');
      expect(result).not.toHaveProperty('userAgent');
    });

    it('должен возвращать оригинальный контекст когда массив полей пустой', () => {
      const sanitizer = createFieldRemovalSanitizer([]);
      const context = createTestContext();

      const result = sanitizer(context);

      expect(result).toBe(context);
    });

    it('должен работать с несуществующими полями', () => {
      const sanitizer = createFieldRemovalSanitizer(['nonExistentField' as keyof TestContext]);
      const context = createTestContext();

      const result = sanitizer(context);

      expect(result).toEqual(context);
    });

    it('должен возвращать новый объект (immutable)', () => {
      const sanitizer = createFieldRemovalSanitizer(['ipAddress']);
      const context = createTestContext();

      const result = sanitizer(context);

      expect(result).not.toBe(context);
      expect(context).toHaveProperty('ipAddress'); // оригинал не изменился
    });
  });

  describe('createTransformSanitizer', () => {
    it('должен применять функцию трансформации', () => {
      const transform = vi.fn().mockImplementation((context) => ({
        ...context,
        userId: 'ANONYMOUS',
        ipAddress: 'REDACTED',
      }));
      const sanitizer = createTransformSanitizer(transform);
      const context = createTestContext();

      const result = sanitizer(context);

      expect(transform).toHaveBeenCalledWith(context);
      expect(result.userId).toBe('ANONYMOUS');
      expect(result.ipAddress).toBe('REDACTED');
    });
  });

  describe('createCombinedSanitizer', () => {
    it('должен применять санитизаторы последовательно', () => {
      const sanitizer1: ContextSanitizer<TestContext> = (context) => ({
        ...context,
        ipAddress: 'SANITIZED_1',
      });
      const sanitizer2: ContextSanitizer<TestContext> = (context) => ({
        ...context,
        userAgent: 'SANITIZED_2',
      });
      const combinedSanitizer = createCombinedSanitizer([sanitizer1, sanitizer2]);
      const context = createTestContext();

      const result = combinedSanitizer(context);

      expect(result.ipAddress).toBe('SANITIZED_1');
      expect(result.userAgent).toBe('SANITIZED_2');
      expect(result.userId).toBe(context.userId);
      expect(result.sessionId).toBe(context.sessionId);
    });

    it('должен работать с пустым массивом санитизаторов', () => {
      const combinedSanitizer = createCombinedSanitizer([]);
      const context = createTestContext();

      const result = combinedSanitizer(context);

      expect(result).toBe(context);
    });

    it('должен возвращать результат последнего санитизатора в цепочке', () => {
      const sanitizer1: ContextSanitizer<TestContext> = (context) => ({
        ...context,
        userId: 'MODIFIED_1',
      });
      const sanitizer2: ContextSanitizer<TestContext> = (context) => ({
        ...context,
        userId: 'MODIFIED_2',
      });
      const combinedSanitizer = createCombinedSanitizer([sanitizer1, sanitizer2]);
      const context = createTestContext();

      const result = combinedSanitizer(context);

      expect(result.userId).toBe('MODIFIED_2');
    });
  });
});

/* ============================================================================
 * 🧪 API — PUBLIC FUNCTIONS
 * ============================================================================
 */

describe('API - Public Functions', () => {
  describe('createReplayEvent', () => {
    it('должен создавать replay event с санитизированным контекстом', () => {
      const eventData = createTestEventData();
      const context = createTestContext();
      const config = createTestReplayConfig({
        includePII: false,
        sanitizeContext: createFieldRemovalSanitizer(['ipAddress', 'userAgent']),
      });
      const now = 1640995200000;

      const result = createReplayEvent(eventData, context, config, undefined, now);

      expect(result.eventId).toMatch(/^\d+-[a-z0-9]+$/);
      expect(result.timestamp).toBe('2022-01-01T00:00:00.000Z');
      expect(result.eventData).toBe(eventData);
      expect(result.context).toEqual({
        userId: 'user123',
        sessionId: 'session456',
      });
      expect(result.context).not.toHaveProperty('ipAddress');
      expect(result.context).not.toHaveProperty('userAgent');
      expect(result.metadata).toEqual({});
    });

    it('должен включать PII данные когда includePII = true', () => {
      const eventData = createTestEventData();
      const context = createTestContext();
      const config = createTestReplayConfig({
        includePII: true,
        // sanitizeContext не требуется когда includePII = true
      });
      const now = 1640995200000;

      const result = createReplayEvent(eventData, context, config, undefined, now);

      expect(result.context).toBe(context); // оригинальный контекст без санитизации
      expect(result.context).toHaveProperty('ipAddress');
      expect(result.context).toHaveProperty('userAgent');
    });

    it('должен бросать ошибку когда includePII = false и sanitizeContext не указан', () => {
      const eventData = createTestEventData();
      const context = createTestContext();
      // Создаем config без sanitizeContext вручную
      const config: TestReplayConfig = {
        enabled: true,
        includePII: false,
        // sanitizeContext не указан - должно вызвать ошибку
      };

      expect(() => {
        createReplayEvent(eventData, context, config);
      }).toThrow('sanitizeContext is required when includePII !== true');
    });

    it('должен использовать custom metadata factory', () => {
      const eventData = createTestEventData();
      const context = createTestContext();
      const config = createTestReplayConfig();
      const createMetadata: MetadataFactory<TestMetadata, TestEventData, TestContext> = vi.fn()
        .mockReturnValue(
          createTestMetadata({ priority: 'high', category: 'custom' }),
        );
      const now = 1640995200000;

      const result = createReplayEvent(eventData, context, config, createMetadata, now);

      expect(createMetadata).toHaveBeenCalledWith(eventData, expect.any(Object));
      expect(result.metadata.priority).toBe('high');
      expect(result.metadata.category).toBe('custom');
    });

    it('должен использовать createMetadata из config когда custom factory не указан', () => {
      const eventData = createTestEventData();
      const context = createTestContext();
      const createMetadata: MetadataFactory<TestMetadata, TestEventData, TestContext> = vi.fn()
        .mockReturnValue(
          createTestMetadata({ priority: 'low' }),
        );
      const config = createTestReplayConfig({
        createMetadata,
      });
      const now = 1640995200000;

      const result = createReplayEvent(eventData, context, config, undefined, now);

      expect(createMetadata).toHaveBeenCalledWith(eventData, expect.any(Object));
      expect(result.metadata.priority).toBe('low');
    });

    it('должен использовать deterministic event ID generator', () => {
      const eventData = createTestEventData();
      const context = createTestContext();
      const config = createTestReplayConfig({
        generateEventId: deterministicEventIdGenerator,
      });
      const now = 1640995200000;

      const result = createReplayEvent(eventData, context, config, undefined, now);

      expect(result.eventId).toBe(now.toString());
    });

    it('должен использовать default metadata когда createMetadata не указан', () => {
      const eventData = createTestEventData();
      const context = createTestContext();
      const config = createTestReplayConfig();
      const now = 1640995200000;

      const result = createReplayEvent(eventData, context, config, undefined, now);

      expect(result.metadata).toEqual({});
    });
  });

  describe('captureReplayEvent', () => {
    it('должен возвращать capture_disabled когда replay отключен', async () => {
      const event = createTestReplayEvent();
      const config = createTestReplayConfig({ enabled: false });
      const eventsInLastMinute = 0;

      const result = await captureReplayEvent(event, config, eventsInLastMinute);

      expect(result).toEqual({
        captured: false,
        reason: 'capture_disabled',
      });
    });

    it('должен возвращать rate_limit_exceeded когда превышен лимит событий', async () => {
      const event = createTestReplayEvent();
      const config = createTestReplayConfig({ enabled: true, maxEventsPerMinute: 10 });
      const eventsInLastMinute = 10;

      const result = await captureReplayEvent(event, config, eventsInLastMinute);

      expect(result).toEqual({
        captured: false,
        reason: 'rate_limit_exceeded',
      });
    });

    it('должен возвращать filter_rejected когда фильтр не проходит', async () => {
      const event = createTestReplayEvent();
      const filter = createTestFilter({ evaluate: vi.fn().mockReturnValue(false) });
      const config = createTestReplayConfig({
        enabled: true,
        filters: [filter],
      });
      const eventsInLastMinute = 0;

      const result = await captureReplayEvent(event, config, eventsInLastMinute);

      expect(result).toEqual({
        captured: false,
        reason: 'filter_rejected',
      });
      expect(filter.evaluate).toHaveBeenCalledWith(event);
    });

    it('должен сохранять событие через saveEvent когда фильтры проходят', async () => {
      const event = createTestReplayEvent();
      const saveEvent = vi.fn().mockResolvedValue(undefined);
      const config = createTestReplayConfig({
        enabled: true,
        saveEvent,
      });
      const eventsInLastMinute = 0;

      const result = await captureReplayEvent(event, config, eventsInLastMinute);

      expect(result).toEqual({
        captured: true,
      });
      expect(saveEvent).toHaveBeenCalledWith(event);
    });

    it('должен возвращать captured: true когда saveEvent не указан', async () => {
      const event = createTestReplayEvent();
      const config = createTestReplayConfig({
        enabled: true,
        // saveEvent не указан
      });
      const eventsInLastMinute = 0;

      const result = await captureReplayEvent(event, config, eventsInLastMinute);

      expect(result).toEqual({
        captured: true,
      });
    });

    it('должен обрабатывать ошибку в saveEvent', async () => {
      const event = createTestReplayEvent();
      const saveEvent = vi.fn().mockRejectedValue(new Error('Save failed'));
      const config = createTestReplayConfig({
        enabled: true,
        saveEvent,
      });
      const eventsInLastMinute = 0;

      const result = await captureReplayEvent(event, config, eventsInLastMinute);

      expect(result).toEqual({
        captured: false,
        reason: 'Save failed',
      });
    });

    it('должен применять множественные фильтры последовательно', async () => {
      const event = createTestReplayEvent();
      const filter1 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
      const filter2 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
      const filter3 = createTestFilter({ evaluate: vi.fn().mockReturnValue(false) });
      const config = createTestReplayConfig({
        enabled: true,
        filters: [filter1, filter2, filter3],
      });
      const eventsInLastMinute = 0;

      const result = await captureReplayEvent(event, config, eventsInLastMinute);

      expect(result).toEqual({
        captured: false,
        reason: 'filter_rejected',
      });
      expect(filter1.evaluate).toHaveBeenCalledWith(event);
      expect(filter2.evaluate).toHaveBeenCalledWith(event);
      expect(filter3.evaluate).toHaveBeenCalledWith(event);
    });

    it('должен вызывать onFilterApplied callback для каждого фильтра', async () => {
      const event = createTestReplayEvent();
      const filter1 = createTestFilter({
        filterId: 'filter1',
        evaluate: vi.fn().mockReturnValue(true),
      });
      const filter2 = createTestFilter({
        filterId: 'filter2',
        evaluate: vi.fn().mockReturnValue(true),
      });
      const config = createTestReplayConfig({
        enabled: true,
        filters: [filter1, filter2],
        saveEvent: vi.fn().mockResolvedValue(undefined),
      });
      const eventsInLastMinute = 0;
      const onFilterApplied = vi.fn();
      const now = 1000;

      await captureReplayEvent(event, config, eventsInLastMinute, onFilterApplied, now);

      expect(onFilterApplied).toHaveBeenCalledTimes(2);
      expect(onFilterApplied).toHaveBeenNthCalledWith(1, {
        filterId: 'filter1',
        passed: true,
        timestamp: now,
      });
      expect(onFilterApplied).toHaveBeenNthCalledWith(2, {
        filterId: 'filter2',
        passed: true,
        timestamp: now,
      });
    });

    it('должен использовать Date.now() по умолчанию', async () => {
      const event = createTestReplayEvent();
      const config = createTestReplayConfig({
        enabled: true,
        saveEvent: vi.fn().mockResolvedValue(undefined),
      });
      const eventsInLastMinute = 0;

      const result = await captureReplayEvent(event, config, eventsInLastMinute);

      expect(result).toEqual({
        captured: true,
      });
    });
  });
});

/* ============================================================================
 * 🧪 EDGE CASES & INTEGRATION TESTS
 * ============================================================================
 */

describe('Edge Cases & Integration Tests', () => {
  it('createReplayEvent должен работать с пустыми метаданными', () => {
    const eventData = createTestEventData();
    const context = createTestContext();
    const config = createTestReplayConfig();
    const now = 1640995200000;

    const result = createReplayEvent(eventData, context, config, undefined, now);

    expect(result.metadata).toEqual({});
    expect(result.eventData).toBe(eventData);
  });

  it('applyFilters должен правильно short-circuit при false результате', () => {
    const event = createTestReplayEvent();
    const filter1 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
    const filter2 = createTestFilter({ evaluate: vi.fn().mockReturnValue(false) });
    const filter3 = createTestFilter({ evaluate: vi.fn().mockReturnValue(true) });
    const onFilterApplied = vi.fn();

    const result = applyFilters(event, [filter1, filter2, filter3], onFilterApplied);

    expect(result).toBe(false);
    expect(filter1.evaluate).toHaveBeenCalled();
    expect(filter2.evaluate).toHaveBeenCalled();
    expect(filter3.evaluate).not.toHaveBeenCalled();
    expect(onFilterApplied).toHaveBeenCalledTimes(2);
  });

  it('captureReplayEvent должен работать без фильтров', async () => {
    const event = createTestReplayEvent();
    const config = createTestReplayConfig({
      enabled: true,
      // filters не указаны
      saveEvent: vi.fn().mockResolvedValue(undefined),
    });
    const eventsInLastMinute = 5;

    const result = await captureReplayEvent(event, config, eventsInLastMinute);

    expect(result).toEqual({
      captured: true,
    });
  });

  it('createFieldRemovalSanitizer должен работать с типизированными ключами', () => {
    const sanitizer = createFieldRemovalSanitizer<TestContext>(['userId']);
    const context = createTestContext();

    const result = sanitizer(context);

    expect(result).not.toHaveProperty('userId');
    expect(result).toHaveProperty('sessionId');
    expect(result).toHaveProperty('ipAddress');
  });

  it('complex scenario: полная цепочка replay capture', async () => {
    // Создаем событие
    const eventData = createTestEventData({ eventType: 'pipeline_error' });
    const context = createTestContext();
    const config = createTestReplayConfig({
      enabled: true,
      maxEventsPerMinute: 100,
      includePII: false,
      sanitizeContext: createFieldRemovalSanitizer(['ipAddress']),
      filters: [
        createTestFilter({
          filterId: 'error_filter',
          evaluate: (event) => event.eventData.eventType === 'pipeline_error',
        }),
      ],
      saveEvent: vi.fn().mockResolvedValue(undefined),
      createMetadata: (eventData) => ({
        priority: eventData.eventType === 'pipeline_error' ? 'high' : 'low',
        category: 'pipeline',
        tags: ['test'],
      }),
      generateEventId: deterministicEventIdGenerator,
    });

    const now = 1640995200000;
    const event = createReplayEvent(eventData, context, config, undefined, now);

    // Проверяем создание события
    expect(event.eventId).toBe(now.toString());
    expect(event.timestamp).toBe('2022-01-01T00:00:00.000Z');
    expect(event.eventData).toBe(eventData);
    expect(event.context).not.toHaveProperty('ipAddress');
    expect(event.metadata.priority).toBe('high');

    // Захватываем событие
    const captureResult = await captureReplayEvent(event, config, 10, undefined, now);

    expect(captureResult.captured).toBe(true);
    expect(config.saveEvent).toHaveBeenCalledWith(event);
  });

  it('should handle unknown error types in saveEventSafely', async () => {
    const event = createTestReplayEvent();
    const saveEvent = vi.fn().mockRejectedValue('string error');
    const config = createTestReplayConfig({
      enabled: true,
      saveEvent,
    });

    const result = await captureReplayEvent(event, config, 0);

    expect(result).toEqual({
      captured: false,
      reason: 'save_error',
    });
  });
});
/* eslint-enable ai-security/model-poisoning -- Восстановление проверки model poisoning для остального кода */
