/**
 * @file @livai/feature-bots - Бизнес-логика ботов
 * Этот пакет содержит Бизнес-логика ботов для LivAi.
 */

/* ============================================================================
 * 📋 TYPES — Агрегирующие типы состояния и операций ботов
 * ============================================================================
 */

/**
 * Types подпакет: агрегирующие типы состояния и операций ботов.
 * Включает:
 * - BotState, BotStatus, BotError с категоризацией (validation, policy, permission, channel, webhook, parsing, integration)
 *   и severity ('low' | 'medium' | 'high') для telemetry/alerts, структуру error-mapping с кодами и контекстом
 * - Канонические начальные состояния Bot для reset-операций в store/effects,
 *   шаблоны для audit-событий (BotAuditEventTemplate), pipeline-hooks (BotPipelineHookTemplate)
 *   для автоматических действий при lifecycle-событиях
 * - Типы и константы команд ботов (create_bot_from_template, create_custom_bot, update_instruction,
 *   manage_multi_agent, publish_bot, pause/resume/archive, delete_bot, test_bot_simulator)
 * - Типы и константы событий ботов (bot_created, bot_published, bot_updated, bot_deleted,
 *   instruction_updated, multi_agent_updated, bot_paused/resumed/archived, config_changed)
 * @public
 */
export * from './types/index.js';
