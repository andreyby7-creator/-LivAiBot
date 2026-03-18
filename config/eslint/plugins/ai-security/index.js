/**
 * @file config/eslint/plugins/ai-security/index.js
 * ============================================================================
 * 🛡️ ESLINT PLUGIN — AI SECURITY (LIVAI)
 * ============================================================================
 *
 * Назначение:
 * - Локальный ESLint-плагин для AI Security guardrails
 * - Ищет потенциальные утечки/инъекции/PII в коде, где есть AI-контексты
 *
 * Подключение:
 * - Загружается из `config/eslint/constants.mjs` через `tryImport('./plugins/ai-security/index.js')`
 * - Используется как `ai-security/*` в `config/eslint/master.config.mjs`
 */

import piiDetection from './rules/pii-detection.js';
import tokenLeakage from './rules/token-leakage.js';
import promptInjection from './rules/prompt-injection.js';
import dataLeakage from './rules/data-leakage.js';
import modelPoisoning from './rules/model-poisoning.js';

export default {
  rules: {
    'pii-detection': piiDetection,
    'token-leakage': tokenLeakage,
    'prompt-injection': promptInjection,
    'data-leakage': dataLeakage,
    'model-poisoning': modelPoisoning,
  },

  // Plugin metadata
  meta: {
    name: 'eslint-plugin-ai-security',
    version: '1.0.0',
  },
};