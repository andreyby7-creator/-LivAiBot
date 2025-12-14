validation/ ├── README.md # 🔹 Обзор Validation: принципы валидации, генерация схем, интеграция с
DTO (Markdown) ├── index.ts # 🔹 Главный экспорт всех схем и генераторов (TypeScript, FP) ├──
schemas/ # 🔹 Готовые Zod схемы для DTO, form, API (TypeScript + Zod) │ ├── userSchema.ts # 🔹
Валидация User DTO (имя, email, пароль) (TypeScript, Zod, FP) │ ├── subscriptionSchema.ts # 🔹
Валидация Subscription DTO (планы, лимиты токенов) (TypeScript, Zod, FP) │ ├── botSchema.ts # 🔹
Валидация Bot DTO (настройки, сценарии) (TypeScript, Zod, FP) │ └── index.ts # 🔹 Экспорт всех схем
(TypeScript, Zod, FP) ├── generator/ # 🔹 Zod Generator (TypeScript types → Zod schemas) │ ├──
generate.ts # 🔹 Основной скрипт генерации схем (TypeScript, FP, Node.js) │ ├── utils.ts # 🔹
Утилиты для генерации (type reflection, mapping) (TypeScript, FP) │ └── index.ts # 🔹 Экспорт
генератора (TypeScript, FP) ├── utils/ # 🔹 Вспомогательные функции для валидации │ ├──
errorFormatter.ts # 🔹 Форматирование ошибок Zod для UI / API (TypeScript, FP) │ ├──
parseHelper.ts # 🔹 Помощники для безопасного парсинга (TypeScript, FP) │ └── index.ts # 🔹 Экспорт
утилит (TypeScript, FP) └── test/ # ✅ Unit / Integration тесты схем (Vitest + Zod) ├── schemas/ #
🔹 Тесты schemas (TypeScript, Zod, FP, Vitest) ├── generator/ # 🔹 Тесты generator (TypeScript, Zod,
FP, Vitest) └── utils/ # 🔹 Тесты utils (TypeScript, Zod, FP, Vitest)
