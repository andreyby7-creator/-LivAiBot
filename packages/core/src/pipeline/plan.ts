/**
 * @file packages/core/src/pipeline/plan.ts
 * ============================================================================
 * 🛡️ CORE — Pipeline (Execution Plan)
 * ============================================================================
 * Архитектурная роль:
 * - Построение immutable execution plan для dependency-driven pipeline
 * - Топологическая сортировка стадий на основе provides/dependsOn
 * - Валидация зависимостей и построение индексов для O(1) lookup
 * - Многофазная компиляция: normalize → validate → compile → materialize
 * - Причина изменения: execution plan building, dependency resolution, DAG validation
 * Принципы:
 * - ✅ SRP: разделение на TYPES, UTILITY FUNCTIONS, INTERNAL (normalize, validate, materialize, version), API
 * - ✅ Deterministic: одинаковые plugins → одинаковый execution plan (immutable после создания, детерминированная сортировка)
 * - ✅ Domain-pure: generic по TSlotMap, без domain-специфичной логики
 * - ✅ Extensible: plugin system через StagePlugin<TSlotMap>
 * - ✅ Strict typing: union-типы для ExecutionPlanError, типы StageId/SlotId вместо строк
 * - ✅ Scalable: reverse dependency index для O(1) partial recompute lookup, production optimizations (O(V+E) complexity, Set для O(1) lookup)
 * - ✅ Reliability: runtime validation (duplicate providers, circular dependencies, unique stageId, maxEdges), SHA-256 хеширование версии (node:crypto или portable fallback)
 */

import type { FallbackStage, PipelineConfig, SlotId, StageId, StagePlugin } from './plugin-api.js';
import { validatePlugin } from './plugin-api.js';

import 'server-only';

/* ============================================================================
 * 1. TYPES — EXECUTION PLAN MODEL
 * ============================================================================ */

const createHash: typeof import('crypto').createHash | undefined =
  ((): typeof import('crypto').createHash | undefined => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const crypto = require('crypto') as { createHash: typeof import('crypto').createHash; };
      return crypto.createHash;
    } catch {
      return undefined;
    }
  })();

function asStageId(value: string): StageId {
  return value as StageId;
}

function asSlotId(value: string): SlotId {
  return value as SlotId;
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

function compareStageIds(a: StageId, b: StageId): number {
  return compareStrings(a, b);
}

function sortedCopy<T>(values: readonly T[], compare: (a: T, b: T) => number): T[] {
  return [...values].sort(compare);
}

/** Ошибки построения плана выполнения (машиночитаемый дискриминированный union). */
export type ExecutionPlanError =
  | Readonly<{ kind: 'NO_PLUGINS'; }>
  | Readonly<{ kind: 'DUPLICATE_PROVIDERS'; slot: SlotId; stageIds: readonly StageId[]; }>
  | Readonly<{ kind: 'UNKNOWN_SLOT'; slot: SlotId; stageId: StageId; }>
  | Readonly<{ kind: 'CIRCULAR_DEPENDENCY'; path: readonly StageId[]; }>
  | Readonly<{ kind: 'INVALID_PLUGIN'; stageId: StageId; reason: string; }>
  | Readonly<{ kind: 'INVALID_CONFIG'; reason: string; }>;

/**
 * Важно: `stages` хранит ссылки на runtime plugin-объекты.
 * Неизменяемый план выполнения с предварительно вычисленными индексами для поиска O(1).
 * Planner гарантирует структурную immutability плана, но не deep-immutability
 * произвольных вложенных полей/замыканий в пользовательском plugin.
 */
export type ExecutionPlan<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  readonly executionOrder: readonly StageId[];
  readonly stageIndex: Readonly<Record<StageId, number>>;
  readonly version: string;
  readonly stages: Readonly<Record<StageId, StagePlugin<TSlotMap>>>;
  readonly dependencies: Readonly<Record<StageId, readonly StageId[]>>;
  readonly reverseDependencies: Readonly<Record<StageId, readonly StageId[]>>;
  readonly fallbackStage?: FallbackStage<TSlotMap>;
}>;

type PlanLimits = Readonly<{
  maxStages: number;
  maxDependencies: number;
  maxDepth: number;
  maxFanOut: number;
  maxFanIn: number;
}>;

type NormalizedPlugins<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  validatedPlugins: readonly StagePlugin<TSlotMap>[];
  stageIds: readonly StageId[];
}>;

type DAG = Readonly<{
  nodes: readonly StageId[];
  dependencyGraph: ReadonlyMap<StageId, readonly StageId[]>;
  dependentsGraph: ReadonlyMap<StageId, readonly StageId[]>;
  inDegree: ReadonlyMap<StageId, number>;
  edgeCount: number;
}>;

type CompiledPlanData = Readonly<{
  stageIds: readonly StageId[];
  executionOrder: readonly StageId[];
  structuralHash: string;
  dependencyGraph: Readonly<Record<StageId, readonly StageId[]>>;
  reverseDependencyGraph: Readonly<Record<StageId, readonly StageId[]>>;
}>;

type CompiledPlan<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  data: CompiledPlanData;
  normalized: NormalizedPlugins<TSlotMap>;
  dag: DAG;
  executionOrder: readonly StageId[];
}>;

type IndexedStagePlugin<TSlotMap extends Readonly<Record<string, unknown>>> = Readonly<{
  index: number;
  stageId: StageId;
  plugin: StagePlugin<TSlotMap>;
}>;

/* ============================================================================
 * 2. UTILITY FUNCTIONS
 * ============================================================================ */

/** Вычисление хеша SHA-256 для детерминированного версионирования и контентно-ориентированных ID стадий. */
/* c8 ignore start -- platform-specific portable SHA path; covered in non-Node environments */
/* eslint-disable no-magic-numbers, functional/no-loop-statements, functional/no-let, fp/no-mutation, functional/immutable-data */
function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function computePortableSha256(input: string): string {
  const encoder = new TextEncoder();
  const bytes = Array.from(encoder.encode(input));
  const bitLength = bytes.length * 8;

  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) {
    bytes.push(0);
  }

  for (let i = 7; i >= 0; i -= 1) {
    bytes.push((bitLength >>> (i * 8)) & 0xff);
  }

  const k = [
    0x428a2f98,
    0x71374491,
    0xb5c0fbcf,
    0xe9b5dba5,
    0x3956c25b,
    0x59f111f1,
    0x923f82a4,
    0xab1c5ed5,
    0xd807aa98,
    0x12835b01,
    0x243185be,
    0x550c7dc3,
    0x72be5d74,
    0x80deb1fe,
    0x9bdc06a7,
    0xc19bf174,
    0xe49b69c1,
    0xefbe4786,
    0x0fc19dc6,
    0x240ca1cc,
    0x2de92c6f,
    0x4a7484aa,
    0x5cb0a9dc,
    0x76f988da,
    0x983e5152,
    0xa831c66d,
    0xb00327c8,
    0xbf597fc7,
    0xc6e00bf3,
    0xd5a79147,
    0x06ca6351,
    0x14292967,
    0x27b70a85,
    0x2e1b2138,
    0x4d2c6dfc,
    0x53380d13,
    0x650a7354,
    0x766a0abb,
    0x81c2c92e,
    0x92722c85,
    0xa2bfe8a1,
    0xa81a664b,
    0xc24b8b70,
    0xc76c51a3,
    0xd192e819,
    0xd6990624,
    0xf40e3585,
    0x106aa070,
    0x19a4c116,
    0x1e376c08,
    0x2748774c,
    0x34b0bcb5,
    0x391c0cb3,
    0x4ed8aa4a,
    0x5b9cca4f,
    0x682e6ff3,
    0x748f82ee,
    0x78a5636f,
    0x84c87814,
    0x8cc70208,
    0x90befffa,
    0xa4506ceb,
    0xbef9a3f7,
    0xc67178f2,
  ];

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  for (let i = 0; i < bytes.length; i += 64) {
    const w = new Array<number>(64).fill(0);
    for (let j = 0; j < 16; j += 1) {
      const offset = i + (j * 4);
      w[j] = (
        ((bytes[offset] ?? 0) << 24)
        | ((bytes[offset + 1] ?? 0) << 16)
        | ((bytes[offset + 2] ?? 0) << 8)
        | (bytes[offset + 3] ?? 0)
      ) >>> 0;
    }

    for (let j = 16; j < 64; j += 1) {
      const s0 = rightRotate(w[j - 15] as number, 7)
        ^ rightRotate(w[j - 15] as number, 18)
        ^ ((w[j - 15] as number) >>> 3);
      const s1 = rightRotate(w[j - 2] as number, 17)
        ^ rightRotate(w[j - 2] as number, 19)
        ^ ((w[j - 2] as number) >>> 10);
      w[j] = ((w[j - 16] as number) + s0 + (w[j - 7] as number) + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let j = 0; j < 64; j += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + s1 + ch + (k[j] as number) + (w[j] as number)) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((n) => n.toString(16).padStart(8, '0'))
    .join('');
}
/* eslint-enable no-magic-numbers, functional/no-loop-statements, functional/no-let, fp/no-mutation, functional/immutable-data */

function computeSecureHash(str: string): string {
  if (createHash !== undefined) {
    return createHash('sha256').update(str).digest('hex');
  }
  return computePortableSha256(str);
}
/* c8 ignore stop */

const EMPTY_DEPENDS_ON: readonly unknown[] = Object.freeze([]);

function dependsOnSlots<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugin: StagePlugin<TSlotMap>,
): readonly (keyof TSlotMap)[] {
  return plugin.dependsOn ?? (EMPTY_DEPENDS_ON as readonly (keyof TSlotMap)[]);
}

/* eslint-disable functional/no-loop-statements, functional/no-let, functional/immutable-data, fp/no-mutation */
function collectIndexedPlugins<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
  stageIds: readonly StageId[],
): readonly IndexedStagePlugin<TSlotMap>[] {
  const indexed: IndexedStagePlugin<TSlotMap>[] = [];
  for (let index = 0; index < plugins.length; index += 1) {
    const plugin = plugins[index];
    const stageId = stageIds[index];
    if (plugin === undefined || stageId === undefined) {
      continue;
    }
    indexed.push({ index, plugin, stageId });
  }
  return Object.freeze(indexed);
}
/* eslint-enable functional/no-loop-statements, functional/no-let, functional/immutable-data, fp/no-mutation */

function deepFreezeStagePlugin<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugin: StagePlugin<TSlotMap>,
): StagePlugin<TSlotMap> {
  return Object.freeze({
    ...plugin,
    provides: Object.freeze([...plugin.provides]),
    ...(plugin.dependsOn !== undefined && { dependsOn: Object.freeze([...plugin.dependsOn]) }),
  });
}

function normalizeSlotList(slots: readonly unknown[]): string {
  return sortedCopy(slots.map(String), compareStrings).join(',');
}

/** Стабильный структурный хеш для перекомпиляции на уровне плагинов и ключей кеша. */
function structuralHash<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugin: StagePlugin<TSlotMap>,
): string {
  const provides = normalizeSlotList(plugin.provides);
  const dependsOn = normalizeSlotList(dependsOnSlots(plugin));
  return computeSecureHash(`${provides}:${dependsOn}`);
}

/** Генерация ID стадий на основе контента, независимо от порядка массива плагинов. */
function generateStageId<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugin: StagePlugin<TSlotMap>,
): StageId {
  const STAGE_ID_HASH_SLICE_LENGTH = 16;
  if (plugin.id !== undefined) {
    return plugin.id;
  }
  const fingerprint = structuralHash(plugin);
  return asStageId(`stage_${fingerprint.slice(0, STAGE_ID_HASH_SLICE_LENGTH)}`);
}

/** Валидация неизвестного ввода плагина и получение детерминированного stage-id. */
function validateAndGetStageId<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugin: unknown,
  index: number,
): { stageId: StageId; validatedPlugin: StagePlugin<TSlotMap>; } | ExecutionPlanError {
  if (!validatePlugin<TSlotMap>(plugin)) {
    return {
      kind: 'INVALID_PLUGIN',
      stageId: asStageId(`stage_${index}`),
      reason: 'Plugin does not match StagePlugin interface',
    };
  }

  return {
    stageId: generateStageId(plugin),
    validatedPlugin: plugin,
  };
}

/* eslint-disable functional/no-loop-statements, functional/immutable-data, fp/no-mutation */
function validateNoDuplicateProviders<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
  stageIds: readonly StageId[],
): ExecutionPlanError | null {
  const indexedPlugins = collectIndexedPlugins(plugins, stageIds);
  const slotToStageIds: Record<string, StageId[]> = {};
  for (const { plugin, stageId } of indexedPlugins) {
    for (const slot of plugin.provides) {
      const slotStr = String(slot);
      const ids = slotToStageIds[slotStr] ?? [];
      ids.push(stageId);
      slotToStageIds[slotStr] = ids;
    }
  }

  const duplicate = Object.entries(slotToStageIds).find(([, ids]) => ids.length > 1);
  if (duplicate === undefined) {
    return null;
  }

  return {
    kind: 'DUPLICATE_PROVIDERS',
    slot: asSlotId(duplicate[0]),
    stageIds: Object.freeze([...duplicate[1]]),
  };
}

function validateDependencies<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
  stageIds: readonly StageId[],
  allProvidedSlots: ReadonlySet<string>,
): ExecutionPlanError | null {
  const unknownDependency = collectIndexedPlugins(plugins, stageIds)
    .find(({ plugin }) =>
      dependsOnSlots(plugin).some((slot) => !allProvidedSlots.has(String(slot)))
    );

  if (unknownDependency?.stageId === undefined) {
    return null;
  }

  const missingSlot = dependsOnSlots(unknownDependency.plugin)
    .find((slot) => !allProvidedSlots.has(String(slot)));
  if (missingSlot === undefined) {
    return null;
  }

  return {
    kind: 'UNKNOWN_SLOT',
    slot: asSlotId(String(missingSlot)),
    stageId: unknownDependency.stageId,
  };
}

function buildSlotToStageMap<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
  stageIds: readonly StageId[],
): Map<SlotId, StageId> {
  const slotToStageId = new Map<SlotId, StageId>();
  for (const { plugin, stageId } of collectIndexedPlugins(plugins, stageIds)) {
    for (const slot of plugin.provides) {
      const slotId = asSlotId(String(slot));
      if (!slotToStageId.has(slotId)) {
        slotToStageId.set(slotId, stageId);
      }
    }
  }

  return slotToStageId;
}
/* eslint-enable functional/no-loop-statements, functional/immutable-data, fp/no-mutation */

/* ============================================================================
 * 3. INTERNAL — GRAPH BUILDING AND TOPOLOGICAL SORT
 * ============================================================================ */

/**
 * Императивное алгоритмическое ядро (DAG build + heap/queue + DFS/Kahn):
 * осознанно оставлено мутабельным для O(V+E) и предсказуемой производительности.
 * Весь остальной файл остается в functional-shell стиле.
 */
/* eslint-disable functional/no-classes, functional/no-this-expressions, functional/immutable-data, fp/no-mutation, functional/no-let, functional/no-loop-statements, sonarjs/cognitive-complexity */
interface MutableGraph {
  deps: Map<StageId, StageId[]>;
  rev: Map<StageId, StageId[]>;
  degree: Map<StageId, number>;
}

function initGraph(stageIds: readonly StageId[]): MutableGraph {
  const deps = new Map<StageId, StageId[]>();
  const rev = new Map<StageId, StageId[]>();
  const degree = new Map<StageId, number>();

  for (const id of stageIds) {
    deps.set(id, []);
    rev.set(id, []);
    degree.set(id, 0);
  }

  return { deps, rev, degree };
}

function populateGraph<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
  stageIds: readonly StageId[],
  slotToStageId: Readonly<Map<SlotId, StageId>>,
  graph: MutableGraph,
): void {
  for (let i = 0; i < plugins.length; i += 1) {
    const plugin = plugins[i];
    const stageId = stageIds[i];
    if (stageId === undefined || plugin === undefined) {
      continue;
    }

    const dependsOn = plugin.dependsOn;
    if (!dependsOn || dependsOn.length === 0) {
      continue;
    }

    const dependencies = Array.from(
      new Set(
        dependsOn
          .map((slot) => slotToStageId.get(asSlotId(String(slot))))
          .filter((id): id is StageId => id !== undefined),
      ),
    );

    graph.deps.set(stageId, dependencies);

    for (const dependencyId of dependencies) {
      graph.rev.get(dependencyId)?.push(stageId);
      graph.degree.set(stageId, (graph.degree.get(stageId) ?? 0) + 1);
    }
  }
}

function countEdges(graph: ReadonlyMap<StageId, readonly StageId[]>): number {
  return Array.from(graph.values()).reduce((sum, deps) => sum + deps.length, 0);
}

function freezeGraph(map: Map<StageId, StageId[]>): Map<StageId, readonly StageId[]> {
  return new Map(
    Array.from(map.entries(), ([key, value]) => [key, Object.freeze([...value])] as const),
  );
}

function buildDependencyGraph<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
  stageIds: readonly StageId[],
  slotToStageId: Readonly<Map<SlotId, StageId>>,
): DAG {
  const graph = initGraph(stageIds);
  populateGraph(plugins, stageIds, slotToStageId, graph);
  const dependencyGraph = freezeGraph(graph.deps);
  const dependentsGraph = freezeGraph(graph.rev);

  return {
    nodes: Object.freeze([...stageIds]),
    dependencyGraph,
    dependentsGraph,
    inDegree: graph.degree,
    edgeCount: countEdges(dependencyGraph),
  };
}

class MinHeap {
  private readonly heap: StageId[] = [];

  // Минимальная куча для эффективной сортировки по приоритету
  push(value: StageId): void {
    this.heap.push(value);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): StageId | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    const last = this.heap.pop();
    if (last !== undefined) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return min;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number): void {
    if (index === 0) return;
    const parent = Math.floor((index - 1) / 2);
    if ((this.heap[parent] ?? '') > (this.heap[index] ?? '')) {
      [this.heap[parent], this.heap[index]] = [
        this.heap[index] as StageId,
        this.heap[parent] as StageId,
      ];
      this.bubbleUp(parent);
    }
  }

  private bubbleDown(index: number): void {
    const left = (2 * index) + 1;
    const right = (2 * index) + 2;
    let smallest = index;

    if (left < this.heap.length && (this.heap[left] ?? '') < (this.heap[smallest] ?? '')) {
      smallest = left;
    }
    if (right < this.heap.length && (this.heap[right] ?? '') < (this.heap[smallest] ?? '')) {
      smallest = right;
    }
    if (smallest !== index) {
      [this.heap[index], this.heap[smallest]] = [
        this.heap[smallest] as StageId,
        this.heap[index] as StageId,
      ];
      this.bubbleDown(smallest);
    }
  }
}

interface Queue {
  push(v: StageId): void;
  pop(): StageId | undefined;
  isEmpty(): boolean;
}

class ArrayQueue implements Queue {
  private readonly data: StageId[];

  constructor(values: readonly StageId[]) {
    this.data = sortedCopy(values, compareStageIds);
  }

  // Очередь на основе массива для небольших графов (< 1000 узлов)

  push(v: StageId): void {
    const index = this.data.findIndex((id) => id > v);
    if (index < 0) {
      this.data.push(v);
      return;
    }
    this.data.splice(index, 0, v);
  }

  pop(): StageId | undefined {
    return this.data.shift();
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }
}

class HeapQueue implements Queue {
  private readonly heap = new MinHeap();

  constructor(values: readonly StageId[]) {
    values.forEach((value) => {
      this.heap.push(value);
    });
  }

  push(v: StageId): void {
    this.heap.push(v);
  }

  pop(): StageId | undefined {
    return this.heap.pop();
  }

  isEmpty(): boolean {
    return this.heap.isEmpty();
  }
}

function createQueue(stageIds: readonly StageId[], inDegree: ReadonlyMap<StageId, number>): Queue {
  // Находим начальные узлы (степень входа = 0)
  const initial = stageIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  // Для больших графов используем heap для O(log N) вставок, для малых - массив с бинарным поиском
  return stageIds.length > 1000 ? new HeapQueue(initial) : new ArrayQueue(initial);
}

function processNode(
  current: StageId,
  dependentsGraph: ReadonlyMap<StageId, readonly StageId[]>,
  currentInDegree: Map<StageId, number>,
  queue: Queue,
): void {
  // Уменьшаем степени входа для всех зависимых стадий
  const dependents = dependentsGraph.get(current) ?? [];
  for (const dependent of dependents) {
    const newDegree = (currentInDegree.get(dependent) ?? 0) - 1;
    currentInDegree.set(dependent, newDegree);
    // Когда степень входа становится 0, стадия готова к выполнению
    if (newDegree === 0) {
      queue.push(dependent);
    }
  }
}

/** Построение реального пути цикла через DFS для лучшей отладки в продакшене. */
function buildCyclePath(
  dependencyGraph: ReadonlyMap<StageId, readonly StageId[]>,
  unprocessed: ReadonlySet<StageId>,
): readonly StageId[] {
  const visiting = new Set<StageId>();
  const visited = new Set<StageId>();
  const stack: StageId[] = [];

  const dfs = (node: StageId): readonly StageId[] | null => {
    visiting.add(node); // Помечаем как посещаемый
    stack.push(node); // Добавляем в текущий путь

    const dependencies = dependencyGraph.get(node) ?? [];
    for (const dep of dependencies) {
      if (!unprocessed.has(dep)) {
        continue; // Пропускаем обработанные узлы
      }

      if (visiting.has(dep)) {
        // Найден цикл: dep уже в пути (visiting set)
        const start = stack.lastIndexOf(dep);
        return start >= 0 ? [...stack.slice(start), dep] : [dep, node, dep];
      }

      if (!visited.has(dep)) {
        const result = dfs(dep);
        if (result !== null) {
          return result; // Передать цикл вверх
        }
      }
    }

    // Узел обработан - снимаем метки
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  };

  for (const node of Array.from(unprocessed)) {
    if (visited.has(node)) {
      continue;
    }
    const cyclePath = dfs(node);
    if (cyclePath !== null) {
      return cyclePath;
    }
  }

  /* c8 ignore next -- defensive fallback: returns remaining nodes when cycle reconstruction is incomplete */
  return Object.freeze([...Array.from(unprocessed)]);
}

function detectCycle(
  executionOrder: readonly StageId[],
  stageIds: readonly StageId[],
  dependencyGraph: ReadonlyMap<StageId, readonly StageId[]>,
): ExecutionPlanError | null {
  if (executionOrder.length === stageIds.length) {
    return null;
  }

  const processed = new Set(executionOrder);
  const unprocessed = new Set(stageIds.filter((id) => !processed.has(id)));
  return {
    kind: 'CIRCULAR_DEPENDENCY',
    path: buildCyclePath(dependencyGraph, unprocessed),
  };
}

function runKahn(
  dependencyGraph: ReadonlyMap<StageId, readonly StageId[]>,
  dependentsGraph: ReadonlyMap<StageId, readonly StageId[]>,
  inDegree: ReadonlyMap<StageId, number>,
  stageIds: readonly StageId[],
): readonly StageId[] | ExecutionPlanError {
  const queue = createQueue(stageIds, inDegree);
  const currentInDegree = new Map(inDegree); // Мутабельная копия для алгоритма
  const executionOrder: StageId[] = [];

  // Алгоритм Кана: обрабатываем узлы с нулевой степенью входа
  while (!queue.isEmpty()) {
    const current = queue.pop();
    /* c8 ignore next 3 -- defensive guard: queue contract guarantees value when not empty */
    if (current === undefined) {
      break;
    }

    executionOrder.push(current);
    // Уменьшаем степени входа зависимых узлов
    processNode(current, dependentsGraph, currentInDegree, queue);
  }

  const cycleError = detectCycle(executionOrder, stageIds, dependencyGraph);
  if (cycleError !== null) {
    return cycleError;
  }

  return Object.freeze(executionOrder);
}
/* eslint-enable functional/no-classes, functional/no-this-expressions, functional/immutable-data, fp/no-mutation, functional/no-let, functional/no-loop-statements, sonarjs/cognitive-complexity */

function buildDependencyMap(
  dependencyGraph: ReadonlyMap<StageId, readonly StageId[]>,
): Readonly<Record<StageId, readonly StageId[]>> {
  return Object.freeze(
    Object.fromEntries(
      Array.from(
        dependencyGraph.entries(),
        ([stageId, deps]) => [stageId, Object.freeze(sortedCopy(deps, compareStageIds))],
      ),
    ),
  );
}

function buildReverseDependencyIndex(
  dependentsGraph: ReadonlyMap<StageId, readonly StageId[]>,
): Readonly<Record<StageId, readonly StageId[]>> {
  return Object.freeze(
    Object.fromEntries(
      Array.from(
        dependentsGraph.entries(),
        (
          [stageId, dependents],
        ) => [stageId, Object.freeze(sortedCopy(dependents, compareStageIds))],
      ),
    ),
  );
}

/* eslint-disable functional/no-loop-statements, functional/no-let, fp/no-mutation */
function validateProvides<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
): ExecutionPlanError | null {
  for (let index = 0; index < plugins.length; index += 1) {
    const plugin = plugins[index];
    /* c8 ignore next 3 -- defensive guard for sparse arrays */
    if (plugin === undefined) {
      continue;
    }

    if (!Array.isArray(plugin.provides) || plugin.provides.length === 0) {
      return {
        kind: 'INVALID_PLUGIN',
        stageId: asStageId(`stage_${index}`),
        reason: `Plugin at index ${index} has empty provides array`,
      };
    }

    const normalized = plugin.provides.map(String);
    if (normalized.some((slot) => slot.length === 0)) {
      return {
        kind: 'INVALID_PLUGIN',
        stageId: asStageId(`stage_${index}`),
        reason: `Plugin at index ${index} has empty slot names in provides`,
      };
    }

    if (new Set(normalized).size !== normalized.length) {
      return {
        kind: 'INVALID_PLUGIN',
        stageId: asStageId(`stage_${index}`),
        reason: `Plugin at index ${index} has duplicate provides slots`,
      };
    }
  }

  return null;
}
/* eslint-enable functional/no-loop-statements, functional/no-let, fp/no-mutation */

/** Генерация ID стадий на основе контента, независимо от порядка массива плагинов. */
function generateStageIds<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
):
  | { validatedPlugins: readonly StagePlugin<TSlotMap>[]; stageIds: readonly StageId[]; }
  | ExecutionPlanError
{
  const validationResults = plugins.map((plugin, index) =>
    validateAndGetStageId<TSlotMap>(plugin, index)
  );
  const firstError = validationResults.find((result): result is ExecutionPlanError =>
    'kind' in result
  );
  if (firstError !== undefined) {
    return firstError;
  }

  const validResults = validationResults.filter(
    (result): result is { stageId: StageId; validatedPlugin: StagePlugin<TSlotMap>; } =>
      !('kind' in result),
  );

  return {
    validatedPlugins: validResults.map((result) => result.validatedPlugin),
    stageIds: validResults.map((result) => result.stageId),
  };
}

/* eslint-disable functional/no-loop-statements, functional/immutable-data */
function validateUniqueStageIds<TSlotMap extends Readonly<Record<string, unknown>>>(
  stageIds: readonly StageId[],
  validatedPlugins: readonly StagePlugin<TSlotMap>[],
): ExecutionPlanError | null {
  const indexedPlugins = collectIndexedPlugins(validatedPlugins, stageIds);
  const byStageId = new Map<StageId, readonly (keyof TSlotMap)[]>();
  for (const { stageId, plugin } of indexedPlugins) {
    const existingProvides = byStageId.get(stageId);
    if (existingProvides !== undefined) {
      return {
        kind: 'INVALID_PLUGIN',
        stageId,
        reason: `Duplicate stageId: ${stageId}. Existing provides: [${
          existingProvides.map(String).join(',')
        }], Current provides: [${plugin.provides.map(String).join(',')}]`,
      };
    }
    byStageId.set(stageId, plugin.provides);
  }
  return null;
}
/* eslint-enable functional/no-loop-statements, functional/immutable-data */

function normalizePlugins<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
): NormalizedPlugins<TSlotMap> | ExecutionPlanError {
  const providesError = validateProvides(plugins);
  if (providesError !== null) {
    return providesError;
  }

  const generated = generateStageIds(plugins);
  if ('kind' in generated) {
    return generated;
  }

  const uniqueError = validateUniqueStageIds(generated.stageIds, generated.validatedPlugins);
  if (uniqueError !== null) {
    return uniqueError;
  }

  return generated;
}

function resolvePlanLimits<TSlotMap extends Readonly<Record<string, unknown>>>(
  config: PipelineConfig<TSlotMap>,
): PlanLimits {
  const maxStages = config.maxStages ?? 100;
  const maxDependencies = config.maxDependencies ?? maxStages * maxStages;
  return {
    maxStages,
    maxDependencies,
    maxDepth: config.maxDepth ?? maxStages,
    maxFanOut: config.maxFanOut ?? maxStages,
    maxFanIn: config.maxFanIn ?? maxStages,
  };
}

/** Фаза 2: валидация на уровне слотов, независимо от построения графа. */
function validateSlotsPhase<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
  stageIds: readonly StageId[],
): ExecutionPlanError | null {
  // Проверяем дубликаты провайдеров слотов
  const duplicateError = validateNoDuplicateProviders(plugins, stageIds);
  if (duplicateError !== null) {
    return duplicateError;
  }

  // Собираем все предоставляемые слоты для проверки зависимостей
  const allProvidedSlots = new Set(plugins.flatMap((plugin) => plugin.provides.map(String)));

  // Проверяем что все dependsOn ссылаются на существующие слоты
  const dependencyError = validateDependencies(plugins, stageIds, allProvidedSlots);
  if (dependencyError !== null) {
    return dependencyError;
  }

  return null;
}

/* eslint-disable functional/no-loop-statements, functional/no-let, functional/immutable-data, fp/no-mutation */
function computeMaxDepth(
  executionOrder: readonly StageId[],
  dependencyGraph: ReadonlyMap<StageId, readonly StageId[]>,
): number {
  const INITIAL_DEPTH = 1;
  const depthByStage = new Map<StageId, number>();
  let maxDepth = 0;

  for (const stageId of executionOrder) {
    const deps = dependencyGraph.get(stageId) ?? [];
    const stageDepth = deps.length === 0
      ? INITIAL_DEPTH
      : Math.max(...deps.map((dep) => depthByStage.get(dep) ?? INITIAL_DEPTH)) + 1;
    depthByStage.set(stageId, stageDepth);
    if (stageDepth > maxDepth) {
      maxDepth = stageDepth;
    }
  }

  return maxDepth;
}
/* eslint-enable functional/no-loop-statements, functional/no-let, functional/immutable-data, fp/no-mutation */

/** Фаза 3: валидация ограничений формы графа. */
function validateStructuralLimitsPhase(
  dag: DAG,
  limits: PlanLimits,
): ExecutionPlanError | null {
  if (dag.edgeCount > limits.maxDependencies) {
    return {
      kind: 'INVALID_CONFIG',
      reason: `Too many dependencies: ${dag.edgeCount} exceeds maximum ${limits.maxDependencies}`,
    };
  }

  const fanShape = dag.nodes.reduce<Readonly<{ maxFanIn: number; maxFanOut: number; }>>(
    (acc, node) => {
      const fanIn = (dag.dependencyGraph.get(node) ?? []).length;
      const fanOut = (dag.dependentsGraph.get(node) ?? []).length;
      return {
        maxFanIn: Math.max(acc.maxFanIn, fanIn),
        maxFanOut: Math.max(acc.maxFanOut, fanOut),
      };
    },
    { maxFanIn: 0, maxFanOut: 0 },
  );

  if (fanShape.maxFanIn > limits.maxFanIn) {
    return {
      kind: 'INVALID_CONFIG',
      reason: `Fan-in limit exceeded: ${fanShape.maxFanIn} exceeds maximum ${limits.maxFanIn}`,
    };
  }

  if (fanShape.maxFanOut > limits.maxFanOut) {
    return {
      kind: 'INVALID_CONFIG',
      reason: `Fan-out limit exceeded: ${fanShape.maxFanOut} exceeds maximum ${limits.maxFanOut}`,
    };
  }

  return null;
}

function validateDepthLimitsPhase(
  dag: DAG,
  executionOrder: readonly StageId[],
  limits: PlanLimits,
): ExecutionPlanError | null {
  const maxDepth = computeMaxDepth(executionOrder, dag.dependencyGraph);
  if (maxDepth > limits.maxDepth) {
    return {
      kind: 'INVALID_CONFIG',
      reason: `Depth limit exceeded: ${maxDepth} exceeds maximum ${limits.maxDepth}`,
    };
  }

  return null;
}

/* ============================================================================
 * 4. INTERNAL — PLAN MATERIALIZATION / VERSIONING
 * ============================================================================ */

function materializeExecutionPlan<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
  stageIds: readonly StageId[],
  executionOrder: readonly StageId[],
  dependencyGraph: ReadonlyMap<StageId, readonly StageId[]>,
  dependentsGraph: ReadonlyMap<StageId, readonly StageId[]>,
  config: PipelineConfig<TSlotMap>,
): Omit<ExecutionPlan<TSlotMap>, 'version'> {
  /* eslint-disable functional/no-loop-statements, functional/no-let, functional/immutable-data, fp/no-mutation */
  const indexedPlugins = collectIndexedPlugins(plugins, stageIds);
  const stages: Record<StageId, StagePlugin<TSlotMap>> = {};
  for (const { stageId, plugin } of indexedPlugins) {
    stages[stageId] = deepFreezeStagePlugin(plugin);
  }

  const stageIndex: Record<StageId, number> = {};
  for (let index = 0; index < executionOrder.length; index += 1) {
    const stageId = executionOrder[index];
    if (stageId !== undefined) {
      stageIndex[stageId] = index;
    }
  }
  /* eslint-enable functional/no-loop-statements, functional/no-let, functional/immutable-data, fp/no-mutation */

  return {
    executionOrder: Object.freeze([...executionOrder]),
    stageIndex: Object.freeze(stageIndex),
    stages: Object.freeze(stages),
    dependencies: buildDependencyMap(dependencyGraph),
    reverseDependencies: buildReverseDependencyIndex(dependentsGraph),
    ...(config.fallbackStage !== undefined && {
      fallbackStage: Object.freeze({
        ...config.fallbackStage,
        provides: Object.freeze([...config.fallbackStage.provides]),
        ...(config.fallbackStage.dependsOn !== undefined
          && { dependsOn: Object.freeze([...config.fallbackStage.dependsOn]) }),
      }),
    }),
  };
}

/** Стабильный структурный хеш для скомпилированного DAG (будущий ключ кеша/инкрементальный). */
function planStructuralHash(
  executionOrder: readonly StageId[],
  dependencyGraph: ReadonlyMap<StageId, readonly StageId[]>,
): string {
  // Ложное срабатывание: это входные данные для фингерпринтинга DAG, а не модельные/тренировочные данные.
  // Хешируем структуру: stageId:зависимости1,зависимости2,... (отсортированные для детерминизма)
  // eslint-disable-next-line ai-security/model-poisoning
  const structuralData = executionOrder
    .map((stageId) =>
      `${stageId}:${sortedCopy(dependencyGraph.get(stageId) ?? [], compareStageIds).join(',')}`
    )
    .join('|');
  return computeSecureHash(structuralData);
}

function computePlanVersion(
  executionOrder: readonly StageId[],
  structuralHashValue: string,
): string {
  return `${executionOrder.length}_${structuralHashValue}`;
}

function compilePlan<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
  config: PipelineConfig<TSlotMap>,
): CompiledPlan<TSlotMap> | ExecutionPlanError {
  if (plugins.length === 0) {
    return { kind: 'NO_PLUGINS' };
  }

  const limits = resolvePlanLimits(config);
  if (plugins.length > limits.maxStages) {
    return {
      kind: 'INVALID_CONFIG',
      reason: `Too many plugins: ${plugins.length} exceeds maximum ${limits.maxStages}`,
    };
  }

  // Фаза 1: валидация плагинов + детерминированная генерация stage-id.
  const normalized = normalizePlugins(plugins);
  if ('kind' in normalized) {
    return normalized;
  }

  const { validatedPlugins, stageIds } = normalized;

  // Фаза 2: валидация зависимостей на уровне слотов.
  const slotValidationError = validateSlotsPhase(validatedPlugins, stageIds);
  if (slotValidationError !== null) {
    return slotValidationError;
  }

  // Фаза 4: построение графа (абстракция DAG).
  const slotToStageId = buildSlotToStageMap(validatedPlugins, stageIds);
  const dag = buildDependencyGraph(
    validatedPlugins,
    stageIds,
    slotToStageId,
  );

  const structuralLimitsError = validateStructuralLimitsPhase(dag, limits);
  if (structuralLimitsError !== null) {
    return structuralLimitsError;
  }

  const executionOrder = runKahn(dag.dependencyGraph, dag.dependentsGraph, dag.inDegree, stageIds);
  if ('kind' in executionOrder) {
    return executionOrder;
  }

  const depthLimitsError = validateDepthLimitsPhase(dag, executionOrder, limits);
  if (depthLimitsError !== null) {
    return depthLimitsError;
  }

  return {
    data: {
      stageIds,
      executionOrder,
      structuralHash: planStructuralHash(executionOrder, dag.dependencyGraph),
      dependencyGraph: buildDependencyMap(dag.dependencyGraph),
      reverseDependencyGraph: buildReverseDependencyIndex(dag.dependentsGraph),
    },
    normalized,
    dag,
    executionOrder,
  };
}

function materializeRuntimePlan<TSlotMap extends Readonly<Record<string, unknown>>>(
  compiled: CompiledPlan<TSlotMap>,
  config: PipelineConfig<TSlotMap>,
): ExecutionPlan<TSlotMap> {
  const { normalized, executionOrder, dag, data } = compiled;
  const planWithoutVersion = materializeExecutionPlan(
    normalized.validatedPlugins,
    normalized.stageIds,
    executionOrder,
    dag.dependencyGraph,
    dag.dependentsGraph,
    config,
  );
  return {
    ...planWithoutVersion,
    version: Object.freeze(computePlanVersion(executionOrder, data.structuralHash)),
  };
}

/* ============================================================================
 * 5. API — PUBLIC ENTRY POINT
 * ============================================================================ */

/** Публичный конструктор плана выполнения. */
export function createExecutionPlan<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
  config: PipelineConfig<TSlotMap>,
): ExecutionPlan<TSlotMap> | ExecutionPlanError {
  return createExecutionPlanSafe(plugins, config);
}

/** Безопасный API: никогда не выбрасывает исключения, возвращает дискриминированный union при ошибке. */
export function createExecutionPlanSafe<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
  config: PipelineConfig<TSlotMap>,
): ExecutionPlan<TSlotMap> | ExecutionPlanError {
  const compiled = compilePlan(plugins, config);
  if ('kind' in compiled) {
    return compiled;
  }
  return materializeRuntimePlan(compiled, config);
}

function formatExecutionPlanError(error: ExecutionPlanError): string {
  switch (error.kind) {
    case 'NO_PLUGINS':
      return 'Построение плана выполнения не удалось: плагины не предоставлены';
    case 'DUPLICATE_PROVIDERS':
      return `Построение плана выполнения не удалось: слот "${error.slot}" предоставляется несколькими стадиями (${
        error.stageIds.join(', ')
      })`;
    case 'UNKNOWN_SLOT':
      return `Построение плана выполнения не удалось: стадия "${error.stageId}" зависит от неизвестного слота "${error.slot}"`;
    case 'CIRCULAR_DEPENDENCY':
      return `Построение плана выполнения не удалось: обнаружена циклическая зависимость (${
        error.path.join(' -> ')
      })`;
    case 'INVALID_PLUGIN':
      return `Построение плана выполнения не удалось: некорректный плагин "${error.stageId}" (${error.reason})`;
    case 'INVALID_CONFIG':
      return `Построение плана выполнения не удалось: некорректная конфигурация (${error.reason})`;
    default: {
      /* c8 ignore next 2 -- exhaustive guard for future union extensions */
      const exhaustive: never = error;
      return String(exhaustive);
    }
  }
}

/** API с выбрасыванием исключений: удобен для мест вызова, которые полагаются на исключения. */
/* eslint-disable fp/no-throw */
export function createExecutionPlanOrThrow<TSlotMap extends Readonly<Record<string, unknown>>>(
  plugins: readonly StagePlugin<TSlotMap>[],
  config: PipelineConfig<TSlotMap>,
): ExecutionPlan<TSlotMap> {
  const result = createExecutionPlanSafe(plugins, config);
  if ('kind' in result) {
    throw new Error(formatExecutionPlanError(result));
  }
  return result;
}
/* eslint-enable fp/no-throw */
