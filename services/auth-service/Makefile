.PHONY: help run lint format type test migrate

ROOT_DIR := $(abspath $(CURDIR)/../..)

PY ?= $(ROOT_DIR)/.venv/bin/python
PORT ?= 8001
HOST ?= 0.0.0.0

help:
	@echo "Команды:"
	@echo "  make run      - запустить auth-service (dev, autoreload)"
	@echo "  make migrate  - применить миграции Alembic (upgrade head)"
	@echo "  make lint     - ruff check"
	@echo "  make format   - ruff format"
	@echo "  make type     - mypy"
	@echo "  make test     - pytest"

run:
	@echo "Запуск: http://localhost:$(PORT)"
	$(PY) -m uvicorn auth_src.main:app --reload --host $(HOST) --port $(PORT)

migrate:
	$(PY) -m alembic -c alembic.ini upgrade head

lint:
	$(PY) -m ruff check --config $(ROOT_DIR)/config/python/ruff.toml auth_src

format:
	$(PY) -m ruff format --config $(ROOT_DIR)/config/python/ruff.toml auth_src

type:
	$(PY) -m mypy --config-file $(ROOT_DIR)/config/python/mypy.ini auth_src

test:
	$(PY) -m pytest -c $(ROOT_DIR)/config/python/pytest.ini tests

