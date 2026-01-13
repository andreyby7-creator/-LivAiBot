.PHONY: help run lint format type test quality

ROOT_DIR := $(abspath $(CURDIR)/../..)

PY ?= $(ROOT_DIR)/venv/bin/python
PORT ?= 8000
HOST ?= 0.0.0.0

help:
	@echo "Команды:"
	@echo "  make run     - запустить API Gateway (dev, autoreload)"
	@echo "  make lint    - ruff check"
	@echo "  make format  - ruff format"
	@echo "  make type    - mypy"
	@echo "  make test    - pytest"
	@echo "  make quality - запустить все проверки качества (lint + type + test)"

run:
	@echo "Запуск: http://localhost:$(PORT)"
	$(PY) -m uvicorn api_src.main:app --reload --host $(HOST) --port $(PORT)

lint:
	$(PY) -m ruff check --config $(ROOT_DIR)/config/python/ruff.toml api_src

format:
	$(PY) -m ruff format --config $(ROOT_DIR)/config/python/ruff.toml api_src

type:
	$(PY) -m mypy --config-file $(ROOT_DIR)/config/python/mypy.ini api_src

test:
	$(PY) -m pytest -c $(ROOT_DIR)/config/pytest/pytest.ini tests

quality: lint type test
