/**
 * @vitest-environment jsdom
 * @file Unit тесты для Icon компонента
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Icon } from '../../../src/primitives/icon.js';

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
    getIcon: () => container.querySelector('i[data-component="CoreIcon"]') as HTMLElement,
  };
}

describe('Icon', () => {
  describe('1.1. Рендер без падений', () => {
    it('рендерится с обязательным пропсом name', () => {
      const { container, getIcon } = renderIsolated(<Icon name='test-icon' />);

      expect(container).toBeInTheDocument();
      expect(getIcon()).toBeInTheDocument();
    });

    it('создает i элемент с правильными атрибутами по умолчанию', () => {
      const { getIcon } = renderIsolated(<Icon name='test-icon' />);

      const icon = getIcon();
      expect(icon).toBeInTheDocument();
      expect(icon.tagName).toBe('I');
      expect(icon).toHaveAttribute('data-component', 'CoreIcon');
      expect(icon).toHaveAttribute('data-icon-name', 'test-icon');
    });
  });

  describe('1.2. Size пропс', () => {
    it('по умолчанию size=16px', () => {
      const { getIcon } = renderIsolated(<Icon name='test-icon' />);

      const icon = getIcon();
      expect(icon).toHaveStyle({
        '--icon-size': '16px',
        'font-size': 'var(--icon-size, 16px)',
      });
    });

    it('size как число конвертируется в px', () => {
      const { getIcon } = renderIsolated(<Icon name='test-icon' size={24 as any} />);

      const icon = getIcon();
      expect(icon).toHaveStyle({
        '--icon-size': '24px',
        'font-size': 'var(--icon-size, 16px)',
      });
    });

    it('size как строка пробрасывается напрямую', () => {
      const { getIcon } = renderIsolated(<Icon name='test-icon' size='2rem' />);

      const icon = getIcon();
      expect(icon).toHaveStyle({
        '--icon-size': '2rem',
        'font-size': 'var(--icon-size, 16px)',
      });
    });
  });

  describe('1.3. Color пропс', () => {
    it('по умолчанию color="currentColor"', () => {
      const { getIcon } = renderIsolated(<Icon name='test-icon' />);

      const icon = getIcon();
      expect(icon).toHaveStyle({
        '--icon-color': 'currentColor',
        color: 'var(--icon-color, currentColor)',
      });
    });

    it('color пробрасывается в CSS variable', () => {
      const { getIcon } = renderIsolated(<Icon name='test-icon' color='red' />);

      const icon = getIcon();
      expect(icon).toHaveStyle({
        '--icon-color': 'red',
        color: 'var(--icon-color, currentColor)',
      });
    });
  });

  describe('1.4. Accessibility - decorative', () => {
    it('decorative=false (по умолчанию) создает семантическую иконку', () => {
      const { getByRole } = renderIsolated(<Icon name='test-icon' />);

      const icon = getByRole('img');
      expect(icon).toHaveAttribute('role', 'img');
      expect(icon).toHaveAttribute('aria-label', 'test-icon');
      expect(icon).not.toHaveAttribute('aria-hidden');
    });

    it('decorative=true создает декоративную иконку', () => {
      const { getIcon, queryByRole } = renderIsolated(<Icon name='test-icon' decorative />);

      const icon = getIcon();
      expect(icon).toHaveAttribute('aria-hidden');
      expect(icon).not.toHaveAttribute('role');
      expect(icon).not.toHaveAttribute('aria-label');
      expect(queryByRole('img')).not.toBeInTheDocument();
    });

    it('ariaLabel переопределяет name для семантических иконок', () => {
      const { getByRole } = renderIsolated(<Icon name='test-icon' ariaLabel='Custom label' />);

      const icon = getByRole('img');
      expect(icon).toHaveAttribute('aria-label', 'Custom label');
    });

    it('ariaLabel игнорируется для decorative иконок', () => {
      const { getIcon } = renderIsolated(<Icon name='test-icon' decorative ariaLabel='Ignored' />);

      const icon = getIcon();
      expect(icon).toHaveAttribute('aria-hidden');
      expect(icon).not.toHaveAttribute('aria-label');
    });
  });

  describe('1.5. Ref support', () => {
    it('forwardRef работает для внешнего доступа к DOM элементу', () => {
      const ref = React.createRef<HTMLElement>();

      const { getIcon } = renderIsolated(<Icon name='test-icon' ref={ref} />);

      const icon = getIcon();
      expect(ref.current).toBe(icon);
    });

    it('ref возвращает HTMLElement', () => {
      const ref = React.createRef<HTMLElement>();

      renderIsolated(<Icon name='test-icon' ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLElement);
      expect(ref.current?.tagName).toBe('I');
    });
  });

  describe('1.6. HTML атрибуты пробрасываются', () => {
    it('стандартные HTML атрибуты пробрасываются корректно', () => {
      const { getIcon } = renderIsolated(
        <Icon
          name='test-icon'
          id='test-id'
          className='test-class'
          title='Test title'
          data-testid='test-icon'
        />,
      );

      const icon = getIcon();
      expect(icon).toHaveAttribute('id', 'test-id');
      expect(icon).toHaveAttribute('class', 'test-class');
      expect(icon).toHaveAttribute('title', 'Test title');
      expect(icon).toHaveAttribute('data-testid', 'test-icon');
    });
  });

  describe('1.7. Стабильность рендера', () => {
    it('рендер стабилен при одинаковых пропсах', () => {
      const { container, rerender } = renderIsolated(
        <Icon name='stable-icon' size={20 as any} color='blue' />,
      );

      const firstRender = container.innerHTML;

      rerender(<Icon name='stable-icon' size={20 as any} color='blue' />);

      expect(container.innerHTML).toBe(firstRender);
    });

    it('memo предотвращает ненужные ре-рендеры', () => {
      let renderCount = 0;

      const TestComponent = React.memo(() => {
        renderCount++;
        return <Icon name='memo-test' />;
      });

      const { rerender } = render(<TestComponent />);

      expect(renderCount).toBe(1);

      rerender(<TestComponent />);

      expect(renderCount).toBe(1);
    });
  });

  describe('1.8. CSS Variables', () => {
    it('всегда устанавливает CSS variables для size и color', () => {
      const { getIcon } = renderIsolated(
        <Icon name='test-icon' size={32 as any} color='#ff0000' />,
      );

      const icon = getIcon();

      // Проверяем что CSS variables установлены
      expect(icon.style.getPropertyValue('--icon-size')).toBe('32px');
      expect(icon.style.getPropertyValue('--icon-color')).toBe('#ff0000');

      // Проверяем что font-size использует variable
      expect(icon).toHaveStyle('font-size: var(--icon-size, 16px)');
      expect(icon).toHaveStyle('color: var(--icon-color, currentColor)');
    });

    it('CSS variables обновляются при изменении пропсов', () => {
      const { getIcon, rerender } = renderIsolated(
        <Icon name='test-icon' size={16 as any} color='black' />,
      );

      const icon = getIcon();
      expect(icon.style.getPropertyValue('--icon-size')).toBe('16px');
      expect(icon.style.getPropertyValue('--icon-color')).toBe('black');

      rerender(<Icon name='test-icon' size={48 as any} color='white' />);

      expect(icon.style.getPropertyValue('--icon-size')).toBe('48px');
      expect(icon.style.getPropertyValue('--icon-color')).toBe('white');
    });
  });

  describe('1.9. Edge cases', () => {
    it('работает с отсутствующими пропсами', () => {
      const { getIcon } = renderIsolated(<Icon name='test-icon' />);

      const icon = getIcon();
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('data-icon-name', 'test-icon');
      expect(icon).toHaveStyle('--icon-size: 16px');
      expect(icon).toHaveStyle('--icon-color: currentColor');
    });

    it('работает с пустой строкой ariaLabel', () => {
      const { getByRole } = renderIsolated(<Icon name='test-icon' ariaLabel='' />);

      const icon = getByRole('img');
      expect(icon).toHaveAttribute('aria-label', '');
    });

    it('размер 0 работает корректно', () => {
      const { getIcon } = renderIsolated(<Icon name='test-icon' size={0 as any} />);

      const icon = getIcon();
      expect(icon).toHaveStyle('--icon-size: 0px');
    });
  });
});
