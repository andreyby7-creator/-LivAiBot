/**
 * Setup файл для @livai/ui-shared
 * UI пакет с React компонентами - нужен cleanup
 */
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

// Импортируем общий setup (включая jest-dom matchers)
export * from '../../config/vitest/test.setup.js';

// Очистка DOM перед и после каждого теста
beforeEach(() => {
  // Агрессивная очистка всего DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';

  // Очистка всех контейнеров рендеринга
  const containers = document.querySelectorAll('[data-testid]');
  containers.forEach((container) => container.remove());

  cleanup();
});

afterEach(() => {
  // Многоуровневая очистка
  cleanup();

  // Полная очистка DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';

  // Очистка всех оставшихся элементов
  const allElements = document.querySelectorAll('*');
  allElements.forEach((element) => {
    if (element.parentNode && element.parentNode !== document) {
      element.parentNode.removeChild(element);
    }
  });

  // Финальная очистка body
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }

  // Дополнительная очистка для проблемных случаев
  const labels = document.querySelectorAll('label');
  labels.forEach((label) => label.remove());

  const buttons = document.querySelectorAll('button');
  buttons.forEach((button) => button.remove());

  const inputs = document.querySelectorAll('input');
  inputs.forEach((input) => input.remove());
});

// Jest-dom уже импортирован выше, общий setup не нужен для UI пакетов
