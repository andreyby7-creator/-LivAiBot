read-models/ ├── README.md # 🔹 Обзор Read Models: CQRS read side, границы ответственности,
white/gray zones, источники данных, правила (TypeScript) ├── index.ts # 🔹 Главный экспорт всех
read-models (используется API / GraphQL / BFF слоями) ├── core/ # 🔹 Общие абстракции для
read-models (shared) │ ├── README.md # 🔹 Общие принципы: read-only, no decisions, no domain rules │
├── ReadModel.ts # 🔹 Базовый интерфейс read-model (TypeScript) │ ├── QueryTypes.ts # 🔹 Типы
запросов / фильтров / пагинации (TypeScript) │ ├── ViewTypes.ts # 🔹 Типы представлений (DTO/View
Models) │ └── ReadModelErrors.ts # 🔹 Ошибки read-side (not-found, unavailable) ├── ai-analytics/ #
🎯 AI Analytics Read Model (GRAY ZONE) │ ├── README.md # 🔹 Аналитика AI: usage, latency, costs ⚠️
read-only, derived data, no decisions │ ├── views/ │ │ ├── TokenUsageView.ts # 🔹 View:
использование токенов (aggregated) │ │ ├── ModelLatencyView.ts # 🔹 View: latency AI моделей │ │ └──
CostBreakdownView.ts # 🔹 View: стоимость AI по пользователям / ботам │ ├── queries/ │ │ ├──
GetTokenUsage.ts # 🔹 Query: получить usage токенов │ │ ├── GetAICosts.ts # 🔹 Query: получить
стоимость AI │ │ └── GetLatencyStats.ts # 🔹 Query: latency / percentiles │ ├── repository/ │ │ ├──
AIAggregatesRepo.ts # 🔹 Read repository (SQL / ClickHouse / Redis) │ │ └── index.ts │ └──
index.ts # 🔹 Экспорт AI analytics read-model ├── token-usage/ # 🎯 Token Usage Read Model (WHITE
ZONE) │ ├── README.md # 🔹 Статистика токенов (read-only) используется UI, billing preview,
dashboards │ ├── views/ │ │ ├── UserTokenStatsView.ts # 🔹 View: токены пользователя │ │ ├──
BotTokenStatsView.ts # 🔹 View: токены бота │ │ └── DailyUsageView.ts # 🔹 View: дневная агрегация │
├── queries/ │ │ ├── GetUserTokenStats.ts # 🔹 Query: usage пользователя │ │ ├──
GetBotTokenStats.ts # 🔹 Query: usage бота │ │ └── GetDailyUsage.ts # 🔹 Query: usage по дням │ ├──
repository/ │ │ ├── TokenUsageRepo.ts # 🔹 Read-only repo (денормализованные таблицы) │ │ └──
index.ts │ └── index.ts ├── user-activity/ # 🎯 User Activity Read Model (GRAY ZONE) │ ├──
README.md # 🔹 Активность пользователей ⚠️ derived state, no permissions, no limits │ ├── views/ │ │
├── ActivityTimelineView.ts # 🔹 Timeline активности пользователя │ │ ├── SessionStatsView.ts # 🔹
Сессии, длительность │ │ └── EngagementView.ts # 🔹 Engagement метрики │ ├── queries/ │ │ ├──
GetUserTimeline.ts # 🔹 Query: timeline │ │ ├── GetSessionStats.ts # 🔹 Query: сессии │ │ └──
GetEngagement.ts # 🔹 Query: engagement │ ├── repository/ │ │ ├── UserActivityRepo.ts # 🔹 Read repo
(events → projections) │ │ └── index.ts │ └── index.ts └── test/ # ✅ Тесты read-models ├──
ai-analytics.test.ts # 🔹 Проверка агрегаций и проекций ├── token-usage.test.ts # 🔹 Проверка read
queries └── user-activity.test.ts # 🔹 Проверка timeline / stats
