/**
 * @vitest-environment jsdom
 * @file Unit тесты для NavigationMenuItem компонента
 */

import { cleanup, render, within } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { NavigationMenuItemData } from '@livai/ui-core';
import { NavigationMenuItem } from '@livai/ui-core';

import '@testing-library/jest-dom/vitest';

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
    getNavigationMenuItem: () =>
      container.querySelector('[data-component="CoreNavigationMenuItem"]')!,
    getIcon: () => container.querySelector('[data-testid*="-icon"]'),
    getLabel: () => container.querySelector('[data-testid*="-label"]'),
  };
}

describe('NavigationMenuItem', () => {
  // Общие тестовые переменные
  const baseItem: NavigationMenuItemData = {
    label: 'Главная',
    href: '/home',
    icon: '🏠',
    isActive: false,
    isDisabled: false,
  };

  const activeItem: NavigationMenuItemData = {
    ...baseItem,
    isActive: true,
  };

  const disabledItem: NavigationMenuItemData = {
    ...baseItem,
    isDisabled: true,
  };

  const disabledActiveItem: NavigationMenuItemData = {
    label: 'Test',
    href: '/test',
    isActive: true,
    isDisabled: true,
  };

  const itemWithoutHref: NavigationMenuItemData = {
    label: 'Профиль',
    icon: '👤',
  };

  const itemWithCustomIcon: NavigationMenuItemData = {
    label: 'Поиск',
    icon: '🔍',
  };

  const itemWithoutIcon: NavigationMenuItemData = { label: 'Без иконки', href: '/test' };

  const customStyle = { borderRadius: '8px', padding: '12px' };
  const emptyStyle = {};

  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLElement>();

  // Вынесенные объекты для соблюдения ESLint правил
  const itemWithEmptyHref: NavigationMenuItemData = { label: 'Test', href: '' };
  const itemWithUndefinedHref: NavigationMenuItemData = { label: 'Test' } as NavigationMenuItemData;

  describe('4.1. Рендер без падений', () => {
    it('рендерится как ссылка с обязательными пропсами', () => {
      const { container, getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={baseItem} />,
      );

      expect(container).toBeInTheDocument();
      expect(getNavigationMenuItem()).toBeInTheDocument();
      expect(getNavigationMenuItem().tagName).toBe('A');
      expect(getNavigationMenuItem()).toHaveAttribute('href', '/home');
    });

    it('рендерится как кнопка когда href отсутствует', () => {
      const { container, getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={itemWithoutHref} />,
      );

      expect(container).toBeInTheDocument();
      expect(getNavigationMenuItem()).toBeInTheDocument();
      expect(getNavigationMenuItem().tagName).toBe('BUTTON');
      expect(getNavigationMenuItem()).toHaveAttribute('type', 'button');
    });

    it('рендерится как кнопка когда href пустой', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={itemWithEmptyHref} />,
      );

      expect(getNavigationMenuItem().tagName).toBe('BUTTON');
    });

    it('рендерится как кнопка когда href неопределен', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={itemWithUndefinedHref} />,
      );

      expect(getNavigationMenuItem().tagName).toBe('BUTTON');
    });

    it('рендерится как кнопка когда элемент отключен', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={disabledItem} />,
      );

      expect(getNavigationMenuItem().tagName).toBe('BUTTON');
      expect(getNavigationMenuItem()).toHaveAttribute('disabled');
    });
  });

  describe('4.2. Пропсы и атрибуты', () => {
    it('применяет className к элементу', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={baseItem} className='custom-class' />,
      );

      expect(getNavigationMenuItem()).toHaveClass('custom-class');
    });

    it('применяет style к элементу', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={baseItem} style={customStyle} />,
      );

      const item = getNavigationMenuItem();
      expect(item).toHaveStyle(customStyle);
    });

    it('применяет data-testid', () => {
      const { getByTestId } = renderIsolated(
        <NavigationMenuItem item={baseItem} data-testid='custom-test-id' />,
      );

      expect(getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('прокидывает дополнительные HTML атрибуты', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem
          item={baseItem}
          id='menu-item-1'
          title='Главная страница'
          data-custom='value'
        />,
      );

      const item = getNavigationMenuItem();
      expect(item).toHaveAttribute('id', 'menu-item-1');
      expect(item).toHaveAttribute('title', 'Главная страница');
      expect(item).toHaveAttribute('data-custom', 'value');
    });
  });

  describe('4.3. Размеры', () => {
    const sizes = ['small', 'medium', 'large'] as const;

    sizes.forEach((size) => {
      it(`применяет правильный data-size="${size}"`, () => {
        const { getNavigationMenuItem } = renderIsolated(
          <NavigationMenuItem item={baseItem} size={size} />,
        );

        expect(getNavigationMenuItem()).toHaveAttribute('data-size', size);
      });

      it(`применяет правильные стили для размера "${size}"`, () => {
        const { getNavigationMenuItem } = renderIsolated(
          <NavigationMenuItem item={baseItem} size={size} />,
        );

        const item = getNavigationMenuItem();
        const computedStyle = window.getComputedStyle(item);

        // Проверяем базовые стили
        expect(computedStyle.display).toBe('inline-flex');
        expect(computedStyle.alignItems).toBe('center');
        expect(computedStyle.cursor).toBe('pointer');

        // Проверяем размерозависимые стили
        if (size === 'small') {
          expect(computedStyle.fontSize).toBe('12px');
          expect(computedStyle.gap).toBe('6px');
        } else if (size === 'medium') {
          expect(computedStyle.fontSize).toBe('14px');
          expect(computedStyle.gap).toBe('8px');
        } else {
          // size === 'large'
          expect(computedStyle.fontSize).toBe('16px');
          expect(computedStyle.gap).toBe('10px');
        }
      });
    });

    it('использует medium по умолчанию', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={baseItem} />,
      );

      expect(getNavigationMenuItem()).toHaveAttribute('data-size', 'medium');
    });
  });

  describe('4.4. Варианты', () => {
    const variants = ['default', 'compact', 'minimal'] as const;

    variants.forEach((variant) => {
      it(`применяет правильный data-variant="${variant}"`, () => {
        const { getNavigationMenuItem } = renderIsolated(
          <NavigationMenuItem item={baseItem} variant={variant} />,
        );

        expect(getNavigationMenuItem()).toHaveAttribute('data-variant', variant);
      });

      it(`применяет правильные стили для варианта "${variant}"`, () => {
        const { getNavigationMenuItem } = renderIsolated(
          <NavigationMenuItem item={baseItem} variant={variant} />,
        );

        const item = getNavigationMenuItem();
        const computedStyle = window.getComputedStyle(item);

        if (variant === 'compact') {
          expect(computedStyle.padding).toBe('4px 8px');
          expect(computedStyle.gap).toBe('4px');
        } else if (variant === 'minimal') {
          expect(computedStyle.padding).toBe('2px 4px');
          expect(computedStyle.gap).toBe('2px');
          expect(computedStyle.fontSize).toBe('13px');
        } else {
          expect(computedStyle.padding).toBe('8px 12px');
          expect(computedStyle.gap).toBe('8px');
        }
      });
    });

    it('использует default по умолчанию', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={baseItem} />,
      );

      expect(getNavigationMenuItem()).toHaveAttribute('data-variant', 'default');
    });
  });

  describe('4.5. Состояния элементов', () => {
    it('применяет активное состояние', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={activeItem} />,
      );

      const item = getNavigationMenuItem();
      expect(item).toHaveAttribute('data-active', 'true');
      expect(item).toHaveAttribute('aria-current', 'page');

      const computedStyle = window.getComputedStyle(item);
      expect(computedStyle.fontWeight).toBe('600');
    });

    it('применяет отключенное состояние', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={disabledItem} />,
      );

      const item = getNavigationMenuItem();
      expect(item).toHaveAttribute('data-disabled', 'true');

      const computedStyle = window.getComputedStyle(item);
      expect(computedStyle.opacity).toBe('0.5');
      expect(computedStyle.pointerEvents).toBe('none');
    });

    it('отключенное состояние имеет приоритет над активным', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={disabledActiveItem} />,
      );

      const item = getNavigationMenuItem();
      expect(item).toHaveAttribute('data-disabled', 'true');
      expect(item).toHaveAttribute('data-active', 'true'); // data-active устанавливается независимо от disabled

      const computedStyle = window.getComputedStyle(item);
      expect(computedStyle.opacity).toBe('0.5');
      expect(computedStyle.pointerEvents).toBe('none');
    });
  });

  describe('4.6. Отображение иконки', () => {
    it('показывает иконку по умолчанию', () => {
      const { getIcon } = renderIsolated(
        <NavigationMenuItem item={baseItem} data-testid='menu-item' />,
      );

      const icon = getIcon();
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveTextContent('🏠');
    });

    it('скрывает иконку когда showIcon=false', () => {
      const { container } = renderIsolated(
        <NavigationMenuItem item={baseItem} showIcon={false} data-testid='menu-item' />,
      );

      expect(container.querySelector('[data-testid*="icon"]')).toBeNull();
    });

    it('не показывает иконку когда icon отсутствует', () => {
      const { container } = renderIsolated(
        <NavigationMenuItem item={itemWithoutIcon} data-testid='menu-item' />,
      );

      expect(container.querySelector('[data-testid*="icon"]')).toBeNull();
    });

    it('применяет правильные стили к иконке', () => {
      const { getIcon } = renderIsolated(
        <NavigationMenuItem item={baseItem} data-testid='menu-item' />,
      );

      const icon = getIcon() as HTMLElement;
      const computedStyle = window.getComputedStyle(icon);

      expect(computedStyle.display).toBe('flex');
      expect(computedStyle.width).toBe('16px');
      expect(computedStyle.height).toBe('16px');
      expect(computedStyle.flexShrink).toBe('0');
    });
  });

  describe('4.7. Отображение текста', () => {
    it('показывает текст по умолчанию', () => {
      const { getLabel } = renderIsolated(
        <NavigationMenuItem item={baseItem} data-testid='menu-item' />,
      );

      const label = getLabel();
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent('Главная');
    });

    it('скрывает текст когда showLabel=false', () => {
      const { container } = renderIsolated(
        <NavigationMenuItem item={baseItem} showLabel={false} data-testid='menu-item' />,
      );

      expect(container.querySelector('[data-testid*="label"]')).toBeNull();
    });

    it('применяет правильные стили к тексту', () => {
      const { getLabel } = renderIsolated(
        <NavigationMenuItem item={baseItem} data-testid='menu-item' />,
      );

      const label = getLabel() as HTMLElement;
      const computedStyle = window.getComputedStyle(label);

      expect(computedStyle.flex).toBe('1 1 0%');
      expect(computedStyle.overflow).toBe('hidden');
      expect(computedStyle.textOverflow).toBe('ellipsis');
      expect(computedStyle.whiteSpace).toBe('nowrap');
    });
  });

  describe('4.8. Кастомная иконка', () => {
    it('использует customIcon когда передан', () => {
      const customIcon = <span data-testid='custom-icon'>★</span>;
      const { getByTestId } = renderIsolated(
        <NavigationMenuItem
          item={itemWithCustomIcon}
          customIcon={customIcon}
          data-testid='menu-item'
        />,
      );

      expect(getByTestId('custom-icon')).toBeInTheDocument();
      expect(getByTestId('custom-icon')).toHaveTextContent('★');
    });

    it('customIcon имеет приоритет над item.icon', () => {
      const customIcon = <span data-testid='custom-icon'>★</span>;
      const { getByTestId, container } = renderIsolated(
        <NavigationMenuItem
          item={itemWithCustomIcon}
          customIcon={customIcon}
          data-testid='menu-item'
        />,
      );

      expect(getByTestId('custom-icon')).toBeInTheDocument();
      expect(container).not.toHaveTextContent('🔍');
    });
  });

  describe('4.9. Доступность (A11y)', () => {
    it('активный элемент имеет aria-current="page"', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={activeItem} />,
      );

      expect(getNavigationMenuItem()).toHaveAttribute('aria-current', 'page');
    });

    it('неактивный элемент не имеет aria-current', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={baseItem} />,
      );

      expect(getNavigationMenuItem()).not.toHaveAttribute('aria-current');
    });

    it('ссылка имеет href атрибут', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={baseItem} />,
      );

      const item = getNavigationMenuItem();
      expect(item).toHaveAttribute('href', '/home');
      expect(item.tagName).toBe('A');
    });

    it('кнопка имеет type="button"', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={itemWithoutHref} />,
      );

      const item = getNavigationMenuItem();
      expect(item).toHaveAttribute('type', 'button');
      expect(item.tagName).toBe('BUTTON');
    });

    it('отключенная кнопка имеет disabled атрибут', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={disabledItem} />,
      );

      const item = getNavigationMenuItem();
      expect(item).toHaveAttribute('disabled');
      expect(item.tagName).toBe('BUTTON');
    });
  });

  describe('4.10. Ref forwarding', () => {
    it('поддерживает ref forwarding для ссылки', () => {
      const ref = createMockRef();

      render(<NavigationMenuItem ref={ref} item={baseItem} />);

      expect(ref.current).toBeInstanceOf(HTMLAnchorElement);
      expect(ref.current).toHaveAttribute('data-component', 'CoreNavigationMenuItem');
    });

    it('поддерживает ref forwarding для кнопки', () => {
      const ref = createMockRef();

      render(<NavigationMenuItem ref={ref} item={itemWithoutHref} />);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current).toHaveAttribute('data-component', 'CoreNavigationMenuItem');
    });
  });

  describe('4.11. Render stability', () => {
    it('не пересчитывает стили при одинаковых пропсах', () => {
      const { rerender, getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={baseItem} size='medium' variant='default' />,
      );

      const item1 = getNavigationMenuItem();

      rerender(<NavigationMenuItem item={baseItem} size='medium' variant='default' />);

      const item2 = getNavigationMenuItem();

      expect(item1).toBe(item2);
    });

    it('обновляет стили при изменении пропсов', () => {
      const { rerender, getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={baseItem} size='medium' />,
      );

      const itemBefore = getNavigationMenuItem();
      expect(itemBefore).toHaveAttribute('data-size', 'medium');

      rerender(<NavigationMenuItem item={baseItem} size='large' />);

      const itemAfter = getNavigationMenuItem();
      expect(itemAfter).toHaveAttribute('data-size', 'large');
    });
  });

  describe('4.12. Edge cases', () => {
    it('работает с undefined style', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={baseItem} style={undefined} />,
      );

      expect(getNavigationMenuItem()).toBeInTheDocument();
    });

    it('работает с пустым объектом style', () => {
      const { getNavigationMenuItem } = renderIsolated(
        <NavigationMenuItem item={baseItem} style={emptyStyle} />,
      );

      expect(getNavigationMenuItem()).toBeInTheDocument();
    });

    // Вынесенные объекты для соблюдения ESLint правил
    const longLabel = 'A'.repeat(100);
    const itemWithLongLabel: NavigationMenuItemData = {
      label: longLabel,
      href: '/test',
    };

    const itemWithNulls: NavigationMenuItemData = {
      label: 'Test',
      href: null as any,
      icon: null as any,
      isActive: null as any,
      isDisabled: null as any,
    };

    const itemWithUndefined: NavigationMenuItemData = {
      label: 'Test',
    } as NavigationMenuItemData;

    it('работает с длинным текстом (ellipsis)', () => {
      const { getLabel } = renderIsolated(
        <NavigationMenuItem item={itemWithLongLabel} data-testid='menu-item' />,
      );

      const label = getLabel() as HTMLElement;
      expect(label).toHaveTextContent(longLabel);

      const computedStyle = window.getComputedStyle(label);
      expect(computedStyle.textOverflow).toBe('ellipsis');
      expect(computedStyle.overflow).toBe('hidden');
      expect(computedStyle.whiteSpace).toBe('nowrap');
    });

    it('работает с null значениями в item', () => {
      const { getNavigationMenuItem, container } = renderIsolated(
        <NavigationMenuItem item={itemWithNulls} data-testid='menu-item' />,
      );

      const item = getNavigationMenuItem();
      expect(item.tagName).toBe('BUTTON'); // href null -> button
      expect(container.querySelector('[data-testid*="icon"]')).toBeNull(); // icon null -> no icon
      expect(item).not.toHaveAttribute('data-active'); // isActive null -> false
      expect(item).not.toHaveAttribute('data-disabled'); // isDisabled null -> false
    });

    it('работает с отсутствующими свойствами в item', () => {
      const { getNavigationMenuItem, container } = renderIsolated(
        <NavigationMenuItem item={itemWithUndefined} data-testid='menu-item' />,
      );

      const item = getNavigationMenuItem();
      expect(item.tagName).toBe('BUTTON'); // href отсутствует -> button
      expect(container.querySelector('[data-testid*="icon"]')).toBeNull(); // icon отсутствует -> no icon
      expect(item).not.toHaveAttribute('data-active'); // isActive отсутствует -> false
      expect(item).not.toHaveAttribute('data-disabled'); // isDisabled отсутствует -> false
    });

    it('работает со всеми пропсами одновременно', () => {
      const customIcon = <span data-testid='custom-icon'>★</span>;
      const { getByTestId, getNavigationMenuItem, getIcon, getLabel } = renderIsolated(
        <NavigationMenuItem
          item={activeItem}
          size='large'
          variant='compact'
          showIcon={true}
          showLabel={true}
          customIcon={customIcon}
          className='custom-class'
          style={customStyle}
          data-testid='menu-item'
          id='test-id'
        />,
      );

      const item = getNavigationMenuItem();
      expect(item).toHaveAttribute('data-size', 'large');
      expect(item).toHaveAttribute('data-variant', 'compact');
      expect(item).toHaveAttribute('data-active', 'true');
      expect(item).toHaveClass('custom-class');
      expect(item).toHaveAttribute('id', 'test-id');

      expect(getByTestId('custom-icon')).toBeInTheDocument();
      expect(getLabel()).toBeInTheDocument();
      expect(getIcon()).toBeInTheDocument();
    });
  });
});
