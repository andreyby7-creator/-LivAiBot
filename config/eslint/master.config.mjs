/**
 * @file Главная конфигурация ESLint для LivAi
 * Интегрирует domain-specific правила, shared utilities, кеширование и валидацию зон
 */

import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import globals from 'globals';
import { fileURLToPath } from 'url';
import {
  BASE_RULES,
  CRITICAL_RULES,
  PLUGINS,
  CACHE_CONFIG,
  FOUNDATION_RULES,
  AI_EXECUTION_DOMAIN_RULES,
  UI_DOMAIN_RULES,
  APPS_DOMAIN_RULES,
  commonLanguageOptions,
  EFFECT_TS_RULES,
  EFFECT_ZONE_GUARDS,
  NEXT_RULES,
  REACT_RULES,
} from './constants.mjs';

import { applySeverity, applySeverityAwareRules, QUALITY_WITH_SEVERITY, DEV_EXTRA_RULES, CANARY_EXTRA_RULES } from './shared/rules.mjs';
import { FLATTENED_TYPE_EXEMPTIONS } from './shared/tez.config.mjs';
import { EXPECTED_ZONES, PACKAGE_ZONE_MAPPING } from './utils/check-zones.mjs';
import { effectFpNamingRules } from './rules/naming-conventions.mjs';
import architecturalBoundariesConfig from './rules/architectural-boundaries.mjs';
import boundariesExportsConfig from './rules/boundaries-exports.mjs';

// ==================== DEBUG ====================
const DEBUG_ESLINT_CONFIG = process.env.DEBUG_ESLINT_CONFIG === '1' || false;

// ==================== MONOREPO ROOT (shared helper) ====================
/**
 * Получает корневую директорию проекта (монорепо) по URL файла конфига.
 * Используется в mode-конфигах для единообразного tsconfigRootDir.
 * @param {string} startUrl - обычно import.meta.url из вызывающего файла
 * @returns {string} абсолютный путь к корню проекта
 */
export function resolveMonorepoRoot(startUrl) {
  const __filename = fileURLToPath(startUrl);
  let currentDir = path.dirname(__filename);

  while (currentDir !== path.dirname(currentDir)) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    const tsconfigPath = path.join(currentDir, 'tsconfig.json');

    if (fs.existsSync(packageJsonPath) || fs.existsSync(tsconfigPath)) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  // Fallback: если не нашли, используем расчет по уровням (config/eslint/** -> корень = 3 уровня вверх)
  return path.resolve(path.dirname(__filename), '../../..');
}

// ==================== TEZ AUTO-SYNC (package schema) ====================
/**
 * Автосинхронизация TEZ из схемы пакетов (package.json).
 * ✅ Минималистично: не требует новых файлов и не ломает TEZ source-of-truth
 * ✅ Monorepo-friendly: типы добавляются рядом с пакетом, а ESLint подхватывает автоматически
 * Поддерживаемые поля:
 * - package.json -> "livai": { "tez": { "typeExemptions": [...] } }
 * - package.json -> "tez": { "typeExemptions": [...] } (fallback)
 * Формат элементов:
 * - "RequestInit"
 * - { "from": "lib", "name": "Event" }  -> "lib.Event"
 */
function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeTezEntry(entry) {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (entry && typeof entry === 'object') {
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!name) return null;
    const from = typeof entry.from === 'string' ? entry.from.trim() : '';
    return from ? { from, name } : { name };
  }

  return null;
}

function toTezAllowString(entry) {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    const from = typeof entry.from === 'string' ? entry.from : '';
    const name = typeof entry.name === 'string' ? entry.name : '';
    if (!name) return null;
    return from ? `${from}.${name}` : name;
  }
  return null;
}

function collectTezExemptionsFromPackageJson() {
  const packageJsonPaths = fg.sync(
    [
      'package.json',
      'packages/*/package.json',
      'apps/*/package.json',
      'config/*/package.json',
      'e2e/package.json',
      'scripts/package.json',
    ],
    {
      cwd: process.cwd(),
      onlyFiles: true,
      absolute: false,
      followSymbolicLinks: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/build/**'],
    },
  );

  const collected = [];
  for (const pkgPath of packageJsonPaths) {
    const pkgJson = readJsonSafe(pkgPath);
    if (!pkgJson) continue;

    const tez =
      pkgJson?.livai?.tez?.typeExemptions ??
      pkgJson?.tez?.typeExemptions;

    if (!Array.isArray(tez) || tez.length === 0) continue;

    for (const rawEntry of tez) {
      const normalized = normalizeTezEntry(rawEntry);
      if (normalized) collected.push(normalized);
    }
  }

  // Dedup (stable) by allow-string representation
  const seen = new Set();
  const result = [];
  for (const entry of collected) {
    const key = toTezAllowString(entry);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

const PACKAGE_SCHEMA_TEZ_EXEMPTIONS = collectTezExemptionsFromPackageJson();
const ALL_TEZ_EXEMPTIONS = [...FLATTENED_TYPE_EXEMPTIONS, ...PACKAGE_SCHEMA_TEZ_EXEMPTIONS];
const ALL_TEZ_ALLOW_LIST = (() => {
  const seen = new Set();
  const out = [];
  for (const entry of ALL_TEZ_EXEMPTIONS) {
    const allow = toTezAllowString(entry);
    if (!allow || seen.has(allow)) continue;
    seen.add(allow);
    out.push(allow);
  }
  return out;
})();

// ==================== TEZ RULES ====================
// Type Exemption Zone rules - маппинг severity для типов из TEZ
const TEZ_RULES = {
  // Для типов из FLATTENED_TYPE_EXEMPTIONS разрешаем readonly exemption
  // Это достигается через специальные правила в domain конфигурациях
};

// ==================== CACHE ====================
const zoneCaches = new Map();
const zoneFiles = new Map();

function isCacheValid(cache) {
  if (!cache || !cache.timestamp) return false;
  return Date.now() - cache.timestamp < CACHE_CONFIG.maxAge;
}

function getZoneCacheFile(zoneName) {
  return path.resolve(CACHE_CONFIG.cacheDir, `zone-${zoneName}.json`);
}

function getMaxMtime(files) {
  let maxMtime = 0;
  for (const file of files) {
    try {
      if (!fs.existsSync(file)) continue;
      const stats = fs.statSync(file);
      maxMtime = Math.max(maxMtime, stats.mtime.getTime());
    } catch {}
  }
  return maxMtime;
}

function loadZoneCache(zoneName) {
  const cacheFile = getZoneCacheFile(zoneName);
  if (fs.existsSync(cacheFile)) {
    try {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (isCacheValid(cache)) {
        zoneCaches.set(zoneName, cache);
        return cache;
      }
    } catch {}
  }
  return null;
}

function saveZoneCache(zoneName, boundaries, watchedFiles) {
  const cacheFile = getZoneCacheFile(zoneName);
  const cacheDir = path.dirname(cacheFile);
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const cache = {
    boundaries,
    timestamp: Date.now(),
    mtime: getMaxMtime(watchedFiles),
    watchedFiles,
    version: '1.0',
  };

  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  zoneCaches.set(zoneName, cache);
  zoneFiles.set(zoneName, new Set(watchedFiles));
}

function needsZoneCacheUpdate(zoneName, watchedFiles) {
  const cache = zoneCaches.get(zoneName);
  if (!cache) return true;
  const currentMtime = getMaxMtime(watchedFiles);
  return currentMtime > cache.mtime || !isCacheValid(cache);
}

// ==================== GLOB HELPERS ====================
function createPattern(basePath, extensions = ['ts','tsx','js','jsx'], recursive = true, onlyRoot = false) {
  const pattern = onlyRoot ? '*' : recursive ? '**/*' : '*';
  const extList = extensions.length > 1 ? `{${extensions.join(',')}}` : extensions[0];
  return `${basePath}/${pattern}.${extList}`;
}

function filterExistingPatterns(patterns) {
  if (patterns.length === 0) return [];
  const basePaths = patterns.map(p => p.split('/**/')[0]);
  const existingBasePaths = fg.sync(basePaths, {
    onlyDirectories: true,
    absolute: false,
    cwd: process.cwd(),
    followSymbolicLinks: true,
  });

  // Для monorepo: не фильтровать паттерны для новых пакетов, которые еще не существуют
  // Возвращаем все паттерны, если хотя бы один basePath существует
  const hasExistingBasePaths = existingBasePaths.length > 0;

  if (!hasExistingBasePaths) {
    // Если ни один basePath не существует, возвращаем все паттерны
    // Это позволяет новым пакетам в monorepo иметь паттерны до их создания
    return patterns;
  }

  // Если есть существующие пути, фильтруем только по ним
  const existingPatterns = new Set();
  for (const foundPath of existingBasePaths) {
    for (const originalPattern of patterns) {
      if (originalPattern.startsWith(foundPath + '/')) existingPatterns.add(originalPattern);
    }
  }
  return Array.from(existingPatterns);
}

function generatePatternsForZone(zonePackages) {
  const patterns = zonePackages.map(pkg => createPattern(pkg));
  return filterExistingPatterns(patterns);
}

// ==================== BOUNDARIES ====================
function getZonePriority(zoneName) {
  const priorities = {
    foundation: 100,
    aiExecution: 90,
    infrastructure: 95,
    ui: 70,
    apps: 50,
  };
  return priorities[zoneName] || 75;
}

function generateZoneBoundaries() {
  const boundaries = [];
  for (const [zoneName, zoneConfig] of Object.entries(EXPECTED_ZONES)) {
    const zonePackages = Object.entries(PACKAGE_ZONE_MAPPING)
      .filter(([_, pkgZone]) => pkgZone === zoneName)
      .map(([pkgName, _]) => pkgName);

    const watchedFiles = [
      'config/eslint/utils/check-zones.mjs',
      'config/eslint/constants.mjs',
      ...zonePackages.flatMap(pkg => pkg.includes('/**/') ? [pkg.split('/**/')[0]] : [pkg]),
    ];

    let zoneBoundary = null;
    const cached = loadZoneCache(zoneName);
    if (cached && !needsZoneCacheUpdate(zoneName, watchedFiles)) {
      zoneBoundary = cached.boundaries;
    } else {
      const patterns = generatePatternsForZone(zonePackages);
      if (patterns.length > 0) {
        // Конвертируем camelCase в kebab-case для boundaries плагина
        const boundaryType = zoneName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        zoneBoundary = { type: boundaryType, pattern: patterns, priority: getZonePriority(zoneName) };
        saveZoneCache(zoneName, zoneBoundary, watchedFiles);
      }
    }

    if (zoneBoundary) boundaries.push(zoneBoundary);
  }
  return boundaries;
}

const globalBoundaries = generateZoneBoundaries();

// Отладочный вывод отключен в production

// ==================== SEVERITY-AWARE CONFIG ====================
const ESLINT_MODE = process.env.ESLINT_MODE || 'dev'; // 'dev', 'canary', 'test'
const IS_CANARY = ESLINT_MODE === 'canary';
const SHOULD_FAIL_FAST = IS_CANARY; // canary = strict, dev = soft warnings

// ==================== FAIL-FAST VALIDATION (monorepo safety) ====================
function safeIsDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function safeReadDirNames(dirPath) {
  try {
    return fs
      .readdirSync(dirPath)
      .filter(name => !name.startsWith('.'))
      .filter(name => name !== 'node_modules' && name !== 'dist' && name !== 'build' && name !== 'coverage');
  } catch {
    return [];
  }
}

function getZoneFromPackageZoneMapping(pkgPath) {
  // 1) exact match
  if (Object.prototype.hasOwnProperty.call(PACKAGE_ZONE_MAPPING, pkgPath)) {
    return PACKAGE_ZONE_MAPPING[pkgPath];
  }

  // 2) prefix match (keys ending with '/'), most specific wins
  const prefixMatches = Object.entries(PACKAGE_ZONE_MAPPING)
    .filter(([key]) => key.endsWith('/') && pkgPath.startsWith(key))
    .sort((a, b) => b[0].length - a[0].length);

  return prefixMatches[0]?.[1] ?? null;
}

function listActualMonorepoPackages() {
  const out = [];

  const packagesRoot = path.resolve(process.cwd(), 'packages');
  if (safeIsDirectory(packagesRoot)) {
    for (const name of safeReadDirNames(packagesRoot)) {
      const full = path.join(packagesRoot, name);
      if (safeIsDirectory(full)) out.push(`packages/${name}`);
    }
  }

  const appsRoot = path.resolve(process.cwd(), 'apps');
  if (safeIsDirectory(appsRoot)) {
    for (const name of safeReadDirNames(appsRoot)) {
      const full = path.join(appsRoot, name);
      if (safeIsDirectory(full)) out.push(`apps/${name}`);
    }
  }

  return out.sort();
}

function validateNoUnassignedPackagesInMapping() {
  const actual = listActualMonorepoPackages();
  const unassigned = actual.filter(pkg => getZoneFromPackageZoneMapping(pkg) === null);

  if (unassigned.length === 0) return;

  const message = [
    `[zones] Unassigned packages detected (${unassigned.length}).`,
    `Add explicit entries to PACKAGE_ZONE_MAPPING (config/eslint/utils/check-zones.mjs).`,
    ...unassigned.map(p => `- ${p}`),
  ].join('\n');

  if (SHOULD_FAIL_FAST) {
    throw new Error(message);
  } else {
    // dev mode: don't break local lint, but make it visible
    console.warn(message);
  }
}

function validateArchitecturalBoundariesConfigShape() {
  const hasConfig = Array.isArray(architecturalBoundariesConfig) && architecturalBoundariesConfig.length > 0;
  if (!hasConfig) {
    const message = `[zones] architecturalBoundariesConfig is empty or invalid. Zone isolation depends on rules/architectural-boundaries.mjs.`;
    if (SHOULD_FAIL_FAST) throw new Error(message);
    console.warn(message);
    return;
  }

  // Minimal health check: ensure it targets monorepo paths (apps/ or packages/)
  const targetsMonorepo = architecturalBoundariesConfig.some(cfg => {
    const files = cfg?.files;
    if (!Array.isArray(files)) return false;
    return files.some(f => typeof f === 'string' && (f.includes('packages/') || f.includes('apps/')));
  });

  if (!targetsMonorepo) {
    const message = `[zones] architecturalBoundariesConfig does not appear to target 'packages/' or 'apps/'.`;
    if (SHOULD_FAIL_FAST) throw new Error(message);
    console.warn(message);
  }
}

// Run validations early so canary fails fast
validateNoUnassignedPackagesInMapping();
validateArchitecturalBoundariesConfigShape();

// ==================== ZONE RULES FACTORY ====================
function createZoneRules(zoneConfig) {
  let rules = { ...BASE_RULES };
  const { technologies = [], strictness = 'MEDIUM', type } = zoneConfig;

  // 1. Domain-specific rules
  if (type === 'foundation') rules = { ...rules, ...FOUNDATION_RULES };
  if (type === 'aiExecution') rules = { ...rules, ...AI_EXECUTION_DOMAIN_RULES };
  if (type === 'ui') rules = { ...rules, ...UI_DOMAIN_RULES };
  if (type === 'apps') rules = { ...rules, ...APPS_DOMAIN_RULES };

  // 2. Technology-specific rules
  if (technologies.includes('effect-ts')) {
    rules = { ...rules, ...EFFECT_ZONE_GUARDS, ...EFFECT_TS_RULES };
  }
  if (technologies.includes('react')) rules = { ...rules, ...REACT_RULES };
  if (technologies.includes('next')) rules = { ...rules, ...NEXT_RULES };
  if (technologies.includes('infrastructure')) rules['no-magic-numbers'] = 'off';

  // 3. Apply severity-aware rules based on mode
  const severityAwareRules = applySeverityAwareRules(QUALITY_WITH_SEVERITY, ESLINT_MODE);
  rules = { ...rules, ...severityAwareRules };

  // 4. Apply mode-specific extra rules
  if (ESLINT_MODE === 'dev') {
    rules = { ...rules, ...DEV_EXTRA_RULES };
  } else if (ESLINT_MODE === 'canary') {
    rules = { ...rules, ...CANARY_EXTRA_RULES };
  }

  // 5. Apply TEZ rules with error severity for type exemptions
  rules = applySeverity(rules, TEZ_RULES, 'error');

  return rules;
}

function createZoneConfig(files, rules, additionalSettings = {}) {
  // TEZ Integration: Добавляем специальные правила для Type Exemption Zone
  const tezRules = {
    // Разрешаем mutable типы из TEZ для всех зон
    '@typescript-eslint/prefer-readonly-parameter-types': [
      'error',
      {
        checkParameterProperties: true,
        ignoreInferredTypes: true,
        // Allow типы из TEZ (правильный синтаксис для правила)
        // + Автосинк из package.json (livai.tez.typeExemptions / tez.typeExemptions)
        allow: ALL_TEZ_ALLOW_LIST,
      },
    ],
  };

  return {
    files,
    ignores: [
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/build/**',
      '**/generated/**',
      '**/*.generated.{ts,tsx}'
    ],
    languageOptions: { ...commonLanguageOptions },
    plugins: (() => {
      const { boundaries, ...otherPlugins } = PLUGINS;
      return otherPlugins; // Убираем boundaries плагин - используем no-restricted-imports
    })(),
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      },
      ...additionalSettings
    },
    rules: { ...rules, ...tezRules },
  };
}

function createZoneFactory(zoneName, zoneConfig) {
  const zonePackages = Object.entries(PACKAGE_ZONE_MAPPING)
    .filter(([_, pkgZone]) => pkgZone === zoneName)
    .map(([pkgName]) => pkgName);

  if (!zonePackages || zonePackages.length === 0) return null;

  const zoneRules = createZoneRules({ ...zoneConfig, type: zoneName });
  const patterns = generatePatternsForZone(zonePackages);
  if (patterns.length === 0) {
    // If at least one package directory exists, patterns should not be empty.
    const existing = zonePackages
      .map(p => (p.includes('/**/') ? p.split('/**/')[0] : p))
      .filter(p => safeIsDirectory(path.resolve(process.cwd(), p)));

    if (existing.length > 0) {
      const message = [
        `[zones] Zone '${zoneName}' has existing packages, but generated file patterns are empty.`,
        `This usually means glob filtering/cwd mismatch in monorepo or invalid mapping.`,
        `Existing packages:`,
        ...existing.map(p => `- ${p}`),
      ].join('\n');

      if (SHOULD_FAIL_FAST) throw new Error(message);
      console.warn(message);
    }

    return null;
  }

  return createZoneConfig(patterns, zoneRules, { priority: getZonePriority(zoneName), strictness: zoneConfig.strictness });
}

function generateDynamicZonesSync() {
  const zones = {};
  for (const [zoneName, zoneConfig] of Object.entries(EXPECTED_ZONES)) {
    const zone = createZoneFactory(zoneName, zoneConfig);
    if (zone) zones[zoneName] = zone;
  }
  return zones;
}

const dynamicZones = generateDynamicZonesSync();

// ==================== TEST FILES OVERRIDES ====================
const testFilesOverrides = [
  {
    files: [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/__tests__/**/*.{ts,tsx,js,jsx}',
      '**/test/**/*.{ts,tsx,js,jsx}',
    ],
    languageOptions: { globals: { ...globals.browser, ...globals.node, describe:'readonly', it:'readonly', test:'readonly', expect:'readonly', vi:'readonly', beforeEach:'readonly', afterEach:'readonly', beforeAll:'readonly', afterAll:'readonly' } },
    rules: {
      '@typescript-eslint/no-explicit-any':'off',
      '@typescript-eslint/no-non-null-assertion':'off',
      '@typescript-eslint/no-unused-vars':'off',
      'no-unused-vars':'off',
      'fp/no-throw':'off',
      'no-magic-numbers':'off',
      'max-lines-per-function':'off',
      'import/no-default-export':'off',
      'no-secrets/no-secrets':'off',
      // В тестах допустимы повторяющиеся литералы и type-only void инварианты.
      'sonarjs/no-duplicate-string': 'off',
      'no-void': 'off',
    },
  },
];

// ==================== EXPORT CONFIG ====================
// ==================== MAIN CONFIGURATION ====================
export default [
  // 1. Глобальные настройки TypeScript парсера и архитектурных границ
  {
    files: ['**/*.ts','**/*.tsx'],
    languageOptions: {
      ...commonLanguageOptions,
      parserOptions: {
        ...commonLanguageOptions.parserOptions,
        noWarnOnMultipleProjects: true
      }
    },
    plugins: { '@typescript-eslint': PLUGINS['@typescript-eslint'] },
    settings: {
      // Zone-aware boundaries (используются для архитектурных зон через boundaries/elements)
      boundaries: { elements: globalBoundaries },
    },
  },

  // 2. Критические правила безопасности (применяются ко всем файлам)
  {
    files: [createPattern('')],
    plugins: {
      import: PLUGINS.import,
      security: PLUGINS.security,
      'security-node': PLUGINS['security-node']
    },
    rules: CRITICAL_RULES
  },

  // 3. Архитектурные границы импортов (из architectural-boundaries.mjs)
  ...architecturalBoundariesConfig,

  // 4. Boundaries для public API и private-модулей (eslint-plugin-boundaries)
  ...boundariesExportsConfig,

  // 4.1 Store guardrails (selectors/actions invariants)
  {
    files: [
      'packages/feature-*/src/stores/**/*.{ts,tsx}',
      'packages/feature-*/src/selectors/**/*.{ts,tsx}',
      'packages/app/src/state/**/*.{ts,tsx}',
    ],
    rules: {
      '@livai/store-guards/selectors-no-actions': 'error',
      '@livai/store-guards/no-state-mutation': 'error',
    },
  },

  // 4.2 App store guardrail: запрет useAppStore.getState() вне store.ts
  {
    files: [
      'packages/app/src/**/*.{ts,tsx}',
    ],
    ignores: [
      'packages/app/src/state/store.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.object.name='useAppStore'][callee.property.name='getState']",
          message: 'Запрещено вызывать useAppStore.getState() вне store.ts. Используй публичные helpers из store.ts (например, getAppStoreActions/getAppStoreState) или прокидывай зависимости через ports/effects.',
        },
      ],
    },
  },

  // 4.3 Feature-auth guardrail: invariant engine / transaction — только внутри feature-auth
  // Цель: не допустить копипасты "complex store" механик в другие feature.
  {
    files: [
      'packages/**/*.{ts,tsx}',
    ],
    ignores: [
      'packages/feature-auth/src/**/*.{ts,tsx}',
      'packages/feature-auth/tests/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@livai/feature-auth',
              importNames: [
                'enforceInvariants',
                'InvariantRule',
                'InvariantRuleApply',
              ],
              message: 'Invariant engine feature-auth нельзя импортировать вне feature-auth. Используй только публичные ports/effects/hooks, либо добавь новый публичный фасад в feature-auth.',
            },
          ],
          patterns: [
            {
              group: [
                '**/feature-auth/src/stores/auth.*',
                '**/packages/feature-auth/src/stores/auth.*',
              ],
              message: 'Запрещён deep import в feature-auth store. Импортируй только из public API пакета (@livai/feature-auth) и не выноси invariant engine/transaction наружу.',
            },
          ],
        },
      ],
    },
  },

  // 4.4 Imports hygiene: запрет parent-relative импортов выше модуля (../.. и глубже)
  // Цель: закрепить "package boundary" и не допустить хрупких путей.
  {
    files: [
      'packages/**/src/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../..*'],
              message: 'Запрещены parent-relative импорты выше модуля (../.. и глубже). Используй публичные entrypoints пакета или локальные алиасы/индексы.',
            },
          ],
        },
      ],
    },
  },

  // 4.5 Core state-kit: запрет deep-import'ов (только публичный API)
  // Используем no-restricted-imports (стабильнее, чем import/no-internal-modules в flat-config).
  {
    files: [
      'packages/**/src/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'packages/core/src/state-kit/*',
                'packages/core/src/state-kit/*/*',
                '@livai/core/state-kit/*',
                '@livai/core/state-kit/*/*',
              ],
              message: 'Запрещены deep-imports в state-kit. Используй только публичные entrypoints: `@livai/core` или `@livai/core/state-kit`.',
            },
          ],
        },
      ],
    },
  },

  // 4.6 Core guardrail: zustand не должен попадать в core (app/feature уровень)
  {
    files: [
      'packages/core/src/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'zustand', message: 'core не должен зависеть от zustand. Store живёт на feature/app уровне.' },
            { name: 'zustand/middleware', message: 'core не должен зависеть от zustand. Store живёт на feature/app уровне.' },
          ],
        },
      ],
    },
  },

  // 4.7 Store actions guardrails: запрещены async actions и inline set({ ... })
  {
    files: [
      'packages/feature-*/src/stores/**/*.{ts,tsx}',
      'packages/app/src/state/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        // Запрещаем set({ ... }) — только updater function: set((s) => ({ ...s, ... }))
        {
          selector: "CallExpression[callee.name='set'] > ObjectExpression",
          message: 'Запрещено вызывать set({ ... }). Используй updater-function: set((state) => ({ ...state, ... })).',
        },
        // Запрещаем async в store (actions должны быть sync; async — только в effects)
        {
          selector: 'MethodDefinition[async=true], ArrowFunctionExpression[async=true], FunctionDeclaration[async=true]',
          message: 'Store actions должны быть синхронными. Вынеси async в effects.',
        },
      ],
    },
  },

  // 5. Domain-specific зоны (динамически генерированные)
  ...Object.values(dynamicZones).sort((a,b)=>(b.settings?.priority||0)-(a.settings?.priority||0)),

  // 6. Специфические overrides для конкретных пакетов
  // Observability - browser globals для веб/мобильных клиентов
  {
    files: [
      'packages/observability/src/web/**/*.{ts,tsx,js,jsx}',
      'packages/observability/src/mobile/**/*.{ts,tsx,js,jsx}',
      'packages/observability/src/browser.ts'
    ],
    languageOptions: { globals: { ...globals.browser } },
    rules: { 'no-magic-numbers':'off' }, // Разрешены числовые константы для метрик
  },

  // Data packages - границы контролируются через no-restricted-imports
  {
    files: [createPattern('packages/data/src')],
    rules: {
      // Архитектурные границы обеспечиваются через no-restricted-imports в architectural-boundaries.mjs
    },
  },

  // Apps - границы контролируются через no-restricted-imports
  {
    files: [createPattern('apps')],
    rules: {
      // Архитектурные границы обеспечиваются через no-restricted-imports в architectural-boundaries.mjs
    },
  },

  // Config: vitest/playwright допускают console (тестовая/инфра-обвязка)
  {
    files: [
      'config/vitest/**/*.{ts,tsx,js,jsx,mjs,cjs}',
      'config/playwright/**/*.{ts,tsx,js,jsx,mjs,cjs}',
    ],
    rules: {
      'no-console': 'off',
    },
  },

  // 7. Effect-TS / FP правила именования (применяются к foundation зонам)
  ...effectFpNamingRules,

  // 8. Переопределения для тестовых файлов
  ...testFilesOverrides,
  // 8. Отключаем prefer-readonly-parameter-types для тестов (упрощает helper-функции)
  {
    files: [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/__tests__/**/*.{ts,tsx,js,jsx}',
      '**/test/**/*.{ts,tsx,js,jsx}',
      '**/tests/**/*.{ts,tsx,js,jsx}',
    ],
    rules: {
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
    },
  },

  // 🔥 MUST BE LAST — иначе будет перезаписано более поздними конфигами (flat config)
  // Разрешаем barrel imports из @livai/* в тестах
  {
    files: [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/__tests__/**/*.{ts,tsx,js,jsx}',
      '**/test/**/*.{ts,tsx,js,jsx}',
      '**/tests/**/*.{ts,tsx,js,jsx}',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];

// ==================== ZONE VALIDATION ====================
// Валидация зон выполняется отдельно через validate-zones.mjs
// Для CI/CD: node config/eslint/utils/validate-zones.mjs
// Для ручной проверки: ESLINT_VALIDATE_ZONES=1 node config/eslint/utils/validate-zones.mjs

if (DEBUG_ESLINT_CONFIG) {
  console.log('🔧 ESLint Configuration Summary:');
  console.log(`   Mode: ${ESLINT_MODE}`);
  console.log(`   Zones: ${Object.keys(dynamicZones).length}`);
  console.log(`   Boundaries: ${globalBoundaries.length}`);
  console.log(`   Cache: ${zoneCaches.size > 0 ? 'enabled' : 'disabled'}`);
}
