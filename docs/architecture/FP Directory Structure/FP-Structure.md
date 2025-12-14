── fp/ # ✅ ЕДИНЫЙ FP-слой (shared + pure functions) ├── README.md # 🔹 Обзор FP-слоя: core effects,
AI эффекты, immutable модели, чистые функции, утилиты, тестирование, инфраструктурные эффекты
(TypeScript + FP + Effect) ├── index.ts # 🔹 Главный экспорт всех слоёв FP, объединяет core,
ai-effects, immutable-models, pure-functions, utils, effects-infra, fp-testing (TypeScript + FP) ├──
core/ # 🔹 Базовые эффекты и расширения core-contracts/effect (TypeScript + FP + Effect) │ ├──
README.md # 🔹 Описание core: базовые эффекты, слои, утилиты, pipe/compose/lift (TypeScript + FP +
Effect) │ ├── io/ # 🔹 FP эффекты для микросервисов (TypeScript + FP + Effect) │ │ ├── Effect.ts #
🔹 Реализация базового эффекта (обёртка async + error handling) (TypeScript + FP + Effect) │ │ ├──
TaskEither.ts # 🔹 TaskEither: асинхронный эффект с обработкой ошибок (TypeScript + FP + Effect) │ │
├── Result.ts # 🔹 Result: ADT для success/error, композиционные функции (TypeScript + FP) │ │ ├──
Option.ts # 🔹 Option: безопасная работа с nullable значениями (TypeScript + FP) │ │ └──
SchemaHelpers.ts # 🔹 Помощники для работы со схемами/валидацией (TypeScript + FP + Pure Function) │
├── layers/ # 🔹 Абстракции слоев / Layered Architecture (TypeScript + FP + Effect) │ │ ├──
Layer.ts # 🔹 Базовый слой для всех микросервисов, управление зависимостями (TypeScript + FP +
Effect) │ │ ├── DatabaseLayer.ts # 🔹 Интеграция с БД через эффекты, транзакции, retries
(TypeScript + FP + Effect) │ │ ├── CacheLayer.ts # 🔹 Интеграция с кешем, TTL и Effect (TypeScript +
FP + Effect) │ │ └── TestLayers.ts # 🔹 Mock слои для unit/integration тестов микросервисов
(TypeScript + FP + Effect) │ └── utils/ # 🔹 Утилиты для core-эффектов (TypeScript + FP + Pure
Function) │ ├── pipe.ts # 🔹 FP pipe/composition (TypeScript + FP + Pure Function) │ ├──
compose.ts # 🔹 FP compose (TypeScript + FP + Pure Function) │ └── lift.ts # 🔹 Lift функций в
Effect/TaskEither/Result/Option (TypeScript + FP + Effect) ├── ai-effects/ # 🔹 AI-специфичные
эффекты (LLM, генерация текста) (TypeScript + FP + Effect) │ ├── README.md # 🔹 Обзор AI-эффектов:
LLM запросы, генерация текста (TypeScript + FP + Effect) │ ├── LLMRequest.ts # 🔹 Обёртка для LLM
API запросов с обработкой ошибок и retry (TypeScript + FP + Effect) │ ├── TextGeneration.ts # 🔹
Генерация текста через AI модели, чистые эффекты (TypeScript + FP + Effect) │ └── index.ts # 🔹
Экспорт всех AI эффектов (TypeScript + FP + Effect) ├── immutable-models/ # 🔹 Immutable Value
Objects / Entities (TypeScript + FP + Immutable) │ ├── README.md # 🔹 Описание VO и Entity,
immutability, FP (TypeScript + FP + Immutable) │ ├── SubscriptionVO.ts # 🔹 VO для подписок:
immutable, сравнение, FP (TypeScript + FP + Immutable) │ ├── UserVO.ts # 🔹 VO для пользователя:
immutable, FP (TypeScript + FP + Immutable) │ └── index.ts # 🔹 Экспорт всех immutable моделей
(TypeScript + FP + Immutable) ├── pure-functions/ # 🔹 Чистые функции (FP, без сайд-эффектов)
(TypeScript + FP + Pure Function) │ ├── README.md # 🔹 Обзор чистых функций для микросервисов
(TypeScript + FP + Pure Function) │ ├── math.ts # 🔹 Чистые математические функции: sum, average,
max, min (TypeScript + FP + Pure Function) │ ├── string.ts # 🔹 Чистые функции для работы со
строками: trim, capitalize, split (TypeScript + FP + Pure Function) │ ├── array.ts # 🔹 Чистые
функции для массивов: map, filter, reduce, flatMap (TypeScript + FP + Pure Function) │ └── date.ts #
🔹 Чистые функции для работы с датами: форматирование, сравнение, difference (TypeScript + FP + Pure
Function) ├── utils/ # 🔹 FP-утилиты и хелперы (TypeScript + FP + Pure Function) │ ├── README.md #
🔹 Обзор утилит: curry, memoize, debounce (TypeScript + FP + Pure Function) │ ├── curry.ts # 🔹
Partial application / curry функций (TypeScript + FP + Pure Function) │ ├── memoize.ts # 🔹
Мемоизация функций для оптимизации (TypeScript + FP + Pure Function) │ ├── debounce.ts # 🔹 Debounce
/ throttle чистых функций (TypeScript + FP + Pure Function) │ └── index.ts # 🔹 Экспорт всех утилит
(TypeScript + FP + Pure Function) ├── effects-infra/ # 🔹 Инфраструктурные эффекты для микросервисов
(TypeScript + FP + Effect) │ ├── README.md # 🔹 HTTP, Queue, FileStorage эффекты для интеграций
(TypeScript + FP + Effect) │ ├── HttpClient.ts # 🔹 FP обёртка для HTTP запросов с retry и error
handling (TypeScript + FP + Effect) │ ├── QueueClient.ts # 🔹 FP обёртка для работы с очередями,
поддержка batch и retry (TypeScript + FP + Effect) │ ├── FileStorage.ts # 🔹 FP обёртка для работы с
файловой системой (read/write/exists) (TypeScript + FP + Effect) │ └── index.ts # 🔹 Экспорт всех
инфраструктурных эффектов (TypeScript + FP + Effect) ├── fp-testing/ # 🔹 Helpers для тестирования
FP + Effect (TypeScript + FP + Effect) │ ├── README.md # 🔹 Руководство по тестированию FP-слоя
(TypeScript + FP + Effect) │ ├── mockEffects.ts # 🔹 Моки эффектов (TaskEither, Result, Effect) для
unit тестов (TypeScript + FP + Effect) │ ├── pureFunctionAssertions.ts # 🔹 Утилиты для проверки
чистых функций (assertEqual, assertDeepEqual) (TypeScript + FP + Pure Function) │ └── index.ts # 🔹
Экспорт всех тестовых хелперов (TypeScript + FP + Effect)
