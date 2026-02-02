/**
 * ESLint Plugin for AI Security
 * @fileoverview Rules for AI security compliance and safety
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