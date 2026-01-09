## Python-конфиги (единый стандарт для сервисов)

Эта папка хранит **общие настройки качества кода** для всех Python-сервисов в монорепо:

- `ruff.toml` — линт + форматирование
- `mypy.ini` — типизация
- `pytest.ini` — тесты

Также здесь лежат **шаблоны** для генерации новых Python-сервисов:

- `pyproject.template.toml`
- `settings_example.py`
- `logging.yaml`
- `alembic.ini`

> Важно: `requirements.txt`, `requirements-dev.txt` и `env.example` **оставляем в корне репозитория**.
> Это удобнее для онбординга (одна команда установки зависимостей и один шаблон окружения).

### Как использовать локально

```bash
cd /home/boss/Projects/livai
source .venv/bin/activate
pip install -r requirements-dev.txt

ruff check --config config/python/ruff.toml services/
ruff format --config config/python/ruff.toml services/

mypy --config-file config/python/mypy.ini services/

pytest -c config/python/pytest.ini
```
