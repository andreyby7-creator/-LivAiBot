/**
 * Общие синтетические данные для тестов.
 *
 * Цель: не хранить реальные email/JWT/PII в репозитории и не триггерить ai-security правила.
 */
export const FAKE_EMAIL = 'user@example.com';
export const FAKE_EMAIL_WITH_TAG = 'user+tag@example.com';

// JWT-like, но не настоящий JWT (не начинается с eyJ...)
export const FAKE_JWT = 'ey.fake.header.fake.payload';

export const FAKE_PASSWORD = 'fakePassword123!';
export const FAKE_WORKSPACE_NAME = 'Fake Workspace';

// UUID-формат безопасен для тестов (не PII), но держим как константу для единообразия.
export const FAKE_UUID = '123e4567-e89b-12d3-a456-426614174000';
