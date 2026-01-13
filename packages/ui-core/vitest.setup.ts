/**
 * Setup файл для @livai/ui-core
 * UI пакет с React компонентами - нужен cleanup и matchers
 */
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';

// Расширяем expect matchers для @testing-library/jest-dom
expect.extend(matchers);

// Очистка DOM после каждого теста
afterEach(() => {
  cleanup();
});

// Импортируем общий setup
export * from '../../config/vitest/package.setup.js';
