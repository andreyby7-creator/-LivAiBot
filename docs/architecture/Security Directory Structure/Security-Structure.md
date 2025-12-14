security/ ├── README.md # 🔹 Обзор Security: принципы, контракты, middleware, утилиты (Markdown) ├──
index.ts # 🔹 Главный экспорт всех функций безопасности (TypeScript, FP, Effect) ├── auth/ # 🔹
Аутентификация и авторизация │ ├── JWTService.ts # 🔹 Подпись, верификация JWT токенов (TypeScript,
FP, Effect, jsonwebtoken) │ ├── OAuthService.ts # 🔹 OAuth2 / OpenID Connect интеграции (TypeScript,
FP, Effect) │ ├── SessionManager.ts # 🔹 Управление сессиями (in-memory / Redis) (TypeScript, FP,
Effect) │ └── index.ts # 🔹 Экспорт auth сервисов (TypeScript, FP, Effect) ├── csp/ # 🔹 Content
Security Policies │ ├── CSPBuilder.ts # 🔹 Генерация заголовков CSP (TypeScript, FP, Effect) │ ├──
CSPMiddleware.ts # 🔹 Middleware для применения CSP в HTTP (TypeScript, FP, Effect) │ └── index.ts #
🔹 Экспорт CSP компонентов (TypeScript, FP, Effect) ├── encryption/ # 🔹 Шифрование и управление
ключами │ ├── CryptoService.ts # 🔹 AES, RSA, hashing (bcrypt / scrypt) (TypeScript, FP, Effect,
Node.js crypto) │ ├── KeyManager.ts # 🔹 Управление ключами и rotation (TypeScript, FP, Effect) │
└── index.ts # 🔹 Экспорт encryption компонентов (TypeScript, FP, Effect) ├── audit/ # 🔹 Логи и
аудит безопасности │ ├── AuditLogger.ts # 🔹 Запись событий безопасности (TypeScript, FP, Effect) │
├── AuditMiddleware.ts # 🔹 Middleware для логирования request/response (TypeScript, FP, Effect) │
└── index.ts # 🔹 Экспорт audit компонентов (TypeScript, FP, Effect) ├── utils/ # 🔹 Утилиты
безопасности │ ├── validators.ts # 🔹 Проверка паролей, токенов (TypeScript, FP) │ ├──
sanitizeInput.ts # 🔹 Очистка input от XSS / injection (TypeScript, FP) │ └── index.ts # 🔹 Экспорт
security utils (TypeScript, FP) └── test/ # ✅ Unit / Integration тесты (Vitest / Jest) ├── auth/ #
🔹 Тесты auth компонентов (TypeScript, FP, Vitest) ├── csp/ # 🔹 Тесты CSP компонентов (TypeScript,
FP, Vitest) ├── encryption/ # 🔹 Тесты encryption компонентов (TypeScript, FP, Vitest) ├── audit/ #
🔹 Тесты audit компонентов (TypeScript, FP, Vitest) └── utils/ # 🔹 Тесты security utils
(TypeScript, FP, Vitest)
