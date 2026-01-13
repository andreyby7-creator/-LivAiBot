import { expect, test } from '@playwright/test';

test.describe('AI Bot Creation & Configuration', () => {
  test.beforeEach(async ({ page }) => {
    // Вход в систему перед каждым тестом
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');
  });

  test('should create new AI bot', async ({ page }) => {
    // Клик по кнопке создания бота
    await page.click('[data-testid="create-bot-button"]');

    // Заполнение основной информации о боте
    await page.fill('[data-testid="bot-name-input"]', 'Test Assistant Bot');
    await page.fill('[data-testid="bot-description-input"]', 'AI assistant for testing purposes');

    // Выбор типа бота
    await page.click('[data-testid="bot-type-chat"]');

    // Выбор AI провайдера
    await page.selectOption('[data-testid="ai-provider-select"]', 'openai');

    // Выбор модели
    await page.selectOption('[data-testid="ai-model-select"]', 'gpt-4');

    // Настройка температуры
    await page.fill('[data-testid="temperature-slider"]', '0.7');

    // Создание бота
    await page.click('[data-testid="create-bot-submit"]');

    // Проверка успешного создания
    await page.waitForURL('**/bots/**');
    await expect(page.locator('[data-testid="bot-name"]')).toContainText('Test Assistant Bot');
    await expect(page.locator('[data-testid="bot-status"]')).toContainText('Active');
  });

  test('should configure bot knowledge base', async ({ page }) => {
    // Переход к списку ботов
    await page.goto('/bots');

    // Выбор созданного бота
    await page.click('text=Test Assistant Bot');

    // Переход к настройкам knowledge base
    await page.click('[data-testid="knowledge-tab"]');

    // Добавление документа
    await page.click('[data-testid="add-document-button"]');

    // Загрузка файла
    await page.setInputFiles('[data-testid="file-upload"]', {
      name: 'test-document.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is a test document for AI bot knowledge base.'),
    });

    // Сохранение документа
    await page.click('[data-testid="save-document-button"]');

    // Проверка успешного добавления
    await expect(page.locator('[data-testid="documents-list"]')).toContainText('test-document.txt');

    // Тестирование бота с документом
    await page.click('[data-testid="test-bot-tab"]');

    // Ввод тестового вопроса
    await page.fill('[data-testid="test-input"]', 'What is in the test document?');

    // Отправка запроса
    await page.click('[data-testid="send-test-button"]');

    // Проверка ответа (должен содержать информацию из документа)
    await expect(page.locator('[data-testid="bot-response"]')).toContainText('test document');
  });

  test('should configure bot integrations', async ({ page }) => {
    // Переход к настройкам бота
    await page.goto('/bots');
    await page.click('text=Test Assistant Bot');
    await page.click('[data-testid="integrations-tab"]');

    // Добавление Telegram интеграции
    await page.click('[data-testid="add-integration-button"]');
    await page.click('[data-testid="integration-telegram"]');

    // Настройка Telegram бота
    await page.fill(
      '[data-testid="telegram-token-input"]',
      '123456789:FAKE_TELEGRAM_TOKEN_FOR_TESTING',
    );
    await page.fill('[data-testid="telegram-username-input"]', '@TestBot');

    // Сохранение интеграции
    await page.click('[data-testid="save-integration-button"]');

    // Проверка успешного добавления
    await expect(page.locator('[data-testid="integrations-list"]')).toContainText('Telegram');

    // Добавление webhook интеграции
    await page.click('[data-testid="add-integration-button"]');
    await page.click('[data-testid="integration-webhook"]');

    // Настройка webhook
    await page.fill('[data-testid="webhook-url-input"]', 'https://example.com/webhook');
    await page.selectOption('[data-testid="webhook-method-select"]', 'POST');

    // Сохранение интеграции
    await page.click('[data-testid="save-integration-button"]');

    // Проверка наличия обеих интеграций
    await expect(page.locator('[data-testid="integrations-list"]')).toContainText('Telegram');
    await expect(page.locator('[data-testid="integrations-list"]')).toContainText('Webhook');
  });
});
