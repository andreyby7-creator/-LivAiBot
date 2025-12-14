shared/ ├── README.md # 🔹 Обзор shared utilities: FP, Effect-friendly, чистые функции ├──
constants/ # 🔹 Глобальные константы │ ├── AppConstants.ts # 🔹 Глобальные константы приложения
(timeouts, лимиты, default) | TypeScript + FP │ ├── ErrorCodes.ts # 🔹 Унифицированные коды ошибок |
TypeScript + FP │ └── index.ts # 🔹 Экспорт всех констант | TypeScript ├── utils/ # 🔹 FP-friendly
утилиты для массивов, строк, функций, дат │ ├── README.md # 🔹 Обзор утилит: pipe, compose, lift,
чистые функции | TypeScript + FP + Effect │ ├── pipe.ts # 🔹 FP-композиция функций слева направо |
TypeScript + FP │ ├── compose.ts # 🔹 FP-композиция функций справа налево | TypeScript + FP │ ├──
lift.ts # 🔹 Поднятие обычных функций в эффекты (TaskEither, Result) | TypeScript + FP + Effect │
├── date.ts # 🔹 Чистые функции работы с датами | TypeScript + FP │ ├── array.ts # 🔹 FP-friendly
операции с массивами | TypeScript + FP │ ├── string.ts # 🔹 FP-friendly функции для работы со
строками | TypeScript + FP │ └── index.ts # 🔹 Экспорт всех утилит | TypeScript ├── validation/ # 🔹
Схемы и валидаторы DTO и domain-safe структур │ ├── README.md # 🔹 Обзор validation: Zod +
FP-friendly | TypeScript + FP + Zod │ ├── schemaHelpers.ts # 🔹 Общие хелперы для работы со схемами
| TypeScript + FP + Zod │ ├── emailValidator.ts # 🔹 Валидация email через чистые функции |
TypeScript + FP + Zod │ ├── phoneValidator.ts # 🔹 Валидация телефонных номеров | TypeScript + FP +
Zod │ └── index.ts # 🔹 Экспорт всех валидаторов | TypeScript ├── logging/ # 🔹 FP-friendly
логирование и telemetry │ ├── README.md # 🔹 Обзор логирования и подход к unified logging |
TypeScript + FP + Effect │ ├── Logger.ts # 🔹 Основной FP-friendly логгер | TypeScript + FP + Effect
│ ├── LogLevels.ts # 🔹 Определение уровней логирования (info, warn, error) | TypeScript │ └──
index.ts # 🔹 Экспорт логера и уровней логирования | TypeScript ├── errors/ # 🔹 Базовые ошибки и
ADT (Result / TaskEither) │ ├── README.md # 🔹 Обзор ошибок: ADT, immutable, FP-friendly |
TypeScript + FP + Effect │ ├── AppError.ts # 🔹 Базовый тип ошибок приложения | TypeScript + FP │
├── Result.ts # 🔹 FP-friendly ADT для success/error | TypeScript + FP + Effect │ └── index.ts # 🔹
Экспорт ошибок и Result helpers | TypeScript ├── types/ # 🔹 Общие типы для проекта │ ├──
README.md # 🔹 Обзор типов: DTO, domain-safe, immutable | TypeScript + FP │ ├── DTO.ts # 🔹 Общие
Data Transfer Objects | TypeScript │ ├── DomainTypes.ts # 🔹 Immutable / FP-friendly типы для домена
| TypeScript + FP │ └── index.ts # 🔹 Экспорт всех типов | TypeScript └── test/ # ✅ Unit /
Integration тесты shared utilities ├── mocks/ # 🔹 Моки для тестирования | TypeScript ├──
utils.test.ts # 🔹 Тесты FP утилит | TypeScript + FP + Effect ├── validation.test.ts # 🔹 Тесты
валидаторов | TypeScript + FP + Effect └── index.ts # 🔹 Экспорт helper-ов для тестов | TypeScript
