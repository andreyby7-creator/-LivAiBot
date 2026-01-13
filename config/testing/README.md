# LivAi Testing Framework

Единая система тестирования для всего проекта LivAi, объединяющая Vitest, Playwright и Python тесты.

## 🏗️ Архитектура

```
config/testing/
├── shared-config.ts      # Общие настройки для всех инструментов
├── shared-config.d.ts    # TypeScript типы для shared-config
├── integration.js        # JavaScript версия интеграционных функций
├── integration.ts        # TypeScript версия с полной типизацией
├── test-runner.js        # Главный оркестратор тестирования
├── coverage-merger.js    # Объединение отчетов о покрытии
└── README.md            # Эта документация
```

## 🚀 Быстрый старт

```bash
# Запустить все тесты
pnpm test

# Только unit тесты
pnpm run test:unit

# Только integration тесты
pnpm run test:integration

# Только E2E тесты
pnpm run test:e2e

# Проверить здоровье сервисов
pnpm run test:health

# Посмотреть объединенный отчет о покрытии
pnpm run test:coverage
```

## 📋 Типы тестов

### 🧪 Unit Tests

- **Vitest**: JavaScript/TypeScript unit тесты
- **Python**: Unit тесты через pytest с маркером `unit`
- **Покрытие**: Объединяется в общий отчет

### 🔗 Integration Tests

- **Vitest**: Тесты взаимодействия между компонентами
- **API**: Тесты внешних интеграций
- **База данных**: Тесты с реальной БД

### 🌐 E2E Tests

- **Playwright**: Полноценные пользовательские сценарии
- **Browser**: Chromium, Firefox, Safari
- **Mobile**: iOS Safari эмуляция

## ⚙️ Конфигурация

### Общие настройки (`shared-config.ts`)

```javascript
export const paths = {/* Пути к директориям */};
export const env = {/* Переменные окружения */};
export const timeouts = {/* Таймауты для тестов */};
export const coverage = {/* Настройки покрытия */};
export const coverageExcludes = {/* Централизованные паттерны исключений */};
```

#### Централизованные паттерны исключений покрытия

```javascript
// Базовые исключения (общие для всех фреймворков)
coverageExcludes.base = [
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  '**/*.config.*',
  '**/*.setup.*',
  '**/mocks/**',
  '**/fixtures/**',
];

// Специфические для Vitest (base + config/scripts)
coverageExcludes.vitest = [
  ...coverageExcludes.base,
  '**/config/**',
  '**/scripts/**',
];

// Специфические для Playwright (base + test/spec файлы)
coverageExcludes.playwright = [
  ...coverageExcludes.base,
  '**/test/**',
  '**/tests/**',
  '**/*.test.*',
  '**/*.spec.*',
];
```

#### Динамическое объединение исключений

Для проектов с уникальными требованиями можно добавлять дополнительные исключения:

```javascript
import { generateCoverageConfig } from './config/testing/integration.ts';

// Стандартная конфигурация
const standardConfig = generateCoverageConfig('./reports/coverage', 'vitest');

// С дополнительными исключениями для специфического пакета
const customConfig = generateCoverageConfig('./reports/coverage', 'vitest', [
  '**/generated/**', // Сгенерированные файлы
  '**/vendor/**', // Third-party код
  '**/legacy/**', // Старый код
]);

// Использование предопределенных наборов
import { coverageExcludeExamples } from './config/testing/shared-config.ts';

const configWithExamples = generateCoverageConfig('./reports/coverage', 'vitest', [
  ...coverageExcludeExamples.generated,
  ...coverageExcludeExamples.thirdParty,
  '**/project-specific/**', // Собственные исключения
]);
```

#### Примеры дополнительных исключений

```javascript
// Для проектов с generated файлами
coverageExcludeExamples.generated = [
  '**/generated/**',
  '**/auto-generated/**',
  '**/build/**',
];

// Для проектов с third-party кодом
coverageExcludeExamples.thirdParty = [
  '**/vendor/**',
  '**/third-party/**',
  '**/external/**',
];

// Для проектов с тестовыми утилитами
coverageExcludeExamples.testUtils = [
  '**/test-utils/**',
  '**/testing-helpers/**',
  '**/__tests__/utils/**',
];

// Динамическое создание
const customExcludes = coverageExcludeExamples.custom([
  '**/my-project/**',
  '**/specific-dir/**',
]);
```

### Инструмент-специфичные настройки

- **Vitest**: `config/vitest/`
- **Playwright**: `config/playwright/`
- **Python**: `config/vitest/integrations/python-bridge.mjs`

## 📊 Покрытие кода

### Объединенный отчет

Система автоматически объединяет покрытие из:

- JavaScript/TypeScript (Vitest)
- Python (pytest-cov)
- E2E сценарии (Playwright)

### Просмотр отчетов

```bash
# HTML отчеты
open reports/coverage/html/index.html

# JSON данные
cat reports/coverage/merged/merged-coverage.json

# Текстовый summary
cat reports/coverage/merged/coverage-summary.txt
```

## 🔧 Расширенные опции

### CLI аргументы для test-runner.js

```bash
# Пропустить health-check
node config/testing/test-runner.js --skip-health-check

# Пропустить unit тесты
node config/testing/test-runner.js --skip-unit

# Не останавливаться на первой ошибке
node config/testing/test-runner.js --no-fail-fast
```

### Переменные окружения

```bash
# CI режим
CI=true pnpm test

# Отладка
DEBUG=test pnpm test

# Кастомный тестовый environment
TEST_ENV=staging pnpm test
```

## 🏥 Health Checks

Автоматическая проверка здоровья всех сервисов:

- Python микросервисы (conversations, auth, api-gateway)
- База данных
- Внешние API

```bash
pnpm run test:health
```

## 📈 CI/CD Integration

### GitHub Actions

```yaml
- name: Run tests
  run: pnpm test

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./reports/coverage/merged/merged-coverage.json
```

### Coverage Thresholds

```javascript
// config/testing/shared-config.ts
export const coverage = {
  thresholds: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
};
```

## 🔍 Диагностика

### Запуск тестов с детальным логированием

```bash
# Полный набор тестов с детальными логами
node config/testing/test-runner.js

# Только определенные типы тестов
node config/testing/test-runner.js --only-unit
node config/testing/test-runner.js --only-python
node config/testing/test-runner.js --only-integration
node config/testing/test-runner.js --only-e2e

# Пропустить определенные типы
node config/testing/test-runner.js --skip-e2e
```

#### Кастомные таймауты для E2E сценариев

```javascript
import { getPlaywrightConfig } from './config/testing/integration.js';

// Стандартные таймауты (из shared-config.ts)
const standardConfig = getPlaywrightConfig({
  baseURL: 'http://localhost:3000',
  testType: 'e2e',
});

// Кастомные таймауты для медленных операций
const slowOperationsConfig = getPlaywrightConfig({
  baseURL: 'http://localhost:3000',
  testType: 'e2e',
  timeouts: {
    actionTimeout: 60000, // 60 сек для медленных действий
    navigationTimeout: 300000, // 5 мин для долгой навигации
    expectTimeout: 120000, // 2 мин для expect операций
  },
});

// Быстрые таймауты для smoke тестов
const smokeTestConfig = getPlaywrightConfig({
  baseURL: 'http://localhost:3000',
  testType: 'e2e',
  timeouts: {
    actionTimeout: 5000, // 5 сек
    navigationTimeout: 10000, // 10 сек
    expectTimeout: 5000, // 5 сек
  },
});
```

#### Формат логов выполнения

Каждый шаг тестирования логируется с timestamp и кодом возврата:

```
[2026-01-13T01:20:08.508Z] UNIT TESTS ❌ FAILED (exit code: 1) [2241ms]
    Error details: Playwright Test did not expect test.describe() to be called here
    Files: 6/6 passed
    Tests: 119/119 passed
    Coverage: 100%

[2026-01-13T01:20:15.476Z] PYTHON TESTS ✅ SUCCESS (exit code: 0) [68ms]
    Files: 4/4 passed
    Tests: 16/16 passed
    Coverage: 85%
```

#### Анализ ошибок

Результаты тестирования включают детальную информацию об ошибках:

```javascript
const result = await runAllTests();

// Ошибки по типам тестов
console.log('Unit errors:', result.unit.errors.length);
console.log('Python errors:', result.python.errors.length);
console.log('Integration errors:', result.integration.errors.length);
console.log('E2E errors:', result.e2e.errors.length);

// Общий массив всех ошибок
console.log('Total errors:', result.errors.length);

// Детали каждой ошибки
result.errors.forEach((error) => {
  console.log(`[${error.timestamp}] ${error.type}: ${error.message}`);
  if (error.code !== undefined) {
    console.log(`Exit code: ${error.code}`);
  }
  if (error.stack) {
    console.log(`Stack: ${error.stack}`);
  }
});
```

**Структура ошибки:**

```javascript
{
  type: 'unit' | 'python' | 'integration' | 'e2e',  // Тип тестов
  message: string,                                   // Сообщение об ошибке
  code?: number,                                     // Код выхода процесса
  stack?: string,                                    // Stack trace (для исключений)
  timestamp: string                                  // Время возникновения ошибки
}
```

### Проверить конфигурации

```bash
# Рекомендуемый способ: полная проверка со статусом
node -e "import('./config/testing/integration.js').then(m => m.getSharedConfigStatus().then(console.log))"

# Устаревший способ (для обратной совместимости)
node -e "import('./config/testing/integration.js').then(m => m.validateConfigurations())"
```

#### Проверка Python Bridge

Система выполняет глубокую валидацию Python интеграции:

- ✅ **Существование файла**: `config/vitest/integrations/python-bridge.mjs`
- ✅ **Базовая структура**: Наличие `export` и ссылок на Python
- ✅ **Импорт модуля**: Возможность динамического импорта
- ✅ **Обязательные экспорты**: `runPythonTests`, `checkPythonEnvironment`, `mergeCoverageReports`
- ✅ **Типы функций**: Проверка что экспорты являются функциями
- ✅ **Тестовое выполнение**: Безопасный запуск `checkPythonEnvironment()` с таймаутом для проверки работоспособности Python окружения

```javascript
const status = await getSharedConfigStatus();
console.log('Python bridge valid:', status.configFiles.pythonBridge.valid);
// true - если все проверки пройдены
```

### Проверить статус инструментов

```bash
# Объединенная проверка конфигураций и инструментов
node -e "import('./config/testing/integration.js').then(m => m.getSharedConfigStatus().then(console.log))"

# Полная проверка конфигурации и инструментов
node -e "import('./config/testing/integration.js').then(m => m.getSharedConfigStatus().then(console.log))"
```

### API для генерации конфигураций

```javascript
import {
  getPlaywrightConfig,
  getSharedConfigStatus,
  getVitestConfig,
} from './config/testing/integration.js';

// Получить конфигурацию Vitest с опциями
const vitestCfg = getVitestConfig({
  testType: 'unit',
  coverage: true,
});

// Получить конфигурацию Playwright
const playwrightCfg = getPlaywrightConfig({
  baseURL: 'http://localhost:3000',
  testType: 'e2e',
});

// Полный статус системы тестирования
const status = await getSharedConfigStatus();
if (status.valid) {
  console.log('✅ Все готово для тестирования');
} else {
  console.log('❌ Найдены проблемы:', status.issues);
}
```

### Ручной запуск отдельных компонентов

```bash
# Только Vitest
npx vitest run --config config/vitest/vitest.shared.config.ts

# Только Playwright
cd apps/web && npx playwright test --config ../../config/playwright/playwright.config.ts

# Только Python
node -e "import('./config/vitest/integrations/python-bridge.mjs').then(m => m.runPythonTests())"
```

## 🚨 Troubleshooting

### Common Issues

1. **Python не найден**
   ```bash
   # Установить Python 3
   apt-get install python3 python3-pip
   ```

2. **pytest не установлен**
   ```bash
   pip3 install pytest pytest-cov
   ```

3. **Playwright браузеры не установлены**
   ```bash
   npx playwright install
   ```

4. **Покрытие не объединяется**
   - Проверьте, что все инструменты генерируют JSON отчеты
   - Убедитесь, что пути в `shared-config.ts` корректны

### Debug режим

```bash
DEBUG=test pnpm test
```

## 🔷 TypeScript Integration

### Типизированные конфигурации

Для проектов с TypeScript используйте `integration.ts`:

```typescript
import {
  getPlaywrightConfig,
  getSharedConfigStatus,
  getVitestConfig,
} from './config/testing/integration.ts';

// Полная типизация опций
interface VitestConfigOptions {
  testType?: 'unit' | 'integration' | 'e2e';
  coverage?: boolean;
}

interface PlaywrightConfigOptions {
  baseURL?: string;
  testType?: 'unit' | 'integration' | 'e2e';
  coverage?: boolean;
}

// Строго типизированные возвращаемые объекты
const vitestCfg: VitestUserConfig = getVitestConfig({ testType: 'unit' });
const playwrightCfg: Partial<PlaywrightConfig> = getPlaywrightConfig({
  baseURL: 'http://localhost:3000',
});

// Типизированный статус
const status: SharedConfigStatus = await getSharedConfigStatus();
```

### Преимущества TypeScript версии

- **Полная типизация**: Все опции и возвращаемые значения строго типизированы
- **Автодополнение**: IDE подсказывает доступные опции
- **Проверка типов**: Компилятор TypeScript выявляет ошибки конфигурации
- **Безопасность**: Защита от опечаток в именах свойств

## 📝 Contributing

При добавлении новых типов тестов:

1. Обновите `shared-config.ts` если нужны новые настройки
2. Обновите `integration.ts` с типизацией для новых функций
3. Добавьте логику в `test-runner.js`
4. Обновите эту документацию
5. Добавьте соответствующие скрипты в `package.json`
