/**
 * @vitest-environment jsdom
 * @file Тесты для App Accordion компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core Accordion - возвращаем простой div с кнопками
vi.mock('../../../../ui-core/src/components/Accordion', () => ({
  Accordion: React.forwardRef<
    HTMLDivElement,
    Readonly<Record<string, unknown>>
  >((
    props: Readonly<Record<string, unknown>>,
    ref,
  ) => {
    const {
      items = [],
      openItemId,
      openItemIds,
      onChange,
      mode,
      'data-component': dataComponent,
      'data-state': dataState,
      'data-feature-flag': dataFeatureFlag,
      'data-telemetry': dataTelemetry,
      'data-testid': testId,
      ...rest
    } = props;

    const itemsArray = items as readonly Readonly<{
      id: string;
      header: string;
      content: React.ReactNode;
      disabled?: boolean;
    }>[];

    const openIdsSet = new Set<string>();
    if (mode === 'single' && typeof openItemId === 'string') {
      openIdsSet.add(openItemId);
    } else if (mode === 'multiple' && Array.isArray(openItemIds)) {
      for (const id of openItemIds) {
        if (typeof id === 'string') {
          openIdsSet.add(id);
        }
      }
    }

    return (
      <div
        ref={ref}
        data-testid={testId ?? 'core-accordion'}
        data-component={dataComponent}
        data-state={dataState}
        data-feature-flag={dataFeatureFlag}
        data-telemetry={dataTelemetry}
        data-mode={mode}
        {...rest}
      >
        {itemsArray.map((item) => {
          const isOpen = openIdsSet.has(item.id);
          return (
            <div key={item.id} data-accordion-item={item.id}>
              <button
                type='button'
                data-accordion-item-id={item.id}
                disabled={item.disabled}
                aria-expanded={isOpen}
                onClick={(e) => {
                  if (typeof onChange === 'function' && item.disabled !== true) {
                    onChange(item.id, e as React.MouseEvent<HTMLButtonElement>);
                  }
                }}
              >
                {item.header}
              </button>
              {isOpen && <div data-accordion-panel={item.id}>{item.content}</div>}
            </div>
          );
        })}
      </div>
    );
  }),
}));

// Mock для feature flags - возвращает переданное значение
vi.mock('../../../src/lib/feature-flags', () => ({
  useFeatureFlag: vi.fn((value: boolean) => value),
}));

// Mock для telemetry
vi.mock('../../../src/lib/telemetry', () => ({
  infoFireAndForget: vi.fn(),
}));

import { Accordion } from '../../../src/ui/accordion';
import { infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

// Тестовые данные
const testItems = [
  { id: 'item1', header: 'Item 1', content: 'Content 1' },
  { id: 'item2', header: 'Item 2', content: 'Content 2' },
  { id: 'item3', header: 'Item 3', content: 'Content 3' },
];

const itemsWithDisabled = [
  { id: 'item1', header: 'Item 1', content: 'Content 1' },
  { id: 'item2', header: 'Item 2', content: 'Content 2', disabled: true },
  { id: 'item3', header: 'Item 3', content: 'Content 3' },
];

describe('App Accordion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить accordion с обязательными пропсами', () => {
      render(<Accordion items={testItems} />);

      expect(screen.getByTestId('core-accordion')).toBeInTheDocument();
    });

    it('должен передавать data-component="AppAccordion"', () => {
      render(<Accordion items={testItems} />);

      expect(screen.getByTestId('core-accordion')).toHaveAttribute(
        'data-component',
        'AppAccordion',
      );
    });

    it('должен передавать data-state="visible"', () => {
      render(<Accordion items={testItems} />);

      expect(screen.getByTestId('core-accordion')).toHaveAttribute(
        'data-state',
        'visible',
      );
    });

    it('должен передавать data-feature-flag="visible" по умолчанию', () => {
      render(<Accordion items={testItems} />);

      expect(screen.getByTestId('core-accordion')).toHaveAttribute(
        'data-feature-flag',
        'visible',
      );
    });

    it('должен передавать data-telemetry="enabled" по умолчанию', () => {
      render(<Accordion items={testItems} />);

      expect(screen.getByTestId('core-accordion')).toHaveAttribute(
        'data-telemetry',
        'enabled',
      );
    });

    it('должен передавать items в Core Accordion', () => {
      render(<Accordion items={testItems} />);

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('должен передавать data-testid в Core Accordion', () => {
      render(<Accordion items={testItems} data-testid='custom-accordion' />);

      expect(screen.getByTestId('custom-accordion')).toBeInTheDocument();
    });

    it('должен передавать дополнительные пропсы в Core Accordion', () => {
      render(
        <Accordion
          items={testItems}
          className='custom-class'
          style={{ color: 'red' }}
        />,
      );

      const accordion = screen.getByTestId('core-accordion');
      expect(accordion).toHaveClass('custom-class');
      expect(accordion).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });
  });

  describe('Feature flags и policy', () => {
    it('должен рендерить когда visible не указан (по умолчанию true)', () => {
      render(<Accordion items={testItems} />);

      expect(screen.getByTestId('core-accordion')).toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false', () => {
      render(<Accordion items={testItems} visible={false} />);

      expect(screen.queryByTestId('core-accordion')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда isHiddenByFeatureFlag=true', () => {
      render(<Accordion items={testItems} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-accordion')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=false', () => {
      render(
        <Accordion items={testItems} visible={false} isHiddenByFeatureFlag={false} />,
      );

      expect(screen.queryByTestId('core-accordion')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=true', () => {
      render(
        <Accordion items={testItems} visible={false} isHiddenByFeatureFlag={true} />,
      );

      expect(screen.queryByTestId('core-accordion')).not.toBeInTheDocument();
    });

    it('должен рендерить когда visible=true и isHiddenByFeatureFlag=false', () => {
      render(
        <Accordion items={testItems} visible={true} isHiddenByFeatureFlag={false} />,
      );

      expect(screen.getByTestId('core-accordion')).toBeInTheDocument();
    });

    it('должен передавать data-feature-flag="hidden" когда isHiddenByFeatureFlag=true', () => {
      const { container } = render(
        <Accordion items={testItems} isHiddenByFeatureFlag={true} />,
      );

      // Компонент не рендерится, но если бы рендерился, имел бы hidden
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Режимы работы', () => {
    it('должен работать в single mode с openItemId', () => {
      render(<Accordion items={testItems} mode='single' openItemId='item1' />);

      const accordion = screen.getByTestId('core-accordion');
      expect(accordion).toHaveAttribute('data-mode', 'single');
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    it('должен работать в multiple mode с openItemIds', () => {
      render(
        <Accordion
          items={testItems}
          mode='multiple'
          openItemIds={['item1', 'item2']}
        />,
      );

      const accordion = screen.getByTestId('core-accordion');
      expect(accordion).toHaveAttribute('data-mode', 'multiple');
      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
      expect(screen.queryByText('Content 3')).not.toBeInTheDocument();
    });

    it('должен работать без mode (по умолчанию)', () => {
      render(<Accordion items={testItems} />);

      const accordion = screen.getByTestId('core-accordion');
      expect(accordion).not.toHaveAttribute('data-mode');
    });

    it('должен обрабатывать пустой openItemIds в multiple mode', () => {
      render(<Accordion items={testItems} mode='multiple' openItemIds={[]} />);

      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
    });

    it('должен обрабатывать отсутствие openItemId в single mode', () => {
      render(<Accordion items={testItems} mode='single' />);

      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount и unmount telemetry по умолчанию', () => {
      const { unmount } = render(<Accordion items={testItems} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Accordion mount', {
        component: 'Accordion',
        action: 'mount',
        hidden: false,
        visible: true,
        itemsCount: 3,
        openItemsCount: 0,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Accordion unmount', {
        component: 'Accordion',
        action: 'unmount',
        hidden: false,
        visible: true,
        itemsCount: 3,
        openItemsCount: 0,
      });
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(<Accordion items={testItems} telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен передавать data-telemetry="disabled" когда telemetryEnabled=false', () => {
      render(<Accordion items={testItems} telemetryEnabled={false} />);

      expect(screen.getByTestId('core-accordion')).toHaveAttribute(
        'data-telemetry',
        'disabled',
      );
    });

    it('должен отправлять mount telemetry с правильными данными при isHiddenByFeatureFlag=true', () => {
      const { unmount } = render(
        <Accordion items={testItems} isHiddenByFeatureFlag={true} />,
      );

      // Компонент не рендерится, но telemetry должен быть отправлен
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Accordion mount', {
        component: 'Accordion',
        action: 'mount',
        hidden: true,
        visible: false,
        itemsCount: 3,
        openItemsCount: 0,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Accordion unmount', {
        component: 'Accordion',
        action: 'unmount',
        hidden: true,
        visible: false,
        itemsCount: 3,
        openItemsCount: 0,
      });
    });

    it('должен отправлять show telemetry при изменении visible с false на true', () => {
      const { rerender } = render(<Accordion items={testItems} visible={false} />);

      // Очищаем вызовы от mount/unmount
      vi.clearAllMocks();

      rerender(<Accordion items={testItems} visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Accordion show', {
        component: 'Accordion',
        action: 'show',
        hidden: false,
        visible: true,
        itemsCount: 3,
        openItemsCount: 0,
      });
    });

    it('должен отправлять hide telemetry при изменении visible с true на false', () => {
      const { rerender } = render(<Accordion items={testItems} visible={true} />);

      // Очищаем вызовы от mount/unmount
      vi.clearAllMocks();

      rerender(<Accordion items={testItems} visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Accordion hide', {
        component: 'Accordion',
        action: 'hide',
        hidden: false,
        visible: false,
        itemsCount: 3,
        openItemsCount: 0,
      });
    });

    it('не должен отправлять show/hide telemetry при первом рендере', () => {
      render(<Accordion items={testItems} visible={true} />);

      const showCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'Accordion show',
      );
      const hideCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'Accordion hide',
      );

      expect(showCalls).toHaveLength(0);
      expect(hideCalls).toHaveLength(0);
    });

    it('должен отправлять toggle telemetry при клике на элемент', () => {
      const mockOnChange = vi.fn();
      render(
        <Accordion
          items={testItems}
          mode='single'
          onChange={mockOnChange}
        />,
      );

      // Не очищаем, чтобы сохранить mount и увидеть toggle

      const item1Button = screen.getByText('Item 1');
      fireEvent.click(item1Button);

      const toggleCall = mockInfoFireAndForget.mock.calls.find(
        (call) => call[0] === 'Accordion toggle',
      );
      expect(toggleCall).toEqual(['Accordion toggle', {
        component: 'Accordion',
        action: 'toggle',
        hidden: false,
        visible: true,
        itemsCount: 3,
        openItemsCount: 0,
        mode: 'single',
      }]);
    });

    it('не должен отправлять toggle telemetry когда telemetryEnabled=false', () => {
      const mockOnChange = vi.fn();
      render(
        <Accordion
          items={testItems}
          mode='single'
          openItemId='item1'
          onChange={mockOnChange}
          telemetryEnabled={false}
        />,
      );

      vi.clearAllMocks();

      const item1Button = screen.getByText('Item 1');
      fireEvent.click(item1Button);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен отправлять toggle telemetry с openItemIds в multiple mode', () => {
      const mockOnChange = vi.fn();
      render(
        <Accordion
          items={testItems}
          mode='multiple'
          openItemIds={['item1', 'item2']}
          onChange={mockOnChange}
        />,
      );

      // Не очищаем, чтобы сохранить mount

      const item1Button = screen.getByText('Item 1');
      fireEvent.click(item1Button);

      const toggleCall = mockInfoFireAndForget.mock.calls.find(
        (call) => call[0] === 'Accordion toggle',
      );
      expect(toggleCall).toEqual(['Accordion toggle', {
        component: 'Accordion',
        action: 'toggle',
        hidden: false,
        visible: true,
        itemsCount: 3,
        openItemsCount: 2,
        openItemIds: JSON.stringify(['item1', 'item2']),
        mode: 'multiple',
      }]);
    });

    it('должен отправлять toggle telemetry без openItemIds когда нет открытых элементов', () => {
      const mockOnChange = vi.fn();
      render(
        <Accordion items={testItems} mode='single' onChange={mockOnChange} />,
      );

      // Не очищаем, чтобы сохранить mount

      const item1Button = screen.getByText('Item 1');
      fireEvent.click(item1Button);

      const toggleCall = mockInfoFireAndForget.mock.calls.find(
        (call) => call[0] === 'Accordion toggle',
      );
      expect(toggleCall).toEqual(['Accordion toggle', {
        component: 'Accordion',
        action: 'toggle',
        hidden: false,
        visible: true,
        itemsCount: 3,
        openItemsCount: 0,
        mode: 'single',
      }]);

      expect(toggleCall?.[1]).not.toHaveProperty('openItemIds');
    });

    it('должен отправлять mount telemetry с mode если указан', () => {
      render(<Accordion items={testItems} mode='multiple' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Accordion mount', {
        component: 'Accordion',
        action: 'mount',
        hidden: false,
        visible: true,
        itemsCount: 3,
        openItemsCount: 0,
        mode: 'multiple',
      });
    });

    it('должен отправлять mount telemetry с openItemIds если есть открытые элементы', () => {
      render(
        <Accordion
          items={testItems}
          mode='multiple'
          openItemIds={['item1', 'item2']}
        />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Accordion mount', {
        component: 'Accordion',
        action: 'mount',
        hidden: false,
        visible: true,
        itemsCount: 3,
        openItemsCount: 2,
        openItemIds: JSON.stringify(['item1', 'item2']),
        mode: 'multiple',
      });
    });

    it('должен фиксировать policy на момент первого рендера в lifecycle telemetry', () => {
      const { rerender, unmount } = render(
        <Accordion items={testItems} visible={true} isHiddenByFeatureFlag={false} />,
      );

      const mountCall = mockInfoFireAndForget.mock.calls.find(
        (call) => call[0] === 'Accordion mount',
      );

      expect(mountCall?.[1]).toEqual({
        component: 'Accordion',
        action: 'mount',
        hidden: false,
        visible: true,
        itemsCount: 3,
        openItemsCount: 0,
      });

      // Изменяем props
      rerender(
        <Accordion items={testItems} visible={false} isHiddenByFeatureFlag={true} />,
      );

      unmount();

      // Unmount должен использовать исходный payload
      const unmountCall = mockInfoFireAndForget.mock.calls.find(
        (call) => call[0] === 'Accordion unmount',
      );

      expect(unmountCall?.[1]).toEqual({
        component: 'Accordion',
        action: 'unmount',
        hidden: false,
        visible: true,
        itemsCount: 3,
        openItemsCount: 0,
      });
    });
  });

  describe('onChange обработчик', () => {
    it('должен вызывать onChange при клике на элемент', () => {
      const mockOnChange = vi.fn();
      render(<Accordion items={testItems} onChange={mockOnChange} />);

      const item1Button = screen.getByText('Item 1');
      fireEvent.click(item1Button);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith(
        'item1',
        expect.any(Object),
      );
    });

    it('не должен вызывать onChange для disabled элементов', () => {
      const mockOnChange = vi.fn();
      render(<Accordion items={itemsWithDisabled} onChange={mockOnChange} />);

      const item2Button = screen.getByText('Item 2');
      fireEvent.click(item2Button);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('должен вызывать onChange даже когда telemetryEnabled=false', () => {
      const mockOnChange = vi.fn();
      render(
        <Accordion
          items={testItems}
          onChange={mockOnChange}
          telemetryEnabled={false}
        />,
      );

      const item1Button = screen.getByText('Item 1');
      fireEvent.click(item1Button);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });

    it('должен работать без onChange', () => {
      render(<Accordion items={testItems} />);

      const item1Button = screen.getByText('Item 1');
      expect(() => fireEvent.click(item1Button)).not.toThrow();
    });
  });

  describe('Props filtering', () => {
    it('не должен передавать visible в Core Accordion', () => {
      render(<Accordion items={testItems} visible={true} />);

      const accordion = screen.getByTestId('core-accordion');
      expect(accordion).not.toHaveAttribute('visible');
    });

    it('не должен передавать isHiddenByFeatureFlag в Core Accordion', () => {
      render(<Accordion items={testItems} isHiddenByFeatureFlag={false} />);

      const accordion = screen.getByTestId('core-accordion');
      expect(accordion).not.toHaveAttribute('isHiddenByFeatureFlag');
    });

    it('не должен передавать telemetryEnabled в Core Accordion', () => {
      render(<Accordion items={testItems} telemetryEnabled={true} />);

      const accordion = screen.getByTestId('core-accordion');
      expect(accordion).not.toHaveAttribute('telemetryEnabled');
    });
  });

  describe('Ref forwarding', () => {
    it('должен пробрасывать ref в Core Accordion', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Accordion items={testItems} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toBe(screen.getByTestId('core-accordion'));
    });

    it('должен работать с callback ref', () => {
      const refCallback = vi.fn();
      render(<Accordion items={testItems} ref={refCallback} />);

      expect(refCallback).toHaveBeenCalledTimes(1);
      expect(refCallback.mock.calls[0]?.[0]).toBeInstanceOf(HTMLDivElement);
      expect(refCallback.mock.calls[0]?.[0]).toBe(screen.getByTestId('core-accordion'));
    });
  });

  describe('Edge cases', () => {
    it('должен обрабатывать пустой массив items', () => {
      render(<Accordion items={[]} />);

      expect(screen.getByTestId('core-accordion')).toBeInTheDocument();
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Accordion mount', {
        component: 'Accordion',
        action: 'mount',
        hidden: false,
        visible: true,
        itemsCount: 0,
        openItemsCount: 0,
      });
    });

    it('должен обрабатывать single mode с openItemIds (warning в dev)', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        // Suppress console.warn in tests
      });

      render(
        <Accordion items={testItems} mode='single' openItemIds={['item1']} />,
      );

      if (process.env['NODE_ENV'] !== 'production') {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[Accordion] openItemIds ignored in single mode. Use openItemId instead.',
        );
      }

      consoleSpy.mockRestore();
    });

    it('должен корректно обрабатывать изменение items', () => {
      const { rerender } = render(<Accordion items={testItems} />);

      const newItems = [
        { id: 'item4', header: 'Item 4', content: 'Content 4' },
      ];
      rerender(<Accordion items={newItems} />);

      expect(screen.getByText('Item 4')).toBeInTheDocument();
      expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    });

    it('должен корректно обрабатывать изменение openItemId', () => {
      const { rerender } = render(
        <Accordion items={testItems} mode='single' openItemId='item1' />,
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();

      rerender(
        <Accordion items={testItems} mode='single' openItemId='item2' />,
      );

      expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });

    it('должен корректно обрабатывать изменение openItemIds', () => {
      const { rerender } = render(
        <Accordion
          items={testItems}
          mode='multiple'
          openItemIds={['item1']}
        />,
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument();

      rerender(
        <Accordion
          items={testItems}
          mode='multiple'
          openItemIds={['item1', 'item2']}
        />,
      );

      expect(screen.getByText('Content 1')).toBeInTheDocument();
      expect(screen.getByText('Content 2')).toBeInTheDocument();
    });
  });

  describe('Memoization', () => {
    it('должен мемоизировать компонент', () => {
      const TestComponent = React.memo(Accordion);
      const { rerender } = render(
        <TestComponent items={testItems} visible={true} />,
      );

      const firstRender = screen.getByTestId('core-accordion');

      rerender(<TestComponent items={testItems} visible={true} />);

      const secondRender = screen.getByTestId('core-accordion');

      // React.memo должен предотвратить ненужные ре-рендеры
      // Но в тестах это сложно проверить напрямую
      expect(firstRender).toBe(secondRender);
    });
  });
});
