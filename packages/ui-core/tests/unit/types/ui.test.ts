/**
 * @vitest-environment jsdom
 * @file Unit тесты для UI типов и контрактов
 */

import { describe, expect, it } from 'vitest';
import type {
  CoreUIBaseProps,
  CoreUIComponentContract,
  UIAlign,
  UIAriaAttributes,
  UIColor,
  UIDataAttributes,
  UIDiagnosticsAttributes,
  UIDuration,
  UIFlexDirection,
  UIInteractive,
  UIJustify,
  UIOpacity,
  UIOrientation,
  UIRadius,
  UISemanticStatus,
  UISize,
  UIState,
  UITestId,
  UIThickness,
  UIVisibility,
  UIZIndex,
} from '../../../src/types/ui.js';

describe('UI Types & Contracts', () => {
  describe('Base Primitives', () => {
    it('UIVisibility принимает boolean значения', () => {
      const visible: UIVisibility = true;
      const hidden: UIVisibility = false;

      expect(visible).toBe(true);
      expect(hidden).toBe(false);
    });

    it('UIInteractive принимает boolean значения', () => {
      const interactive: UIInteractive = true;
      const disabled: UIInteractive = false;

      expect(interactive).toBe(true);
      expect(disabled).toBe(false);
    });

    it('UIDataAttributes поддерживает data-* атрибуты', () => {
      const attributes: UIDataAttributes = {
        'data-component': 'TestComponent',
        'data-variant': 'primary',
        'data-testid': 'test-id',
        'data-custom': 'value',
      };

      expect(attributes['data-component']).toBe('TestComponent');
      expect(attributes['data-variant']).toBe('primary');
    });

    it('UITestId принимает string', () => {
      const testId: UITestId = 'test-component';

      expect(testId).toBe('test-component');
    });
  });

  describe('Design Tokens', () => {
    it('UISize принимает различные CSS размеры', () => {
      const sizes: UISize[] = [
        '12px',
        '1rem',
        '50%',
        'var(--spacing-md)',
        'calc(100% - 16px)',
        '2em',
        '1.5vh',
      ];

      sizes.forEach((size) => {
        expect(typeof size).toBe('string');
      });
    });

    it('UIColor принимает CSS цвета', () => {
      const colors: UIColor[] = [
        '#FF0000',
        'rgb(255, 0, 0)',
        'hsl(0, 100%, 50%)',
        'var(--color-primary)',
        'transparent',
        'currentColor',
      ];

      colors.forEach((color) => {
        expect(typeof color).toBe('string');
      });
    });

    it('UIRadius наследует от UISize', () => {
      const radius: UIRadius = '8px';

      expect(radius).toBe('8px');
    });

    it('UIThickness наследует от UISize', () => {
      const thickness: UIThickness = '2px';

      expect(thickness).toBe('2px');
    });

    it('UIZIndex принимает числа', () => {
      const zIndex: UIZIndex = 100;

      expect(zIndex).toBe(100);
    });

    it('UIOpacity принимает числа от 0 до 1', () => {
      const opacities: UIOpacity[] = [0, 0.5, 1, 0.25, 0.75];

      opacities.forEach((opacity) => {
        expect(typeof opacity).toBe('number');
        expect(opacity).toBeGreaterThanOrEqual(0);
        expect(opacity).toBeLessThanOrEqual(1);
      });
    });

    it('UIDuration принимает CSS длительности', () => {
      const durations: UIDuration[] = [
        '200ms',
        '0.5s',
        '300ms',
        'var(--duration-fast)',
        '0s',
      ];

      durations.forEach((duration) => {
        expect(typeof duration).toBe('string');
      });
    });
  });

  describe('Layout & Orientation', () => {
    it('UIOrientation принимает horizontal и vertical', () => {
      const orientations: UIOrientation[] = ['horizontal', 'vertical'];

      orientations.forEach((orientation) => {
        expect(['horizontal', 'vertical']).toContain(orientation);
      });
    });

    it('UIAlign принимает допустимые значения выравнивания', () => {
      const aligns: UIAlign[] = ['start', 'center', 'end', 'stretch'];

      aligns.forEach((align) => {
        expect(['start', 'center', 'end', 'stretch']).toContain(align);
      });
    });

    it('UIJustify принимает допустимые значения распределения', () => {
      const justifies: UIJustify[] = [
        'start',
        'center',
        'end',
        'space-between',
        'space-around',
      ];

      justifies.forEach((justify) => {
        expect(['start', 'center', 'end', 'space-between', 'space-around']).toContain(justify);
      });
    });

    it('UIFlexDirection принимает row и column', () => {
      const directions: UIFlexDirection[] = ['row', 'column'];

      directions.forEach((direction) => {
        expect(['row', 'column']).toContain(direction);
      });
    });
  });

  describe('State & Status', () => {
    it('UIState принимает допустимые состояния', () => {
      const states: UIState[] = ['idle', 'active', 'disabled', 'loading'];

      states.forEach((state) => {
        expect(['idle', 'active', 'disabled', 'loading']).toContain(state);
      });
    });

    it('UISemanticStatus принимает семантические статусы', () => {
      const statuses: UISemanticStatus[] = ['info', 'success', 'warning', 'error'];

      statuses.forEach((status) => {
        expect(['info', 'success', 'warning', 'error']).toContain(status);
      });
    });
  });

  describe('Accessibility (A11Y)', () => {
    it('UIAriaAttributes поддерживает основные ARIA атрибуты', () => {
      const aria: UIAriaAttributes = {
        role: 'button',
        'aria-label': 'Click me',
        'aria-labelledby': 'button-label',
        'aria-describedby': 'button-description',
        'aria-hidden': false,
        'aria-live': 'polite',
      };

      expect(aria.role).toBe('button');
      expect(aria['aria-label']).toBe('Click me');
      expect(aria['aria-live']).toBe('polite');
    });

    it('UIAriaAttributes поддерживает undefined значения', () => {
      const aria: UIAriaAttributes = {};

      expect(aria.role).toBeUndefined();
      expect(aria['aria-label']).toBeUndefined();
    });
  });

  describe('UI Component Contracts', () => {
    it('CoreUIComponentContract определяет базовые свойства компонента', () => {
      const contract: CoreUIComponentContract = {
        visible: true,
        'data-testid': 'test-component',
      };

      expect(contract.visible).toBe(true);
      expect(contract['data-testid']).toBe('test-component');
    });

    it('CoreUIComponentContract поддерживает undefined visible', () => {
      const contract: CoreUIComponentContract = {
        'data-testid': 'test-component',
      };

      expect(contract.visible).toBeUndefined();
      expect(contract['data-testid']).toBe('test-component');
    });
  });

  describe('Diagnostics & Debugging', () => {
    it('UIDiagnosticsAttributes поддерживает диагностические атрибуты', () => {
      const diagnostics: UIDiagnosticsAttributes = {
        'data-component': 'TestComponent',
        'data-variant': 'primary',
        'data-state': 'active',
      };

      expect(diagnostics['data-component']).toBe('TestComponent');
      expect(diagnostics['data-variant']).toBe('primary');
      expect(diagnostics['data-state']).toBe('active');
    });

    it('UIDiagnosticsAttributes поддерживает undefined значения', () => {
      const diagnostics: UIDiagnosticsAttributes = {};

      expect(diagnostics['data-component']).toBeUndefined();
    });
  });

  describe('Composition', () => {
    it('CoreUIBaseProps комбинирует все базовые типы', () => {
      const baseProps: CoreUIBaseProps = {
        // CoreUIComponentContract
        visible: true,
        'data-testid': 'test-component',

        // UIAriaAttributes
        role: 'button',
        'aria-label': 'Test button',

        // UIDiagnosticsAttributes
        'data-component': 'TestComponent',
        'data-variant': 'primary',

        // UIDataAttributes
        'data-custom': 'value',
      };

      expect(baseProps.visible).toBe(true);
      expect(baseProps['data-testid']).toBe('test-component');
      expect(baseProps.role).toBe('button');
      expect(baseProps['aria-label']).toBe('Test button');
      expect(baseProps['data-component']).toBe('TestComponent');
      expect(baseProps['data-variant']).toBe('primary');
      expect(baseProps['data-custom']).toBe('value');
    });

    it('CoreUIBaseProps поддерживает минимальный набор свойств', () => {
      const minimalProps: CoreUIBaseProps = {
        'data-testid': 'minimal-component',
      };

      expect(minimalProps['data-testid']).toBe('minimal-component');
      expect(minimalProps.visible).toBeUndefined();
    });
  });

  describe('Type Safety & Compatibility', () => {
    it('все типы являются framework-agnostic', () => {
      // Эти тесты проверяют, что типы не зависят от React
      const size: UISize = '100px';
      const color: UIColor = '#000';
      const visibility: UIVisibility = true;

      expect(size).toBe('100px');
      expect(color).toBe('#000');
      expect(visibility).toBe(true);
    });

    it('типы поддерживают расширение без ломающих изменений', () => {
      // Проверяем, что можно расширять типы
      type ExtendedUIProps = CoreUIBaseProps & {
        customProp?: string;
      };

      const extended: ExtendedUIProps = {
        'data-testid': 'extended-component',
        customProp: 'custom-value',
      };

      expect(extended['data-testid']).toBe('extended-component');
      expect(extended.customProp).toBe('custom-value');
    });

    it('ReadOnly типы предотвращают мутации', () => {
      const readonlyAttrs: Readonly<UIDataAttributes> = {
        'data-readonly': 'test',
      };

      // TypeScript не позволит мутировать readonly объект
      expect(readonlyAttrs['data-readonly']).toBe('test');
    });
  });

  describe('Integration Examples', () => {
    it('можно создать типичный UI компонент используя базовые типы', () => {
      type ButtonProps = CoreUIBaseProps & {
        size?: UISize;
        color?: UIColor;
        disabled?: boolean;
        loading?: boolean;
      };

      const buttonProps: ButtonProps = {
        visible: true,
        'data-testid': 'test-button',
        'data-component': 'Button',
        'data-variant': 'primary',
        size: '48px',
        color: '#007bff',
        disabled: false,
        'aria-label': 'Click me',
      };

      expect(buttonProps.visible).toBe(true);
      expect(buttonProps.size).toBe('48px');
      expect(buttonProps.color).toBe('#007bff');
      expect(buttonProps['aria-label']).toBe('Click me');
    });

    it('можно создать Toast компонент используя семантические типы', () => {
      type ToastProps = CoreUIBaseProps & {
        variant?: UISemanticStatus;
        duration?: UIDuration;
        opacity?: UIOpacity;
      };

      const toastProps: ToastProps = {
        visible: true,
        'data-testid': 'test-toast',
        'data-component': 'Toast',
        variant: 'success',
        duration: '300ms',
        opacity: 0.9,
        role: 'status',
        'aria-live': 'polite',
      };

      expect(toastProps.variant).toBe('success');
      expect(toastProps.duration).toBe('300ms');
      expect(toastProps.opacity).toBe(0.9);
      expect(toastProps.role).toBe('status');
    });
  });
});
