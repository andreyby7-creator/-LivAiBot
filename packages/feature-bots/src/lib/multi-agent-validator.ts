/**
 * @file packages/feature-bots/src/lib/multi-agent-validator.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Multi-Agent Schema Validator (инварианты графа и правил)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Lib-layer валидатор инвариантов `MultiAgentSchema` (domain-пакет хранит только типы + error types).
 * - Проверяет корректность графа агентов (DFS cycle detection, reachability), правил (switch/call) и guardrails.
 * - Предназначен для boundary-проверок (transport/DB mapping), policy-слоя и тестов.
 *
 * Принципы:
 * - ✅ Pure/Deterministic: нет side-effects, нет зависимостей от времени/случайности.
 * - ✅ Strict typing: узкие типы, явные коды ошибок, без `any`.
 * - ✅ Extensible: поддержка пользовательских rule-плагинов через DI.
 *
 * @remarks
 * Этот модуль не выполняет semantic validation для `conditions` (они описаны как валидированные доменные объекты).
 * Здесь — только структурные инварианты и целостность ссылок.
 *
 * Порядок шагов (канонический flow):
 * - size limits (boundary защита)
 * - agent isolation (sanity-check AgentId)
 * - graph nodes/root + edges (целостность ссылок, дубликаты, self-edge)
 * - reachability + cycle detection (итеративный DFS)
 * - switch/call rules (целостность ссылок, дубликаты)
 * - guardrails (дубликаты, ссылки, числовые инварианты)
 * - custom rules (DI plugins), если заданы
 *
 * Контракт:
 * - Ошибки агрегируются до `maxIssues` (после лимита новые issues игнорируются).
 * - assertMultiAgentSchemaInvariant бросает domain invariant error с коротким сообщением по первой issue.
 * - Limits предназначены для boundary; если schema уже “внутренняя” и trusted,
 *   можно осознанно повышать лимиты или отключать их, но по умолчанию они включены.
 */

import type {
  AgentEdge,
  AgentGraph,
  AgentId,
  CallRule,
  Guardrail,
  MultiAgentSchema,
  SwitchRule,
} from '../domain/MultiAgentSchema.js';
import { createMultiAgentSchemaInvariantError } from '../domain/MultiAgentSchema.js';

/* ============================================================================
 * 🧾 PUBLIC API
 * ========================================================================== */

export type MultiAgentInvariantCode =
  | 'MA_NODES_EMPTY'
  | 'MA_AGENT_ID_INVALID'
  | 'MA_SCHEMA_TOO_LARGE'
  | 'MA_NODE_ID_DUPLICATE'
  | 'MA_ROOT_MISSING'
  | 'MA_ROOT_MULTIPLE'
  | 'MA_EDGE_SELF'
  | 'MA_EDGE_DUPLICATE'
  | 'MA_EDGE_UNKNOWN_SOURCE'
  | 'MA_EDGE_UNKNOWN_TARGET'
  | 'MA_GRAPH_CYCLE'
  | 'MA_NODE_UNREACHABLE'
  | 'MA_SWITCH_RULE_DUPLICATE'
  | 'MA_SWITCH_RULE_UNKNOWN_TARGET'
  | 'MA_CALL_RULE_DUPLICATE'
  | 'MA_CALL_RULE_UNKNOWN_TARGET'
  | 'MA_GUARDRAIL_DUPLICATE'
  | 'MA_GUARDRAIL_AGENT_UNKNOWN'
  | 'MA_GUARDRAIL_INVALID_NUMBER';

export type MultiAgentInvariantIssue = Readonly<{
  readonly code: MultiAgentInvariantCode;
  /** Человекочитаемая причина (для логов/observability). */
  readonly message: string;
  /** Путь (грубый), чтобы проще дебажить в UI/логах. */
  readonly path?: string;
}>;

export type MultiAgentSchemaValidationOk = Readonly<{
  readonly ok: true;
}>;

export type MultiAgentSchemaValidationFail = Readonly<{
  readonly ok: false;
  readonly issues: readonly MultiAgentInvariantIssue[];
}>;

export type MultiAgentSchemaValidationResult =
  | MultiAgentSchemaValidationOk
  | MultiAgentSchemaValidationFail;

type MultiAgentValidationRuleBase = Readonly<{
  /** Уникальный идентификатор правила (для observability и дедупликации). */
  readonly id: string;
}>;

type MultiAgentValidationRuleFn = Readonly<{
  /**
   * Валидирует схему и возвращает список issues.
   * Возвращайте пустой массив, если правило не нашло проблем.
   */
  readonly validate: (
    schema: MultiAgentSchema,
    ctx: MultiAgentValidationContext,
  ) => readonly MultiAgentInvariantIssue[];
}>;

export type MultiAgentValidationRule = Readonly<
  MultiAgentValidationRuleBase & MultiAgentValidationRuleFn
>;

export type MultiAgentValidationContext = Readonly<{
  /** Набор agentId, присутствующих в графе. */
  readonly agentIds: ReadonlySet<AgentId>;
  /** Root agentId (гарантированно определён, если базовые инварианты пройдены). */
  readonly rootAgentId?: AgentId;
}>;

export type ValidateMultiAgentSchemaOptions = Readonly<{
  /**
   * Дополнительные правила (плагины) для расширения инвариантов.
   * Выполняются после базовой структурной валидации.
   */
  readonly rules?: readonly MultiAgentValidationRule[];
  /**
   * Максимум issues, после которого валидатор прекращает накопление ошибок.
   * @defaultValue 50
   */
  readonly maxIssues?: number;
  /**
   * Boundary-limits для защиты от OOM/DoS при обработке больших схем.
   *
   * @remarks
   * Это структурная защита, а не бизнес-логика: ограничивает объём работы валидатора
   * при разборе схемы из transport/DB.
   */
  readonly limits?: Readonly<{
    /** Максимум узлов в графе. */
    readonly maxNodes?: number;
    /** Максимум рёбер в графе. */
    readonly maxEdges?: number;
    /** Максимум switch rules. */
    readonly maxSwitchRules?: number;
    /** Максимум call rules. */
    readonly maxCallRules?: number;
    /** Максимум guardrails. */
    readonly maxGuardrails?: number;
  }>;
}>;

/**
 * Дефолтные boundary-лимиты.
 *
 * @remarks
 * Значения подобраны как защитные “пороговые” лимиты (не бизнес-ограничение).
 * При необходимости их можно поднимать через `options.limits`.
 */
const DEFAULT_MAX_ISSUES = 50;
const MAX_AGENT_ID_LENGTH = 128;
const DEFAULT_MAX_NODES = 5_000;
const DEFAULT_MAX_EDGES = 20_000;
const DEFAULT_MAX_SWITCH_RULES = 20_000;
const DEFAULT_MAX_CALL_RULES = 20_000;
const DEFAULT_MAX_GUARDRAILS = 5_000;

const PATH_AGENT_GRAPH_NODES = 'agentGraph.nodes';
const PATH_AGENT_GRAPH_EDGES = 'agentGraph.edges';

/**
 * Минимальная runtime-валидация идентификатора агента для agent isolation.
 *
 * @remarks
 * Мы не навязываем конкретный формат (это может быть registry-driven), но запрещаем
 * пробелы/пустые значения и чрезмерную длину.
 */
function isValidAgentId(value: AgentId): boolean {
  const v = String(value);
  return v.trim().length > 0 && v.length <= MAX_AGENT_ID_LENGTH && !/\s/.test(v);
}

function validateAgentId(
  value: AgentId,
  path: string,
  push: (issue: MultiAgentInvariantIssue) => void,
): void {
  if (isValidAgentId(value)) return;
  push({
    code: 'MA_AGENT_ID_INVALID',
    message: `agentId MUST be a non-empty string without whitespace (len<=128): ${String(value)}`,
    path,
  });
}

/**
 * Boundary-защита: ограничивает “размер” схемы до разумных пределов.
 *
 * @remarks
 * Функция добавляет ровно одну issue `MA_SCHEMA_TOO_LARGE` (первая найденная причина),
 * чтобы не раздувать список ошибок и не выполнять тяжёлые проверки на явно “слишком больших” данных.
 */
function validateSizeLimits(
  schema: MultiAgentSchema,
  options: Readonly<ValidateMultiAgentSchemaOptions> | undefined,
  push: (issue: MultiAgentInvariantIssue) => void,
): void {
  const limits = options?.limits;
  const maxNodes = limits?.maxNodes ?? DEFAULT_MAX_NODES;
  const maxEdges = limits?.maxEdges ?? DEFAULT_MAX_EDGES;
  const maxSwitchRules = limits?.maxSwitchRules ?? DEFAULT_MAX_SWITCH_RULES;
  const maxCallRules = limits?.maxCallRules ?? DEFAULT_MAX_CALL_RULES;
  const maxGuardrails = limits?.maxGuardrails ?? DEFAULT_MAX_GUARDRAILS;

  const tooManyNodes = schema.agentGraph.nodes.length > maxNodes
    ? `agentGraph.nodes length MUST be <= ${maxNodes}, got ${schema.agentGraph.nodes.length}`
    : null;
  const tooManyEdges = schema.agentGraph.edges.length > maxEdges
    ? `agentGraph.edges length MUST be <= ${maxEdges}, got ${schema.agentGraph.edges.length}`
    : null;
  const tooManySwitch = schema.switchRules.length > maxSwitchRules
    ? `switchRules length MUST be <= ${maxSwitchRules}, got ${schema.switchRules.length}`
    : null;
  const tooManyCall = schema.callRules.length > maxCallRules
    ? `callRules length MUST be <= ${maxCallRules}, got ${schema.callRules.length}`
    : null;
  const tooManyGuardrails = schema.guardrails.length > maxGuardrails
    ? `guardrails length MUST be <= ${maxGuardrails}, got ${schema.guardrails.length}`
    : null;

  const message = tooManyNodes ?? tooManyEdges ?? tooManySwitch ?? tooManyCall ?? tooManyGuardrails;
  if (message === null) return;
  push({
    code: 'MA_SCHEMA_TOO_LARGE',
    message,
    path: 'schema',
  });
}

/**
 * Agent isolation: проверяет корректность идентификаторов агентов во всех ссылках схемы.
 *
 * @remarks
 * Это отдельный проход намеренно: правила `@livai/multiagent/agent-isolation` ожидают явную проверку agentId.
 */
function validateAgentIsolation(
  schema: MultiAgentSchema,
  push: (issue: MultiAgentInvariantIssue) => void,
): void {
  for (const [i, n] of schema.agentGraph.nodes.entries()) {
    validateAgentId(n.id, `agentGraph.nodes[${i}].id`, push);
  }
  for (const [i, e] of schema.agentGraph.edges.entries()) {
    validateAgentId(e.source, `agentGraph.edges[${i}].source`, push);
    validateAgentId(e.target, `agentGraph.edges[${i}].target`, push);
  }
  for (const [i, r] of schema.switchRules.entries()) {
    validateAgentId(r.targetAgent, `switchRules[${i}].targetAgent`, push);
  }
  for (const [i, r] of schema.callRules.entries()) {
    validateAgentId(r.targetAgent, `callRules[${i}].targetAgent`, push);
  }
  for (const [i, g] of schema.guardrails.entries()) {
    if (g.agentId !== undefined) validateAgentId(g.agentId, `guardrails[${i}].agentId`, push);
  }
}

/**
 * Валидирует `MultiAgentSchema` и возвращает список структурных нарушений.
 *
 * @remarks
 * Используйте на boundary (transport/DB mapping) и в policy-слое, чтобы не держать invalid схему в домене.
 */
// eslint-disable-next-line @livai/multiagent/agent-isolation -- agentId валидация выполняется явным проходом validateAgentIsolation(schema, push) в начале функции
export function validateMultiAgentSchema(
  schema: MultiAgentSchema,
  options?: Readonly<ValidateMultiAgentSchemaOptions>,
): MultiAgentSchemaValidationResult {
  const maxIssues = options?.maxIssues ?? DEFAULT_MAX_ISSUES;
  const issues: MultiAgentInvariantIssue[] = [];
  const push = (issue: MultiAgentInvariantIssue): void => {
    if (issues.length >= maxIssues) return;
    issues.push(Object.freeze(issue));
  };

  validateSizeLimits(schema, options, push);
  validateAgentIsolation(schema, push);

  const { agentIds, rootAgentId } = validateGraph(schema.agentGraph, push);

  validateEdges(schema.agentGraph, agentIds, push);
  validateReachability(schema.agentGraph, agentIds, rootAgentId, push);
  validateRuleSets(schema.switchRules, schema.callRules, agentIds, push);
  validateGuardrails(schema.guardrails, agentIds, push);

  const ctx: MultiAgentValidationContext = Object.freeze({
    agentIds,
    ...(rootAgentId !== undefined ? { rootAgentId } : {}),
  });

  applyCustomRules(schema, ctx, options?.rules, push);

  return issues.length === 0
    ? Object.freeze({ ok: true })
    : Object.freeze({ ok: false, issues: Object.freeze([...issues]) });
}

/**
 * Проверяет инварианты `MultiAgentSchema` и бросает domain invariant error при нарушении.
 *
 * @remarks
 * Этот helper специально бросает **domain error type** через `createMultiAgentSchemaInvariantError`,
 * чтобы upstream-слои могли отличать “инвариант домена” от ошибок transport/runtime.
 */
// eslint-disable-next-line @livai/multiagent/agent-isolation -- agent isolation проверяется внутри validateMultiAgentSchema (см. validateAgentIsolation)
export function assertMultiAgentSchemaInvariant(
  schema: MultiAgentSchema,
  options?: Readonly<ValidateMultiAgentSchemaOptions>,
): void {
  const res = validateMultiAgentSchema(schema, options);
  if (res.ok) return;
  throw createMultiAgentSchemaInvariantError(formatInvariantMessage(res.issues));
}

/* ============================================================================
 * 🧩 INTERNAL VALIDATION
 * ========================================================================== */

function formatInvariantMessage(issues: readonly MultiAgentInvariantIssue[]): string {
  const head = issues[0];
  if (head === undefined) return 'MultiAgentSchema invariant violation: unknown';
  const extraCount = Math.max(0, issues.length - 1);
  const tail = extraCount > 0 ? ` (+${extraCount} more)` : '';
  const pathPart = head.path !== undefined && head.path.length > 0 ? ` @ ${head.path}` : '';
  return `MultiAgentSchema invariant violation: ${head.code}${pathPart} — ${head.message}${tail}`;
}

function applyCustomRules(
  schema: MultiAgentSchema,
  ctx: MultiAgentValidationContext,
  rules: readonly MultiAgentValidationRule[] | undefined,
  push: (issue: MultiAgentInvariantIssue) => void,
): void {
  if (rules === undefined) return;
  for (const rule of rules) {
    const ruleIssues = rule.validate(schema, ctx);
    for (const issue of ruleIssues) push(issue);
  }
}

function validateGraph(
  graph: AgentGraph,
  push: (issue: MultiAgentInvariantIssue) => void,
): Readonly<{ agentIds: ReadonlySet<AgentId>; rootAgentId?: AgentId; }> {
  if (graph.nodes.length === 0) {
    push({
      code: 'MA_NODES_EMPTY',
      message: 'agentGraph.nodes MUST NOT be empty',
      path: PATH_AGENT_GRAPH_NODES,
    });
    return { agentIds: new Set<AgentId>() };
  }

  const agentIds = new Set<AgentId>();
  const duplicateIds: AgentId[] = [];
  let rootCount = 0;
  let rootAgentId: AgentId | undefined;

  for (const node of graph.nodes) {
    if (agentIds.has(node.id)) duplicateIds.push(node.id);
    agentIds.add(node.id);
    if (node.isRoot) {
      rootCount += 1;
      rootAgentId = node.id;
    }
  }

  if (duplicateIds.length > 0) {
    push({
      code: 'MA_NODE_ID_DUPLICATE',
      message: `agentGraph.nodes MUST NOT contain duplicate agent ids: ${
        duplicateIds.map(String).join(', ')
      }`,
      path: PATH_AGENT_GRAPH_NODES,
    });
  }

  if (rootCount === 0) {
    push({
      code: 'MA_ROOT_MISSING',
      message: 'agentGraph.nodes MUST contain exactly one root node (isRoot=true)',
      path: PATH_AGENT_GRAPH_NODES,
    });
  } else if (rootCount > 1) {
    push({
      code: 'MA_ROOT_MULTIPLE',
      message: 'agentGraph.nodes MUST contain exactly one root node (multiple isRoot=true found)',
      path: PATH_AGENT_GRAPH_NODES,
    });
  }

  return rootAgentId === undefined ? { agentIds } : { agentIds, rootAgentId };
}

function validateEdges(
  graph: AgentGraph,
  agentIds: ReadonlySet<AgentId>,
  push: (issue: MultiAgentInvariantIssue) => void,
): void {
  const seen = new Set<string>();

  for (const [i, edge] of graph.edges.entries()) {
    const path = `agentGraph.edges[${i}]`;

    if (edge.source === edge.target) {
      push({
        code: 'MA_EDGE_SELF',
        message: 'self-edge is not allowed (source MUST NOT equal target)',
        path,
      });
    }

    if (!agentIds.has(edge.source)) {
      push({
        code: 'MA_EDGE_UNKNOWN_SOURCE',
        message: `edge.source MUST reference an existing node id: ${String(edge.source)}`,
        path: `${path}.source`,
      });
    }

    if (!agentIds.has(edge.target)) {
      push({
        code: 'MA_EDGE_UNKNOWN_TARGET',
        message: `edge.target MUST reference an existing node id: ${String(edge.target)}`,
        path: `${path}.target`,
      });
    }

    const key = edgeKey(edge);
    if (seen.has(key)) {
      push({
        code: 'MA_EDGE_DUPLICATE',
        message: `agentGraph.edges MUST NOT contain duplicates: ${key}`,
        path,
      });
    }
    seen.add(key);
  }
}

function edgeKey(edge: AgentEdge): string {
  // JSON.stringify даёт устойчивый ключ без коллизий из-за спецсимволов.
  return JSON.stringify([String(edge.source), String(edge.target), edge.type]);
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- итеративный DFS с явным стеком: детерминированно, без рекурсии и без скрытых зависимостей
function validateReachability(
  graph: AgentGraph,
  agentIds: ReadonlySet<AgentId>,
  rootAgentId: AgentId | undefined,
  push: (issue: MultiAgentInvariantIssue) => void,
): void {
  if (rootAgentId === undefined) return;

  const adjacency = buildAdjacency(graph.edges);

  // Итеративный DFS: безопасен для больших графов (без рекурсии/stack overflow).
  const state = new Map<AgentId, 0 | 1 | 2>(); // 0=unvisited, 1=visiting, 2=done
  const reachable = new Set<AgentId>();

  type Frame = Readonly<{ readonly node: AgentId; readonly idx: number; }>;
  const frames: Frame[] = [];

  frames.push({ node: rootAgentId, idx: 0 });
  state.set(rootAgentId, 1);
  reachable.add(rootAgentId);

  while (frames.length > 0) {
    const top = frames[frames.length - 1];
    if (top === undefined) break;

    const neighbors = adjacency.get(top.node) ?? [];
    const next = neighbors[top.idx];

    if (next === undefined) {
      state.set(top.node, 2);
      frames.pop();
      continue;
    }

    frames[frames.length - 1] = { node: top.node, idx: top.idx + 1 };

    reachable.add(next);
    const nextState = state.get(next) ?? 0;
    if (nextState === 0) {
      state.set(next, 1);
      frames.push({ node: next, idx: 0 });
      continue;
    }
    if (nextState === 1) {
      push({
        code: 'MA_GRAPH_CYCLE',
        message: `agentGraph MUST NOT contain cycles (cycle detected at ${String(next)})`,
        path: PATH_AGENT_GRAPH_EDGES,
      });
    }
  }

  // Unreachable nodes (BFS/DFS result is equivalent for reachability).
  for (const id of agentIds) {
    if (!reachable.has(id)) {
      push({
        code: 'MA_NODE_UNREACHABLE',
        message: `node MUST be reachable from root agent: ${String(id)}`,
        path: PATH_AGENT_GRAPH_NODES,
      });
    }
  }
}

function buildAdjacency(edges: readonly AgentEdge[]): ReadonlyMap<AgentId, readonly AgentId[]> {
  const map = new Map<AgentId, AgentId[]>();
  for (const edge of edges) {
    const list = map.get(edge.source);
    if (list !== undefined) {
      list.push(edge.target);
    } else {
      map.set(edge.source, [edge.target]);
    }
  }
  // Freeze arrays to avoid accidental mutations by callers (shallow immutability).
  const frozen = new Map<AgentId, readonly AgentId[]>();
  for (const [k, v] of map) frozen.set(k, Object.freeze(v));
  return frozen;
}

function validateRuleSets(
  switchRules: readonly SwitchRule[],
  callRules: readonly CallRule[],
  agentIds: ReadonlySet<AgentId>,
  push: (issue: MultiAgentInvariantIssue) => void,
): void {
  validateSwitchRules(switchRules, agentIds, push);
  validateCallRules(callRules, agentIds, push);
}

function validateDuplicates<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  code: MultiAgentInvariantCode,
  messageOf: (key: string) => string,
  pathOf: (index: number) => string,
  push: (issue: MultiAgentInvariantIssue) => void,
): void {
  // Intentionally generic: используется для switch/call rules, edges/guardrails и любых custom rule sets.
  const seen = new Set<string>();
  for (const [i, item] of items.entries()) {
    const key = keyOf(item);
    if (seen.has(key)) {
      push({
        code,
        message: messageOf(key),
        path: pathOf(i),
      });
    }
    seen.add(key);
  }
}

function validateSwitchRules(
  rules: readonly SwitchRule[],
  agentIds: ReadonlySet<AgentId>,
  push: (issue: MultiAgentInvariantIssue) => void,
): void {
  validateDuplicates(
    rules,
    (r) => JSON.stringify([r.trigger, String(r.targetAgent), String(r.priority)]),
    'MA_SWITCH_RULE_DUPLICATE',
    (key) => `switchRules MUST NOT contain duplicates by trigger+targetAgent+priority: ${key}`,
    (i) => `switchRules[${i}]`,
    push,
  );

  for (const [i, r] of rules.entries()) {
    const path = `switchRules[${i}]`;

    if (!agentIds.has(r.targetAgent)) {
      push({
        code: 'MA_SWITCH_RULE_UNKNOWN_TARGET',
        message: `switchRules.targetAgent MUST reference an existing node id: ${
          String(r.targetAgent)
        }`,
        path: `${path}.targetAgent`,
      });
    }
  }
}

function validateCallRules(
  rules: readonly CallRule[],
  agentIds: ReadonlySet<AgentId>,
  push: (issue: MultiAgentInvariantIssue) => void,
): void {
  validateDuplicates(
    rules,
    (r) => JSON.stringify([r.trigger, String(r.targetAgent), String(r.priority)]),
    'MA_CALL_RULE_DUPLICATE',
    (key) => `callRules MUST NOT contain duplicates by trigger+targetAgent+priority: ${key}`,
    (i) => `callRules[${i}]`,
    push,
  );

  for (const [i, r] of rules.entries()) {
    const path = `callRules[${i}]`;

    if (!agentIds.has(r.targetAgent)) {
      push({
        code: 'MA_CALL_RULE_UNKNOWN_TARGET',
        message: `callRules.targetAgent MUST reference an existing node id: ${
          String(r.targetAgent)
        }`,
        path: `${path}.targetAgent`,
      });
    }
  }
}

function validateGuardrails(
  guardrails: readonly Guardrail[],
  agentIds: ReadonlySet<AgentId>,
  push: (issue: MultiAgentInvariantIssue) => void,
): void {
  validateDuplicates(
    guardrails,
    (g) => JSON.stringify([g.type, g.agentId === undefined ? null : String(g.agentId)]),
    'MA_GUARDRAIL_DUPLICATE',
    (key) => `guardrails MUST NOT contain duplicates by type+agentId: ${key}`,
    (i) => `guardrails[${i}]`,
    push,
  );

  for (const [i, g] of guardrails.entries()) {
    const path = `guardrails[${i}]`;

    if (g.agentId !== undefined && !agentIds.has(g.agentId)) {
      push({
        code: 'MA_GUARDRAIL_AGENT_UNKNOWN',
        message: `guardrails.agentId MUST reference an existing node id: ${String(g.agentId)}`,
        path: `${path}.agentId`,
      });
    }

    // Number invariants (domain already brands numbers, но runtime-check защищает boundary).
    const numberError = getGuardrailNumberError(g);
    if (numberError !== null) {
      push({
        code: 'MA_GUARDRAIL_INVALID_NUMBER',
        message: numberError,
        path,
      });
    }
  }
}

function getGuardrailNumberError(g: Guardrail): string | null {
  switch (g.type) {
    case 'max_call_depth': {
      const v = g.maxDepth as unknown as number;
      return Number.isFinite(v) && v > 0
        ? null
        : 'guardrails.maxDepth MUST be a positive finite number';
    }
    case 'max_calls_per_agent': {
      const v = g.maxCalls as unknown as number;
      return Number.isFinite(v) && v > 0
        ? null
        : 'guardrails.maxCalls MUST be a positive finite number';
    }
    case 'call_timeout': {
      const v = g.timeout as unknown as number;
      return Number.isFinite(v) && v > 0
        ? null
        : 'guardrails.timeout MUST be a positive finite number';
    }
    case 'circular_call_prevention': {
      return null;
    }
    default: {
      // Exhaustive check for future guardrail variants.
      const _exhaustive: never = g;
      return _exhaustive;
    }
  }
}
