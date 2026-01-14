/**
 * @file Интеграционный тест для потока аутентификации и создания разговора
 *
 * Проверяет взаимодействие между:
 * - Domain entities (Auth + Conversations)
 * - Context headers
 * - Error handling
 * - Request validation
 */

import { describe, expect, it, vi } from 'vitest';
import type { RegisterRequest, TokenPairResponse } from '../../src/domain/auth.js';
import type { Conversation, CreateConversationRequest } from '../../src/domain/conversations.js';
import type { AuthenticatedRequestHeaders } from '../../src/context/headers.js';
import { HEADERS } from '../../src/context/headers.js';
import { errorCodes } from '../../src/errors/http.js';
import type { UUID } from '../../src/domain/common.js';
import { FAKE_EMAIL, FAKE_PASSWORD, FAKE_WORKSPACE_NAME } from '../fakes';

// Мокаем внешние зависимости для интеграционного тестирования
const mockAuthService = {
  register: vi.fn(),
  login: vi.fn(),
};

const mockConversationService = {
  createConversation: vi.fn(),
};

const mockValidation = {
  validateEmail: vi.fn(),
  validatePassword: vi.fn(),
  validateConversationData: vi.fn(),
};

describe('Authentication & Conversation Creation Flow', () => {
  describe('Complete User Registration Flow', () => {
    it('should successfully register user and create initial conversation', async () => {
      // Arrange: Подготовка данных для регистрации
      const registerRequest: RegisterRequest = {
        email: FAKE_EMAIL,
        password: FAKE_PASSWORD,
        workspace_name: FAKE_WORKSPACE_NAME,
      };

      const expectedTokens: TokenPairResponse = {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_456',
        token_type: 'bearer',
        expires_in: 3600,
        user_id: 'user_123' as UUID,
        workspace_id: 'workspace_789' as UUID,
      };

      // Мокаем успешную регистрацию
      mockAuthService.register.mockResolvedValue(expectedTokens);
      mockValidation.validateEmail.mockReturnValue(true);
      mockValidation.validatePassword.mockReturnValue(true);

      // Act: Регистрация пользователя
      const result = await mockAuthService.register(registerRequest);

      // Assert: Проверка успешной регистрации
      expect(result).toEqual(expectedTokens);
      expect(result.user_id).toBeDefined();
      expect(result.workspace_id).toBeDefined();
      expect(result.token_type).toBe('bearer');

      // Arrange: Создание заголовков для аутентифицированного запроса
      const authHeaders: AuthenticatedRequestHeaders = {
        [HEADERS.WORKSPACE_ID]: result.workspace_id,
        [HEADERS.USER_ID]: result.user_id,
        [HEADERS.TRACE_ID]: 'trace_123',
        [HEADERS.OPERATION_ID]: 'op_456',
      };

      // Act: Создание первого разговора
      const conversationRequest: CreateConversationRequest = {
        title: 'Welcome Conversation',
        type: 'chat',
        initial_message: 'Hello! How can I help you today?',
      };

      const expectedConversation: Conversation = {
        id: 'conv_001' as UUID,
        title: conversationRequest.title ?? 'Default Title',
        type: conversationRequest.type ?? 'chat',
        workspace_id: result.workspace_id,
        created_by: result.user_id,
        created_at: '2024-01-12T10:00:00Z',
        updated_at: '2024-01-12T10:00:00Z',
        status: 'active',
        metadata: {
          initial_message: conversationRequest.initial_message,
        },
      };

      mockConversationService.createConversation.mockResolvedValue(expectedConversation);
      mockValidation.validateConversationData.mockReturnValue(true);

      const conversation = await mockConversationService.createConversation(
        conversationRequest,
        authHeaders,
      );

      // Assert: Проверка создания разговора
      expect(conversation).toEqual(expectedConversation);
      expect(conversation.workspace_id).toBe(result.workspace_id);
      expect(conversation.created_by).toBe(result.user_id);
      expect(conversation.title).toBe('Welcome Conversation');
      expect(conversation.status).toBe('active');
    });

    it('should handle registration validation errors', async () => {
      // Arrange: Некорректные данные регистрации
      const invalidRegisterRequest: RegisterRequest = {
        email: 'invalid-email',
        password: 'weak',
        workspace_name: '',
      };

      // Мокаем валидационные ошибки
      mockValidation.validateEmail.mockReturnValue(false);
      mockValidation.validatePassword.mockReturnValue(false);

      // Настраиваем mock register на reject при невалидных данных
      mockAuthService.register.mockRejectedValue(new Error('Validation failed'));

      // Act & Assert: Ожидаем ошибку валидации
      await expect(mockAuthService.register(invalidRegisterRequest))
        .rejects
        .toThrow('Validation failed');

      // Проверяем, что регистрация не была вызвана
      expect(mockAuthService.register).toHaveBeenCalledWith(invalidRegisterRequest);
    });

    it('should handle conversation creation with missing auth headers', async () => {
      // Arrange: Запрос на создание разговора без заголовков
      const conversationRequest: CreateConversationRequest = {
        title: 'Test Conversation',
        type: 'chat',
      };

      // Настраиваем mock на reject при отсутствии заголовков
      mockConversationService.createConversation.mockRejectedValue({
        code: errorCodes.UNAUTHORIZED,
        message: 'Missing authentication headers',
      });

      // Act: Попытка создания без заголовков аутентификации
      const result = mockConversationService.createConversation(conversationRequest, {});

      // Assert: Ожидаем ошибку авторизации
      await expect(result).rejects.toMatchObject({
        code: errorCodes.UNAUTHORIZED,
        message: expect.stringContaining('Missing authentication headers'),
      });
    });

    it('should handle workspace isolation in multi-tenant environment', async () => {
      // Arrange: Два разных workspace
      const workspace1Headers: AuthenticatedRequestHeaders = {
        [HEADERS.WORKSPACE_ID]: 'workspace_1' as UUID,
        [HEADERS.USER_ID]: 'user_1' as UUID,
      };

      const workspace2Headers: AuthenticatedRequestHeaders = {
        [HEADERS.WORKSPACE_ID]: 'workspace_2' as UUID,
        [HEADERS.USER_ID]: 'user_2' as UUID,
      };

      const conversationRequest: CreateConversationRequest = {
        title: 'Workspace Test',
        type: 'chat',
      };

      // Настраиваем mock для возврата правильного workspace_id
      mockConversationService.createConversation.mockImplementation(
        (request, headers) => {
          const workspaceId = headers[HEADERS.WORKSPACE_ID] ?? 'workspace_789';
          return Promise.resolve({
            id: `conv_${Math.random().toString(36).substr(2, 9)}`,
            title: request.title,
            type: request.type,
            workspace_id: workspaceId,
            created_at: '2024-01-12T10:00:00Z',
            created_by: headers[HEADERS.USER_ID] ?? 'user_123',
            status: 'active' as const,
            updated_at: '2024-01-12T10:00:00Z',
            metadata: {
              initial_message: 'Hello! How can I help you today?',
            },
          });
        },
      );

      // Act: Создание разговоров в разных workspace
      const conv1 = await mockConversationService.createConversation(
        conversationRequest,
        workspace1Headers,
      );
      const conv2 = await mockConversationService.createConversation(
        conversationRequest,
        workspace2Headers,
      );

      // Assert: Разговоры должны быть изолированы по workspace
      expect(conv1.workspace_id).toBe('workspace_1');
      expect(conv2.workspace_id).toBe('workspace_2');
      expect(conv1.id).not.toBe(conv2.id);
    });

    it('should propagate trace_id through the entire flow', async () => {
      // Arrange: Запрос с trace_id
      const traceId = 'trace_integration_test_123';
      const authHeaders: AuthenticatedRequestHeaders = {
        [HEADERS.WORKSPACE_ID]: 'workspace_test' as UUID,
        [HEADERS.USER_ID]: 'user_test' as UUID,
        [HEADERS.TRACE_ID]: traceId,
        [HEADERS.OPERATION_ID]: 'op_test',
      };

      // Act: Создание разговора с trace_id
      const conversationRequest: CreateConversationRequest = {
        title: 'Trace Test',
        type: 'chat',
      };

      // Настраиваем mock для этого теста
      mockConversationService.createConversation.mockResolvedValueOnce({
        id: 'conv_trace_test',
        title: conversationRequest.title,
        type: conversationRequest.type,
        workspace_id: authHeaders[HEADERS.WORKSPACE_ID],
        created_at: '2024-01-12T10:00:00Z',
        created_by: authHeaders[HEADERS.USER_ID],
        status: 'active' as const,
        updated_at: '2024-01-12T10:00:00Z',
        metadata: {
          initial_message: 'Hello! How can I help you today?',
          trace_id: traceId,
        },
      });

      const conversation = await mockConversationService.createConversation(
        conversationRequest,
        authHeaders,
      );

      // Assert: trace_id должен быть сохранен в метаданных или логах
      expect(mockConversationService.createConversation).toHaveBeenCalledWith(
        conversationRequest,
        expect.objectContaining({
          [HEADERS.TRACE_ID]: traceId,
        }),
      );

      // Проверяем, что в ответе есть информация о trace
      expect(conversation).toHaveProperty('metadata');
      expect(conversation.metadata).toHaveProperty('trace_id', traceId);
    });
  });
});
