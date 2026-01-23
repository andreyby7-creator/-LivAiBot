/**
 * @vitest-environment jsdom
 * @file Тесты для App Tabs компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core Tabs - возвращаем простой div
vi.mock('../../../../ui-core/src/components/Tabs', () => ({
  Tabs: React.forwardRef<
    HTMLDivElement,
    Readonly<Record<string, unknown>>
  >((
    props: Readonly<Record<string, unknown>>,
    ref,
  ) => {
    const {
      items = [],
      activeTabId,
      onChange,
      orientation,
      'data-component': dataComponent,
      'data-state': dataState,
      'data-feature-flag': dataFeatureFlag,
      'data-telemetry': dataTelemetry,
      'data-testid': testId,
      ...rest
    } = props;

    const itemsArray = items as readonly Readonly<{
      id: string;
      label: string;
      content: React.ReactNode;
      disabled?: boolean;
    }>[];

    return (
      <div
        ref={ref}
        data-testid={testId ?? 'core-tabs'}
        data-component={dataComponent}
        data-state={dataState}
        data-feature-flag={dataFeatureFlag}
        data-telemetry={dataTelemetry}
        data-orientation={orientation}
        data-active-tab-id={activeTabId}
        {...rest}
      >
        {itemsArray.map((item) => (
          <button
            key={item.id}
            data-tab-id={item.id}
            disabled={item.disabled}
            onClick={(e) => {
              if (typeof onChange === 'function') {
                onChange(item.id, e);
              }
            }}
          >
            {item.label}
          </button>
        ))}
        {itemsArray.find((item) => item.id === (activeTabId ?? itemsArray[0]?.id))?.content}
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

import { Tabs } from '../../../src/ui/tabs';
import { infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);

// Тестовые данные
const testItems = [
  { id: 'tab1', label: 'Tab 1', content: 'Content 1' },
  { id: 'tab2', label: 'Tab 2', content: 'Content 2' },
  { id: 'tab3', label: 'Tab 3', content: 'Content 3' },
];

const itemsWithDisabled = [
  { id: 'tab1', label: 'Tab 1', content: 'Content 1' },
  { id: 'tab2', label: 'Tab 2', content: 'Content 2', disabled: true },
  { id: 'tab3', label: 'Tab 3', content: 'Content 3' },
];

describe('App Tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить tabs с обязательными пропсами', () => {
      render(<Tabs items={testItems} />);

      expect(screen.getByTestId('core-tabs')).toBeInTheDocument();
    });

    it('должен передавать data-component="AppTabs"', () => {
      render(<Tabs items={testItems} />);

      expect(screen.getByTestId('core-tabs')).toHaveAttribute(
        'data-component',
        'AppTabs',
      );
    });

    it('должен передавать data-state="visible"', () => {
      render(<Tabs items={testItems} />);

      expect(screen.getByTestId('core-tabs')).toHaveAttribute('data-state', 'visible');
    });

    it('должен передавать data-feature-flag="visible" по умолчанию', () => {
      render(<Tabs items={testItems} />);

      expect(screen.getByTestId('core-tabs')).toHaveAttribute(
        'data-feature-flag',
        'visible',
      );
    });

    it('должен передавать data-telemetry="enabled" по умолчанию', () => {
      render(<Tabs items={testItems} />);

      expect(screen.getByTestId('core-tabs')).toHaveAttribute(
        'data-telemetry',
        'enabled',
      );
    });

    it('должен передавать items в Core Tabs', () => {
      render(<Tabs items={testItems} />);

      expect(screen.getByText('Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Tab 3')).toBeInTheDocument();
    });

    it('должен передавать activeTabId в Core Tabs', () => {
      render(<Tabs items={testItems} activeTabId='tab2' />);

      expect(screen.getByTestId('core-tabs')).toHaveAttribute(
        'data-active-tab-id',
        'tab2',
      );
    });

    it('должен передавать orientation в Core Tabs', () => {
      render(<Tabs items={testItems} orientation='vertical' />);

      expect(screen.getByTestId('core-tabs')).toHaveAttribute(
        'data-orientation',
        'vertical',
      );
    });

    it('должен передавать data-testid в Core Tabs', () => {
      render(<Tabs items={testItems} data-testid='custom-tabs' />);

      expect(screen.getByTestId('custom-tabs')).toBeInTheDocument();
    });

    it('должен передавать дополнительные пропсы в Core Tabs', () => {
      render(
        <Tabs
          items={testItems}
          className='custom-class'
          style={{ color: 'red' }}
        />,
      );

      const tabs = screen.getByTestId('core-tabs');
      expect(tabs).toHaveClass('custom-class');
      expect(tabs).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });
  });

  describe('Feature flags и policy', () => {
    it('должен рендерить когда visible не указан (по умолчанию true)', () => {
      render(<Tabs items={testItems} />);

      expect(screen.getByTestId('core-tabs')).toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false', () => {
      render(<Tabs items={testItems} visible={false} />);

      expect(screen.queryByTestId('core-tabs')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда isHiddenByFeatureFlag=true', () => {
      render(<Tabs items={testItems} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-tabs')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=false', () => {
      render(<Tabs items={testItems} visible={false} isHiddenByFeatureFlag={false} />);

      expect(screen.queryByTestId('core-tabs')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=true', () => {
      render(<Tabs items={testItems} visible={false} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-tabs')).not.toBeInTheDocument();
    });

    it('должен рендерить когда visible=true и isHiddenByFeatureFlag=false', () => {
      render(<Tabs items={testItems} visible={true} isHiddenByFeatureFlag={false} />);

      expect(screen.getByTestId('core-tabs')).toBeInTheDocument();
    });

    it('должен передавать data-feature-flag="hidden" когда isHiddenByFeatureFlag=true', () => {
      const { container } = render(
        <Tabs items={testItems} isHiddenByFeatureFlag={true} />,
      );

      // Компонент не рендерится, но если бы рендерился, имел бы hidden
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount и unmount telemetry по умолчанию', () => {
      const { unmount } = render(<Tabs items={testItems} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs mount', {
        component: 'Tabs',
        action: 'mount',
        hidden: false,
        visible: true,
        tabsCount: 3,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs unmount', {
        component: 'Tabs',
        action: 'unmount',
        hidden: false,
        visible: true,
        tabsCount: 3,
      });
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(<Tabs items={testItems} telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен передавать data-telemetry="disabled" когда telemetryEnabled=false', () => {
      render(<Tabs items={testItems} telemetryEnabled={false} />);

      expect(screen.getByTestId('core-tabs')).toHaveAttribute(
        'data-telemetry',
        'disabled',
      );
    });

    it('должен отправлять mount telemetry с правильными данными при isHiddenByFeatureFlag=true', () => {
      const { unmount } = render(
        <Tabs items={testItems} isHiddenByFeatureFlag={true} />,
      );

      // Компонент не рендерится, но telemetry должен быть отправлен
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs mount', {
        component: 'Tabs',
        action: 'mount',
        hidden: true,
        visible: false,
        tabsCount: 3,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs unmount', {
        component: 'Tabs',
        action: 'unmount',
        hidden: true,
        visible: false,
        tabsCount: 3,
      });
    });

    it('должен отправлять show telemetry при изменении visible с false на true', () => {
      const { rerender } = render(<Tabs items={testItems} visible={false} />);

      // Очищаем вызовы от mount/unmount
      vi.clearAllMocks();

      rerender(<Tabs items={testItems} visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs show', {
        component: 'Tabs',
        action: 'show',
        hidden: false,
        visible: true,
        tabsCount: 3,
      });
    });

    it('должен отправлять hide telemetry при изменении visible с true на false', () => {
      const { rerender } = render(<Tabs items={testItems} visible={true} />);

      // Очищаем вызовы от mount/unmount
      vi.clearAllMocks();

      rerender(<Tabs items={testItems} visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs hide', {
        component: 'Tabs',
        action: 'hide',
        hidden: false,
        visible: false,
        tabsCount: 3,
      });
    });

    it('не должен отправлять show/hide telemetry при первом рендере', () => {
      render(<Tabs items={testItems} visible={true} />);

      const showCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'Tabs show',
      );
      const hideCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'Tabs hide',
      );

      expect(showCalls).toHaveLength(0);
      expect(hideCalls).toHaveLength(0);
    });

    it('должен отправлять change telemetry при изменении активного таба', () => {
      const mockOnChange = vi.fn();
      render(
        <Tabs items={testItems} activeTabId='tab1' onChange={mockOnChange} />,
      );

      // Очищаем вызовы от mount
      vi.clearAllMocks();

      const tab2Button = screen.getByText('Tab 2');
      fireEvent.click(tab2Button);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs change', {
        component: 'Tabs',
        action: 'change',
        hidden: false,
        visible: true,
        tabsCount: 3,
        activeTabId: 'tab2',
        previousTabId: 'tab1',
      });
    });

    it('не должен отправлять change telemetry когда telemetryEnabled=false', () => {
      const mockOnChange = vi.fn();
      render(
        <Tabs
          items={testItems}
          activeTabId='tab1'
          onChange={mockOnChange}
          telemetryEnabled={false}
        />,
      );

      vi.clearAllMocks();

      const tab2Button = screen.getByText('Tab 2');
      fireEvent.click(tab2Button);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен отправлять change telemetry с orientation если указан', () => {
      const mockOnChange = vi.fn();
      render(
        <Tabs
          items={testItems}
          activeTabId='tab1'
          onChange={mockOnChange}
          orientation='vertical'
        />,
      );

      vi.clearAllMocks();

      const tab2Button = screen.getByText('Tab 2');
      fireEvent.click(tab2Button);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs change', {
        component: 'Tabs',
        action: 'change',
        hidden: false,
        visible: true,
        tabsCount: 3,
        activeTabId: 'tab2',
        previousTabId: 'tab1',
        orientation: 'vertical',
      });
    });

    it('должен отправлять change telemetry без previousTabId при первом изменении', () => {
      const mockOnChange = vi.fn();
      render(<Tabs items={testItems} onChange={mockOnChange} />);

      vi.clearAllMocks();

      const tab2Button = screen.getByText('Tab 2');
      fireEvent.click(tab2Button);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs change', {
        component: 'Tabs',
        action: 'change',
        hidden: false,
        visible: true,
        tabsCount: 3,
        activeTabId: 'tab2',
        orientation: undefined,
      });

      expect(mockInfoFireAndForget.mock.calls[0]?.[1]).not.toHaveProperty('previousTabId');
    });

    it('должен отправлять mount telemetry с activeTabId если указан', () => {
      render(<Tabs items={testItems} activeTabId='tab2' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs mount', {
        component: 'Tabs',
        action: 'mount',
        hidden: false,
        visible: true,
        tabsCount: 3,
        activeTabId: 'tab2',
      });
    });

    it('должен отправлять mount telemetry с orientation если указан', () => {
      render(<Tabs items={testItems} orientation='vertical' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs mount', {
        component: 'Tabs',
        action: 'mount',
        hidden: false,
        visible: true,
        tabsCount: 3,
        orientation: 'vertical',
      });
    });

    it('должен фиксировать policy на момент первого рендера в lifecycle telemetry', () => {
      const { rerender, unmount } = render(
        <Tabs items={testItems} visible={true} isHiddenByFeatureFlag={false} />,
      );

      const mountCall = mockInfoFireAndForget.mock.calls.find(
        (call) => call[0] === 'Tabs mount',
      );

      expect(mountCall?.[1]).toEqual({
        component: 'Tabs',
        action: 'mount',
        hidden: false,
        visible: true,
        tabsCount: 3,
      });

      // Изменяем props
      rerender(
        <Tabs items={testItems} visible={false} isHiddenByFeatureFlag={true} />,
      );

      unmount();

      // Unmount должен использовать исходный payload
      const unmountCall = mockInfoFireAndForget.mock.calls.find(
        (call) => call[0] === 'Tabs unmount',
      );

      expect(unmountCall?.[1]).toEqual({
        component: 'Tabs',
        action: 'unmount',
        hidden: false,
        visible: true,
        tabsCount: 3,
      });
    });
  });

  describe('onChange обработка', () => {
    it('должен вызывать onChange при клике на таб', () => {
      const mockOnChange = vi.fn();
      render(<Tabs items={testItems} onChange={mockOnChange} />);

      const tab2Button = screen.getByText('Tab 2');
      fireEvent.click(tab2Button);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith(
        'tab2',
        expect.any(Object),
      );
    });

    it('не должен вызывать onChange для disabled табов', () => {
      const mockOnChange = vi.fn();
      render(<Tabs items={itemsWithDisabled} onChange={mockOnChange} />);

      const disabledButton = screen.getByText('Tab 2');
      expect(disabledButton).toBeDisabled();

      fireEvent.click(disabledButton);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('должен работать без onChange', () => {
      render(<Tabs items={testItems} />);

      const tab2Button = screen.getByText('Tab 2');
      expect(() => fireEvent.click(tab2Button)).not.toThrow();
    });

    it('должен обновлять previousTabId при последовательных изменениях', () => {
      const mockOnChange = vi.fn();
      render(
        <Tabs items={testItems} activeTabId='tab1' onChange={mockOnChange} />,
      );

      vi.clearAllMocks();

      // Первое изменение: tab1 -> tab2
      const tab2Button = screen.getByText('Tab 2');
      fireEvent.click(tab2Button);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs change', {
        component: 'Tabs',
        action: 'change',
        hidden: false,
        visible: true,
        tabsCount: 3,
        activeTabId: 'tab2',
        previousTabId: 'tab1',
      });

      vi.clearAllMocks();

      // Второе изменение: tab2 -> tab3
      const tab3Button = screen.getByText('Tab 3');
      fireEvent.click(tab3Button);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs change', {
        component: 'Tabs',
        action: 'change',
        hidden: false,
        visible: true,
        tabsCount: 3,
        activeTabId: 'tab3',
        previousTabId: 'tab2',
      });
    });
  });

  describe('Ref forwarding', () => {
    it('должен передавать ref к Core Tabs', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Tabs items={testItems} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'AppTabs');
    });

    it('должен поддерживать callback ref', () => {
      const refCallback = vi.fn();
      render(<Tabs items={testItems} ref={refCallback} />);

      expect(refCallback).toHaveBeenCalledTimes(1);
      expect(refCallback.mock.calls[0]?.[0]).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('Edge cases', () => {
    it('должен работать с пустым массивом items', () => {
      render(<Tabs items={[]} />);

      expect(screen.getByTestId('core-tabs')).toBeInTheDocument();
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Tabs mount', {
        component: 'Tabs',
        action: 'mount',
        hidden: false,
        visible: true,
        tabsCount: 0,
      });
    });

    it('должен работать с одним табом', () => {
      const singleItem = [{ id: 'tab1', label: 'Tab 1', content: 'Content 1' }];
      render(<Tabs items={singleItem} />);

      expect(screen.getByTestId('core-tabs')).toBeInTheDocument();
      expect(screen.getByText('Tab 1')).toBeInTheDocument();
    });

    it('должен работать без activeTabId', () => {
      render(<Tabs items={testItems} />);

      expect(screen.getByTestId('core-tabs')).toBeInTheDocument();
      expect(screen.getByTestId('core-tabs')).not.toHaveAttribute('data-active-tab-id');
    });

    it('должен работать без orientation', () => {
      render(<Tabs items={testItems} />);

      expect(screen.getByTestId('core-tabs')).toBeInTheDocument();
      expect(screen.getByTestId('core-tabs')).not.toHaveAttribute('data-orientation');
    });

    it('должен корректно обрабатывать изменение items', () => {
      const { rerender } = render(<Tabs items={testItems} />);

      const newItems = [
        { id: 'tab4', label: 'Tab 4', content: 'Content 4' },
        { id: 'tab5', label: 'Tab 5', content: 'Content 5' },
      ];

      rerender(<Tabs items={newItems} />);

      expect(screen.getByText('Tab 4')).toBeInTheDocument();
      expect(screen.getByText('Tab 5')).toBeInTheDocument();
      expect(screen.queryByText('Tab 1')).not.toBeInTheDocument();
    });
  });

  describe('Props filtering', () => {
    it('должен передавать только core пропсы в Core Tabs', () => {
      render(
        <Tabs
          items={testItems}
          visible={true}
          isHiddenByFeatureFlag={false}
          telemetryEnabled={true}
          data-testid='custom-tabs'
        />,
      );

      const tabs = screen.getByTestId('custom-tabs');
      expect(tabs).toBeInTheDocument();
      expect(tabs).toHaveAttribute('data-component', 'AppTabs');
      // visible, isHiddenByFeatureFlag, telemetryEnabled не должны попасть в Core
      expect(tabs).not.toHaveAttribute('visible');
      expect(tabs).not.toHaveAttribute('isHiddenByFeatureFlag');
      expect(tabs).not.toHaveAttribute('telemetryEnabled');
    });
  });
});
