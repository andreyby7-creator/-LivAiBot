## conversations-service (MVP)

Тест-чат (U10): хранение тредов/сообщений + запуск “turn” (пока stub/эхо).

### Контракты (важное)

- Tenant isolation: обязателен `X-Workspace-Id: <uuid>` (приходит из gateway).
- Идемпотентность turn: `X-Operation-Id: <uuid>` используется для дедупа (ретраи без дублей).

### Локальный запуск

```bash
cd services/conversations-service
make migrate
make run
```
