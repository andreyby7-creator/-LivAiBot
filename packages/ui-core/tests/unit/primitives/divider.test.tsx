/**
 * @vitest-environment jsdom
 * @file Unit тесты для Divider компонента
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Divider } from '../../../src/primitives/divider.js';

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
    getDivider: () => container.querySelector('[data-component="CoreDivider"]')!,
  };
}

describe('Divider', () => {
  // Общие тестовые переменные
  const customStyle = { borderRadius: '4px', opacity: 0.8 };
  const overrideStyle = { display: 'inline-block' };

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getDivider } = renderIsolated(<Divider />);

      expect(container).toBeInTheDocument();
      expect(getDivider()).toBeInTheDocument();
    });

    it('создает hr элемент с правильными атрибутами по умолчанию', () => {
      const { getDivider } = renderIsolated(<Divider />);

      const divider = getDivider();
      expect(divider).toBeInTheDocument();
      expect(divider.tagName).toBe('HR');
      expect(divider).toHaveAttribute('data-component', 'CoreDivider');
    });

    it('принимает ref с типобезопасностью', () => {
      const ref = React.createRef<HTMLElement>();
      renderIsolated(<Divider ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLElement);
    });
  });

  describe('4.2. Ориентация (orientation)', () => {
    it('по умолчанию рендерится как horizontal (hr)', () => {
      const { getDivider } = renderIsolated(<Divider />);

      const divider = getDivider();
      expect(divider.tagName).toBe('HR');
      expect(divider).not.toHaveAttribute('role');
    });

    it('с orientation="vertical" рендерится как div с role="separator"', () => {
      const { getDivider } = renderIsolated(<Divider orientation='vertical' />);

      const divider = getDivider();
      expect(divider.tagName).toBe('DIV');
      expect(divider).toHaveAttribute('role', 'separator');
    });

    it('принимает только допустимые значения orientation', () => {
      const { getDivider: getHorizontal } = renderIsolated(<Divider orientation='horizontal' />);
      const { getDivider: getVertical } = renderIsolated(<Divider orientation='vertical' />);

      expect(getHorizontal().tagName).toBe('HR');
      expect(getVertical().tagName).toBe('DIV');
      expect(getVertical()).toHaveAttribute('role', 'separator');
    });
  });

  describe('4.3. Стили (thickness, color, length)', () => {
    it('применяет дефолтные значения стилей', () => {
      const { getDivider } = renderIsolated(<Divider />);

      const divider = getDivider();
      const computedStyle = window.getComputedStyle(divider);

      expect(computedStyle.width).toBe('100%');
      expect(computedStyle.height).toBe('1px');
      expect(computedStyle.backgroundColor).toBe('var(--divider-color, #E5E7EB)');
      expect(computedStyle.display).toBe('block');
      expect(computedStyle.flexShrink).toBe('0');
    });

    it('применяет кастомные значения thickness (number)', () => {
      const { getDivider } = renderIsolated(<Divider thickness={5} />);

      const divider = getDivider();
      expect(window.getComputedStyle(divider).height).toBe('5px');
    });

    it('применяет кастомные значения thickness (string)', () => {
      const { getDivider } = renderIsolated(<Divider thickness='2rem' />);

      const divider = getDivider();
      expect(window.getComputedStyle(divider).height).toBe('2rem');
    });

    it('применяет кастомные значения color', () => {
      const { getDivider } = renderIsolated(<Divider color='red' />);

      const divider = getDivider();
      expect(window.getComputedStyle(divider).backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('применяет кастомные значения length (number)', () => {
      const { getDivider } = renderIsolated(<Divider length={200 as any} />);

      const divider = getDivider();
      expect(window.getComputedStyle(divider).width).toBe('200px');
    });

    it('применяет кастомные значения length (string)', () => {
      const { getDivider } = renderIsolated(<Divider length='50%' />);

      const divider = getDivider();
      expect(window.getComputedStyle(divider).width).toBe('50%');
    });

    it('правильно применяет вертикальные стили', () => {
      const { getDivider } = renderIsolated(
        <Divider orientation='vertical' thickness={3} color='blue' length='100px' />,
      );

      const divider = getDivider();
      const computedStyle = window.getComputedStyle(divider);

      expect(computedStyle.width).toBe('3px');
      expect(computedStyle.height).toBe('100px');
      expect(computedStyle.backgroundColor).toBe('rgb(0, 0, 255)');
    });
  });

  describe('4.4. Props spreading и атрибуты', () => {
    it('принимает и применяет className', () => {
      const { getDivider } = renderIsolated(<Divider className='custom-divider' />);

      const divider = getDivider();
      expect(divider).toHaveClass('custom-divider');
    });

    it('принимает и применяет data-testid', () => {
      const { getByTestId } = renderIsolated(<Divider data-testid='divider-test' />);

      expect(getByTestId('divider-test')).toBeInTheDocument();
    });

    it('принимает и применяет произвольные HTML атрибуты', () => {
      const { getDivider } = renderIsolated(<Divider id='divider-id' title='Test divider' />);

      const divider = getDivider();
      expect(divider).toHaveAttribute('id', 'divider-id');
      expect(divider).toHaveAttribute('title', 'Test divider');
    });

    it('принимает и применяет кастомный style', () => {
      const { getDivider } = renderIsolated(<Divider style={customStyle} />);

      const divider = getDivider();
      const computedStyle = window.getComputedStyle(divider);

      expect(computedStyle.borderRadius).toBe('4px');
      expect(computedStyle.opacity).toBe('0.8');
    });
  });

  describe('4.5. Ref forwarding', () => {
    it('корректно форвардит ref для horizontal divider (hr)', () => {
      const ref = React.createRef<HTMLElement>();
      renderIsolated(<Divider ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLHRElement);
      expect(ref.current?.tagName).toBe('HR');
    });

    it('корректно форвардит ref для vertical divider (div)', () => {
      const ref = React.createRef<HTMLElement>();
      renderIsolated(<Divider orientation='vertical' ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.tagName).toBe('DIV');
    });
  });

  describe('4.6. Memoization и производительность', () => {
    it('стабильно рендерится с одинаковыми пропсами (memo)', () => {
      const { container: container1 } = renderIsolated(<Divider thickness={2} color='red' />);
      const { container: container2 } = renderIsolated(<Divider thickness={2} color='red' />);

      expect(container1.innerHTML).toBe(container2.innerHTML);
    });

    it('перерендеривается при изменении пропсов', () => {
      const { rerender, getDivider } = renderIsolated(<Divider thickness={1} />);

      expect(window.getComputedStyle(getDivider()).height).toBe('1px');

      rerender(<Divider thickness={3} />);
      expect(window.getComputedStyle(getDivider()).height).toBe('3px');
    });
  });

  describe('4.7. Edge cases', () => {
    it('обрабатывает пустые пропсы', () => {
      expect(() => renderIsolated(<Divider />)).not.toThrow();
    });

    it('работает без пропсов (использует дефолтные значения)', () => {
      const { getDivider } = renderIsolated(<Divider />);

      const divider = getDivider();
      expect(divider).toBeInTheDocument();
      expect(divider.tagName).toBe('HR'); // default horizontal
    });

    it('применяет стили в правильном порядке (BASE_STYLE -> orientationStyle -> custom style)', () => {
      const { getDivider } = renderIsolated(
        <Divider orientation='horizontal' thickness={2} style={overrideStyle} />,
      );

      const divider = getDivider();
      const computedStyle = window.getComputedStyle(divider);

      // custom style должен переопределять BASE_STYLE
      expect(computedStyle.display).toBe('inline-block');
      // но orientationStyle должен применяться
      expect(computedStyle.height).toBe('2px');
    });
  });
});
