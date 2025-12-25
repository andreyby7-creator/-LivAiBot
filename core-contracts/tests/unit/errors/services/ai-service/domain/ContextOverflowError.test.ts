import { describe, expect, it } from 'vitest';

import {
  createContextOverflowError,
  createConversationHistoryOverflowError,
  createDocumentOverflowError,
  createStreamingContextOverflowError,
  createSystemPromptOverflowError,
  createTokenLimitExceededError,
  getOverflowPercentage,
  getRecommendedTruncationStrategy,
  isConversationHistoryError,
  isCriticalOverflow,
  isDocumentOverflowError,
  isStreamingOverflowError,
  isSystemPromptError,
  isTokenLimitError,
  isValidContextOverflowErrorContext,
} from '../../../../../../src/errors/services/ai-service/domain/index.js';
import type {
  ContextLimitRule,
  ContextOverflowError,
  ContextOverflowErrorContext,
} from '../../../../../../src/errors/services/ai-service/domain/index.js';
import {
  ERROR_CATEGORY,
  ERROR_ORIGIN,
  ERROR_SEVERITY,
} from '../../../../../../src/errors/base/ErrorConstants.js';

// ==================== MOCKS И HELPER FUNCTIONS ====================

/** Создает mock ContextOverflowErrorContext для тестов */
function createMockContextOverflowContext(
  overrides: Partial<ContextOverflowErrorContext> = {},
): ContextOverflowErrorContext {
  return {
    type: 'context_overflow',
    limitRule: 'token_limit_exceeded',
    contextLength: 5000,
    maxAllowedLength: 4000,
    overflowAmount: 1000,
    contextType: 'conversation',
    truncationStrategy: 'sliding_window',
    recoverableParts: [
      { content: 'Important message', priority: 1, metadata: { type: 'user_input' } },
    ],
    lostParts: [
      { content: 'Old message', reason: 'truncation', metadata: { age: '2h' } },
    ],
    optimizationSuggestions: ['Use shorter messages', 'Compress context'],
    processingTimeMs: 150,
    targetModel: 'gpt-4',
    ...overrides,
  };
}

/** Создает mock ContextOverflowError для тестов */
function createMockContextOverflowError(
  contextOverrides: Partial<ContextOverflowErrorContext> = {},
  messageOverrides: Partial<{ code: string; message: string; timestamp: string; }> = {},
): ContextOverflowError {
  return createContextOverflowError(
    (messageOverrides.code ?? 'SERVICE_AI_TOKEN_LIMIT_EXCEEDED') as any,
    messageOverrides.message ?? 'Test context overflow error',
    'token_limit_exceeded',
    5000,
    4000,
    contextOverrides,
    messageOverrides.timestamp,
  );
}

// ==================== TESTS ====================

describe('ContextOverflowError', () => {
  describe('Типы и интерфейсы', () => {
    it('должен корректно определять ContextLimitRule типы', () => {
      const validRules: ContextLimitRule[] = [
        'token_limit_exceeded',
        'conversation_history_overflow',
        'system_prompt_overflow',
        'document_size_overflow',
        'streaming_context_overflow',
      ];

      expect(validRules).toHaveLength(5);
      validRules.forEach((rule) => {
        expect(typeof rule).toBe('string');
      });
    });

    it('должен корректно определять ContextOverflowErrorContext интерфейс', () => {
      const context: ContextOverflowErrorContext = createMockContextOverflowContext();

      expect(context.type).toBe('context_overflow');
      expect(context.limitRule).toBe('token_limit_exceeded');
      expect(context.contextLength).toBe(5000);
      expect(context.maxAllowedLength).toBe(4000);
      expect(context.overflowAmount).toBe(1000);
      expect(context.contextType).toBe('conversation');
      expect(context.truncationStrategy).toBe('sliding_window');
      expect(Array.isArray(context.recoverableParts)).toBe(true);
      expect(Array.isArray(context.lostParts)).toBe(true);
      expect(Array.isArray(context.optimizationSuggestions)).toBe(true);
      expect(context.processingTimeMs).toBe(150);
      expect(context.targetModel).toBe('gpt-4');
    });
  });

  describe('createContextOverflowError', () => {
    it('должен создавать базовую ошибку с минимальными параметрами', () => {
      const error = createContextOverflowError(
        'SERVICE_AI_TOKEN_LIMIT_EXCEEDED' as any,
        'Context overflow',
        'token_limit_exceeded',
        5000,
        4000,
      );

      expect(error._tag).toBe('ContextOverflowError');
      expect(error.category).toBe(ERROR_CATEGORY.BUSINESS);
      expect(error.origin).toBe(ERROR_ORIGIN.DOMAIN);
      expect(error.severity).toBe(ERROR_SEVERITY.MEDIUM);
      expect(error.code).toBe('SERVICE_AI_TOKEN_LIMIT_EXCEEDED');
      expect(error.message).toBe('Context overflow');
      expect(error.details.type).toBe('context_overflow');
      expect(error.details.limitRule).toBe('token_limit_exceeded');
      expect(error.details.contextLength).toBe(5000);
      expect(error.details.maxAllowedLength).toBe(4000);
      expect(error.details.overflowAmount).toBe(1000);
      expect(typeof error.timestamp).toBe('string');
    });

    it('должен создавать ошибку с полным контекстом', () => {
      const context = createMockContextOverflowContext();
      const error = createContextOverflowError(
        'SERVICE_AI_TOKEN_LIMIT_EXCEEDED' as any,
        'Full context overflow',
        'token_limit_exceeded',
        5000,
        4000,
        context,
      );

      expect(error.details.contextType).toBe('conversation');
      expect(error.details.truncationStrategy).toBe('sliding_window');
      expect(error.details.recoverableParts).toHaveLength(1);
      expect(error.details.lostParts).toHaveLength(1);
      expect(error.details.optimizationSuggestions).toHaveLength(2);
      expect(error.details.processingTimeMs).toBe(150);
      expect(error.details.targetModel).toBe('gpt-4');
    });

    it('должен правильно рассчитывать overflowAmount', () => {
      const error = createContextOverflowError(
        'TEST_CODE' as any,
        'Test',
        'token_limit_exceeded',
        100,
        80,
      );

      expect(error.details.overflowAmount).toBe(20);
    });

    it('должен использовать переданный timestamp', () => {
      const customTimestamp = '2024-01-01T00:00:00.000Z';
      const error = createContextOverflowError(
        'TEST_CODE' as any,
        'Test',
        'token_limit_exceeded',
        100,
        80,
        undefined,
        customTimestamp,
      );

      expect(error.timestamp).toBe(customTimestamp);
    });

    it('должен генерировать timestamp автоматически если не передан', () => {
      const before = new Date();
      const error = createContextOverflowError(
        'TEST_CODE' as any,
        'Test',
        'token_limit_exceeded',
        100,
        80,
      );
      const after = new Date();

      const errorTime = new Date(error.timestamp);
      expect(errorTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(errorTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('createTokenLimitExceededError', () => {
    it('должен создавать ошибку превышения токенов с базовыми параметрами', () => {
      const error = createTokenLimitExceededError(5000, 4000);

      expect(error.code).toBe('SERVICE_AI_TOKEN_LIMIT_EXCEEDED');
      expect(error.message).toContain('Контекст превышает лимит токенов модели');
      expect(error.message).toContain('5000/4000');
      expect(error.message).toContain('1000 токенов превышения');
      expect(error.details.limitRule).toBe('token_limit_exceeded');
      expect(error.details.contextType).toBe('conversation');
      expect(error.details.truncationStrategy).toBe('sliding_window');
      expect(error.details.optimizationSuggestions).toHaveLength(4);
    });

    it('должен создавать ошибку с targetModel', () => {
      const error = createTokenLimitExceededError(5000, 4000, 'gpt-4');

      expect(error.details.targetModel).toBe('gpt-4');
      // Сообщение не содержит название модели, только общий текст
      expect(error.message).toContain('Контекст превышает лимит токенов модели');
    });

    it('должен игнорировать пустой targetModel', () => {
      const error = createTokenLimitExceededError(5000, 4000, '');

      expect(error.details.targetModel).toBeUndefined();
    });

    it('должен игнорировать пробельный targetModel', () => {
      const error = createTokenLimitExceededError(5000, 4000, '   ');

      expect(error.details.targetModel).toBeUndefined();
    });

    it('должен обрабатывать recoverableParts с ограничением MAX_RECOVERABLE_PARTS', () => {
      const recoverableParts = Array.from({ length: 10 }, (_, i) => ({
        content: `Part ${i}`,
        priority: i,
        metadata: { index: i },
      }));

      const error = createTokenLimitExceededError(5000, 4000, 'gpt-4', recoverableParts);

      expect(error.details.recoverableParts).toHaveLength(5); // MAX_RECOVERABLE_PARTS = 5
    });

    it('должен корректно обрабатывать пустой массив recoverableParts', () => {
      const error = createTokenLimitExceededError(5000, 4000, 'gpt-4', []);

      expect(error.details.recoverableParts).toEqual([]);
    });
  });

  describe('createConversationHistoryOverflowError', () => {
    it('должен создавать ошибку превышения истории чата', () => {
      const error = createConversationHistoryOverflowError(100, 50, 5000, 4000);

      expect(error.code).toBe('SERVICE_AI_TOKEN_LIMIT_EXCEEDED');
      expect(error.message).toContain('История чата слишком длинная');
      expect(error.message).toContain('100/50 сообщений');
      expect(error.message).toContain('5000/4000 токенов');
      expect(error.details.limitRule).toBe('conversation_history_overflow');
      expect(error.details.contextType).toBe('conversation');
      expect(error.details.truncationStrategy).toBe('head');
      expect(error.details.lostParts).toHaveLength(1);
      expect(error.details.lostParts![0].content).toBe('50 старых сообщений');
      expect(error.details.lostParts![0].reason).toBe('history_truncation');
      expect(error.details.lostParts![0].metadata).toEqual({ messageCount: 50 });
      expect(error.details.optimizationSuggestions).toHaveLength(3);
    });

    it('должен правильно рассчитывать overflowMessages', () => {
      const error = createConversationHistoryOverflowError(25, 20, 1000, 800);

      expect(error.details.lostParts![0].content).toBe('5 старых сообщений');
      expect(error.details.lostParts![0].metadata).toEqual({ messageCount: 5 });
    });
  });

  describe('createSystemPromptOverflowError', () => {
    it('должен создавать ошибку превышения системного промпта', () => {
      const error = createSystemPromptOverflowError(5000, 4000, 'gpt-4');

      expect(error.code).toBe('SERVICE_AI_TOKEN_LIMIT_EXCEEDED');
      expect(error.message).toContain('Системный промпт слишком длинный для модели gpt-4');
      expect(error.message).toContain('5000/4000 символов');
      expect(error.message).toContain('1000 превышение');
      expect(error.details.limitRule).toBe('system_prompt_overflow');
      expect(error.details.contextType).toBe('system_prompt');
      expect(error.details.truncationStrategy).toBe('tail');
      expect(error.details.targetModel).toBe('gpt-4');
      expect(error.details.optimizationSuggestions).toHaveLength(4);
    });
  });

  describe('createDocumentOverflowError', () => {
    it('должен создавать ошибку превышения размера документа без recoverableContent', () => {
      const error = createDocumentOverflowError(1000000, 500000, 'pdf');

      expect(error.code).toBe('SERVICE_AI_TOKEN_LIMIT_EXCEEDED');
      expect(error.message).toContain('Документ pdf слишком большой');
      expect(error.message).toContain('1000000/500000 байт');
      expect(error.message).toContain('500000 байт превышения');
      expect(error.details.limitRule).toBe('document_size_overflow');
      expect(error.details.contextType).toBe('document');
      expect(error.details.truncationStrategy).toBe('middle');
      expect(error.details.recoverableParts).toBeUndefined();
      expect(error.details.optimizationSuggestions).toHaveLength(4);
    });

    it('должен создавать ошибку с recoverableContent', () => {
      const error = createDocumentOverflowError(1000000, 500000, 'pdf', 'Important content');

      expect(error.details.recoverableParts).toHaveLength(1);
      expect(error.details.recoverableParts![0].content).toBe('Important content');
      expect(error.details.recoverableParts![0].priority).toBe(1);
      expect(error.details.recoverableParts![0].metadata).toEqual({ documentType: 'pdf' });
    });

    it('должен игнорировать пустой recoverableContent', () => {
      const error = createDocumentOverflowError(1000000, 500000, 'pdf', '');

      expect(error.details.recoverableParts).toBeUndefined();
    });

    it('должен игнорировать пробельный recoverableContent', () => {
      const error = createDocumentOverflowError(1000000, 500000, 'pdf', '   ');

      expect(error.details.recoverableParts).toBeUndefined();
    });
  });

  describe('createStreamingContextOverflowError', () => {
    it('должен создавать ошибку превышения стриминга', () => {
      const error = createStreamingContextOverflowError(5000, 4000, 1500);

      expect(error.code).toBe('SERVICE_AI_TOKEN_LIMIT_EXCEEDED');
      expect(error.message).toContain('Стриминг прерван из-за превышения контекста');
      expect(error.message).toContain('5000/4000 токенов');
      expect(error.message).toContain('длительность: 1500ms');
      expect(error.details.limitRule).toBe('streaming_context_overflow');
      expect(error.details.contextType).toBe('streaming');
      expect(error.details.truncationStrategy).toBe('tail');
      expect(error.details.processingTimeMs).toBe(1500);
      expect(error.details.optimizationSuggestions).toHaveLength(3);
    });
  });

  describe('isValidContextOverflowErrorContext', () => {
    it('должен возвращать true для валидного контекста', () => {
      const context = createMockContextOverflowContext();
      expect(isValidContextOverflowErrorContext(context)).toBe(true);
    });

    it('должен возвращать false для null/undefined', () => {
      expect(isValidContextOverflowErrorContext(null)).toBe(false);
      expect(isValidContextOverflowErrorContext(undefined)).toBe(false);
    });

    it('должен возвращать false для не-объектов', () => {
      expect(isValidContextOverflowErrorContext('string')).toBe(false);
      expect(isValidContextOverflowErrorContext(123)).toBe(false);
      expect(isValidContextOverflowErrorContext([])).toBe(false);
    });

    it('должен проверять обязательное поле type', () => {
      const context = { ...createMockContextOverflowContext(), type: undefined };
      expect(isValidContextOverflowErrorContext(context)).toBe(false);

      const context2 = { ...createMockContextOverflowContext(), type: 'wrong_type' };
      expect(isValidContextOverflowErrorContext(context2)).toBe(false);
    });

    it('должен проверять валидность limitRule', () => {
      const context = { ...createMockContextOverflowContext(), limitRule: 'invalid_rule' as any };
      expect(isValidContextOverflowErrorContext(context)).toBe(false);

      const context2 = { ...createMockContextOverflowContext(), limitRule: undefined as any };
      expect(isValidContextOverflowErrorContext(context2)).toBe(false);
    });

    it('должен проверять числовые поля', () => {
      const context = { ...createMockContextOverflowContext(), contextLength: '5000' as any };
      expect(isValidContextOverflowErrorContext(context)).toBe(false);

      const context2 = { ...createMockContextOverflowContext(), maxAllowedLength: null as any };
      expect(isValidContextOverflowErrorContext(context2)).toBe(false);

      const context3 = { ...createMockContextOverflowContext(), overflowAmount: undefined as any };
      expect(isValidContextOverflowErrorContext(context3)).toBe(false);
    });

    it('должен проверять опциональные строковые поля', () => {
      const context = { ...createMockContextOverflowContext(), contextType: 123 as any };
      expect(isValidContextOverflowErrorContext(context)).toBe(false);
    });

    it('должен проверять truncationStrategy', () => {
      const context = {
        ...createMockContextOverflowContext(),
        truncationStrategy: 'invalid' as any,
      };
      expect(isValidContextOverflowErrorContext(context)).toBe(false);
    });

    it('должен проверять массивы', () => {
      const context = {
        ...createMockContextOverflowContext(),
        recoverableParts: 'not_array' as any,
      };
      expect(isValidContextOverflowErrorContext(context)).toBe(false);

      const context2 = { ...createMockContextOverflowContext(), lostParts: {} as any };
      expect(isValidContextOverflowErrorContext(context2)).toBe(false);

      const context3 = {
        ...createMockContextOverflowContext(),
        optimizationSuggestions: 123 as any,
      };
      expect(isValidContextOverflowErrorContext(context3)).toBe(false);
    });

    it('должен проверять processingTimeMs', () => {
      const context = { ...createMockContextOverflowContext(), processingTimeMs: '150' as any };
      expect(isValidContextOverflowErrorContext(context)).toBe(false);
    });

    it('должен проверять targetModel', () => {
      const context = { ...createMockContextOverflowContext(), targetModel: [] as any };
      expect(isValidContextOverflowErrorContext(context)).toBe(false);
    });

    it('должен принимать контекст с минимальными обязательными полями', () => {
      const minimalContext: ContextOverflowErrorContext = {
        type: 'context_overflow',
        limitRule: 'token_limit_exceeded',
        contextLength: 100,
        maxAllowedLength: 80,
        overflowAmount: 20,
      };
      expect(isValidContextOverflowErrorContext(minimalContext)).toBe(true);
    });
  });

  describe('Type Guards', () => {
    it('isTokenLimitError должен правильно определять тип ошибки', () => {
      const tokenError = createTokenLimitExceededError(100, 80);
      const historyError = createConversationHistoryOverflowError(10, 5, 100, 80);

      expect(isTokenLimitError(tokenError)).toBe(true);
      expect(isTokenLimitError(historyError)).toBe(false);
    });

    it('isConversationHistoryError должен правильно определять тип ошибки', () => {
      const historyError = createConversationHistoryOverflowError(10, 5, 100, 80);
      const tokenError = createTokenLimitExceededError(100, 80);

      expect(isConversationHistoryError(historyError)).toBe(true);
      expect(isConversationHistoryError(tokenError)).toBe(false);
    });

    it('isSystemPromptError должен правильно определять тип ошибки', () => {
      const promptError = createSystemPromptOverflowError(100, 80, 'gpt-4');
      const tokenError = createTokenLimitExceededError(100, 80);

      expect(isSystemPromptError(promptError)).toBe(true);
      expect(isSystemPromptError(tokenError)).toBe(false);
    });

    it('isDocumentOverflowError должен правильно определять тип ошибки', () => {
      const docError = createDocumentOverflowError(1000, 500, 'pdf');
      const tokenError = createTokenLimitExceededError(100, 80);

      expect(isDocumentOverflowError(docError)).toBe(true);
      expect(isDocumentOverflowError(tokenError)).toBe(false);
    });

    it('isStreamingOverflowError должен правильно определять тип ошибки', () => {
      const streamError = createStreamingContextOverflowError(100, 80, 1000);
      const tokenError = createTokenLimitExceededError(100, 80);

      expect(isStreamingOverflowError(streamError)).toBe(true);
      expect(isStreamingOverflowError(tokenError)).toBe(false);
    });
  });

  describe('Utility Functions', () => {
    it('getOverflowPercentage должен правильно рассчитывать процент', () => {
      const error = createMockContextOverflowError();

      expect(getOverflowPercentage(error)).toBe(25); // (5000-4000)/4000 * 100 = 25
    });

    it('getOverflowPercentage должен округлять результат', () => {
      const error = createContextOverflowError(
        'TEST' as any,
        'Test',
        'token_limit_exceeded',
        100,
        80,
      );

      expect(getOverflowPercentage(error)).toBe(25); // (100-80)/80 * 100 = 25
    });

    it('isCriticalOverflow должен определять критичность (>50%)', () => {
      const criticalError = createContextOverflowError(
        'TEST' as any,
        'Test',
        'token_limit_exceeded',
        121,
        80, // 51.25% overflow (>50%)
      );

      const nonCriticalError = createContextOverflowError(
        'TEST' as any,
        'Test',
        'token_limit_exceeded',
        120,
        80, // 50% overflow (=50%, не >50%)
      );

      expect(isCriticalOverflow(criticalError)).toBe(true);
      expect(isCriticalOverflow(nonCriticalError)).toBe(false);
    });

    it('getRecommendedTruncationStrategy должен возвращать стратегию из ошибки', () => {
      const error = createMockContextOverflowError({
        truncationStrategy: 'tail',
      });

      expect(getRecommendedTruncationStrategy(error)).toBe('tail');
    });

    it('getRecommendedTruncationStrategy должен возвращать sliding_window по умолчанию', () => {
      const error = createMockContextOverflowError({
        truncationStrategy: undefined,
      });

      expect(getRecommendedTruncationStrategy(error)).toBe('sliding_window');
    });
  });

  describe('Интеграционные тесты', () => {
    it('должен работать полный цикл создания и валидации ошибки', () => {
      // Создаем ошибку
      const error = createTokenLimitExceededError(10000, 8000, 'gpt-4', [
        { content: 'Important context', priority: 1 },
      ]);

      // Проверяем структуру
      expect(error._tag).toBe('ContextOverflowError');
      expect(error.details.type).toBe('context_overflow');

      // Проверяем валидность контекста
      expect(isValidContextOverflowErrorContext(error.details)).toBe(true);

      // Проверяем type guards
      expect(isTokenLimitError(error)).toBe(true);
      expect(isConversationHistoryError(error)).toBe(false);

      // Проверяем утилиты
      expect(getOverflowPercentage(error)).toBe(25);
      expect(isCriticalOverflow(error)).toBe(false);
      expect(getRecommendedTruncationStrategy(error)).toBe('sliding_window');
    });

    it('должен корректно обрабатывать все типы limitRule', () => {
      const testCases: {
        factory: (...args: any[]) => ContextOverflowError;
        args: any[];
        expectedRule: ContextLimitRule;
        guard: (error: ContextOverflowError) => boolean;
      }[] = [
        {
          factory: createTokenLimitExceededError,
          args: [100, 80],
          expectedRule: 'token_limit_exceeded',
          guard: isTokenLimitError,
        },
        {
          factory: createConversationHistoryOverflowError,
          args: [10, 5, 100, 80],
          expectedRule: 'conversation_history_overflow',
          guard: isConversationHistoryError,
        },
        {
          factory: createSystemPromptOverflowError,
          args: [100, 80, 'gpt-4'],
          expectedRule: 'system_prompt_overflow',
          guard: isSystemPromptError,
        },
        {
          factory: createDocumentOverflowError,
          args: [1000, 500, 'pdf'],
          expectedRule: 'document_size_overflow',
          guard: isDocumentOverflowError,
        },
        {
          factory: createStreamingContextOverflowError,
          args: [100, 80, 1000],
          expectedRule: 'streaming_context_overflow',
          guard: isStreamingOverflowError,
        },
      ];

      testCases.forEach(({ factory, args, expectedRule, guard }) => {
        const error = factory(...args);
        expect(error.details.limitRule).toBe(expectedRule);
        expect(guard(error)).toBe(true);
      });
    });
  });
});
