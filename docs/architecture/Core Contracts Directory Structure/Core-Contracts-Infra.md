core-contracts/ 
│   ├── src/ 
│   └── infrastructure/ # 🔹 Infrastructure Core (TypeScript + Effect + FP) ├─
index.ts # 🎯 Центральная точка экспорта всей инфраструктуры 
│   ├── cache/ # 🔹 Cache Infrastructure
(Redis / Memory / KV) │ 
│   ├── index.ts # Экспорт cache-инфраструктуры │ 
│   ├── Cache.ts # Абстракция
cache-клиента (FP-friendly) │ 
│   ├── CacheProvider.ts # Layer-провайдер cache │ 
│   ├── CacheConfig.ts #
Конфигурация кеша │ 
│   ├── CacheHealth.ts # Health-check кеша │ 
│   └── adapters/ # Конкретные реализации
(redis, memory) 
│   ├── config/ # 🔹 Configuration Infrastructure │ 
│   ├── index.ts # Экспорт
config-инфраструктуры │ 
│   ├── Config.ts # Основной контракт конфигурации │ 
│   ├── ConfigProvider.ts #
Layer-провайдер конфигурации │ 
│   ├── ConfigSource.ts # Источники конфигурации │ 
│   └── adapters/ # env,
dotenv, vault, k8s-config 
│   ├── database/ # 🔹 Database Infrastructure │ 
│   ├── index.ts # Экспорт
DB-инфраструктуры │ 
│   ├── Database.ts # Абстракция DB-клиента │ 
│   ├── DatabaseProvider.ts #
Layer-провайдер БД │ 
│   ├── DatabaseConfig.ts # Конфигурация БД │ 
│   ├── DatabaseHealth.ts # Health-check БД
│ 
│   └── adapters/ # postgres, mysql, sqlite, mongo 
│   ├── filesystem/ # 🔹 Filesystem Infrastructure
(Yandex S3 / MinIO / Local) │ 
│   ├── index.ts # Экспорт filesystem-инфраструктуры │ 
│   ├── FileSystem.ts #
Абстракция файловой системы │ 
│   ├── FileSystemProvider.ts # Layer-провайдер filesystem │ ├─
FileSystemConfig.ts # Конфигурация хранилища │ 
│   ├── FileSystemHealth.ts # Health-check хранилища │ ├─
operations.ts # Контракты операций (read/write/delete/list/exists) │ 
│   └── adapters/ # Конкретные
реализации │ 
│   ├── yandex/ # Yandex S3 │ │ 
│   ├── index.ts # Экспорт Yandex адаптера │ │ ├─
YandexFileSystem.ts # Реализация для Yandex Object Storage │ │ 
│   ├── YandexConfig.ts # Конфигурация
Yandex S3 │ │ 
│   └── README.md # Документация Yandex адаптера │ 
│   ├── minio/ # MinIO (S3-compatible) │ │ ├─
index.ts # Экспорт MinIO адаптера │ │ 
│   ├── MinioFileSystem.ts # Реализация для MinIO S3-compatible
storage │ │ 
│   ├── MinioConfig.ts # Конфигурация MinIO │ │ 
│   └── README.md # Документация MinIO адаптера │

│   └── local/ # Local FS (node / browser) │ 
│   ├── index.ts # Экспорт Local адаптера │ ├─
LocalFileSystem.ts # Реализация для локальной файловой системы │ 
│   ├── LocalConfig.ts # Конфигурация
локального хранилища │ 
│   └── README.md # Документация Local адаптера 
│   ├── health/ # 🔹 Health & Readiness
Infrastructure │ 
│   ├── index.ts # Экспорт health-инфраструктуры │ 
│   ├── HealthCheck.ts # Контракт
health-check │ 
│   ├── HealthRegistry.ts # Реестр health-check'ов │ 
│   ├── LivenessProbe.ts # Liveness checks
│ 
│   └── ReadinessProbe.ts # Readiness checks 
│   ├── k8s/ # 🔹 Kubernetes Infrastructure │ 
│   ├── index.ts #
Экспорт k8s-интеграций │ 
│   ├── K8s.ts # Контракт Kubernetes-интеграции │ 
│   ├── K8sConfig.ts # Kubernetes
runtime config │ 
│   ├── K8sHealth.ts # Health integration │ 
│   └── adapters/ # Downward API, ConfigMap,
Secret 
│   ├── locking/ # 🔹 Distributed Locking Infrastructure │ 
│   ├── index.ts # Экспорт
locking-инфраструктуры │ 
│   ├── Lock.ts # Контракт распределённого лока │ 
│   ├── LockProvider.ts #
Layer-провайдер блокировок │ 
│   ├── LockConfig.ts # Конфигурация блокировок │ 
│   └── adapters/ # redis-lock,
db-lock, etcd 
│   └── observability/ # 🔹 Observability Infrastructure 
│   ├── index.ts # Экспорт
observability 
│   ├── Logger.ts # Инфраструктурный логгер 
│   ├── Metrics.ts # Метрики (counters, gauges,
histograms) 
│   ├── Tracing.ts # Distributed tracing 
│   ├── ObservabilityConfig.ts # Конфигурация
observability 
│   └── adapters/ # OpenTelemetry, Prometheus, Sentry
