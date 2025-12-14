├── application-core/ # ✅ APPLICATION LAYER (CQRS + Hexagonal + DDD) (TypeScript + FP + Effect) │
├── README.md # 🔹 Обзор Application Layer: CQRS commands/queries, event handlers, domain
orchestration (TypeScript + FP + Effect) │ ├── index.ts # 🔹 Главный экспорт всех команд, запросов,
event handlers, services, DTO (TypeScript + FP + Effect) │ ├── ports/ # 🔴 КРИТИЧНО: Repository
Ports (CQRS Read/Write Separation) (TypeScript + FP + Effect) │ │ ├── README.md # 🔹 Repository
интерфейсы: write ports для commands + readonly ports для queries (TypeScript + FP + Effect) │ │ ├──
write/ # 🔹 Write Ports (Commands - full aggregates) │ │ │ ├── IBotRepository.ts # 🔹 Port: Bot
aggregates persistence (full CRUD) (TypeScript + FP + Effect) │ │ │ ├── IModelRepository.ts # 🔹
Port: Model aggregates persistence (full CRUD) (TypeScript + FP + Effect) │ │ │ ├──
ISubscriptionRepository.ts # 🔹 Port: Subscription aggregates persistence (full CRUD) (TypeScript +
FP + Effect) │ │ │ ├── IConversationRepository.ts # 🔹 Port: Conversation aggregates persistence
(full CRUD) (TypeScript + FP + Effect) │ │ │ ├── IWebhookRepository.ts # 🔹 Port: Webhook aggregates
persistence (full CRUD) (TypeScript + FP + Effect) │ │ │ ├── IUserRepository.ts # 🔹 Port: User
aggregates persistence (full CRUD) (TypeScript + FP + Effect) │ │ │ └── index.ts # 🔹 Export write
ports (TypeScript + FP) │ │ ├── read/ # 🔹 Read Ports (Queries - readonly aggregates for read
models) │ │ │ ├── IBotReadRepository.ts # 🔹 Port: Bot readonly aggregates for queries (TypeScript +
FP + Effect) │ │ │ ├── IModelReadRepository.ts # 🔹 Port: Model readonly aggregates for queries
(TypeScript + FP + Effect) │ │ │ ├── ISubscriptionReadRepository.ts # 🔹 Port: Subscription readonly
aggregates for queries (TypeScript + FP + Effect) │ │ │ ├── IUserReadRepository.ts # 🔹 Port: User
readonly aggregates for queries (TypeScript + FP + Effect) │ │ │ └── index.ts # 🔹 Export read ports
(TypeScript + FP) │ │ └── index.ts # 🔹 Экспорт всех repository портов (TypeScript + FP + Effect) │
├── commands/ # 🔹 CQRS Commands (Write Operations) (TypeScript + FP + Effect) │ │ ├── README.md #
🔹 Commands: domain state changes, validation, business rules orchestration (TypeScript + FP +
Effect) │ │ ├── user/ # 🔹 User management commands │ │ │ ├── RegisterUserCommand.ts # 🔹
Регистрация нового пользователя (TypeScript + FP + Effect) │ │ │ ├── UpdateUserProfileCommand.ts #
🔹 Обновление профиля пользователя (TypeScript + FP + Effect) │ │ │ ├── DeactivateUserCommand.ts #
🔹 Деактивация пользователя (TypeScript + FP + Effect) │ │ │ └── index.ts # 🔹 Export user commands
(TypeScript + FP) │ │ ├── subscription/ # 🔹 Subscription & lifecycle commands │ │ │ ├──
StartTrialCommand.ts # 🔹 Начало trial периода (TypeScript + FP + Effect) │ │ │ ├──
UpgradePlanCommand.ts # 🔹 Upgrade тарифного плана (TypeScript + FP + Effect) │ │ │ ├──
CancelSubscriptionCommand.ts # 🔹 Отмена подписки (TypeScript + FP + Effect) │ │ │ └── index.ts # 🔹
Export subscription commands (TypeScript + FP) │ │ ├── bots/ # 🔹 AI bots management commands │ │ │
├── CreateBotCommand.ts # 🔹 Создание AI бота (TypeScript + FP + Effect) │ │ │ ├──
ConfigureBotCommand.ts # 🔹 Конфигурация бота (модель, параметры) (TypeScript + FP + Effect) │ │ │
├── DeleteBotCommand.ts # 🔹 Удаление бота (TypeScript + FP + Effect) │ │ │ └── index.ts # 🔹 Export
bot commands (TypeScript + FP) │ │ └── index.ts # 🔹 Экспорт всех команд (TypeScript + FP + Effect)
│ ├── queries/ # 🔹 CQRS Queries (Read Operations via Read Models) (TypeScript + FP + Pure Function)
│ │ ├── README.md # 🔹 Queries: read-only operations via read models, no state changes (TypeScript +
FP + Pure Function) │ │ ├── user/ # 🔹 User read queries │ │ │ ├── GetUserQuery.ts # 🔹 Получить
пользователя по ID (TypeScript + FP + Pure Function) │ │ │ ├── ListUsersQuery.ts # 🔹 Список
пользователей с фильтрацией (TypeScript + FP + Pure Function) │ │ │ └── index.ts # 🔹 Export user
queries (TypeScript + FP) │ │ ├── subscription/ # 🔹 Subscription read queries │ │ │ ├──
GetSubscriptionQuery.ts # 🔹 Получить подписку по ID (TypeScript + FP + Pure Function) │ │ │ ├──
ListUserSubscriptionsQuery.ts # 🔹 Список подписок пользователя (TypeScript + FP + Pure Function) │
│ │ └── index.ts # 🔹 Export subscription queries (TypeScript + FP) │ │ ├── bots/ # 🔹 AI Bot read
queries │ │ │ ├── GetBotQuery.ts # 🔹 Получить бота по ID (TypeScript + FP + Pure Function) │ │ │
├── ListUserBotsQuery.ts # 🔹 Список ботов пользователя (TypeScript + FP + Pure Function) │ │ │ └──
index.ts # 🔹 Export bot queries (TypeScript + FP) │ │ └── index.ts # 🔹 Экспорт всех запросов
(TypeScript + FP + Pure Function) │ ├── event-handlers/ # 🔹 MVP Event Reactions (Hooks for Future
Expansion) (TypeScript + FP + Effect) │ │ ├── README.md # 🔹 Event handlers: реакция на domain
events, side effects, hooks для расширения (TypeScript + FP + Effect) │ │ ├──
UserRegisteredHandler.ts # 🔹 Email welcome, setup default bot, analytics (TypeScript + FP + Effect)
│ │ ├── SubscriptionCancelledHandler.ts # 🔹 Cleanup resources, final billing, notifications
(TypeScript + FP + Effect) │ │ ├── BotCreatedHandler.ts # 🔹 Setup monitoring, initial training,
notifications (TypeScript + FP + Effect) │ │ ├── future/ # 🔹 Placeholder для будущих complex
sagas/process managers (пустая папка) │ │ │ └── README.md # 🔹 Сюда потом добавятся TrialToPaidSaga,
BotTrainingSaga и т.д. │ │ └── index.ts # 🔹 Export всех event handlers + future hooks (TypeScript +
FP) │ ├── services/ # 🔹 Cross-Cutting Concerns (Extensible Architecture) (TypeScript + FP + Effect)
│ │ ├── README.md # 🔹 Application services: infrastructure concerns + extensible orchestration
layer (TypeScript + FP + Effect) │ │ ├── TransactionManager.ts # 🔹 Управление транзакциями,
rollback handling (TypeScript + FP + Effect) │ │ ├── AuditLogger.ts # 🔹 Логи действий для
compliance и аудита (TypeScript + FP + Effect) │ │ ├── NotificationDispatcher.ts # 🔹 Отправка
уведомлений (Email, SMS, Push) (TypeScript + FP + Effect) │ │ ├── FeatureFlagChecker.ts # 🔹
Проверка feature flags для multi-tenant (TypeScript + FP + Effect) │ │ ├── orchestration/ # 🔹
Placeholder для будущих orchestration services (расширяемая архитектура) │ │ │ └── README.md # 🔹
Сюда потом добавятся UserOnboardingService, BillingCycleService, AIModelTrainingService │ │ └──
index.ts # 🔹 Экспорт всех application services (TypeScript + FP + Effect) │ ├── dto/ # 🔹
Типизированные контракты между слоями (Validation + Versioning) (TypeScript + FP) │ │ ├──
README.md # 🔹 DTO strategy: separate contracts with versioning для backward compatibility
(TypeScript + FP) │ │ ├── commands/ # 🔹 Command DTOs (input validation + versioning) │ │ │ ├──
v1/ # 🔹 API Version 1 (current production) │ │ │ │ ├── RegisterUserDTO.ts # 🔹 DTO для регистрации
пользователя v1 (TypeScript + FP + Zod) │ │ │ │ ├── UpgradePlanDTO.ts # 🔹 DTO для upgrade плана v1
(TypeScript + FP + Zod) │ │ │ │ ├── ConfigureBotDTO.ts # 🔹 DTO для конфигурации бота v1
(TypeScript + FP + Zod) │ │ │ │ └── index.ts # 🔹 Export command DTOs v1 (TypeScript + FP) │ │ │ └──
index.ts # 🔹 Export всех command DTOs (with version routing) (TypeScript + FP) │ │ ├── queries/ #
🔹 Query DTOs (filtering, pagination + versioning) │ │ │ ├── v1/ # 🔹 API Version 1 (current
production) │ │ │ │ ├── GetUserDTO.ts # 🔹 DTO для получения пользователя v1 (TypeScript + FP + Zod)
│ │ │ │ ├── GetBotDTO.ts # 🔹 DTO для получения бота v1 (TypeScript + FP + Zod) │ │ │ │ └──
index.ts # 🔹 Export query DTOs v1 (TypeScript + FP) │ │ │ └── index.ts # 🔹 Export всех query DTOs
(with version routing) (TypeScript + FP) │ │ ├── events/ # 🔹 Event DTOs (domain events +
versioning) │ │ │ ├── v1/ # 🔹 Event Version 1 (current domain events) │ │ │ │ ├──
UserRegisteredDTO.ts # 🔹 Event: пользователь зарегистрирован v1 (TypeScript + FP) │ │ │ │ ├──
BotCreatedDTO.ts # 🔹 Event: бот создан v1 (TypeScript + FP) │ │ │ │ └── index.ts # 🔹 Export event
DTOs v1 (TypeScript + FP) │ │ │ └── index.ts # 🔹 Export всех event DTOs (with version routing)
(TypeScript + FP) │ │ ├── responses/ # 🔹 Response DTOs (API contracts + versioning) │ │ │ ├── v1/ #
🔹 API Version 1 (current responses) │ │ │ │ ├── UserResponseDTO.ts # 🔹 Response для user API v1
(TypeScript + FP) │ │ │ │ ├── SubscriptionResponseDTO.ts # 🔹 Response для subscription API v1
(TypeScript + FP) │ │ │ │ ├── BotResponseDTO.ts # 🔹 Response для bot API v1 (TypeScript + FP) │ │ │
│ └── index.ts # 🔹 Export response DTOs v1 (TypeScript + FP) │ │ │ └── index.ts # 🔹 Export всех
response DTOs (with version routing) (TypeScript + FP) │ │ └── index.ts # 🔹 Экспорт всех DTO (with
version management) (TypeScript + FP) │ └── index.ts # 🔹 Экспорт всех модулей application-core
(TypeScript + FP + Effect)
