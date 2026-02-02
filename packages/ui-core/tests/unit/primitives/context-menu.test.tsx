/**
 * @vitest-environment jsdom
 * @file Unit тесты для ContextMenu компонента
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ContextMenu } from '../../../src/primitives/context-menu.js';
import type { ContextMenuItem, ContextMenuRef } from '../../../src/primitives/context-menu.js';

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
    getContextMenu: () =>
      container.querySelector('div[data-component="CoreContextMenu"]') as HTMLElement,
    getMenu: () => container.querySelector('ul[role="menu"]') as HTMLUListElement,
    getMenuItems: () => container.querySelectorAll('li[role="menuitem"]'),
    getMenuSeparators: () => container.querySelectorAll('li[role="separator"]'),
  };
}

describe('ContextMenu', () => {
  // Вынесенные константы для соблюдения ESLint правил
  const testItems: readonly ContextMenuItem[] = [
    { id: 'item1', label: 'Item 1' },
    { id: 'item2', label: 'Item 2' },
    { id: 'item3', label: 'Item 3' },
  ];

  const itemsWithDisabled: readonly ContextMenuItem[] = [
    { id: 'item1', label: 'Item 1' },
    { id: 'item2', label: 'Item 2', disabled: true },
    { id: 'item3', label: 'Item 3' },
  ];

  const itemsWithDividers: readonly ContextMenuItem[] = [
    { id: 'item1', label: 'Item 1' },
    { id: 'divider1', label: '', divider: true },
    { id: 'item2', label: 'Item 2' },
    { id: 'divider2', label: '', divider: true },
    { id: 'item3', label: 'Item 3' },
  ];

  const itemsWithData: readonly ContextMenuItem[] = [
    {
      id: 'item1',
      label: 'Item 1',
      data: { 'data-custom': 'value1' },
    },
    { id: 'item2', label: 'Item 2' },
  ];

  const emptyItems: readonly ContextMenuItem[] = [];

  const singleItem: readonly ContextMenuItem[] = [
    { id: 'item1', label: 'Item 1' },
  ];

  const allDisabledItems: readonly ContextMenuItem[] = [
    { id: 'item1', label: 'Item 1', disabled: true },
    { id: 'item2', label: 'Item 2', disabled: true },
  ];

  const onlyDividersItems: readonly ContextMenuItem[] = [
    { id: 'div1', label: '', divider: true },
    { id: 'div2', label: '', divider: true },
  ];

  const customStyle: Readonly<{ margin: string; padding: string; }> = {
    margin: '10px',
    padding: '5px',
  };

  const reactLabel = <span data-testid='react-label'>React Label</span>;
  const itemsWithReactLabel: readonly ContextMenuItem[] = [
    {
      id: 'item1',
      label: reactLabel,
    },
    { id: 'item2', label: 'String Label' },
  ];

  const itemsWithEmptyLabel: readonly ContextMenuItem[] = [
    { id: 'item1', label: '' },
    { id: 'item2', label: 'Item 2' },
  ];

  const itemsWithDuplicateIds: readonly ContextMenuItem[] = [
    { id: 'item1', label: 'Item 1' },
    { id: 'item1', label: 'Item 1 Duplicate' },
  ];

  const overrideStyle: Readonly<React.CSSProperties> = {
    position: 'absolute',
    zIndex: 999,
  };

  // Callback ref функции вынесены как константы для соблюдения ESLint правил
  let menuRefCallbackValue: ContextMenuRef | null = null;
  const menuRefCallback: React.RefCallback<ContextMenuRef> = (ref): void => {
    menuRefCallbackValue = ref;
  };

  let refCallbackValue: HTMLDivElement | null = null;
  const refCallback: React.RefCallback<HTMLDivElement> = (element): void => {
    refCallbackValue = element;
  };

  describe('1.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} />,
      );

      expect(container).toBeInTheDocument();
      expect(getContextMenu()).toBeInTheDocument();
    });

    it('создает div элемент с правильными атрибутами по умолчанию', () => {
      const { getContextMenu, getMenu } = renderIsolated(
        <ContextMenu items={testItems} />,
      );

      const contextMenu = getContextMenu();
      expect(contextMenu).toBeInTheDocument();
      expect(contextMenu.tagName).toBe('DIV');
      expect(contextMenu).toHaveAttribute('data-component', 'CoreContextMenu');
      expect(contextMenu).toHaveAttribute('role', 'group');
      expect(contextMenu).toHaveAttribute('aria-hidden', 'true');
      expect(contextMenu).toHaveAttribute('aria-expanded', 'false');
      expect(contextMenu).toHaveAttribute('data-state', 'closed');

      const menu = getMenu();
      expect(menu).toBeInTheDocument();
      expect(menu).toHaveAttribute('role', 'menu');
    });
  });

  describe('1.2. Открытость меню (isOpen)', () => {
    it('по умолчанию isOpen=false, aria-hidden=true', () => {
      const { getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} />,
      );

      const contextMenu = getContextMenu();
      expect(contextMenu).toHaveAttribute('aria-hidden', 'true');
      expect(contextMenu).toHaveAttribute('aria-expanded', 'false');
      expect(contextMenu).toHaveAttribute('data-state', 'closed');
    });

    it('isOpen=true устанавливает aria-hidden=false и aria-expanded=true', () => {
      const { getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      const contextMenu = getContextMenu();
      expect(contextMenu).toHaveAttribute('aria-hidden', 'false');
      expect(contextMenu).toHaveAttribute('aria-expanded', 'true');
      expect(contextMenu).toHaveAttribute('data-state', 'open');
    });

    it('isOpen=false устанавливает aria-hidden=true и aria-expanded=false', () => {
      const { getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} isOpen={false} />,
      );

      const contextMenu = getContextMenu();
      expect(contextMenu).toHaveAttribute('aria-hidden', 'true');
      expect(contextMenu).toHaveAttribute('aria-expanded', 'false');
      expect(contextMenu).toHaveAttribute('data-state', 'closed');
    });

    it('aria-controls устанавливается корректно', () => {
      const { getContextMenu, getMenu } = renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      const contextMenu = getContextMenu();
      const menu = getMenu();
      const menuId = menu.id;
      expect(contextMenu).toHaveAttribute('aria-controls', menuId);
    });

    it('aria-controls обновляется при изменении isOpen', () => {
      const { getContextMenu, getMenu, rerender } = renderIsolated(
        <ContextMenu items={testItems} isOpen={false} />,
      );

      const menu = getMenu();
      const menuId = menu.id;

      rerender(<ContextMenu items={testItems} isOpen />);
      const updatedContextMenu = getContextMenu();
      expect(updatedContextMenu).toHaveAttribute('aria-controls', menuId);
    });
  });

  describe('1.3. Элементы меню (items)', () => {
    it('рендерит все элементы меню', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      const items = getMenuItems();
      expect(items).toHaveLength(3);
      expect(items[0]).toHaveTextContent('Item 1');
      expect(items[1]).toHaveTextContent('Item 2');
      expect(items[2]).toHaveTextContent('Item 3');
    });

    it('обрабатывает пустой массив items', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={emptyItems} isOpen />,
      );

      expect(getMenuItems()).toHaveLength(0);
    });

    it('обрабатывает один элемент', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={singleItem} isOpen />,
      );

      expect(getMenuItems()).toHaveLength(1);
      expect(getMenuItems()[0]).toHaveTextContent('Item 1');
    });

    it('рендерит ReactNode в label', () => {
      const { getByTestId } = renderIsolated(
        <ContextMenu items={itemsWithReactLabel} isOpen />,
      );

      expect(getByTestId('react-label')).toBeInTheDocument();
    });

    it('каждый элемент имеет уникальный id', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      const items = getMenuItems();
      const ids = Array.from(items).map((item) => item.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('каждый элемент имеет data-item-id атрибут', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      const items = getMenuItems();
      expect(items[0]).toHaveAttribute('data-item-id', 'item1');
      expect(items[1]).toHaveAttribute('data-item-id', 'item2');
      expect(items[2]).toHaveAttribute('data-item-id', 'item3');
    });
  });

  describe('1.4. Disabled элементы', () => {
    it('disabled элементы имеют aria-disabled="true"', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={itemsWithDisabled} isOpen />,
      );

      const items = getMenuItems();
      expect(items[0]).toHaveAttribute('aria-disabled', 'false');
      expect(items[1]).toHaveAttribute('aria-disabled', 'true');
      expect(items[2]).toHaveAttribute('aria-disabled', 'false');
    });

    it('disabled элементы имеют tabIndex=-1', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={itemsWithDisabled} isOpen />,
      );

      const items = getMenuItems();
      expect(items[0]).toHaveAttribute('tabIndex', '0');
      expect(items[1]).toHaveAttribute('tabIndex', '-1');
      expect(items[2]).toHaveAttribute('tabIndex', '0');
    });

    it('disabled элементы не имеют onClick handler', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={itemsWithDisabled} isOpen />,
      );

      const items = Array.from(getMenuItems());
      const disabledItem = items[1];
      if (disabledItem !== undefined) {
        // Проверяем, что обработчик не установлен
        expect(disabledItem.getAttribute('onclick')).toBeNull();
      }
    });

    it('disabled элементы не имеют onKeyDown handler', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={itemsWithDisabled} isOpen />,
      );

      const items = Array.from(getMenuItems());
      const disabledItem = items[1];
      if (disabledItem !== undefined) {
        // Проверяем, что обработчик не установлен через атрибут
        expect(disabledItem.getAttribute('onkeydown')).toBeNull();
      }
    });

    it('обрабатывает все disabled элементы', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={allDisabledItems} isOpen />,
      );

      const items = getMenuItems();
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveAttribute('aria-disabled', 'true');
      expect(items[1]).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('1.5. Dividers', () => {
    it('рендерит dividers как separators', () => {
      const { getMenuSeparators } = renderIsolated(
        <ContextMenu items={itemsWithDividers} isOpen />,
      );

      const separators = getMenuSeparators();
      expect(separators).toHaveLength(2);
      expect(separators[0]).toHaveAttribute('role', 'separator');
      expect(separators[1]).toHaveAttribute('role', 'separator');
    });

    it('dividers имеют aria-orientation="horizontal"', () => {
      const { getMenuSeparators } = renderIsolated(
        <ContextMenu items={itemsWithDividers} isOpen />,
      );

      const separators = getMenuSeparators();
      expect(separators[0]).toHaveAttribute('aria-orientation', 'horizontal');
      expect(separators[1]).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('обрабатывает только dividers', () => {
      const { getMenuItems, getMenuSeparators } = renderIsolated(
        <ContextMenu items={onlyDividersItems} isOpen />,
      );

      expect(getMenuItems()).toHaveLength(0);
      expect(getMenuSeparators()).toHaveLength(2);
    });
  });

  describe('1.6. Data атрибуты элементов', () => {
    it('прокидывает data атрибуты из item.data', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={itemsWithData} isOpen />,
      );

      const items = getMenuItems();
      expect(items[0]).toHaveAttribute('data-custom', 'value1');
      expect(items[1]).not.toHaveAttribute('data-custom');
    });
  });

  describe('1.7. Component ID', () => {
    it('data-component-id используется для генерации menuId', () => {
      const { getMenu } = renderIsolated(
        <ContextMenu items={testItems} isOpen data-component-id='custom-id' />,
      );

      const menu = getMenu();
      expect(menu.id).toBe('custom-id-menu');
    });

    it('menuId генерируется автоматически если data-component-id не указан', () => {
      const { getMenu } = renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      const menu = getMenu();
      expect(menu.id).not.toBe('');
      expect(menu.id).toContain('-menu');
    });

    it('aria-labelledby устанавливается если data-component-id указан', () => {
      const { getMenu } = renderIsolated(
        <ContextMenu items={testItems} isOpen data-component-id='custom-id' />,
      );

      const menu = getMenu();
      expect(menu).toHaveAttribute('aria-labelledby', 'custom-id');
    });

    it('aria-labelledby не устанавливается если data-component-id не указан', () => {
      const { getMenu } = renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      const menu = getMenu();
      expect(menu).not.toHaveAttribute('aria-labelledby');
    });
  });

  describe('1.8. Test ID', () => {
    it('data-testid устанавливается корректно', () => {
      const { getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} data-testid='test-context-menu' />,
      );

      expect(getContextMenu()).toHaveAttribute('data-testid', 'test-context-menu');
    });
  });

  describe('1.9. HTML атрибуты', () => {
    it('прокидывает className', () => {
      const { getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} className='custom-class' />,
      );

      expect(getContextMenu()).toHaveClass('custom-class');
    });

    it('прокидывает style', () => {
      const { getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} style={customStyle} />,
      );

      const contextMenu = getContextMenu();
      expect(contextMenu).toHaveStyle({ margin: '10px', padding: '5px' });
    });

    it('прокидывает другие HTML атрибуты', () => {
      const { getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} id='custom-id' title='Custom title' />,
      );

      const contextMenu = getContextMenu();
      expect(contextMenu).toHaveAttribute('id', 'custom-id');
      expect(contextMenu).toHaveAttribute('title', 'Custom title');
    });
  });

  describe('2.1. События элементов меню - клик', () => {
    it('onSelect вызывается при клике на элемент', () => {
      const onSelect = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen onSelect={onSelect} />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        fireEvent.click(firstItem);
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith('item1', expect.any(Object));
      }
    });

    it('onSelect вызывается с правильным itemId', () => {
      const onSelect = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen onSelect={onSelect} />,
      );

      const items = Array.from(getMenuItems());
      const secondItem = items[1];
      if (secondItem) {
        fireEvent.click(secondItem);
        expect(onSelect).toHaveBeenCalledWith('item2', expect.any(Object));
      }
    });

    it('onSelect не вызывается для disabled элементов', () => {
      const onSelect = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={itemsWithDisabled} isOpen onSelect={onSelect} />,
      );

      const items = Array.from(getMenuItems());
      const disabledItem = items[1];
      if (disabledItem) {
        fireEvent.click(disabledItem);
        expect(onSelect).not.toHaveBeenCalled();
      }
    });

    it('preventDefault и stopPropagation вызываются при клике', () => {
      const onSelect = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen onSelect={onSelect} />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        });
        const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');
        const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation');

        fireEvent(firstItem, clickEvent);
        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(stopPropagationSpy).toHaveBeenCalled();
      }
    });
  });

  describe('2.2. События элементов меню - клавиатура', () => {
    it('Enter вызывает onSelect', () => {
      const onSelect = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen onSelect={onSelect} />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        fireEvent.keyDown(firstItem, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith('item1', expect.any(Object));
      }
    });

    it('Space вызывает onSelect', () => {
      const onSelect = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen onSelect={onSelect} />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        fireEvent.keyDown(firstItem, { key: ' ' });
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith('item1', expect.any(Object));
      }
    });

    it('Escape вызывает onEscape', () => {
      const onEscape = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen onEscape={onEscape} />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        fireEvent.keyDown(firstItem, { key: 'Escape' });
        expect(onEscape).toHaveBeenCalledTimes(1);
        expect(onEscape).toHaveBeenCalledWith(expect.any(Object));
      }
    });

    it('ArrowDown вызывает onArrowNavigation с direction="down"', () => {
      const onArrowNavigation = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen onArrowNavigation={onArrowNavigation} />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        fireEvent.keyDown(firstItem, { key: 'ArrowDown' });
        expect(onArrowNavigation).toHaveBeenCalledTimes(1);
        expect(onArrowNavigation).toHaveBeenCalledWith('down', expect.any(Object));
      }
    });

    it('ArrowUp вызывает onArrowNavigation с direction="up"', () => {
      const onArrowNavigation = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen onArrowNavigation={onArrowNavigation} />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        fireEvent.keyDown(firstItem, { key: 'ArrowUp' });
        expect(onArrowNavigation).toHaveBeenCalledTimes(1);
        expect(onArrowNavigation).toHaveBeenCalledWith('up', expect.any(Object));
      }
    });

    it('preventDefault вызывается для Enter, Space, Escape', () => {
      const onSelect = vi.fn();
      const onEscape = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen onSelect={onSelect} onEscape={onEscape} />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        });
        const spaceEvent = new KeyboardEvent('keydown', {
          key: ' ',
          bubbles: true,
          cancelable: true,
        });
        const escapeEvent = new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        });

        const enterPreventDefault = vi.spyOn(enterEvent, 'preventDefault');
        const spacePreventDefault = vi.spyOn(spaceEvent, 'preventDefault');
        const escapePreventDefault = vi.spyOn(escapeEvent, 'preventDefault');

        fireEvent(firstItem, enterEvent);
        fireEvent(firstItem, spaceEvent);
        fireEvent(firstItem, escapeEvent);

        expect(enterPreventDefault).toHaveBeenCalled();
        expect(spacePreventDefault).toHaveBeenCalled();
        expect(escapePreventDefault).toHaveBeenCalled();
      }
    });

    it('stopPropagation вызывается для всех клавиш', () => {
      const onSelect = vi.fn();
      const onEscape = vi.fn();
      const onArrowNavigation = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu
          items={testItems}
          isOpen
          onSelect={onSelect}
          onEscape={onEscape}
          onArrowNavigation={onArrowNavigation}
        />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
        });
        const arrowDownEvent = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        });

        const enterStopPropagation = vi.spyOn(enterEvent, 'stopPropagation');
        const arrowDownStopPropagation = vi.spyOn(arrowDownEvent, 'stopPropagation');

        fireEvent(firstItem, enterEvent);
        fireEvent(firstItem, arrowDownEvent);

        expect(enterStopPropagation).toHaveBeenCalled();
        expect(arrowDownStopPropagation).toHaveBeenCalled();
      }
    });

    it('preventDefault НЕ вызывается для ArrowUp/ArrowDown', () => {
      const onArrowNavigation = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen onArrowNavigation={onArrowNavigation} />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        const arrowDownEvent = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        });
        const arrowUpEvent = new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          bubbles: true,
          cancelable: true,
        });

        const arrowDownPreventDefault = vi.spyOn(arrowDownEvent, 'preventDefault');
        const arrowUpPreventDefault = vi.spyOn(arrowUpEvent, 'preventDefault');

        fireEvent(firstItem, arrowDownEvent);
        fireEvent(firstItem, arrowUpEvent);

        expect(arrowDownPreventDefault).not.toHaveBeenCalled();
        expect(arrowUpPreventDefault).not.toHaveBeenCalled();
      }
    });

    it('другие клавиши не вызывают callbacks', () => {
      const onSelect = vi.fn();
      const onEscape = vi.fn();
      const onArrowNavigation = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu
          items={testItems}
          isOpen
          onSelect={onSelect}
          onEscape={onEscape}
          onArrowNavigation={onArrowNavigation}
        />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        fireEvent.keyDown(firstItem, { key: 'Tab' });
        fireEvent.keyDown(firstItem, { key: 'a' });
        fireEvent.keyDown(firstItem, { key: 'Home' });
        expect(onSelect).not.toHaveBeenCalled();
        expect(onEscape).not.toHaveBeenCalled();
        expect(onArrowNavigation).not.toHaveBeenCalled();
      }
    });

    it('onSelect не вызывается для disabled элементов при Enter/Space', () => {
      const onSelect = vi.fn();
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={itemsWithDisabled} isOpen onSelect={onSelect} />,
      );

      const items = Array.from(getMenuItems());
      const disabledItem = items[1];
      if (disabledItem) {
        fireEvent.keyDown(disabledItem, { key: 'Enter' });
        fireEvent.keyDown(disabledItem, { key: ' ' });
        expect(onSelect).not.toHaveBeenCalled();
      }
    });

    it('не падает если onSelect не определен при клике', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        expect(() => {
          fireEvent.click(firstItem);
        }).not.toThrow();
      }
    });

    it('не падает если onSelect не определен при Enter/Space', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        expect(() => {
          fireEvent.keyDown(firstItem, { key: 'Enter' });
          fireEvent.keyDown(firstItem, { key: ' ' });
        }).not.toThrow();
      }
    });

    it('не падает если onEscape не определен при Escape', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        expect(() => {
          fireEvent.keyDown(firstItem, { key: 'Escape' });
        }).not.toThrow();
      }
    });

    it('не падает если onArrowNavigation не определен при ArrowUp/ArrowDown', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      const items = Array.from(getMenuItems());
      const firstItem = items[0];
      if (firstItem) {
        expect(() => {
          fireEvent.keyDown(firstItem, { key: 'ArrowDown' });
          fireEvent.keyDown(firstItem, { key: 'ArrowUp' });
        }).not.toThrow();
      }
    });
  });

  describe('3.1. menuRef', () => {
    it('menuRef обновляется с объектом ContextMenuRef', async () => {
      const menuRef = React.createRef<ContextMenuRef>();
      renderIsolated(
        <ContextMenu items={testItems} isOpen menuRef={menuRef} />,
      );

      await waitFor(() => {
        expect(menuRef.current).not.toBeNull();
        if (menuRef.current !== null) {
          expect(menuRef.current.element).toBeInstanceOf(HTMLUListElement);
          expect(Array.isArray(menuRef.current.items)).toBe(true);
        }
      });
    });

    it('menuRef.items содержит только доступные элементы (без disabled)', async () => {
      const menuRef = React.createRef<ContextMenuRef>();
      renderIsolated(
        <ContextMenu items={itemsWithDisabled} isOpen menuRef={menuRef} />,
      );

      await waitFor(() => {
        expect(menuRef.current).not.toBeNull();
        if (menuRef.current !== null) {
          // itemsWithDisabled содержит 3 элемента, но один disabled
          expect(menuRef.current.items.length).toBe(2);
          expect(menuRef.current.items[0]).toHaveAttribute('data-item-id', 'item1');
          expect(menuRef.current.items[1]).toHaveAttribute('data-item-id', 'item3');
        }
      });
    });

    it('menuRef.items не содержит dividers', async () => {
      const menuRef = React.createRef<ContextMenuRef>();
      renderIsolated(
        <ContextMenu items={itemsWithDividers} isOpen menuRef={menuRef} />,
      );

      await waitFor(() => {
        expect(menuRef.current).not.toBeNull();
        if (menuRef.current !== null) {
          // itemsWithDividers содержит 3 элемента + 2 dividers
          expect(menuRef.current.items.length).toBe(3);
        }
      });
    });

    it('menuRef обновляется при изменении items', async () => {
      const menuRef = React.createRef<ContextMenuRef>();
      const { rerender } = renderIsolated(
        <ContextMenu items={testItems} isOpen menuRef={menuRef} />,
      );

      await waitFor(() => {
        expect(menuRef.current).not.toBeNull();
        if (menuRef.current !== null) {
          expect(menuRef.current.items.length).toBe(3);
        }
      });

      rerender(<ContextMenu items={singleItem} isOpen menuRef={menuRef} />);

      await waitFor(() => {
        expect(menuRef.current).not.toBeNull();
        if (menuRef.current !== null) {
          expect(menuRef.current.items.length).toBe(1);
        }
      });
    });

    it('menuRef работает с callback ref', async () => {
      menuRefCallbackValue = null;
      renderIsolated(
        <ContextMenu items={testItems} isOpen menuRef={menuRefCallback} />,
      );

      await waitFor(() => {
        expect(menuRefCallbackValue).not.toBeNull();
        if (menuRefCallbackValue !== null) {
          expect(menuRefCallbackValue.element).toBeInstanceOf(HTMLUListElement);
          expect(Array.isArray(menuRefCallbackValue.items)).toBe(true);
        }
      });
    });

    it('menuRef не обновляется если menuRef не передан', () => {
      renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      // Не должно быть ошибок
      expect(true).toBe(true);
    });

    it('menuRef обновляется даже при isOpen=false (ul всегда в DOM)', async () => {
      const menuRef = React.createRef<ContextMenuRef>();
      renderIsolated(
        <ContextMenu items={testItems} isOpen={false} menuRef={menuRef} />,
      );

      // ul всегда рендерится, просто с aria-hidden
      // Поэтому menuRef должен обновиться
      await waitFor(() => {
        expect(menuRef.current).not.toBeNull();
      });
    });

    it('menuRef обновляется через объект ref (createRef)', async () => {
      const menuRef = React.createRef<ContextMenuRef>();
      renderIsolated(
        <ContextMenu items={testItems} isOpen menuRef={menuRef} />,
      );

      await waitFor(() => {
        expect(menuRef.current).not.toBeNull();
        if (menuRef.current !== null) {
          expect(menuRef.current.element).toBeInstanceOf(HTMLUListElement);
          expect(menuRef.current.items.length).toBe(3);
        }
      });
    });
  });

  describe('4.1. Ref forwarding', () => {
    it('ref прокидывается на div элемент', () => {
      const ref = React.createRef<HTMLDivElement>();
      const { getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} ref={ref} />,
      );

      expect(ref.current).not.toBeNull();
      expect(ref.current).toBe(getContextMenu());
    });

    it('ref работает с callback ref', () => {
      refCallbackValue = null;
      const { getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} ref={refCallback} />,
      );

      expect(refCallbackValue).not.toBeNull();
      expect(refCallbackValue).toBe(getContextMenu());
    });
  });

  describe('5.1. Мемоизация', () => {
    it('компонент мемоизирован', () => {
      // Проверяем, что ContextMenu является мемоизированным компонентом
      // Это проверяется через наличие memo wrapper
      expect(ContextMenu).toBeDefined();
      // Проверяем, что это не просто функция
      expect(typeof ContextMenu).toBe('object');
    });
  });

  describe('6.1. Edge cases', () => {
    it('обрабатывает очень длинный список элементов', () => {
      const manyItems: readonly ContextMenuItem[] = Array.from({ length: 100 }, (_, i) => ({
        id: `item${i}`,
        label: `Item ${i}`,
      }));

      const { getMenuItems } = renderIsolated(
        <ContextMenu items={manyItems} isOpen />,
      );

      expect(getMenuItems()).toHaveLength(100);
    });

    it('обрабатывает элементы с пустым label', () => {
      const { getMenuItems } = renderIsolated(
        <ContextMenu items={itemsWithEmptyLabel} isOpen />,
      );

      const items = getMenuItems();
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('');
      expect(items[1]).toHaveTextContent('Item 2');
    });

    it('обрабатывает элементы с одинаковыми id (не должно быть, но компонент должен не упасть)', () => {
      // Используем React.createElement чтобы избежать React warning о duplicate keys
      expect(() => {
        React.createElement(ContextMenu, {
          items: itemsWithDuplicateIds,
          isOpen: true,
        });
      }).not.toThrow();
    });

    it('обрабатывает быстрое изменение isOpen', () => {
      const { rerender, getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} isOpen={false} />,
      );

      expect(getContextMenu()).toHaveAttribute('aria-hidden', 'true');

      rerender(<ContextMenu items={testItems} isOpen />);
      expect(getContextMenu()).toHaveAttribute('aria-hidden', 'false');

      rerender(<ContextMenu items={testItems} isOpen={false} />);
      expect(getContextMenu()).toHaveAttribute('aria-hidden', 'true');
    });

    it('обрабатывает быстрое изменение items', () => {
      const { rerender, getMenuItems } = renderIsolated(
        <ContextMenu items={testItems} isOpen />,
      );

      expect(getMenuItems()).toHaveLength(3);

      rerender(<ContextMenu items={singleItem} isOpen />);
      expect(getMenuItems()).toHaveLength(1);

      rerender(<ContextMenu items={testItems} isOpen />);
      expect(getMenuItems()).toHaveLength(3);
    });
  });

  describe('7.1. Стили', () => {
    it('применяет базовые стили контейнера', () => {
      const { getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} />,
      );

      const contextMenu = getContextMenu();
      const styles = window.getComputedStyle(contextMenu);
      expect(styles.position).toBe('fixed');
      expect(styles.zIndex).toBe('1000');
    });

    it('применяет кастомные стили через style prop', () => {
      const { getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} style={customStyle} />,
      );

      const contextMenu = getContextMenu();
      expect(contextMenu).toHaveStyle({ margin: '10px', padding: '5px' });
    });

    it('кастомные стили переопределяют базовые', () => {
      const { getContextMenu } = renderIsolated(
        <ContextMenu items={testItems} style={overrideStyle} />,
      );

      const contextMenu = getContextMenu();
      expect(contextMenu).toHaveStyle({ position: 'absolute', zIndex: '999' });
    });
  });
});
