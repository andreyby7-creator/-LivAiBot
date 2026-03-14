/**
 * @file Unit тесты для domain/MultiAgentSchema.ts
 * Покрывают MultiAgentSchema типы и createMultiAgentSchemaInvariantError.
 * Цель: 100% покрытие кода.
 */

import { describe, expect, it } from 'vitest';

import type {
  AgentCallTimeout,
  AgentEdge,
  AgentEdgeType,
  AgentGraph,
  AgentId,
  AgentNode,
  CallCondition,
  CallRule,
  CallRules,
  CallTrigger,
  Guardrail,
  Guardrails,
  MaxCallDepth,
  MaxCallsPerAgent,
  MultiAgentSchema,
  MultiAgentSchemaInvariantError,
  RulePriority,
  SwitchCondition,
  SwitchRule,
  SwitchRules,
  SwitchTrigger,
} from '../../../src/domain/MultiAgentSchema.js';
import { createMultiAgentSchemaInvariantError } from '../../../src/domain/MultiAgentSchema.js';

// ============================================================================
// Helper functions для создания тестовых данных
// ============================================================================

const createAgentId = (value = 'agent-1'): AgentId => value as AgentId;
const createMaxCallDepth = (value = 5): MaxCallDepth => value as MaxCallDepth;
const createMaxCallsPerAgent = (value = 10): MaxCallsPerAgent => value as MaxCallsPerAgent;
const createAgentCallTimeout = (value = 30000): AgentCallTimeout => value as AgentCallTimeout;
const createRulePriority = (value = 1): RulePriority => value as RulePriority;

// ============================================================================
// Тесты для createMultiAgentSchemaInvariantError
// ============================================================================

// eslint-disable-next-line ai-security/token-leakage -- false positive: function name, not a token
describe('createMultiAgentSchemaInvariantError', () => {
  it('создаёт Error с корректным name и сообщением', () => {
    const error = createMultiAgentSchemaInvariantError('test-message');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('MultiAgentSchemaInvariantError');
    expect(error.message).toBe('test-message');
  });

  it('сохраняет stack trace', () => {
    const error = createMultiAgentSchemaInvariantError('with-stack');

    expect(typeof error.stack).toBe('string');
    expect(error.stack).toBeTruthy();
  });

  it('создаёт frozen error объект', () => {
    const error = createMultiAgentSchemaInvariantError('frozen-test');

    expect(Object.isFrozen(error)).toBe(true);
  });

  it('работает с пустой строкой', () => {
    const error = createMultiAgentSchemaInvariantError('');

    expect(error.message).toBe('');
    expect(error.name).toBe('MultiAgentSchemaInvariantError');
  });

  it('работает с длинным сообщением', () => {
    const longMessage = 'a'.repeat(1000);
    const error = createMultiAgentSchemaInvariantError(longMessage);

    expect(error.message).toBe(longMessage);
  });

  it('создаёт ошибку, совместимую с MultiAgentSchemaInvariantError типом', () => {
    const error: MultiAgentSchemaInvariantError = createMultiAgentSchemaInvariantError('type-test');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('MultiAgentSchemaInvariantError');
  });
});

// ============================================================================
// Тесты для типов AgentId, MaxCallDepth, MaxCallsPerAgent, AgentCallTimeout, RulePriority
// ============================================================================

describe('Branded types', () => {
  it('создаёт AgentId', () => {
    const agentId: AgentId = createAgentId('test-agent');
    expect(agentId).toBe('test-agent');
  });

  it('создаёт MaxCallDepth', () => {
    const maxDepth: MaxCallDepth = createMaxCallDepth(10);
    expect(maxDepth).toBe(10);
  });

  it('создаёт MaxCallsPerAgent', () => {
    const maxCalls: MaxCallsPerAgent = createMaxCallsPerAgent(20);
    expect(maxCalls).toBe(20);
  });

  it('создаёт AgentCallTimeout', () => {
    const timeout: AgentCallTimeout = createAgentCallTimeout(60000);
    expect(timeout).toBe(60000);
  });

  it('создаёт RulePriority', () => {
    const priority: RulePriority = createRulePriority(5);
    expect(priority).toBe(5);
  });
});

// ============================================================================
// Тесты для AgentEdgeType
// ============================================================================

describe('AgentEdgeType', () => {
  it('поддерживает все значения union типа', () => {
    const callType: AgentEdgeType = 'call';
    const switchType: AgentEdgeType = 'switch';
    const fallbackType: AgentEdgeType = 'fallback';

    expect(callType).toBe('call');
    expect(switchType).toBe('switch');
    expect(fallbackType).toBe('fallback');
  });
});

// ============================================================================
// Тесты для AgentEdge
// ============================================================================

describe('AgentEdge', () => {
  it('создаёт корректный AgentEdge с типом call', () => {
    const edge: AgentEdge = {
      source: createAgentId('agent-1'),
      target: createAgentId('agent-2'),
      type: 'call',
    };

    expect(edge.source).toBe('agent-1');
    expect(edge.target).toBe('agent-2');
    expect(edge.type).toBe('call');
  });

  it('создаёт корректный AgentEdge с типом switch', () => {
    const edge: AgentEdge = {
      source: createAgentId('agent-1'),
      target: createAgentId('agent-2'),
      type: 'switch',
    };

    expect(edge.type).toBe('switch');
  });

  it('создаёт корректный AgentEdge с типом fallback', () => {
    const edge: AgentEdge = {
      source: createAgentId('agent-1'),
      target: createAgentId('agent-2'),
      type: 'fallback',
    };

    expect(edge.type).toBe('fallback');
  });
});

// ============================================================================
// Тесты для AgentNode
// ============================================================================

describe('AgentNode', () => {
  it('создаёт корневой узел', () => {
    const node: AgentNode = {
      id: createAgentId('root-agent'),
      isRoot: true,
    };

    expect(node.id).toBe('root-agent');
    expect(node.isRoot).toBe(true);
  });

  it('создаёт некорневой узел', () => {
    const node: AgentNode = {
      id: createAgentId('child-agent'),
      isRoot: false,
    };

    expect(node.id).toBe('child-agent');
    expect(node.isRoot).toBe(false);
  });
});

// ============================================================================
// Тесты для AgentGraph
// ============================================================================

describe('AgentGraph', () => {
  it('создаёт корректный AgentGraph', () => {
    const graph: AgentGraph = {
      nodes: [
        { id: createAgentId('agent-1'), isRoot: true },
        { id: createAgentId('agent-2'), isRoot: false },
      ],
      edges: [
        {
          source: createAgentId('agent-1'),
          target: createAgentId('agent-2'),
          type: 'call',
        },
      ],
    };

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.nodes[0]?.isRoot).toBe(true);
    expect(graph.nodes[1]?.isRoot).toBe(false);
  });

  it('создаёт пустой AgentGraph', () => {
    const graph: AgentGraph = {
      nodes: [],
      edges: [],
    };

    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });
});

// ============================================================================
// Тесты для SwitchTrigger
// ============================================================================

describe('SwitchTrigger', () => {
  it('поддерживает все значения union типа', () => {
    const triggers: SwitchTrigger[] = [
      'user_intent',
      'topic_match',
      'explicit_switch',
      'fallback',
      'timeout',
      'error_threshold',
    ];

    expect(triggers).toHaveLength(6);
    triggers.forEach((trigger) => {
      expect(typeof trigger).toBe('string');
    });
  });
});

// ============================================================================
// Тесты для SwitchCondition
// ============================================================================

describe('SwitchCondition', () => {
  it('создаёт condition с типом intent_match', () => {
    const condition: SwitchCondition = {
      type: 'intent_match',
      intents: ['intent-1', 'intent-2'],
    };

    expect(condition.type).toBe('intent_match');
    expect(condition.intents).toEqual(['intent-1', 'intent-2']);
  });

  it('создаёт condition с типом topic_match', () => {
    const condition: SwitchCondition = {
      type: 'topic_match',
      topics: ['topic-1', 'topic-2'],
    };

    expect(condition.type).toBe('topic_match');
    expect(condition.topics).toEqual(['topic-1', 'topic-2']);
  });

  it('создаёт condition с типом confidence_threshold', () => {
    const condition: SwitchCondition = {
      type: 'confidence_threshold',
      minConfidence: 0.8,
    };

    expect(condition.type).toBe('confidence_threshold');
    expect(condition.minConfidence).toBe(0.8);
  });

  it('создаёт condition с типом error_count_threshold', () => {
    const condition: SwitchCondition = {
      type: 'error_count_threshold',
      maxErrors: 5,
    };

    expect(condition.type).toBe('error_count_threshold');
    expect(condition.maxErrors).toBe(5);
  });
});

// ============================================================================
// Тесты для SwitchRule
// ============================================================================

describe('SwitchRule', () => {
  it('создаёт SwitchRule без conditions', () => {
    const rule: SwitchRule = {
      trigger: 'user_intent',
      targetAgent: createAgentId('agent-2'),
      priority: createRulePriority(1),
    };

    expect(rule.trigger).toBe('user_intent');
    expect(rule.targetAgent).toBe('agent-2');
    expect(rule.priority).toBe(1);
    expect(rule.conditions).toBeUndefined();
  });

  it('создаёт SwitchRule с conditions', () => {
    const rule: SwitchRule = {
      trigger: 'topic_match',
      targetAgent: createAgentId('agent-3'),
      priority: createRulePriority(2),
      conditions: {
        type: 'topic_match',
        topics: ['topic-1'],
      },
    };

    expect(rule.conditions).toBeDefined();
    expect(rule.conditions?.type).toBe('topic_match');
  });

  it('создаёт SwitchRule со всеми типами triggers', () => {
    const triggers: SwitchTrigger[] = [
      'user_intent',
      'topic_match',
      'explicit_switch',
      'fallback',
      'timeout',
      'error_threshold',
    ];

    triggers.forEach((trigger) => {
      const rule: SwitchRule = {
        trigger,
        targetAgent: createAgentId('agent-1'),
        priority: createRulePriority(1),
      };

      expect(rule.trigger).toBe(trigger);
    });
  });
});

// ============================================================================
// Тесты для SwitchRules
// ============================================================================

describe('SwitchRules', () => {
  it('создаёт массив SwitchRule', () => {
    const rules: SwitchRules = [
      {
        trigger: 'user_intent',
        targetAgent: createAgentId('agent-1'),
        priority: createRulePriority(1),
      },
      {
        trigger: 'topic_match',
        targetAgent: createAgentId('agent-2'),
        priority: createRulePriority(2),
      },
    ];

    expect(rules).toHaveLength(2);
    expect(rules[0]?.trigger).toBe('user_intent');
    expect(rules[1]?.trigger).toBe('topic_match');
  });

  it('создаёт пустой массив SwitchRules', () => {
    const rules: SwitchRules = [];

    expect(rules).toHaveLength(0);
  });
});

// ============================================================================
// Тесты для CallTrigger
// ============================================================================

describe('CallTrigger', () => {
  it('поддерживает все значения union типа', () => {
    const triggers: CallTrigger[] = [
      'function_call',
      'tool_required',
      'specialized_task',
      'explicit_call',
      'context_enrichment',
    ];

    expect(triggers).toHaveLength(5);
    triggers.forEach((trigger) => {
      expect(typeof trigger).toBe('string');
    });
  });
});

// ============================================================================
// Тесты для CallCondition
// ============================================================================

describe('CallCondition', () => {
  it('создаёт condition с типом function_name_match', () => {
    const condition: CallCondition = {
      type: 'function_name_match',
      functionNames: ['func-1', 'func-2'],
    };

    expect(condition.type).toBe('function_name_match');
    expect(condition.functionNames).toEqual(['func-1', 'func-2']);
  });

  it('создаёт condition с типом tool_type_match', () => {
    const condition: CallCondition = {
      type: 'tool_type_match',
      toolTypes: ['tool-1', 'tool-2'],
    };

    expect(condition.type).toBe('tool_type_match');
    expect(condition.toolTypes).toEqual(['tool-1', 'tool-2']);
  });

  it('создаёт condition с типом task_category_match', () => {
    const condition: CallCondition = {
      type: 'task_category_match',
      categories: ['category-1', 'category-2'],
    };

    expect(condition.type).toBe('task_category_match');
    expect(condition.categories).toEqual(['category-1', 'category-2']);
  });

  it('создаёт condition с типом context_key_match', () => {
    const condition: CallCondition = {
      type: 'context_key_match',
      requiredKeys: ['key-1', 'key-2'],
    };

    expect(condition.type).toBe('context_key_match');
    expect(condition.requiredKeys).toEqual(['key-1', 'key-2']);
  });
});

// ============================================================================
// Тесты для CallRule
// ============================================================================

describe('CallRule', () => {
  it('создаёт CallRule без conditions', () => {
    const rule: CallRule = {
      trigger: 'function_call',
      targetAgent: createAgentId('agent-2'),
      priority: createRulePriority(1),
    };

    expect(rule.trigger).toBe('function_call');
    expect(rule.targetAgent).toBe('agent-2');
    expect(rule.priority).toBe(1);
    expect(rule.conditions).toBeUndefined();
  });

  it('создаёт CallRule с conditions', () => {
    const rule: CallRule = {
      trigger: 'tool_required',
      targetAgent: createAgentId('agent-3'),
      priority: createRulePriority(2),
      conditions: {
        type: 'tool_type_match',
        toolTypes: ['tool-1'],
      },
    };

    expect(rule.conditions).toBeDefined();
    expect(rule.conditions?.type).toBe('tool_type_match');
  });

  it('создаёт CallRule со всеми типами triggers', () => {
    const triggers: CallTrigger[] = [
      'function_call',
      'tool_required',
      'specialized_task',
      'explicit_call',
      'context_enrichment',
    ];

    triggers.forEach((trigger) => {
      const rule: CallRule = {
        trigger,
        targetAgent: createAgentId('agent-1'),
        priority: createRulePriority(1),
      };

      expect(rule.trigger).toBe(trigger);
    });
  });
});

// ============================================================================
// Тесты для CallRules
// ============================================================================

describe('CallRules', () => {
  it('создаёт массив CallRule', () => {
    const rules: CallRules = [
      {
        trigger: 'function_call',
        targetAgent: createAgentId('agent-1'),
        priority: createRulePriority(1),
      },
      {
        trigger: 'tool_required',
        targetAgent: createAgentId('agent-2'),
        priority: createRulePriority(2),
      },
    ];

    expect(rules).toHaveLength(2);
    expect(rules[0]?.trigger).toBe('function_call');
    expect(rules[1]?.trigger).toBe('tool_required');
  });

  it('создаёт пустой массив CallRules', () => {
    const rules: CallRules = [];

    expect(rules).toHaveLength(0);
  });
});

// ============================================================================
// Тесты для Guardrail
// ============================================================================

describe('Guardrail', () => {
  it('создаёт guardrail с типом max_call_depth без agentId', () => {
    const guardrail: Guardrail = {
      type: 'max_call_depth',
      maxDepth: createMaxCallDepth(5),
    };

    expect(guardrail.type).toBe('max_call_depth');
    expect(guardrail.maxDepth).toBe(5);
    expect(guardrail.agentId).toBeUndefined();
  });

  it('создаёт guardrail с типом max_call_depth с agentId', () => {
    const guardrail: Guardrail = {
      type: 'max_call_depth',
      maxDepth: createMaxCallDepth(10),
      agentId: createAgentId('agent-1'),
    };

    expect(guardrail.type).toBe('max_call_depth');
    expect(guardrail.maxDepth).toBe(10);
    expect(guardrail.agentId).toBe('agent-1');
  });

  it('создаёт guardrail с типом max_calls_per_agent без agentId', () => {
    const guardrail: Guardrail = {
      type: 'max_calls_per_agent',
      maxCalls: createMaxCallsPerAgent(20),
    };

    expect(guardrail.type).toBe('max_calls_per_agent');
    expect(guardrail.maxCalls).toBe(20);
    expect(guardrail.agentId).toBeUndefined();
  });

  it('создаёт guardrail с типом max_calls_per_agent с agentId', () => {
    const guardrail: Guardrail = {
      type: 'max_calls_per_agent',
      maxCalls: createMaxCallsPerAgent(30),
      agentId: createAgentId('agent-2'),
    };

    expect(guardrail.type).toBe('max_calls_per_agent');
    expect(guardrail.maxCalls).toBe(30);
    expect(guardrail.agentId).toBe('agent-2');
  });

  it('создаёт guardrail с типом call_timeout без agentId', () => {
    const guardrail: Guardrail = {
      type: 'call_timeout',
      timeout: createAgentCallTimeout(30000),
    };

    expect(guardrail.type).toBe('call_timeout');
    expect(guardrail.timeout).toBe(30000);
    expect(guardrail.agentId).toBeUndefined();
  });

  it('создаёт guardrail с типом call_timeout с agentId', () => {
    const guardrail: Guardrail = {
      type: 'call_timeout',
      timeout: createAgentCallTimeout(60000),
      agentId: createAgentId('agent-3'),
    };

    expect(guardrail.type).toBe('call_timeout');
    expect(guardrail.timeout).toBe(60000);
    expect(guardrail.agentId).toBe('agent-3');
  });

  it('создаёт guardrail с типом circular_call_prevention без agentId', () => {
    const guardrail: Guardrail = {
      type: 'circular_call_prevention',
    };

    expect(guardrail.type).toBe('circular_call_prevention');
    expect(guardrail.agentId).toBeUndefined();
  });

  it('создаёт guardrail с типом circular_call_prevention с agentId', () => {
    const guardrail: Guardrail = {
      type: 'circular_call_prevention',
      agentId: createAgentId('agent-4'),
    };

    expect(guardrail.type).toBe('circular_call_prevention');
    expect(guardrail.agentId).toBe('agent-4');
  });
});

// ============================================================================
// Тесты для Guardrails
// ============================================================================

describe('Guardrails', () => {
  it('создаёт массив Guardrail', () => {
    const guardrails: Guardrails = [
      {
        type: 'max_call_depth',
        maxDepth: createMaxCallDepth(5),
      },
      {
        type: 'max_calls_per_agent',
        maxCalls: createMaxCallsPerAgent(10),
      },
      {
        type: 'call_timeout',
        timeout: createAgentCallTimeout(30000),
      },
      {
        type: 'circular_call_prevention',
      },
    ];

    expect(guardrails).toHaveLength(4);
    expect(guardrails[0]?.type).toBe('max_call_depth');
    expect(guardrails[1]?.type).toBe('max_calls_per_agent');
    expect(guardrails[2]?.type).toBe('call_timeout');
    expect(guardrails[3]?.type).toBe('circular_call_prevention');
  });

  it('создаёт пустой массив Guardrails', () => {
    const guardrails: Guardrails = [];

    expect(guardrails).toHaveLength(0);
  });
});

// ============================================================================
// Тесты для MultiAgentSchema
// ============================================================================

describe('MultiAgentSchema', () => {
  it('создаёт полный MultiAgentSchema', () => {
    const schema: MultiAgentSchema = {
      agentGraph: {
        nodes: [
          { id: createAgentId('agent-1'), isRoot: true },
          { id: createAgentId('agent-2'), isRoot: false },
        ],
        edges: [
          {
            source: createAgentId('agent-1'),
            target: createAgentId('agent-2'),
            type: 'call',
          },
        ],
      },
      switchRules: [
        {
          trigger: 'user_intent',
          targetAgent: createAgentId('agent-2'),
          priority: createRulePriority(1),
        },
      ],
      callRules: [
        {
          trigger: 'function_call',
          targetAgent: createAgentId('agent-2'),
          priority: createRulePriority(1),
        },
      ],
      guardrails: [
        {
          type: 'max_call_depth',
          maxDepth: createMaxCallDepth(5),
        },
      ],
    };

    expect(schema.agentGraph.nodes).toHaveLength(2);
    expect(schema.agentGraph.edges).toHaveLength(1);
    expect(schema.switchRules).toHaveLength(1);
    expect(schema.callRules).toHaveLength(1);
    expect(schema.guardrails).toHaveLength(1);
  });

  it('создаёт минимальный MultiAgentSchema', () => {
    const schema: MultiAgentSchema = {
      agentGraph: {
        nodes: [{ id: createAgentId('agent-1'), isRoot: true }],
        edges: [],
      },
      switchRules: [],
      callRules: [],
      guardrails: [],
    };

    expect(schema.agentGraph.nodes).toHaveLength(1);
    expect(schema.agentGraph.edges).toHaveLength(0);
    expect(schema.switchRules).toHaveLength(0);
    expect(schema.callRules).toHaveLength(0);
    expect(schema.guardrails).toHaveLength(0);
  });

  it('создаёт MultiAgentSchema со всеми типами условий', () => {
    const schema: MultiAgentSchema = {
      agentGraph: {
        nodes: [{ id: createAgentId('agent-1'), isRoot: true }],
        edges: [],
      },
      switchRules: [
        {
          trigger: 'user_intent',
          targetAgent: createAgentId('agent-1'),
          priority: createRulePriority(1),
          conditions: {
            type: 'intent_match',
            intents: ['intent-1'],
          },
        },
        {
          trigger: 'topic_match',
          targetAgent: createAgentId('agent-1'),
          priority: createRulePriority(2),
          conditions: {
            type: 'topic_match',
            topics: ['topic-1'],
          },
        },
        {
          trigger: 'error_threshold',
          targetAgent: createAgentId('agent-1'),
          priority: createRulePriority(3),
          conditions: {
            type: 'confidence_threshold',
            minConfidence: 0.8,
          },
        },
        {
          trigger: 'error_threshold',
          targetAgent: createAgentId('agent-1'),
          priority: createRulePriority(4),
          conditions: {
            type: 'error_count_threshold',
            maxErrors: 5,
          },
        },
      ],
      callRules: [
        {
          trigger: 'function_call',
          targetAgent: createAgentId('agent-1'),
          priority: createRulePriority(1),
          conditions: {
            type: 'function_name_match',
            functionNames: ['func-1'],
          },
        },
        {
          trigger: 'tool_required',
          targetAgent: createAgentId('agent-1'),
          priority: createRulePriority(2),
          conditions: {
            type: 'tool_type_match',
            toolTypes: ['tool-1'],
          },
        },
        {
          trigger: 'specialized_task',
          targetAgent: createAgentId('agent-1'),
          priority: createRulePriority(3),
          conditions: {
            type: 'task_category_match',
            categories: ['category-1'],
          },
        },
        {
          trigger: 'context_enrichment',
          targetAgent: createAgentId('agent-1'),
          priority: createRulePriority(4),
          conditions: {
            type: 'context_key_match',
            requiredKeys: ['key-1'],
          },
        },
      ],
      guardrails: [
        {
          type: 'max_call_depth',
          maxDepth: createMaxCallDepth(5),
          agentId: createAgentId('agent-1'),
        },
        {
          type: 'max_calls_per_agent',
          maxCalls: createMaxCallsPerAgent(10),
        },
        {
          type: 'call_timeout',
          timeout: createAgentCallTimeout(30000),
          agentId: createAgentId('agent-1'),
        },
        {
          type: 'circular_call_prevention',
        },
      ],
    };

    expect(schema.switchRules).toHaveLength(4);
    expect(schema.callRules).toHaveLength(4);
    expect(schema.guardrails).toHaveLength(4);
  });
});
