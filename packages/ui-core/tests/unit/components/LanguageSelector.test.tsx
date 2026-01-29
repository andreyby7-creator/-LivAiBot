/**
 * @vitest-environment jsdom
 * @file Unit тесты для LanguageSelector компонента
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LanguageSelector } from '../../../src/components/LanguageSelector.js';
import type { LanguageData } from '../../../src/components/LanguageSelector.js';

// Полная очистка DOM между тестами
afterEach(cleanup);

// Функция для изолированного рендера
function renderIsolated(component: Readonly<React.ReactElement>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const result = render(component, { container });

  // Helper functions
  const getLanguageSelector = () =>
    container.querySelector('div[data-component="CoreLanguageSelector"]')!;

  return {
    ...result,
    container,
    // Локальный поиск элементов
    getByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).getByRole(role, options),
    getByTestId: (testId: Readonly<string>) => within(container).getByTestId(testId),
    queryByTestId: (testId: Readonly<string>) => within(container).queryByTestId(testId),
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).queryByRole(role, options),
    getLanguageSelector,
    getSelector: () =>
      container.querySelector('[role="combobox"]')
        ?? getLanguageSelector().querySelector('[role="combobox"]'),
    getDropdown: () =>
      container.querySelector('[role="listbox"]')
        ?? getLanguageSelector().querySelector('[role="listbox"]'),
    getSelectedFlag: () => container.querySelector('[data-testid*="selected-flag"]'),
    getSelectedName: () => container.querySelector('[data-testid*="selected-name"]'),
    getSelectedCode: () => container.querySelector('[data-testid*="selected-code"]'),
    getOption: (code: string) => container.querySelector(`[data-testid*="${code}"]`),
  };
}

describe('LanguageSelector', () => {
  // Общие тестовые переменные
  const languages: readonly LanguageData[] = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
  ];

  const languagesWithDisabled: readonly LanguageData[] = [
    { code: 'en', name: 'English' },
    { code: 'ru', name: 'Русский', isDisabled: true },
  ];

  const emptyLanguages: readonly LanguageData[] = [];

  const selectedLanguageCode = 'ru';
  const nonExistentLanguageCode = 'de';

  // Mock callbacks
  const mockOnLanguageChange = vi.fn();
  const mockOnToggle = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnKeyDown = vi.fn();

  // Вынесенные массивы для соблюдения ESLint правил
  const languagesWithEmptyName: readonly LanguageData[] = [
    { code: 'test', name: '' },
  ];
  const languagesWithNullFlag: readonly LanguageData[] = [
    { code: 'test', name: 'Test', flag: null },
  ];
  const languagesWithoutFlag: readonly LanguageData[] = [
    { code: 'test', name: 'Test' },
  ];
  const languagesWithLongNames: readonly LanguageData[] = [
    { code: 'test', name: 'A'.repeat(100) },
  ];

  // Вынесенные объекты для соблюдения ESLint правил
  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLDivElement>();

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getLanguageSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
        />,
      );

      expect(container).toBeInTheDocument();
      expect(getLanguageSelector()).toBeInTheDocument();
    });

    it('рендерится с полным набором пропсов', () => {
      const { container, getLanguageSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          placeholder='Select language'
          size='large'
          variant='compact'
          showFlags={false}
          showCodes={true}
          disabled={false}
          onLanguageChange={mockOnLanguageChange}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
          onKeyDown={mockOnKeyDown}
          activeDescendantId='test-id'
          navigatedLanguageCode='en'
          data-testid='test-selector'
        />,
      );

      expect(container).toBeInTheDocument();
      expect(getLanguageSelector()).toBeInTheDocument();
    });

    it('рендерится с пустым списком языков', () => {
      const { container, getLanguageSelector } = renderIsolated(
        <LanguageSelector
          languages={emptyLanguages}
          selectedLanguageCode={nonExistentLanguageCode}
          isOpen={false}
        />,
      );

      expect(container).toBeInTheDocument();
      expect(getLanguageSelector()).toBeInTheDocument();
    });

    it('рендерится когда выбранный язык не найден', () => {
      const { container, getLanguageSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={nonExistentLanguageCode}
          isOpen={false}
        />,
      );

      expect(container).toBeInTheDocument();
      expect(getLanguageSelector()).toBeInTheDocument();
    });

    it('рендерится с отключенным состоянием', () => {
      const { container, getLanguageSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          disabled={true}
        />,
      );

      expect(container).toBeInTheDocument();
      expect(getLanguageSelector()).toBeInTheDocument();
    });

    it('рендерится с открытым dropdown', () => {
      const { container, getLanguageSelector, getDropdown } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
        />,
      );

      expect(container).toBeInTheDocument();
      expect(getLanguageSelector()).toBeInTheDocument();
      expect(getDropdown()).toBeInTheDocument();
    });
  });

  describe('4.2. Селектор (Selector)', () => {
    describe('Базовое отображение', () => {
      it('отображает выбранный язык с флагом', () => {
        const { getSelectedName, getSelectedFlag } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
            data-testid='test'
          />,
        );

        expect(getSelectedName()).toHaveTextContent('Русский');
        expect(getSelectedFlag()).toBeInTheDocument();
        expect(getSelectedFlag()).toHaveTextContent('🇷🇺');
      });

      it('отображает выбранный язык без флага когда showFlags=false', () => {
        const { getSelectedName, queryByTestId } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
            showFlags={false}
            data-testid='test'
          />,
        );

        expect(getSelectedName()).toHaveTextContent('Русский');
        expect(queryByTestId('test-selected-flag')).not.toBeInTheDocument();
      });

      it('отображает код языка когда showCodes=true', () => {
        const { getSelectedCode } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
            showCodes={true}
            data-testid='test'
          />,
        );

        expect(getSelectedCode()).toHaveTextContent('ru');
      });

      it('отображает placeholder когда язык не найден', () => {
        const { container } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={nonExistentLanguageCode}
            isOpen={false}
            placeholder='Choose language'
          />,
        );

        const placeholderElement = container.querySelector('[style*="color"]'); // PLACEHOLDER_STYLE has color
        expect(placeholderElement).toHaveTextContent('Choose language');
      });

      it('отображает стрелку в правильном состоянии', () => {
        const { container: closedContainer } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
            data-testid='test'
          />,
        );

        const { container: openContainer } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={true}
            data-testid='test'
          />,
        );

        const closedArrow = closedContainer.querySelector('[data-testid="test-arrow"]');
        const openArrow = openContainer.querySelector('[data-testid="test-arrow"]');

        expect(closedArrow).toHaveTextContent('▼');
        expect(openArrow).toHaveTextContent('▼');

        // Проверяем стили через computed style
        const closedStyle = window.getComputedStyle(closedArrow!);
        const openStyle = window.getComputedStyle(openArrow!);

        expect(closedStyle.transform).toBe('');
        expect(openStyle.transform).toBe('rotate(180deg)');
      });
    });

    describe('Размеры', () => {
      it('применяет small размер', () => {
        const { getLanguageSelector } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
            size='small'
          />,
        );

        const selector = getLanguageSelector();
        expect(selector).toHaveAttribute('data-size', 'small');
      });

      it('применяет large размер', () => {
        const { getLanguageSelector } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
            size='large'
          />,
        );

        const selector = getLanguageSelector();
        expect(selector).toHaveAttribute('data-size', 'large');
      });

      it('использует medium по умолчанию', () => {
        const { getLanguageSelector } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
          />,
        );

        const selector = getLanguageSelector();
        expect(selector).toHaveAttribute('data-size', 'medium');
      });
    });

    describe('Варианты', () => {
      it('применяет compact вариант', () => {
        const { getLanguageSelector } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
            variant='compact'
          />,
        );

        const selector = getLanguageSelector();
        expect(selector).toHaveAttribute('data-variant', 'compact');
      });

      it('применяет minimal вариант', () => {
        const { getLanguageSelector } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
            variant='minimal'
          />,
        );

        const selector = getLanguageSelector();
        expect(selector).toHaveAttribute('data-variant', 'minimal');
      });

      it('использует default по умолчанию', () => {
        const { getLanguageSelector } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
          />,
        );

        const selector = getLanguageSelector();
        expect(selector).toHaveAttribute('data-variant', 'default');
      });
    });

    describe('Состояния', () => {
      it('применяет disabled состояние', () => {
        const { getLanguageSelector, getSelector } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
            disabled={true}
          />,
        );

        const selector = getLanguageSelector();
        const selectorElement = getSelector();

        expect(selector).toHaveAttribute('data-disabled', 'true');
        expect(selectorElement).toHaveAttribute('aria-disabled', 'true');
        expect(selectorElement).toHaveAttribute('tabindex', '-1');
      });

      it('применяет open состояние', () => {
        const { getLanguageSelector } = renderIsolated(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={true}
          />,
        );

        const selector = getLanguageSelector();
        expect(selector).toHaveAttribute('data-open', 'true');
      });
    });
  });

  describe('4.3. Dropdown и опции', () => {
    it('не рендерит dropdown когда isOpen=false', () => {
      const { queryByTestId } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          data-testid='test'
        />,
      );

      expect(queryByTestId('test-dropdown')).not.toBeInTheDocument();
    });

    it('рендерит dropdown с опциями когда isOpen=true', () => {
      const { getDropdown, getOption } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          data-testid='test'
        />,
      );

      expect(getDropdown()).toBeInTheDocument();

      // Проверяем что все опции отрендерены
      expect(getOption('option-en')).toBeInTheDocument();
      expect(getOption('option-ru')).toBeInTheDocument();
      expect(getOption('option-es')).toBeInTheDocument();
      expect(getOption('option-fr')).toBeInTheDocument();
    });

    it('отмечает выбранную опцию', () => {
      const { getOption } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          data-testid='test'
        />,
      );

      const selectedOption = getOption('option-ru');
      expect(selectedOption).toHaveAttribute('data-selected', 'true');
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');
    });

    it('применяет disabled состояние к опциям', () => {
      const { getOption } = renderIsolated(
        <LanguageSelector
          languages={languagesWithDisabled}
          selectedLanguageCode='en'
          isOpen={true}
          data-testid='test'
        />,
      );

      const disabledOption = getOption('option-ru');
      expect(disabledOption).toHaveAttribute('data-disabled', 'true');
      expect(disabledOption).toHaveAttribute('aria-disabled', 'true');
    });

    it('применяет navigated состояние к активной опции', () => {
      const { getOption } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          navigatedLanguageCode='en'
          data-testid='test'
        />,
      );

      const navigatedOption = getOption('option-en');
      expect(navigatedOption).toHaveAttribute('data-navigated', 'true');
      expect(navigatedOption).toHaveAttribute('tabindex', '0');
    });

    it('отображает флаги в опциях когда showFlags=true', () => {
      const { container } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          data-testid='test'
        />,
      );

      const flag = container.querySelector('[data-testid="test-flag-en"]');
      expect(flag).toBeInTheDocument();
      expect(flag).toHaveTextContent('🇺🇸');
    });

    it('скрывает флаги в опциях когда showFlags=false', () => {
      const { container } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          showFlags={false}
          data-testid='test'
        />,
      );

      const flag = container.querySelector('[data-testid="test-flag-en"]');
      expect(flag).not.toBeInTheDocument();
    });

    it('отображает коды в опциях когда showCodes=true', () => {
      const { container } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          showCodes={true}
          data-testid='test'
        />,
      );

      const code = container.querySelector('[data-testid="test-code-en"]');
      expect(code).toBeInTheDocument();
      expect(code).toHaveTextContent('en');
    });
  });

  describe('4.4. Accessibility', () => {
    it('применяет правильные ARIA атрибуты к селектору', () => {
      const { getSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          data-testid='test'
        />,
      );

      const selector = getSelector();
      expect(selector).toHaveAttribute('role', 'combobox');
      expect(selector).toHaveAttribute('aria-expanded', 'false');
      expect(selector).toHaveAttribute('aria-haspopup', 'listbox');
      expect(selector).toHaveAttribute('aria-label', 'Language selector');
      expect(selector).toHaveAttribute('tabindex', '0');
    });

    it('обновляет aria-expanded при открытии', () => {
      const { getSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          data-testid='test'
        />,
      );

      const selector = getSelector();
      expect(selector).toHaveAttribute('aria-expanded', 'true');
    });

    it('применяет правильные ARIA атрибуты к dropdown', () => {
      const { getDropdown } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          data-testid='test'
        />,
      );

      const dropdown = getDropdown();
      expect(dropdown).toHaveAttribute('role', 'listbox');
    });

    it('устанавливает aria-activedescendant', () => {
      const { getSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          activeDescendantId='test-active-id'
        />,
      );

      const selector = getSelector();
      expect(selector).toHaveAttribute('aria-activedescendant', 'test-active-id');
    });

    it('устанавливает правильные ARIA атрибуты к опциям', () => {
      const { getOption } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          navigatedLanguageCode='en'
          data-testid='test'
        />,
      );

      const selectedOption = getOption('option-ru');
      const navigatedOption = getOption('option-en');
      const regularOption = getOption('option-es');

      expect(selectedOption).toHaveAttribute('role', 'option');
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');

      expect(navigatedOption).toHaveAttribute('role', 'option');
      expect(navigatedOption).toHaveAttribute('tabindex', '0');

      expect(regularOption).toHaveAttribute('role', 'option');
      expect(regularOption).toHaveAttribute('aria-selected', 'false');
      expect(regularOption).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('4.5. Взаимодействия и callbacks', () => {
    it('вызывает onToggle при клике по селектору', () => {
      const { getSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          onToggle={mockOnToggle}
        />,
      );

      const selector = getSelector();
      expect(selector).toBeInTheDocument();
      fireEvent.click(selector!);

      expect(mockOnToggle).toHaveBeenCalledTimes(1);
    });

    it('блокирует взаимодействие когда disabled=true', () => {
      const { getSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          disabled={true}
        />,
      );

      const selector = getSelector();
      expect(selector).toBeInTheDocument();
      expect(selector).toHaveAttribute('aria-disabled', 'true');
      expect(selector).toHaveAttribute('tabindex', '-1');

      // Проверяем что стили применены правильно
      const computedStyle = window.getComputedStyle(selector!);
      expect(computedStyle.pointerEvents).toBe('none');
      expect(computedStyle.cursor).toBe('not-allowed');
      expect(computedStyle.opacity).toBe('0.5');
    });

    it('вызывает onLanguageChange при клике по опции', () => {
      const { getOption } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          onLanguageChange={mockOnLanguageChange}
          onClose={mockOnClose}
          data-testid='test'
        />,
      );

      const option = getOption('option-en');
      if (option) {
        (option as HTMLElement).click();
      }

      expect(mockOnLanguageChange).toHaveBeenCalledWith('en');
      expect(mockOnLanguageChange).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('применяет disabled стили к опциям', () => {
      const { getOption } = renderIsolated(
        <LanguageSelector
          languages={languagesWithDisabled}
          selectedLanguageCode='en'
          isOpen={true}
          data-testid='test'
        />,
      );

      const disabledOption = getOption('option-ru');
      expect(disabledOption).toBeInTheDocument();
      expect(disabledOption).toHaveAttribute('aria-disabled', 'true');
      expect(disabledOption).toHaveAttribute('data-disabled', 'true');

      // Проверяем стили disabled опции
      const computedStyle = window.getComputedStyle(disabledOption!);
      expect(computedStyle.pointerEvents).toBe('none');
      expect(computedStyle.cursor).toBe('not-allowed');
      expect(computedStyle.opacity).toBe('0.5');
    });

    it('вызывает onKeyDown для селектора', () => {
      const { getSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          onKeyDown={mockOnKeyDown}
        />,
      );

      const selector = getSelector();
      expect(selector).toBeInTheDocument();
      fireEvent.keyDown(selector!, { key: 'Enter' });

      expect(mockOnKeyDown).toHaveBeenCalledTimes(1);
    });

    it('обрабатывает клавиатуру по умолчанию когда onKeyDown не передан', () => {
      const mockToggleForClosed = vi.fn();
      const mockCloseForOpen = vi.fn();

      const { getSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          onToggle={mockToggleForClosed}
        />,
      );

      const selector = getSelector();
      expect(selector).toBeInTheDocument();

      // Enter должен вызвать onToggle
      fireEvent.keyDown(selector!, { key: 'Enter' });
      expect(mockToggleForClosed).toHaveBeenCalledTimes(1);

      // Escape должен вызвать onClose когда открыт
      const { getSelector: getOpenSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          onClose={mockCloseForOpen}
        />,
      );

      const openSelector = getOpenSelector();
      expect(openSelector).toBeInTheDocument();
      fireEvent.keyDown(openSelector!, { key: 'Escape' });
      expect(mockCloseForOpen).toHaveBeenCalledTimes(1);
    });

    it('обрабатывает клавиатуру для опций', () => {
      vi.clearAllMocks();
      const { getOption } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          onLanguageChange={mockOnLanguageChange}
          onClose={mockOnClose}
          data-testid='test'
        />,
      );

      const option = getOption('option-en');

      // Enter должен вызвать onLanguageChange и onClose
      if (option) {
        fireEvent.keyDown(option, { key: 'Enter' });
      }

      expect(mockOnLanguageChange).toHaveBeenCalledWith('en');
      expect(mockOnClose).toHaveBeenCalledTimes(1);

      // Space тоже должен работать
      if (option) {
        fireEvent.keyDown(option, { key: ' ' });
      }

      expect(mockOnLanguageChange).toHaveBeenCalledTimes(2);
      expect(mockOnLanguageChange).toHaveBeenNthCalledWith(2, 'en');
      expect(mockOnClose).toHaveBeenCalledTimes(2);
    });

    it('не обрабатывает клавиатуру для disabled опций', () => {
      const mockDisabledChange = vi.fn();
      const { getOption } = renderIsolated(
        <LanguageSelector
          languages={languagesWithDisabled}
          selectedLanguageCode='en'
          isOpen={true}
          onLanguageChange={mockDisabledChange}
          data-testid='test'
        />,
      );

      const disabledOption = getOption('option-ru');

      // Enter не должен вызывать onLanguageChange для disabled опций
      if (disabledOption) {
        fireEvent.keyDown(disabledOption, { key: 'Enter' });
      }

      expect(mockDisabledChange).not.toHaveBeenCalled();
    });

    it('игнорирует другие клавиши в обработке клавиатуры опций', () => {
      const mockOtherKeysChange = vi.fn();
      const { getOption } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          onLanguageChange={mockOtherKeysChange}
          data-testid='test'
        />,
      );

      const option = getOption('option-en');

      // Другие клавиши должны игнорироваться
      if (option) {
        fireEvent.keyDown(option, { key: 'ArrowDown' });
        fireEvent.keyDown(option, { key: 'Tab' });
      }

      expect(mockOtherKeysChange).not.toHaveBeenCalled();
    });
  });

  describe('4.6. Ref forwarding', () => {
    it('поддерживает ref forwarding', () => {
      const ref = createMockRef();
      const { getLanguageSelector } = renderIsolated(
        <LanguageSelector
          ref={ref}
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
        />,
      );

      const selector = getLanguageSelector();
      expect(ref.current).toBe(selector);
    });
  });

  describe('4.7. Data attributes', () => {
    it('применяет data-component', () => {
      const { getLanguageSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
        />,
      );

      const selector = getLanguageSelector();
      expect(selector).toHaveAttribute('data-component', 'CoreLanguageSelector');
    });

    it('применяет data-testid', () => {
      const { container } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          data-testid='custom-test-id'
        />,
      );

      const selector = container.querySelector('[data-testid="custom-test-id"]');
      expect(selector).toBeInTheDocument();
    });

    it('генерирует правильные test IDs для внутренних элементов', () => {
      const { getSelector, queryByTestId } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          data-testid='test'
        />,
      );

      expect(getSelector()).toBeInTheDocument();
      expect(queryByTestId('test-dropdown')).toBeInTheDocument();
      expect(queryByTestId('test-selected-name')).toBeInTheDocument();
      expect(queryByTestId('test-arrow')).toBeInTheDocument();
    });
  });

  describe('4.8. Edge cases', () => {
    it('работает с языком без имени', () => {
      const { container } = renderIsolated(
        <LanguageSelector
          languages={languagesWithEmptyName}
          selectedLanguageCode='test'
          isOpen={false}
        />,
      );

      expect(container).toBeInTheDocument();
    });

    it('работает с null флагом', () => {
      const { container } = renderIsolated(
        <LanguageSelector
          languages={languagesWithNullFlag}
          selectedLanguageCode='test'
          isOpen={false}
          data-testid='test'
        />,
      );

      expect(container).toBeInTheDocument();
      // Флаг не должен рендериться
      const flag = container.querySelector('[data-testid="test-selected-flag"]');
      expect(flag).not.toBeInTheDocument();
    });

    it('работает с undefined флагом', () => {
      const { container } = renderIsolated(
        <LanguageSelector
          languages={languagesWithoutFlag}
          selectedLanguageCode='test'
          isOpen={false}
          data-testid='test'
        />,
      );

      expect(container).toBeInTheDocument();
      // Флаг не должен рендериться
      const flag = container.querySelector('[data-testid="test-selected-flag"]');
      expect(flag).not.toBeInTheDocument();
    });

    it('работает с длинными именами языков', () => {
      const { container } = renderIsolated(
        <LanguageSelector
          languages={languagesWithLongNames}
          selectedLanguageCode='test'
          isOpen={false}
          data-testid='test'
        />,
      );

      expect(container).toBeInTheDocument();
      const nameElement = container.querySelector('[data-testid="test-selected-name"]');
      expect(nameElement).toHaveTextContent('A'.repeat(100));
    });

    it('работает с кастомным placeholder', () => {
      const { container } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={nonExistentLanguageCode}
          isOpen={false}
          placeholder='Custom placeholder'
        />,
      );

      const placeholderElement = container.querySelector('[style*="color"]');
      expect(placeholderElement).toHaveTextContent('Custom placeholder');
    });

    it('работает с пустым placeholder', () => {
      const { container } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={nonExistentLanguageCode}
          isOpen={false}
          placeholder=''
        />,
      );

      // Когда placeholder пустой, должен отображаться только контейнер без текста
      const selector = container.querySelector('[role="combobox"]');
      expect(selector).toBeInTheDocument();
      // Проверяем что нет текста в selector (только стрелка)
      expect((selector as HTMLElement).textContent.trim()).toBe('▼');
    });
  });

  describe('4.9. Render stability', () => {
    it('не пересчитывает selectedLanguage при одинаковых пропсах', () => {
      const { rerender } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
        />,
      );

      // Первый рендер
      const firstRender = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
        />,
      );

      // Второй рендер с теми же пропсами
      rerender(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
        />,
      );

      // Компонент должен оставаться стабильным
      expect(firstRender.container).toBeInTheDocument();
    });

    it('пересчитывает стили при изменении размера', () => {
      const { rerender, getLanguageSelector } = renderIsolated(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          size='medium'
        />,
      );

      let selector = getLanguageSelector();
      expect(selector).toHaveAttribute('data-size', 'medium');

      rerender(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          size='large'
        />,
      );

      selector = getLanguageSelector();
      expect(selector).toHaveAttribute('data-size', 'large');
    });
  });
});
