#!/usr/bin/env node
/**
 * @file Скрипт для удаления неиспользуемых eslint-disable директив
 * 
 * Использует ESLint API для проверки неиспользуемых директив и удаляет их.
 * Поддерживает любые правила, включая @typescript-eslint/prefer-readonly-parameter-types.
 */

import { ESLint } from 'eslint';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Паттерны для поиска и удаления директив (не используются напрямую, только для справки)
// const directivePatterns = [
//   // eslint-disable-next-line
//   /^\s*\/\/\s*eslint-disable-next-line\s+([^\s]+(?:\s+[^\n]+)?)\s*$/gm,
//   // eslint-disable-line в конце строки
//   /\s*\/\/\s*eslint-disable-line\s+([^\s]+(?:\s+[^\n]+)?)\s*$/gm,
//   // eslint-disable блочный
//   /\/\*\s*eslint-disable\s+([^*]+)\s*\*\/\s*/g,
//   // eslint-enable блочный
//   /\/\*\s*eslint-enable\s+([^*]+)\s*\*\/\s*/g,
// ];

async function findUnusedDirectives(filePath) {
  const eslint = new ESLint({
    cwd: projectRoot,
    overrideConfigFile: path.join(projectRoot, 'eslint.config.mjs'),
  });

  try {
    const results = await eslint.lintFiles([filePath]);
    const result = results[0];
    
    if (!result) return [];

    // Ищем предупреждения о неиспользуемых директивах
    const unusedDirectives = [];
    for (const message of result.messages) {
      if (
        message.severity === 1 && // warning
        message.message.includes('Unused eslint-disable directive')
      ) {
        unusedDirectives.push({
          line: message.line,
          column: message.column,
          rule: message.ruleId,
        });
      }
    }

    return unusedDirectives;
  } catch (error) {
    console.warn(`⚠️  Ошибка при проверке ${filePath}: ${error.message}`);
    return [];
  }
}

function removeDirectiveFromLine(content, lineNumber, ruleName) {
  const lines = content.split('\n');
  const lineIndex = lineNumber - 1;
  
  if (lineIndex < 0 || lineIndex >= lines.length) return content;

  const line = lines[lineIndex];
  
  // Удаляем eslint-disable-next-line
  let newLine = line.replace(
    /^\s*\/\/\s*eslint-disable-next-line\s+[^\n]+\s*$/,
    '',
  );
  
  // Удаляем eslint-disable-line (в конце строки)
  newLine = newLine.replace(
    /\s*\/\/\s*eslint-disable-line\s+[^\n]+\s*$/,
    '',
  );
  
  // Удаляем блочные комментарии на той же строке
  newLine = newLine.replace(
    /\/\*\s*eslint-disable\s+[^*]+\s*\*\/\s*/g,
    '',
  );
  newLine = newLine.replace(
    /\/\*\s*eslint-enable\s+[^*]+\s*\*\/\s*/g,
    '',
  );

  lines[lineIndex] = newLine;
  return lines.join('\n');
}

function removeBlockDirectives(content, ruleName) {
  let newContent = content;
  
  // Удаляем блочные eslint-disable/enable
  newContent = newContent.replace(
    /\/\*\s*eslint-disable\s+[^*]+\s*\*\/\s*/g,
    '',
  );
  newContent = newContent.replace(
    /\/\*\s*eslint-enable\s+[^*]+\s*\*\/\s*/g,
    '',
  );
  
  return newContent;
}

async function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Проверяем, есть ли в файле eslint-disable директивы
  if (!content.includes('eslint-disable')) {
    return false;
  }

  // Находим неиспользуемые директивы через ESLint API
  const unusedDirectives = await findUnusedDirectives(filePath);
  
  if (unusedDirectives.length === 0) {
    return false;
  }

  let newContent = content;
  let changed = false;

  // Удаляем неиспользуемые директивы
  for (const directive of unusedDirectives) {
    const before = newContent;
    newContent = removeDirectiveFromLine(newContent, directive.line, directive.rule);
    if (before !== newContent) {
      changed = true;
    }
  }

  // НЕ удаляем блочные директивы автоматически - ESLint сам сообщит о неиспользуемых
  // Удаляем только те, которые ESLint явно пометил как неиспользуемые

  // Удаляем множественные пустые строки
  newContent = newContent.replace(/\n\s*\n\s*\n+/g, '\n\n');

  if (changed) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return true;
  }

  return false;
}

async function main() {
  const files = await glob('**/*.{ts,tsx}', {
    cwd: projectRoot,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/.cache/**',
    ],
  });

  let processed = 0;
  let changed = 0;

  console.log(`🔍 Проверка ${files.length} файлов на неиспользуемые eslint-disable директивы...\n`);

  for (const file of files) {
    const filePath = path.join(projectRoot, file);
    
    processed++;
    if (await processFile(filePath)) {
      changed++;
      console.log(`✅ ${file}`);
    }
  }

  console.log(`\n📊 Обработано файлов: ${processed}`);
  console.log(`📝 Изменено файлов: ${changed}`);
}

main().catch(console.error);
