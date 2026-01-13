import { expect, test } from '@playwright/test';

test.describe('User Registration & Workspace Creation', () => {
  test('should register new user and create workspace', async ({ page }) => {
    // Переход на главную страницу
    await page.goto('/');

    // Клик по кнопке "Sign Up" или "Register"
    await page.click('text=/sign up|register|create account/i');

    // Заполнение формы регистрации
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.fill('[data-testid="confirm-password-input"]', 'TestPassword123!');

    // Согласие с условиями
    await page.check('[data-testid="terms-checkbox"]');

    // Отправка формы
    await page.click('[data-testid="register-button"]');

    // Ожидание перенаправления на создание workspace
    await page.waitForURL('**/workspace/create');

    // Создание workspace
    await page.fill('[data-testid="workspace-name-input"]', 'My Test Workspace');
    await page.fill('[data-testid="workspace-description-input"]', 'Workspace for E2E testing');

    // Выбор типа workspace
    await page.click('[data-testid="workspace-type-personal"]');

    // Создание workspace
    await page.click('[data-testid="create-workspace-button"]');

    // Проверка успешного создания
    await page.waitForURL('**/dashboard');
    await expect(page.locator('[data-testid="workspace-name"]')).toContainText('My Test Workspace');

    // Проверка наличия основных элементов dashboard
    await expect(page.locator('[data-testid="create-bot-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="bots-list"]')).toBeVisible();
  });

  test('should login existing user', async ({ page }) => {
    // Переход на страницу входа
    await page.goto('/auth/login');

    // Заполнение формы входа
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');

    // Вход
    await page.click('[data-testid="login-button"]');

    // Проверка успешного входа
    await page.waitForURL('**/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });
});
