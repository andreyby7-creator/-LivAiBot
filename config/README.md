# Система тестирования LivAi

Комплексная система тестирования для AI-powered chatbot платформы с поддержкой Python backend, Effect-TS frontend и E2E автоматизации.

## 🏗️ Архитектура

```
config/
├── vitest/           # Frontend/TypeScript тестирование
│   ├── vitest.config.ts         # Основная конфигурация
│   ├── vitest.ai.config.ts      # AI интеграционные тесты
│   ├── vitest.shared.config.ts  # Общие утилиты
│   ├── integrations/
│   │   └── python-bridge.js     # Интеграция с Python
│   └── package.json             # Локальные зависимости
├── pytest/           # Python backend тестирование
│   ├── pytest.ini               # Конфигурация pytest
│   ├── tox.ini                  # Multi-environment testing
│   └── conftest.py              # Глобальная конфигурация
└── playwright/       # E2E автоматизация
    ├── playwright.config.ts     # Конфигурация E2E
    ├── global-setup.ts          # Настройка окружения
    └── global-teardown.ts       # Очистка окружения
```

## 🎯 Уровни тестирования

### 1. **Unit тесты** (Vitest + Pytest)

- **Frontend**: Vitest для Effect-TS компонентов
- **Backend**: Pytest для Python domain/use_cases/adapters
- **AI**: Изолированные тесты AI функций с mocks

### 2. **Integration тесты** (Vitest + Pytest)

- **AI интеграции**: Реальные вызовы AI провайдеров с бюджетированием
- **API интеграции**: Тесты webhook, очередей, баз данных
- **Cross-service**: Тесты взаимодействия сервисов

### 3. **E2E тесты** (Playwright)

- **User journeys**: Полные сценарии использования
- **Cross-browser**: Chrome, Safari Mobile
- **Performance**: Тесты производительности AI операций

## 🚀 Запуск тестов

### Frontend Unit/Integration

```bash
# Все тесты
pnpm test

# Только AI интеграции (с бюджетом)
pnpm test --config config/vitest/vitest.ai.config.ts

# С покрытием
pnpm test:coverage
```

### Python Backend

```bash
# Unit тесты
cd services/conversations-service && python -m pytest

# С покрытием
tox -e coverage

# Линтинг
tox -e lint
```

### E2E автоматизация

```bash
# Запуск dev сервера + E2E тесты
pnpm test:e2e

# Только E2E без dev сервера
npx playwright test

# С UI для отладки
pnpm test:e2e:ui
```

## 🤖 AI тестирование с бюджетированием

### Бюджетные лимиты

```typescript
const AI_BUDGET = {
  maxCostCI: 2.0, // $2 на CI run
  maxCostDev: 0.5, // $0.5 в разработке
  maxCallsPerTest: 3, // Макс 3 AI вызова на тест
  maxTokensPerCall: 4000, // Макс 4000 токенов на вызов
};
```

### Пример AI теста

```typescript
import { callAI, recordAICall } from 'config/vitest/vitest.ai.config';

test('AI conversation flow', async () => {
  const response = await callAI('openai', 'Hello, how are you?', {
    maxTokens: 100,
    temperature: 0.7,
  });

  recordAICall('openai', response.usage.total_tokens);
  expect(response.content).toContain('Hello');
});
```

## 📊 Отчеты о покрытии

### Автоматическая генерация

```bash
# Frontend coverage
pnpm test:coverage

# Python coverage
tox -e coverage

# E2E отчеты
npx playwright show-report
```

### Структура отчетов

```
reports/
├── coverage/
│   ├── js/           # Frontend coverage (V8)
│   ├── python/       # Backend coverage (Coverage.py)
│   └── merged/       # Объединенные отчеты
└── playwright/       # E2E отчеты
    ├── index.html    # Визуальный отчет
    ├── results.json  # JSON данные
    └── junit.xml     # CI интеграция
```

## 🔧 Конфигурация сред

### Development

- Полные логи и трассировка
- Watch режим
- Локальный dev server

### CI/CD

- Минимальные логи
- Параллельное выполнение
- Строгие таймауты
- Бюджетные ограничения

## 🎪 Расширяемость

### Добавление новых AI провайдеров

```typescript
// config/vitest/vitest.ai.config.ts
const AI_PROVIDERS = {
  new_provider: { rate: 0.005, required: false },
};
```

### Новые E2E сценарии

```typescript
// e2e/user-journeys/new-scenario.spec.ts
test('New user journey', async ({ page }) => {
  // Тестовый код
});
```

### Python сервисы

```bash
# services/new-service/tests/
# Автоматически подхватывается pytest.ini
```

## 📈 Метрики качества

- **Coverage**: >85% lines, >80% branches, >85% functions
- **Performance**: <30s AI responses, <5s API calls
- **Reliability**: <1% flaky tests, 99.9% uptime
- **Cost control**: <$2/day AI testing budget

## 🐛 Troubleshooting

### AI бюджет превышен

```bash
# Проверить использование
grep "AI Call:" test-results.txt

# Увеличить бюджет в AI_BUDGET
```

### Python тесты не запускаются

```bash
# Проверить зависимости
pip install -r requirements-dev.txt

# Проверить PYTHONPATH
export PYTHONPATH=/path/to/services
```

### E2E тесты падают

```bash
# Запустить с отладкой
npx playwright test --debug

# Проверить dev server
curl http://localhost:3000
```

---

**Система обеспечивает comprehensive testing coverage для AI-powered платформы с контролем качества, производительности и стоимости.**
