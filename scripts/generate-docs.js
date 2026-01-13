#!/usr/bin/env node
// Для Node.js <18 используйте: node --experimental-specifier-resolution=node scripts/generate-docs.js

/**
 * Генератор документации проекта LivAi
 * Создает сводную документацию из всех источников
 *
 * @typedef {string} MarkdownContent - Содержимое markdown файла
 * @typedef {unknown} ErrorType - Тип ошибки
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Проверяем структуру проекта
const projectRoot = path.resolve(__dirname, '..');
const docsDir = path.join(projectRoot, 'docs');
const aiBotsDir = path.join(docsDir, 'ai-bots-platform');

if (!fs.existsSync(docsDir)) {
  console.error(`❌ Директория docs не найдена: ${docsDir}`);
  process.exit(1);
}

if (!fs.existsSync(aiBotsDir)) {
  console.error(`❌ Директория ai-bots-platform не найдена: ${aiBotsDir}`);
  process.exit(1);
}

const outputFile = path.join(docsDir, 'PROJECT-OVERVIEW.md');

/**
 * Генерирует содержимое обзора проекта
 * @returns {MarkdownContent} Содержимое markdown файла с полной документацией проекта
 */
function generateOverview() {
  // Более читаемый формат даты для ручного чтения
  const now = new Date();
  const formattedDate = new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  }).format(now);

  const overview = `# LivAi Platform - Обзор проекта

## 📋 Краткое описание
LivAi - AI-powered платформа для создания и управления чат-ботами с мульти-тенантной архитектурой.

## 🏗️ Архитектура проекта

### Backend (Python/FastAPI)
- **api-gateway** - единый вход, прокси, middleware
- **auth-service** - аутентификация, JWT, workspace
- **bots-service** - CRUD ботов, инструкции, версии
- **conversations-service** - треды, сообщения, turn (stub)

### Frontend (TypeScript/React)
- **core-contracts** - типы, DTO, валидация
- **ui-core** - базовые компоненты
- **ui-shared** - утилиты, сервисы
- **ui-features** - составные экраны
- **feature-** - бизнес-логика
- **app** - композиция, routing

### Infrastructure
- **PostgreSQL** - основная БД
- **Redis** - кэш, очереди
- **ClickHouse** - аналитика
- **MinIO** - файлы
- **Qdrant** - векторные данные

## 📚 Документация

### Основные документы
- [Обзор платформы](./ai-bots-platform/LivAi-Overview.md)
- [Roadmap](./ai-bots-platform/LivAi-Roadmap.md)
- [Архитектура](./ai-bots-platform/LivAi-Structure.md)
- [Tech Stack](./ai-bots-platform/LivAi-Tech-Stack.md)
- [Bot Specs](./ai-bots-platform/LivAiBot-Specs.md)

### Планы реализации
- [Фаза 0-1 Backend](./phase0-1-backend.md)
- [Фаза 2 UI](./phase2-UI.md)
- [Zod Generator](./zod-generator-implementation.md)

## 🚀 Быстрый старт

### Запуск инфраструктуры
\`\`\`bash
# Полный запуск
pnpm run dev:full

# Только инфраструктура
bash scripts/dev_up.sh

# Статус проекта
pnpm run project:status
\`\`\`

### Backend разработка
\`\`\`bash
# Проверка качества
make quality

# Миграции
make db:migrate

# Тесты
make test
\`\`\`

### Frontend разработка
\`\`\`bash
# Качество кода
pnpm run quality:local

# Тесты
pnpm run test:unit

# Запуск dev сервера
pnpm run dev
\`\`\`

## 📊 Метрики проекта

### Backend
- **Сервисы:** 4 (api-gateway, auth, bots, conversations)
- **Тестовое покрытие:** 85%+ statements, 80%+ branches
- **Типизация:** 100% (mypy strict)

### Frontend
- **Пакеты:** 9 (core-contracts, ui-*, feature-*, app)
- **Тестовое покрытие:** 85%+ statements, 80%+ branches
- **Type coverage:** 95%+

### Infrastructure
- **Сервисы:** 6 (Postgres, Redis, ClickHouse, MinIO, Qdrant, api-gateway)
- **Health checks:** автоматические проверки всех компонентов

## 🔧 Качество кода

### Автоматизация
- **Pre-commit hooks** - линтинг, типы, тесты
- **CI/CD** - полная проверка качества
- **Dependabot** - автоматическое обновление зависимостей

### Инструменты
- **ESLint + Prettier** - линтинг и форматирование
- **TypeScript strict** - строгая типизация
- **Vitest + Playwright** - unit + E2E тесты
- **Snyk** - проверка безопасности

## 📈 Roadmap развития

### ✅ Фаза 0-1 (Завершена)
- Инфраструктура и базовые сервисы
- API контракты и DTO
- Базовая аутентификация

### 🚧 Фаза 2 (UI)
- Zod генератор для валидации
- React компоненты и формы
- Интеграция с backend API

### 📋 Фаза 3-7 (Планируется)
- RAG и AI интеграции
- CRM/маркетплейсы интеграции
- Enterprise функции

---

*Сгенерировано автоматически: ${formattedDate} (${now.toISOString()})*
`;

  return overview;
}

/**
 * Основная функция
 * @returns {void}
 */
function main() {
  try {
    const overview = generateOverview();
    // Явная UTF-8 кодировка без BOM для совместимости с Windows
    fs.writeFileSync(outputFile, overview, { encoding: 'utf8', flag: 'w' });
    console.log(`✅ Документация сгенерирована: ${outputFile}`);
  } catch (/** @type {ErrorType} */ error) {
    console.error('❌ Ошибка генерации документации:', error);
    process.exit(1);
  }
}

main();
