#!/usr/bin/env node
/**
 * @file Генерация Zod-схем из OpenAPI снапшотов.
 *
 * Этот файл является частью contract pipeline:
 * FastAPI → OpenAPI snapshot → (этот файл) → Zod schemas → Frontend runtime validation
 *
 * Источник истины:
 * - `services/<service>/openapi.json` (генерируется из FastAPI `app.openapi()`)
 *
 * Выход:
 * - `packages/core-contracts/src/validation/zod/generated/<service>.ts`
 *
 * ⚠️ Сгенерированные файлы перезаписываются при каждом запуске.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

process.on('exit', () => {
  if (process.exitCode && process.exitCode !== 0) {
    // Явный маркер в логах CI, чтобы проще искать причину падения.
    console.error('[gen] генерация Zod-схем завершилась с ошибкой');
  }
});

const schemasOnlyTemplatePath = path.join(
  repoRoot,
  'scripts',
  'templates',
  'openapi-zod-schemas-only.hbs',
);

const targets = [
  {
    name: 'auth',
    input: path.join(repoRoot, 'services', 'auth-service', 'openapi.json'),
    output: path.join(
      repoRoot,
      'packages',
      'core-contracts',
      'src',
      'validation',
      'zod',
      'generated',
      'auth.ts',
    ),
  },
  {
    name: 'bots',
    input: path.join(repoRoot, 'services', 'bots-service', 'openapi.json'),
    output: path.join(
      repoRoot,
      'packages',
      'core-contracts',
      'src',
      'validation',
      'zod',
      'generated',
      'bots.ts',
    ),
  },
  {
    name: 'conversations',
    input: path.join(
      repoRoot,
      'services',
      'conversations-service',
      'openapi.json',
    ),
    output: path.join(
      repoRoot,
      'packages',
      'core-contracts',
      'src',
      'validation',
      'zod',
      'generated',
      'conversations.ts',
    ),
  },
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeHeader(filePath, serviceName) {
  const header =
    `/**\n * @file Автосгенерированные Zod-схемы (OpenAPI → Zod) для сервиса \"${serviceName}\".\n` +
    `\n` +
    ` * Источник истины: services/<service>/openapi.json\n` +
    `\n` +
    ` * ⚠️ АВТОСГЕНЕРИРОВАНО. НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ.\n` +
    ` * Любые изменения вносятся через OpenAPI и повторную генерацию.\n` +
    ` */\n\n`;

  const content = fs.readFileSync(filePath, 'utf8');
  if (content.startsWith('/**\n * @file Автосгенерированные Zod-схемы')) return;
  fs.writeFileSync(filePath, header + content, 'utf8');
}

function run() {
  for (const t of targets) {
    if (!fs.existsSync(t.input)) {
      console.error(`[error] отсутствует OpenAPI снапшот: ${t.input}`);
      process.exitCode = 1;
      continue;
    }

    const stat = fs.statSync(t.input);
    if (stat.size === 0) {
      console.error(`[error] OpenAPI снапшот пуст: ${t.input}`);
      process.exitCode = 1;
      continue;
    }

    ensureDir(t.output);

    // Важно: CLI `openapi-zod-client` запускаем из пакета, где он установлен.
    // Используем `pnpm -C packages/core-contracts exec`, чтобы не зависеть от глобальных бинарников.
    const args = [
      '-C',
      'packages/core-contracts',
      'exec',
      'openapi-zod-client',
      t.input,
      '-o',
      t.output,
      '--template',
      schemasOnlyTemplatePath,
      '--export-schemas',
      '--export-types',
      '--no-with-alias',
    ];

    console.log(`[gen] ${t.name}: ${path.relative(repoRoot, t.output)}`);
    const res = spawnSync('pnpm', args, { stdio: 'inherit', cwd: repoRoot });
    if (res.status !== 0) {
      console.error(`[error] openapi-zod-client завершился с ошибкой для: ${t.name}`);
      process.exitCode = res.status ?? 1;
      continue;
    }

    writeHeader(t.output, t.name);
  }
}

run();

