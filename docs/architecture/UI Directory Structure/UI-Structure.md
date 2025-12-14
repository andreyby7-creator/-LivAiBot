ui/ ├── README.md # 🔹 Обзор UI: принципы дизайна, reusable components, theme, accessibility
(Markdown) ├── index.ts # 🔹 Главный экспорт всех компонентов (TypeScript) ├── atoms/ # 🔹
Минимальные, независимые компоненты (TypeScript + FP) │ ├── Button.tsx # 🔹 Кнопка с theme,
disabled, loading (React, TypeScript, FP) │ ├── Input.tsx # 🔹 Текстовое поле с валидацией (React,
TypeScript, FP) │ ├── Checkbox.tsx # 🔹 Чекбокс (React, TypeScript, FP) │ └── index.ts # 🔹 Экспорт
всех atoms (TypeScript) ├── molecules/ # 🔹 Составные UI-компоненты (TypeScript + FP) │ ├──
Card.tsx # 🔹 Карточка с заголовком, контентом, footer (React, TypeScript, FP) │ ├── FormGroup.tsx #
🔹 Группа полей формы (React, TypeScript, FP) │ └── index.ts # 🔹 Экспорт всех molecules
(TypeScript) ├── organisms/ # 🔹 Более сложные компоненты (TypeScript + FP) │ ├── Navbar.tsx # 🔹
Навигационная панель (React, TypeScript, FP) │ ├── Sidebar.tsx # 🔹 Боковая панель (React,
TypeScript, FP) │ └── index.ts # 🔹 Экспорт всех organisms (TypeScript) ├── templates/ # 🔹
Шаблонные layout-компоненты (TypeScript + FP) │ ├── DashboardLayout.tsx # 🔹 Layout для дашбордов
(TypeScript) │ ├── AuthLayout.tsx # 🔹 Layout для страниц авторизации (TypeScript) │ └── index.ts #
🔹 Экспорт всех templates (TypeScript) ├── utils/ # 🔹 Утилиты UI (TypeScript + FP) │ ├── theme.ts #
🔹 Настройка темы, цвета, spacing (TypeScript, FP) │ ├── classNames.ts # 🔹 Генерация className для
styled-components / Tailwind (TypeScript, FP) │ └── index.ts # 🔹 Экспорт утилит (TypeScript, FP)
├── hooks/ # 🔹 UI-хуки (TypeScript + FP) │ ├── useToggle.ts # 🔹 Хук для toggle состояния
(TypeScript, FP, Effect) │ ├── useDebounce.ts # 🔹 Хук debounce (TypeScript, FP, Effect) │ └──
index.ts # 🔹 Экспорт хуков (TypeScript, FP, Effect) └── test/ # ✅ Unit / Integration тесты
компонентов (Vitest + Testing Library) ├── atoms/ # 🔹 Тесты atoms (TypeScript, FP, Vitest, React
Testing Library) ├── molecules/ # 🔹 Тесты molecules (TypeScript, FP, Vitest, React Testing Library)
├── organisms/ # 🔹 Тесты organisms (TypeScript, FP, Vitest, React Testing Library) └── templates/ #
🔹 Тесты templates (TypeScript, FP, Vitest, React Testing Library)
