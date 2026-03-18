/**
 * @file config/eslint/plugins/store-guards/index.js
 * ============================================================================
 * 🛡️ ESLINT PLUGIN — STORE GUARDS (LIVAI)
 * ============================================================================
 *
 * Назначение:
 * - Локальный ESLint-плагин guardrails для store/state кода
 * - Фиксирует архитектурные инварианты (чистые selectors, запрет мутаций state)
 *
 * Принципы:
 * - Guardrail > идеальная точность: правила намеренно эвристические и “строгие”
 * - Ошибка = защита от деградации архитектуры (а не “линт ради линта”)
 *
 * Подключение:
 * - Загружается из `config/eslint/constants.mjs` через `tryImport('./plugins/store-guards/index.js')`
 * - Используется как `@livai/store-guards/*` в `config/eslint/master.config.mjs`
 */

import noStateMutation from './rules/no-state-mutation.js';
import selectorsNoActions from './rules/selectors-no-actions.js';

export default {
  rules: {
    'no-state-mutation': noStateMutation,
    'selectors-no-actions': selectorsNoActions,
  },
  meta: {
    name: 'eslint-plugin-store-guards',
    version: '1.0.0',
  },
};
