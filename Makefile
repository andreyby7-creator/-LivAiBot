lint:
	venv/bin/ruff check . --exclude "get-pip.py,tools/vendor/,services/**/get-pip.py,venv/,services/**/venv/,**/__pycache__/"
	venv/bin/ruff format --check . --exclude "get-pip.py,tools/vendor/,services/**/get-pip.py,venv/,services/**/venv/,**/__pycache__/"

types:
	bash /home/boss/Projects/livai/scripts/backend_check.sh

test:
	bash /home/boss/Projects/livai/scripts/backend_check.sh

test-cov:
	bash /home/boss/Projects/livai/scripts/backend_check.sh

security:
	venv/bin/bandit -r services/ -x "*/tests/*"

# Individual service commands
lint-auth:
	cd services/auth-service && /home/boss/Projects/livai/venv/bin/ruff check .
	cd services/auth-service && /home/boss/Projects/livai/venv/bin/ruff format --check .

types-auth:
	cd services/auth-service && /home/boss/Projects/livai/venv/bin/mypy .

migrate-auth:
	cd services/auth-service && make migrate

test-auth:
	cd services/auth-service && make test

lint-api:
	cd services/api-gateway && /home/boss/Projects/livai/venv/bin/ruff check .
	cd services/api-gateway && /home/boss/Projects/livai/venv/bin/ruff format --check .

types-api:
	cd services/api-gateway && /home/boss/Projects/livai/venv/bin/mypy .

migrate-api:
	cd services/api-gateway && make migrate

test-api:
	cd services/api-gateway && make test

lint-bots:
	cd services/bots-service && make lint

types-bots:
	cd services/bots-service && make type

migrate-bots:
	cd services/bots-service && make migrate

test-bots:
	cd services/bots-service && make test

lint-conversations:
	cd services/conversations-service && make lint

types-conversations:
	cd services/conversations-service && make type

migrate-conversations:
	cd services/conversations-service && make migrate

test-conversations:
	cd services/conversations-service && make test

# Global quality check - run quality for all services
quality:
	cd services/auth-service && make quality
	cd services/bots-service && make quality
	cd services/conversations-service && make quality
	cd services/api-gateway && make quality

# Fast quality check - run quality for core services only (skip API Gateway)
quality-fast:
	cd services/auth-service && make quality
	cd services/bots-service && make quality
	cd services/conversations-service && make quality