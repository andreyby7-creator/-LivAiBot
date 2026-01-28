#!/usr/bin/env node

/**
 * Скрипт для проверки использования deprecated типов и API React в проекте
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';

const DEPRECATED_PATTERNS = [
  // ============================================================================
  // React deprecated types and APIs
  // ============================================================================
  {
    pattern: /\bFormEvent\b(?!\s*<)/g,
    name: 'React.FormEvent (deprecated, use React.SubmitEvent or React.SyntheticEvent)',
  },
  {
    pattern: /\bFormEventHandler\b/g,
    name: 'React.FormEventHandler (deprecated, use explicit function type)',
  },
  { pattern: /\bReact\.createClass\b/g, name: 'React.createClass (deprecated)' },
  { pattern: /\bReact\.PropTypes\b/g, name: 'React.PropTypes (deprecated)' },
  { pattern: /\bfindDOMNode\b/g, name: 'React.findDOMNode (deprecated)' },
  { pattern: /\bReact\.Component\s*<\s*any\s*>/g, name: 'React.Component<any> (use proper types)' },
  {
    pattern: /import\s+.*\bFormEvent\b.*from\s+['"]react['"]/g,
    name: 'Import FormEvent from react (deprecated)',
  },
  {
    pattern: /import\s+.*\bFormEventHandler\b.*from\s+['"]react['"]/g,
    name: 'Import FormEventHandler from react (deprecated)',
  },
  { pattern: /:\s*FormEvent\s*</g, name: 'Type annotation with FormEvent (deprecated)' },
  {
    pattern: /:\s*FormEventHandler\s*</g,
    name: 'Type annotation with FormEventHandler (deprecated)',
  },

  // ============================================================================
  // Node.js deprecated APIs (security and performance critical)
  // ============================================================================
  {
    pattern: /\burl\.parse\b/g,
    name: 'Node.js url.parse() (deprecated, use new URL() or url.URL constructor)',
  },
  {
    pattern: /\burl\.resolve\b/g,
    name: 'Node.js url.resolve() (deprecated, use new URL() with relative resolution)',
  },
  {
    pattern: /\bfs\.exists\b/g,
    name: 'Node.js fs.exists() (deprecated, use fs.access() or fs.stat())',
  },
  {
    pattern: /\bfs\.existsSync\b/g,
    name:
      'Node.js fs.existsSync() (not recommended, use fs.accessSync() or fs.statSync() to avoid race conditions)',
  },
  {
    pattern: /\bcrypto\.createCipher\b/g,
    name: 'Node.js crypto.createCipher() (deprecated, insecure, use crypto.createCipheriv())',
  },
  {
    pattern: /\bcrypto\.createDecipher\b/g,
    name: 'Node.js crypto.createDecipher() (deprecated, insecure, use crypto.createDecipheriv())',
  },
  {
    pattern: /\bprocess\.nextTick\s*\(\s*function\s*\(\)\s*\{/g,
    name: 'Node.js process.nextTick with function (deprecated, use arrow function or async)',
  },

  // ============================================================================
  // TypeScript deprecated types/utilities
  // ============================================================================
  {
    pattern: /\bParameters\s*<\s*any\s*>/g,
    name: 'TypeScript Parameters<any> (use proper function type)',
  },
  {
    pattern: /\bReturnType\s*<\s*any\s*>/g,
    name: 'TypeScript ReturnType<any> (use proper function type)',
  },

  // ============================================================================
  // Next.js deprecated APIs (if used)
  // ============================================================================
  {
    pattern: /\bnext\/legacy\/image\b/g,
    name: 'Next.js legacy/image (deprecated, use next/image)',
  },
  {
    pattern: /\bnext\/legacy\/script\b/g,
    name: 'Next.js legacy/script (deprecated, use next/script)',
  },

  // ============================================================================
  // Effect deprecated APIs
  // ============================================================================
  {
    pattern: /\bEffect\.run\b/g,
    name: 'Effect.run() (deprecated in Effect 3.x, use Runtime.runPromise or Runtime.runSync)',
  },
  {
    pattern: /\bEffect\.runPromise\b/g,
    name: 'Effect.runPromise() (deprecated, use Runtime.runPromise)',
  },
  {
    pattern: /\bEffect\.runSync\b/g,
    name: 'Effect.runSync() (deprecated, use Runtime.runSync - acceptable in test files)',
  },
  {
    pattern: /\bEffect\.pipe\s*\(\s*Effect\./g,
    name: 'Effect.pipe() with nested Effect (deprecated pattern, use direct composition)',
  },

  // ============================================================================
  // Zod deprecated APIs
  // ============================================================================
  {
    pattern: /\b\.nonstrict\(\)/g,
    name: 'Zod .nonstrict() (deprecated in Zod 4.x, use .passthrough() or .strip())',
  },
  {
    pattern: /\b\.nullish\(\)/g,
    name: 'Zod .nullish() (deprecated, use .nullable().optional() or .nullish() equivalent)',
  },
  { pattern: /\bz\.nonstrict\(\)/g, name: 'Zod z.nonstrict() (deprecated in Zod 4.x)' },
];

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.next',
  'build',
  '.turbo',
  'venv',
  '__pycache__',
];
const EXCLUDE_FILES = ['check-deprecated.js'];

function shouldExcludeDir(dirName) {
  return EXCLUDE_DIRS.includes(dirName) || dirName.startsWith('.');
}

function shouldIncludeFile(fileName) {
  return EXTENSIONS.includes(extname(fileName));
}

function scanDirectory(dirPath, results = []) {
  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          if (!shouldExcludeDir(entry)) {
            scanDirectory(fullPath, results);
          }
        } else if (stat.isFile() && shouldIncludeFile(entry)) {
          checkFile(fullPath, results);
        }
      } catch (error) {
        // Игнорируем ошибки доступа к файлам
      }
    }
  } catch (error) {
    // Игнорируем ошибки доступа к директориям
  }

  return results;
}

function checkFile(filePath, results) {
  // Пропускаем сам скрипт проверки
  const fileName = filePath.split('/').pop();
  if (EXCLUDE_FILES.includes(fileName)) {
    return;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      // Пропускаем комментарии и строки в кавычках (чтобы не ловить паттерны в строках)
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
        continue;
      }

      // Пропускаем тестовые файлы для Effect.runSync (это нормально в тестах)
      const isTestFile = filePath.includes('.test.')
        || filePath.includes('.spec.')
        || filePath.includes('/tests/');

      for (const { pattern, name } of DEPRECATED_PATTERNS) {
        // Пропускаем Effect.runSync в тестовых файлах
        if (isTestFile && name.includes('Effect.runSync')) {
          continue;
        }

        // Сбрасываем lastIndex для глобального регулярного выражения
        pattern.lastIndex = 0;
        const match = pattern.exec(line);
        if (match) {
          // Проверяем, что это не строка в кавычках
          const beforeMatch = line.substring(0, match.index);
          const singleQuotes = (beforeMatch.match(/'/g) || []).length;
          const doubleQuotes = (beforeMatch.match(/"/g) || []).length;
          const backticks = (beforeMatch.match(/`/g) || []).length;

          // Если нечетное количество кавычек, значит мы внутри строки
          if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0 && backticks % 2 === 0) {
            results.push({
              file: filePath,
              line: lineIndex + 1,
              issue: name,
              match: match[0].trim(),
              context: line.trim().substring(0, 120),
            });
          }
        }
      }
    }
  } catch (error) {
    // Игнорируем ошибки чтения файлов
  }
}

// Основная функция
function main() {
  const projectRoot = process.cwd();
  const packagesDir = join(projectRoot, 'packages');
  const appsDir = join(projectRoot, 'apps');

  console.log(
    '🔍 Проверка deprecated типов и API (React, Node.js, TypeScript, Next.js, Effect, Zod)...\n',
  );

  const results = [];

  // Проверяем packages
  if (statSync(packagesDir).isDirectory()) {
    scanDirectory(packagesDir, results);
  }

  // Проверяем apps
  if (statSync(appsDir).isDirectory()) {
    scanDirectory(appsDir, results);
  }

  // Проверяем корневые файлы
  scanDirectory(projectRoot, results);

  // Фильтруем результаты - исключаем node_modules и другие исключенные директории
  const filteredResults = results.filter((r) => {
    const relativePath = r.file.replace(projectRoot + '/', '');
    return !EXCLUDE_DIRS.some((excluded) => relativePath.includes(excluded));
  });

  if (filteredResults.length === 0) {
    console.log('✅ Отлично! Не найдено использования deprecated типов или API.\n');
    process.exit(0);
  } else {
    console.log(`❌ Найдено ${filteredResults.length} использований deprecated типов/API:\n`);

    // Группируем по файлам
    const grouped = {};
    filteredResults.forEach((result) => {
      if (!grouped[result.file]) {
        grouped[result.file] = [];
      }
      grouped[result.file].push(result);
    });

    Object.entries(grouped).forEach(([file, issues]) => {
      const relativePath = file.replace(projectRoot + '/', '');
      console.log(`📄 ${relativePath}:`);
      issues.forEach((issue) => {
        console.log(`   Строка ${issue.line}: ${issue.issue}`);
        console.log(`   Контекст: ${issue.context}`);
        console.log('');
      });
    });

    console.log(
      `\n⚠️  Всего найдено: ${filteredResults.length} использований deprecated типов/API\n`,
    );
    process.exit(1);
  }
}

main();
