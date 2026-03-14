/**
 * @file packages/feature-bots/src/domain/MultiAgentSchema.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Доменная модель мультиагентной схемы
 * ============================================================================
 *
 * Архитектурная роль:
 * - Domain-агрегат MultiAgentSchema: source-of-truth для мультиагентной оркестрации ботов.
 * - Описывает граф агентов (agentGraph), правила переключения (switchRules), правила вызова (callRules) и защитные ограничения (guardrails).
 * - Используется для детерминированной оркестрации взаимодействия между ботами без if/else-монолита.
 * - ВАЖНО: Валидация инвариантов находится в lib/multi-agent-validator.ts (assertMultiAgentSchemaInvariant).
 *
 * Принципы:
 * - ✅ SRP: только структура мультиагентной схемы (типы, branded types, exhaustive unions) и error types (без валидации и бизнес-логики).
 * - ✅ Deterministic: явные, детерминированные правила (agentGraph, switchRules, callRules, guardrails).
 * - ✅ Domain-pure: без HTTP/DB/DTO-деталей, только доменные типы и error types.
 * - ✅ Extensible: guardrails и conditions позволяют эволюцию без ломки core-схемы.
 * - ✅ Microservice-ready: строгая, сериализуемая модель, удобная для межсервисного взаимодействия и rule-engine.
 * - ✅ Scalable rule-engine: switchRules/callRules используют exhaustive unions и registry pattern без if/else-монолита.
 * - ✅ Strict typing: union-типы для trigger/action/guardrailType, branded types для примитивов, без string и Record в domain.
 * - ✅ No dependencies: domain не импортирует ничего из lib.
 */

/* ============================================================================
 * 🔐 BRANDED TYPES
 * ========================================================================== */

/**
 * Идентификатор агента в мультиагентной схеме.
 * Branded-тип, чтобы не путать с произвольным string и BotId.
 */
export type AgentId = string & { readonly __brand: 'AgentId'; };

/**
 * Максимальная глубина вложенности вызовов агентов.
 * Branded-тип, чтобы не путать с другими числовыми лимитами.
 */
export type MaxCallDepth = number & { readonly __brand: 'MaxCallDepth'; };

/**
 * Максимальное количество вызовов агента за сессию.
 * Branded-тип, чтобы не путать с другими числовыми лимитами.
 */
export type MaxCallsPerAgent = number & { readonly __brand: 'MaxCallsPerAgent'; };

/**
 * Таймаут вызова агента в миллисекундах.
 * Branded-тип, чтобы не путать с другими числовыми значениями времени.
 */
export type AgentCallTimeout = number & { readonly __brand: 'AgentCallTimeout'; };

/**
 * Приоритет правила в rule-engine.
 * Branded-тип, чтобы не путать с другими числовыми значениями (confidence, score, rank).
 */
export type RulePriority = number & { readonly __brand: 'RulePriority'; };

/* ============================================================================
 * 🧩 AGENT GRAPH
 * ========================================================================== */

/**
 * Тип связи между агентами в графе.
 * Exhaustive union для type-safe обработки типов связей.
 */
export type AgentEdgeType =
  | 'call'
  | 'switch'
  | 'fallback';

/**
 * Связь между агентами в графе.
 * Описывает направленное ребро от source к target с типом связи.
 */
export type AgentEdge = Readonly<{
  /** Идентификатор агента-источника. */
  readonly source: AgentId;
  /** Идентификатор агента-цели. */
  readonly target: AgentId;
  /** Тип связи между агентами. */
  readonly type: AgentEdgeType;
}>;

/**
 * Узел агента в графе.
 * Содержит идентификатор агента и его метаданные.
 */
export type AgentNode = Readonly<{
  /** Идентификатор агента. */
  readonly id: AgentId;
  /** Является ли агент корневым (главным агентом). */
  readonly isRoot: boolean;
}>;

/**
 * Граф агентов.
 * Описывает структуру мультиагентной системы через узлы и рёбра.
 */
export type AgentGraph = Readonly<{
  /** Узлы агентов в графе. */
  readonly nodes: readonly AgentNode[];
  /** Рёбра (связи) между агентами. */
  readonly edges: readonly AgentEdge[];
}>;

/* ============================================================================
 * 🧩 SWITCH RULES (Scalable Rule-Engine)
 * ========================================================================== */

/**
 * Триггеры для переключения между агентами.
 * Exhaustive union для type-safe обработки триггеров без if/else-монолита.
 */
export type SwitchTrigger =
  | 'user_intent'
  | 'topic_match'
  | 'explicit_switch'
  | 'fallback'
  | 'timeout'
  | 'error_threshold';

/**
 * Типизированные условия для срабатывания правила переключения.
 * Exhaustive union обеспечивает type-safety и избегает runtime errors.
 * ВАЖНО: Domain хранит валидированные объекты, validation выполняется в policy/application слое перед попаданием в domain.
 * string[] идентификаторы (intents, topics) должны быть registry-driven на уровне rule-engine/application слоя (ADR-001).
 */
export type SwitchCondition =
  | Readonly<{ type: 'intent_match'; intents: readonly string[]; }>
  | Readonly<{ type: 'topic_match'; topics: readonly string[]; }>
  | Readonly<{ type: 'confidence_threshold'; minConfidence: number; }>
  | Readonly<{ type: 'error_count_threshold'; maxErrors: number; }>;

/**
 * Правило переключения между агентами.
 * Используется в rule-engine для детерминированной обработки switch-сценариев.
 */
export type SwitchRule = Readonly<{
  /** Триггер, при котором срабатывает правило. */
  readonly trigger: SwitchTrigger;
  /** Идентификатор агента-цели для переключения. */
  readonly targetAgent: AgentId;
  /**
   * Приоритет правила (чем выше, тем раньше проверяется).
   * Используется для упорядочивания правил в rule-engine.
   * Сортировка по priority выполняется в rule-engine/application слое, domain хранит данные как есть.
   */
  readonly priority: RulePriority;
  /**
   * Типизированные условия для срабатывания правила (опционально).
   * Используется для расширенных сценариев без изменения core-схемы.
   * Validation условий выполняется в application/policy слое перед использованием в rule-engine (ADR-001).
   */
  readonly conditions?: SwitchCondition;
}>;

/**
 * Набор правил переключения между агентами.
 * Set-semantics по инвариантам: правила без дубликатов по комбинации trigger+targetAgent+priority.
 */
export type SwitchRules = readonly SwitchRule[];

/* ============================================================================
 * 🧩 CALL RULES (Scalable Rule-Engine)
 * ========================================================================== */

/**
 * Триггеры для вызова подчинённого агента.
 * Exhaustive union для type-safe обработки триггеров без if/else-монолита.
 */
export type CallTrigger =
  | 'function_call'
  | 'tool_required'
  | 'specialized_task'
  | 'explicit_call'
  | 'context_enrichment';

/**
 * Типизированные условия для срабатывания правила вызова.
 * Exhaustive union обеспечивает type-safety и избегает runtime errors.
 * ВАЖНО: Domain хранит валидированные объекты, validation выполняется в policy/application слое перед попаданием в domain.
 * string[] идентификаторы (functionNames, toolTypes, categories, requiredKeys) должны быть registry-driven на уровне rule-engine/application слоя (ADR-001).
 */
export type CallCondition =
  | Readonly<{ type: 'function_name_match'; functionNames: readonly string[]; }>
  | Readonly<{ type: 'tool_type_match'; toolTypes: readonly string[]; }>
  | Readonly<{ type: 'task_category_match'; categories: readonly string[]; }>
  | Readonly<{ type: 'context_key_match'; requiredKeys: readonly string[]; }>;

/**
 * Правило вызова подчинённого агента.
 * Используется в rule-engine для детерминированной обработки call-сценариев.
 */
export type CallRule = Readonly<{
  /** Триггер, при котором срабатывает правило. */
  readonly trigger: CallTrigger;
  /** Идентификатор агента для вызова. */
  readonly targetAgent: AgentId;
  /**
   * Приоритет правила (чем выше, тем раньше проверяется).
   * Используется для упорядочивания правил в rule-engine.
   * Сортировка по priority выполняется в rule-engine/application слое, domain хранит данные как есть.
   */
  readonly priority: RulePriority;
  /**
   * Типизированные условия для срабатывания правила (опционально).
   * Используется для расширенных сценариев без изменения core-схемы.
   * Validation условий выполняется в application/policy слое перед использованием в rule-engine (ADR-001).
   */
  readonly conditions?: CallCondition;
}>;

/**
 * Набор правил вызова подчинённых агентов.
 * Set-semantics по инвариантам: правила без дубликатов по комбинации trigger+targetAgent+priority.
 */
export type CallRules = readonly CallRule[];

/* ============================================================================
 * 🧩 GUARDRAILS (Protection Rules)
 * ========================================================================== */

/**
 * Защитное ограничение для мультиагентной схемы.
 * Discriminated union для type-safety: убирает invalid states (mutually-exclusive поля),
 * упрощает invariant checks и повышает type-safety.
 * Используется для предотвращения зацикливания, перегрузки и таймаутов.
 */
export type Guardrail =
  | Readonly<{ type: 'max_call_depth'; maxDepth: MaxCallDepth; agentId?: AgentId; }>
  | Readonly<{ type: 'max_calls_per_agent'; maxCalls: MaxCallsPerAgent; agentId?: AgentId; }>
  | Readonly<{ type: 'call_timeout'; timeout: AgentCallTimeout; agentId?: AgentId; }>
  | Readonly<{ type: 'circular_call_prevention'; agentId?: AgentId; }>;

/**
 * Набор защитных ограничений.
 * Set-semantics по инвариантам: guardrails без дубликатов по комбинации type+agentId.
 * ВАЖНО: Разрешены комбинации global guardrail (agentId undefined) + agent-specific override (agentId задан).
 * Например: max_call_depth (agentId undefined) + max_call_depth (agentId A) — валидная комбинация.
 */
export type Guardrails = readonly Guardrail[];

/* ============================================================================
 * 🧩 DOMAIN MODEL
 * ========================================================================== */

/**
 * Доменная модель мультиагентной схемы.
 * Инварианты:
 * - agentGraph.nodes — массив без дубликатов по id, ровно один узел с isRoot=true (для orchestration).
 * - agentGraph.edges — все source и target должны существовать в nodes, без self-edges (A -> A), без дубликатов.
 * - agentGraph — граф без циклов (cycle detection через DFS), все узлы достижимы от корневого узла.
 * - switchRules — массив без дубликатов по комбинации trigger+targetAgent+priority.
 * - callRules — массив без дубликатов по комбинации trigger+targetAgent+priority.
 * - guardrails — массив без дубликатов по комбинации type+agentId.
 * - guardrails.maxDepth/maxCalls/timeout — положительные конечные числа, если заданы (для соответствующих типов).
 */
export type MultiAgentSchema = Readonly<{
  /** Граф агентов (узлы и рёбра). */
  readonly agentGraph: AgentGraph;
  /** Правила переключения между агентами. */
  readonly switchRules: SwitchRules;
  /** Правила вызова подчинённых агентов. */
  readonly callRules: CallRules;
  /** Защитные ограничения для предотвращения зацикливания и перегрузки. */
  readonly guardrails: Guardrails;
}>;

/* ============================================================================
 * 🧪 ERROR TYPES
 * ========================================================================== */

/**
 * Domain-level ошибка нарушения инвариантов MultiAgentSchema.
 * Оформлена как Error-alias + фабрика (без class/this), совместима с observability-слоем.
 * ВАЖНО: Валидация инвариантов находится в lib/multi-agent-validator.ts для соблюдения направленности зависимостей (lib → domain, не наоборот).
 */
export type MultiAgentSchemaInvariantError = Readonly<Error>;

export const createMultiAgentSchemaInvariantError = (
  message: string,
): MultiAgentSchemaInvariantError => {
  // Используем настоящий Error, чтобы сохранить stack и интеграцию с observability.
  // Локально разрешаем мутацию имени ошибки ради корректного name.
  // eslint-disable-next-line functional/prefer-immutable-types
  const error = new Error(message);
  // eslint-disable-next-line fp/no-mutation, no-secrets/no-secrets -- имя класса ошибки, не секрет
  error.name = 'MultiAgentSchemaInvariantError';
  return Object.freeze(error);
};
