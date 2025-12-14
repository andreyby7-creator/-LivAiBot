core-contracts/ 
│   ├── src/ 
│   └── react/ # 🔹 React Integration (TypeScript + FP-friendly) 
│   ├── index.ts # 🎯
Центральная точка экспорта всех React-компонентов и хуков 
│   ├── EffectProvider.tsx # 🔹 React Context
Provider для Effect / FP Core 
│   └── hooks/ # 🔹 React Hooks для интеграции с FP эффектами 
│   ├── index.ts #
Экспорт всех хуков 
│   ├── useEffect.ts # 🔹 Hook для работы с Effect (pure FP) 
│   ├── useTaskEither.ts # 🔹
Hook для TaskEither эффектов 
│   ├── useOption.ts # 🔹 Hook для Option / nullable значений ├─
useResult.ts # 🔹 Hook для Result / Either значений 
│   ├── useIO.ts # 🔹 Hook для чистых IO эффектов └─
useSchema.ts # 🔹 Hook для работы с SchemaHelpers (валидаторы / safeParse)
