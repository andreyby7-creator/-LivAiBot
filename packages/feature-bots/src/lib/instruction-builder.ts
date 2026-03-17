/**
 * @file packages/feature-bots/src/lib/instruction-builder.ts
 * ============================================================================
 * 🤖 FEATURE-BOTS — Instruction Builder (Prompt + BotSettings → instruction)
 * ============================================================================
 *
 * Архитектурная роль:
 * - Порождает “полную” инструкцию бота (строку) из доменных prompt-блоков (`Prompt`)
 *   и доменных настроек поведения (`BotSettings`).
 * - Это **lib-layer**: без side-effects, без зависимостей от HTTP/DB/DTO, пригодно для UI/effects.
 *
 * Принципы:
 * - ✅ SRP: только детерминированное построение инструкции (форматирование/склейка).
 * - ✅ Deterministic: одинаковый input → одинаковая строка (канонический порядок секций).
 * - ✅ Strict typing: узкие опции без `Record<string, unknown>`.
 * - ✅ Extensible: optional hooks через DI (форматирование секций можно переопределять снаружи).
 *
 * @remarks
 * - `temperature/contextWindow` — параметры рантайм-конфигурации модели и обычно **не** должны
 *   попадать в instruction-текст; builder по умолчанию не включает их.
 * - Формат результата — markdown-подобный: секции `## <title>` и строки, разделённые `\n`.
 *   Если этот формат важен для consumers, фиксируйте его тестами на уровне feature/UI.
 */
import type { BotSettings } from '../domain/BotSettings.js';
import type { HandoffRule, Prompt } from '../domain/Prompt.js';

type InstructionSectionId =
  | 'system_prompt'
  | 'language_style'
  | 'constraints'
  | 'handoff_rules'
  | 'behavior_flags'
  | 'fallback_message';

export type BuildBotInstructionInput = Readonly<{
  /** Структурированные prompt-блоки инструкции. */
  readonly prompt: Prompt;
  /** Настройки поведения бота. */
  readonly settings: BotSettings;
}>;

type Section = Readonly<{
  readonly id: InstructionSectionId;
  readonly title: string;
  readonly lines: readonly string[];
}>;

type BuildBotInstructionOptionsBase = Readonly<{
  /**
   * Добавлять ли секции, выводимые из настроек (PII/изображения/interruption rules).
   * @defaultValue true
   */
  readonly includeBehaviorFlags?: boolean;
  /**
   * Добавлять ли секцию handoff rules.
   * @defaultValue true
   */
  readonly includeHandoffRules?: boolean;
  /**
   * Добавлять ли инструкцию для fallback-ответа (unrecognized message).
   * @defaultValue true
   */
  readonly includeFallbackMessage?: boolean;
  /**
   * Добавлять ли constraints блок (если задан).
   * @defaultValue true
   */
  readonly includeConstraints?: boolean;
}>;

type BuildBotInstructionOptionsFormat = Readonly<{
  /**
   * DI-hook: позволяет переопределять формат секции (title/lines) для конкретного id.
   *
   * @remarks
   * Если вернёт `undefined` — используется канонический формат builder-а.
   * Используйте для контекстных UI-правил, не дублируя основную сборку секций.
   */
  readonly formatSection?: (section: Section) => Section | undefined;
}>;

export type BuildBotInstructionOptions = Readonly<
  BuildBotInstructionOptionsBase & BuildBotInstructionOptionsFormat
>;

const defaultOptions = Object.freeze(
  {
    includeBehaviorFlags: true,
    includeHandoffRules: true,
    includeFallbackMessage: true,
    includeConstraints: true,
  } satisfies Required<BuildBotInstructionOptionsBase>,
);

const asQuoted = (value: string): string => JSON.stringify(value);

const compactLines = (lines: readonly string[]): readonly string[] =>
  lines
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

/**
 * Склеивает секции в итоговую инструкцию.
 *
 * @remarks
 * Секции с пустыми `lines` отбрасываются, чтобы не плодить пустые заголовки.
 */
const joinSections = (sections: readonly Section[]): string =>
  sections
    .filter((s) => s.lines.length > 0)
    .map((s) => `## ${s.title}\n${s.lines.join('\n')}`)
    .join('\n\n');

/**
 * Каноническая нормализация порядка handoff rules для детерминизма.
 * Сортировка не изменяет семантику набора правил, но устраняет “дрейф” формата.
 */
const sortHandoffRules = (rules: readonly HandoffRule[]): readonly HandoffRule[] =>
  [...rules].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.trigger !== b.trigger) return a.trigger < b.trigger ? -1 : 1;
    if (a.action !== b.action) return a.action < b.action ? -1 : 1;
    return 0;
  });

/**
 * Определяет, включён ли handoff с учётом feature flag в настройках.
 *
 * @remarks
 * Если флаг отсутствует — считаем handoff включённым (backward-compatible default).
 */
const getEffectiveHandoffEnabled = (settings: BotSettings): boolean =>
  settings.extra?.featureFlags?.handoff !== false;

/**
 * Построить “полную” инструкцию бота из prompt-блоков и настроек.
 *
 * @remarks
 * - Функция чистая: не трогает глобальное состояние и не использует Date.now().
 * - Опциональный formatSection позволяет UI/feature слою настраивать presentation,
 *   не дублируя логику выбора секций и их состава.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- canonical, readable секционный builder; ветвления отражают опции include*, выносить в хелперы невыгодно из-за canary ruleset (ai-security)
export function buildBotInstruction(
  input: BuildBotInstructionInput,
  options?: Readonly<BuildBotInstructionOptions>,
): string {
  const cfg = {
    ...defaultOptions,
    ...(options ?? {}),
  } as const;

  const { prompt, settings } = input;

  const sections: Section[] = [];

  sections.push({
    id: 'system_prompt',
    title: 'System prompt',
    lines: compactLines([String(prompt.systemPrompt)]),
  });

  sections.push({
    id: 'language_style',
    title: 'Language & style',
    lines: compactLines([
      `- language: ${prompt.language}`,
      `- style: ${prompt.style}`,
      ...(prompt.greeting !== undefined
        ? [`- greeting: ${asQuoted(String(prompt.greeting))}`]
        : []),
    ]),
  });

  if (cfg.includeConstraints && prompt.constraints !== undefined) {
    sections.push({
      id: 'constraints',
      title: 'Constraints',
      lines: compactLines([String(prompt.constraints)]),
    });
  }

  const includeHandoff = cfg.includeHandoffRules && getEffectiveHandoffEnabled(settings);
  if (includeHandoff && prompt.handoffRules.length > 0) {
    const sorted = sortHandoffRules(prompt.handoffRules);
    sections.push({
      id: 'handoff_rules',
      title: 'Handoff rules',
      lines: compactLines(
        sorted.map((r) => `- ${r.trigger} → ${r.action} (priority=${r.priority})`),
      ),
    });
  }

  if (cfg.includeBehaviorFlags) {
    sections.push({
      id: 'behavior_flags',
      title: 'Behavior flags',
      lines: compactLines([
        `- piiMasking: ${settings.piiMasking ? 'enabled' : 'disabled'}`,
        `- imageRecognition: ${settings.imageRecognition ? 'enabled' : 'disabled'}`,
        `- allowUserInterruption: ${
          settings.interruptionRules.allowUserInterruption ? 'true' : 'false'
        }`,
        `- maxConcurrentSessions: ${settings.interruptionRules.maxConcurrentSessions}`,
      ]),
    });
  }

  if (cfg.includeFallbackMessage) {
    sections.push({
      id: 'fallback_message',
      title: 'Fallback message',
      lines: compactLines([
        `When you cannot answer confidently, reply with: ${
          asQuoted(settings.unrecognizedMessage.message)
        }`,
        ...(settings.unrecognizedMessage.showSupportHint
          ? ['Also suggest contacting support.']
          : []),
      ]),
    });
  }

  const formatted = sections.map((s) => {
    const override = options?.formatSection?.(s);
    return override ?? s;
  });

  return joinSections(formatted);
}
