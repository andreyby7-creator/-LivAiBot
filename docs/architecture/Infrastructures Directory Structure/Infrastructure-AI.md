infrastructure-ai/ ├── README.md # 🔹 Обзор AI Infrastructure: принципы, границы ответственности,
anti-patterns, latency & cost awareness ├── index.ts # 🔹 Главный экспорт AI инфраструктуры
(используется application-core) ├── ai-models/ # 🔹 Конфигурации AI моделей (НЕ бизнес!) │ ├──
README.md # 🔹 Model configs: versioning, tokens, limits, pricing │ ├── ModelId.ts # 🔹
Идентификаторы моделей (string literals) │ ├── ModelConfig.ts # 🔹 Статические конфиги моделей
maxTokens, temperature, timeout │ ├── PricingConfig.ts # 🔹 Стоимость токенов (для observability) │
├── RateLimitConfig.ts # 🔹 Технические rate-limits (НЕ бизнес) │ ├── DefaultModels.ts # 🔹 Маппинг
use-case → default model │ └── index.ts ├── yandex-cloud/ # ☁️ Yandex Cloud AI (конкретный вендор) │
├── README.md # 🔹 Yandex AI adapter: auth, endpoints, streaming │ ├── YandexAuth.ts # 🔹 IAM /
API-key авторизация │ ├── YandexHttpClient.ts # 🔹 HTTP клиент к Yandex AI │ ├── YandexErrors.ts #
🔹 Ошибки Yandex AI API │ ├── llm/ # 🧠 LLM API │ │ ├── LLMRequest.ts # 🔹 Запрос к LLM │ │ ├──
LLMResponse.ts # 🔹 Ответ LLM (raw, без интерпретации) │ │ ├── LLMStreaming.ts # 🔹 Streaming ответы
(tokens) │ │ └── index.ts │ ├── embeddings/ # 🧬 Embeddings API │ │ ├── EmbeddingRequest.ts # 🔹
Запрос embeddings │ │ ├── EmbeddingResponse.ts # 🔹 Ответ embeddings │ │ └── index.ts │ └── index.ts
├── adapters/ # 🔹 Унифицированные AI адаптеры (vendor-agnostic) │ ├── README.md # 🔹 AI adapters:
единый интерфейс для application │ ├── AIClient.ts # 🔹 Общий интерфейс AI клиента │ ├──
TextGenerationAdapter.ts # 🔹 Генерация текста (LLM) │ ├── EmbeddingAdapter.ts # 🔹 Embeddings │ ├──
StreamingAdapter.ts # 🔹 Streaming responses │ ├── AIErrors.ts # 🔹 Унифицированные AI ошибки │ ├──
AIObservability.ts # 🔹 Метрики: tokens, latency, cost │ └── index.ts ├── resilience/ # 🛡️
Надёжность AI вызовов │ ├── README.md # 🔹 Retry / backoff / circuit breaker │ ├── RetryPolicy.ts #
🔹 Retry стратегии │ ├── CircuitBreaker.ts # 🔹 Защита от деградации AI │ ├── TimeoutPolicy.ts # 🔹
Таймауты │ └── index.ts └── test/ # ✅ Тесты AI инфраструктуры ├── yandex-cloud.test.ts # 🔹 Yandex
Cloud adapter tests ├── adapters.test.ts # 🔹 Vendor-agnostic adapters tests ├──
resilience.test.ts # 🔹 Retry / circuit breaker tests └── ai-models.test.ts # 🔹 Model configs
validation
