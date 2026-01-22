/**
 * @vitest-environment jsdom
 * @file Unit тесты для Badge компонента
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Badge } from '../../../src/primitives/badge.js';

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
    getBadge: () => container.querySelector('span[data-component="CoreBadge"]')!,
  };
}

describe('Badge', () => {
  describe('2.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getBadge } = renderIsolated(<Badge value='test' />);

      expect(container).toBeInTheDocument();
      expect(getBadge()).toBeInTheDocument();
    });

    it('создает span элемент с правильными атрибутами по умолчанию', () => {
      const { getBadge } = renderIsolated(<Badge value='test' />);

      const badge = getBadge();
      expect(badge).toBeInTheDocument();
      expect(badge.tagName).toBe('SPAN');
      expect(badge).toHaveAttribute('data-component', 'CoreBadge');
      expect(badge).toHaveAttribute('role', 'img');
      expect(badge).toHaveAttribute('aria-label', 'test');
      expect(badge).toHaveAttribute('aria-hidden', 'false');
    });
  });

  describe('2.2. Значение (value)', () => {
    it('отображает строковое значение', () => {
      const { getBadge } = renderIsolated(<Badge value='Hello' />);

      const badge = getBadge();
      expect(badge).toHaveTextContent('Hello');
      expect(badge).toHaveAttribute('aria-label', 'Hello');
    });

    it('отображает числовое значение', () => {
      const { getBadge } = renderIsolated(<Badge value={42} />);

      const badge = getBadge();
      expect(badge).toHaveTextContent('42');
      expect(badge).toHaveAttribute('aria-label', '42');
    });

    it('отображает пустую строку для null значения', () => {
      const { getBadge } = renderIsolated(<Badge value={null} />);

      const badge = getBadge();
      expect(badge).toHaveTextContent('');
      expect(badge).toHaveAttribute('aria-label', 'Badge');
      expect(badge).toHaveAttribute('aria-hidden', 'true');
    });

    it('fallback aria-label для пустого значения', () => {
      const { getBadge } = renderIsolated(<Badge value='' />);

      const badge = getBadge();
      expect(badge).toHaveTextContent('');
      expect(badge).toHaveAttribute('aria-label', 'Badge');
      expect(badge).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('2.3. Размеры (size)', () => {
    it('применяет размер по умолчанию (medium)', () => {
      const { getBadge } = renderIsolated(<Badge value='test' />);

      const badge = getBadge();
      expect((badge as HTMLElement).style.minHeight).toBe('20px');
      expect((badge as HTMLElement).style.fontSize).toBe('12px');
      expect((badge as HTMLElement).style.padding).toBe('0px 8px');
    });

    it.each(
      [
        ['small', '16px', '10px', '0px 6px'],
        ['medium', '20px', '12px', '0px 8px'],
        ['large', '24px', '14px', '0px 10px'],
      ] as const,
    )('применяет размер %s', (size, expectedHeight, expectedFontSize, expectedPadding) => {
      const { getBadge } = renderIsolated(<Badge value='test' size={size} />);

      const badge = getBadge();
      expect((badge as HTMLElement).style.minHeight).toBe(expectedHeight);
      expect((badge as HTMLElement).style.fontSize).toBe(expectedFontSize);
      expect((badge as HTMLElement).style.padding).toBe(expectedPadding);
    });
  });

  describe('2.4. Варианты (variant)', () => {
    it('применяет вариант по умолчанию (default)', () => {
      const { getBadge } = renderIsolated(<Badge value='test' />);

      const badge = getBadge();
      expect((badge as HTMLElement).style.backgroundColor).toBe('var(--badge-bg-default, #E5E7EB)');
      expect((badge as HTMLElement).style.color).toBe('var(--badge-text-default, #111827)');
    });

    it.each(
      [
        ['success', 'var(--badge-bg-success, #22C55E)', 'var(--badge-text-success, white)'],
        ['warning', 'var(--badge-bg-warning, #F59E0B)', 'var(--badge-text-warning, white)'],
        ['error', 'var(--badge-bg-error, #EF4444)', 'var(--badge-text-error, white)'],
        ['info', 'var(--badge-bg-info, #3B82F6)', 'var(--badge-text-info, white)'],
      ] as const,
    )('применяет вариант %s', (variant, expectedBgColor, expectedTextColor) => {
      const { getBadge } = renderIsolated(<Badge value='test' variant={variant} />);

      const badge = getBadge();
      expect((badge as HTMLElement).style.backgroundColor).toBe(expectedBgColor);
      expect((badge as HTMLElement).style.color).toBe(expectedTextColor);
    });
  });

  describe('2.5. Кастомные цвета', () => {
    it('применяет кастомный bgColor', () => {
      const { getBadge } = renderIsolated(<Badge value='test' bgColor='#FF0000' />);

      const badge = getBadge();
      expect((badge as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('применяет кастомный textColor', () => {
      const { getBadge } = renderIsolated(<Badge value='test' textColor='#00FF00' />);

      const badge = getBadge();
      expect((badge as HTMLElement).style.color).toBe('rgb(0, 255, 0)');
    });

    it('кастомные цвета имеют приоритет над вариантом', () => {
      const { getBadge } = renderIsolated(
        <Badge value='test' variant='success' bgColor='#000000' textColor='#FFFFFF' />,
      );

      const badge = getBadge();
      expect((badge as HTMLElement).style.backgroundColor).toBe('rgb(0, 0, 0)');
      expect((badge as HTMLElement).style.color).toBe('rgb(255, 255, 255)');
    });
  });

  describe('2.6. Стили и атрибуты', () => {
    const customStyle = { borderRadius: '4px', fontWeight: 'bold' };

    it('применяет кастомные стили', () => {
      const { getBadge } = renderIsolated(<Badge value='test' style={customStyle} />);

      const badge = getBadge();
      expect((badge as HTMLElement).style.borderRadius).toBe('4px');
      expect((badge as HTMLElement).style.fontWeight).toBe('bold');
    });

    it('применяет className', () => {
      const { getBadge } = renderIsolated(<Badge value='test' className='custom-class' />);

      const badge = getBadge();
      expect(badge).toHaveClass('custom-class');
    });

    it('применяет data-testid', () => {
      const { getByTestId } = renderIsolated(<Badge value='test' data-testid='custom-badge' />);

      expect(getByTestId('custom-badge')).toBeInTheDocument();
    });

    it('передает остальные HTML атрибуты', () => {
      const { getBadge } = renderIsolated(<Badge value='test' id='badge-1' tabIndex={0} />);

      const badge = getBadge();
      expect(badge).toHaveAttribute('id', 'badge-1');
      expect(badge).toHaveAttribute('tabindex', '0');
    });
  });

  describe('2.7. Доступность', () => {
    it('имеет правильную семантику для непустого значения', () => {
      const { getBadge } = renderIsolated(<Badge value='test' />);

      const badge = getBadge();
      expect(badge).toHaveAttribute('role', 'img');
      expect(badge).toHaveAttribute('aria-label', 'test');
      expect(badge).toHaveAttribute('aria-hidden', 'false');
    });

    it('скрывает пустые badges от скринридеров', () => {
      const { getBadge } = renderIsolated(<Badge value='' />);

      const badge = getBadge();
      expect(badge).toHaveAttribute('role', 'img');
      expect(badge).toHaveAttribute('aria-label', 'Badge');
      expect(badge).toHaveAttribute('aria-hidden', 'true');
    });

    it('скрывает null badges от скринридеров', () => {
      const { getBadge } = renderIsolated(<Badge value={null} />);

      const badge = getBadge();
      expect(badge).toHaveAttribute('role', 'img');
      expect(badge).toHaveAttribute('aria-label', 'Badge');
      expect(badge).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('2.8. CSS свойства', () => {
    it('применяет базовые CSS свойства', () => {
      const { getBadge } = renderIsolated(<Badge value='test' />);

      const badge = getBadge();
      const style = (badge as HTMLElement).style;

      expect(style.display).toBe('inline-flex');
      expect(style.alignItems).toBe('center');
      expect(style.justifyContent).toBe('center');
      expect(style.borderRadius).toBe('9999px');
      expect(style.whiteSpace).toBe('nowrap');
      expect(style.userSelect).toBe('none');
      expect(style.boxSizing).toBe('border-box');
      expect(style.lineHeight).toBe('1');
      expect(style.fontWeight).toBe('600');
    });
  });
});
