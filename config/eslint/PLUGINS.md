# ESLint Plugins Documentation

## Обзор

Этот документ содержит полный список всех ESLint плагинов, используемых в системе LivAi. Здесь перечислены как установленные (обязательные), так и опциональные плагины с подробными описаниями их назначения.

**ESLint 10:** переход возможен, когда сняты блокеры ниже (или заменены эквивалентами).

**`eslint-plugin-import` (2.32.0) — блокер для ESLint 10**

- В npm `peerDependencies`: `eslint` только до **^9** (^10 не входит). Мейнтейнеры [import-js/eslint-plugin-import](https://github.com/import-js/eslint-plugin-import) на момент проверки прямо указывают, что **совместимости с ESLint 10 ещё нет**; релиз 2.32.0 ориентирован на линейку до v9, отдельного релиза под v10 пока нет.
- **Возможная замена по экосистеме:** `eslint-plugin-import-x` (например 4.x) — в npm в `peerDependencies` объявлены **`eslint ^8.57.0 || ^9 || ^10`**. Это отдельный пакет (не drop-in по имени), миграция правил и резолверов требует отдельной оценки.

**`eslint-plugin-no-secrets` (2.3.3) — не формальный блокер по peer, но слабый сигнал под v10**

- `peerDependencies`: `eslint >=5` — диапазон слишком широкий, **не подтверждает** целевую поддержку ESLint 10.
- Релизы ещё выходят (например 2.3.3), но публичного roadmap именно под ESLint 10 нет; перед апгрейдом ESLint — **обязательный прогон** линта или **дублирование** поиска секретов в CI (например gitleaks), т.к. ESLint core этого не делает.

✅ УСТАНОВЛЕН
❌ НЕ УСТАНОВЛЕН

## Обязательные плагины

### Ядро TypeScript

`@typescript-eslint/eslint-plugin` | Типизация И правила TypeScript | ✅
`@typescript-eslint/parser` | Парсер TypeScript | ✅

### React экосистема

| `eslint-plugin-react` | React компоненты и JSX | ✅
| `eslint-plugin-react-hooks` | React Hooks | ✅
| `eslint-plugin-jsx-a11y` | Accessibility для JSX | ✅

### Импорты и модули

`eslint-plugin-import` | Проверка импортов, циклов, default-экспортов и модульной структуры | ✅
`eslint-plugin-simple-import-sort` | Детерминированная сортировка импортов/экспортов (node → external → internal → local) | ✅

### Качество кода

`eslint-plugin-promise` | Работа с Promise (Асинхронность)| ✅
`eslint-plugin-sonarjs` | Качество кода (cognitive complexity, bugs) | ✅

### Безопасность

`eslint-plugin-security` | Веб-безопасность | ✅
`eslint-plugin-security-node` | Безопасность Node.js | ✅
`eslint-plugin-no-secrets` | Поиск секретов | ✅

### Функциональное программирование

`eslint-plugin-fp` | Функциональное программирование | ✅
`eslint-plugin-functional` | Immutable/functional код | ✅
`@effect/eslint-plugin` | Effect-TS (execution model) | ✅

### Фреймворки и инструменты

`@next/eslint-plugin-next` | Next.js правила | ✅
`eslint-plugin-testing-library` | Testing Library | ✅

### Архитектура

`eslint-plugin-boundaries` | Архитектурные границы | ✅

**Зависимость в npm без подключения в ESLint:** в корневом `package.json` есть `eslint-plugin-prefer-arrow`, но плагин **не импортируется** в `config/eslint/constants.mjs` и правила из него **не используются** — в список активных плагинов выше не входит.

> **Связка package exports + boundaries + zone firewall:**
>
> - **package.json `"exports"`** в пакетах (`@livai/ui-core`, `feature-*`) задают единственный легальный public API (dist/**).
> - **`boundaries/dependencies`** физически запрещает обход этого API:
>   - нельзя импортировать `@livai/*/src/*` или произвольные файлы из `dist/**`,
>   - `feature-*/src/internal/**` считается приватным и недоступен снаружи.
> - **Zone firewall (`architectural-boundaries.mjs` + `no-restricted-imports`)** контролирует, какие зоны (`foundation`, `aiExecution`, `ui`, `apps`, `infrastructure`) вообще могут зависеть друг от друга.\
>   В итоге: package exports определяют public surface, boundaries закрепляет его на уровне файлов, а zone firewall защищает межслоевые зависимости.

### Документация

`eslint-plugin-tsdoc` (0.5.2) | TSDoc комментарии | ✅ ESLint 10 ready (peer)

## Опциональные плагины (graceful degradation)

Эти плагины используются, но не обязательны. Если они не установлены, система работает без них.

### ESLint мета-правила

`@eslint-community/eslint-plugin-eslint-comments` | Контроль отключений ESLint (`// eslint-disable`) | ✅

### Производительность

`eslint-plugin-react-perf` | Производительность React | ✅

### AI-специфичные (кастомные, `config/eslint/plugins/*`)

Локальные пакеты; в `constants.mjs` зарегистрированы под префиксами правил **`@livai/...`** (см. `master.config.mjs`).

| Пакет (`package.json` `name`)             | Назначение                                           | В конфиге как         |
| ----------------------------------------- | ---------------------------------------------------- | --------------------- |
| `eslint-plugin-ai-security`               | AI security (PII, токены, prompt injection и др.)    | `ai-security`         |
| `eslint-plugin-rag`                       | RAG guardrails                                       | `@livai/rag`          |
| `eslint-plugin-multiagent`                | Multi-agent изоляция / оркестрация                   | `@livai/multiagent`   |
| `@livai/eslint-plugin-store-guards-local` | Store: селекторы без side-effects, мутации состояния | `@livai/store-guards` |

## Установка новых плагинов

### Для обязательных плагинов:

```bash
pnpm add -D -w <plugin-name>
```

### Для опциональных плагинов:

```bash
pnpm add -D -w <plugin-name>  # или оставить без установки для graceful degradation
```

## Проверка установки

```bash
# Проверить все установленные плагины
npm ls | grep eslint-plugin

# Или проверить конкретный плагин
npm ls <plugin-name>
```

## Обновление документации

При добавлении нового плагина:

1. Установите плагин командой выше
2. Добавьте запись в соответствующий раздел этой документации
3. Обновите `constants.mjs` если необходимо
4. Протестируйте конфигурацию

## Архитектурные принципы

- **Обязательные плагины** обеспечивают baseline качество и безопасность
- **Опциональные плагины** добавляют specialized правила без breaking changes
- **Graceful degradation** позволяет системе работать в любых условиях
- **Документация** поддерживается в актуальном состоянии

---

_Последнее обновление: 26 февраля 2026_
_Ответственный: ESLint Team_
