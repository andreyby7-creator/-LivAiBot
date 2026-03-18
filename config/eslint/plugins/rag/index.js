/**
 * @file config/eslint/plugins/rag/index.js
 * ============================================================================
 * 🛡️ ESLINT PLUGIN — RAG GUARDS (LIVAI)
 * ============================================================================
 *
 * Назначение:
 * - Локальный ESLint-плагин guardrails для RAG (Retrieval-Augmented Generation)
 * - Проверяет изоляцию контекста, лимиты токенов и требования к цитированию источников
 *
 * Подключение:
 * - Загружается из `config/eslint/constants.mjs` через `tryImport('./plugins/rag/index.js')`
 * - Используется как `@livai/rag/*` в `config/eslint/master.config.mjs`
 */

import contextLeakage from './rules/context-leakage.js';
import tokenLimits from './rules/token-limits.js';
import sourceCitation from './rules/source-citation.js';

export default {
  rules: {
    'context-leakage': contextLeakage,
    'token-limits': tokenLimits,
    'source-citation': sourceCitation,
  },

  // Plugin metadata
  meta: {
    name: 'eslint-plugin-rag',
    version: '1.0.0',
  },
};