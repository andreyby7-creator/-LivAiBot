## auth-service (MVP)

Сервис аутентификации и мульти-тенантного контекста (workspace/tenant).

### Что умеет (MVP)

- Регистрация: создаёт workspace + пользователя
- Логин
- Профиль текущего пользователя (`/me`)
- Обновление access-токена по refresh-токену (`/refresh`)

### Контракты заголовков (фиксируем “один раз”)

- `X-Trace-Id`: корреляция запросов/логов между сервисами (генерируется gateway, если не пришёл).
- `X-Operation-Id`: строго уникальный идентификатор операции (генерируется gateway при отсутствии/невалидности).

### Локальный запуск (dev)

Из корня репозитория:

```bash
source .venv/bin/activate
cd services/auth-service
uvicorn src.main:app --reload --port 8001
```

### Миграции

Создание миграции (если нужно):

```bash
cd services/auth-service
alembic revision -m "init" --autogenerate
```

Применение:

```bash
cd services/auth-service
alembic upgrade head
```
