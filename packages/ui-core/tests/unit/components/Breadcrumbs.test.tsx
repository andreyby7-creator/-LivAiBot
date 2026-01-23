/**
 * @vitest-environment jsdom
 * @file Unit тесты для Breadcrumbs компонента
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Breadcrumbs } from '../../../src/components/Breadcrumbs.js';

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
    getByTestId: (testId: Readonly<string>) => within(container).getByTestId(testId),
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).queryByRole(role, options),
    getBreadcrumbs: () => container.querySelector('nav[data-component="CoreBreadcrumbs"]')!,
    getOrderedList: () => container.querySelector('ol')!,
    getBreadcrumbItems: () => container.querySelectorAll('li'),
    getBreadcrumbLinks: () => container.querySelectorAll('a'),
    getBreadcrumbSpans: () => container.querySelectorAll('li span:not([aria-hidden])'),
  };
}

describe('Breadcrumbs', () => {
  // Общие тестовые переменные
  const testItems = [
    { label: 'Home', href: '/' },
    { label: 'Category', href: '/category' },
    { label: 'Product', href: '/product' },
  ];

  const customStyle = { borderRadius: '8px', padding: '12px' };
  const combinedStyle = { color: 'blue', fontSize: '14px' };

  // Вынесенные массивы для соблюдения ESLint правил
  const itemsWithoutHref = [
    { label: 'Home' },
    { label: 'Category' },
    { label: 'Product' },
  ];

  const itemsWithDisabled = [
    { label: 'Home', href: '/' },
    { label: 'Category', href: '/category', disabled: true },
    { label: 'Product', href: '/product' },
  ];

  const itemsWithData = [
    { label: 'Home', href: '/', data: { 'data-custom': 'home-value' } },
    { label: 'Category', href: '/category' },
  ];

  const singleItem = [{ label: 'Home', href: '/' }];

  const itemsWithId = [
    { label: 'Home', href: '/', id: 'home' },
    { label: 'Category', href: '/category', id: 'category' },
  ];

  // Вынесенные массивы для тестов onClick
  const createItemsWithClicks = (): {
    label: string;
    href: string;
    onClick?: () => void;
  }[] => [
    { label: 'Home', href: '/', onClick: vi.fn() },
    { label: 'Category', href: '/category', onClick: vi.fn() },
    { label: 'Product', href: '/product' },
  ];

  const emptyItems: { label: string; href: string; }[] = [];
  const disabledItems = [
    { label: 'Home', href: '/', onClick: vi.fn(), disabled: true },
  ];

  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLElement>();

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getBreadcrumbs } = renderIsolated(
        <Breadcrumbs items={testItems} />,
      );

      expect(container).toBeInTheDocument();
      expect(getBreadcrumbs()).toBeInTheDocument();
    });

    it('создает nav элемент с правильными атрибутами по умолчанию', () => {
      const { getBreadcrumbs, getOrderedList } = renderIsolated(
        <Breadcrumbs items={testItems} />,
      );

      const nav = getBreadcrumbs();
      expect(nav).toBeInTheDocument();
      expect(nav.tagName).toBe('NAV');
      expect(nav).toHaveAttribute('data-component', 'CoreBreadcrumbs');
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');

      const ol = getOrderedList();
      expect(ol).toBeInTheDocument();
      // role="list" избыточен для нативного <ol> элемента
    });

    it('рендерит правильное количество элементов', () => {
      const { getBreadcrumbItems } = renderIsolated(
        <Breadcrumbs items={testItems} />,
      );

      const items = getBreadcrumbItems();
      expect(items).toHaveLength(3);
    });
  });

  describe('4.2. Пропсы компонента', () => {
    it('применяет className к nav элементу', () => {
      const { getBreadcrumbs } = renderIsolated(
        <Breadcrumbs items={testItems} className='custom-class' />,
      );

      expect(getBreadcrumbs()).toHaveClass('custom-class');
    });

    it('применяет style к nav элементу', () => {
      const { getBreadcrumbs } = renderIsolated(
        <Breadcrumbs items={testItems} style={customStyle} />,
      );

      const nav = getBreadcrumbs();
      expect(nav).toHaveStyle(customStyle);
    });

    it('применяет data-testid', () => {
      const { getByTestId } = renderIsolated(
        <Breadcrumbs items={testItems} data-testid='custom-test-id' />,
      );

      expect(getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('поддерживает кастомный aria-label', () => {
      const { getBreadcrumbs } = renderIsolated(
        <Breadcrumbs items={testItems} aria-label='Custom navigation' />,
      );

      expect(getBreadcrumbs()).toHaveAttribute('aria-label', 'Custom navigation');
    });

    it('поддерживает aria-labelledby с приоритетом над aria-label', () => {
      const { getBreadcrumbs } = renderIsolated(
        <Breadcrumbs
          items={testItems}
          aria-label='Custom navigation'
          aria-labelledby='nav-heading'
        />,
      );

      const nav = getBreadcrumbs();
      expect(nav).toHaveAttribute('aria-labelledby', 'nav-heading');
      expect(nav).not.toHaveAttribute('aria-label');
    });
  });

  describe('4.3. Items рендеринг', () => {
    it('рендерит элементы как ссылки с href', () => {
      const { getBreadcrumbLinks } = renderIsolated(
        <Breadcrumbs items={testItems} />,
      );

      const links = getBreadcrumbLinks();
      expect(links).toHaveLength(3);

      testItems.forEach((item, index) => {
        const link = links[index];
        expect(link).toHaveAttribute('href', item.href);
        expect(link).toHaveTextContent(item.label);
      });
    });

    it('рендерит элементы как span без href', () => {
      const { getBreadcrumbSpans, getBreadcrumbLinks } = renderIsolated(
        <Breadcrumbs items={itemsWithoutHref} />,
      );

      const spans = getBreadcrumbSpans();
      const links = getBreadcrumbLinks();

      expect(spans).toHaveLength(3);
      expect(links).toHaveLength(0);

      itemsWithoutHref.forEach((item, index) => {
        expect(spans[index]).toHaveTextContent(item.label);
      });
    });

    it('рендерит disabled элементы без onClick', () => {
      const { getBreadcrumbLinks } = renderIsolated(
        <Breadcrumbs items={itemsWithDisabled} />,
      );

      const links = getBreadcrumbLinks();
      expect(links).toHaveLength(2); // Disabled элемент рендерится как span
    });

    it('применяет data-index к каждому li элементу', () => {
      const { getBreadcrumbItems } = renderIsolated(
        <Breadcrumbs items={testItems} />,
      );

      const items = getBreadcrumbItems();
      items.forEach((item, index) => {
        expect(item).toHaveAttribute('data-index', index.toString());
      });
    });
  });

  describe('4.4. Separator', () => {
    it('использует дефолтный separator (›)', () => {
      const { container } = renderIsolated(
        <Breadcrumbs items={testItems} />,
      );

      const separators = container.querySelectorAll('span[aria-hidden="true"]');
      expect(separators).toHaveLength(2); // Между 3 элементами - 2 разделителя

      separators.forEach((separator) => {
        expect(separator).toHaveTextContent('›');
      });
    });

    it('использует строковый separator', () => {
      const { container } = renderIsolated(
        <Breadcrumbs items={testItems} separator='•' />,
      );

      const separators = container.querySelectorAll('span[aria-hidden="true"]');
      expect(separators).toHaveLength(2);

      separators.forEach((separator) => {
        expect(separator).toHaveTextContent('•');
      });
    });

    it('использует JSX separator без обертки', () => {
      const customSeparator = <span data-testid='custom-separator'>→</span>;

      const { container } = renderIsolated(
        <Breadcrumbs items={testItems} separator={customSeparator} />,
      );

      const separators = container.querySelectorAll('[data-testid="custom-separator"]');
      expect(separators).toHaveLength(2);

      separators.forEach((separator) => {
        expect(separator).toHaveTextContent('→');
      });
    });

    it('применяет SEPARATOR_STYLE к строковым разделителям', () => {
      const { container } = renderIsolated(
        <Breadcrumbs items={testItems} separator='•' />,
      );

      const separators = container.querySelectorAll('span[aria-hidden="true"]');
      separators.forEach((separator) => {
        expect(separator).toHaveStyle({
          margin: '0 8px',
          userSelect: 'none',
        });
      });
    });
  });

  describe('4.5. Accessibility', () => {
    it('добавляет aria-current="page" только к последнему элементу', () => {
      const { getBreadcrumbLinks } = renderIsolated(
        <Breadcrumbs items={testItems} />,
      );

      const links = getBreadcrumbLinks();
      expect(links).toHaveLength(3);

      // Первые два элемента не имеют aria-current
      expect(links[0]).not.toHaveAttribute('aria-current');
      expect(links[1]).not.toHaveAttribute('aria-current');

      // Последний элемент имеет aria-current="page"
      expect(links[2]).toHaveAttribute('aria-current', 'page');
    });

    it('добавляет aria-current="page" к последнему span элементу', () => {
      const { getBreadcrumbSpans } = renderIsolated(
        <Breadcrumbs items={itemsWithoutHref} />,
      );

      const spans = getBreadcrumbSpans();
      expect(spans).toHaveLength(3);

      // Первые два span не имеют aria-current
      expect(spans[0]).not.toHaveAttribute('aria-current');
      expect(spans[1]).not.toHaveAttribute('aria-current');

      // Последний span имеет aria-current="page"
      expect(spans[2]).toHaveAttribute('aria-current', 'page');
    });

    it('применяет aria-hidden к разделителям', () => {
      const { container } = renderIsolated(
        <Breadcrumbs items={testItems} />,
      );

      const separators = container.querySelectorAll('span[aria-hidden="true"]');
      expect(separators).toHaveLength(2);
    });
  });

  describe('4.6. onClick обработка', () => {
    it('вызывает onClick для элементов с href', () => {
      const mockOnClick1 = vi.fn();
      const mockOnClick2 = vi.fn();

      const itemsWithClicks = createItemsWithClicks();
      itemsWithClicks[0]!.onClick = mockOnClick1;
      itemsWithClicks[1]!.onClick = mockOnClick2;

      const { getBreadcrumbLinks } = renderIsolated(
        <Breadcrumbs items={itemsWithClicks} />,
      );

      const links = getBreadcrumbLinks();
      expect(links).toHaveLength(3);

      // Клик по первой ссылке
      links[0]!.click();
      expect(mockOnClick1).toHaveBeenCalledTimes(1);

      // Клик по второй ссылке
      links[1]!.click();
      expect(mockOnClick2).toHaveBeenCalledTimes(1);

      // Третья ссылка без onClick не должна ломать ничего
      expect(() => links[2]!.click()).not.toThrow();
    });

    it('не вызывает onClick для disabled элементов', () => {
      const mockOnClick = vi.fn();

      const itemsWithDisabled = disabledItems.map((item) => ({
        ...item,
        onClick: mockOnClick,
      }));

      const { getBreadcrumbSpans } = renderIsolated(
        <Breadcrumbs items={itemsWithDisabled} />,
      );

      const spans = getBreadcrumbSpans();
      expect(spans).toHaveLength(1);

      // Disabled элемент рендерится как span, не как link
      expect(spans[0]).toHaveTextContent('Home');
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('4.7. Data attributes', () => {
    it('применяет custom data attributes к элементам', () => {
      const { getBreadcrumbLinks } = renderIsolated(
        <Breadcrumbs items={itemsWithData} />,
      );

      const links = getBreadcrumbLinks();
      expect(links[0]).toHaveAttribute('data-custom', 'home-value');
      expect(links[1]).not.toHaveAttribute('data-custom');
    });
  });

  describe('4.8. Ref forwarding', () => {
    it('передает ref к nav элементу', () => {
      const mockRef = createMockRef();

      renderIsolated(
        <Breadcrumbs ref={mockRef} items={testItems} />,
      );

      expect(mockRef.current).toBeInstanceOf(HTMLElement);
      expect(mockRef.current?.tagName).toBe('NAV');
    });
  });

  describe('4.9. Edge cases', () => {
    it('работает с пустым массивом items', () => {
      const { getOrderedList } = renderIsolated(
        <Breadcrumbs items={emptyItems} />,
      );

      const ol = getOrderedList();
      expect(ol.children).toHaveLength(0);
    });

    it('работает с одним элементом (без разделителей)', () => {
      const { container } = renderIsolated(
        <Breadcrumbs items={singleItem} />,
      );

      const separators = container.querySelectorAll('span[aria-hidden="true"]');
      expect(separators).toHaveLength(0);
    });

    it('работает с элементами без id (использует label + index)', () => {
      const { getBreadcrumbItems } = renderIsolated(
        <Breadcrumbs items={testItems} />,
      );

      const items = getBreadcrumbItems();
      expect(items[0]).toHaveAttribute('data-index', '0');
      expect(items[1]).toHaveAttribute('data-index', '1');
      expect(items[2]).toHaveAttribute('data-index', '2');
    });

    it('работает с элементами с id', () => {
      const { getBreadcrumbItems } = renderIsolated(
        <Breadcrumbs items={itemsWithId} />,
      );

      const items = getBreadcrumbItems();
      expect(items[0]).toHaveAttribute('data-index', '0');
      expect(items[1]).toHaveAttribute('data-index', '1');
    });

    it('не ломает навигацию при клике по элементам без onClick', () => {
      const { getBreadcrumbLinks } = renderIsolated(
        <Breadcrumbs items={testItems} />,
      );

      const links = getBreadcrumbLinks();

      // Все ссылки должны иметь href, но клик не должен ломать
      links.forEach((link) => {
        expect(() => link.click()).not.toThrow();
      });
    });
  });

  describe('4.10. Style и className inheritance', () => {
    it('передает дополнительные пропсы к nav элементу', () => {
      const { getBreadcrumbs } = renderIsolated(
        <Breadcrumbs
          items={testItems}
          data-custom='test-value'
          title='Custom title'
        />,
      );

      const nav = getBreadcrumbs();
      expect(nav).toHaveAttribute('data-custom', 'test-value');
      expect(nav).toHaveAttribute('title', 'Custom title');
    });

    it('объединяет стили правильно', () => {
      const { getBreadcrumbs } = renderIsolated(
        <Breadcrumbs
          items={testItems}
          style={combinedStyle}
        />,
      );

      const nav = getBreadcrumbs();
      expect(nav).toHaveStyle({ color: 'rgb(0, 0, 255)', fontSize: '14px' });
    });
  });
});
