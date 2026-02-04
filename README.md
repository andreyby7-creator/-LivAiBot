## LivAi (монорепо)

### Быстрый старт (локальная разработка)

#### 1) Python окружение

```bash
cd /home/boss/Projects/livai

# Включаем venv
source .venv/bin/activate

# Runtime зависимости
pip install -r requirements.txt

# Dev зависимости (линтер/типизация/тесты)
pip install -r requirements-dev.txt
```

#### 2) Переменные окружения

```bash
cd /home/boss/Projects/livai
cp env.example .env
```

#### 3) Инфраструктура (Docker Compose)

```bash
cd /home/boss/Projects/livai
docker compose -f infrastructure/compose/docker-compose.yml up -d
```

Что поднимается:

- Postgres: `localhost:5432`
- Redis: `localhost:6379`
- ClickHouse HTTP: `localhost:8123` (native на хосте: `localhost:9002`)
- MinIO: `localhost:9000` (S3), `localhost:9001` (консоль)
- Qdrant: `localhost:6333`

> В `docker-compose.yml` есть **init job'ы**: создают базу ClickHouse и bucket'ы MinIO, а также коллекцию Qdrant (идемпотентно).

#### 4) Проверка инфраструктуры

```bash
cd /home/boss/Projects/livai
source .venv/bin/activate
python scripts/infra_check.py
```

Должно вывести: `All infra checks passed.`

### API Gateway (каркас)

```bash
cd /home/boss/Projects/livai/services/api-gateway
make lint
make type
make test
make run
```

Проверки:

- `GET http://localhost:8000/healthz`
- `GET http://localhost:8000/readyz`

### Единые Python-конфиги

Общие настройки линта/типизации/тестов лежат в `config/python/`.
См. `config/python/README.md`.

### Технологический стек

#### Frontend

- **Node.js** + **Next.js** + **TypeScript** + **React** - основной стек
- **Tailwind CSS** - стилизация
- **next-intl** - интернационализация
- **Webpack** - бандлер

#### Backend

- **Python** - основной язык
- **FastAPI** - веб-фреймворк для API Gateway
- **PostgreSQL** - основная база данных
- **Redis** - кеширование и сессии
- **ClickHouse** - аналитика и метрики
- **MinIO** - объектное хранилище (S3-совместимое)
- **Qdrant** - векторная база данных

#### Архитектура

- **Микросервисы** - разделение на независимые сервисы
- **Монопакеты** - разделение frontend кода на пакеты
- **Docker Compose** - локальная инфраструктура

### Технические решения

#### Webpack вместо Turbopack

Используем Webpack вместо Turbopack, потому что проект TS-first и использует runtime-совместимые .js import specifiers для .ts/.tsx файлов.
Turbopack на текущий момент требует точных расширений и не поддерживает такой паттерн без массового рефакторинга.

#### next-intl для internationalization

Используем next-intl вместо встроенных решений Next.js, чтобы обеспечить поддержку многоязычного интерфейса с серверным рендерингом.

# CI trigger

# ESLint CI fix test
