import { expect, test } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should initialize Playwright', async ({ page }) => {
    // Самый простой тест - просто проверяем, что страница существует
    expect(page).toBeTruthy();

    // Проверяем, что можем получить title (даже пустой)
    const title = await page.title();
    expect(typeof title).toBe('string');
  });

  test('should handle page content', async ({ page }) => {
    // Устанавливаем простой контент
    await page.setContent('<h1>Hello</h1>');

    // Проверяем, что контент установлен
    const h1 = await page.locator('h1').textContent();
    expect(h1).toBe('Hello');
  });

  test('should work with browser context', ({ browserName }) => {
    // Проверяем, что browserName определен
    expect(browserName).toBeDefined();
    expect(typeof browserName).toBe('string');
  });
});
