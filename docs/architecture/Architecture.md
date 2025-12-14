# Структура проекта LivAiBot

## 🏛️ Архитектурные принципы LivAiBot

### 🎯 Core Principles (DDD + CQRS + Effect)

**1. Business Logic Location:**

- **Domain Layer** → ONLY: инварианты, правила, расчеты, события, бизнес-валидации
- **Application Layer** → ONLY: оркестрация доменов, решения "что делать", use cases,
  scenario-валидации
- **Data Layer** → ONLY: тупая persistence, никаких if/правил/решений

**2. Domain vs Application:**

- **Domain Services**: правила для нескольких агрегатов (BotCreationPolicy)
- **Application Services**: оркестрация сценариев (CreateBotUseCase спрашивает domain.canCreate())

**3. Validation Types:**

- **Input validation**: API слой (Zod, формат, обязательные поля)
- **Business validation**: Domain слой (лимиты, разрешения, инварианты)
- **Scenario validation**: Application слой (сущность не найдена, порядок шагов)

**4. Repository Pattern (🔴 КРИТИЧНО):**

- ❌ **НЕТ:** Порты в Domain Layer (интерфейсы) ← РИСК! Домен начинает зависеть от persistence
- ✅ **ДА:** Порты в Application-Core Layer
- Реализации в Infrastructure (Prisma внутри)
- Domain НЕ знает, что его кто-то сохраняет

**5. Application Layer Rules (🛡️ ПРОТИВ "God Layer"):**

- Application НЕ имеет права: вычислять, сравнивать лимиты, проверять разрешения, знать бизнес-числа
- ❌ ЗАПРЕЩЕНО в application: `> < <= >=`, арифметика лимитов, сравнение статусов
- ✅ РАЗРЕШЕНО ТОЛЬКО: `if (!policy.allows(...)) throw`
- Application = оркестрация, НЕ бизнес-логика (правило код-ревью)

**6. Read Models Rules (📌 ПРОТИВ бизнес-логики):**

- Read-models отвечают ТОЛЬКО на "что есть", "сколько", "когда"
- Read-models НЕ имеют права отвечать на "можно ли?"
- ❌ Read-models НЕ имеют права эмитить события (read-side не источник истины)
- Если нужен decision → возвращаемся в domain

**7. White vs Gray Zones (🎯 КЛАССИФИКАЦИЯ READ-MODELS):**

- 🟢 **WHITE ZONE:** Простые read-ответы, UI/dashboards, нет риска интерпретации (GetUserTokenStats,
  GetDailyUsage)
- 🟡 **GRAY ZONE:** Агрегации, derived metrics, аналитика ⚠️ НЕ принимать решений
  (getAverageTokensPerDay ✅, canUserSendMessage ❌)
- ❌ **ЗАПРЕЩЕНО:** проверять лимиты, решать "можно ли", знать тарифы, кидать domain errors,
  вызывать domain services
- ✅ **РАЗРЕШЕНО:** JOIN, AGGREGATE, CACHE, MATERIALIZED VIEWS, EVENT PROJECTIONS
- 🔄 **Связь:** Domain Events → Projections (infra) → Read Models → API/GraphQL/BFF → UI
- 📌 **Read-models НИКОГДА не идут обратно в Domain/Application**

**8. Infrastructure Dependencies (⚠️ ПРОТИВ cross-dependencies):**

- application-core ↓ infrastructure-\* ↓ external world
- ❌ infrastructure-\* НИКОГДА не импортируют друг друга
- Если нужен общий код → выносить в `shared-infra`
- Одна точка входа, низкий cognitive load

**9. Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ Infrastructure НЕ ИМЕЕТ ПРАВА: делать if (plan === PRO), проверять лимиты, решать "можно ли",
  импортировать domain/application, кидать domain errors
- ✅ Infrastructure МОЖЕТ: ретраить, логировать, сериализовать, маппить ошибки, отдавать Effect.fail
- 🔗 СТРОГИЕ зависимости: application-core → infrastructure-core → external world (DB/Redis/APIs)
- ❌ НИКАКИХ обратных импортов

**10. Effect + FP Rules (🎯 ПРОТИВ "нового Spring"):**

- Domain = 0 Effect (чистая бизнес-логика)
- Application = Effect orchestration (комбинирование)
- Infrastructure = Effect wrappers (адаптеры к внешнему миру)
- UI = Effect только в boundary layer (async orchestration, НЕ глубоко)
- ❌ НЕЛЬЗЯ создавать Layer без инфраструктурной причины
- ❌ НЕЛЬЗЯ тащить Effect в domain/utils
- Effect связывает, защищает, ретраит, логирует (НЕ DI-контейнер)

**11. AI Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ infrastructure-ai НЕ ИМЕЕТ ПРАВА: проверять подписку, считать "разрешено ли", знать
  пользователя/tenant, выбирать "лучший" сценарий, решать fallback бизнес-логикой
- ❌ НИКОГДА: if (user.plan === 'PRO') useGPT4()
- ✅ infrastructure-ai МОЖЕТ: принимать modelId, принимать prompt, отдавать raw AI response, считать
  токены, логировать latency, ретраить, стримить
- 🔗 СТРОГИЕ зависимости: application-core → infrastructure-ai → AI vendor APIs (Yandex, OpenAI,
  etc.)
- ❌ Domain и application НЕ импортируются сюда

**12. External API Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ infrastructure-external-api НЕ ИМЕЕТ ПРАВА: проверять подписку, решать "можно ли отвечать",
  вызывать домены напрямую, создавать use-case, триггерить business flow
- ❌ НИКОГДА: if (user.isPremium) sendTelegramMessage()
- ✅ infrastructure-external-api МОЖЕТ: принимать DTO, отдавать DTO, валидировать подпись,
  логировать payload, ретраить HTTP, маппить форматы
- 🔗 СТРОГИЕ зависимости: application-core → infrastructure-external-api → external APIs
  (CRM/Social/Webhooks)
- ❌ НИКАКИХ зависимостей на domain

**13. Tenant Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ infrastructure-tenant НЕ ИМЕЕТ ПРАВА: напрямую вызывать доменные use-cases, принимать
  бизнес-решения "можно ли выполнять операцию для tenant", управлять подписками или лимитами вне
  своего контекста, триггерить бизнес-потоки (provisioning workflow), выполнять операции с данными
  других tenant (cross-tenant)
- ❌ НИКОГДА: if (tenant.hasFeature("X")) performDomainOperation()
- ✅ infrastructure-tenant МОЖЕТ: работать с runtime context tenant, реализовывать адаптеры для
  проверки/ограничения/isolation/quota, хранить и отдавать данные capabilities overrides через
  storage abstractions, orchestration tenant isolation (execution graph/middleware/telemetry),
  health checks для tenant компонентов, unit/integration тесты через mocks
- 🔗 СТРОГИЕ зависимости: application-core → infrastructure-tenant →
  storage/cache/messaging/telemetry
- ❌ Никаких зависимостей на domain или бизнес-логические модули. Не использовать external API
  напрямую без adapter

**14. GraphQL Server Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ infrastructure-graphql-server НЕ ИМЕЕТ ПРАВА: содержать бизнес-логику или принимать решения о
  workflow, напрямую вызывать доменные use-cases (всё через adapters), работать с данными других
  tenant без context isolation
- ✅ infrastructure-graphql-server МОЖЕТ: маппить DTO → GraphQL types и обратно, вызывать adapters к
  tenant, AI и внешним сервисам, валидировать входные данные, логировать и ретраить запросы,
  формировать subscriptions / PubSub события

**15. GraphQL Client Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ infrastructure-graphql-client НЕ ИМЕЕТ ПРАВА: содержать бизнес-логику или решать, что делать с
  данными, вызывать доменные use-cases напрямую, выполнять действия без согласования через adapters
- ✅ infrastructure-graphql-client МОЖЕТ: выполнять типизированные GraphQL запросы/мутации,
  обрабатывать ошибки и retry (Effect-friendly), логировать payload / telemetry, маппить DTO ↔
  GraphQL types, использовать adapters для интеграции с tenant / AI / external services

**16. GraphQL API Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ infrastructure-graphql-api НЕ ИМЕЕТ ПРАВА: содержать бизнес-логику или принимать решения о
  workflow, вызывать доменные use-cases напрямую, триггерить side-effects, кроме
  логирования/observability
- ✅ infrastructure-graphql-api МОЖЕТ: определять типизированные схемы, писать чистые резолверы
  (pure functions, Effect-friendly), логировать и метрики (Observability), маппить DTO ↔ GraphQL
  types, использовать adapters для интеграции с tenant / AI / external services

**17. Data Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ data/ НЕ ИМЕЕТ ПРАВА: писать бизнес-логику или domain rules, напрямую триггерить side-effects
  вне БД (e.g., notifications, external API)
- ✅ data/ МОЖЕТ: определять схемы, миграции, seed, создавать type-safe Prisma клиент, интегрировать
  с Effect/FP подходом (оборачивать доступ к БД в эффекты), использовать DI для тестирования и
  runtime isolation

**18. Tools/Zod-Generator Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ tools/zod-generator НЕ ИМЕЕТ ПРАВА: обращаться к базе данных или внешним API, писать
  бизнес-логику, триггерить side-effects runtime
- ✅ tools/zod-generator МОЖЕТ: читать TypeScript типы, генерировать Zod схемы для валидации,
  использовать в dev/test pipeline, интегрироваться с CI/CD для автогенерации схем

**19. SDK Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ sdk/ НЕ ИМЕЕТ ПРАВА: триггерить бизнес-логику или use-case, работать напрямую с domain model,
  обращаться к базе данных приложения
- ✅ sdk/ МОЖЕТ: собирать события / метрики / логи, работать с DTO / типами (TypeScript-friendly),
  использовать чистые эффекты (FP/Effect), ретраить, комбиновать и валидировать данные

**20. Shared Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ shared/ НЕ ИМЕЕТ ПРАВА: триггерить бизнес-логику или use-case, обращаться к базе данных или
  внешним API, изменять состояние приложения (state mutation)
- ✅ shared/ МОЖЕТ: использовать для чистых функций, FP-friendly эффектов и утилит, валидировать DTO
  и типы, логировать и собирать метрики, создавать общие типы, константы, helpers

**21. Feature-Flags Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ feature-flags/ НЕ ИМЕЕТ ПРАВА: вызывать доменные сервисы или бизнес-логику, решать "можно ли
  выполнять use-case", изменять состояние конкретного пользователя или tenant напрямую, делать
  HTTP-запросы к внешним API
- ✅ feature-flags/ МОЖЕТ: определять фичи и их типы, включать/выключать фичи для tenant/user в
  runtime через engine, сохранять состояние фич в InMemory или DB хранилище, отдавать состояния фич
  через middleware / context, собирать метрики использования фич
- 🔗 СТРОГИЕ зависимости: feature-flags/ ↓ application-core / infrastructure-\*
- ❌ Никаких зависимостей на конкретные домены, use-cases или внешние API

**22. Mobile Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ mobile/ НЕ ИМЕЕТ ПРАВА: вызывать доменные сервисы напрямую, изменять backend state напрямую
  (только через API/SDK), решать, можно ли выполнять use-case
- ✅ mobile/ МОЖЕТ: отображать данные через API/SDK, вызывать backend через GraphQL/REST/SDK,
  управлять UI, state и навигацией, валидация и локальная бизнес-логика, связанная с UI,
  использовать feature-flags для включения/отключения экранов или компонентов
- 🔗 СТРОГИЕ зависимости: mobile/ ↓ sdk/ / feature-flags/ ↓ backend API

**23. UI Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ ui/ НЕ ИМЕЕТ ПРАВА: доступ к application-core или domain напрямую, создавать use-cases или
  бизнес-логику, взаимодействовать с базой данных или API сервисами, мутировать глобальный state вне
  scope компонента
- ✅ ui/ МОЖЕТ: отдавать/принимать props, управлять локальным UI state (hooks), композировать
  компоненты (atoms → molecules → organisms), использовать theme, стили, FP утилиты, unit /
  integration тестировать компоненты

**24. Validation Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ validation/ НЕ ИМЕЕТ ПРАВА: доступ к application-core или domain напрямую, создавать
  бизнес-логику или выполнять side-effects, взаимодействовать с базой данных или внешними API,
  мутировать глобальный state
- ✅ validation/ МОЖЕТ: определять и валидировать DTO, генерировать Zod схемы из TypeScript типов,
  форматировать ошибки для UI / API, использовать чистые функции и FP утилиты, unit / integration
  тестировать схемы

**25. Security Infrastructure Rules (🚫 ЖЕСТКИЕ ЗАПРЕТЫ):**

- ❌ security/ НЕ ИМЕЕТ ПРАВА: прямо изменять бизнес-логику application-core, доступ к внешним API
  кроме сервисов аутентификации/авторизации, выполнять side-effects вне контроля middleware
- ✅ security/ МОЖЕТ: аутентификация и авторизация пользователей, управление токенами и сессиями,
  шифрование и управление ключами, генерация CSP и других security headers, логирование и аудит
  событий безопасности, чистые функции для валидации и санитайзинга input

**26. API Layer Rules (🔌 ТОНКИЙ АДАПТЕР):**

- ❌ api/ НЕ ИМЕЕТ ПРАВА: прямо изменять domains, хардкодить бизнес-логику, side-effects вне
  middleware
- ✅ api/ МОЖЕТ: endpoints/resolvers, валидация input, оркестрация application-core, mapping/DTO

**27. Domain Events Rules (📡 ЧЕТКОЕ РАЗДЕЛЕНИЕ ОТВЕТСТВЕННОСТИ):**

- Domain СОЗДАЕТ события (бизнес-логика, Aggregate.publish())
- Application ПУБЛИКУЕТ события (оркестрация, eventBus.publish())
- Infrastructure ДОСТАВЛЯЕТ события (техническая реализация, RabbitMQ, etc.)
- Domain НЕ знает, что событие куда-то уехало (инкапсуляция)

**28. Apps Rules (📱 ТОНКИЙ UI СЛОЙ):**

- ❌ Apps: admin, web, mobile НЕ ИМЕЮТ ПРАВА: напрямую изменять domains/core/business logic,
  хардкодить API endpoints/платёжные шлюзы/auth rules, side-effects вне разрешённых hooks/services
- ✅ Apps МОГУТ: features/hooks/services/components для UI/UX, orchestration presentation logic
  (формы/страницы/экраны/навигация), валидация input на фронтенде, mapping/DTO для UI ↔ API,
  локальные utils/constants/styles для UI, shared контексты/hooks/types

**29. Apps/Shared Rules (🔗 ОБЩИЕ РЕСУРСЫ):**

- ❌ apps/shared-ui НЕ ИМЕЕТ ПРАВА: реализовывать UI layout/pages/screens (это
  apps/admin/web/mobile), содержать feature-specific side-effects (прямое localStorage кроме safe
  helpers), знать про конкретные apps (admin/web/mobile)
- ✅ apps/shared-ui МОЖЕТ: DTO (API ↔ frontend), mappers (DTO ↔ models), shared hooks/context/utils,
  UI atoms/molecules/organisms для переиспользования, shared types/constants/validators, быть чистым
  FP + Effect слоем без side-effects/оркестрации

---

## ✅ **ИТОГОВЫЙ ЧЕК-ЛИСТ АРХИТЕКТУРЫ LivAiBot**

### **ОСТАВИТЬ КАК ЕСТЬ:**

- ✅ **Domain/Application/Data границы** - четкое разделение ответственности
- ✅ **CQRS** - commands/queries + read models
- ✅ **Effect boundaries** - domain=0, application=orchestration, infra=wrappers
- ✅ **Tech Stack** - современный, проверенный, AI-адаптированный
- ✅ **UI тонкий слой** - только presentation, business logic в domains

### **ДОБАВИТЬ/ЗАФИКСИРОВАТЬ (ГОТОВО):**

- ✅ **Domain events lifecycle** - create/publish/deliver разделение
- ✅ **Запрет логики в read-models** - только "что есть", не эмитят события
- ✅ **Запрет вычислений в application** - только policy checks, оркестрация
- ✅ **Infra-\* не импортируют друг друга** - shared-infra для общего кода
- ✅ **RabbitMQ vs BullMQ** - domain events / AI jobs соответственно

**9. Testing Strategy:**

- Domain: pure unit tests (90%)
- Application: integration с mocked repos
- Data: minimal real DB tests

### 🔧 Technical Stack (Latest Bleeding Edge - SS Proven)

**Core Runtime:**

- **Node.js**: 24.0.0+ (latest stable)
- **pnpm**: 10.0.0+ (latest)
- **TypeScript**: 5.9.0+ (latest)

**Frontend:**

- **Web**: Next.js 16+ + React 19+ + TypeScript + Tailwind CSS 4+
- **Mobile**: React Native 0.82+ + Expo + TypeScript + Metro bundler
- **Admin**: Next.js 16+ + Shadcn/ui + TanStack Query 5+

**Backend:**

- **API**: Fastify 5+ + GraphQL + TypeScript
- **Database**: PostgreSQL + Prisma 7+ ORM
- **Cache**: Redis
- **Queues**: RabbitMQ (domain events) + BullMQ (AI jobs)

**Functional Programming:**

- **Effect**: 3.19.0+ (latest)
- **Zod**: 4.1.0+ (latest)
- **FP-TS**: latest compatible

**Infrastructure:**

- **Containerization**: Docker latest
- **Orchestration**: Kubernetes latest
- **CI/CD**: GitHub Actions latest
- **Monitoring**: Prometheus + Grafana + OpenTelemetry
- **Logging**: Winston + ELK Stack + Sentry

**DevOps & Quality:**

- **Testing**: Vitest 4+ + Playwright + MSW
- **Linting**: ESLint 9+ + Prettier 3+
- **Build**: Turbo 2+ + Tsup 8+
- **Security**: Snyk + Trivy + OWASP

### 🔄 **Tech Stack из SS проекта**

**ПРИМЕНЯЕМ ПОЛНОСТЬЮ В LivAiBot (план реализации):**

- ⏳ **Backend:** Fastify 5+, Prisma 7+, PostgreSQL, Redis (ioredis)
- ⏳ **Frontend:** Next.js 16+, React 19+, TypeScript 5.9+ (Effect только в boundary layer)
- ⏳ **Mobile:** Expo 54+, React Native 0.82+, Metro bundler
- ⏳ **GraphQL:** Mercurius, @apollo/client, GraphQL codegen
- ⏳ **Validation:** Zod 4+, prisma-zod-generator
- ⏳ **Testing:** Vitest 4+, @testing-library/\*, Playwright, MSW
- ⏳ **Build:** Turborepo, tsup 8+, esbuild, SWC
- ⏳ **Linting:** ESLint 9+ с 20+ плагинами, Prettier
- ⏳ **Observability:** Winston + Sentry + PostHog (Grafana/Prometheus при нагрузке)

**ПРИМЕНЯЕМ ЧАСТИЧНО (AI-first адаптация, план реализации):**

- ⏳ **State Management:** Zustand + TanStack Query (для AI chat states)
- ⏳ **Storage:** MinIO для AI-generated контента
- ⏳ **Queues:** BullMQ для AI job processing
- ⏳ **Security:** @fastify/helmet, rate-limit, CORS (критично для AI APIs)
- ⏳ **Analytics:** PostHog для AI usage tracking

**ДОБАВИТЬ ДЛЯ AI (план реализации):**

- ⏳ **AI/ML:** @effect/ai, Yandex Cloud AI Studio, AI-specific monitoring
- ⏳ **Streaming:** WebSocket для real-time AI responses
- ⏳ **Vector DB:** Pinecone/Weaviate для semantic search
- ⏳ **Rate Limiting:** AI-specific (tokens/minute per user)

### 🔄 **Effect Evolution**

**ПРИМЕНЯЕМ В LivAiBot (план реализации):**

- ⏳ **Foundation:** Effect Layer/Context, @effect/schema validation
- ⏳ **Functional Composition:** Effect.gen, validation layer
- ⏳ **UI Integration:** @effect/react + React Query
- ⏳ **Domain Architecture:** Event Bus, domain events
- ⏳ **Resilience:** Circuit breaker, retry для AI APIs
- ⏳ **Quality Gates:** @effect/eslint, contract testing
- ⏳ **AI Integration:** @effect/ai для ML workloads
- ⏳ **Event Store:** Basic для AI аудита

### 🌐 Communication Patterns

**Synchronous:**

- GraphQL API для client ↔ server
- REST для server ↔ external APIs

**Asynchronous:**

- **Domain Events**: RabbitMQ (event-driven communication)
- **AI Jobs**: BullMQ + Redis (background processing)
- Webhooks для external integrations
- Push notifications via Firebase/APNs

### 🚀 Deployment Strategy

**Microservices:**

- Independent deployment каждого сервиса
- Blue-green deployments
- Rollback capability

**Database:**

- Schema migrations via Prisma
- Backward compatibility
- Zero-downtime migrations

### 📊 Monitoring & Observability

**Metrics:**

- AI usage (tokens, requests, latency)
- Business KPIs (conversions, retention)
- System health (CPU, memory, errors)

**Logging:**

- Structured logging with correlation IDs
- Log aggregation via ELK
- Error tracking via Sentry

### 🔒 Security Principles

**Authentication:**

- Supabase Auth (JWT tokens)
- Multi-factor authentication
- Session management

**Authorization:**

- Role-based access control (RBAC)
- API key management for integrations
- Permission-based UI rendering

**Data Protection:**

- End-to-end encryption for sensitive data
- GDPR compliance
- Regular security audits

### 🎛️ Feature Management

**Feature Flags:**

- Runtime feature toggles
- A/B testing capabilities
- Gradual rollouts
- Emergency kill switches

**Configuration:**

- Environment-based configs
- Centralized config management
- Hot-reload capabilities

### 📝 API Documentation

**GraphQL Schema:**

- Self-documenting via GraphQL playground
- Type-safe client generation
- Schema versioning

**OpenAPI Specs:**

- REST API documentation
- Client SDK generation
- Contract testing

### 🔌 **Port Management (из SS проекта)**

**ПРИМЕНЯЕМ УПРОЩЕННО В LivAiBot:**

**Диапазоны портов (адаптировано для AI-first):**

- ⏳ **Dev:** 3000–3999 — основная разработка
- ⏳ **Dev-tools:** 4000–4999 — инструменты разработчика
- ⏳ **External:** 5000–5999 — эмуляторы внешних сервисов
- ⏳ **Prod:** 6000–6999 — продакшн
- ⏳ **Testing:** 8000–8999 — авто-тесты

**Базовые порты LivAiBot:**

- ⏳ **web:** 3000 (dev), 6000 (prod) — Next.js Web App
- ⏳ **api:** 3001 (dev), 6001 (prod) — Fastify API Server
- ⏳ **mobile:** 3003 (dev) — Expo/React Native
- ⏳ **docs:** 3002 (dev) — Docusaurus документация
- ⏳ **postgres:** 5432 — PostgreSQL
- ⏳ **redis:** 3043 (dev), 8379 (testing) — Redis Cache

**НЕ ПРИМЕНЯЕМ (слишком enterprise для LivAiBot):**

- ❌ Полный стек мониторинга (Grafana, Prometheus, Jaeger)
- ❌ Все dev-tools (MinIO, Portainer, Kibana, etc.)
- ❌ Сложная генерация конфигов и CLI автоматизация
- ❌ Multi-environment port registry с TypeScript satisfies

**Простая реализация для LivAiBot:**

- ⏳ Базовый `.env` файл с портами
- ⏳ Docker Compose для локальной разработки
- ⏳ Ручное управление без сложной автоматизации

### ⚠️ Error Handling

**Application Errors:**

- Domain errors (business rules violations)
- Application errors (orchestration failures)
- Infrastructure errors (DB, network issues)

**User Communication:**

- Localized error messages
- Graceful degradation
- Retry mechanisms with exponential backoff

---

## 📁 Структура проекта

```
/home/boss/Projects/livai/
├── apps/
│   ├── shared/                     # 🔹 Общие ресурсы фронтенда (DTO, мапперы, UI, hooks)
│   │   ├── dto/                    # 🔹 Общие API DTO (frontend ↔ API)
│   │   ├── mappers/                # 🔹 Общие мапперы API DTO ↔ frontend models
│   │   ├── ui/                     # 🔹 Общие UI компоненты (atoms/molecules/organisms/charts)
│   │   ├── hooks/                  # 🔹 Общие React hooks + FormProvider
│   │   └── context/                # 🔹 Общие context провайдеры
│   ├── admin-panel/            # 🔹 Admin UI слой (Next.js 16+ App Router)
│   │   └── src/
│   │       ├── app/                # 🔹 Next.js 16+ App Router
│   │       ├── components/         # 🔹 Локальные UI компоненты (admin-specific)
│   │       ├── features/           # 🔹 Feature-based бизнес-модули
│   │       ├── dto/                # 🔹 Re-exports из apps/shared-ui/dto
│   │       ├── hooks/              # 🔹 Re-exports + admin-specific hooks
│   │       └── utils/              # 🔹 Локальные утилиты админки
│   ├── web/                        # 🔹 Web UI слой (Next.js 16+ App Router + PWA)
│   │   ├── app.json                # 🔹 Expo PWA config
│   │   └── src/
│   │       ├── app/                # 🔹 Next.js 16+ App Router (public/protected routes)
│   │       ├── screens/            # 🔹 Web screens (landing, auth, dashboard)
│   │       ├── components/         # 🔹 Web-specific UI components
│   │       ├── features/           # 🔹 Feature modules (auth, chat, billing, etc.)
│   │       ├── services/           # 🔹 Web services (PWA, analytics)
│   │       └── lib/                # 🔹 Web libraries (WebSocket, PWA)
│   └── mobile/                     # 🔹 Mobile UI слой (React Native + Expo)
│       ├── app.json                # 🔹 Expo config (permissions, icons)
│       ├── metro.config.js         # 🔹 Metro bundler config
│       ├── index.js                # 🔹 Expo entry point
│       ├── App.tsx                 # 🔹 Root component
│       └── src/
│           ├── navigation/         # 🔹 React Navigation (stacks, tabs, modals)
│           ├── screens/            # 🔹 Mobile screens (auth, chat, profile)
│           ├── components/         # 🔹 Mobile components (native, chat, forms)
│           ├── features/           # 🔹 Feature modules (chat, notifications, camera)
│           ├── services/           # 🔹 Native services (biometric, camera, storage)
│           └── utils/              # 🔹 Mobile utils (platform, permissions, haptics)
├── api/                            # Backend API (ТОНКИЙ слой, Hexagonal Ports + Fastify)
│   └── src/
│       ├── controllers/            # 🔹 ТОНКИЕ HTTP контроллеры (Hexagonal: Ports для внешнего мира)
│       ├── routes/                 # 🔹 HTTP маршрутизация (Fastify)
│       ├── graphql/                # 🔹 GraphQL слой (тонкий адаптер, Mercurius)
│       ├── dto/                    # 🔹 API DTO (внешний контракт)
│       ├── mappers/                # 🔹 API ↔ Application мапперы
│       └── middleware/             # 🔹 HTTP/GraphQL middleware (auth, tenant, validation)
├── core-contracts/                 # FP-Core контракты (Effect-TS основа)
├── packages/
│   ├── fp/                         # ✅ ЕДИНЫЙ FP-слой (shared + pure functions)
│   │   ├── core/                   # Расширение core-contracts/effect
│   │   ├── ai-effects/             # AI-специфичные эффекты
│   │   ├── immutable-models/       # Иммутабельные модели данных
│   │   ├── pure-functions/         # Чистые функции
│   │   └── utils/                  # FP утилиты (без дублирования)
│   ├── domains/                    # ✅ ЧИСТЫЕ DDD домены (только бизнес-логика)
│   │   ├── domains-ai/             # 🎯 AI бизнес-домен (чистая логика)
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   ├── services/
│   │   │   ├── events/
│   │   │   └── test/               # ✅ Unit тесты домена
│   │   ├── domains-subscriptions/  # 🎯 Бизнес-домен подписок
│   │   │   └── test/
│   │   ├── domains-billing/        # 🎯 Бизнес-домен биллинга
│   │   │   └── test/
│   │   ├── domains-integrations/   # 🎯 Бизнес-домен интеграций (CRM, соцсети)
│   │   │   └── test/
│   │   ├── domains-conversations/  # 🎯 Бизнес-домен диалогов
│   │   │   └── test/
│   │   └── domains-webhooks/       # 🎯 Бизнес-домен вебхуков
│   │       └── test/
│   ├── application-core/           # ✅ APPLICATION LAYER (CQRS + Hexagonal + DDD)
│   │   ├── ports/                  # 🔴 КРИТИЧНО: Repository Ports (CQRS Read/Write)
│   │   ├── commands/               # 🔹 CQRS Commands (Write Operations)
│   │   ├── queries/                # 🔹 CQRS Queries (Read Operations)
│   │   ├── event-handlers/         # 🔹 Domain Event Handlers
│   │   ├── services/               # 🔹 Application services (оркестрация доменов)
│   │   ├── dto/                    # 🔹 DTO contracts (commands/queries/events/responses)
│   │   └── test/                   # ✅ Integration тесты application layer
│   ├── read-models/                # ✅ CQRS Read Models (быстрое чтение)
│   │   ├── ai-analytics/           # Аналитика AI (read-only)
│   │   ├── token-usage/            # Статистика токенов (read-only)
│   │   └── user-activity/          # Активность пользователей (read-only)
│   ├── infrastructure-core/        # ✅ ОБЪЕДИНЕННАЯ инфраструктура
│   │   ├── cache/                  # Кэширование
│   │   ├── database/               # База данных
│   │   ├── messaging/              # Очереди
│   │   └── adapters/               # ✅ Адаптеры к внешним сервисам
│   ├── infrastructure-ai/          # 🎯 AI инфраструктура (отдельный модуль)
│   │   ├── ai-models/              # Конфиги AI-моделей (инфраструктура!)
│   │   ├── yandex-cloud/           # Yandex Cloud адаптер
│   │   └── adapters/               # AI-специфичные адаптеры
│   ├── infrastructure-external-api/ # 🎯 Внешние API адаптеры (отдельный модуль)
│   │   ├── crm-adapters/           # CRM интеграции (Bitrix24, AmoCRM)
│   │   ├── social-adapters/        # Соцсети, мессенджеры
│   │   └── webhook-adapters/       # Обработка вебхуков
│   ├── infrastructure-tenant/      # ✅ Мульти-тенантность (TypeScript + Effect)
│   │   └── adapters/               # Адаптеры для изоляции данных
│   ├── infrastructure-graphql-server/ # ✅ GraphQL сервер (TypeScript + GraphQL)
│   ├── infrastructure-graphql-client/ # ✅ GraphQL клиент (TypeScript + GraphQL)
│   ├── infrastructure-graphql-api/    # ✅ GraphQL API утилиты (TypeScript + GraphQL)
│   ├── data/                       # ✅ Prisma ORM + База данных (TypeScript + PostgreSQL)
│   │   ├── prisma/                 # Prisma схема и миграции
│   │   ├── client/                 # Type-safe Prisma клиент
│   │   ├── migrations/             # Миграции базы данных
│   │   └── seed/                   # Начальные данные
│   ├── tools/                      # ✅ Инструменты разработки
│   │   └── zod-generator/          # Генератор Zod схем из TypeScript типов
│   ├── sdk/                        # ✅ ЕДИНЫЙ SDK (без дублирования)
│   │   ├── analytics/              # Аналитика SDK
│   │   ├── observability/          # Observability SDK
│   │   ├── resilience/             # Resilience SDK
│   │   └── rum/                    # RUM SDK
│   ├── shared/                     # ✅ Общие утилиты (TypeScript + FP)
│   ├── feature-flags/              # ✅ Управление фичами (TypeScript + Effect)
│   ├── mobile/                     # ✅ Мобильный опыт (React Native + TypeScript)
│   ├── ui/                         # UI компоненты (shared)
│   ├── validation/                 # Схемы валидации (Zod) + Zod Generator
│   └── security/                   # Безопасность
├── config/                         # Конфигурации
│   ├── eslint/                     # /home/boss/Projects/livai/configs/eslint
│   ├── prettier/                   # /home/boss/Projects/livai/configs/prettier
│   ├── husky/                      # /home/boss/Projects/livai/configs/husky
│   ├── tsconfig/                   # /home/boss/Projects/livai/configs/tsconfig
│   ├── vitest/                     # /home/boss/Projects/livai/configs/vitest
│   ├── env/                        # Переменные окружения / env loader
│   ├── logging/                    # Конфиги логирования (winston/pino)
│   ├── database/                   # Конфиги подключения к БД
│   ├── api/                        # Конфиги API (GraphQL / REST)
│   ├── infrastructure/             # Конфиги кэшей, очередей, observability
│   └── security/                   # JWT, шифрование, CSP, OAuth
├── infrastructure/                 # Инфраструктурные компоненты
│   ├── docker/                     # Dockerfiles и compose
│   ├── k8s/                        # Kubernetes манифесты
│   ├── terraform/                  # IaC (Infrastructure as Code)
│   ├── scripts/                    # Скрипты для сборки/деплоя/миграций
│   ├── certs/                      # TLS / SSL сертификаты
│   ├── secrets/                    # Управление секретами
│   ├── monitoring/                 # Конфиги мониторинга / alerting
│   └── logging/                    # Конфиги логирования / ELK / Loki
├── scripts/                        # Скрипты
└── test-results/                   # Результаты тестов
```
