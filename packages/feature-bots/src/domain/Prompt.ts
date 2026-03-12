/**
 * @file packages/feature-bots/src/domain/Prompt.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Доменная модель prompt-блоков инструкции
 * ============================================================================
 *
 * Архитектурная роль:
 * - Domain-агрегат Prompt: source-of-truth для структурированных prompt-блоков инструкции бота.
 * - Отдельная от BotInstruction модель: Prompt описывает декомпозицию инструкции на блоки (systemPrompt, greeting, language, style, constraints, handoffRules).
 * - Используется для генерации финальной инструкции из блоков и для rule-engine обработки prompt-блоков.
 *
 * Принципы:
 * - ✅ SRP: только структура prompt-блоков и инварианты (без бизнес-логики и transport-деталей).
 * - ✅ Deterministic: явные, детерминированные блоки (systemPrompt, greeting, language, style, constraints, handoffRules).
 * - ✅ Domain-pure: без HTTP/DB/DTO-деталей, только доменные типы и инварианты.
 * - ✅ Extensible: handoffRules и constraints позволяют эволюцию без ломки core-схемы.
 * - ✅ Microservice-ready: строгая, сериализуемая модель, удобная для межсервисного взаимодействия и rule-engine.
 * - ✅ Scalable rule-engine: handoffRules используют exhaustive unions и registry pattern без if/else-монолита.
 * - ✅ Strict typing: union-типы для language/style/handoffTrigger/handoffCondition, branded types для примитивов, без string и Record в domain.
 */

/* ============================================================================
 * 🔐 BRANDED TYPES
 * ========================================================================== */

/**
 * Системный промпт бота (основная инструкция).
 * Branded-тип, чтобы не путать с произвольным string и greeting.
 */
export type SystemPrompt = string & { readonly __brand: 'SystemPrompt'; };

/**
 * Приветственное сообщение бота.
 * Branded-тип, чтобы не путать с произвольным string и systemPrompt.
 */
export type Greeting = string & { readonly __brand: 'Greeting'; };

/**
 * Ограничения и правила поведения бота.
 * Branded-тип для явного разделения constraints от других текстовых блоков.
 */
export type Constraints = string & { readonly __brand: 'Constraints'; };

/* ============================================================================
 * 🧩 LANGUAGE / STYLE (Exhaustive Unions)
 * ========================================================================== */

/**
 * Язык ответов бота.
 * Exhaustive union обеспечивает type-safety и discoverability.
 */
export type PromptLanguage =
  | 'ru'
  | 'en'
  | 'de'
  | 'fr'
  | 'es'
  | 'it'
  | 'pt'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'ar'
  | 'auto';

/**
 * Стиль ответа бота.
 * Exhaustive union для type-safe обработки стилей.
 */
export type PromptStyle =
  | 'formal'
  | 'casual'
  | 'professional'
  | 'friendly'
  | 'technical'
  | 'creative'
  | 'concise'
  | 'detailed';

/* ============================================================================
 * 🧩 HANDOFF RULES (Scalable Rule-Engine)
 * ========================================================================== */

/**
 * Триггеры для передачи диалога человеку (handoff).
 * Exhaustive union для type-safe обработки триггеров без if/else-монолита.
 */
export type HandoffTrigger =
  | 'user_request'
  | 'escalation_keyword'
  | 'sentiment_negative'
  | 'complex_query'
  | 'timeout'
  | 'error_threshold'
  | 'explicit_handoff_command';

/**
 * Действие при срабатывании триггера handoff.
 * Exhaustive union для детерминированной обработки действий.
 */
export type HandoffAction =
  | 'transfer_to_agent'
  | 'notify_agent'
  | 'schedule_callback'
  | 'escalate_urgent';

/**
 * Типизированные условия для срабатывания правила handoff.
 * Exhaustive union обеспечивает type-safety и избегает runtime errors.
 * ВАЖНО: Domain хранит валидированные объекты, validation выполняется в policy/application слое перед попаданием в domain.
 */
export type HandoffCondition =
  | Readonly<{ type: 'sentiment_threshold'; value: number; }>
  | Readonly<{ type: 'keyword_match'; keywords: readonly string[]; }>
  | Readonly<{ type: 'timeout_seconds'; seconds: number; }>;

/**
 * Правило передачи диалога человеку.
 * Используется в rule-engine для детерминированной обработки handoff-сценариев.
 */
export type HandoffRule = Readonly<{
  /** Триггер, при котором срабатывает правило. */
  readonly trigger: HandoffTrigger;
  /** Действие, выполняемое при срабатывании триггера. */
  readonly action: HandoffAction;
  /**
   * Приоритет правила (чем выше, тем раньше проверяется).
   * Используется для упорядочивания правил в rule-engine.
   * ВАЖНО: Сортировка по priority выполняется в rule-engine/application слое, domain хранит данные как есть.
   */
  readonly priority: number;
  /**
   * Типизированные условия для срабатывания правила (опционально).
   * Используется для расширенных сценариев без изменения core-схемы.
   * ВАЖНО: Validation условий выполняется в application/policy слое перед использованием в rule-engine (ADR-001).
   */
  readonly conditions?: HandoffCondition;
}>;

/**
 * Набор правил передачи диалога человеку.
 * Set-semantics по инвариантам: правила без дубликатов по trigger+priority.
 */
export type HandoffRules = readonly HandoffRule[];

/* ============================================================================
 * 🧩 DOMAIN MODEL
 * ========================================================================== */

/**
 * Доменная модель prompt-блоков инструкции бота.
 * Инварианты:
 * - systemPrompt — непустая строка (после trim).
 * - greeting — опционально, но если задан, то непустая строка (после trim).
 * - language — один из допустимых языков (exhaustive union).
 * - style — один из допустимых стилей (exhaustive union).
 * - constraints — опционально, но если задан, то непустая строка (после trim).
 * - handoffRules — массив без дубликатов по комбинации trigger+priority.
 */
export type Prompt = Readonly<{
  /** Системный промпт бота (основная инструкция). */
  readonly systemPrompt: SystemPrompt;

  /** Приветственное сообщение бота (опционально). */
  readonly greeting?: Greeting;

  /** Язык ответов бота. */
  readonly language: PromptLanguage;

  /** Стиль ответа бота. */
  readonly style: PromptStyle;

  /** Ограничения и правила поведения бота (опционально). */
  readonly constraints?: Constraints;

  /** Правила передачи диалога человеку (handoff rules). */
  readonly handoffRules: HandoffRules;
}>;

/* ============================================================================
 * 🏭 FACTORY
 * ========================================================================== */

/**
 * "Raw" данные для создания Prompt (до нормализации и валидации).
 * Используется в factory-функции для приема данных с возможными не-trimmed строками.
 */
export type PromptRaw = Readonly<{
  /** Системный промпт бота (будет нормализован через trim). */
  readonly systemPrompt: string;
  /** Приветственное сообщение бота (опционально, будет нормализовано через trim). */
  readonly greeting?: string;
  /** Язык ответов бота. */
  readonly language: PromptLanguage;
  /** Стиль ответа бота. */
  readonly style: PromptStyle;
  /** Ограничения и правила поведения бота (опционально, будет нормализовано через trim). */
  readonly constraints?: string;
  /** Правила передачи диалога человеку. */
  readonly handoffRules: HandoffRules;
}>;

/**
 * Factory-функция: принимает raw-строки, делает trim и проверяет инварианты через assertPromptInvariant.
 * Нарушение инвариантов приводит к PromptInvariantError.
 */
export function createPrompt(raw: PromptRaw): Prompt {
  // Нормализация строковых полей через trim
  const normalizedSystemPrompt = raw.systemPrompt.trim();
  const normalizedGreeting = raw.greeting !== undefined
    ? raw.greeting.trim()
    : undefined;
  // eslint-disable-next-line ai-security/model-poisoning -- createPrompt выполняет нормализацию и валидацию через assertPromptInvariant; это factory-функция для создания валидированного domain-объекта из raw данных
  const normalizedConstraints = raw.constraints !== undefined
    ? raw.constraints.trim()
    : undefined;

  // Создание валидированного Prompt с branded types
  // ВАЖНО: assertPromptInvariant проверит, что строки непустые после trim
  const prompt: Prompt = {
    systemPrompt: normalizedSystemPrompt as SystemPrompt,
    ...(normalizedGreeting !== undefined && normalizedGreeting.length > 0 && {
      greeting: normalizedGreeting as Greeting,
    }),
    language: raw.language,
    style: raw.style,
    ...(normalizedConstraints !== undefined && normalizedConstraints.length > 0 && {
      constraints: normalizedConstraints as Constraints,
    }),
    handoffRules: raw.handoffRules,
  } as Prompt;

  // Проверка инвариантов (бросает PromptInvariantError при нарушении)
  // eslint-disable-next-line fp/no-unused-expression -- assertPromptInvariant вызывается для side-effect (проверка инвариантов), результат не используется
  assertPromptInvariant(prompt);

  return prompt;
}

/* ============================================================================
 * 🔧 HELPERS
 * ========================================================================== */

/**
 * Вспомогательный helper для безопасного снятия бренда со строковых типов.
 * Нужен, чтобы избежать прямых `as string` в коде.
 */
const asString = <T extends string>(value: T): string => value as string;

/**
 * Проверка уникальности правил handoff по комбинации trigger+priority.
 * Используется для валидации инварианта отсутствия дубликатов.
 * Оптимизированная реализация: O(n) через Set с улучшенной читаемостью.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- HandoffRules уже readonly (readonly HandoffRule[]), достаточная immutability для domain helper
const hasDuplicateHandoffRules = (rules: HandoffRules): boolean =>
  new Set(rules.map((r) => `${r.trigger}:${r.priority}`)).size !== rules.length;

/* ============================================================================
 * 🧪 INVARIANT CHECKS
 * ========================================================================== */

/**
 * Domain-level ошибка нарушения инвариантов Prompt.
 * Оформлена как Error-alias + фабрика (без class/this), совместима с observability-слоем.
 */
export type PromptInvariantError = Readonly<Error>;

export const createPromptInvariantError = (
  message: string,
): PromptInvariantError => {
  // Используем настоящий Error, чтобы сохранить stack и интеграцию с observability.
  // Локально разрешаем мутацию имени ошибки ради корректного name.
  // eslint-disable-next-line functional/prefer-immutable-types
  const error = new Error(message);
  // eslint-disable-next-line fp/no-mutation
  error.name = 'PromptInvariantError';
  return Object.freeze(error);
};

/**
 * Хелпер, который всегда выбрасывает PromptInvariantError.
 * Используется в тернарных выражениях и для лаконичных проверок.
 */
const throwPromptInvariantError = (message: string): never => {
  throw createPromptInvariantError(message);
};

/**
 * Runtime-проверка инвариантов Prompt.
 * Можно вызывать на границах (при маппинге из/в transport/DB), в тестах и policy-слое.
 */
export function assertPromptInvariant(prompt: Prompt): void {
  const systemPromptValue = asString(prompt.systemPrompt);
  const greetingValue = prompt.greeting !== undefined
    ? asString(prompt.greeting)
    : null;
  // eslint-disable-next-line ai-security/model-poisoning -- assertPromptInvariant вызывается на границах (transport/DB mapping, тесты, policy-слой) для проверки инвариантов перед попаданием в domain; это проверка валидности, а не использование данных для обучения модели
  const constraintsValue = prompt.constraints !== undefined
    ? asString(prompt.constraints)
    : null;

  const systemPromptErrorMessage = systemPromptValue.trim().length === 0
    ? 'Prompt invariant violation: systemPrompt MUST be a non-empty string'
    : null;

  const greetingErrorMessage = greetingValue !== null && greetingValue.trim().length === 0
    ? 'Prompt invariant violation: greeting MUST be a non-empty string if provided'
    : null;

  // eslint-disable-next-line ai-security/model-poisoning -- assertPromptInvariant вызывается на границах для проверки инвариантов; constraintsValue уже извлечен из валидированного prompt, используется только для проверки длины строки (trim().length), не для обучения модели
  const constraintsErrorMessage = constraintsValue !== null && constraintsValue.trim().length === 0
    ? 'Prompt invariant violation: constraints MUST be a non-empty string if provided'
    : null;

  const handoffRulesErrorMessage = hasDuplicateHandoffRules(prompt.handoffRules)
    ? 'Prompt invariant violation: handoffRules MUST NOT contain duplicate rules with same trigger and priority'
    : null;

  const priorityErrorMessage = prompt.handoffRules.some(
      (rule) => !Number.isFinite(rule.priority) || rule.priority < 0,
    )
    ? 'Prompt invariant violation: handoffRules priority MUST be a non-negative finite number'
    : null;

  const errorMessage = systemPromptErrorMessage
    ?? greetingErrorMessage
    ?? constraintsErrorMessage
    ?? handoffRulesErrorMessage
    ?? priorityErrorMessage;

  return errorMessage === null ? undefined : throwPromptInvariantError(errorMessage);
}
