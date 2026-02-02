# ESLint в LivAi (монорепо)

Коротко: `master.config.mjs` генерирует “что линтим”, `modes/*` определяют “насколько строго”, `rules/*` отвечает за архитектурные запреты, `plugins/*` — AI‑безопасность.

## Принципы

- **Зоны** — источник истины в `utils/check-zones.mjs`: `foundation`, `aiExecution`, `ui`, `apps`, `infrastructure`.
- **Критические правила** (security/архитектура) — всегда жёстко (`CRITICAL_RULES`).
- **Качество** меняет строгость по режиму (`QUALITY_WITH_SEVERITY`: dev/canary/test).
- **TEZ** — минимальный allow‑list для readonly исключений (`shared/tez.config.mjs`) + расширения из `package.json` (в `master.config.mjs`).
- **Canary** должен падать “раньше” (пакеты без зоны, пустые паттерны, сломанные границы).

## Команды

- `pnpm run lint:dev` / `pnpm run lint` — режим разработки.
- `pnpm run lint:canary` — максимальная строгость (CI/перед merge).
- `pnpm run lint:fix` — автофикс (dev режим).
- `node config/eslint/utils/check-zones.mjs` — проверка, что все пакеты размечены зонами.
- `node config/eslint/utils/validate-zones.mjs` — проверка консистентности `EXPECTED_ZONES`/`PACKAGE_ZONE_MAPPING`.

## Как устроено

- `../../eslint.config.mjs` — единая точка входа, выбирает режим по `ESLINT_MODE`.
- `master.config.mjs` — центр истины:
  - генерирует зоны по `EXPECTED_ZONES`/`PACKAGE_ZONE_MAPPING`;
  - применяет технологические правила по зонам;
  - включает `architectural-boundaries.mjs` и `naming-conventions.mjs`;
  - содержит fail-fast проверки для canary (пакеты без зоны / пустые паттерны / некорректные границы);
  - TEZ: объединяет `tez.config.mjs` + расширения из `package.json`.
- `modes/dev.config.mjs` — dev severity (crit=error, остальное чаще warn) + несколько dev-only overrides.
- `modes/canary.config.mjs` — canary severity (всё error) + type-aware слой для TS/TSX.

## Важные файлы

- `constants.mjs` — плагины, базовые/критические/технологические правила, настройки языка.
- `shared/rules.mjs` — `QUALITY_WITH_SEVERITY`, `DEV_EXTRA_RULES`, `COMMON_IGNORES`, утилиты severity.
- `shared/tez.config.mjs` — минимальный TEZ allow‑list.
- `rules/architectural-boundaries.mjs` — запреты импортов между зонами (через `no-restricted-imports`).
- `rules/naming-conventions.mjs` — правила именования.
- `utils/check-zones.mjs` — authoritative маппинг пакетов на зоны + проверка реального дерева монорепо.
- `utils/validate-zones.mjs` — проверка, что конфигурация зон “сходится”.

## Добавление нового пакета

1. Добавить пакет в `PACKAGE_ZONE_MAPPING` в `utils/check-zones.mjs`.
2. При необходимости поправить `EXPECTED_ZONES.expectedPackages`.
3. Прогнать:
   - `node config/eslint/utils/check-zones.mjs`
   - `node config/eslint/utils/validate-zones.mjs`
   - `pnpm run lint:canary`

## TEZ (readonly исключения)

- База: `shared/tez.config.mjs`.
- Локальные расширения: в пакете можно добавить:
  - `package.json -> livai.tez.typeExemptions: [...]` (или `tez.typeExemptions`).
