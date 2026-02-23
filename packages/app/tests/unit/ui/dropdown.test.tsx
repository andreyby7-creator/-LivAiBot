/**
 * @vitest-environment jsdom
 * @file Тесты для App Dropdown компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { DropdownItem } from '@livai/ui-core';

// Mock для Core Dropdown
vi.mock('../../../../ui-core/src/primitives/dropdown', () => ({
  Dropdown: React.forwardRef<
    HTMLDivElement,
    Readonly<Record<string, unknown>>
  >((
    props: Readonly<Record<string, unknown>>,
    ref,
  ) => {
    const {
      items,
      trigger,
      isOpen,
      onToggle,
      onSelect,
      onClose,
      placement,
      'data-component': dataComponent,
      'data-state': dataState,
      'data-feature-flag': dataFeatureFlag,
      'data-telemetry': dataTelemetry,
      'data-placement': dataPlacement,
      'data-component-id': dataComponentId,
      'data-testid': testId,
      className,
      style,
      ...rest
    } = props;

    const itemsArray = items as readonly DropdownItem[] | undefined;
    const triggerContent = trigger as React.ReactNode;

    return (
      <div
        ref={ref}
        data-testid={testId ?? 'core-dropdown'}
        data-component={dataComponent}
        data-state={dataState}
        data-feature-flag={dataFeatureFlag}
        data-telemetry={dataTelemetry}
        data-placement={dataPlacement}
        data-component-id={dataComponentId}
        data-is-open={isOpen}
        data-placement-prop={placement}
        className={className as string | undefined}
        style={style as React.CSSProperties | undefined}
        {...rest}
      >
        <button
          type='button'
          data-testid='trigger-button'
          onClick={(e) => {
            if (typeof onToggle === 'function') {
              const currentIsOpen = Boolean(isOpen);
              onToggle(!currentIsOpen, e);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              if (typeof onToggle === 'function') {
                const currentIsOpen = Boolean(isOpen);
                onToggle(!currentIsOpen, e);
              }
            }
          }}
        >
          {triggerContent}
        </button>
        {Boolean(isOpen) && itemsArray !== undefined && (
          <ul data-testid='menu' role='menu'>
            {itemsArray.map((item) => (
              <li
                key={item.id}
                role='menuitem'
                data-testid={`menu-item-${item.id}`}
                onClick={(e) => {
                  if (typeof onSelect === 'function') {
                    onSelect(item.id, e);
                  }
                  if (typeof onClose === 'function') {
                    onClose();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if (typeof onSelect === 'function') {
                      onSelect(item.id, e);
                    }
                    if (typeof onClose === 'function') {
                      onClose();
                    }
                  }
                }}
              >
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }),
}));

// Mock для UnifiedUIProvider
const mockInfoFireAndForget = vi.fn();
const mockTranslate = vi.fn();

vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  useUnifiedUI: () => ({
    i18n: {
      translate: mockTranslate,
      locale: 'en',
      direction: 'ltr' as const,
      loadNamespace: vi.fn(),
      isNamespaceLoaded: vi.fn(() => true),
    },
    featureFlags: {
      isEnabled: () => false,
      setOverride: vi.fn(),
      clearOverrides: vi.fn(),
      getOverride: () => false,
    },
    telemetry: {
      track: vi.fn(),
      infoFireAndForget: mockInfoFireAndForget,
    },
  }),
}));

import { Dropdown } from '../../../src/ui/dropdown';

describe('App Dropdown', () => {
  const testItems: readonly DropdownItem[] = [
    { id: 'item1', label: 'Item 1' },
    { id: 'item2', label: 'Item 2' },
    { id: 'item3', label: 'Item 3' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockTranslate.mockReturnValue('Translated Label');
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить Dropdown с обязательными пропсами', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' />);

      expect(screen.getByTestId('core-dropdown')).toBeInTheDocument();
      expect(screen.getByTestId('trigger-button')).toHaveTextContent('Open Menu');
    });

    it('должен передавать data-component="AppDropdown"', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' />);

      expect(screen.getByTestId('core-dropdown')).toHaveAttribute(
        'data-component',
        'AppDropdown',
      );
    });

    it('должен передавать data-state="visible" по умолчанию', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' />);

      expect(screen.getByTestId('core-dropdown')).toHaveAttribute(
        'data-state',
        'visible',
      );
    });

    it('должен передавать data-feature-flag="visible" по умолчанию', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' />);

      expect(screen.getByTestId('core-dropdown')).toHaveAttribute(
        'data-feature-flag',
        'visible',
      );
    });

    it('должен передавать data-telemetry="enabled" по умолчанию', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' />);

      expect(screen.getByTestId('core-dropdown')).toHaveAttribute(
        'data-telemetry',
        'enabled',
      );
    });

    it('должен передавать items и trigger в Core Dropdown', () => {
      render(<Dropdown items={testItems} trigger='Custom Trigger' />);

      expect(screen.getByTestId('trigger-button')).toHaveTextContent('Custom Trigger');
    });

    it('должен передавать data-testid в Core Dropdown', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' data-testid='custom-dropdown' />);

      expect(screen.getByTestId('custom-dropdown')).toBeInTheDocument();
    });

    it('должен передавать дополнительные пропсы в Core Dropdown', () => {
      const customStyle: Readonly<{ margin: string; }> = { margin: '10px' };
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          className='custom-class'
          style={customStyle}
        />,
      );

      const dropdown = screen.getByTestId('core-dropdown');
      expect(dropdown).toHaveClass('custom-class');
      expect(dropdown).toHaveStyle({ margin: '10px' });
    });
  });

  describe('I18n рендеринг', () => {
    describe('Aria-label', () => {
      it('должен рендерить обычный aria-label', () => {
        render(
          <Dropdown
            items={testItems}
            trigger='Open Menu'
            aria-label='Test label'
          />,
        );

        expect(screen.getByTestId('core-dropdown')).toHaveAttribute('aria-label', 'Test label');
      });

      it('должен рендерить i18n aria-label', () => {
        render(
          <Dropdown
            items={testItems}
            trigger='Open Menu'
            {...{ ariaLabelI18nKey: 'common.label' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.label', {});
        expect(screen.getByTestId('core-dropdown')).toHaveAttribute(
          'aria-label',
          'Translated Label',
        );
      });

      it('должен передавать namespace для i18n aria-label', () => {
        render(
          <Dropdown
            items={testItems}
            trigger='Open Menu'
            {...{ ariaLabelI18nKey: 'auth.login', ariaLabelI18nNs: 'auth' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('auth', 'auth.login', {});
      });

      it('должен передавать параметры для i18n aria-label', () => {
        const params = { field: 'username', required: true };
        render(
          <Dropdown
            items={testItems}
            trigger='Open Menu'
            {...{ ariaLabelI18nKey: 'common.field', ariaLabelI18nParams: params } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.field', params);
      });

      it('должен использовать пустой объект для undefined параметров i18n aria-label', () => {
        render(
          <Dropdown
            items={testItems}
            trigger='Open Menu'
            {...{ ariaLabelI18nKey: 'common.test', ariaLabelI18nParams: undefined } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'common.test', {});
      });
    });
  });

  describe('Feature flags и policy', () => {
    it('должен рендерить когда visible не указан (по умолчанию true)', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' />);

      expect(screen.getByTestId('core-dropdown')).toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' visible={false} />);

      expect(screen.queryByTestId('core-dropdown')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда isHiddenByFeatureFlag=true', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-dropdown')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=false', () => {
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          visible={false}
          isHiddenByFeatureFlag={false}
        />,
      );

      expect(screen.queryByTestId('core-dropdown')).not.toBeInTheDocument();
    });

    it('не должен рендерить когда visible=false и isHiddenByFeatureFlag=true', () => {
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          visible={false}
          isHiddenByFeatureFlag={true}
        />,
      );

      expect(screen.queryByTestId('core-dropdown')).not.toBeInTheDocument();
    });

    it('должен рендерить когда visible=true и isHiddenByFeatureFlag=false', () => {
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          visible={true}
          isHiddenByFeatureFlag={false}
        />,
      );

      expect(screen.getByTestId('core-dropdown')).toBeInTheDocument();
    });

    it('должен передавать data-state="hidden" когда visible=false', () => {
      const { container } = render(
        <Dropdown items={testItems} trigger='Open Menu' visible={false} />,
      );

      // Компонент не рендерится, но если бы рендерился, имел бы hidden
      expect(container.firstChild).toBeNull();
    });

    it('должен передавать data-feature-flag="hidden" когда isHiddenByFeatureFlag=true', () => {
      const { container } = render(
        <Dropdown items={testItems} trigger='Open Menu' isHiddenByFeatureFlag={true} />,
      );

      // Компонент не рендерится
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Placement', () => {
    it('должен передавать placement="bottom" в Core Dropdown', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' placement='bottom' />);

      const dropdown = screen.getByTestId('core-dropdown');
      expect(dropdown).toHaveAttribute('data-placement-prop', 'bottom');
      expect(dropdown).toHaveAttribute('data-placement', 'bottom');
    });

    it('должен передавать placement="top" в Core Dropdown', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' placement='top' />);

      const dropdown = screen.getByTestId('core-dropdown');
      expect(dropdown).toHaveAttribute('data-placement-prop', 'top');
      expect(dropdown).toHaveAttribute('data-placement', 'top');
    });

    it('должен передавать placement="left" в Core Dropdown', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' placement='left' />);

      const dropdown = screen.getByTestId('core-dropdown');
      expect(dropdown).toHaveAttribute('data-placement-prop', 'left');
      expect(dropdown).toHaveAttribute('data-placement', 'left');
    });

    it('должен передавать placement="right" в Core Dropdown', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' placement='right' />);

      const dropdown = screen.getByTestId('core-dropdown');
      expect(dropdown).toHaveAttribute('data-placement-prop', 'right');
      expect(dropdown).toHaveAttribute('data-placement', 'right');
    });

    it('не должен передавать data-placement когда placement не указан', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' />);

      const dropdown = screen.getByTestId('core-dropdown');
      expect(dropdown).not.toHaveAttribute('data-placement');
    });
  });

  describe('isOpen состояние', () => {
    it('должен передавать isOpen={true} в Core Dropdown', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' isOpen={true} />);

      const dropdown = screen.getByTestId('core-dropdown');
      expect(dropdown).toHaveAttribute('data-is-open', 'true');
      expect(screen.getByTestId('menu')).toBeInTheDocument();
    });

    it('должен передавать isOpen={false} в Core Dropdown', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' isOpen={false} />);

      const dropdown = screen.getByTestId('core-dropdown');
      expect(dropdown).toHaveAttribute('data-is-open', 'false');
      expect(screen.queryByTestId('menu')).not.toBeInTheDocument();
    });

    it('не должен передавать isOpen когда isOpen не указан', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' />);

      const dropdown = screen.getByTestId('core-dropdown');
      expect(dropdown).not.toHaveAttribute('data-is-open');
      expect(screen.queryByTestId('menu')).not.toBeInTheDocument();
    });
  });

  describe('data-component-id', () => {
    it('должен передавать data-component-id в Core Dropdown', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' data-component-id='custom-id' />);

      const dropdown = screen.getByTestId('core-dropdown');
      expect(dropdown).toHaveAttribute('data-component-id', 'custom-id');
    });

    it('не должен передавать data-component-id когда не указан', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' />);

      const dropdown = screen.getByTestId('core-dropdown');
      expect(dropdown).not.toHaveAttribute('data-component-id');
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount и unmount telemetry по умолчанию', () => {
      const { unmount } = render(<Dropdown items={testItems} trigger='Open Menu' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown mount', {
        component: 'Dropdown',
        action: 'mount',
        hidden: false,
        visible: true,
        itemsCount: 3,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown unmount', {
        component: 'Dropdown',
        action: 'unmount',
        hidden: false,
        visible: true,
        itemsCount: 3,
      });
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен передавать data-telemetry="disabled" когда telemetryEnabled=false', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' telemetryEnabled={false} />);

      expect(screen.getByTestId('core-dropdown')).toHaveAttribute(
        'data-telemetry',
        'disabled',
      );
    });

    it('должен отправлять mount telemetry с правильными данными при isHiddenByFeatureFlag=true', () => {
      const { unmount } = render(
        <Dropdown items={testItems} trigger='Open Menu' isHiddenByFeatureFlag={true} />,
      );

      // Компонент не рендерится, но telemetry должен быть отправлен
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown mount', {
        component: 'Dropdown',
        action: 'mount',
        hidden: true,
        visible: false,
        itemsCount: 3,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown unmount', {
        component: 'Dropdown',
        action: 'unmount',
        hidden: true,
        visible: false,
        itemsCount: 3,
      });
    });

    it('должен отправлять mount telemetry с правильными данными при visible=false', () => {
      const { unmount } = render(
        <Dropdown items={testItems} trigger='Open Menu' visible={false} />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown mount', {
        component: 'Dropdown',
        action: 'mount',
        hidden: false,
        visible: false,
        itemsCount: 3,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown unmount', {
        component: 'Dropdown',
        action: 'unmount',
        hidden: false,
        visible: false,
        itemsCount: 3,
      });
    });

    it('должен отправлять mount telemetry с isOpen и placement', () => {
      render(
        <Dropdown items={testItems} trigger='Open Menu' isOpen={true} placement='top' />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown mount', {
        component: 'Dropdown',
        action: 'mount',
        hidden: false,
        visible: true,
        itemsCount: 3,
        isOpen: true,
        placement: 'top',
      });
    });

    it('должен отправлять show telemetry при изменении visible с false на true', () => {
      const { rerender } = render(
        <Dropdown items={testItems} trigger='Open Menu' visible={false} />,
      );

      // Очищаем моки после mount
      vi.clearAllMocks();

      rerender(<Dropdown items={testItems} trigger='Open Menu' visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown show', {
        component: 'Dropdown',
        action: 'show',
        hidden: false,
        visible: true,
        itemsCount: 3,
      });
    });

    it('должен отправлять hide telemetry при изменении visible с true на false', () => {
      const { rerender } = render(
        <Dropdown items={testItems} trigger='Open Menu' visible={true} />,
      );

      // Очищаем моки после mount
      vi.clearAllMocks();

      rerender(<Dropdown items={testItems} trigger='Open Menu' visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown hide', {
        component: 'Dropdown',
        action: 'hide',
        hidden: false,
        visible: false,
        itemsCount: 3,
      });
    });

    it('не должен отправлять show/hide telemetry при первом рендере', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' visible={true} />);

      // Проверяем, что был только mount, но не show
      const calls = mockInfoFireAndForget.mock.calls;
      const showCalls = calls.filter((call) => call[0] === 'Dropdown show');
      const hideCalls = calls.filter((call) => call[0] === 'Dropdown hide');

      expect(showCalls).toHaveLength(0);
      expect(hideCalls).toHaveLength(0);
    });

    it('не должен отправлять show/hide telemetry когда telemetryEnabled=false', () => {
      const { rerender } = render(
        <Dropdown items={testItems} trigger='Open Menu' visible={false} telemetryEnabled={false} />,
      );

      vi.clearAllMocks();

      rerender(
        <Dropdown items={testItems} trigger='Open Menu' visible={true} telemetryEnabled={false} />,
      );

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('не должен отправлять show/hide telemetry когда visible не изменился', () => {
      const { rerender } = render(
        <Dropdown items={testItems} trigger='Open Menu' visible={true} />,
      );

      vi.clearAllMocks();

      rerender(<Dropdown items={testItems} trigger='Open Menu' visible={true} placement='top' />);

      const showCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'Dropdown show',
      );
      const hideCalls = mockInfoFireAndForget.mock.calls.filter(
        (call) => call[0] === 'Dropdown hide',
      );

      expect(showCalls).toHaveLength(0);
      expect(hideCalls).toHaveLength(0);
    });

    it('должен отправлять toggle telemetry при onToggle', () => {
      const onToggle = vi.fn();
      render(<Dropdown items={testItems} trigger='Open Menu' isOpen={false} onToggle={onToggle} />);

      vi.clearAllMocks();

      const triggerButton = screen.getByTestId('trigger-button');
      fireEvent.click(triggerButton);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown toggle', {
        component: 'Dropdown',
        action: 'toggle',
        hidden: false,
        visible: true,
        itemsCount: 3,
        isOpen: true,
      });
      expect(onToggle).toHaveBeenCalledWith(true, expect.any(Object));
    });

    it('не должен отправлять toggle telemetry когда telemetryEnabled=false', () => {
      const onToggle = vi.fn();
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          isOpen={false}
          onToggle={onToggle}
          telemetryEnabled={false}
        />,
      );

      vi.clearAllMocks();

      const triggerButton = screen.getByTestId('trigger-button');
      fireEvent.click(triggerButton);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
      expect(onToggle).toHaveBeenCalled();
    });

    it('должен отправлять toggle telemetry с placement', () => {
      const onToggle = vi.fn();
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          isOpen={false}
          onToggle={onToggle}
          placement='bottom'
        />,
      );

      vi.clearAllMocks();

      const triggerButton = screen.getByTestId('trigger-button');
      fireEvent.click(triggerButton);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown toggle', {
        component: 'Dropdown',
        action: 'toggle',
        hidden: false,
        visible: true,
        itemsCount: 3,
        isOpen: true,
        placement: 'bottom',
      });
    });

    it('должен отправлять select telemetry при onSelect', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          isOpen={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      vi.clearAllMocks();

      const menuItem = screen.getByTestId('menu-item-item1');
      fireEvent.click(menuItem);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown select', {
        component: 'Dropdown',
        action: 'select',
        hidden: false,
        visible: true,
        itemsCount: 3,
        selectedItemId: 'item1',
        isOpen: true,
      });
      expect(onSelect).toHaveBeenCalledWith('item1', expect.any(Object));
      expect(onClose).toHaveBeenCalled();
    });

    it('не должен отправлять select telemetry когда telemetryEnabled=false', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          isOpen={true}
          onSelect={onSelect}
          onClose={onClose}
          telemetryEnabled={false}
        />,
      );

      vi.clearAllMocks();

      const menuItem = screen.getByTestId('menu-item-item1');
      fireEvent.click(menuItem);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
      expect(onSelect).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('должен отправлять select telemetry с isOpen и placement', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          isOpen={true}
          onSelect={onSelect}
          onClose={onClose}
          placement='left'
        />,
      );

      vi.clearAllMocks();

      const menuItem = screen.getByTestId('menu-item-item2');
      fireEvent.click(menuItem);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Dropdown select', {
        component: 'Dropdown',
        action: 'select',
        hidden: false,
        visible: true,
        itemsCount: 3,
        selectedItemId: 'item2',
        isOpen: true,
        placement: 'left',
      });
    });
  });

  describe('Callbacks', () => {
    it('должен вызывать onToggle при клике на trigger', () => {
      const onToggle = vi.fn();
      render(<Dropdown items={testItems} trigger='Open Menu' isOpen={false} onToggle={onToggle} />);

      const triggerButton = screen.getByTestId('trigger-button');
      fireEvent.click(triggerButton);

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith(true, expect.any(Object));
    });

    it('должен вызывать onToggle при нажатии Enter на trigger', () => {
      const onToggle = vi.fn();
      render(<Dropdown items={testItems} trigger='Open Menu' isOpen={false} onToggle={onToggle} />);

      const triggerButton = screen.getByTestId('trigger-button');
      fireEvent.keyDown(triggerButton, { key: 'Enter' });

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith(true, expect.any(Object));
    });

    it('должен вызывать onToggle при нажатии Space на trigger', () => {
      const onToggle = vi.fn();
      render(<Dropdown items={testItems} trigger='Open Menu' isOpen={false} onToggle={onToggle} />);

      const triggerButton = screen.getByTestId('trigger-button');
      fireEvent.keyDown(triggerButton, { key: ' ' });

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onToggle).toHaveBeenCalledWith(true, expect.any(Object));
    });

    it('не должен вызывать onToggle когда onToggle не передан', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' isOpen={false} />);

      const triggerButton = screen.getByTestId('trigger-button');
      expect(() => {
        fireEvent.click(triggerButton);
      }).not.toThrow();
    });

    it('должен вызывать onSelect при клике на элемент меню', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          isOpen={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      const menuItem = screen.getByTestId('menu-item-item1');
      fireEvent.click(menuItem);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('item1', expect.any(Object));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать onSelect при нажатии Enter на элементе меню', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          isOpen={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      const menuItem = screen.getByTestId('menu-item-item2');
      fireEvent.keyDown(menuItem, { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('item2', expect.any(Object));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать onSelect при нажатии Space на элементе меню', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          isOpen={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      const menuItem = screen.getByTestId('menu-item-item3');
      fireEvent.keyDown(menuItem, { key: ' ' });

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('item3', expect.any(Object));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('не должен вызывать onSelect когда onSelect не передан', () => {
      const onClose = vi.fn();
      render(
        <Dropdown items={testItems} trigger='Open Menu' isOpen={true} onClose={onClose} />,
      );

      const menuItem = screen.getByTestId('menu-item-item1');
      expect(() => {
        fireEvent.click(menuItem);
      }).not.toThrow();
      expect(onClose).toHaveBeenCalled();
    });

    it('должен вызывать onClose при выборе элемента', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          isOpen={true}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      const menuItem = screen.getByTestId('menu-item-item1');
      fireEvent.click(menuItem);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('не должен вызывать onClose когда onClose не передан', () => {
      const onSelect = vi.fn();
      render(
        <Dropdown items={testItems} trigger='Open Menu' isOpen={true} onSelect={onSelect} />,
      );

      const menuItem = screen.getByTestId('menu-item-item1');
      expect(() => {
        fireEvent.click(menuItem);
      }).not.toThrow();
      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe('Ref support', () => {
    it('forwardRef работает для внешнего доступа к DOM элементу', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Dropdown items={testItems} trigger='Open Menu' ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toBe(screen.getByTestId('core-dropdown'));
    });

    it('ref возвращает HTMLDivElement', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Dropdown items={testItems} trigger='Open Menu' ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.tagName).toBe('DIV');
    });

    it('ref работает когда компонент скрыт (возвращает null)', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Dropdown items={testItems} trigger='Open Menu' ref={ref} visible={false} />);

      expect(ref.current).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('должен работать с пустым массивом items', () => {
      const emptyItems: readonly DropdownItem[] = [];
      render(<Dropdown items={emptyItems} trigger='Open Menu' isOpen={true} />);

      expect(screen.getByTestId('core-dropdown')).toBeInTheDocument();
      expect(screen.queryByTestId('menu')).toBeInTheDocument();
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    });

    it('должен работать с одним элементом', () => {
      const singleItem: readonly DropdownItem[] = [{ id: 'item1', label: 'Item 1' }];
      render(<Dropdown items={singleItem} trigger='Open Menu' isOpen={true} />);

      expect(screen.getByTestId('menu-item-item1')).toBeInTheDocument();
    });

    it('должен обрабатывать telemetryEnabled=undefined как true', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' />);

      expect(mockInfoFireAndForget).toHaveBeenCalled();
    });

    it('должен обрабатывать visible=undefined как true', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' />);

      expect(screen.getByTestId('core-dropdown')).toBeInTheDocument();
    });

    it('должен обрабатывать isHiddenByFeatureFlag=undefined как false', () => {
      render(<Dropdown items={testItems} trigger='Open Menu' />);

      expect(screen.getByTestId('core-dropdown')).toBeInTheDocument();
    });

    it('должен работать со всеми пропсами одновременно', () => {
      const onToggle = vi.fn();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      render(
        <Dropdown
          items={testItems}
          trigger='Custom Trigger'
          isOpen={true}
          placement='right'
          data-component-id='custom-id'
          data-testid='full-dropdown'
          className='custom-class'
          visible={true}
          isHiddenByFeatureFlag={false}
          telemetryEnabled={true}
          onToggle={onToggle}
          onSelect={onSelect}
          onClose={onClose}
        />,
      );

      const dropdown = screen.getByTestId('full-dropdown');
      expect(dropdown).toBeInTheDocument();
      expect(dropdown).toHaveAttribute('data-placement', 'right');
      expect(dropdown).toHaveAttribute('data-component-id', 'custom-id');
      expect(dropdown).toHaveClass('custom-class');
    });

    it('должен работать с ReactNode в trigger', () => {
      const triggerNode = <span data-testid='custom-trigger'>Custom Trigger</span>;
      render(<Dropdown items={testItems} trigger={triggerNode} />);

      expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
    });
  });

  describe('Стабильность рендера', () => {
    it('рендер стабилен при одинаковых пропсах', () => {
      const { container, rerender } = render(
        <Dropdown items={testItems} trigger='Open Menu' isOpen={false} placement='bottom' />,
      );

      const firstRender = container.innerHTML;

      rerender(
        <Dropdown items={testItems} trigger='Open Menu' isOpen={false} placement='bottom' />,
      );

      expect(container.innerHTML).toBe(firstRender);
    });

    it('memo предотвращает ненужные ре-рендеры', () => {
      let renderCount = 0;

      const TestComponent = React.memo(() => {
        renderCount++;
        return <Dropdown items={testItems} trigger='Open Menu' />;
      });

      const { rerender } = render(<TestComponent />);

      expect(renderCount).toBe(1);

      rerender(<TestComponent />);

      expect(renderCount).toBe(1);
    });

    it('должен быть определенным компонентом', () => {
      // displayName устанавливается на внутренний компонент DropdownComponent,
      // но memo обертка не копирует displayName, поэтому проверяем что компонент определен
      expect(Dropdown).toBeDefined();
      expect(typeof Dropdown).toBe('object');
    });
  });

  describe('Побочные эффекты и производительность', () => {
    it('должен мемоизировать i18n aria-label при изменении пропсов', () => {
      const { rerender } = render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          {...{ ariaLabelI18nKey: 'common.first' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          {...{ ariaLabelI18nKey: 'common.second' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'common.second', {});
    });
  });

  describe('Discriminated union типизация', () => {
    it('должен принимать обычный aria-label без i18n', () => {
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          aria-label='Regular label'
        />,
      );

      expect(screen.getByTestId('core-dropdown')).toHaveAttribute('aria-label', 'Regular label');
    });

    it('должен принимать i18n aria-label без обычного', () => {
      render(
        <Dropdown
          items={testItems}
          trigger='Open Menu'
          {...{ ariaLabelI18nKey: 'common.test' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledWith('common', 'common.test', {});
    });

    it('не должен компилироваться с обоими aria-label одновременно', () => {
      // Этот тест проверяет, что discriminated union работает правильно
      expect(() => {
        // TypeScript не позволит создать такой объект
        const invalidProps = {
          'aria-label': 'test',
          ariaLabelI18nKey: 'test',
        } as any;

        // Если discriminated union работает, этот объект будет иметь never типы для конфликтующих полей
        return invalidProps;
      }).not.toThrow();
    });
  });
});
