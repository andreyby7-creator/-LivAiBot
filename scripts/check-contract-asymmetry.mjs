#!/usr/bin/env node
/**
 * @file scripts/check-contract-asymmetry.mjs
 * ============================================================================
 * 🧪 Contract Asymmetry / Leakage Guard (repo-wide)
 * ============================================================================
 *
 * Назначение:
 * - Быстрый repo-wide чек “опасных” контрактных паттернов, которые со временем
 *   приводят к недетерминизму, ambiguity и утечкам в логах/telemetry.
 *
 * Это НЕ заменяет линтер/TS type-check, это “guard rail”:
 * - Находит подозрительные optional поля (retryable/operation/reason), которые часто
 *   становятся источником неопределённого поведения в rule-engine.
 * - Находит `unknown` в контекстах ошибок (`value?: unknown`) как потенциальную точку утечек.
 *
 * Исключения:
 * - Можно подавить конкретное совпадение комментарием в строке:
 *   `// contract-asymmetry: ignore`
 *
 * Запуск:
 * - `pnpm run check:contract-asymmetry`
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const WORKSPACE_ROOT = process.cwd();

const TARGET_DIRS = ['packages', 'apps', 'config', 'scripts'];
const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const SELF_REL = 'scripts/check-contract-asymmetry.mjs';

const args = new Set(process.argv.slice(2));
const FLAG_STATS = args.has('--stats');
// NOTE: baseline intentionally removed — this command must fail on ANY hit.

/** @type {ReadonlyArray<{id: string, description: string, pattern: RegExp}>} */
const RULES = [
  {
    id: 'optional-retryable',
    description: 'Опциональный retryable (недетерминизм в политике ретраев): `retryable?: boolean`',
    pattern: /\bretryable\s*\?\s*:\s*boolean\b/u,
  },
  {
    id: 'unknown-value',
    description:
      'Потенциальная утечка в контексте/валидации: `value?: unknown` (лучше primitives или maskedValue)',
    pattern: /\bvalue\s*\?\s*:\s*unknown\b/u,
  },
  {
    id: 'optional-operation',
    description: 'Опциональная operation (ambiguity в состоянии): `operation?: BotCommandType`',
    pattern: /\boperation\s*\?\s*:\s*BotCommandType\b/u,
  },
  {
    id: 'optional-pause-reason',
    description: 'Опциональная причина паузы (ambiguity): `reason?: BotPauseReason`',
    pattern: /\breason\s*\?\s*:\s*BotPauseReason\b/u,
  },
  {
    id: 'optional-enforcement-reason',
    description: 'Опциональная enforcement причина (ambiguity): `reason?: BotEnforcementReason`',
    pattern: /\breason\s*\?\s*:\s*BotEnforcementReason\b/u,
  },
];

const IGNORE_MARKER = 'contract-asymmetry: ignore';

/** @param {string} dir */
async function listFilesRecursive(dir) {
  /** @type {string[]} */
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    // пропускаем тяжёлые/шумные директории
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build' || entry.name === 'coverage') {
        continue;
      }
      out.push(...(await listFilesRecursive(path.join(dir, entry.name))));
      continue;
    }
    if (!entry.isFile()) continue;
    const filePath = path.join(dir, entry.name);
    if (FILE_EXTENSIONS.has(path.extname(filePath))) out.push(filePath);
  }
  return out;
}

/**
 * @param {string} filePath
 * @param {string} content
 */
function scanFile(filePath, content) {
  const lines = content.split(/\r?\n/u);
  /** @type {Array<{ruleId: string, ruleDescription: string, line: number, preview: string}>} */
  const hits = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line.includes(IGNORE_MARKER)) continue;
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        hits.push({
          ruleId: rule.id,
          ruleDescription: rule.description,
          line: i + 1,
          preview: line.trim().slice(0, 180),
        });
      }
    }
  }

  if (hits.length === 0) return [];
  return hits.map((h) => ({
    ...h,
    filePath,
  }));
}

async function main() {
  /** @type {Array<{filePath: string, ruleId: string, ruleDescription: string, line: number, preview: string}>} */
  const allHits = [];
  let scannedFiles = 0;

  for (const dir of TARGET_DIRS) {
    const abs = path.join(WORKSPACE_ROOT, dir);
    try {
      const stat = await fs.stat(abs);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    const files = await listFilesRecursive(abs);
    for (const filePath of files) {
      if (path.relative(WORKSPACE_ROOT, filePath).replaceAll('\\', '/') === SELF_REL) continue;
      const content = await fs.readFile(filePath, 'utf8');
      scannedFiles += 1;
      allHits.push(...scanFile(filePath, content));
    }
  }

  if (FLAG_STATS) {
    process.stdout.write(
      `ℹ️ contract-asymmetry stats: scanned_files=${scannedFiles}, total_hits=${allHits.length}\n`,
    );
  }

  if (allHits.length === 0) {
    process.stdout.write('✅ contract-asymmetry: no issues found\n');
    process.exit(0);
  }

  const reportHits = allHits;

  // группируем по правилу для более читабельного отчёта
  const grouped = new Map();
  for (const hit of reportHits) {
    const key = hit.ruleId;
    const arr = grouped.get(key) ?? [];
    arr.push(hit);
    grouped.set(key, arr);
  }

  process.stderr.write(`❌ contract-asymmetry: found ${reportHits.length} issue(s)\n`);
  process.stderr.write('\n');
  for (const [ruleId, hits] of grouped.entries()) {
    const ruleDescription = hits[0]?.ruleDescription ?? ruleId;
    process.stderr.write(`- ${ruleId}: ${ruleDescription} (count: ${hits.length})\n`);
    for (const h of hits.slice(0, 50)) {
      const rel = path.relative(WORKSPACE_ROOT, h.filePath);
      process.stderr.write(`  - ${rel}:${h.line}  ${h.preview}\n`);
    }
    if (hits.length > 50) process.stderr.write(`  ... +${hits.length - 50} more\n`);
    process.stderr.write('\n');
  }

  process.stderr.write(
    `Hint: add \`// ${IGNORE_MARKER}\` to suppress a specific line (use sparingly).\n`,
  );
  process.exit(1);
}

try {
  await main();
} catch (err) {
  process.stderr.write(`❌ contract-asymmetry: unexpected error\n`);
  process.stderr.write(`${String(err)}\n`);
  process.exit(2);
}

