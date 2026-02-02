/**
 * ESLint Plugin for RAG Systems
 * @fileoverview Rules for RAG (Retrieval-Augmented Generation) systems safety
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