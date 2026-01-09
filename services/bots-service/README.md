## bots-service (MVP)

Сервис управления ботами (CRUD) и версиями конфигурации (`bot_versions`).

### Контракт tenant isolation

`workspace_id` обязателен и приходит из gateway в заголовке:

- `X-Workspace-Id: <uuid>`

В запросах/выборках всегда фильтруем по `workspace_id`.

### Локальный запуск (dev)

Из корня репозитория:

```bash
cd services/bots-service
make migrate
make run
```
