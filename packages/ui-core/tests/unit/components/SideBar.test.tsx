/**
 * @vitest-environment jsdom
 * @file Unit тесты для SideBar компонента
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SideBar } from '../../../src/components/SideBar.js';
import type { SideBarItem } from '../../../src/components/SideBar.js';

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
    queryByTestId: (testId: Readonly<string>) => within(container).queryByTestId(testId),
    getSideBar: () => container.querySelector('aside[data-component="CoreSideBar"]')!,
    getOverlay: () => container.querySelector('div[role="presentation"][aria-hidden="true"]'),
    getHeader: () => container.querySelector('div[data-testid*="-header"]'),
    getFooter: () => container.querySelector('div[data-testid*="-footer"]'),
    getContent: () => container.querySelector('nav[role="menu"]'),
    getItems: () => container.querySelectorAll('button[role="menuitem"]'),
  };
}

describe('SideBar', () => {
  // Общие тестовые переменные
  const testItems: readonly SideBarItem[] = [
    { id: 'item1', label: 'Item 1', icon: <span data-testid='icon1'>📁</span> },
    { id: 'item2', label: 'Item 2', icon: <span data-testid='icon2'>📄</span> },
    { id: 'item3', label: 'Item 3' },
  ];

  const itemsWithActive: readonly SideBarItem[] = [
    { id: 'item1', label: 'Item 1', active: true },
    { id: 'item2', label: 'Item 2', active: false },
    { id: 'item3', label: 'Item 3' },
  ];

  const itemsWithDisabled: readonly SideBarItem[] = [
    { id: 'item1', label: 'Item 1' },
    { id: 'item2', label: 'Item 2', disabled: true },
    { id: 'item3', label: 'Item 3' },
  ];

  const itemsWithData: readonly SideBarItem[] = [
    {
      id: 'item1',
      label: 'Item 1',
      data: { 'data-custom': 'item1-value', 'data-other': 'other-value' },
    },
    { id: 'item2', label: 'Item 2' },
  ];

  const emptyItems: readonly SideBarItem[] = [];

  const singleItem: readonly SideBarItem[] = [
    { id: 'item1', label: 'Item 1' },
  ];

  const customStyle = { borderRadius: '8px', padding: '12px' };
  const customCombinedStyle = { backgroundColor: 'red', padding: '20px' };

  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLDivElement>();

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getSideBar } = renderIsolated(<SideBar />);

      expect(container).toBeInTheDocument();
      expect(getSideBar()).toBeInTheDocument();
    });

    it('создает aside элемент с правильными атрибутами по умолчанию', () => {
      const { getSideBar } = renderIsolated(<SideBar />);

      const sidebar = getSideBar();
      expect(sidebar).toBeInTheDocument();
      expect(sidebar.tagName).toBe('ASIDE');
      expect(sidebar).toHaveAttribute('data-component', 'CoreSideBar');
      expect(sidebar).toHaveAttribute('role', 'navigation');
      expect(sidebar).toHaveAttribute('aria-label', 'Sidebar navigation');
      expect(sidebar).toHaveAttribute('data-position', 'left');
      expect(sidebar).not.toHaveAttribute('data-collapsed');
    });

    it('рендерится с items', () => {
      const { getItems } = renderIsolated(<SideBar items={testItems} />);

      const items = getItems();
      expect(items).toHaveLength(3);
    });

    it('рендерится без items (пустой sidebar)', () => {
      const { getItems, getContent } = renderIsolated(<SideBar />);

      const items = getItems();
      expect(items).toHaveLength(0);
      expect(getContent()).toBeInTheDocument();
    });
  });

  describe('4.2. Пропсы компонента', () => {
    it('применяет className к контейнеру', () => {
      const { getSideBar } = renderIsolated(<SideBar className='custom-class' />);

      expect(getSideBar()).toHaveClass('custom-class');
    });

    it('применяет style к контейнеру', () => {
      const { getSideBar } = renderIsolated(<SideBar style={customStyle} />);

      const sidebar = getSideBar();
      expect(sidebar).toHaveStyle(customStyle);
    });

    it('применяет data-testid', () => {
      const { getByTestId } = renderIsolated(<SideBar data-testid='custom-test-id' />);

      expect(getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('не имеет data-testid по умолчанию', () => {
      const { getSideBar } = renderIsolated(<SideBar />);

      expect(getSideBar()).not.toHaveAttribute('data-testid');
    });

    it('прокидывает дополнительные HTML атрибуты', () => {
      const { getSideBar } = renderIsolated(
        <SideBar id='sidebar-id' title='Custom title' data-custom='test-value' />,
      );

      const sidebar = getSideBar();
      expect(sidebar).toHaveAttribute('id', 'sidebar-id');
      expect(sidebar).toHaveAttribute('title', 'Custom title');
      expect(sidebar).toHaveAttribute('data-custom', 'test-value');
    });
  });

  describe('4.3. Состояние collapsed', () => {
    it('не свернут по умолчанию', () => {
      const { getSideBar } = renderIsolated(<SideBar items={testItems} />);

      const sidebar = getSideBar();
      expect(sidebar).not.toHaveAttribute('data-collapsed');
    });

    it('применяет collapsed состояние', () => {
      const { getSideBar } = renderIsolated(<SideBar items={testItems} collapsed={true} />);

      const sidebar = getSideBar();
      expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    });

    it('применяет правильную ширину когда collapsed=false', () => {
      const { getSideBar } = renderIsolated(
        <SideBar items={testItems} collapsed={false} width='300px' />,
      );

      const sidebar = getSideBar();
      expect(sidebar).toHaveStyle({ width: '300px' });
    });

    it('применяет правильную ширину когда collapsed=true', () => {
      const { getSideBar } = renderIsolated(
        <SideBar items={testItems} collapsed={true} collapsedWidth='80px' />,
      );

      const sidebar = getSideBar();
      expect(sidebar).toHaveStyle({ width: '80px' });
    });

    it('использует дефолтную ширину когда collapsed=false', () => {
      const { getSideBar } = renderIsolated(<SideBar items={testItems} collapsed={false} />);

      const sidebar = getSideBar();
      expect(sidebar).toHaveStyle({ width: '280px' });
    });

    it('использует дефолтную ширину когда collapsed=true', () => {
      const { getSideBar } = renderIsolated(<SideBar items={testItems} collapsed={true} />);

      const sidebar = getSideBar();
      expect(sidebar).toHaveStyle({ width: '64px' });
    });

    it('скрывает labels когда collapsed=true', () => {
      const { getItems } = renderIsolated(<SideBar items={testItems} collapsed={true} />);

      const items = getItems();
      items.forEach((item) => {
        const label = item.querySelector('span[style*="whiteSpace"]');
        expect(label).toBeNull();
      });
    });

    it('показывает labels когда collapsed=false', () => {
      const { getItems } = renderIsolated(<SideBar items={testItems} collapsed={false} />);

      const items = getItems();
      items.forEach((item, index) => {
        const testItem = testItems[index];
        const itemLabel = testItem?.label;
        if (itemLabel != null && itemLabel.length > 0) {
          // Label рендерится как span внутри button
          const label = Array.from(item.children).find(
            (child) => child.tagName === 'SPAN' && child.textContent === itemLabel,
          );
          expect(label).toBeDefined();
          expect(label).toHaveTextContent(itemLabel);
        }
      });
    });

    it('применяет правильные стили иконок когда collapsed=true', () => {
      const { getItems } = renderIsolated(
        <SideBar items={testItems} collapsed={true} />,
      );

      const items = getItems();
      items.forEach((item) => {
        const icon = item.querySelector('span[aria-hidden="true"]');
        if (icon) {
          expect(icon).toHaveStyle({ marginRight: '0px' });
        }
      });
    });

    it('применяет правильные стили иконок когда collapsed=false', () => {
      const { getItems } = renderIsolated(
        <SideBar items={testItems} collapsed={false} />,
      );

      const items = getItems();
      items.forEach((item) => {
        const icon = item.querySelector('span[aria-hidden="true"]');
        if (icon) {
          expect(icon).toHaveStyle({ marginRight: '12px' });
        }
      });
    });
  });

  describe('4.4. Позиция (position)', () => {
    it('использует left по умолчанию', () => {
      const { getSideBar } = renderIsolated(<SideBar />);

      expect(getSideBar()).toHaveAttribute('data-position', 'left');
    });

    it('применяет left позицию', () => {
      const { getSideBar } = renderIsolated(<SideBar position='left' />);

      const sidebar = getSideBar();
      expect(sidebar).toHaveAttribute('data-position', 'left');
      expect(sidebar).toHaveStyle({ borderRight: expect.stringContaining('1px solid') });
      // Для left позиции borderLeft не устанавливается в inline стилях
      expect((sidebar as HTMLElement).style.borderLeft).toBe('');
    });

    it('применяет right позицию', () => {
      const { getSideBar } = renderIsolated(<SideBar position='right' />);

      const sidebar = getSideBar();
      expect(sidebar).toHaveAttribute('data-position', 'right');
      expect(sidebar).toHaveStyle({ borderLeft: expect.stringContaining('1px solid') });
      // Проверяем что borderRight установлен как 'none' в inline стилях
      // borderRight: 'none' устанавливается через spread borderStyle
      const computedStyle = window.getComputedStyle(sidebar);
      expect(computedStyle.borderRightStyle).toBe('none');
    });
  });

  describe('4.5. Header и Footer', () => {
    it('не рендерит header когда не передан', () => {
      const { getHeader } = renderIsolated(<SideBar />);

      expect(getHeader()).toBeNull();
    });

    it('рендерит header когда передан', () => {
      const headerContent = <div data-testid='header-content'>Header</div>;
      const { getHeader, getByTestId } = renderIsolated(
        <SideBar header={headerContent} data-testid='sidebar' />,
      );

      expect(getHeader()).toBeInTheDocument();
      expect(getByTestId('header-content')).toBeInTheDocument();
    });

    it('применяет правильный data-testid для header', () => {
      const { getHeader } = renderIsolated(
        <SideBar header='Header' data-testid='sidebar' />,
      );

      expect(getHeader()).toHaveAttribute('data-testid', 'sidebar-header');
    });

    it('не рендерит footer когда не передан', () => {
      const { getFooter } = renderIsolated(<SideBar />);

      expect(getFooter()).toBeNull();
    });

    it('рендерит footer когда передан', () => {
      const footerContent = <div data-testid='footer-content'>Footer</div>;
      const { getFooter, getByTestId } = renderIsolated(
        <SideBar footer={footerContent} data-testid='sidebar' />,
      );

      expect(getFooter()).toBeInTheDocument();
      expect(getByTestId('footer-content')).toBeInTheDocument();
    });

    it('применяет правильный data-testid для footer', () => {
      const { getFooter } = renderIsolated(
        <SideBar footer='Footer' data-testid='sidebar' />,
      );

      expect(getFooter()).toHaveAttribute('data-testid', 'sidebar-footer');
    });

    it('не применяет data-testid для footer когда testId пустой', () => {
      const { container } = renderIsolated(
        <SideBar footer='Footer' data-testid='' />,
      );

      // Ищем footer через его содержимое, так как data-testid не установлен
      const footer = Array.from(container.querySelectorAll('div')).find(
        (div) => div.textContent === 'Footer' && div.style.borderTop !== '',
      );
      expect(footer).toBeDefined();
      expect(footer).not.toHaveAttribute('data-testid');
    });

    it('обновляет aria-label nav когда header присутствует', () => {
      const { getContent } = renderIsolated(<SideBar header='Header' />);

      const nav = getContent();
      expect(nav).toHaveAttribute('aria-label', 'Sidebar menu');
    });

    it('использует дефолтный aria-label nav когда header отсутствует', () => {
      const { getContent } = renderIsolated(<SideBar />);

      const nav = getContent();
      expect(nav).toHaveAttribute('aria-label', 'Sidebar navigation');
    });
  });

  describe('4.6. Overlay', () => {
    it('не рендерит overlay по умолчанию', () => {
      const { getOverlay } = renderIsolated(<SideBar />);

      expect(getOverlay()).toBeNull();
    });

    it('рендерит overlay когда showOverlay=true', () => {
      const { getOverlay } = renderIsolated(<SideBar showOverlay={true} />);

      const overlay = getOverlay();
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute('role', 'presentation');
      expect(overlay).toHaveAttribute('aria-hidden', 'true');
      expect(overlay).toHaveAttribute('tabindex', '-1');
    });

    it('применяет правильные стили overlay', () => {
      const { getOverlay } = renderIsolated(<SideBar showOverlay={true} />);

      const overlay = getOverlay();
      expect(overlay).toHaveStyle({
        position: 'fixed',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        zIndex: '9998',
      });
    });

    it('применяет правильный data-testid для overlay', () => {
      const { getOverlay } = renderIsolated(
        <SideBar showOverlay={true} data-testid='sidebar' />,
      );

      const overlay = getOverlay();
      expect(overlay).toHaveAttribute('data-testid', 'sidebar-overlay');
    });

    it('не применяет data-testid для overlay когда testId пустой', () => {
      const { getOverlay } = renderIsolated(
        <SideBar showOverlay={true} data-testid='' />,
      );

      const overlay = getOverlay();
      expect(overlay).not.toHaveAttribute('data-testid');
    });

    it('вызывает onOverlayClick при клике на overlay', () => {
      const mockOnOverlayClick = vi.fn();
      const { getOverlay } = renderIsolated(
        <SideBar showOverlay={true} onOverlayClick={mockOnOverlayClick} />,
      );

      const overlay = getOverlay();
      fireEvent.click(overlay!);

      expect(mockOnOverlayClick).toHaveBeenCalledTimes(1);
    });

    it('не вызывает onOverlayClick если он не передан', () => {
      const { getOverlay } = renderIsolated(<SideBar showOverlay={true} />);

      const overlay = getOverlay();
      expect(() => fireEvent.click(overlay!)).not.toThrow();
    });
  });

  describe('4.7. Элементы навигации (items)', () => {
    it('рендерит все элементы с правильными атрибутами', () => {
      const { getItems } = renderIsolated(<SideBar items={testItems} />);

      const items = getItems();
      expect(items).toHaveLength(3);

      testItems.forEach((item, index) => {
        const button = items[index]!;
        expect(button).toHaveAttribute('role', 'menuitem');
        expect(button).toHaveAttribute('data-item-id', item.id);
        expect(button).toHaveAttribute('type', 'button');
        expect(button).not.toBeDisabled();
      });
    });

    it('отображает label элементов', () => {
      const { getItems } = renderIsolated(<SideBar items={testItems} />);

      const items = getItems();
      testItems.forEach((item, index) => {
        const button = items[index]!;
        expect(button).toHaveTextContent(item.label);
      });
    });

    it('отображает иконки элементов', () => {
      const { getByTestId } = renderIsolated(<SideBar items={testItems} />);

      expect(getByTestId('icon1')).toBeInTheDocument();
      expect(getByTestId('icon2')).toBeInTheDocument();
    });

    it('не рендерит иконку когда она не передана', () => {
      const { getItems } = renderIsolated(<SideBar items={testItems} />);

      const items = getItems();
      const itemWithoutIcon = items[2]!;
      const icon = itemWithoutIcon.querySelector('span[aria-hidden="true"]');
      expect(icon).toBeNull();
    });

    it('применяет правильные стили для активного элемента', () => {
      const { getItems } = renderIsolated(<SideBar items={itemsWithActive} />);

      const items = getItems();
      const activeItem = items[0]!;
      expect(activeItem).toHaveAttribute('data-active', 'true');
      expect(activeItem).toHaveAttribute('aria-current', 'page');
      expect(activeItem).toHaveStyle({ fontWeight: '600' });
    });

    it('не применяет активные стили для неактивного элемента', () => {
      const { getItems } = renderIsolated(<SideBar items={itemsWithActive} />);

      const items = getItems();
      const inactiveItem = items[1]!;
      expect(inactiveItem).not.toHaveAttribute('data-active');
      expect(inactiveItem).not.toHaveAttribute('aria-current');
    });

    it('применяет правильные стили для disabled элемента', () => {
      const { getItems } = renderIsolated(<SideBar items={itemsWithDisabled} />);

      const items = getItems();
      const disabledItem = items[1]!;
      expect(disabledItem).toBeDisabled();
      expect(disabledItem).toHaveAttribute('aria-disabled', 'true');
      expect(disabledItem).toHaveAttribute('tabindex', '-1');
      expect(disabledItem).toHaveStyle({ opacity: '0.5', cursor: 'not-allowed' });
    });

    it('применяет data атрибуты к элементам', () => {
      const { getItems } = renderIsolated(<SideBar items={itemsWithData} />);

      const items = getItems();
      expect(items[0]).toHaveAttribute('data-custom', 'item1-value');
      expect(items[0]).toHaveAttribute('data-other', 'other-value');
      expect(items[1]).not.toHaveAttribute('data-custom');
    });

    it('применяет aria-label когда collapsed=true', () => {
      const { getItems } = renderIsolated(<SideBar items={testItems} collapsed={true} />);

      const items = getItems();
      testItems.forEach((item, index) => {
        const button = items[index]!;
        expect(button).toHaveAttribute('aria-label', item.label);
      });
    });

    it('не применяет aria-label когда collapsed=false', () => {
      const { getItems } = renderIsolated(<SideBar items={testItems} collapsed={false} />);

      const items = getItems();
      testItems.forEach((_item, index) => {
        const button = items[index]!;
        expect(button).not.toHaveAttribute('aria-label');
      });
    });
  });

  describe('4.8. Обработка кликов (onItemClick)', () => {
    it('вызывает onItemClick при клике на элемент', () => {
      const mockOnItemClick = vi.fn();
      const { getItems } = renderIsolated(
        <SideBar items={testItems} onItemClick={mockOnItemClick} />,
      );

      const items = getItems();
      fireEvent.click(items[0]!);

      expect(mockOnItemClick).toHaveBeenCalledTimes(1);
      expect(mockOnItemClick).toHaveBeenCalledWith('item1');
    });

    it('вызывает onItemClick с правильным itemId', () => {
      const mockOnItemClick = vi.fn();
      const { getItems } = renderIsolated(
        <SideBar items={testItems} onItemClick={mockOnItemClick} />,
      );

      const items = getItems();
      fireEvent.click(items[1]!);

      expect(mockOnItemClick).toHaveBeenCalledWith('item2');
    });

    it('не вызывает onItemClick для disabled элемента', () => {
      const mockOnItemClick = vi.fn();
      const { getItems } = renderIsolated(
        <SideBar items={itemsWithDisabled} onItemClick={mockOnItemClick} />,
      );

      const items = getItems();
      fireEvent.click(items[1]!); // Disabled элемент

      expect(mockOnItemClick).not.toHaveBeenCalled();
    });

    it('не вызывает onItemClick если он не передан', () => {
      const { getItems } = renderIsolated(<SideBar items={testItems} />);

      const items = getItems();
      expect(() => fireEvent.click(items[0]!)).not.toThrow();
    });

    it('не вызывает onItemClick если элемент disabled даже при наличии onItemClick', () => {
      const mockOnItemClick = vi.fn();
      const { getItems } = renderIsolated(
        <SideBar items={itemsWithDisabled} onItemClick={mockOnItemClick} />,
      );

      const items = getItems();
      const disabledItem = items[1]!;
      // Попытка клика на disabled элемент (pointerEvents: none)
      fireEvent.click(disabledItem);

      expect(mockOnItemClick).not.toHaveBeenCalled();
    });
  });

  describe('4.9. Ref forwarding', () => {
    it('передает ref к контейнеру', () => {
      const mockRef = createMockRef();

      renderIsolated(<SideBar ref={mockRef} />);

      expect(mockRef.current).toBeInstanceOf(HTMLElement);
      expect(mockRef.current?.tagName).toBe('ASIDE');
      expect(mockRef.current).toHaveAttribute('data-component', 'CoreSideBar');
    });

    it('поддерживает callback ref', () => {
      const refCallback = vi.fn();

      renderIsolated(<SideBar ref={refCallback} />);

      expect(refCallback).toHaveBeenCalledTimes(1);
      const refValue = refCallback.mock.calls[0]?.[0];
      expect(refValue).toBeInstanceOf(HTMLElement);
      expect(refValue?.tagName).toBe('ASIDE');
    });
  });

  describe('4.10. Edge cases', () => {
    it('работает с пустым массивом items', () => {
      const { getItems, getContent } = renderIsolated(<SideBar items={emptyItems} />);

      const items = getItems();
      expect(items).toHaveLength(0);
      expect(getContent()).toBeInTheDocument();
    });

    it('работает с одним элементом', () => {
      const { getItems } = renderIsolated(<SideBar items={singleItem} />);

      const items = getItems();
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveTextContent('Item 1');
    });

    it('работает с null header', () => {
      const { getHeader } = renderIsolated(<SideBar header={null as any} />);

      expect(getHeader()).toBeNull();
    });

    it('работает с undefined header', () => {
      const { getHeader } = renderIsolated(<SideBar header={undefined as any} />);

      expect(getHeader()).toBeNull();
    });

    it('работает с null footer', () => {
      const { getFooter } = renderIsolated(<SideBar footer={null as any} />);

      expect(getFooter()).toBeNull();
    });

    it('работает с undefined footer', () => {
      const { getFooter } = renderIsolated(<SideBar footer={undefined as any} />);

      expect(getFooter()).toBeNull();
    });

    it('работает с collapsed как false', () => {
      const { getSideBar } = renderIsolated(<SideBar collapsed={false} />);

      expect(getSideBar()).not.toHaveAttribute('data-collapsed');
    });

    it('работает с collapsed как true', () => {
      const { getSideBar } = renderIsolated(<SideBar collapsed={true} />);

      expect(getSideBar()).toHaveAttribute('data-collapsed', 'true');
    });

    it('работает с showOverlay как false', () => {
      const { getOverlay } = renderIsolated(<SideBar showOverlay={false} />);

      expect(getOverlay()).toBeNull();
    });

    it('работает с showOverlay как true', () => {
      const { getOverlay } = renderIsolated(<SideBar showOverlay={true} />);

      expect(getOverlay()).toBeInTheDocument();
    });

    it('работает с кастомными единицами измерения ширины', () => {
      const { getSideBar } = renderIsolated(
        <SideBar width='20rem' collapsedWidth='5rem' />,
      );

      const sidebar = getSideBar();
      expect(sidebar).toHaveStyle({ width: '20rem' });
    });

    it('работает с CSS переменными для ширины', () => {
      const { getSideBar } = renderIsolated(
        <SideBar width='var(--sidebar-width)' collapsedWidth='var(--sidebar-collapsed-width)' />,
      );

      const sidebar = getSideBar();
      expect(sidebar).toHaveStyle({ width: 'var(--sidebar-width)' });
    });
  });

  describe('4.11. Стилизация', () => {
    it('применяет базовые стили sidebar', () => {
      const { getSideBar } = renderIsolated(<SideBar />);

      const sidebar = getSideBar();
      expect(sidebar).toHaveStyle({
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      });
    });

    it('применяет правильные стили для collapsed состояния', () => {
      const { getSideBar } = renderIsolated(<SideBar collapsed={true} />);

      const sidebar = getSideBar();
      const computedStyle = window.getComputedStyle(sidebar);
      expect(computedStyle.overflow).toBe('visible');
    });

    it('применяет правильные стили для expanded состояния', () => {
      const { getSideBar } = renderIsolated(<SideBar collapsed={false} />);

      const sidebar = getSideBar();
      const computedStyle = window.getComputedStyle(sidebar);
      expect(computedStyle.overflow).toBe('hidden');
    });

    it('объединяет кастомные стили с базовыми', () => {
      const { getSideBar } = renderIsolated(
        <SideBar style={customCombinedStyle} />,
      );

      const sidebar = getSideBar();
      const computedStyle = window.getComputedStyle(sidebar);
      expect(computedStyle.backgroundColor).toBe('rgb(255, 0, 0)');
      expect(computedStyle.padding).toBe('20px');
    });

    it('применяет правильные стили для header', () => {
      const { getHeader } = renderIsolated(<SideBar header='Header' data-testid='sidebar' />);

      const header = getHeader();
      expect(header).toHaveStyle({
        padding: '16px',
        minHeight: '64px',
        display: 'flex',
        alignItems: 'center',
      });
    });

    it('применяет правильные стили для footer', () => {
      const { getFooter } = renderIsolated(<SideBar footer='Footer' data-testid='sidebar' />);

      const footer = getFooter();
      expect(footer).toHaveStyle({
        padding: '16px',
        minHeight: '64px',
        display: 'flex',
        alignItems: 'center',
      });
    });

    it('применяет правильные стили для content', () => {
      const { getContent } = renderIsolated(<SideBar />);

      const content = getContent();
      expect(content).toHaveStyle({
        flex: '1',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '8px',
      });
    });
  });

  describe('4.12. Test IDs для вложенных элементов', () => {
    it('применяет правильный data-testid для content', () => {
      const { getContent } = renderIsolated(<SideBar data-testid='sidebar' />);

      const content = getContent();
      expect(content).toHaveAttribute('data-testid', 'sidebar-content');
    });

    it('не применяет data-testid для content когда testId пустой', () => {
      const { getContent } = renderIsolated(<SideBar data-testid='' />);

      const content = getContent();
      expect(content).not.toHaveAttribute('data-testid');
    });

    it('не применяет data-testid для content когда testId не передан', () => {
      const { getContent } = renderIsolated(<SideBar />);

      const content = getContent();
      expect(content).not.toHaveAttribute('data-testid');
    });
  });

  describe('4.13. Memoization и производительность', () => {
    it('не перерендеривается при неизменных пропсах', () => {
      const { rerender, getSideBar } = renderIsolated(<SideBar items={testItems} />);

      const firstRender = getSideBar();

      rerender(<SideBar items={testItems} />);

      const secondRender = getSideBar();
      // Проверяем что элементы те же (memo работает)
      expect(firstRender).toBe(secondRender);
    });

    it('перерендеривается при изменении collapsed', () => {
      const { rerender, getSideBar } = renderIsolated(
        <SideBar items={testItems} collapsed={false} />,
      );

      expect(getSideBar()).not.toHaveAttribute('data-collapsed');

      rerender(<SideBar items={testItems} collapsed={true} />);

      expect(getSideBar()).toHaveAttribute('data-collapsed', 'true');
    });

    it('перерендеривается при изменении items', () => {
      const { rerender, getItems } = renderIsolated(<SideBar items={testItems} />);

      expect(getItems()).toHaveLength(3);

      rerender(<SideBar items={singleItem} />);

      expect(getItems()).toHaveLength(1);
    });
  });

  describe('4.14. Доступность (A11y)', () => {
    it('имеет правильные ARIA атрибуты для navigation', () => {
      const { getSideBar } = renderIsolated(<SideBar />);

      const sidebar = getSideBar();
      expect(sidebar).toHaveAttribute('role', 'navigation');
      expect(sidebar).toHaveAttribute('aria-label', 'Sidebar navigation');
    });

    it('имеет правильные ARIA атрибуты для menu', () => {
      const { getContent } = renderIsolated(<SideBar />);

      const nav = getContent();
      expect(nav).toHaveAttribute('role', 'menu');
      expect(nav).toHaveAttribute('aria-label');
    });

    it('имеет правильные ARIA атрибуты для menu items', () => {
      const { getItems } = renderIsolated(<SideBar items={testItems} />);

      const items = getItems();
      items.forEach((item) => {
        expect(item).toHaveAttribute('role', 'menuitem');
        expect(item).toHaveAttribute('tabindex', '0');
      });
    });

    it('имеет правильные ARIA атрибуты для активного элемента', () => {
      const { getItems } = renderIsolated(<SideBar items={itemsWithActive} />);

      const items = getItems();
      const activeItem = items[0]!;
      expect(activeItem).toHaveAttribute('aria-current', 'page');
    });

    it('имеет правильные ARIA атрибуты для disabled элемента', () => {
      const { getItems } = renderIsolated(<SideBar items={itemsWithDisabled} />);

      const items = getItems();
      const disabledItem = items[1]!;
      expect(disabledItem).toHaveAttribute('aria-disabled', 'true');
      expect(disabledItem).toHaveAttribute('tabindex', '-1');
    });

    it('имеет правильные ARIA атрибуты для overlay', () => {
      const { getOverlay } = renderIsolated(<SideBar showOverlay={true} />);

      const overlay = getOverlay();
      expect(overlay).toHaveAttribute('role', 'presentation');
      expect(overlay).toHaveAttribute('aria-hidden', 'true');
      expect(overlay).toHaveAttribute('tabindex', '-1');
    });
  });
});
