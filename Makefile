lint:
	ruff check . --exclude "get-pip.py,tools/vendor/,services/**/get-pip.py,venv/,services/**/venv/,**/__pycache__/"
	ruff format --check . --exclude "get-pip.py,tools/vendor/,services/**/get-pip.py,venv/,services/**/venv/,**/__pycache__/"

types:
	mypy .

test:
	pytest

test-cov:
	pytest --cov --cov-report=term-missing

security:
	bandit -r .

# Individual service commands
lint-auth:
	cd services/auth-service && ruff check .
	cd services/auth-service && ruff format --check .

types-auth:
	cd services/auth-service && mypy .

test-auth:
	cd services/auth-service && pytest

lint-api:
	cd services/api-gateway && ruff check .
	cd services/api-gateway && ruff format --check .

types-api:
	cd services/api-gateway && mypy .

test-api:
	cd services/api-gateway && pytest

lint-bots:
	cd services/bots-service && ruff check .
	cd services/bots-service && ruff format --check .

types-bots:
	cd services/bots-service && mypy .

test-bots:
	cd services/bots-service && pytest

lint-conversations:
	cd services/conversations-service && ruff check .
	cd services/conversations-service && ruff format --check .

types-conversations:
	cd services/conversations-service && mypy .

test-conversations:
	cd services/conversations-service && pytest

# Global quality check (lint only, since types/test require per-service setup)
quality:
	make lint