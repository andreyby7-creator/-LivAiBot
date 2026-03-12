## LivAi Platform — Variant 2

## 🏗️ Архитектурные правила монорепо

### 📦 Правила версионирования пакетов

- **Core contracts**: Версионируются независимо, следуют семантическому версионированию
- **Adapters**: Версионируются вместе с сервисами, которые их используют
- **Shared libraries**: Версионируются по принципу "один ко многим" с сервисами

### 🔄 Правила импортов между слоями

#### Допустимые импорты:

```
services/ → packages/ (core-contracts, core, events, observability, ui-tokens)
services/ → adapters/ (database, storage, vector-db, queue, etc.)
packages/ → adapters/ (только через ports/adapters интерфейсы)
adapters/ → packages/ (запрещено - нарушает dependency inversion)
```

#### Service-local adapters (важное уточнение)

- Внутри конкретного сервиса допустимо иметь `src/adapters/`, **но это adapters только этого сервиса** (service-local).
- Правило dependency inversion усиливаем так: **любой `src/adapters/*` обязан реализовывать интерфейсы из `src/ports/*`** (никаких прямых зависимостей домена от конкретных SDK/клиентов).
- Другие сервисы **не импортируют** этот `src/adapters/`; переиспользуемые инфраструктурные клиенты остаются в верхнеуровневых `adapters/*`.

### ✍️ Конвенции нейминга (фиксируем единый стиль)

- Python-папки: `domain/`, `ports/`, `use_cases/`, `entrypoints/`, `adapters/`, `tests/`
- `main.py` — единая точка входа FastAPI сервиса (app factory), а `entrypoints/http/*` — роуты/контроллеры.
- Везде используем `ports/` + service-local `adapters/` (реализации интерфейсов), чтобы соблюдать dependency inversion.

#### Запрещенные импорты:

- **Services не могут импортировать другие services напрямую**
- **Adapters не могут импортировать business logic**
- **Apps не могут импортировать services напрямую**
- **Shared libraries не могут зависеть от конкретных сервисов**

#### Слои зависимостей (сверху вниз):

1. **Services** - бизнес-логика, use cases, domain models
2. **Shared** - contracts, core utilities, observability
3. **Adapters** - infrastructure, external APIs, databases
4. **Apps** - UI components, client-side logic

### 🛡️ Инструменты контроля зависимостей

#### ESLint правила:

- **Architectural boundaries** - проверка импортов между слоями
- **Dependency policy** - валидация зависимостей пакетов
- **Circular dependencies** - обнаружение циклических зависимостей

#### Конфигурационные файлы:

- `dependency-policy.json` - правила зависимостей между пакетами
- `eslint.config.mjs` - линтер правила для архитектуры
- `check-dependency-policy.js` - скрипт валидации политик

#### Автоматические проверки:

- **Pre-commit hooks** - проверка перед коммитом
- **CI/CD pipelines** - автоматическая валидация зависимостей
- **Monorepo analysis** - анализ графа зависимостей

### 🏭 Infrastructure (уточнение неймспейса)

- Текущая структура `infrastructure/{kubernetes,terraform,ansible,...}` корректна.
- Если захотим более строгую консистентность по “ops”, можно вынести в `infrastructure/ops/{kubernetes,terraform,ansible}` (или `ops/`), сохранив остальные подпапки (`monitoring`, `security`, `networking`, `ci-cd`) как есть.
- На текущем этапе **не закрепляем** перенос физически, но поддерживаем единый “ops namespace” на уровне документации/терминов: _kubernetes/terraform/ansible = ops_.

```
livai/
├── 📦 services/                          
│   ├── 🚪 api-gateway/                   
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── src/
│   │   │   ├── main.py                      # FastAPI app factory
│   │   │   ├── config/
│   │   │   │   ├── settings.py              # env parsing (.env.*)
│   │   │   │   └── logging.py
│   │   │   ├── entrypoints/
│   │   │   │   ├── http/
│   │   │   │   │   ├── routes_health.py     # /healthz, /readyz
│   │   │   │   │   ├── routes_auth.py       # proxy/compose auth endpoints (U1)
│   │   │   │   │   ├── routes_billing.py    # proxy billing endpoints (U2/U13)
│   │   │   │   │   └── routes_webhooks.py   # ingress for external webhooks (U9)
│   │   │   │   ├── ws/
│   │   │   │   │   └── routes.py
│   │   │   │   └── graphql/
│   │   │   │       └── schema.py
│   │   │   ├── middleware/
│   │   │   │   ├── auth.py                  # JWT validation / tenant injection
│   │   │   │   ├── cors.py
│   │   │   │   ├── rate_limit.py            # slowapi
│   │   │   │   ├── security_headers.py
│   │   │   │   └── observability.py         # trace-id, metrics, Sentry
│   │   │   ├── clients/
│   │   │   │   ├── auth_service.py
│   │   │   │   ├── billing_service.py
│   │   │   │   └── timeouts.py
│   │   │   ├── errors/
│   │   │   │   ├── http_errors.py
│   │   │   │   └── mapping.py               # map service errors → gateway errors
│   │   │   └── tests/{unit/,integration/}
│   │   └── Makefile
│   │
│   ├── 🤖 ai-service/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── domain/
│   │   │   │   ├── llm_session.py
│   │   │   │   ├── prompt_blocks.py              # U5
│   │   │   │   ├── multi_agent.py                # U5.1
│   │   │   │   ├── rag_context.py                # U6
│   │   │   │   ├── tool_call.py                  # U9.1 actions
│   │   │   │   └── token_usage.py
│   │   │   ├── ports/
│   │   │   │   ├── llm_provider.py               # YandexGPT/OpenAI
│   │   │   │   ├── embeddings_provider.py
│   │   │   │   ├── retriever.py                  # vector retrieval
│   │   │   │   ├── reranker.py                   # optional
│   │   │   │   ├── actions_registry.py
│   │   │   │   ├── documents_renderer.py         # U15
│   │   │   │   ├── storage_client.py
│   │   │   │   └── events_bus.py
│   │   │   ├── use_cases/
│   │   │   │   ├── run_dialog_turn.py            # U10
│   │   │   │   ├── orchestrate_agents.py         # U5.1
│   │   │   │   ├── build_rag_context.py          # U6
│   │   │   │   ├── execute_action.py             # U9.1
│   │   │   │   └── generate_document.py          # U15
│   │   │   ├── rag/
│   │   │   │   ├── chunk_selector.py
│   │   │   │   ├── citation_formatter.py         # “источники ответа” (U10)
│   │   │   │   ├── cache.py                      # cost control (Specs 4.3)
│   │   │   │   └── limits.py                     # token/doc limits (Specs 4.3)
│   │   │   ├── actions/
│   │   │   │   ├── registry.py
│   │   │   │   ├── webhook_call.py
│   │   │   │   ├── file_analyze.py
│   │   │   │   └── url_scrape.py
│   │   │   ├── documents/
│   │   │   │   ├── templates/                    # Jinja2/docx templates
│   │   │   │   │   ├── proposal_default.docx.j2
│   │   │   │   │   └── contract_default.docx.j2
│   │   │   │   ├── renderer.py                   # python-docx/reportlab/pandoc
│   │   │   │   └── versioning.py
│   │   │   ├── adapters/                         # service-local (реализуют ports/)
│   │   │   │   ├── providers/
│   │   │   │   │   ├── yandex_gpt.py
│   │   │   │   │   ├── openai_fallback.py
│   │   │   │   │   └── embeddings.py
│   │   │   │   ├── retrieval/
│   │   │   │   │   ├── vector_db.py             # uses adapters/vector-db
│   │   │   │   │   └── rerank.py
│   │   │   │   └── events/producer.py
│   │   │   ├── entrypoints/
│   │   │   │   ├── http/routes.py
│   │   │   │   ├── grpc/inference.proto
│   │   │   │   └── tasks/worker.py               # celery tasks
│   │   │   ├── observability/
│   │   │   └── tests/{unit/,integration/,load/}
│   │   └── Makefile
│   │
│   ├── 🗣️ conversations-service/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── domain/
│   │   │   │   ├── conversation.py           # thread + participants
│   │   │   │   ├── message.py                # messages + attachments
│   │   │   │   ├── handoff.py                # handoff requests (U5/U11)
│   │   │   │   ├── feedback.py               # 👍/👎 + comment (U11)
│   │   │   │   ├── tags.py
│   │   │   │   └── retention.py              # retention policy hooks
│   │   │   ├── ports/
│   │   │   │   ├── conversations_repo.py
│   │   │   │   ├── messages_repo.py
│   │   │   │   ├── analytics_stream.py       # emit metrics/events (U11.1)
│   │   │   │   ├── notifications.py          # notify on handoff (U11/U12)
│   │   │   │   ├── storage_client.py         # attachments (adapters/storage)
│   │   │   │   ├── events_bus.py
│   │   │   │   └── clock.py
│   │   │   ├── use_cases/
│   │   │   │   ├── open_conversation.py
│   │   │   │   ├── store_message.py          # U10/U11
│   │   │   │   ├── list_dialogs.py           # filters (U11)
│   │   │   │   ├── add_feedback.py           # 👍/👎 (U11)
│   │   │   │   ├── request_handoff.py        # U5/U11
│   │   │   │   ├── resolve_handoff.py
│   │   │   │   ├── export_threads.py         # exports for teams
│   │   │   │   └── apply_retention.py        # scheduled cleanup
│   │   │   ├── entrypoints/
│   │   │   │   ├── http/routes.py
│   │   │   │   ├── ws/dialog_stream.py       # realtime viewer (optional)
│   │   │   │   └── tasks/retention_worker.py
│   │   │   ├── persistence/
│   │   │   │   ├── postgres_repo.py          # OLTP storage
│   │   │   │   └── clickhouse_writer.py      # optional analytics sink
│   │   │   ├── adapters/                     # service-local
│   │   │   │   ├── storage/
│   │   │   │   └── events/producer.py
│   │   │   ├── observability/
│   │   │   └── tests/{unit/,integration/}
│   │   └── Makefile
│   │
│   ├── 📚 knowledge-service/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── domain/
│   │   │   │   ├── source.py                    # source types (URL/file/sheets/image/Q&A)
│   │   │   │   ├── ingestion_job.py
│   │   │   │   ├── index_version.py             # Specs 4.3
│   │   │   │   ├── chunk.py
│   │   │   │   └── quality_report.py
│   │   │   ├── ports/
│   │   │   │   ├── sources_repo.py
│   │   │   │   ├── storage_client.py            # adapters/storage
│   │   │   │   ├── vector_client.py             # adapters/vector-db
│   │   │   │   ├── embeddings_provider.py       # ai-service/provider or shared adapter
│   │   │   │   ├── events_bus.py
│   │   │   │   └── clock.py
│   │   │   ├── use_cases/
│   │   │   │   ├── create_source.py             # U6
│   │   │   │   ├── upload_source_file.py
│   │   │   │   ├── start_ingestion.py
│   │   │   │   ├── run_indexation.py            # background job
│   │   │   │   ├── schedule_sync.py             # Specs 4.3 (reindex)
│   │   │   │   ├── delete_source.py             # retention/delete (Specs 4.3)
│   │   │   │   └── build_quality_report.py      # “качество” UI
│   │   │   ├── connectors/
│   │   │   │   ├── website.py                   # URL crawl/scrape
│   │   │   │   ├── documents.py                 # PDF/DOCX/TXT parse
│   │   │   │   ├── google_sheets.py
│   │   │   │   ├── images.py                    # OCR/vision pipeline (optional)
│   │   │   │   └── qa_import.py                 # Excel/CSV Q&A
│   │   │   ├── indexing/
│   │   │   │   ├── chunker.py
│   │   │   │   ├── dedupe.py                    # duplicate chunks
│   │   │   │   ├── validator.py                 # size/type limits
│   │   │   │   └── pipeline.py
│   │   │   ├── quality/
│   │   │   │   ├── evaluator.py
│   │   │   │   ├── examples_generator.py
│   │   │   │   └── alerts.py
│   │   │   ├── adapters/                         # service-local (реализуют ports/)
│   │   │   │   ├── persistence/
│   │   │   │   ├── storage/
│   │   │   │   ├── vector/
│   │   │   │   └── events/producer.py
│   │   │   ├── entrypoints/
│   │   │   │   ├── http/routes.py
│   │   │   │   └── tasks/worker.py              # Celery ingestion/index jobs
│   │   │   ├── observability/
│   │   │   └── tests/{unit/,integration/}
│   │   └── Makefile
│   │
│   ├── 🤖 bots-service/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── domain/
│   │   │   │   ├── bot.py
│   │   │   │   ├── template.py                # role templates catalog
│   │   │   │   ├── instruction.py             # prompt blocks (U5)
│   │   │   │   ├── multi_agent_schema.py      # U5.1
│   │   │   │   └── publishing.py              # draft/active
│   │   │   ├── ports/
│   │   │   │   ├── bots_repo.py
│   │   │   │   ├── templates_repo.py
│   │   │   │   ├── events_bus.py
│   │   │   │   └── clock.py
│   │   │   ├── use_cases/
│   │   │   │   ├── create_bot_from_template.py # U3
│   │   │   │   ├── create_custom_bot.py        # U4
│   │   │   │   ├── update_instruction.py       # U5
│   │   │   │   ├── manage_multi_agent.py       # U5.1
│   │   │   │   ├── simulate_bot_message.py     # U10 (test chat)
│   │   │   │   └── publish_bot.py              # U10
│   │   │   ├── templates/
│   │   │   │   ├── catalog.json
│   │   │   │   └── roles/
│   │   │   │       ├── sales.md
│   │   │   │       ├── support.md
│   │   │   │       ├── hr.md
│   │   │   │       └── marketplace.md
│   │   │   ├── orchestration/
│   │   │   │   ├── agent_graph.py
│   │   │   │   └── guardrails.py              # loops/conflict detection
│   │   │   ├── adapters/                        # service-local (реализуют ports/)
│   │   │   │   ├── persistence/
│   │   │   │   ├── templates_fs.py
│   │   │   │   └── events/producer.py
│   │   │   ├── entrypoints/
│   │   │   │   ├── http/routes.py
│   │   │   │   └── ws/test_chat.py             # simulator realtime
│   │   │   ├── observability/
│   │   │   └── tests/{unit/,integration/}
│   │   └── Makefile
│   │
│   ├── 🔗 integrations-service/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── domain/
│   │   │   │   ├── connector.py                # connector definition + status
│   │   │   │   ├── connection.py               # tenant-bound connection (tokens/keys encrypted)
│   │   │   │   ├── webhook_contract.py         # retries/idempotency (Specs 4.2)
│   │   │   │   ├── mapping.py                  # fields/status mapping (U8 edge cases)
│   │   │   │   ├── action_binding.py           # link actions → bots/scenarios (U9.1)
│   │   │   │   └── errors.py
│   │   │   ├── ports/                          # интерфейсы (contracts) для service-local adapters
│   │   │   │   ├── connectors_repo.py
│   │   │   │   ├── connections_repo.py
│   │   │   │   ├── secrets_store.py            # encrypt/store tokens (A7)
│   │   │   │   ├── webhook_queue.py            # enqueue ingress/outgress
│   │   │   │   ├── http_client.py              # generic http w/ retries
│   │   │   │   ├── rate_limiter.py             # per-tenant/per-connector limits
│   │   │   │   ├── idempotency_store.py        # dedupe window (Specs 4.2)
│   │   │   │   ├── circuit_breaker.py
│   │   │   │   ├── notifications.py            # alerting on failures (A6)
│   │   │   │   └── events_bus.py
│   │   │   ├── use_cases/
│   │   │   │   ├── connect_connector.py         # U7: connect
│   │   │   │   ├── disconnect_connector.py
│   │   │   │   ├── test_connection.py           # U7: test message/sync
│   │   │   │   ├── sync_remote_data.py          # U7/U8: initial sync
│   │   │   │   ├── upsert_mapping.py            # U8: mapping fields/status
│   │   │   │   ├── create_webhook_contract.py   # U9
│   │   │   │   ├── receive_webhook.py           # ingress → queue
│   │   │   │   ├── dispatch_webhook_job.py      # queue → connector handler
│   │   │   │   ├── execute_outgoing_webhook.py  # outbound calls
│   │   │   │   └── bind_action.py               # U9.1: connect action to scenario
│   │   │   ├── connectors/                      # service logic per connector (no SDK creds here)
│   │   │   │   ├── crm/
│   │   │   │   │   ├── amocrm.py
│   │   │   │   │   ├── kommo.py
│   │   │   │   │   ├── retailcrm.py
│   │   │   │   │   └── bitrix24.py
│   │   │   │   ├── messengers/
│   │   │   │   │   ├── telegram.py
│   │   │   │   │   ├── whatsapp.py
│   │   │   │   │   └── max.py
│   │   │   │   ├── social/
│   │   │   │   │   ├── instagram.py
│   │   │   │   │   └── vk.py
│   │   │   │   ├── marketplaces/
│   │   │   │   │   ├── wildberries.py
│   │   │   │   │   ├── ozon.py
│   │   │   │   │   ├── yandex_market.py
│   │   │   │   │   └── avito.py
│   │   │   │   ├── helpdesk/
│   │   │   │   │   ├── usedesk.py
│   │   │   │   │   └── planfix.py
│   │   │   │   ├── booking/
│   │   │   │   │   ├── yclients.py
│   │   │   │   │   ├── altegio.py
│   │   │   │   │   └── medfleks.py
│   │   │   │   ├── calendars/
│   │   │   │   │   └── google_calendar.py
│   │   │   │   ├── widgets/
│   │   │   │   │   ├── savvi_widget.py
│   │   │   │   │   └── jivo.py
│   │   │   │   └── omni/
│   │   │   │       └── umnico.py
│   │   │   ├── webhooks/
│   │   │   │   ├── ingress.py                # HTTP ingress endpoints
│   │   │   │   ├── dispatcher.py             # route to connector handler
│   │   │   │   ├── retries.py                # retry strategy + jitter/cap
│   │   │   │   ├── idempotency.py            # idempotency key extraction/storage
│   │   │   │   ├── signatures.py             # verify signatures (if provider supports)
│   │   │   │   └── dlq.py                    # dead-letter integration (Specs 4.2)
│   │   │   ├── actions/
│   │   │   │   ├── registry.py               # action types exposed to ai-service
│   │   │   │   ├── crm_update.py
│   │   │   │   ├── booking_create.py
│   │   │   │   └── helpdesk_ticket.py
│   │   │   ├── entrypoints/
│   │   │   │   ├── http/
│   │   │   │   │   ├── routes.py             # CRUD connectors/connections
│   │   │   │   │   ├── oauth_routes.py       # OAuth redirects/callbacks
│   │   │   │   │   ├── webhook_routes.py     # webhook endpoints
│   │   │   │   │   └── admin_routes.py       # A5/A6: catalog, status, retries/DLQ
│   │   │   │   └── tasks/
│   │   │   │       ├── webhook_worker.py     # queue consumer
│   │   │   │       └── sync_worker.py
│   │   │   ├── adapters/                     # service-local adapters (реализуют ports/, не шарим между сервисами)
│   │   │   │   ├── persistence/
│   │   │   │   ├── queue/                    # uses adapters/queue
│   │   │   │   ├── secrets/
│   │   │   │   ├── http/
│   │   │   │   ├── circuit_breaker/
│   │   │   │   └── events/producer.py
│   │   │   ├── observability/
│   │   │   └── tests/{unit/,integration/,contract/}
│   │   └── Makefile
│   │
│   ├── 💰 billing-service/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── migrations/                    # own DB migrations (billing tables)
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   │   ├── plan.py                # тарифы/пакеты
│   │   │   │   ├── subscription.py
│   │   │   │   ├── payment.py             # payment state machine
│   │   │   │   ├── invoice.py             # счета/акты
│   │   │   │   └── usage.py               # usage record model (U13)
│   │   │   ├── ports/
│   │   │   │   ├── billing_repo.py
│   │   │   │   ├── payments_gateway.py    # WebPay/bePaid/ЕРИП
│   │   │   │   ├── events_bus.py
│   │   │   │   └── clock.py
│   │   │   ├── use_cases/
│   │   │   │   ├── create_checkout.py     # U2: инициировать оплату/активацию
│   │   │   │   ├── handle_payment_webhook.py
│   │   │   │   ├── activate_subscription.py
│   │   │   │   ├── record_usage.py        # U13: metering events → usage
│   │   │   │   ├── enforce_quotas.py      # U13: квоты/алерты
│   │   │   │   └── export_billing_history.py
│   │   │   ├── entrypoints/
│   │   │   │   ├── http/
│   │   │   │   │   ├── routes.py
│   │   │   │   │   ├── webhooks.py        # провайдеры платежей
│   │   │   │   │   └── admin_routes.py    # A3/A4 (tariffs/payments)
│   │   │   │   └── tasks/
│   │   │   │       ├── metering_consumer.py   # consume packages/events billing.usage_recorded
│   │   │   │       └── reconciliation.py
│   │   │   ├── adapters/                 # service-local (реализуют ports/)
│   │   │   │   ├── persistence/          # repos on Postgres
│   │   │   │   ├── payments/
│   │   │   │   │   ├── webpay.py
│   │   │   │   │   ├── bepaid.py
│   │   │   │   │   └── erip.py
│   │   │   │   └── events/producer.py
│   │   │   ├── policies/
│   │   │   │   ├── pricing.py            # price rules
│   │   │   │   └── limits.py             # quota rules
│   │   │   ├── observability/
│   │   │   └── tests/{unit/,integration/}
│   │   └── Makefile
│   │
│   ├── 👥 auth-service/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── migrations/                 # own DB migrations (users/workspaces)
│   │   ├── src/
│   │   │   ├── domain/
│   │   │   │   ├── user.py
│   │   │   │   ├── workspace.py
│   │   │   │   ├── membership.py       # roles, invites (U14)
│   │   │   │   └── auth_session.py
│   │   │   ├── ports/
│   │   │   │   ├── users_repo.py
│   │   │   │   ├── workspaces_repo.py
│   │   │   │   ├── email_sender.py     # confirm/invite/reset flows
│   │   │   │   ├── identity_provider.py # fastapi-users / external IdP
│   │   │   │   ├── events_bus.py
│   │   │   │   └── clock.py
│   │   │   ├── use_cases/
│   │   │   │   ├── register_user.py    # U1
│   │   │   │   ├── login_user.py
│   │   │   │   ├── create_workspace.py # U1
│   │   │   │   ├── invite_member.py    # U14
│   │   │   │   ├── accept_invite.py
│   │   │   │   ├── enable_2fa.py       # edge case U1
│   │   │   │   └── revoke_sessions.py  # A2: forced logout
│   │   │   ├── entrypoints/
│   │   │   │   └── http/
│   │   │   │       ├── routes.py
│   │   │   │       ├── auth_routes.py
│   │   │   │       └── admin_routes.py # A2
│   │   │   ├── adapters/              # service-local (реализуют ports/)
│   │   │   │   ├── persistence/
│   │   │   │   ├── email/
│   │   │   │   ├── idp/
│   │   │   │   └── events/producer.py
│   │   │   ├── security/
│   │   │   │   ├── password_hashing.py
│   │   │   │   ├── jwt.py
│   │   │   │   └── pii_masking.py
│   │   │   ├── observability/
│   │   │   └── tests/{unit/,integration/}
│   │   └── Makefile
│   │
│   ├── 👑 admin-service/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── domain/
│   │   │   │   ├── tenant.py                 # A1 workspace/tenant lifecycle
│   │   │   │   ├── user_admin.py             # A2 user actions (block/reset 2FA/logout)
│   │   │   │   ├── tariff_plan.py            # A3 тарифы/лимиты/пакеты
│   │   │   │   ├── payment_admin.py          # A4 платежи/возвраты/акты
│   │   │   │   ├── connector_catalog.py      # A5 включение/версии/лимиты коннекторов
│   │   │   │   ├── incident.py               # A6 инциденты/сбои
│   │   │   │   ├── security_policy.py        # A7 политики (IP bans/2FA req)
│   │   │   │   └── audit_log.py              # A7 audit events
│   │   │   ├── ports/
│   │   │   │   ├── tenants_repo.py
│   │   │   │   ├── users_repo.py
│   │   │   │   ├── tariffs_repo.py
│   │   │   │   ├── payments_repo.py
│   │   │   │   ├── connectors_repo.py
│   │   │   │   ├── incidents_repo.py
│   │   │   │   ├── audit_repo.py
│   │   │   │   ├── secrets_store.py          # view/mask connector secrets
│   │   │   │   ├── policy_engine.py          # apply security policies
│   │   │   │   ├── notifications.py          # notify support/admin
│   │   │   │   ├── events_bus.py
│   │   │   │   └── clock.py
│   │   │   ├── use_cases/
│   │   │   │   ├── tenants/
│   │   │   │   │   ├── create_tenant.py      # A1
│   │   │   │   │   ├── freeze_tenant.py
│   │   │   │   │   ├── delete_tenant.py
│   │   │   │   │   └── set_limits.py
│   │   │   │   ├── users/
│   │   │   │   │   ├── block_user.py         # A2
│   │   │   │   │   ├── reset_2fa.py
│   │   │   │   │   └── force_logout.py
│   │   │   │   ├── tariffs/
│   │   │   │   │   ├── create_tariff.py      # A3
│   │   │   │   │   ├── update_tariff.py
│   │   │   │   │   ├── manage_promocodes.py
│   │   │   │   │   └── sell_token_pack.py
│   │   │   │   ├── payments/
│   │   │   │   │   ├── list_payments.py      # A4
│   │   │   │   │   ├── issue_invoice.py
│   │   │   │   │   └── handle_refund.py
│   │   │   │   ├── connectors/
│   │   │   │   │   ├── enable_connector.py   # A5
│   │   │   │   │   ├── disable_connector.py
│   │   │   │   │   ├── set_rate_limits.py
│   │   │   │   │   └── test_connector.py
│   │   │   │   ├── monitoring/
│   │   │   │   │   ├── open_incident.py      # A6
│   │   │   │   │   ├── close_incident.py
│   │   │   │   │   └── replay_dlq_job.py     # A6/A8 (retry from DLQ)
│   │   │   │   ├── security/
│   │   │   │   │   ├── update_policies.py    # A7
│   │   │   │   │   ├── ban_ip.py
│   │   │   │   │   └── view_audit_log.py
│   │   │   │   └── support/
│   │   │   │       ├── diagnose_connector.py # A8 tools
│   │   │   │       └── view_tenant_config.py
│   │   │   ├── entrypoints/
│   │   │   │   ├── http/
│   │   │   │   │   ├── routes.py             # admin REST
│   │   │   │   │   ├── tenants_routes.py
│   │   │   │   │   ├── users_routes.py
│   │   │   │   │   ├── tariffs_routes.py
│   │   │   │   │   ├── payments_routes.py
│   │   │   │   │   ├── connectors_routes.py
│   │   │   │   │   ├── monitoring_routes.py
│   │   │   │   │   ├── security_routes.py
│   │   │   │   │   └── audit_routes.py
│   │   │   │   └── tasks/
│   │   │   │       ├── incident_worker.py
│   │   │   │       └── policies_worker.py
│   │   │   ├── adapters/                     # service-local
│   │   │   │   ├── persistence/
│   │   │   │   ├── policy/
│   │   │   │   ├── secrets/
│   │   │   │   ├── notifications/
│   │   │   │   └── events/producer.py
│   │   │   ├── observability/
│   │   │   └── tests/{unit/,integration/}
│   │   └── Makefile
│   │
│   ├── 📊 analytics-service/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── README.md
│   │   ├── migrations/
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── domain/
│   │   │   │   ├── metrics.py               # metric defs (dialogs, latency, tokens)
│   │   │   │   ├── dashboard.py
│   │   │   │   ├── report.py                # export models
│   │   │   │   └── alerts.py                # SLA/usage alerts (A6/U13)
│   │   │   ├── ports/
│   │   │   │   ├── analytics_store.py       # ClickHouse
│   │   │   │   ├── events_bus.py            # packages/events consumer
│   │   │   │   ├── notifications.py         # alert delivery
│   │   │   │   └── clock.py
│   │   │   ├── use_cases/
│   │   │   │   ├── ingest_event.py          # events → metrics
│   │   │   │   ├── get_dashboard.py         # U11.1
│   │   │   │   ├── get_bot_metrics.py
│   │   │   │   ├── export_report.py         # U11.1 export
│   │   │   │   └── emit_alerts.py           # anomaly/SLA alerts
│   │   │   ├── pipelines/
│   │   │   │   ├── ingestion.py
│   │   │   │   └── aggregation.py
│   │   │   ├── entrypoints/
│   │   │   │   ├── http/routes.py
│   │   │   │   └── tasks/worker.py          # consume/aggregate
│   │   │   ├── adapters/
│   │   │   │   ├── clickhouse/
│   │   │   │   ├── events/consumer.py
│   │   │   │   └── notifications/
│   │   │   ├── observability/
│   │   │   └── tests/{unit/,integration/}
│   │   └── Makefile
│   │
│   └── 📧 notifications-service/
│       ├── Dockerfile
│       ├── pyproject.toml
│       ├── README.md
│       ├── migrations/
│       ├── src/
│       │   ├── main.py
│       │   ├── domain/
│       │   │   ├── template.py             # template + variables
│       │   │   ├── broadcast.py            # campaigns (U12.1)
│       │   │   ├── trigger.py              # follow-up triggers (U12)
│       │   │   ├── delivery.py             # delivery status
│       │   │   └── unsubscribe.py          # edge case U12.1
│       │   ├── ports/
│       │   │   ├── notifications_repo.py
│       │   │   ├── templates_repo.py
│       │   │   ├── provider_gateway.py     # uses adapters/notifications
│       │   │   ├── segments_provider.py    # from CRM/DB (U12.1)
│       │   │   ├── idempotency_store.py    # dedupe sends
│       │   │   ├── events_bus.py
│       │   │   └── clock.py
│       │   ├── use_cases/
│       │   │   ├── send_follow_up.py       # U12
│       │   │   ├── schedule_broadcast.py   # U12.1
│       │   │   ├── send_test_message.py
│       │   │   ├── handle_unsubscribe.py
│       │   │   └── push_limit_alert.py     # U13 alerts
│       │   ├── entrypoints/
│       │   │   ├── http/routes.py
│       │   │   ├── events/consumer.py      # consume events → notifications
│       │   │   └── tasks/worker.py         # celery scheduler/sender
│       │   ├── adapters/
│       │   │   ├── persistence/
│       │   │   ├── providers/              # service-local wrappers over adapters/notifications
│       │   │   └── events/producer.py
│       │   ├── templates/                  # local template assets (optional)
│       │   ├── observability/
│       │   └── tests/{unit/,integration/}
│       └── Makefile
│
├── 🎨 apps/
│   ├── shared/
│   │   ├── ui-components/         # общий UI слой для web/admin/mobile (если нужен)
│   │   ├── ui-icons/
│   │   └── ui-utils/
│   ├── 🌍 web/
│   │   ├── next.config.mjs
│   │   ├── package.json
│   │   ├── postcss.config.mjs
│   │   ├── tailwind.config.ts
│   │   ├── middleware.ts                 # Next middleware (auth/tenant hints)
│   │   ├── public/
│   │   │   ├── pwa-manifest.json
│   │   │   ├── icons/
│   │   │   └── robots.txt
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx
│   │       │   ├── (auth)/
│   │       │   │   ├── login/page.tsx        # U1
│   │       │   │   ├── register/page.tsx
│   │       │   │   └── reset-password/page.tsx
│   │       │   ├── (app)/
│   │       │   │   ├── dashboard/page.tsx    # Specs 1.1 Dashboard
│   │       │   │   ├── bots/                 # Specs 1.1 Bots (U3–U5.1/U10)
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   ├── [botId]/page.tsx
│   │       │   │   │   └── [botId]/test/page.tsx
│   │       │   │   ├── knowledge/            # Specs 1.1 Knowledge (U6)
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   └── sources/[sourceId]/page.tsx
│   │       │   │   ├── channels/             # Specs 1.1 Channels (U7–U9)
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   └── connectors/[connectorId]/page.tsx
│   │       │   │   ├── actions/              # Specs 1.1 Actions (U9.1)
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   └── [actionId]/page.tsx
│   │       │   │   ├── marketing/            # Specs 1.1 Рассылки (U12.1)
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   ├── campaigns/page.tsx
│   │       │   │   │   └── segments/page.tsx
│   │       │   │   ├── analytics/            # Specs 1.1 Analytics (U11.1)
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   └── exports/page.tsx
│   │       │   │   ├── dialogs/              # Specs 1.1 Dialogs (U11)
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   └── [conversationId]/page.tsx
│   │       │   │   ├── billing/              # Specs 1.1 Billing (U2/U13)
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   ├── plans/page.tsx
│   │       │   │   │   └── invoices/page.tsx
│   │       │   │   ├── team/                 # Specs 1.1 Team (U14)
│   │       │   │   │   ├── page.tsx
│   │       │   │   │   └── api-keys/page.tsx
│   │       │   │   └── settings/page.tsx     # Specs 1.1 Settings
│   │       │   ├── api/
│   │       │   │   └── auth/[...nextauth]/route.ts   # NextAuth v5
│   │       │   └── manifest.ts                # Next PWA manifest builder (optional)
│   │       ├── modules/                       # feature modules (domain-level UI)
│   │       │   # Модули = доменная логика UI (api/query/state/components/forms) для конкретного раздела.
│   │       │   # В app/* лежат роуты/страницы, а модули дают переиспользуемые “кирпичи” для этих страниц.
│   │       │   # В features/* лежат кросс-модульные фичи/визарды (onboarding, bot-wizard, test-chat и т.п.).
│   │       │   ├── dashboard/
│   │       │   │   ├── index.ts
│   │       │   │   ├── api.ts                  # вызовы gateway для метрик/summary
│   │       │   │   ├── queries.ts              # TanStack Query hooks
│   │       │   │   ├── components/
│   │       │   │   └── types.ts
│   │       │   ├── bots/
│   │       │   │   ├── index.ts
│   │       │   │   ├── api.ts                  # CRUD bots/templates/instructions
│   │       │   │   ├── queries.ts
│   │       │   │   ├── forms/                  # create/update bot, prompt blocks
│   │       │   │   ├── components/
│   │       │   │   └── types.ts
│   │       │   ├── knowledge/
│   │       │   │   ├── index.ts
│   │       │   │   ├── api.ts                  # sources/ingestion/quality
│   │       │   │   ├── queries.ts
│   │       │   │   ├── components/
│   │       │   │   └── types.ts
│   │       │   ├── channels/
│   │       │   │   ├── index.ts
│   │       │   │   ├── api.ts            # connectors/connections/webhook contracts
│   │       │   │   ├── queries.ts
│   │       │   │   ├── forms/
│   │       │   │   ├── components/
│   │       │   │   └── types.ts
│   │       │   ├── actions/
│   │       │   │   ├── index.ts
│   │       │   │   ├── api.ts            # actions registry + bind to bots/scenarios
│   │       │   │   ├── queries.ts
│   │       │   │   ├── forms/
│   │       │   │   ├── components/
│   │       │   │   └── types.ts
│   │       │   ├── marketing/
│   │       │   │   ├── index.ts
│   │       │   │   ├── api.ts                  # campaigns/segments/schedules
│   │       │   │   ├── queries.ts
│   │       │   │   ├── forms/
│   │       │   │   ├── components/
│   │       │   │   └── types.ts
│   │       │   ├── analytics/
│   │       │   │   ├── index.ts
│   │       │   │   ├── api.ts                  # dashboards/exports
│   │       │   │   ├── queries.ts
│   │       │   │   ├── components/
│   │       │   │   └── types.ts
│   │       │   ├── dialogs/
│   │       │   │   ├── index.ts
│   │       │   │   ├── api.ts        # list dialogs, thread detail, feedback, handoff
│   │       │   │   ├── queries.ts
│   │       │   │   ├── components/
│   │       │   │   └── types.ts
│   │       │   ├── billing/
│   │       │   │   ├── index.ts
│   │       │   │   ├── api.ts                  # plans/checkout/invoices/usage
│   │       │   │   ├── queries.ts
│   │       │   │   ├── components/
│   │       │   │   └── types.ts
│   │       │   ├── team/
│   │       │   │   ├── index.ts
│   │       │   │   ├── api.ts                  # members/invites/roles/api-keys
│   │       │   │   ├── queries.ts
│   │       │   │   ├── forms/
│   │       │   │   ├── components/
│   │       │   │   └── types.ts
│   │       │   └── settings/
│   │       │       ├── index.ts
│   │       │       ├── api.ts           # profile/security/notifications/preferences
│   │       │       ├── queries.ts
│   │       │       ├── components/
│   │       │       └── types.ts
│   │       ├── features/
│   │       │   ├── onboarding/                # U1 wizard
│   │       │   ├── bot-wizard/                # U3/U4 wizard
│   │       │   ├── prompt-editor/             # U5 blocks editor
│   │       │   ├── multi-agent-designer/      # U5.1 graph UI
│   │       │   ├── rag-quality/               # U6 quality UI
│   │       │   ├── test-chat/                 # U10 simulator
│   │       │   └── notifications-center/      # U12
│   │       ├── shared/
│   │       │   ├── ui/                        # shadcn/ui wrappers + design tokens
│   │       │   ├── hooks/
│   │       │   ├── lib/
│   │       │   │   ├── api-client.ts          # gateway client
│   │       │   │   ├── auth.ts
│   │       │   │   └── errors.ts
│   │       │   └── utils/
│   │       ├── state/
│   │       │   ├── query/                     # TanStack Query config
│   │       │   ├── stores/                    # Zustand stores
│   │       │   └── store.ts
│   │       ├── service-worker/                # PWA service worker sources
│   │       │   ├── sw.ts
│   │       │   └── push.ts
│   │       └── tests/{unit,e2e}/
│   ├── 📱 mobile/
│   │   ├── package.json
│   │   ├── app.json
│   │   └── src/
│   │       ├── screens/{Dashboard.tsx,Dialogs.tsx,Analytics.tsx,Limits.tsx}
│   │       ├── navigation/
│   │       ├── shared/{ui/,hooks/,api/}
│   │       └── tests/
│   ├── 🖥️ admin/
│   │   ├── next.config.mjs
│   │   ├── package.json
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   └── page.tsx
│   │       ├── modules/
│   │       │   ├── tenants/            # A1
│   │       │   ├── users/              # A2
│   │       │   ├── tariffs/            # A3
│   │       │   ├── payments/           # A4
│   │       │   ├── connectors/         # A5
│   │       │   ├── monitoring/         # A6
│   │       │   ├── security/           # A7
│   │       │   └── support/            # A8
│   │       ├── features/
│   │       │   └── audit-log/
│   │       ├── shared/{ui/,hooks/,lib/}
│   │       └── tests/
│   └── 📱 pwa/
│       ├── package.json
│       └── src/
│           ├── quick-actions.ts         # Specs PWA quick actions
│           ├── push-handler.ts          # Web Push handling
│           ├── offline-cache.ts         # offline read-only minimum
│           └── install-prompt.ts
│
├── 🔧 packages/
│   ├── core-contracts/
│   │   ├── src/
│   │   │   ├── index.ts             # public exports всего пакета
│   │   │   ├── common/
│   │   │   │   ├── index.ts
│   │   │   │   ├── ids.ts           # TenantId, UserId, BotId, SourceId, ConversationId (брендинг типов)
│   │   │   │   ├── pagination.ts    # PageRequest/PageResponse
│   │   │   │   ├── datetime.ts      # ISODateTime, DateRange
│   │   │   │   ├── money.ts         # Money, CurrencyCode (для биллинга)
│   │   │   │   ├── errors.ts        # ErrorCode + AppError shape (для API и UI)
│   │   │   │   ├── rateLimits.ts    # quota/rate limit shapes (для U13/A6)
│   │   │   │   └── audit.ts         # AuditActor, AuditMeta (для A7)
│   │   │   │
│   │   │   ├── access/              # U14 + A7
│   │   │   │   ├── index.ts
│   │   │   │   ├── roles.ts         # owner/admin/editor/viewer/support
│   │   │   │   ├── permissions.ts   # permission enums + matrices
│   │   │   │   ├── apiKeys.ts       # API key create/list/revoke DTO
│   │   │   │   ├── dto.ts
│   │   │   │   └── schemas.ts       # Zod schemas
│   │   │   │
│   │   │   ├── auth/                # U1
│   │   │   │   ├── index.ts
│   │   │   │   ├── dto.ts           # Register/Login/Token/Session
│   │   │   │   └── schemas.ts
│   │   │   │
│   │   │   ├── workspace/           # U1 + A1
│   │   │   │   ├── index.ts
│   │   │   │   ├── dto.ts           # CreateWorkspace, WorkspaceView, MemberInvite
│   │   │   │   └── schemas.ts
│   │   │   │
│   │   │   ├── bots/                # U3–U5
│   │   │   │   ├── index.ts
│   │   │   │   ├── bot.ts           # Bot, BotStatus, ChannelBinding summary
│   │   │   │   ├── templates.ts     # PersonaTemplate, TemplateCatalog
│   │   │   │   ├── instruction.ts   # Prompt blocks model (U5)
│   │   │   │   ├── dto.ts
│   │   │   │   └── schemas.ts
│   │   │   │
│   │   │   ├── ai/                  # U5.1 + execution contracts
│   │   │   │   ├── index.ts
│   │   │   │   ├── multiAgent.ts    # agent graph/switch rules/call rules
│   │   │   │   ├── actions.ts       # ActionDefinition, ActionRunRequest/Result (U9.1)
│   │   │   │   ├── inference.ts     # RunTurnRequest/Response, TokenUsage
│   │   │   │   └── schemas.ts
│   │   │   │
│   │   │   ├── knowledge/           # U6
│   │   │   │   ├── index.ts
│   │   │   │   ├── sources.ts       # SourceType: url/file/sheets/image/qa + settings
│   │   │   │   ├── ingestion.ts     # IngestionJob, statuses, errors
│   │   │   │   ├── chunks.ts        # Chunk metadata + citations
│   │   │   │   ├── indexVersions.ts # versioning for reindex (Specs 4.3)
│   │   │   │   ├── quality.ts       # QualityReport, not-found queries, examples
│   │   │   │   ├── dto.ts
│   │   │   │   └── schemas.ts
│   │   │   │
│   │   │   ├── integrations/        # U7–U9
│   │   │   │   ├── index.ts
│   │   │   │   ├── connectors.ts    # ConnectorType, capabilities, status model
│   │   │   │   ├── oauth.ts         # OAuthState, tokens (where applicable)
│   │   │   │   ├── webhooks.ts      # WebhookContract, retries, idempotency keys (Specs 4.2)
│   │   │   │   ├── mappings.ts      # field mappings (CRM/helpdesk/booking)
│   │   │   │   ├── dto.ts
│   │   │   │   └── schemas.ts
│   │   │   │
│   │   │   ├── conversations/       # U10–U11
│   │   │   │   ├── index.ts
│   │   │   │   ├── conversation.ts  # Conversation, Session, tags
│   │   │   │   ├── messages.ts      # Message, attachments, sources (RAG cites)
│   │   │   │   ├── handoff.ts       # HandoffRequest/Status (U5/U11)
│   │   │   │   ├── feedback.ts      # thumbs up/down + comment (U11)
│   │   │   │   ├── dto.ts
│   │   │   │   └── schemas.ts
│   │   │   │
│   │   │   ├── notifications/       # U12–U12.1
│   │   │   │   ├── index.ts
│   │   │   │   ├── templates.ts     # template model + variables
│   │   │   │   ├── triggers.ts      # follow-up triggers, broadcast schedule
│   │   │   │   ├── delivery.ts      # delivery status + provider codes
│   │   │   │   ├── dto.ts
│   │   │   │   └── schemas.ts
│   │   │   │
│   │   │   ├── billing/             # U2/U13 + A3/A4
│   │   │   │   ├── index.ts
│   │   │   │   ├── plans.ts         # тарифы/лимиты/пакеты
│   │   │   │   ├── usage.ts         # usage events model + aggregation windows
│   │   │   │   ├── invoices.ts      # invoice/act DTO
│   │   │   │   ├── payments.ts      # payment status (WebPay/bePaid/ЕРИП)
│   │   │   │   ├── quotas.ts        # token/dialog quotas + alerts
│   │   │   │   ├── dto.ts
│   │   │   │   └── schemas.ts
│   │   │   │
│   │   │   ├── analytics/           # U11.1 + A6
│   │   │   │   ├── index.ts
│   │   │   │   ├── metrics.ts       # metrics schema (dialogs, latency, tokens)
│   │   │   │   ├── dashboards.ts    # dashboard view models
│   │   │   │   ├── exports.ts       # export request DTO
│   │   │   │   └── schemas.ts
│   │   │   │
│   │   │   ├── admin/               # A1–A8 (глобальные модели админки)
│   │   │   │   ├── index.ts
│   │   │   │   ├── tenants.ts
│   │   │   │   ├── connectorCatalog.ts
│   │   │   │   ├── incidents.ts         # incident model (A6)
│   │   │   │   ├── securityPolicies.ts  # A7
│   │   │   │   └── schemas.ts
│   │   │   │
│   │   │   └── docgen/              # U15–U16 (из Specs 4.4)
│   │   │       ├── index.ts
│   │   │       ├── documents.ts     # DocumentTemplate, DocumentJob, versions
│   │   │       ├── proposals.ts     # КП: inputs/outputs
│   │   │       └── schemas.ts
│   │   ├── validation/
│   │   │   ├── README.md            # правила: Zod-only, naming, versioning
│   │   │   └── zod/
│   │   │       └── index.ts         # re-export helpers/guards
│   │   ├── tests/
│   │   │   ├── schemas.spec.ts      # быстрые тесты на валидацию DTO
│   │   │   └── compatibility.spec.ts    # “не ломаем контракты” (публичные поля)
│   │   ├── docs/
│   │   ├── targets
│   │   ├── .gitignore
│   │   ├── package.json
│   │   ├── README.md
│   │   ├── tsconfig.build.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── vitest.config.ts
│   │   └── vitest.setup.ts
│   ├── core/
│   │   └── src/
│   ├── observability/
│   │   └── src/
│   ├── ui-tokens/
│   │   └── src/
│   └── events/
│       ├── index.ts
│       ├── README.md
│       ├── schemas/
│       │   ├── envelope.v1.json       # общий envelope: eventId, occurredAt, tenantId, correlationId, type, version, payload
│       │   └── v1/
│       │       ├── auth.user_registered.json
│       │       ├── workspace.created.json
│       │       ├── bots.bot_created.json
│       │       ├── bots.bot_published.json
│       │       ├── knowledge.source_created.json
│       │       ├── knowledge.ingestion_requested.json
│       │       ├── knowledge.ingestion_completed.json
│       │       ├── integrations.connector_connected.json
│       │       ├── integrations.webhook_received.json
│       │       ├── conversations.message_received.json
│       │       ├── conversations.handoff_requested.json
│       │       ├── billing.usage_recorded.json
│       │       ├── billing.payment_succeeded.json
│       │       ├── billing.payment_failed.json
│       │       ├── notifications.send_requested.json
│       │       └── analytics.metric_ingested.json
│       │
│       ├── utils/
│       │   ├── eventTypes.ts           # string literals / enum
│       │   ├── envelope.ts             # TS типы envelope + builders
│       │   ├── serializer.ts           # json encode/decode + validation against schema
│       │   ├── versioning.ts           # schema version routing
│       │   └── idempotency.ts          # idempotencyKey helpers (Specs 4.2)
│       │
│       └── adapters/
│           ├── redis-streams/
│           │   ├── publisher.ts
│           │   ├── consumer.ts
│           │   ├── dlq.ts
│           │   └── retryPolicy.ts      # backoff/jitter/circuit breaker hooks
│           └── kafka/
│               ├── publisher.ts
│               ├── consumer.ts
│               └── dlq.ts
│
├── platform-tests/                        
│   ├── README.md                         # как запускать pact/smoke/chaos + env requirements
│   ├── pact/                             # contract tests (apps ↔ gateway/service)
│   │   ├── README.md
│   │   ├── pacts/
│   │   │   ├── web-api-gateway.pact.ts           # apps/web ↔ api-gateway
│   │   │   ├── admin-admin-service.pact.ts       # apps/admin ↔ admin-service
│   │   │   ├── bots-bots-service.pact.ts         # apps/bots UI ↔ bots-service
│   │   │   ├── knowledge-knowledge-service.pact.ts
│   │   │   ├── billing-billing-service.pact.ts
│   │   │   └── integrations-integrations-service.pact.ts
│   │   ├── providers/
│   │   │   ├── verify_api_gateway.ts
│   │   │   ├── verify_auth_service.ts
│   │   │   └── verify_billing_service.ts
│   │   └── config/
│   │       ├── pact.config.ts
│   │       └── publish.ts
│   ├── smoke/                            # e2e happy-path сценарии (U*)
│   │   ├── README.md
│   │   ├── scenarios/
│   │   │   ├── u1_register_and_workspace.spec.ts        # U1
│   │   │   ├── u2_choose_plan_and_pay.spec.ts           # U2
│   │   │   ├── u3_create_bot_from_template.spec.ts      # U3
│   │   │   ├── u5_update_prompt_and_rules.spec.ts       # U5
│   │   │   ├── u6_add_knowledge_source_and_index.spec.ts# U6
│   │   │   ├── u7_connect_channel.spec.ts               # U7
│   │   │   ├── u9_webhook_ingress_and_dlq.spec.ts       # U9
│   │   │   ├── u10_test_chat_publish.spec.ts            # U10
│   │   │   ├── u11_dialogs_feedback_handoff.spec.ts     # U11
│   │   │   ├── u12_followup_trigger.spec.ts             # U12
│   │   │   ├── u13_limits_usage_alerts.spec.ts          # U13
│   │   │   └── u14_invite_member_and_keys.spec.ts       # U14
│   │   ├── fixtures/
│   │   ├── helpers/{auth.ts,seed.ts,wait.ts}
│   │   └── reports/
│   └── chaos/                            # resilience tests (A6, Specs 4.2)
│       ├── README.md
│       ├── experiments/
│       │   ├── webhooks_retry_and_dedupe.spec.ts        # idempotency/retry
│       │   ├── dlq_replay.spec.ts                       # DLQ replay (A6/A8)
│       │   ├── connector_rate_limit.spec.ts             # rate limits / CB
│       │   ├── vector_db_unavailable.spec.ts            # fallback behavior
│       │   └── storage_outage.spec.ts                   # object storage outage
│       └── tooling/
│           ├── fault_injector.ts
│           └── chaos.config.ts
│
├── 🔌 adapters/                           
│   ├── 🗄️ database/                       
│   │   ├── README.md
│   │   ├── migrations/                        # Alembic migrations (PostgreSQL)
│   │   │   ├── alembic.ini
│   │   │   ├── env.py
│   │   │   ├── script.py.mako
│   │   │   └── versions/
│   │   ├── models/                            # SQLAlchemy 2.0 models (shared base)
│   │   │   ├── __init__.py
│   │   │   ├── base.py                         # DeclarativeBase + naming conventions
│   │   │   ├── mixins.py                       # timestamps, tenant_id, soft delete
│   │   │   ├── user.py
│   │   │   ├── workspace.py
│   │   │   ├── bot.py
│   │   │   ├── knowledge_source.py
│   │   │   ├── integration_connection.py
│   │   │   ├── billing_plan.py
│   │   │   └── audit_log.py                    # A7 audit
│   │   ├── connection/
│   │   │   ├── settings.py                     # DSN, pool size, timeouts
│   │   │   ├── postgres.py                     # async engine/session
│   │   │   ├── redis.py                        # Redis client (cache/locks/dedupe)
│   │   │   ├── clickhouse.py                   # ClickHouse client (analytics)
│   │   │   ├── health.py                       # readiness checks
│   │   │   └── errors.py
│   │   ├── repositories/                       # generic repository implementations
│   │   │   ├── __init__.py
│   │   │   ├── users_repo.py
│   │   │   ├── workspaces_repo.py
│   │   │   ├── bots_repo.py
│   │   │   ├── knowledge_repo.py
│   │   │   ├── integrations_repo.py
│   │   │   └── billing_repo.py
│   │   ├── outbox/                             # outbox pattern for reliable events (Specs 4.2)
│   │   │   ├── model.py                        # outbox table model
│   │   │   ├── publisher.py                    # poll + publish to queue
│   │   │   ├── dispatcher.py
│   │   │   └── cleanup.py
│   │   ├── idempotency/                        # idempotency store (webhooks/actions)
│   │   │   ├── model.py
│   │   │   ├── store.py
│   │   │   └── cleanup.py
│   │   ├── seed/
│   │   │   ├── seed_dev.py                     # dev seed (templates, тарифы)
│   │   │   └── fixtures/
│   └── tests/
│   ├── 📦 storage/                        
│   │   ├── README.md
│   │   ├── client/
│   │   │   ├── __init__.py
│   │   │   ├── s3_client.py        # boto3 client wrapper (Yandex Object Storage/MinIO/R2)
│   │   │   ├── settings.py
│   │   │   └── errors.py
│   │   ├── upload/
│   │   │   ├── upload_file.py      # multipart upload + content-type validation
│   │   │   ├── upload_bytes.py
│   │   │   └── antivirus_scan.py   # (опционально) перед сохранением
│   │   ├── download/
│   │   │   ├── download_file.py
│   │   │   └── stream.py
│   │   ├── presign/
│   │   │   ├── generate_put_url.py
│   │   │   └── generate_get_url.py
│   │   ├── lifecycle/
│   │   │   ├── retention_policy.py # Specs 4.3: retention/удаление
│   │   │   └── purge_job.py
│   │   └── tests/
│   ├── 🧠 vector-db/                      
│   │   ├── README.md
│   │   ├── client/
│   │   │   ├── qdrant_client.py    # managed Qdrant (prod)
│   │   │   ├── chroma_client.py    # local dev
│   │   │   ├── pinecone_client.py  # fallback
│   │   │   ├── weaviate_client.py  # fallback
│   │   │   ├── settings.py
│   │   │   └── errors.py
│   │   ├── collections/
│   │   │   ├── knowledge_chunks.py # коллекция чанков БЗ
│   │   │   ├── conversations_memory.py  # (опц.) short-term memory
│   │   │   └── migrations.py       # создание/обновление схем коллекций
│   │   ├── search/
│   │   │   ├── similarity.py       # kNN search
│   │   │   ├── filters.py          # tenant/source/bot filters
│   │   │   ├── rerank.py           # (опц.) rerank stage
│   │   │   └── cache.py            # retrieval cache (Specs 4.3 cost control)
│   │   ├── embeddings/
│   │   │   ├── models.py           # embedding model ids
│   │   │   └── normalize.py
│   │   └── tests/
│   ├── 📨 queue/                          
│   │   ├── README.md
│   │   ├── publisher/
│   │   │   ├── publish.py          # publish(event) with tracing
│   │   │   └── outbox.py           # outbox pattern (DB→queue) для надёжности
│   │   ├── consumer/
│   │   │   ├── worker.py           # generic worker loop
│   │   │   ├── handlers_registry.py  # map eventType→handler
│   │   │   ├── ack.py
│   │   │   └── metrics.py
│   │   ├── dead-letter/
│   │   │   ├── dlq_writer.py       # Specs 4.2: DLQ запись
│   │   │   ├── dlq_reader.py       # UI/admin разбор
│   │   │   └── retry_from_dlq.py   # кнопка “retry” (A6/A8)
│   │   ├── reliability/
│   │   │   ├── idempotency.py      # Specs 4.2: idempotency key + dedupe window
│   │   │   ├── dedupe_store.py     # Redis-based dedupe store
│   │   │   ├── backoff.py          # retry with jitter/cap
│   │   │   ├── rate_limit.py       # per-tenant throttling
│   │   │   └── circuit_breaker.py  # connector isolation
│   │   └── tests/
│   ├── 📧 notifications/                  
│   │   ├── README.md
│   │   ├── templates/                         # U12–U12.1: transactional + marketing
│   │   │   ├── transactional/
│   │   │   │   ├── email/
│   │   │   │   │   ├── confirm_payment.mjml
│   │   │   │   │   ├── reset_password.mjml
│   │   │   │   │   └── invite_member.mjml
│   │   │   │   ├── sms/
│   │   │   │   │   ├── otp.txt
│   │   │   │   │   └── payment_status.txt
│   │   │   │   └── push/
│   │   │   │       ├── limit_warning.json
│   │   │   │       └── handoff_alert.json
│   │   │   └── marketing/
│   │   │       ├── email/
│   │   │       │   ├── campaign_default.mjml
│   │   │       │   └── newsletter_default.mjml
│   │   │       └── push/
│   │   │           └── campaign_default.json
│   │   ├── smtp/
│   │   │   ├── smtp_client.py                 # SMTP provider (transactional)
│   │   │   ├── settings.py
│   │   │   └── errors.py
│   │   ├── sms/
│   │   │   ├── provider_registry.py           # pluggable providers
│   │   │   ├── settings.py
│   │   │   └── errors.py
│   │   ├── push/
│   │   │   ├── fcm_client.py                  # FCM/WebPush (Specs: PWA push)
│   │   │   ├── webpush.py
│   │   │   ├── settings.py
│   │   │   └── errors.py
│   │   ├── routing/
│   │   │   ├── dispatcher.py                  # choose channel: sms/email/push
│   │   │   ├── dedupe.py                      # avoid duplicates (U12.1 edge cases)
│   │   │   └── rate_limit.py
│   │   └── tests/
│   └── 🔍 search/                         
│       ├── README.md
│       ├── client/
│       │   ├── meilisearch_client.py          # fast search (FAQ/knowledge index)
│       │   ├── elastic_client.py              # optional heavy search
│       │   ├── settings.py
│       │   └── errors.py
│       ├── indexing/
│       │   ├── index_knowledge.py             # index sources/chunks metadata
│       │   ├── index_conversations.py         # index conversation threads/tags
│       │   ├── mappings.py
│       │   └── jobs.py                        # background reindex
│       ├── query/
│       │   ├── search_knowledge.py
│       │   ├── search_conversations.py
│       │   ├── filters.py
│       │   └── ranking.py
│       └── tests/
│
├── 🏭 infrastructure/                     
│   ├── ☸️ kubernetes/
│   │   ├── README.md
│   │   ├── base/
│   │   │   ├── namespaces/
│   │   │   │   ├── livai.yaml
│   │   │   │   └── livai-observability.yaml
│   │   │   ├── configmaps/
│   │   │   │   ├── app-config.yaml            # non-secret config
│   │   │   │   └── feature-flags.yaml
│   │   │   ├── secrets/                       # templates only (real secrets via sealed-secrets/ExternalSecrets)
│   │   │   │   └── secrets.template.yaml
│   │   │   ├── services/
│   │   │   │   ├── api-gateway.yaml
│   │   │   │   ├── auth-service.yaml
│   │   │   │   ├── bots-service.yaml
│   │   │   │   ├── ai-service.yaml
│   │   │   │   ├── knowledge-service.yaml
│   │   │   │   ├── integrations-service.yaml
│   │   │   │   ├── conversations-service.yaml
│   │   │   │   ├── billing-service.yaml
│   │   │   │   ├── notifications-service.yaml
│   │   │   │   └── admin-service.yaml
│   │   │   ├── deployments/
│   │   │   │   ├── api-gateway.yaml
│   │   │   │   ├── auth-service.yaml
│   │   │   │   ├── bots-service.yaml
│   │   │   │   ├── ai-service.yaml
│   │   │   │   ├── knowledge-service.yaml
│   │   │   │   ├── integrations-service.yaml
│   │   │   │   ├── conversations-service.yaml
│   │   │   │   ├── billing-service.yaml
│   │   │   │   ├── notifications-service.yaml
│   │   │   │   └── admin-service.yaml
│   │   │   ├── jobs/
│   │   │   │   ├── migrate-auth-service.yaml
│   │   │   │   ├── migrate-billing-service.yaml
│   │   │   │   └── seed-dev.yaml
│   │   │   ├── ingress/
│   │   │   │   ├── ingress.yaml               # routes for webhooks/api
│   │   │   │   └── tls.yaml
│   │   │   ├── hpa/
│   │   │   │   ├── api-gateway.yaml
│   │   │   │   └── ai-service.yaml
│   │   │   ├── pdb/
│   │   │   │   └── api-gateway.yaml
│   │   │   └── kustomization.yaml
│   │   ├── overlays/
│   │   │   ├── dev/
│   │   │   │   ├── kustomization.yaml
│   │   │   │   ├── patches/
│   │   │   │   │   ├── replicas.yaml
│   │   │   │   │   ├── resources.yaml
│   │   │   │   │   └── env.yaml
│   │   │   │   └── values/
│   │   │   ├── stage/
│   │   │   │   ├── kustomization.yaml
│   │   │   │   └── patches/
│   │   │   └── prod/
│   │   │       ├── kustomization.yaml
│   │   │       └── patches/
│   │   └── policies/
│   │       ├── pod-security.yaml
│   │       ├── network-policies.yaml          # tenant isolation at network level
│   │       ├── opa-gatekeeper/
│   │       │   ├── constraints/
│   │       │   └── templates/
│   │       └── rate-limits.yaml               # ingress/gateway limits
│   ├── 🐳 docker/
│   │   ├── services/
│   │   ├── compose/
│   │   └── registries/
│   ├── 🚀 ci-cd/
│   │   ├── github-actions/
│   │   ├── gitlab-ci/
│   │   └── scripts/
│   ├── 📊 monitoring/
│   │   ├── README.md
│   │   ├── dashboards/
│   │   │   ├── api-gateway.json
│   │   │   ├── auth-service.json
│   │   │   ├── bots-service.json
│   │   │   ├── ai-service.json
│   │   │   ├── knowledge-service.json
│   │   │   ├── integrations-service.json
│   │   │   ├── conversations-service.json
│   │   │   ├── billing-service.json
│   │   │   ├── notifications-service.json
│   │   │   └── admin-service.json
│   │   ├── alerts/
│   │   │   ├── slo_latency.yaml                # p95/p99 latency (U10)
│   │   │   ├── error_budget.yaml               # burn rate
│   │   │   ├── billing_failures.yaml           # U2/U13 critical
│   │   │   ├── webhook_backlog.yaml            # U9 reliability
│   │   │   ├── dlq_growth.yaml                 # Specs 4.2
│   │   │   └── rag_quality.yaml                # U6 quality regressions
│   │   ├── slo/
│   │   │   ├── slo.md                          # definitions + targets
│   │   │   ├── service_slo.yaml
│   │   │   └── customer_journeys_slo.yaml       # U1/U3/U6/U7/U13
│   │   └── runbooks/
│   │       ├── incident_webhooks.md            # A6: webhook failures, retries, DLQ
│   │       ├── incident_payments.md            # A6: billing provider issues
│   │       ├── incident_rag_indexing.md        # A6: ingestion/index issues
│   │       ├── incident_vector_db.md
│   │       └── incident_storage.md
│   ├── 🔐 security/
│   │   ├── README.md
│   │   ├── policies/
│   │   │   ├── tenant_isolation.md             # multi-tenant guarantees
│   │   │   ├── pii_redaction.md                # logs/traces masking (A7, Specs 4.6)
│   │   │   ├── auth_policies.md                # 2FA rules, session TTL
│   │   │   ├── ip_bans_rate_limits.md          # A7
│   │   │   └── secrets_handling.md             # encryption/rotation
│   │   ├── scanners/
│   │   │   ├── trivy/
│   │   │   │   ├── config.yaml
│   │   │   │   └── ignore.txt
│   │   │   └── gitleaks/
│   │   │       ├── config.toml
│   │   │       └── baseline.json
│   │   ├── secrets/
│   │   │   ├── sealed-secrets/
│   │   │   │   ├── README.md
│   │   │   │   └── templates/
│   │   │   └── rotation/
│   │   │       ├── rotate_connector_tokens.md
│   │   │       └── rotate_jwt_keys.md
│   │   └── compliance/
│   │       ├── rb_personal_data_law.md         # №99-З mapping
│   │       └── retention_and_delete.md         # delete/export requests
│   ├── 🌐 networking/
│   │   ├── istio/
│   │   ├── nginx/
│   │   └── traefik/
│   ├── 🏗️ terraform/
│   │   ├── README.md
│   │   ├── modules/
│   │   │   ├── network/                       # VPC/subnets/NAT
│   │   │   ├── postgres/                      # Managed PostgreSQL
│   │   │   ├── redis/                         # Managed Redis
│   │   │   ├── clickhouse/                    # Managed ClickHouse
│   │   │   ├── object-storage/                # Yandex Object Storage buckets
│   │   │   ├── container-registry/            # registry + IAM
│   │   │   ├── k8s/                    # Managed Kubernetes cluster/node groups
│   │   │   ├── monitoring/             # YC monitoring bindings / alerting (optional)
│   │   │   └── dns-tls/                       # certificates/DNS (optional)
│   │   └── environments/
│   │       ├── dev/
│   │       │   ├── main.tf
│   │       │   ├── variables.tf
│   │       │   ├── outputs.tf
│   │       │   ├── terraform.tfvars.example
│   │       │   └── backend.tf
│   │       ├── stage/
│   │       │   ├── main.tf
│   │       │   ├── variables.tf
│   │       │   ├── outputs.tf
│   │       │   ├── terraform.tfvars.example
│   │       │   └── backend.tf
│   │       └── prod/
│   │           ├── main.tf
│   │           ├── variables.tf
│   │           ├── outputs.tf
│   │           ├── terraform.tfvars.example
│   │           └── backend.tf
│   └── 📝 ansible/
│       ├── README.md
│       ├── playbooks/
│       │   ├── bootstrap.yml              # базовая подготовка (ops runners/bastion)
│       │   ├── deploy.yml                     # (опц.) k8s apply wrappers
│       │   ├── rotate-secrets.yml             # ключи/токены (A7)
│       │   └── maintenance.yml                # cleanup/log rotate
│       └── roles/
│           ├── bastion/
│           ├── runner/
│           └── monitoring-agent/
│
├── ⚙️ config/
│   ├── env/
│   │   ├── .env.example
│   │   ├── .env.example.updated
│   │   ├── .env.dev
│   │   ├── .env.test
│   │   └── service-overrides/
│   ├── eslint/
│   │   ├── modes/
│   │   │   ├── canary.config.mjs
│   │   │   └── dev.config.mjs
│   │   ├── rules/
│   │   │   ├── architectural-boundaries.mjs
│   │   │   ├── integration-tests.rules.mjs
│   │   │   └── naming-conventions.mjs
│   │   ├── shared/
│   │   │   ├── rules.mjs
│   │   │   └── tez.config.mjs
│   │   ├── test/
│   │   │   ├── boundaries-generation.js
│   │   │   ├── check-zones.js
│   │   │   └── run-all-tests.js
│   │   ├── utils/
│   │   │   ├── check-zones.mjs
│   │   │   └── validate-zones.mjs
│   │   ├── .gitignore
│   │   ├── constants.mjs
│   │   ├── master.config.mjs
│   │   ├── README.md
│   │   └── test-context.js
│   ├── husky/
│   │   ├── _/
│   │   ├── commit-msg
│   │   ├── pre-commit
│   │   ├── pre-push
│   │   └── README.md
│   ├── security/
│   │   ├── README.md
│   │   ├── gitleaks/
│   │   │   ├── config.toml                # правила поиска секретов (CI + pre-commit)
│   │   │   └── allowlist.toml
│   │   ├── trivy/
│   │   │   ├── config.yaml                # container/image scanning rules
│   │   │   └── ignore.txt
│   │   ├── semgrep/
│   │   │   └── rules.yml                  # (опц.) SAST rules
│   │   ├── dependency-check/
│   │   │   └── policy.xml                 # (опц.) SCA policy
│   │   └── scripts/
│   │       ├── scan-repo.sh
│   │       └── scan-images.sh
│   ├── tsconfig/
│   │   ├── base.json
│   │   ├── node.json
│   │   ├── README.md
│   │   ├── root.json
│   │   ├── strict.json
│   │   └── test-configs.json
│   ├── vitest/
│   │   ├── README.md
│   │   ├── test.setup.ts
│   │   ├── vite.config.ts
│   │   ├── vitest.ai.config.ts
│   │   ├── vitest.config.ts
│   │   └── vitest.shared.config.ts
│   └── python/
│       ├── README.md
│       ├── pyproject.template.toml      # базовый шаблон для сервисов на FastAPI
│       ├── ruff.toml                    # lint/format rules
│       ├── mypy.ini                     # typing rules
│       ├── pytest.ini                   # pytest defaults/markers
│       ├── logging.yaml                 # единый формат логов (json + PII redaction hooks)
│       ├── alembic.ini                  # template for services that own migrations
│       └── settings_example.py          # пример Settings (pydantic v2) + env mapping
│
├── tools/                                  
│   └── cli/
│       ├── README.md
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── commands/
│       │   │   ├── generate-service.ts         # scaffolding нового сервиса (FastAPI)
│       │   │   ├── generate-module.ts          # scaffolding доменного модуля (domain/use_cases/ports)
│       │   │   ├── generate-connector.ts       # integrations connector skeleton (U7–U9)
│       │   │   └── validate-structure.ts       # проверка консистентности дерева/нейминга
│       │   ├── templates/
│       │   │   ├── service/
│       │   │   │   ├── Dockerfile.hbs
│       │   │   │   ├── pyproject.toml.hbs
│       │   │   │   ├── README.md.hbs
│       │   │   │   ├── src/main.py.hbs
│       │   │   │   └── src/entrypoints/http/routes.py.hbs
│       │   │   ├── module/
│       │   │   │   ├── domain.hbs
│       │   │   │   ├── ports.hbs
│       │   │   │   ├── use_case.hbs
│       │   │   │   └── tests.hbs
│       │   │   └── connector/
│       │   │       ├── handler.hbs
│       │   │       ├── client.hbs
│       │   │       └── contract.hbs
│       │   ├── schemas/
│       │   │   ├── service.schema.json         # validate inputs for generator
│       │   │   ├── module.schema.json
│       │   │   └── connector.schema.json
│       │   └── utils/
│       │       ├── fs.ts
│       │       ├── naming.ts
│       │       └── prompts.ts
│       └── tests/
│           ├── generate-service.spec.ts
│           ├── generate-module.spec.ts
│           └── validate-structure.spec.ts
│
├── 📚 docs/                               
│   ├── api/
│   ├── architecture/
│   ├── deployment/
│   ├── team/
│   ├── analytics/
│   └── compliance/
│
├── 🛠️ scripts/
|   ├── 📄 analyze-bundles.js
|   ├── 📄 analyze-import-graph-metrics.js
|   ├── 📄 check-circular-deps-monorepo.js
|   ├── 📄 check-dependency-policy.js
|   ├── 📄 coverage-file.js
|   ├── build/
|   ├── deploy/
|   ├── test/
|   ├── analyze/
|   └── maintenance/
│
├── 📊 test-baseline/
│   └── bundles-summary.json
│
├── 📄 .gitignore
├── 📄 budgets.json
├── 📄 build-order.yml
├── 📄 coverage_clean.json
├── 📄 dependency-policy.json
├── 📄 dprint.json
├── 📄 eslint.config.mjs
├── 📄 LICENSE
├── 📄 package-lock.json
├── 📄 package.json
├── 📄 pnpm-lock.yaml
├── 📄 pnpm-workspace.yaml
├── 📄 tsconfig.json
└── 📄 turbo.json
```
