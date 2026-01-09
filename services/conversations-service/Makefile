.PHONY: help run lint format type test migrate

ROOT_DIR := $(abspath $(CURDIR)/../..)

PY ?= $(ROOT_DIR)/.venv/bin/python
PORT ?= 8003
HOST ?= 0.0.0.0

help:
	@echo "Команды:"
	@echo "  make run      - запустить conversations-service (dev, autoreload)"
	@echo "  make migrate  - применить миграции Alembic (upgrade head)"
	@echo "  make lint     - ruff check"
	@echo "  make format   - ruff format"
	@echo "  make type     - mypy"
	@echo "  make test     - pytest"

run:
	@echo "Запуск: http://localhost:$(PORT)"
	$(PY) -m uvicorn src.main:app --reload --host $(HOST) --port $(PORT)

migrate:
	$(PY) -m alembic -c alembic.ini upgrade head

lint:
	$(PY) -m ruff check --config $(ROOT_DIR)/config/python/ruff.toml src

format:
	$(PY) -m ruff format --config $(ROOT_DIR)/config/python/ruff.toml src

type:
	$(PY) -m mypy --config-file $(ROOT_DIR)/config/python/mypy.ini src

test:
	$(PY) -m pytest -c $(ROOT_DIR)/config/python/pytest.ini tests

