domain-ai/ # 🎯 AI бизнес-домен (TypeScript + FP + Effect)

# 🔴 КРИТИЧНО: Repository interfaces перенесены в application-core/ports/

# Domain НЕ знает о persistence! Только бизнес-логика, инварианты, правила.

├── README.md # 🔹 Обзор домена: Aggregates, VO, Events, Specifications, FP + Effect ├── index.ts #
🔹 Центральный экспорт всех сущностей, сервисов, спецификаций ├── entities/ # 🔹 Aggregates /
Entities (TypeScript + FP + Effect) │ ├── README.md # 🔹 Описание сущностей, паттерны FP/DDD,
иммутабельность, Effect │ ├── index.ts # 🔹 Экспорт всех entity/aggregates │ ├── Bot.ts # 🔹
Aggregate: Bot, бизнес-логика FP + Effect │ ├── Model.ts # 🔹 Aggregate: Model, FP + Effect │ ├──
UserBotSettings.ts # 🔹 VO: настройки бота пользователя, immutable │ ├── BotTrainingJob.ts # 🔹
Aggregate: управление задачей обучения, FP + Effect │ └── BotUsageStats.ts # 🔹 Aggregate/VO:
статистика использования бота, immutable ├── value-objects/ # 🔹 Value Objects (immutable, FP) │ ├──
README.md # 🔹 Описание VO, immutability, сравнение, FP │ ├── index.ts # 🔹 Экспорт всех VO │ ├──
BotId.ts # 🔹 VO: идентификатор бота │ ├── ModelId.ts # 🔹 VO: идентификатор модели │ ├──
TokenAmount.ts # 🔹 VO: количество токенов │ ├── UserId.ts # 🔹 VO: идентификатор пользователя │ └──
TrainingJobId.ts # 🔹 VO: идентификатор задачи обучения ├── services/ # 🔹 Domain Services (Pure /
FP Effects) │ ├── README.md # 🔹 Обзор сервисов: чистые функции, эффектные функции, FP │ ├──
index.ts # 🔹 Экспорт всех domain services │ ├── BotOrchestrationService.ts # 🔹 Оркестрация ботов и
моделей, Effect + FP │ ├── ModelSelectionService.ts # 🔹 Выбор модели для задачи, чистая функция │
├── TokenManagementService.ts # 🔹 Управление токенами, Effect + FP │ ├── BotTrainingService.ts # 🔹
Управление обучением моделей, Effect + FP │ └── BotUsageAnalyticsService.ts # 🔹 Аналитика
использования ботов, Effect + FP ├── events/ # 🔹 Domain Events (immutable, FP) │ ├── README.md # 🔹
События домена, immutable, FP, Event-driven │ ├── index.ts # 🔹 Экспорт всех domain events │ ├──
BotCreatedEvent.ts # 🔹 Event: бот создан │ ├── BotUpdatedEvent.ts # 🔹 Event: бот обновлён │ ├──
ModelTrainedEvent.ts # 🔹 Event: модель обучена │ ├── TrainingJobStartedEvent.ts # 🔹 Event:
обучение начато │ ├── TrainingJobCompletedEvent.ts # 🔹 Event: обучение завершено │ └──
TokenQuotaExceededEvent.ts # 🔹 Event: превышена квота токенов ├── specifications/ # 🔹 Domain
Specifications / Business Rules │ ├── README.md # 🔹 Спецификации/правила бизнеса, FP, комбинируемые
│ ├── index.ts # 🔹 Экспорт всех specifications │ ├── MaxBotsPerUserSpec.ts # 🔹 Правило: макс.
количество ботов на пользователя │ ├── TokenQuotaSpec.ts # 🔹 Правило: квота токенов на пользователя
│ ├── ModelCompatibilitySpec.ts # 🔹 Проверка совместимости бота и модели │ └──
TrainingJobLimitSpec.ts # 🔹 Лимит одновременных обучений ├── factories/ # 🔹 Aggregate/Entity
Factories │ ├── README.md # 🔹 Фабрики агрегатов и сущностей, FP, чистые функции │ ├── index.ts # 🔹
Экспорт всех фабрик │ ├── BotFactory.ts # 🔹 Создание экземпляров Bot │ ├── ModelFactory.ts # 🔹
Создание экземпляров Model │ ├── TrainingJobFactory.ts # 🔹 Создание задач обучения │ └──
UserBotSettingsFactory.ts # 🔹 Создание VO настроек пользователя ├── state-machines/ # 🔹 Управление
статусами агрегатов │ ├── README.md │ ├── index.ts # 🔹 Экспорт всех state machines │ ├──
BotStateMachine.ts # 🔹 Стейт-машина бота (active/inactive) │ ├── ModelStateMachine.ts # 🔹
Стейт-машина модели (trained/pending) │ └── TrainingJobStateMachine.ts # 🔹 Стейт-машина задачи
обучения ├── unit-of-work/ # 🔹 Unit of Work для транзакций с агрегатами │ ├── README.md │ └──
IAiDomainUnitOfWork.ts # 🔹 Интерфейс UoW для AI-домена └── test/ # 🔹 Unit и property-based тесты
(FP + Effect) ├── README.md # 🔹 Руководство по тестированию домена ├── index.ts # 🔹 Экспорт всех
тестов для интеграции ├── entities/ │ ├── README.md │ ├── index.ts # 🔹 Экспорт всех тестов entity │
├── Bot.test.ts │ ├── Model.test.ts │ └── BotTrainingJob.test.ts ├── services/ │ ├── README.md │ ├──
index.ts # 🔹 Экспорт всех тестов service │ ├── BotOrchestrationService.ts │ ├──
ModelSelectionService.ts │ └── BotTrainingService.ts └── specifications/ ├── README.md ├──
index.ts # 🔹 Экспорт всех тестов спецификаций ├── MaxBotsPerUserSpec.ts └── TokenQuotaSpec.ts
