core-contracts/ 
│   ├── src/ 
│   ├── errors/ # 🔹 Error Core (TypeScript + FP + ADT) │ 
│   ├── index.ts #
Центральный экспорт всех error-микросервисов │ 
│   ├── base/ # 🔹 Базовый error-kernel (FP + ADT
foundation) │ │ 
│   ├── BaseError.ts # Базовый ADT-тип ошибки │ │ 
│   ├── ErrorCode.ts # Типизированные коды
ошибок │ │ 
│   ├── ErrorMetadata.ts # Структурированные метаданные ошибки │ │ 
│   ├── ErrorSeverity.ts #
Уровни критичности (info/warn/error/fatal) │ │ 
│   └── index.ts # Экспорт base error API │ 
│   ├── domain/ #
🔹 Domain Errors (DDD + FP) │ │ 
│   ├── DomainError.ts # Ошибки доменного слоя (pure, deterministic) │ │

│   ├── InvariantViolationError.ts # Нарушения доменных инвариантов │ │ 
│   ├── RuleViolationError.ts #
Нарушения бизнес-правил │ │ 
│   └── index.ts # Экспорт domain errors │ 
│   ├── auth/ # 🔹 Auth & Security
Errors (FP + ADT) │ │ 
│   ├── AuthenticationError.ts # Ошибки аутентификации │ │ ├─
AuthorizationError.ts # Ошибки авторизации │ │ 
│   ├── TokenError.ts # Ошибки токенов / сессий │ │ └─
index.ts # Экспорт auth errors │ 
│   ├── infrastructure/ # 🔹 Infrastructure Errors (IO / Effects
boundary) │ │ 
│   ├── DatabaseError.ts # Ошибки БД │ │ 
│   ├── NetworkError.ts # Ошибки сети / HTTP / RPC │ │

│   ├── TimeoutError.ts # Таймауты │ │ 
│   ├── ExternalServiceError.ts # Ошибки внешних сервисов │ │ └─
index.ts # Экспорт infrastructure errors │ 
│   ├── metrics/ # 🔹 Metrics & Observability Errors │ │ ├─
MetricsCollectionError.ts # Ошибки сбора метрик │ │ 
│   ├── TracingError.ts # Ошибки трассировки /
correlation │ │ 
│   └── index.ts # Экспорт metrics errors │ 
│   ├── normalizers/ # 🔹 Error Normalization
Layer │ │ 
│   ├── ErrorNormalizer.ts # Приведение ошибок к unified ADT-форме │ │ ├─
HttpErrorNormalizer.ts # HTTP → Core Error │ │ 
│   ├── ExceptionNormalizer.ts # throw/catch → FP error │
│ 
│   └── index.ts # Экспорт нормализаторов │ 
│   └── utils/ # 🔹 Error Utilities (pure helpers) │ ├─
ErrorMatcher.ts # Pattern matching по ошибкам │ 
│   ├── ErrorSerializer.ts # Сериализация /
десериализация │ 
│   ├── ErrorGuards.ts # Type guards для ошибок │ 
│   └── index.ts # Экспорт утилит
