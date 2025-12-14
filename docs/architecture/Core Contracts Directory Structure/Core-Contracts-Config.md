core-contracts/ 
│   ├── src/ 
│   ├── config/ # 🔹 Конфигурационные микросервисы (TypeScript + FP-friendly) │

│   ├── index.ts # Центральный экспорт всех конфигурационных модулей │ 
│   ├── ConfigValue.ts # 🔹
Типизированное значение конфигурации (ConfigValue<T>) │ 
│   ├── CoreConfig.ts # 🔹 Основная конфигурация
приложения (core-level settings) │ 
│   ├── IConfigProvider.ts # 🔹 Интерфейс провайдера конфигурации (для
DI / Layer) │ 
│   └── README.md # Документация по конфигурации 
│   └── context/ # 🔹 Микросервисы для Context
Propagation (TypeScript + Effect + FP) 
│   ├── propagation/ # 🔹 Контексты и пропагация данных по
execution flow │ 
│   ├── index.ts # Экспорт всех propagation Context │ 
│   ├── ContextStorage.ts # Хранилище
текущего контекста (thread-local / async-hooks) │ 
│   ├── CorrelationContext.ts # Корреляция операций
(traceId / requestId) │ 
│   └── IContextPropagator.ts # Интерфейс для propagation контекста 
│   └── tenant/ #
🔹 Контексты для multi-tenant приложений 
│   ├── index.ts # Экспорт всех tenant context └─
TenantSessionContext.ts # Tenant-specific session/context (tenantId, roles permissions)
