infrastructure-core/ ├── README.md # 🔹 Обзор Infrastructure Core: принципы, anti-patterns,
зависимости, lifecycle, Effect-интеграция ├── index.ts # 🔹 Главный экспорт инфраструктурных
адаптеров (используется application-core) ├── cache/ # 🔹 Кэширование (Redis / in-memory) │ ├──
README.md # 🔹 Cache layer: TTL, eviction, no business logic │ ├── RedisClient.ts # 🔹 Redis клиент
(ioredis) — низкоуровневый │ ├── CacheEffect.ts # 🔹 Effect-обёртка для cache операций │ ├──
CacheKeys.ts # 🔹 Генерация ключей (PURE, без знаний домена) │ ├── CacheErrors.ts # 🔹 Ошибки кеша
(connection, timeout) │ └── index.ts ├── database/ # 🔹 База данных (PostgreSQL + Prisma) │ ├──
README.md # 🔹 Database layer: persistence only │ ├── PrismaClient.ts # runtime DB access │ ├──
TransactionEffect.ts │ ├── QueryHelpers.ts │ ├── DatabaseErrors.ts │ ├── index.ts │ └── seed/ #
runtime seed, environment-aware │ ├── 001_initial_data.ts │ ├── 002_demo_data.ts │ └── README.md ├──
messaging/ # 🔹 Очереди и брокеры сообщений │ ├── README.md # 🔹 Messaging layer: events vs jobs,
retries, DLQ │ ├── rabbitmq/ # 🐇 Domain Events (FACTS) │ │ ├── README.md # 🔹 RabbitMQ: domain
events only │ │ ├── RabbitConnection.ts # 🔹 Подключение и lifecycle │ │ ├── EventPublisher.ts # 🔹
Публикация domain events │ │ ├── EventConsumer.ts # 🔹 Подписка на domain events │ │ ├──
EventSerializer.ts # 🔹 (De)serialization событий │ │ └── index.ts │ ├── bullmq/ # 🐂 Jobs /
Background Tasks │ │ ├── README.md # 🔹 BullMQ: jobs, retries, backoff │ │ ├── QueueClient.ts # 🔹
Инициализация очередей │ │ ├── JobProducer.ts # 🔹 Публикация jobs │ │ ├── JobWorker.ts # 🔹
Обработка jobs │ │ ├── JobEvents.ts # 🔹 Job lifecycle events │ │ └── index.ts │ └── index.ts ├──
adapters/ # 🔹 Внешние сервисы (HTTP / SDK) │ ├── README.md # 🔹 External adapters: тупые клиенты,
no decisions │ ├── http/ # 🌐 HTTP внешние сервисы │ │ ├── HttpClient.ts # 🔹 Базовый HTTP клиент
(fetch/undici) │ │ ├── HttpEffect.ts # 🔹 Effect wrapper (retry, timeout) │ │ ├── HttpErrors.ts # 🔹
Ошибки HTTP интеграций │ │ └── index.ts │ ├── storage/ # 📦 Файлы / S3 / MinIO │ │ ├──
FileStorageClient.ts # 🔹 Клиент хранилища │ │ ├── FileStorageEffect.ts # 🔹 Effect wrapper │ │ ├──
StorageErrors.ts # 🔹 Ошибки хранилища │ │ └── index.ts │ ├── auth/ # 🔐 Auth провайдеры (Supabase и
др.) │ │ ├── AuthClient.ts # 🔹 SDK клиент │ │ ├── AuthEffect.ts # 🔹 Effect wrapper │ │ ├──
AuthErrors.ts # 🔹 Ошибки авторизации │ │ └── index.ts │ └── index.ts └── test/ # ✅ Тесты
инфраструктуры ├── cache.test.ts # 🔹 Redis / cache tests ├── database.test.ts # 🔹 Prisma /
transactions tests ├── messaging.test.ts # 🔹 RabbitMQ / BullMQ tests └── adapters.test.ts # 🔹
External adapters tests
