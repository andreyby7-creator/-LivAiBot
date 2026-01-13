"""
Глобальная конфигурация pytest для LivAi Python сервисов.

Обеспечивает:
- Фикстуры для тестирования с БД
- Конфигурацию для AI интеграционных тестов
- Моки для внешних зависимостей
- Учет стоимости AI вызовов
"""

import os
from typing import Any, AsyncGenerator, Callable, Dict, Generator, cast

import pytest

# Типы для фикстур
AICounter = Dict[str, Callable[[], Any]]
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# =============================================================================
# КОНСТАНТЫ ДЛЯ AI ТЕСТИРОВАНИЯ
# =============================================================================

AI_PROVIDERS = {
    "openai": {"rate": 0.002, "required": True},
    "anthropic": {"rate": 0.032, "required": True},
    "google_ai": {"rate": 0.0005, "required": True},
    "grok": {"rate": 0.003, "required": False},
}

# Максимальный бюджет на AI тесты в CI ($)
AI_BUDGET_CI = 2.0
# Максимальный бюджет на AI тесты в dev ($)
AI_BUDGET_DEV = 0.5

# =============================================================================
# СЧЕТЧИК AI ВЫЗОВОВ
# =============================================================================

# Глобальный объект для хранения AI статистики между сессиями
_ai_stats = {
    "count": 0,
    "cost": 0.0,
    "total_time": 0.0,
    "providers": {}  # type: ignore
}


@pytest.fixture(scope="session")
def ai_call_counter() -> Generator[Dict[str, Any], None, None]:
    """Фикстура для учета AI вызовов."""
    # Локальные переменные для этой сессии
    count = 0
    cost = 0.0

    def record(provider: str, tokens: int, duration: float = 0.0):
        nonlocal count, cost
        count += 1
        rate = AI_PROVIDERS.get(provider, {}).get("rate", 0.001)
        cost_increment = (tokens / 1000) * rate
        cost += cost_increment

        # Обновляем глобальную статистику
        _ai_stats["count"] = count
        _ai_stats["cost"] = cost
        _ai_stats["total_time"] += duration

        # Статистика по провайдерам
        if provider not in _ai_stats["providers"]:
            _ai_stats["providers"][provider] = {"count": 0, "cost": 0.0, "time": 0.0}
        _ai_stats["providers"][provider]["count"] += 1
        _ai_stats["providers"][provider]["cost"] += cost_increment
        _ai_stats["providers"][provider]["time"] += duration

        # Проверка бюджета
        budget = AI_BUDGET_CI if os.getenv("CI") else AI_BUDGET_DEV
        if cost > budget:
            pytest.fail(
                f"AI budget exceeded: ${cost:.2f} > ${budget:.2f} "
                f"({provider}: {tokens} tokens)"
            )

    yield {
        "count": lambda: count,
        "cost": lambda: cost,
        "record": record,
    }

    # Отчет после всех тестов
    if count > 0:
        print(f"\n🤖 AI Calls: {count}, Cost: ${cost:.2f}")


# =============================================================================
# ФИКСТУРЫ ДЛЯ БАЗЫ ДАННЫХ
# =============================================================================

@pytest.fixture(scope="session")
async def db_engine() -> AsyncGenerator[Any, None]:
    """Создание движка базы данных для тестирования."""
    # Используем тестовую БД
    database_url = os.getenv(
        "TEST_DATABASE_URL",
        "postgresql+asyncpg://test:test@localhost:5432/test_db"
    )

    engine = create_async_engine(database_url, echo=False)

    yield engine

    await engine.dispose()


@pytest.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Фикстура для сессии базы данных с автоматическим rollback и savepoint."""
    AsyncSessionLocal = sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async with cast(AsyncSession, AsyncSessionLocal()) as session:
        # Начинаем транзакцию
        async with session.begin():
            # Создаем savepoint для дополнительной изоляции
            savepoint = await session.begin_nested()
            try:
                yield session
            finally:
                # Откатываем к savepoint, затем основной rollback
                await savepoint.rollback()
                await session.rollback()


# =============================================================================
# ФИКСТУРЫ ДЛЯ МИКРОСЕРВИСОВ
# =============================================================================

@pytest.fixture(scope="session")
async def redis_client() -> AsyncGenerator[Any, None]:
    """Фикстура для Redis клиента с поддержкой mock/real режима."""
    use_real_redis = os.getenv("USE_REAL_REDIS", "false").lower() in ("true", "1", "yes")

    if use_real_redis:
        # Реальный Redis клиент для интеграционных тестов
        pytest.skip("Real Redis client not implemented. Use mock mode for testing.")
    else:
        # Mock для unit тестов
        class MockRedis:
            def __init__(self):
                self._data: Dict[str, Any] = {}

            async def get(self, key: str) -> Any:
                return self._data.get(key)

            async def set(self, key: str, value: Any) -> None:
                self._data[key] = value

            async def delete(self, key: str) -> bool:
                return bool(self._data.pop(key, None))

            async def exists(self, key: str) -> int:
                return 1 if key in self._data else 0

        yield MockRedis()


@pytest.fixture(scope="session")
async def kafka_producer() -> AsyncGenerator[Any, None]:
    """Фикстура для Kafka продюсера с поддержкой mock/real режима."""
    use_real_kafka = os.getenv("USE_REAL_KAFKA", "false").lower() in ("true", "1", "yes")

    if use_real_kafka:
        # Реальный Kafka продюсер для интеграционных тестов
        pytest.skip("Real Kafka client not implemented. Use mock mode for testing.")
    else:
        # Mock для unit тестов
        class MockKafkaProducer:
            async def send(self, topic: str, message: Dict[str, Any]) -> None:
                print(f"📨 Mock Kafka message to {topic}: {message}")

            async def send_and_wait(self, topic: str, message: Dict[str, Any]) -> None:
                print(f"📨 Mock Kafka message (waited) to {topic}: {message}")

        yield MockKafkaProducer()


# =============================================================================
# ПЛАГИНЫ PYTEST
# =============================================================================

def pytest_configure(config):
    """Конфигурация pytest плагинов."""
    # Регистрируем маркеры
    config.addinivalue_line("markers", "ai: mark test as AI integration test")
    config.addinivalue_line("markers", "slow: mark test as slow running")
    config.addinivalue_line("markers", "flaky: mark test as potentially flaky")


def pytest_collection_modifyitems(items):
    """Модификация коллекции тестов."""
    skipped_count = 0

    # Пропускаем AI тесты если нет API ключей
    for item in items:
        if "ai" in item.keywords:
            missing_keys = [
                provider for provider, cfg in AI_PROVIDERS.items()
                if cfg.get("required", False) and not os.getenv(f"{provider.upper()}_API_KEY")
            ]
            if missing_keys:
                item.add_marker(
                    pytest.mark.skip(reason=f"Missing API keys: {', '.join(missing_keys)}")
                )
                skipped_count += 1

    if skipped_count > 0:
        print(f"⚠️  Skipped {skipped_count} AI tests due to missing API keys")


# =============================================================================
# ХУКИ ДЛЯ ОТЧЕТНОСТИ
# =============================================================================

@pytest.hookimpl(trylast=True)
def pytest_sessionfinish(session, exitstatus):
    """Финальный отчет после сессии тестирования."""
    count = _ai_stats["count"]
    cost = _ai_stats["cost"]
    total_time = _ai_stats["total_time"]
    providers = _ai_stats["providers"]

    if count > 0:
        print(f"\n🤖 AI Integration Test Summary:")
        print(f"   Calls: {count}")
        print(f"   Total time: {total_time:.2f}s")
        print(f"   Average time per call: {total_time / count:.2f}s")
        print(f"   Estimated cost: ${cost:.2f}")
        print(f"   Average cost per call: ${cost / count:.4f}")

        if providers:
            print(f"   By provider:")
            for provider, stats in providers.items():
                print(f"     {provider}: {stats['count']} calls, "
                      f"${stats['cost']:.2f}, {stats['time']:.2f}s")