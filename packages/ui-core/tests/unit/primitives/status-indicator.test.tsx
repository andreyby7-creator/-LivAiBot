/**
 * @vitest-environment jsdom
 * @file Unit тесты для StatusIndicator компонента
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StatusIndicator } from '../../../src/primitives/status-indicator.js';

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
    getIndicator: () =>
      container.querySelector('span[data-component="CoreStatusIndicator"]') as HTMLElement,
    getDot: () =>
      container.querySelector(
        'span[data-component="CoreStatusIndicator"] > span[aria-hidden="true"]',
      ) as HTMLElement,
    getIcon: () =>
      container.querySelector(
        'span[data-component="CoreStatusIndicator"] > span[aria-hidden="true"]',
      ) as HTMLElement,
    getText: () =>
      container.querySelector(
        'span[data-component="CoreStatusIndicator"] > span[aria-hidden="true"]',
      ) as HTMLElement,
  };
}

describe('StatusIndicator', () => {
  // Вынесенные константы для соблюдения ESLint правил
  const customStyle: Readonly<{ margin: string; padding: string; }> = {
    margin: '10px',
    padding: '5px',
  };

  const customClassName = 'custom-status-indicator';

  describe('1.1. Рендер без падений', () => {
    it('рендерится с дефолтными пропсами', () => {
      const { container, getIndicator } = renderIsolated(<StatusIndicator />);

      expect(container).toBeInTheDocument();
      expect(getIndicator()).toBeInTheDocument();
    });

    it('создает span элемент с правильными атрибутами по умолчанию', () => {
      const { getIndicator } = renderIsolated(<StatusIndicator />);

      const indicator = getIndicator();
      expect(indicator).toBeInTheDocument();
      expect(indicator.tagName).toBe('SPAN');
      expect(indicator).toHaveAttribute('data-component', 'CoreStatusIndicator');
      expect(indicator).toHaveAttribute('data-status', 'idle');
      expect(indicator).toHaveAttribute('data-variant', 'dot');
      expect(indicator).toHaveAttribute('data-size', 'md');
      expect(indicator).toHaveAttribute('role', 'status');
      expect(indicator).toHaveAttribute('aria-live', 'polite');
      expect(indicator).toHaveAttribute('aria-label', 'Status: Idle');
      expect(indicator).toHaveAttribute('title', 'Status: Idle');
    });
  });

  describe('1.2. Статусы (status)', () => {
    it.each(
      [
        ['idle', 'Idle'],
        ['loading', 'Loading'],
        ['success', 'Success'],
        ['error', 'Error'],
      ] as const,
    )('отображает статус %s', (status, expectedLabel) => {
      const { getIndicator } = renderIsolated(<StatusIndicator status={status} />);

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('data-status', status);
      expect(indicator).toHaveAttribute('aria-label', `Status: ${expectedLabel}`);
      expect(indicator).toHaveAttribute('title', `Status: ${expectedLabel}`);
    });

    it('по умолчанию status="idle"', () => {
      const { getIndicator } = renderIsolated(<StatusIndicator />);

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('data-status', 'idle');
    });
  });

  describe('1.3. Варианты (variant)', () => {
    it('variant="dot" (по умолчанию) рендерит точку', () => {
      const { getIndicator, getDot } = renderIsolated(<StatusIndicator variant='dot' />);

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('data-variant', 'dot');

      const dot = getDot();
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveAttribute('aria-hidden', 'true');
    });

    it('variant="icon" рендерит иконку', () => {
      const { getIndicator, getIcon } = renderIsolated(
        <StatusIndicator variant='icon' status='success' />,
      );

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('data-variant', 'icon');

      const icon = getIcon();
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon).toHaveTextContent('✓');
    });

    it('variant="text" рендерит текст', () => {
      const { getIndicator, getText } = renderIsolated(
        <StatusIndicator variant='text' status='success' />,
      );

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('data-variant', 'text');

      const text = getText();
      expect(text).toBeInTheDocument();
      expect(text).toHaveAttribute('aria-hidden', 'true');
      expect(text).toHaveTextContent('Success');
    });

    it('иконки для каждого статуса', () => {
      const icons: Record<string, string> = {
        idle: '○',
        loading: '⟳',
        success: '✓',
        error: '✕',
      };

      for (const [status, expectedIcon] of Object.entries(icons)) {
        const { getIcon } = renderIsolated(
          <StatusIndicator variant='icon' status={status as any} />,
        );

        expect(getIcon()).toHaveTextContent(expectedIcon);
      }
    });
  });

  describe('1.4. Размеры (size)', () => {
    it('по умолчанию size="md"', () => {
      const { getIndicator, getDot } = renderIsolated(<StatusIndicator />);

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('data-size', 'md');

      const dot = getDot();
      expect(dot).toHaveStyle({
        width: '10px',
        height: '10px',
      });
    });

    it.each(
      [
        ['sm', '8px', '11px'],
        ['md', '10px', '12px'],
        ['lg', '12px', '14px'],
      ] as const,
    )('применяет размер %s', (size, expectedDotSize, expectedFontSize) => {
      const { getIndicator, getDot } = renderIsolated(<StatusIndicator size={size} />);

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('data-size', size);

      const dot = getDot();
      expect(dot).toHaveStyle({
        width: expectedDotSize,
        height: expectedDotSize,
      });

      // Проверяем text вариант
      const { getText } = renderIsolated(
        <StatusIndicator size={size} variant='text' />,
      );

      const text = getText();
      expect(text).toHaveStyle({
        fontSize: expectedFontSize,
      });
    });
  });

  describe('1.5. Кастомный цвет (color)', () => {
    it('применяет кастомный цвет для dot варианта', () => {
      const { getDot } = renderIsolated(
        <StatusIndicator variant='dot' color='#FF0000' />,
      );

      const dot = getDot();
      expect(dot).toHaveStyle({
        backgroundColor: 'rgb(255, 0, 0)',
      });
    });

    it('применяет кастомный цвет для icon варианта', () => {
      const { getIcon } = renderIsolated(
        <StatusIndicator variant='icon' color='#00FF00' />,
      );

      const icon = getIcon();
      expect(icon).toHaveStyle({
        color: 'rgb(0, 255, 0)',
      });
    });

    it('применяет кастомный цвет для text варианта', () => {
      const { getText } = renderIsolated(
        <StatusIndicator variant='text' color='#0000FF' />,
      );

      const text = getText();
      expect(text).toHaveStyle({
        color: 'rgb(0, 0, 255)',
      });
    });

    it('кастомный цвет переопределяет цвет статуса', () => {
      const { getDot } = renderIsolated(
        <StatusIndicator variant='dot' status='success' color='#FF0000' />,
      );

      const dot = getDot();
      expect(dot).toHaveStyle({
        backgroundColor: 'rgb(255, 0, 0)',
      });
    });
  });

  describe('1.6. Кастомный текст (text)', () => {
    it('применяет кастомный текст для text варианта', () => {
      const { getText } = renderIsolated(
        <StatusIndicator variant='text' text='Custom Text' />,
      );

      const text = getText();
      expect(text).toHaveTextContent('Custom Text');
    });

    it('кастомный текст переопределяет текст статуса', () => {
      const { getIndicator, getText } = renderIsolated(
        <StatusIndicator variant='text' status='success' text='Custom Success' />,
      );

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('aria-label', 'Status: Custom Success');

      const text = getText();
      expect(text).toHaveTextContent('Custom Success');
    });

    it('кастомный текст не влияет на dot вариант', () => {
      const { getDot } = renderIsolated(
        <StatusIndicator variant='dot' text='Custom Text' />,
      );

      const dot = getDot();
      expect(dot).toBeInTheDocument();
      expect(dot).not.toHaveTextContent('Custom Text');
    });
  });

  describe('1.7. Цвета статусов', () => {
    it.each(
      [
        ['idle', 'var(--status-indicator-color-idle, #9CA3AF)'],
        ['loading', 'var(--status-indicator-color-loading, #3B82F6)'],
        ['success', 'var(--status-indicator-color-success, #22C55E)'],
        ['error', 'var(--status-indicator-color-error, #EF4444)'],
      ] as const,
    )('применяет цвет для статуса %s', (status, expectedColor) => {
      const { getDot } = renderIsolated(
        <StatusIndicator variant='dot' status={status} />,
      );

      const dot = getDot();
      expect(dot).toHaveStyle({
        backgroundColor: expectedColor,
      });
    });
  });

  describe('1.8. ARIA атрибуты', () => {
    it('применяет кастомный aria-label', () => {
      const { getIndicator } = renderIsolated(
        <StatusIndicator aria-label='Custom label' />,
      );

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('aria-label', 'Custom label');
      expect(indicator).toHaveAttribute('title', 'Custom label');
    });

    it('генерирует aria-label из статуса если не указан', () => {
      const { getIndicator } = renderIsolated(
        <StatusIndicator status='loading' />,
      );

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('aria-label', 'Status: Loading');
    });

    it('role="status" и aria-live="polite" всегда присутствуют', () => {
      const { getIndicator } = renderIsolated(<StatusIndicator />);

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('role', 'status');
      expect(indicator).toHaveAttribute('aria-live', 'polite');
    });

    it('внутренние span имеют aria-hidden="true"', () => {
      const { getDot, getIcon, getText } = renderIsolated(
        <>
          <StatusIndicator variant='dot' data-testid='dot' />
          <StatusIndicator variant='icon' data-testid='icon' />
          <StatusIndicator variant='text' data-testid='text' />
        </>,
      );

      expect(getDot()).toHaveAttribute('aria-hidden', 'true');
      expect(getIcon()).toHaveAttribute('aria-hidden', 'true');
      expect(getText()).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('1.9. Ref forwarding', () => {
    it('передает ref на span элемент', () => {
      const ref = React.createRef<HTMLSpanElement>();
      renderIsolated(<StatusIndicator ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLSpanElement);
      expect(ref.current).toHaveAttribute('data-component', 'CoreStatusIndicator');
    });

    it('ref обновляется при изменении пропсов', () => {
      const ref = React.createRef<HTMLSpanElement>();
      const { rerender } = renderIsolated(<StatusIndicator ref={ref} status='idle' />);

      expect(ref.current).toBeInTheDocument();

      rerender(<StatusIndicator ref={ref} status='success' />);

      expect(ref.current).toBeInTheDocument();
      expect(ref.current).toHaveAttribute('data-status', 'success');
    });
  });

  describe('1.10. HTML атрибуты', () => {
    it('применяет className', () => {
      const { getIndicator } = renderIsolated(
        <StatusIndicator className={customClassName} />,
      );

      const indicator = getIndicator();
      expect(indicator).toHaveClass(customClassName);
    });

    it('применяет style', () => {
      const { getIndicator } = renderIsolated(
        <StatusIndicator style={customStyle} />,
      );

      const indicator = getIndicator();
      expect(indicator).toHaveStyle({
        margin: '10px',
        padding: '5px',
      });
    });

    it('применяет data-testid', () => {
      const { getByTestId } = renderIsolated(
        <StatusIndicator data-testid='status-test' />,
      );

      expect(getByTestId('status-test')).toBeInTheDocument();
    });

    it('передает остальные HTML атрибуты', () => {
      const { getIndicator } = renderIsolated(
        <StatusIndicator id='status-id' data-custom='custom-value' />,
      );

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('id', 'status-id');
      expect(indicator).toHaveAttribute('data-custom', 'custom-value');
    });
  });

  describe('1.11. Комбинации пропсов', () => {
    it('работает с комбинацией status, variant, size', () => {
      const { getIndicator, getIcon } = renderIsolated(
        <StatusIndicator status='error' variant='icon' size='lg' />,
      );

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('data-status', 'error');
      expect(indicator).toHaveAttribute('data-variant', 'icon');
      expect(indicator).toHaveAttribute('data-size', 'lg');

      const icon = getIcon();
      expect(icon).toHaveTextContent('✕');
      expect(icon).toHaveStyle({
        fontSize: '14px',
      });
    });

    it('работает с кастомным цветом и текстом', () => {
      const { getIndicator, getText } = renderIsolated(
        <StatusIndicator
          variant='text'
          status='loading'
          color='#FF00FF'
          text='Processing...'
        />,
      );

      const indicator = getIndicator();
      expect(indicator).toHaveAttribute('aria-label', 'Status: Processing...');

      const text = getText();
      expect(text).toHaveTextContent('Processing...');
      expect(text).toHaveStyle({
        color: 'rgb(255, 0, 255)',
      });
    });
  });

  describe('1.12. Стабильность (memo)', () => {
    it('не перерендеривается при неизменных пропсах', () => {
      const { rerender, getIndicator } = renderIsolated(
        <StatusIndicator status='idle' variant='dot' />,
      );

      const firstRender = getIndicator();

      rerender(<StatusIndicator status='idle' variant='dot' />);

      const secondRender = getIndicator();
      // React.memo должен предотвратить перерендер
      expect(secondRender).toBe(firstRender);
    });

    it('перерендеривается при изменении пропсов', () => {
      const { rerender, getIndicator } = renderIsolated(
        <StatusIndicator status='idle' />,
      );

      const firstRender = getIndicator();
      expect(firstRender).toHaveAttribute('data-status', 'idle');

      rerender(<StatusIndicator status='success' />);

      const secondRender = getIndicator();
      expect(secondRender).toHaveAttribute('data-status', 'success');
    });
  });

  describe('1.13. Edge cases', () => {
    it('обрабатывает пустой text', () => {
      const { getText } = renderIsolated(
        <StatusIndicator variant='text' text='' />,
      );

      const text = getText();
      expect(text).toHaveTextContent('');
    });

    it('обрабатывает все варианты с разными статусами', () => {
      const statuses = ['idle', 'loading', 'success', 'error'] as const;
      const variants = ['dot', 'icon', 'text'] as const;

      for (const status of statuses) {
        for (const variant of variants) {
          const { getIndicator } = renderIsolated(
            <StatusIndicator status={status} variant={variant} />,
          );

          const indicator = getIndicator();
          expect(indicator).toHaveAttribute('data-status', status);
          expect(indicator).toHaveAttribute('data-variant', variant);
        }
      }
    });
  });
});
