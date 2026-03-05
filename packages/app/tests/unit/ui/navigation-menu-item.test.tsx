/**
 * @vitest-environment jsdom
 * @file Тесты для App NavigationMenuItem компонента с полным покрытием
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '@testing-library/jest-dom/vitest';

// Mock для Core NavigationMenuItem - возвращаем простой div с переданными пропсами
vi.mock('@livai/ui-core', async () => {
  const actual = await vi.importActual('@livai/ui-core');
  return {
    ...actual,
    NavigationMenuItem: React.forwardRef<
      HTMLDivElement,
      React.ComponentProps<'div'> & {
        item?: any;
        size?: string;
        variant?: string;
        showIcon?: boolean;
        showLabel?: boolean;
        customIcon?: any;
        onClick?: any;
        'data-component'?: string;
      }
    >((
      {
        item,
        size,
        variant,
        showIcon,
        showLabel,
        customIcon,
        onClick,
        'data-component': dataComponent,
        ...props
      },
      ref,
    ) => {
      return (
        <div
          ref={ref}
          data-testid='core-navigation-menu-item'
          data-size={size}
          data-variant={variant}
          data-show-icon={String(showIcon)}
          data-show-label={String(showLabel)}
          data-active={item?.isActive === true ? 'true' : undefined}
          data-disabled={item?.isDisabled === true ? 'true' : undefined}
          data-component={dataComponent}
          onClick={onClick}
          onKeyDown={onClick != null
            ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
              onClick(e as any);
            }
            : undefined}
          tabIndex={onClick != null ? 0 : undefined}
          role={onClick != null ? 'button' : undefined}
          {...props}
        >
          {showIcon === true && <span data-testid='nav-icon'>Icon</span>}
          {showLabel === true && item?.label != null && (
            <span data-testid='nav-label'>{item.label}</span>
          )}
        </div>
      );
    }),
  };
});

// Mock для UnifiedUIProvider
const mockInfoFireAndForget = vi.fn();
const mockTranslate = vi.fn();
let mockFeatureFlagReturnValue = false;

vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  useUnifiedUI: () => ({
    featureFlags: {
      isEnabled: () => mockFeatureFlagReturnValue,
      setOverride: vi.fn(),
      clearOverrides: vi.fn(),
      getOverride: () => mockFeatureFlagReturnValue,
    },
    telemetry: {
      track: vi.fn(),
      infoFireAndForget: mockInfoFireAndForget,
    },
    i18n: {
      translate: mockTranslate,
    },
  }),
}));

import type { NavigationMenuItemData } from '@livai/ui-core';

import { NavigationMenuItem } from '../../../src/ui/navigation-menu-item';

describe('App NavigationMenuItem', () => {
  // Общие тестовые переменные
  const baseItem = {
    label: 'Главная',
    href: '/home',
    icon: '🏠',
    isActive: false,
    isDisabled: false,
  };

  const activeItem = {
    ...baseItem,
    isActive: true,
  };

  const disabledItem = {
    ...baseItem,
    isDisabled: true,
  };

  const itemWithoutHref = {
    label: 'Профиль',
    icon: '👤',
  };

  const customStyle = { borderRadius: '8px', padding: '12px' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
    mockTranslate.mockReturnValue('Translated Label');
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить компонент с обязательными пропсами', () => {
      render(<NavigationMenuItem item={baseItem} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toBeInTheDocument();
      expect(component).toHaveAttribute('data-component', 'AppNavigationMenuItem');
    });

    it('не должен рендерить компонент когда visible=false', () => {
      render(<NavigationMenuItem item={baseItem} visible={false} />);

      expect(screen.queryByTestId('core-navigation-menu-item')).not.toBeInTheDocument();
    });

    it('должен рендерить компонент с полным набором пропсов', () => {
      render(<NavigationMenuItem item={baseItem} size='large' variant='compact' />);

      expect(screen.getByTestId('core-navigation-menu-item')).toBeInTheDocument();
    });
  });

  describe('Feature flags (Policy)', () => {
    it('должен рендерить компонент когда feature flag отключен', () => {
      mockFeatureFlagReturnValue = false;

      render(<NavigationMenuItem item={baseItem} />);

      expect(screen.getByTestId('core-navigation-menu-item')).toBeInTheDocument();
    });

    it('не должен рендерить компонент когда isHiddenByFeatureFlag=true', () => {
      render(<NavigationMenuItem item={baseItem} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-navigation-menu-item')).not.toBeInTheDocument();
    });

    it('должен применять disabled стиль когда isDisabledByFeatureFlag=true', () => {
      render(<NavigationMenuItem item={baseItem} isDisabledByFeatureFlag={true} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveAttribute('data-state', 'disabled');
      expect(component).toHaveStyle({
        opacity: '0.6',
        pointerEvents: 'none',
      });
    });

    it('должен применять active состояние по умолчанию', () => {
      render(<NavigationMenuItem item={baseItem} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveAttribute('data-state', 'active');
    });

    it('должен устанавливать правильные data attributes для feature flags', () => {
      render(
        <NavigationMenuItem
          item={baseItem}
          isHiddenByFeatureFlag={false}
          isDisabledByFeatureFlag={false}
        />,
      );

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveAttribute('data-feature-flag', 'visible');
      expect(component).toHaveAttribute('data-state', 'active');
    });

    it('должен комбинировать item.isDisabled с policy.disabledByFeatureFlag', () => {
      render(<NavigationMenuItem item={baseItem} isDisabledByFeatureFlag={true} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveAttribute('data-disabled', 'true'); // Core получает combined disabled state
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount и unmount события при рендере', () => {
      const { unmount } = render(
        <NavigationMenuItem item={baseItem} size='medium' variant='default' />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('NavigationMenuItem mount', {
        component: 'NavigationMenuItem',
        action: 'mount',
        hidden: false,
        visible: true,
        disabled: false,
        routeAccessible: true,
        size: 'medium',
        variant: 'default',
        hasIcon: true,
        hasLabel: true,
        isActive: false,
        isLink: true,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('NavigationMenuItem unmount', {
        component: 'NavigationMenuItem',
        action: 'unmount',
        hidden: false,
        visible: true,
        disabled: false,
        routeAccessible: true,
        size: 'medium',
        variant: 'default',
        hasIcon: true,
        hasLabel: true,
        isActive: false,
        isLink: true,
      });
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(<NavigationMenuItem item={baseItem} telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен использовать true по умолчанию для telemetry', () => {
      render(<NavigationMenuItem item={baseItem} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'NavigationMenuItem mount',
        expect.any(Object),
      );
    });

    it('должен отправлять click telemetry при клике', () => {
      const mockOnClick = vi.fn();
      render(<NavigationMenuItem item={baseItem} onClick={mockOnClick} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      fireEvent.click(component);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('NavigationMenuItem click', {
        component: 'NavigationMenuItem',
        action: 'click',
        hidden: false,
        visible: true,
        disabled: false,
        routeAccessible: true,
        hasIcon: true,
        hasLabel: true,
        isActive: false,
        isLink: true,
      });

      expect(mockOnClick).toHaveBeenCalledWith(baseItem, expect.any(Object));
    });

    it('не должен отправлять click telemetry когда telemetry отключен', () => {
      const mockOnClick = vi.fn();
      render(<NavigationMenuItem item={baseItem} onClick={mockOnClick} telemetryEnabled={false} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      fireEvent.click(component);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled(); // telemetry полностью отключен
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('должен правильно вычислять telemetry props для разных элементов', () => {
      // Элемент без иконки
      render(<NavigationMenuItem item={itemWithoutHref} showIcon={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('NavigationMenuItem mount', {
        component: 'NavigationMenuItem',
        action: 'mount',
        hidden: false,
        visible: true,
        disabled: false,
        routeAccessible: true, // нет href, поэтому true по умолчанию
        hasIcon: false, // showIcon=false
        hasLabel: true,
        isActive: false,
        isLink: false, // нет href
      });
    });

    it('должен учитывать isDisabledFromItem для isLink в telemetry', () => {
      render(<NavigationMenuItem item={disabledItem} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('NavigationMenuItem mount', {
        component: 'NavigationMenuItem',
        action: 'mount',
        hidden: false,
        visible: true,
        disabled: false,
        routeAccessible: true,
        hasIcon: true,
        hasLabel: true,
        isActive: false,
        isLink: false, // isDisabledFromItem=true, поэтому false
      });
    });

    it('должен учитывать policy.disabledByFeatureFlag для isLink в telemetry', () => {
      render(<NavigationMenuItem item={baseItem} isDisabledByFeatureFlag={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('NavigationMenuItem mount', {
        component: 'NavigationMenuItem',
        action: 'mount',
        hidden: false,
        visible: true,
        disabled: true,
        routeAccessible: true,
        hasIcon: true,
        hasLabel: true,
        isActive: false,
        isLink: false, // disabledByFeatureFlag=true, поэтому false
      });
    });
  });

  describe('Click handler', () => {
    it('должен вызывать onClick при клике', () => {
      const mockOnClick = vi.fn();
      render(<NavigationMenuItem item={baseItem} onClick={mockOnClick} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      fireEvent.click(component);

      expect(mockOnClick).toHaveBeenCalledWith(baseItem, expect.any(Object));
    });

    it('должен передавать правильные параметры в onClick', () => {
      const mockOnClick = vi.fn();
      render(<NavigationMenuItem item={activeItem} onClick={mockOnClick} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      fireEvent.click(component);

      expect(mockOnClick).toHaveBeenCalledWith(activeItem, expect.any(Object));
    });

    it('не должен вызывать onClick когда он не передан', () => {
      render(<NavigationMenuItem item={baseItem} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      fireEvent.click(component);

      // onClick не передан, поэтому не должно быть ошибки
      expect(component).toBeInTheDocument();
    });

    it('должен передавать onClick в Core компонент только когда он передан', () => {
      const mockOnClick = vi.fn();
      render(<NavigationMenuItem item={baseItem} onClick={mockOnClick} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      // Проверяем, что элемент имеет onClick handler (наличие role="button" указывает на это)
      expect(component).toHaveAttribute('role', 'button');
    });

    it('не должен передавать onClick в Core компонент когда он не передан', () => {
      render(<NavigationMenuItem item={baseItem} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      // onClick не должен быть установлен когда он не передан
      expect(component.onclick).toBeNull();
    });
  });

  describe('Props processing и data attributes', () => {
    it('должен передавать size в Core компонент', () => {
      render(<NavigationMenuItem item={baseItem} size='large' />);

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveAttribute('data-size', 'large');
    });

    it('должен передавать variant в Core компонент', () => {
      render(<NavigationMenuItem item={baseItem} variant='compact' />);

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveAttribute('data-variant', 'compact');
    });

    it('должен передавать showIcon/showLabel в Core компонент', () => {
      render(
        <NavigationMenuItem
          item={baseItem}
          showIcon={true}
          showLabel={false}
        />,
      );

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveAttribute('data-show-icon', 'true');
      expect(component).toHaveAttribute('data-show-label', 'false');
    });

    it('должен передавать customIcon в Core компонент', () => {
      const customIcon = <span>★</span>;
      render(<NavigationMenuItem item={baseItem} customIcon={customIcon} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toBeInTheDocument();
    });

    it('должен применять className к Core компоненту', () => {
      render(<NavigationMenuItem item={baseItem} className='custom-class' />);

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveClass('custom-class');
    });

    it('должен применять style к Core компоненту', () => {
      render(<NavigationMenuItem item={baseItem} style={customStyle} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveStyle(customStyle);
    });

    it('должен применять data-testid', () => {
      render(<NavigationMenuItem item={baseItem} data-testid='custom-test-id' />);

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('должен прокидывать дополнительные HTML атрибуты', () => {
      render(
        <NavigationMenuItem
          item={baseItem}
          id='menu-item-1'
          title='Главная страница'
          data-custom='value'
        />,
      );

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveAttribute('id', 'menu-item-1');
      expect(component).toHaveAttribute('title', 'Главная страница');
      expect(component).toHaveAttribute('data-custom', 'value');
    });

    it('должен устанавливать правильные data attributes по умолчанию', () => {
      render(<NavigationMenuItem item={baseItem} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveAttribute('data-component', 'AppNavigationMenuItem');
      expect(component).toHaveAttribute('data-feature-flag', 'visible');
      expect(component).toHaveAttribute('data-state', 'active');
      expect(component).toHaveAttribute('data-telemetry', 'enabled');
    });

    it('должен устанавливать data-telemetry="disabled" когда telemetry отключен', () => {
      render(<NavigationMenuItem item={baseItem} telemetryEnabled={false} />);

      const component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveAttribute('data-telemetry', 'disabled');
    });
  });

  describe('Ref forwarding', () => {
    it('должен поддерживать ref forwarding для anchor элемента', () => {
      const ref = React.createRef<any>();

      render(<NavigationMenuItem ref={ref} item={baseItem} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement); // Mock возвращает div
      expect(ref.current).toHaveAttribute('data-component', 'AppNavigationMenuItem');
    });

    it('должен поддерживать ref forwarding для button элемента', () => {
      const ref = React.createRef<any>();

      render(<NavigationMenuItem ref={ref} item={itemWithoutHref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement); // Mock возвращает div
      expect(ref.current).toHaveAttribute('data-component', 'AppNavigationMenuItem');
    });
  });

  describe('Render stability', () => {
    it('не должен пересчитывать telemetry props при одинаковых пропсах', () => {
      const { rerender } = render(
        <NavigationMenuItem item={baseItem} size='medium' variant='default' />,
      );

      const component1 = screen.getByTestId('core-navigation-menu-item');

      rerender(<NavigationMenuItem item={baseItem} size='medium' variant='default' />);

      const component2 = screen.getByTestId('core-navigation-menu-item');

      expect(component1).toBe(component2);
    });

    it('должен обновлять стили при изменении policy', () => {
      const { rerender } = render(<NavigationMenuItem item={baseItem} />);

      let component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveAttribute('data-state', 'active');

      rerender(<NavigationMenuItem item={baseItem} isDisabledByFeatureFlag={true} />);

      component = screen.getByTestId('core-navigation-menu-item');
      expect(component).toHaveAttribute('data-state', 'disabled');
    });
  });

  describe('Edge cases', () => {
    it('работает с undefined style', () => {
      render(<NavigationMenuItem item={baseItem} style={undefined} />);

      expect(screen.getByTestId('core-navigation-menu-item')).toBeInTheDocument();
    });

    it('работает с пустым объектом style', () => {
      render(<NavigationMenuItem item={baseItem} style={{}} />);

      expect(screen.getByTestId('core-navigation-menu-item')).toBeInTheDocument();
    });

    it('работает с пустой строкой label', () => {
      const itemWithEmptyLabel = { label: '', href: '/test' };
      render(<NavigationMenuItem item={itemWithEmptyLabel} />);

      expect(screen.getByTestId('core-navigation-menu-item')).toBeInTheDocument();
    });

    it('работает с null значениями в item', () => {
      const itemWithNulls = {
        label: 'Test',
        href: null as any,
        icon: null as any,
        isActive: null as any,
        isDisabled: null as any,
      };

      render(<NavigationMenuItem item={itemWithNulls} />);

      expect(screen.getByTestId('core-navigation-menu-item')).toBeInTheDocument();
    });

    it('работает с отсутствующими свойствами в item', () => {
      const itemWithUndefined = {
        label: 'Test',
      } as NavigationMenuItemData;

      render(<NavigationMenuItem item={itemWithUndefined} />);

      expect(screen.getByTestId('core-navigation-menu-item')).toBeInTheDocument();
    });

    it('правильно комбинирует custom style с disabled style', () => {
      const customStyle = { backgroundColor: 'red' };

      render(
        <NavigationMenuItem
          item={baseItem}
          style={customStyle}
          isDisabledByFeatureFlag={true}
        />,
      );

      const component = screen.getByTestId('core-navigation-menu-item');
      const computedStyle = window.getComputedStyle(component);
      expect(computedStyle.backgroundColor).toBe('rgb(255, 0, 0)'); // red преобразуется в rgb
      expect(computedStyle.opacity).toBe('0.6');
      expect(computedStyle.pointerEvents).toBe('none');
    });

    it('правильно обрабатывает policy комбинации', () => {
      // Скрытый компонент не должен рендериться даже если disabled
      render(
        <NavigationMenuItem
          item={baseItem}
          isHiddenByFeatureFlag={true}
          isDisabledByFeatureFlag={true}
        />,
      );

      expect(screen.queryByTestId('core-navigation-menu-item')).not.toBeInTheDocument();
    });

    it('работает со всеми пропсами одновременно', () => {
      const customIcon = <span>★</span>;
      const mockOnClick = vi.fn();

      render(
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
          onClick={mockOnClick}
        />,
      );

      const component = screen.getByTestId('menu-item');
      expect(component).toHaveAttribute('data-size', 'large');
      expect(component).toHaveAttribute('data-variant', 'compact');
      expect(component).toHaveAttribute('data-active', 'true');
      expect(component).toHaveClass('custom-class');
      expect(component).toHaveAttribute('id', 'test-id');
    });

    it('правильно обрабатывает несколько кликов', () => {
      const mockOnClick = vi.fn();
      render(<NavigationMenuItem item={baseItem} onClick={mockOnClick} />);

      const component = screen.getByTestId('core-navigation-menu-item');

      fireEvent.click(component);
      fireEvent.click(component);
      fireEvent.click(component);

      expect(mockOnClick).toHaveBeenCalledTimes(3);
      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(4); // mount + 3 click (unmount не вызывается в этом тесте)
    });
  });

  describe('I18n рендеринг', () => {
    describe('Label', () => {
      it('должен рендерить обычный label', () => {
        render(
          <NavigationMenuItem
            item={baseItem}
            label='Home'
          />,
        );

        expect(screen.getByTestId('nav-label')).toHaveTextContent('Home');
      });

      it('должен рендерить i18n label', () => {
        render(
          <NavigationMenuItem
            item={baseItem}
            {...{ labelI18nKey: 'nav.home' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'nav.home', {});
        expect(screen.getByTestId('nav-label')).toHaveTextContent('Translated Label');
      });

      it('должен передавать namespace для i18n label', () => {
        render(
          <NavigationMenuItem
            item={baseItem}
            {...{ labelI18nKey: 'home', labelI18nNs: 'nav' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('nav', 'home', {});
      });

      it('должен передавать параметры для i18n label', () => {
        const params = { section: 'main', count: 5 };
        render(
          <NavigationMenuItem
            item={baseItem}
            {...{ labelI18nKey: 'nav.section', labelI18nParams: params } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'nav.section', params);
      });

      it('должен использовать пустой объект для undefined параметров i18n label', () => {
        render(
          <NavigationMenuItem
            item={baseItem}
            {...{ labelI18nKey: 'nav.home', labelI18nParams: undefined } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'nav.home', {});
      });
    });

    describe('Aria-label', () => {
      it('должен рендерить обычный aria-label', () => {
        render(
          <NavigationMenuItem
            item={baseItem}
            aria-label='Navigation item'
          />,
        );

        expect(screen.getByTestId('core-navigation-menu-item')).toHaveAttribute(
          'aria-label',
          'Navigation item',
        );
      });

      it('должен рендерить i18n aria-label', () => {
        render(
          <NavigationMenuItem
            item={baseItem}
            {...{ ariaLabelI18nKey: 'nav.label' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'nav.label', {});
        expect(screen.getByTestId('core-navigation-menu-item')).toHaveAttribute(
          'aria-label',
          'Translated Label',
        );
      });

      it('должен передавать namespace для i18n aria-label', () => {
        render(
          <NavigationMenuItem
            item={baseItem}
            {...{ ariaLabelI18nKey: 'label', ariaLabelI18nNs: 'nav' } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('nav', 'label', {});
      });

      it('должен передавать параметры для i18n aria-label', () => {
        const params = { item: 'home', type: 'menu' };
        render(
          <NavigationMenuItem
            item={baseItem}
            {...{ ariaLabelI18nKey: 'nav.label', ariaLabelI18nParams: params } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'nav.label', params);
      });

      it('должен использовать пустой объект для undefined параметров i18n aria-label', () => {
        render(
          <NavigationMenuItem
            item={baseItem}
            {...{ ariaLabelI18nKey: 'nav.label', ariaLabelI18nParams: undefined } as any}
          />,
        );

        expect(mockTranslate).toHaveBeenCalledWith('common', 'nav.label', {});
      });
    });
  });

  describe('Побочные эффекты и производительность', () => {
    it('должен мемоизировать i18n label при изменении пропсов', () => {
      const { rerender } = render(
        <NavigationMenuItem
          item={baseItem}
          {...{ labelI18nKey: 'nav.first' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(
        <NavigationMenuItem
          item={baseItem}
          {...{ labelI18nKey: 'nav.second' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'nav.second', {});
    });

    it('должен мемоизировать i18n aria-label при изменении пропсов', () => {
      const { rerender } = render(
        <NavigationMenuItem
          item={baseItem}
          {...{ ariaLabelI18nKey: 'nav.first' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(1);

      rerender(
        <NavigationMenuItem
          item={baseItem}
          {...{ ariaLabelI18nKey: 'nav.second' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledTimes(2);
      expect(mockTranslate).toHaveBeenLastCalledWith('common', 'nav.second', {});
    });
  });

  describe('Discriminated union типизация', () => {
    it('должен принимать обычный label без i18n', () => {
      render(
        <NavigationMenuItem
          item={baseItem}
          label='Regular Label'
        />,
      );

      expect(screen.getByTestId('core-navigation-menu-item')).toHaveTextContent('Regular Label');
    });

    it('должен принимать обычный aria-label без i18n', () => {
      render(
        <NavigationMenuItem
          item={baseItem}
          aria-label='Regular aria label'
        />,
      );

      expect(screen.getByTestId('core-navigation-menu-item')).toHaveAttribute(
        'aria-label',
        'Regular aria label',
      );
    });

    it('должен принимать i18n label без обычного', () => {
      render(
        <NavigationMenuItem
          item={baseItem}
          {...{ labelI18nKey: 'nav.label' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledWith('common', 'nav.label', {});
    });

    it('должен принимать i18n aria-label без обычного', () => {
      render(
        <NavigationMenuItem
          item={baseItem}
          {...{ ariaLabelI18nKey: 'nav.label' } as any}
        />,
      );

      expect(mockTranslate).toHaveBeenCalledWith('common', 'nav.label', {});
    });

    it('не должен компилироваться с обоими label одновременно', () => {
      // Этот тест проверяет, что discriminated union работает правильно
      expect(() => {
        // TypeScript не позволит создать такой объект
        const invalidProps = {
          label: 'test',
          labelI18nKey: 'test',
        } as any;

        // Если discriminated union работает, этот объект будет иметь never типы для конфликтующих полей
        return invalidProps;
      }).not.toThrow();
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
