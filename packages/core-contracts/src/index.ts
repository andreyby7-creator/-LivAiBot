/**
 * @file Core Contracts - Foundation layer для LivAi
 *
 * Содержит контракты API, типы ошибок и контекстные данные,
 * которые используются во всех сервисах и UI.
 */

// Ошибки и их коды
export * from './errors/index.js';

// Контекст (заголовки, etc.)
export * from './context/index.js';

// Доменные типы и DTO
export * from './domain/index.js';

// Runtime-валидация для frontend (Zod, автогенерация из OpenAPI + кастомные расширения)
export * from './validation/zod/index.js';
