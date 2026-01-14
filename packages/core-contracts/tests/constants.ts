/**
 * @file Тестовые константы (fixtures) для core-contracts.
 *
 * Важно:
 * - Импортируется как `../../constants.js` из ESM-TS тестов (TS -> JS extension mapping).
 * - Значения не содержат PII и предназначены только для тестов.
 */

// IDs (UUID-like строки) для unit/integration тестов
export const TEST_USER_ID = 'user-1';
export const TEST_WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440010';
export const TEST_THREAD_ID = '550e8400-e29b-41d4-a716-446655440020';
export const TEST_BOT_ID = '550e8400-e29b-41d4-a716-446655440030';

// Domain enums / literals
export const STATUS_ACTIVE = 'active' as const;
export const STATUS_DRAFT = 'draft' as const;

export const USER_ROLE = 'user' as const;
export const DEFAULT_ROLE = 'assistant' as const;
export const SYSTEM_ROLE = 'system' as const;

// Misc fixtures
export const TEST_BOT_NAME = 'Test Bot';
export const TEST_MESSAGE_CONTENT = 'Hello from tests';
export const TEST_INSTRUCTION = 'You are a helpful assistant.';

// Auth fixtures
export const TOKEN_TYPE_BEARER = 'bearer' as const;
