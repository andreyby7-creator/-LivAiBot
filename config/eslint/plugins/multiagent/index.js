/**
 * ESLint Plugin for Multi-Agent Systems
 * @fileoverview Rules for multi-agent systems safety and isolation
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