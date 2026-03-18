/**
 * @file config/eslint/plugins/multiagent/index.js
 * ============================================================================
 * 🛡️ ESLINT PLUGIN — MULTIAGENT GUARDS (LIVAI)
 * ============================================================================
 *
 * Назначение:
 * - Локальный ESLint-плагин guardrails для multi-agent кода
 * - Проверяет изоляцию агентов и безопасность оркестрации
 *
 * Подключение:
 * - Загружается из `config/eslint/constants.mjs` через `tryImport('./plugins/multiagent/index.js')`
 * - Используется как `@livai/multiagent/*` в `config/eslint/master.config.mjs`
 */

import agentIsolation from './rules/agent-isolation.js';
import orchestrationSafety from './rules/orchestration-safety.js';

export default {
  rules: {
    'agent-isolation': agentIsolation,
    'orchestration-safety': orchestrationSafety,
  },

  // Plugin metadata
  meta: {
    name: 'eslint-plugin-multiagent',
    version: '1.0.0',
  },
};