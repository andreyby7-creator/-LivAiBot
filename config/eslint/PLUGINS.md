# ESLint Plugins Documentation

## Обзор

Этот документ содержит полный список всех ESLint плагинов, используемых в системе LivAi. Здесь перечислены как установленные (обязательные), так и опциональные плагины с подробными описаниями их назначения.

**ESLint 10 будет установлен когда для плагинов будут обновления для совместимости:**

**❌ Еще не готовы:**

- `eslint-plugin-import` (2.32.0): Проверка импортов и зависимостей | ❌ До ESLint 9 | ❌ Нет встроенной замены
- `eslint-plugin-eslint-comments` (3.2.0): Контроль ESLint-директив (`// eslint-disable`) | ❌ `context.getSourceCode()` удален | ❌ Нет встроенной замены
- `eslint-plugin-no-secrets` (2.2.2): Обнаружение секретов в коде (API ключи, токены) | ❌ `context.getSourceCode()` удален | ❌ Нет встроенной замены

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

`eslint-plugin-import` | Импорты и зависимости | ✅

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

### Документация

`eslint-plugin-tsdoc` (0.5.2) | TSDoc комментарии | ✅ | ✅ ESLint 10 ready

## Опциональные плагины (graceful degradation)

Эти плагины используются, но не обязательны. Если они не установлены, система работает без них.

### ESLint мета-правила

`eslint-plugin-eslint-comments` | Контроль отключений ESLint (// eslint-disable) | ✅

### Производительность

`eslint-plugin-react-perf` | Производительность React | ✅

### AI-специфичные (кастомные)

`eslint-plugin-ai-security` | AI безопасность | ✅
`@livai/eslint-plugin-rag` | RAG системы | ✅
`@livai/eslint-plugin-multiagent` | Multi-agent системы | ✅

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
