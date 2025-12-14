infrastructure-external-api/ ├── README.md # 🔹 Обзор External API Infrastructure: принципы, границы
ответственности, anti-patterns, vendor isolation ├── index.ts # 🔹 Главный экспорт внешних API
адаптеров (используется application-core) ├── crm-adapters/ # 🧾 CRM системы (Bitrix24, AmoCRM и
др.) │ ├── README.md # 🔹 CRM adapters: только transport + mapping │ ├── bitrix24/ # 🟦 Bitrix24 │ │
├── README.md # 🔹 Bitrix24 adapter overview │ │ ├── BitrixAuth.ts # 🔹 OAuth / token refresh │ │
├── BitrixHttpClient.ts # 🔹 HTTP клиент Bitrix API │ │ ├── BitrixErrors.ts # 🔹 Ошибки Bitrix API │
│ ├── BitrixMapper.ts # 🔹 Mapping Bitrix DTO ↔ internal DTO │ │ ├── BitrixWebhook.ts # 🔹 Валидация
webhook signatures │ │ └── index.ts │ ├── amocrm/ # 🟨 AmoCRM │ │ ├── README.md # 🔹 AmoCRM adapter
overview │ │ ├── AmoAuth.ts # 🔹 OAuth / token refresh │ │ ├── AmoHttpClient.ts # 🔹 HTTP клиент
AmoCRM │ │ ├── AmoErrors.ts # 🔹 Ошибки AmoCRM API │ │ ├── AmoMapper.ts # 🔹 Mapping Amo DTO ↔
internal DTO │ │ ├── AmoWebhook.ts # 🔹 Валидация webhook signatures │ │ └── index.ts │ └── index.ts
├── social-adapters/ # 💬 Социальные сети / мессенджеры │ ├── README.md # 🔹 Social adapters:
transport only, no business logic │ ├── telegram/ # 📩 Telegram │ │ ├── README.md # 🔹 Telegram
adapter overview │ │ ├── TelegramClient.ts # 🔹 Telegram Bot API клиент │ │ ├── TelegramErrors.ts #
🔹 Telegram API ошибки │ │ ├── TelegramMapper.ts # 🔹 Mapping update ↔ internal event │ │ ├──
TelegramWebhook.ts # 🔹 Webhook verification │ │ └── index.ts │ ├── whatsapp/ # 📱 WhatsApp │ │ ├──
WhatsAppClient.ts # 🔹 WhatsApp Business API клиент │ │ ├── WhatsAppErrors.ts # 🔹 WhatsApp API
ошибки │ │ ├── WhatsAppMapper.ts # 🔹 Mapping message ↔ internal DTO │ │ └── index.ts │ └── index.ts
├── webhook-adapters/ # 🔔 Входящие вебхуки (обобщённо) │ ├── README.md # 🔹 Webhooks: verification,
parsing, idempotency │ ├── WebhookVerifier.ts # 🔹 Проверка подписей / секретов │ ├──
WebhookParser.ts # 🔹 Парсинг payload (DTO only) │ ├── WebhookErrors.ts # 🔹 Ошибки вебхуков │ ├──
WebhookIdempotency.ts # 🔹 Защита от дублей (eventId) │ └── index.ts └── test/ # ✅ Тесты external
API инфраструктуры ├── bitrix.test.ts # 🔹 Bitrix adapter tests ├── amocrm.test.ts # 🔹 AmoCRM
adapter tests ├── telegram.test.ts # 🔹 Telegram adapter tests └── webhook.test.ts # 🔹 Webhook
verification tests
