/**
 * @file ESLint rules for package entry-points and private modules
 * Использует eslint-plugin-boundaries (boundaries/dependencies) для защиты public API и internal-структур пакетов.
 *
 * Уровни защиты:
 * - ui-core public API: только index/primitives/components/types
 * - feature-* internal: любые файлы под src/internal/** считаются приватными и запрещены для внешних элементов
 *
 * ⚠️ ВАЖНО (НЕ “ОПТИМИЗИРОВАТЬ” ОБРАТНО НА src/):
 * Turbopack/Next + pnpm workspaces должны резолвить @livai/ui-core через package.json "exports"
 * и готовый build (dist/**), а НЕ через исходники src/**. Любые path‑alias вида
 * "@livai/ui-core/*": ["../../packages/ui-core/*"] уже приводили к падению билда,
 * когда Turbopack искал несуществующие пути вроде packages/ui-core/primitives/*.
 *
 * Поэтому:
 * - здесь мы ОСОЗНАННО матчим internalPath по dist/**, а не по src/**
 * - любые попытки импортировать src/** или dist/**, не входящие в публичный surface,
 *   будут запрещены через boundaries/dependencies
 * - архитектурные зоны (PACKAGE_ZONE_MAPPING, architectural-boundaries.mjs) остаются
 *   источником правды для межслоевых зависимостей и НЕ должны переписываться под этот модуль
 *
 * Если меняете это правило — сначала перечитайте:
 * - jsboundaries migration guide: https://www.jsboundaries.dev/docs/rules/entry-point/#migration-to-boundariesdependencies
 * - историю падения билда @livai/web из‑за @livai/ui-core/primitives/*
 */

import { PLUGINS } from '../constants.mjs';

/**
 * Определения элементов для eslint-plugin-boundaries.
 * type используется в правилах (target), pattern — файловые паттерны для элемента.
 */
export const BOUNDARIES_ELEMENTS = [
  {
    type: 'ui-core',
    pattern: 'packages/ui-core/**',
  },
  {
    type: 'ui-features',
    pattern: 'packages/ui-features/**',
  },
  {
    type: 'feature',
    pattern: 'packages/feature-*/**',
  },
];

/**
 * Settings для boundaries/elements.
 * Можно реиспользовать при расширении конфигурации.
 */
export const boundariesSettings = {
  'boundaries/elements': BOUNDARIES_ELEMENTS,
};

/**
 * Защита public API ui-core:
 * Разрешены только:
 * - @livai/ui-core/index
 * - @livai/ui-core/primitives/*
 * - @livai/ui-core/components/*
 * - @livai/ui-core/types
 *
 * Любые импорты через src/dist будут считаться нарушением.
 */
export const boundariesDependenciesRules = {
  'boundaries/dependencies': [
    'error',
    {
      default: 'allow',
      rules: [
        // 🔒 UI core: запрещаем импорт любых внутренних путей ui-core,
        // кроме публичных entry points:
        // - dist/index.(js|mjs|cjs|d.ts)
        // - dist/primitives/**
        // - dist/components/**
        // - dist/types/**
        {
          to: {
            type: 'ui-core',
            internalPath: '!{dist/index.*(js|mjs|cjs|d.ts),dist/primitives/**,dist/components/**,dist/types/**}',
          },
          disallow: {
            from: {
              type: '*',
            },
          },
        },

        // 🔒 Feature internal: запрещаем импорт src/internal/** из feature-* пакетов
        // для внешних элементов (ui-core, ui-features, других feature-пакетов, apps).
        {
          to: {
            type: 'feature',
            internalPath: 'src/internal/**',
          },
          disallow: {
            from: {
              type: ['ui-core', 'ui-features', 'feature', 'apps'],
            },
          },
        },
      ],
    },
  ],
};

/**
 * Защита приватных модулей:
 * Конвенция — src/internal/** считается приватной зоной внутри feature-* пакетов.
 * eslint-plugin-boundaries по умолчанию помечает internal-пути как private
 * (дополнительно можно будет уточнить через tags/private при расширении конфигурации).
 */
// legacy no-private больше не используется; поведение реализовано в boundaries/dependencies

/**
 * Полная конфигурация для boundaries, подключаемая в master.config.mjs.
 * Ограничена только на пакеты UI и feature-*; зоны и no-restricted-imports остаются как есть.
 */
export const boundariesExportsConfig = {
  files: [
    'packages/ui-core/**/*.{ts,tsx,js,jsx}',
    'packages/ui-features/**/*.{ts,tsx,js,jsx}',
    'packages/feature-*/src/**/*.{ts,tsx,js,jsx}',
  ],
  plugins: {
    // eslint-plugin-boundaries
    boundaries: PLUGINS.boundaries || {},
  },
  settings: {
    ...boundariesSettings,
  },
  rules: {
    ...boundariesDependenciesRules,
  },
};

export default [boundariesExportsConfig];

