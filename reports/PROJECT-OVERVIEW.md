# LivAiBot Project Overview

## Project Description

LivAi - AI-powered chatbot platform with multi-tenant architecture

## Key Features

- Multi-tenant architecture
- AI-powered chatbots
- Voice integration
- Authentication system
- Modern UI components

## Tech Stack

- **Frontend**: TypeScript, React/Preact, Effect.ts
- **Backend**: Node.js, Effect.ts, PostgreSQL
- **DevOps**: Docker, Turbo, pnpm workspaces
- **Testing**: Vitest, Playwright, Istanbul coverage
- **Quality**: ESLint, Prettier, TypeScript strict mode

## Architecture

- **Clean Architecture**: слои base → shared → services → features → apps
- **Monorepo structure**: pnpm workspaces + Turbo
- **Modular design**: feature-driven development
- **Effect.ts**: управление эффектами и зависимостями

## Modules / Packages

### Core Foundation

- `@livai/core-contracts` — контракты, доменные модели и типы
- `@livai/ui-core` — базовые UI-компоненты и утилиты

### Business Features

- `@livai/feature-auth` — аутентификация и авторизация
- `@livai/feature-bots` — управление ботами и AI-моделями
- `@livai/feature-chat` — чат-интерфейсы и интеграции
- `@livai/feature-voice` — голосовые интерфейсы и распознавание речи

### Applications

- `@livai/web` — веб-приложение (Next.js)
- `@livai/admin` — панель администратора
- `@livai/mobile` — мобильное приложение
- `@livai/pwa` — прогрессивное веб-приложение

### Development & Testing

- `@livai/e2e` — end-to-end тесты (Playwright)
- `@livai/playwright-config` — конфигурация Playwright
- `@livai/vitest-config` — конфигурация Vitest

## Development Practices

### Code Quality

- **ESLint + Prettier**: автоматическое форматирование и линтинг
- **Husky pre-commit hooks**: проверка кода перед коммитом
- **TypeScript strict mode**: максимальная типизация
- **Import zones**: архитектурные ограничения импортов

### Testing Strategy

- **Unit tests**: Vitest, 100% покрытие критических путей
- **Integration tests**: end-to-end бизнес-сценарии
- **E2E tests**: Playwright, production и demo режимы
- **Benchmarks**: производительность критических функций

### Development Workflow

- **Turbo**: параллельная сборка и кэширование
- **Circular dependency checks**: автоматическая проверка
- **Bundle analysis**: контроль размеров и зависимостей
- **Fan-in/Fan-out metrics**: анализ сложности кода

## Deployment / Infrastructure

### Backend Services

- **Node.js**: runtime environment
- **PostgreSQL**: основная база данных
- **Redis**: кэширование и сессии (опционально)

### Hosting Strategy

- **Multi-tenant**: изоляция данных по workspace/organization
- **Docker**: контейнеризация сервисов
- **Horizontal scaling**: stateless сервисы

### CI/CD Pipeline

- **GitHub Actions**: автоматизация деплоя
- **Quality gates**: тесты, линтинг, bundle size
- **Multi-environment**: dev/staging/prod

## Observability & Security

### Monitoring

- **Centralized logging**: структурированные логи
- **Metrics collection**: производительность и ошибки
- **Health checks**: статус сервисов и зависимостей

### Security Measures

- **JWT authentication**: stateless аутентификация
- **PII detection**: автоматическое обнаружение персональных данных
- **Input validation**: Zod schemas для всех входных данных
- **Rate limiting**: защита от DDoS атак

### Data Protection

- **Encryption**: sensitive data в транзите и at-rest
- **Audit logs**: отслеживание изменений данных
- **Data retention**: политики хранения данных

## Quality Metrics

### Code Coverage

- **Unit tests**: >90% покрытие (текущее: ~88%)
- **Integration tests**: критические бизнес-сценарии (10 тестов)
- **E2E coverage**: основные пользовательские пути (25 тестов)

### Performance Budgets

- **Bundle size**: лимиты для каждого пакета (<3.4MB total)
- **Load time**: <3s first contentful paint
- **API response**: <200ms для основных эндпоинтов
- **Benchmarks**: >29M ops/sec для auth validation

### Architecture Compliance

- **Import rules**: зоны пакетов, запрещенные импорты
- **Circular dependencies**: автоматическая проверка ✅ (0 циклов)
- **Bundle analysis**: tree-shaking эффективность
- **Fan-in/Fan-out**: max depth 73, max fan-in 220 (Effect.ts)
- **Monorepo zones**: 100% coverage (16/16 пакетов)

## Links & Documentation

### External Resources

- [**Vitest**](https://vitest.dev/) - Unit testing framework
- [**Playwright**](https://playwright.dev/) - E2E testing framework
- [**Effect.ts**](https://effect.website/) - Functional programming library
- [**Turbo**](https://turbo.build/) - Build system and caching
- [**pnpm**](https://pnpm.io/) - Package manager

### Project Documentation

- **Commands Reference**: `docs/commands/commands.md`
- **Bundle Reports**: `reports/bundles/` (HTML reports)
- **Test Results**: `test-results/` (JSON reports)
- **Benchmarks**: `reports/bundles-summary.json`

## Architecture Diagrams

### Clean Architecture Layers

```
┌─────────────────────────────────────┐
│           📱 Applications           │  (@livai/web, @livai/admin)
├─────────────────────────────────────┤
│         🎯 Features Layer           │  (@livai/feature-*)
├─────────────────────────────────────┤
│       🔧 Services Layer             │  (Business logic)
├─────────────────────────────────────┤
│       📚 Shared Layer               │  (@livai/ui-shared)
├─────────────────────────────────────┤
│   🏗️ Infrastructure & Core          │  (@livai/core-contracts)
└─────────────────────────────────────┘
```

### Monorepo Package Zones

```
foundation (4) → aiExecution (4) → ui (3) → apps (5)
    ↓              ↓              ↓        ↓
contracts     feature-*     ui-*    web/admin/mobile
observability               shared     pwa
events
```

### Data Flow Architecture

```
User Request → Controller → Service → Repository → Database
                   ↓          ↓          ↓
              Validation  Business   Data Access
                (Zod)    Logic (Effect)  Layer
```

### Bundle Analysis Visualization

Run `pnpm run analyze:bundles` to generate:

- **Size reports**: `reports/bundles/*.size.html`
- **Dependency graphs**: `reports/bundles/*.graph.html`
- **Summary**: `reports/bundles-summary.json`

### Import Graph Analysis

Key metrics from `pnpm run analyze:import-metrics`:

- **Max depth**: 73 levels (Effect.ts - needs refactoring)
- **Max fan-in**: 220 imports (Function.ts - high coupling)
- **Total dependencies**: 3.4MB bundle size
- **Circular deps**: 0 ✅ (perfect architecture)

## Future Roadmap

### Q1 2026 - Core Features

- [ ] Voice recognition integration (Whisper API)
- [ ] Advanced AI model management
- [ ] Real-time collaboration features
- [ ] Multi-language support (i18n)

### Q2 2026 - Performance & Scale

- [ ] Bundle optimization (<2MB target)
- [ ] Database query optimization
- [ ] Redis caching layer implementation
- [ ] Horizontal pod autoscaling

### Q3 2026 - Observability

- [ ] Centralized logging (ELK stack)
- [ ] APM integration (DataDog/New Relic)
- [ ] Error tracking and alerting
- [ ] Performance monitoring dashboards

### Q4 2026 - Enterprise Features

- [ ] SSO integration (SAML/OAuth)
- [ ] Advanced permissions (RBAC)
- [ ] Audit trails and compliance
- [ ] Multi-region deployment

## Getting Started

### Prerequisites

```bash
# Node.js 18+
# pnpm 8+
# Docker & Docker Compose
```

### Quick Start

```bash
# Установка зависимостей
pnpm install

# Запуск в режиме разработки
pnpm run dev

# Запуск тестов
pnpm run test

# Сборка production
pnpm run build
```

### Available Commands

```bash
# Качество кода
pnpm run quality          # Полная проверка качества
pnpm run lint            # Линтинг
pnpm run type-check      # Проверка типов

# Тестирование
pnpm run test            # Unit тесты
pnpm run test:int        # Integration тесты
pnpm run test:e2e        # E2E тесты

# Анализ
pnpm run analyze:bundles  # Размеры бандлов
pnpm run check:circular-deps  # Циклические зависимости

# Документация
pnpm run docs:generate   # Генерация этого файла
```

Generated on: 2026-01-14T22:32:56.903Z
