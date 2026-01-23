/**
 * @vitest-environment jsdom
 * @file Unit тесты для Tabs компонента
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Tabs } from '../../../src/components/Tabs.js';
import type { TabItem } from '../../../src/components/Tabs.js';

// Полная очистка DOM между тестами
afterEach(cleanup);

// Функция для изолированного рендера
function renderIsolated(component: Readonly<React.ReactElement>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const result = render(component, { container });

  return {
    ...result,
    container,
    // Локальный поиск элементов
    getByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).getByRole(role, options),
    getAllByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).getAllByRole(role, options),
    getByTestId: (testId: Readonly<string>) => within(container).getByTestId(testId),
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).queryByRole(role, options),
    getTabs: () => container.querySelector('div[data-component="CoreTabs"]')!,
    getTabList: () => container.querySelector('ul[role="tablist"]')!,
    getTabButtons: () => container.querySelectorAll('button[role="tab"]'),
    getTabPanel: () => container.querySelector('div[role="tabpanel"]'),
  };
}

describe('Tabs', () => {
  // Общие тестовые переменные
  const testItems: readonly TabItem[] = [
    { id: 'tab1', label: 'Tab 1', content: 'Content 1' },
    { id: 'tab2', label: 'Tab 2', content: 'Content 2' },
    { id: 'tab3', label: 'Tab 3', content: 'Content 3' },
  ];

  const customStyle = { borderRadius: '8px', padding: '12px' };
  const combinedStyle = { color: 'blue', fontSize: '14px' };

  // Вынесенные массивы для соблюдения ESLint правил
  const itemsWithDisabled: readonly TabItem[] = [
    { id: 'tab1', label: 'Tab 1', content: 'Content 1' },
    { id: 'tab2', label: 'Tab 2', content: 'Content 2', disabled: true },
    { id: 'tab3', label: 'Tab 3', content: 'Content 3' },
  ];

  const itemsWithData: readonly TabItem[] = [
    { id: 'tab1', label: 'Tab 1', content: 'Content 1', data: { 'data-custom': 'tab1-value' } },
    { id: 'tab2', label: 'Tab 2', content: 'Content 2' },
  ];

  const itemsWithReactContent: readonly TabItem[] = [
    { id: 'tab1', label: 'Tab 1', content: <span data-testid='react-content'>React Content</span> },
    { id: 'tab2', label: 'Tab 2', content: 'String Content' },
  ];

  const emptyItems: readonly TabItem[] = [];

  const singleItem: readonly TabItem[] = [
    { id: 'tab1', label: 'Tab 1', content: 'Content 1' },
  ];

  const itemsWithNullContent: readonly TabItem[] = [
    { id: 'tab1', label: 'Tab 1', content: null },
    { id: 'tab2', label: 'Tab 2', content: 'Content 2' },
  ];

  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLDivElement>();

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getTabs } = renderIsolated(
        <Tabs items={testItems} />,
      );

      expect(container).toBeInTheDocument();
      expect(getTabs()).toBeInTheDocument();
    });

    it('создает div элемент с правильными атрибутами по умолчанию', () => {
      const { getTabs, getTabList } = renderIsolated(
        <Tabs items={testItems} />,
      );

      const tabs = getTabs();
      expect(tabs).toBeInTheDocument();
      expect(tabs.tagName).toBe('DIV');
      expect(tabs).toHaveAttribute('data-component', 'CoreTabs');
      expect(tabs).toHaveAttribute('data-orientation', 'horizontal');
      expect(tabs).toHaveAttribute('aria-label', 'Tabs');

      const tabList = getTabList();
      expect(tabList).toBeInTheDocument();
      expect(tabList.tagName).toBe('UL');
      expect(tabList).toHaveAttribute('role', 'tablist');
      expect(tabList).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('рендерит правильное количество табов', () => {
      const { getTabButtons } = renderIsolated(
        <Tabs items={testItems} />,
      );

      const buttons = getTabButtons();
      expect(buttons).toHaveLength(3);
    });

    it('рендерит контент активного таба', () => {
      const { getTabPanel } = renderIsolated(
        <Tabs items={testItems} activeTabId='tab1' />,
      );

      const panel = getTabPanel();
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveTextContent('Content 1');
    });
  });

  describe('4.2. Пропсы компонента', () => {
    it('применяет className к контейнеру', () => {
      const { getTabs } = renderIsolated(
        <Tabs items={testItems} className='custom-class' />,
      );

      expect(getTabs()).toHaveClass('custom-class');
    });

    it('применяет style к контейнеру', () => {
      const { getTabs } = renderIsolated(
        <Tabs items={testItems} style={customStyle} />,
      );

      const tabs = getTabs();
      expect(tabs).toHaveStyle(customStyle);
    });

    it('применяет data-testid', () => {
      const { getByTestId } = renderIsolated(
        <Tabs items={testItems} data-testid='custom-test-id' />,
      );

      expect(getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('поддерживает кастомный aria-label', () => {
      const { getTabs } = renderIsolated(
        <Tabs items={testItems} aria-label='Custom tabs' />,
      );

      expect(getTabs()).toHaveAttribute('aria-label', 'Custom tabs');
    });

    it('поддерживает aria-labelledby с приоритетом над aria-label', () => {
      const { getTabs } = renderIsolated(
        <Tabs
          items={testItems}
          aria-label='Custom tabs'
          aria-labelledby='tabs-heading'
        />,
      );

      const tabs = getTabs();
      expect(tabs).toHaveAttribute('aria-labelledby', 'tabs-heading');
      expect(tabs).not.toHaveAttribute('aria-label');
    });

    it('использует дефолтный aria-label когда не указаны aria-label и aria-labelledby', () => {
      const { getTabs } = renderIsolated(
        <Tabs items={testItems} />,
      );

      expect(getTabs()).toHaveAttribute('aria-label', 'Tabs');
    });
  });

  describe('4.3. Ориентация', () => {
    it('применяет horizontal ориентацию по умолчанию', () => {
      const { getTabs, getTabList } = renderIsolated(
        <Tabs items={testItems} />,
      );

      expect(getTabs()).toHaveAttribute('data-orientation', 'horizontal');
      expect(getTabList()).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('применяет vertical ориентацию', () => {
      const { getTabs, getTabList } = renderIsolated(
        <Tabs items={testItems} orientation='vertical' />,
      );

      expect(getTabs()).toHaveAttribute('data-orientation', 'vertical');
      expect(getTabList()).toHaveAttribute('aria-orientation', 'vertical');
    });

    it('применяет правильные стили для vertical ориентации', () => {
      const { getTabList, getTabPanel } = renderIsolated(
        <Tabs items={testItems} orientation='vertical' activeTabId='tab1' />,
      );

      const tabList = getTabList();
      const panel = getTabPanel();

      // Проверяем что стили применены (через inline styles)
      expect(tabList).toHaveStyle({ flexDirection: 'column' });
      expect(panel).toHaveStyle({ marginLeft: '16px' });
    });
  });

  describe('4.4. Активный таб', () => {
    it('использует первый таб как активный по умолчанию', () => {
      const { getTabButtons, getTabPanel } = renderIsolated(
        <Tabs items={testItems} />,
      );

      const buttons = getTabButtons();
      expect(buttons[0]).toHaveAttribute('aria-selected', 'true');
      expect(buttons[1]).toHaveAttribute('aria-selected', 'false');
      expect(buttons[2]).toHaveAttribute('aria-selected', 'false');

      const panel = getTabPanel();
      expect(panel).toHaveTextContent('Content 1');
    });

    it('использует указанный activeTabId', () => {
      const { getTabButtons, getTabPanel } = renderIsolated(
        <Tabs items={testItems} activeTabId='tab2' />,
      );

      const buttons = getTabButtons();
      expect(buttons[0]).toHaveAttribute('aria-selected', 'false');
      expect(buttons[1]).toHaveAttribute('aria-selected', 'true');
      expect(buttons[2]).toHaveAttribute('aria-selected', 'false');

      const panel = getTabPanel();
      expect(panel).toHaveTextContent('Content 2');
    });

    it('использует первый таб если activeTabId не найден', () => {
      const { getTabButtons, getTabPanel } = renderIsolated(
        <Tabs items={testItems} activeTabId='nonexistent' />,
      );

      const buttons = getTabButtons();
      expect(buttons[0]).toHaveAttribute('aria-selected', 'true');

      const panel = getTabPanel();
      expect(panel).toHaveTextContent('Content 1');
    });

    it('не рендерит панель если контент null', () => {
      const { getTabPanel } = renderIsolated(
        <Tabs items={itemsWithNullContent} activeTabId='tab1' />,
      );

      expect(getTabPanel()).toBeNull();
    });
  });

  describe('4.5. Табы рендеринг', () => {
    it('рендерит все табы с правильными атрибутами', () => {
      const { getTabButtons } = renderIsolated(
        <Tabs items={testItems} activeTabId='tab1' />,
      );

      const buttons = getTabButtons();
      expect(buttons).toHaveLength(3);

      testItems.forEach((item, index) => {
        const button = buttons[index]!;
        expect(button).toHaveTextContent(item.label);
        expect(button).toHaveAttribute('role', 'tab');
        expect(button).toHaveAttribute('data-tab-id', item.id);
        expect(button).toHaveAttribute('id', `tab-${item.id}`);
        expect(button).toHaveAttribute('aria-controls', `tabpanel-${item.id}`);
        expect(button).toHaveAttribute('aria-selected', index === 0 ? 'true' : 'false');
      });
    });

    it('рендерит disabled табы с правильными атрибутами', () => {
      const { getTabButtons } = renderIsolated(
        <Tabs items={itemsWithDisabled} activeTabId='tab1' />,
      );

      const buttons = getTabButtons();
      expect(buttons[0]).not.toBeDisabled();
      expect(buttons[0]).toHaveAttribute('aria-disabled', 'false');
      expect(buttons[1]).toBeDisabled();
      expect(buttons[1]).toHaveAttribute('aria-disabled', 'true');
      expect(buttons[2]).not.toBeDisabled();
      expect(buttons[2]).toHaveAttribute('aria-disabled', 'false');
    });

    it('применяет data атрибуты к табам', () => {
      const { getTabButtons } = renderIsolated(
        <Tabs items={itemsWithData} />,
      );

      const buttons = getTabButtons();
      expect(buttons[0]).toHaveAttribute('data-custom', 'tab1-value');
      expect(buttons[1]).not.toHaveAttribute('data-custom');
    });

    it('рендерит табы внутри li элементов с role="presentation"', () => {
      const { container } = renderIsolated(
        <Tabs items={testItems} />,
      );

      const listItems = container.querySelectorAll('li[role="presentation"]');
      expect(listItems).toHaveLength(3);
    });
  });

  describe('4.6. Контент таба', () => {
    it('отображает строковый контент', () => {
      const { getTabPanel } = renderIsolated(
        <Tabs items={testItems} activeTabId='tab1' />,
      );

      const panel = getTabPanel();
      expect(panel).toHaveTextContent('Content 1');
    });

    it('отображает React элемент как контент', () => {
      const { getByTestId } = renderIsolated(
        <Tabs items={itemsWithReactContent} activeTabId='tab1' />,
      );

      expect(getByTestId('react-content')).toBeInTheDocument();
      expect(getByTestId('react-content')).toHaveTextContent('React Content');
    });

    it('обновляет контент при смене активного таба', () => {
      const { getTabPanel, rerender } = renderIsolated(
        <Tabs items={testItems} activeTabId='tab1' />,
      );

      expect(getTabPanel()).toHaveTextContent('Content 1');

      rerender(<Tabs items={testItems} activeTabId='tab2' />);

      expect(getTabPanel()).toHaveTextContent('Content 2');
    });

    it('рендерит панель с правильными ARIA атрибутами', () => {
      const { getTabPanel } = renderIsolated(
        <Tabs items={testItems} activeTabId='tab1' />,
      );

      const panel = getTabPanel();
      expect(panel).toHaveAttribute('role', 'tabpanel');
      expect(panel).toHaveAttribute('id', 'tabpanel-tab1');
      expect(panel).toHaveAttribute('aria-labelledby', 'tab-tab1');
    });
  });

  describe('4.7. onChange обработка', () => {
    it('вызывает onChange при клике на таб', () => {
      const mockOnChange = vi.fn();
      const { getTabButtons } = renderIsolated(
        <Tabs items={testItems} onChange={mockOnChange} />,
      );

      const buttons = getTabButtons();
      fireEvent.click(buttons[1]!);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('tab2', expect.any(Object));
    });

    it('не вызывает onChange для disabled табов', () => {
      const mockOnChange = vi.fn();
      const { getTabButtons } = renderIsolated(
        <Tabs items={itemsWithDisabled} onChange={mockOnChange} activeTabId='tab1' />,
      );

      const buttons = getTabButtons();
      fireEvent.click(buttons[1]!); // Disabled таб

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('не вызывает onChange если onChange не передан', () => {
      const { getTabButtons } = renderIsolated(
        <Tabs items={testItems} />,
      );

      const buttons = getTabButtons();
      expect(() => fireEvent.click(buttons[1]!)).not.toThrow();
    });

    it('читает tabId из data-tab-id атрибута', () => {
      const mockOnChange = vi.fn();
      const { getTabButtons } = renderIsolated(
        <Tabs items={testItems} onChange={mockOnChange} />,
      );

      const buttons = getTabButtons();
      fireEvent.click(buttons[2]!);

      expect(mockOnChange).toHaveBeenCalledWith('tab3', expect.any(Object));
    });

    it('не вызывает onChange если data-tab-id отсутствует', () => {
      const mockOnChange = vi.fn();
      const { getTabButtons } = renderIsolated(
        <Tabs items={testItems} onChange={mockOnChange} />,
      );

      const buttons = getTabButtons();
      const button = buttons[0]!;
      button.removeAttribute('data-tab-id');

      fireEvent.click(button);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('4.8. Ref forwarding', () => {
    it('передает ref к контейнеру', () => {
      const mockRef = createMockRef();

      renderIsolated(
        <Tabs ref={mockRef} items={testItems} />,
      );

      expect(mockRef.current).toBeInstanceOf(HTMLDivElement);
      expect(mockRef.current?.tagName).toBe('DIV');
      expect(mockRef.current).toHaveAttribute('data-component', 'CoreTabs');
    });

    it('поддерживает callback ref', () => {
      const refCallback = vi.fn();

      renderIsolated(
        <Tabs ref={refCallback} items={testItems} />,
      );

      expect(refCallback).toHaveBeenCalledTimes(1);
      expect(refCallback.mock.calls[0]?.[0]).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('4.9. Edge cases', () => {
    it('работает с пустым массивом items', () => {
      const { getTabList, getTabPanel } = renderIsolated(
        <Tabs items={emptyItems} />,
      );

      const tabList = getTabList();
      expect(tabList.children).toHaveLength(0);

      expect(getTabPanel()).toBeNull();
    });

    it('работает с одним табом', () => {
      const { getTabButtons, getTabPanel } = renderIsolated(
        <Tabs items={singleItem} />,
      );

      const buttons = getTabButtons();
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAttribute('aria-selected', 'true');

      const panel = getTabPanel();
      expect(panel).toHaveTextContent('Content 1');
    });

    it('работает когда activeTabId не указан', () => {
      const { getTabButtons, getTabPanel } = renderIsolated(
        <Tabs items={testItems} />,
      );

      const buttons = getTabButtons();
      expect(buttons[0]).toHaveAttribute('aria-selected', 'true');

      const panel = getTabPanel();
      expect(panel).toHaveTextContent('Content 1');
    });

    it('работает когда items пустой и activeTabId указан', () => {
      const { getTabPanel } = renderIsolated(
        <Tabs items={emptyItems} activeTabId='tab1' />,
      );

      expect(getTabPanel()).toBeNull();
    });
  });

  describe('4.10. Style и className inheritance', () => {
    it('передает дополнительные пропсы к контейнеру', () => {
      const { getTabs } = renderIsolated(
        <Tabs
          items={testItems}
          data-custom='test-value'
          title='Custom title'
        />,
      );

      const tabs = getTabs();
      expect(tabs).toHaveAttribute('data-custom', 'test-value');
      expect(tabs).toHaveAttribute('title', 'Custom title');
    });

    it('объединяет стили правильно', () => {
      const { getTabs } = renderIsolated(
        <Tabs
          items={testItems}
          style={combinedStyle}
        />,
      );

      const tabs = getTabs();
      expect(tabs).toHaveStyle({ color: 'rgb(0, 0, 255)', fontSize: '14px' });
    });

    it('применяет правильные стили для активного таба', () => {
      const { getTabButtons } = renderIsolated(
        <Tabs items={testItems} activeTabId='tab1' />,
      );

      const buttons = getTabButtons();
      const activeButton = buttons[0]!;
      const inactiveButton = buttons[1]!;

      // Проверяем что стили применены (через inline styles)
      expect(activeButton).toHaveStyle({ fontWeight: '600' });
      expect(inactiveButton).toHaveStyle({ fontWeight: 'normal' });
    });

    it('применяет правильные стили для disabled таба', () => {
      const { getTabButtons } = renderIsolated(
        <Tabs items={itemsWithDisabled} activeTabId='tab1' />,
      );

      const buttons = getTabButtons();
      const disabledButton = buttons[1]!;

      // Проверяем что стили применены (через inline styles)
      expect(disabledButton).toHaveStyle({ opacity: '0.5' });
      expect(disabledButton).toHaveStyle({ cursor: 'not-allowed' });
    });
  });

  describe('4.11. Memoization', () => {
    it('не перерендеривается при неизменных пропсах', () => {
      const { rerender, getTabButtons } = renderIsolated(
        <Tabs items={testItems} activeTabId='tab1' />,
      );

      const firstRenderButtons = getTabButtons();

      rerender(<Tabs items={testItems} activeTabId='tab1' />);

      const secondRenderButtons = getTabButtons();
      // Проверяем что элементы те же (memo работает)
      expect(firstRenderButtons[0]).toBe(secondRenderButtons[0]);
    });

    it('перерендеривается при изменении activeTabId', () => {
      const { rerender, getTabButtons } = renderIsolated(
        <Tabs items={testItems} activeTabId='tab1' />,
      );

      const firstRenderButtons = getTabButtons();
      expect(firstRenderButtons[0]).toHaveAttribute('aria-selected', 'true');

      rerender(<Tabs items={testItems} activeTabId='tab2' />);

      const secondRenderButtons = getTabButtons();
      expect(secondRenderButtons[0]).toHaveAttribute('aria-selected', 'false');
      expect(secondRenderButtons[1]).toHaveAttribute('aria-selected', 'true');
    });
  });
});
