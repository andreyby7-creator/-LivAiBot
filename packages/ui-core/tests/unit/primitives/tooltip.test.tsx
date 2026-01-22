/**
 * @vitest-environment jsdom
 * @file Unit тесты для Tooltip компонента
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { resolvePlacementStyle, Tooltip } from '../../../src/primitives/tooltip.js';

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
    getTooltip: () => container.querySelector('div[data-component="CoreTooltip"]')!,
  };
}

describe('Tooltip', () => {
  describe('3.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getTooltip } = renderIsolated(
        <Tooltip content='Test tooltip' visible={true} />,
      );

      expect(container).toBeInTheDocument();
      expect(getTooltip()).toBeInTheDocument();
    });

    it('создает div элемент с правильными атрибутами по умолчанию', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content='Test tooltip' visible={true} />,
      );

      const tooltip = getTooltip();
      expect(tooltip).toBeInTheDocument();
      expect(tooltip.tagName).toBe('DIV');
      expect(tooltip).toHaveAttribute('data-component', 'CoreTooltip');
      expect(tooltip).toHaveAttribute('role', 'tooltip');
      expect(tooltip).toHaveAttribute('data-placement', 'top');
    });

    it('не рендерится когда visible=false', () => {
      const { queryByRole } = renderIsolated(
        <Tooltip content='Test tooltip' visible={false} />,
      );

      expect(queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('не рендерится когда content=null', () => {
      const { queryByRole } = renderIsolated(
        <Tooltip content={null as any} visible={true} />,
      );

      expect(queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('не рендерится когда content=undefined', () => {
      const { queryByRole } = renderIsolated(
        <Tooltip content={undefined as any} visible={true} />,
      );

      expect(queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('3.2. Контент (content)', () => {
    it('отображает строковый контент', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content='Hello tooltip' visible={true} />,
      );

      const tooltip = getTooltip();
      expect(tooltip).toHaveTextContent('Hello tooltip');
    });

    it('отображает React элемент как контент', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content={<strong>Bold tooltip</strong> as any} visible={true} />,
      );

      const tooltip = getTooltip();
      expect(tooltip).toHaveTextContent('Bold tooltip');
      const strong = tooltip.querySelector('strong');
      expect(strong).toBeInTheDocument();
    });

    it('отображает число как контент', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content={42 as any} visible={true} />,
      );

      const tooltip = getTooltip();
      expect(tooltip).toHaveTextContent('42');
    });
  });

  describe('3.3. Видимость (visible)', () => {
    it('рендерится когда visible=true', () => {
      const { getByRole } = renderIsolated(
        <Tooltip content='Test' visible={true} />,
      );

      expect(getByRole('tooltip')).toBeInTheDocument();
    });

    it('не рендерится когда visible=false', () => {
      const { queryByRole } = renderIsolated(
        <Tooltip content='Test' visible={false} />,
      );

      expect(queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('использует visible=false по умолчанию', () => {
      const { queryByRole } = renderIsolated(
        <Tooltip content='Test' />,
      );

      expect(queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('3.4. Позиционирование (placement)', () => {
    it('применяет placement по умолчанию (top)', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content='Test' visible={true} />,
      );

      const tooltip = getTooltip();
      expect(tooltip).toHaveAttribute('data-placement', 'top');
    });

    it.each(
      [
        ['top', 'top'],
        ['right', 'right'],
        ['bottom', 'bottom'],
        ['left', 'left'],
      ] as const,
    )('применяет placement %s', (placement, expected) => {
      const { getTooltip } = renderIsolated(
        <Tooltip content='Test' visible={true} placement={placement} />,
      );

      const tooltip = getTooltip();
      expect(tooltip).toHaveAttribute('data-placement', expected);
    });
  });

  describe('3.5. Цвета', () => {
    it('применяет цвета по умолчанию', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content='Test' visible={true} />,
      );

      const tooltip = getTooltip();
      expect((tooltip as HTMLElement).style.backgroundColor).toBe('var(--tooltip-bg, #111827)');
      expect((tooltip as HTMLElement).style.color).toBe('var(--tooltip-text, white)');
    });

    it('применяет кастомный bgColor', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content='Test' visible={true} bgColor='#FF0000' />,
      );

      const tooltip = getTooltip();
      expect((tooltip as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('применяет кастомный textColor', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content='Test' visible={true} textColor='#00FF00' />,
      );

      const tooltip = getTooltip();
      expect((tooltip as HTMLElement).style.color).toBe('rgb(0, 255, 0)');
    });
  });

  describe('3.6. Accessibility', () => {
    it('применяет id для aria-describedby связи', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content='Test' visible={true} id='tooltip-1' />,
      );

      const tooltip = getTooltip();
      expect(tooltip).toHaveAttribute('id', 'tooltip-1');
    });

    it('имеет правильную роль', () => {
      const { getByRole } = renderIsolated(
        <Tooltip content='Test' visible={true} />,
      );

      const tooltip = getByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
    });
  });

  describe('3.7. Data атрибуты', () => {
    it('применяет data-testid', () => {
      const { getByTestId } = renderIsolated(
        <Tooltip content='Test' visible={true} data-testid='custom-tooltip' />,
      );

      expect(getByTestId('custom-tooltip')).toBeInTheDocument();
    });

    it('применяет data-placement', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content='Test' visible={true} placement='bottom' />,
      );

      const tooltip = getTooltip();
      expect(tooltip).toHaveAttribute('data-placement', 'bottom');
    });
  });

  describe('3.8. HTML атрибуты', () => {
    it('передает остальные HTML атрибуты', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content='Test' visible={true} className='custom-class' tabIndex={0} />,
      );

      const tooltip = getTooltip();
      expect(tooltip).toHaveClass('custom-class');
      expect(tooltip).toHaveAttribute('tabindex', '0');
    });
  });

  describe('3.9. CSS стили', () => {
    const customStyle = { borderRadius: '10px', fontWeight: 'bold' };

    it('применяет базовые CSS свойства', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content='Test' visible={true} />,
      );

      const tooltip = getTooltip();
      const style = (tooltip as HTMLElement).style;

      expect(style.position).toBe('absolute');
      expect(style.zIndex).toBe('1000');
      expect(style.borderRadius).toBe('6px');
      expect(style.fontSize).toBe('12px');
      expect(style.padding).toBe('6px 8px');
      expect(style.whiteSpace).toBe('nowrap');
      expect(style.pointerEvents).toBe('none');
      expect(style.boxSizing).toBe('border-box');
    });

    it('применяет кастомные стили', () => {
      const { getTooltip } = renderIsolated(
        <Tooltip content='Test' visible={true} style={customStyle} />,
      );

      const tooltip = getTooltip();
      expect((tooltip as HTMLElement).style.borderRadius).toBe('10px');
      expect((tooltip as HTMLElement).style.fontWeight).toBe('bold');
    });
  });

  describe('3.10. resolvePlacementStyle (pure функция)', () => {
    it('возвращает правильные стили для top', () => {
      const styles = resolvePlacementStyle('top');
      expect(styles).toEqual({
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: 6,
      });
    });

    it('возвращает правильные стили для right', () => {
      const styles = resolvePlacementStyle('right');
      expect(styles).toEqual({
        left: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
        marginLeft: 6,
      });
    });

    it('возвращает правильные стили для bottom', () => {
      const styles = resolvePlacementStyle('bottom');
      expect(styles).toEqual({
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginTop: 6,
      });
    });

    it('возвращает правильные стили для left', () => {
      const styles = resolvePlacementStyle('left');
      expect(styles).toEqual({
        right: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
        marginRight: 6,
      });
    });

    it('возвращает пустой объект для неизвестного placement', () => {
      const styles = resolvePlacementStyle('unknown' as any);
      expect(styles).toEqual({});
    });
  });
});
