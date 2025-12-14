mobile/ ├── README.md # 🔹 Обзор Mobile App: структура, навигация, state management, интеграции
(Markdown, документация) ├── index.tsx # 🔹 Точка входа приложения (React Native + TypeScript + FP +
Effect) ├── screens/ # 🔹 Экраны приложения (TypeScript + FP) │ ├── HomeScreen.tsx # 🔹 Главный
экран, дашборд пользователя (React Native, TypeScript, FP) │ ├── BotSetupScreen.tsx # 🔹 Настройка
AI-бота (React Native, TypeScript, FP, Effect) │ ├── SubscriptionScreen.tsx # 🔹 Выбор и управление
подпиской (React Native, TypeScript, FP, Effect) │ ├── SettingsScreen.tsx # 🔹 Настройки
пользователя (React Native, TypeScript, FP) │ └── index.ts # 🔹 Экспорт всех экранов (TypeScript)
├── components/ # 🔹 UI-компоненты (TypeScript + FP) │ ├── Button.tsx # 🔹 Кнопки с поддержкой theme
/ disabled / loading (React Native, TypeScript, FP) │ ├── Input.tsx # 🔹 Текстовые поля с валидацией
(React Native, TypeScript, FP) │ ├── Card.tsx # 🔹 Карточки для отображения информации (React
Native, TypeScript, FP) │ └── index.ts # 🔹 Экспорт всех компонентов (TypeScript) ├── navigation/ #
🔹 React Navigation setup (TypeScript + FP) │ ├── AppNavigator.tsx # 🔹 Основной navigator
приложения (React Navigation, TypeScript) │ ├── StackNavigator.tsx # 🔹 Stack navigation для flow
(React Navigation, TypeScript) │ ├── TabNavigator.tsx # 🔹 Bottom tabs (React Navigation,
TypeScript) │ └── index.ts # 🔹 Экспорт навигаторов (TypeScript) ├── state/ # 🔹 State management
(TypeScript + FP + Effect) │ ├── store.ts # 🔹 Основной store приложения (zustand / redux-toolkit)
(TypeScript, FP, Effect) │ ├── hooks.ts # 🔹 Hook-helpers для доступа к store (TypeScript, FP) │ └──
featureFlags.ts # 🔹 Поддержка runtime feature flags (TypeScript, FP, Effect) ├── services/ # 🔹
Сервисы для API, интеграций, AI (TypeScript + FP + Effect) │ ├── ApiService.ts # 🔹 HTTP client
(fetch / axios) для backend (TypeScript, FP, Effect) │ ├── GraphQLService.ts # 🔹 GraphQL client
(TypeScript, FP, Effect) │ ├── AuthService.ts # 🔹 Аутентификация пользователя (TypeScript, FP,
Effect) │ └── index.ts # 🔹 Экспорт всех сервисов (TypeScript) ├── utils/ # 🔹 Чистые функции и
helper utilities (TypeScript + FP) │ ├── formatters.ts # 🔹 Форматирование даты, валюты, текста
(TypeScript, FP) │ ├── validators.ts # 🔹 Валидация input (TypeScript, FP) │ └── index.ts # 🔹
Экспорт всех утилит (TypeScript) ├── assets/ # 🔹 Статические ресурсы (изображения, шрифты) │ ├──
images/ # 🔹 Изображения (PNG, SVG, JPG) │ └── fonts/ # 🔹 Шрифты (TTF, OTF) └── test/ # ✅ Unit /
Integration тесты (React Native Testing Library + Vitest) ├── screens/ # 🔹 Тесты для экранов
(TypeScript, Vitest, React Native Testing Library) ├── components/ # 🔹 Тесты для компонентов
(TypeScript, Vitest, React Native Testing Library) └── services/ # 🔹 Тесты для сервисов
(TypeScript, Vitest, FP, Effect)
