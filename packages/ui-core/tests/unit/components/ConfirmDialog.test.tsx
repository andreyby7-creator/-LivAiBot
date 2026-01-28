/**
 * @vitest-environment jsdom
 * @file Unit тесты для ConfirmDialog компонента
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog.js';

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
    getAllByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).getAllByRole(role, options),
    getByTestId: (testId: Readonly<string>) => within(container).getByTestId(testId),
    queryByTestId: (testId: Readonly<string>) => within(container).queryByTestId(testId),
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).queryByRole(role, options),
    getConfirmDialog: () => container.querySelector('div[data-component="CoreConfirmDialog"]'),
    getModal: () => container.querySelector('div[data-component="CoreModal"]'),
  };
}

describe('ConfirmDialog', () => {
  // Общие тестовые переменные
  const testTitle = 'Test Dialog Title';
  const testMessage = 'Test dialog message';
  const customStyle = { borderRadius: '8px', padding: '12px' };
  const emptyStyle = {};

  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLDivElement>();

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { getByRole } = renderIsolated(
        <ConfirmDialog visible={true} message={testMessage} />,
      );

      expect(getByRole('dialog')).toBeInTheDocument();
    });

    it('не рендерится когда visible=false', () => {
      const { getModal } = renderIsolated(
        <ConfirmDialog visible={false} />,
      );

      expect(getModal()).toBeNull();
    });

    it('рендерится с title', () => {
      const { getByText } = renderIsolated(
        <ConfirmDialog visible={true} title={testTitle} message={testMessage} />,
      );

      expect(getByText(testTitle)).toBeInTheDocument();
    });

    it('рендерится без title', () => {
      const { container } = renderIsolated(
        <ConfirmDialog visible={true} message={testMessage} />,
      );

      expect(container.querySelector('h2')).toBeNull();
    });

    it('рендерится с message', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} message={testMessage} data-testid='test-dialog' />,
      );

      expect(getByTestId('test-dialog-message')).toHaveTextContent(testMessage);
    });

    it('не рендерит message когда message=null', () => {
      const { queryByTestId } = renderIsolated(
        <ConfirmDialog visible={true} message={null as any} data-testid='test-dialog' />,
      );

      expect(queryByTestId('test-dialog-message')).toBeNull();
    });

    it('не рендерит message когда message=undefined', () => {
      const { queryByTestId } = renderIsolated(
        <ConfirmDialog visible={true} message={undefined} data-testid='test-dialog' />,
      );

      expect(queryByTestId('test-dialog-message')).toBeNull();
    });

    it('рендерит ReactNode как message', () => {
      const reactMessage = <span data-testid='react-message'>React Message</span>;
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} message={reactMessage} data-testid='test-dialog' />,
      );

      expect(getByTestId('react-message')).toBeInTheDocument();
      expect(getByTestId('test-dialog-message')).toBeInTheDocument();
    });
  });

  describe('4.2. Пропсы и атрибуты', () => {
    describe('variant', () => {
      it('применяет default variant по умолчанию', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} message={testMessage} />,
        );

        const modal = getByRole('dialog');
        expect(modal).toHaveAttribute('data-variant', 'default');
      });

      it('применяет warning variant', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} variant='warning' message={testMessage} />,
        );

        const modal = getByRole('dialog');
        expect(modal).toHaveAttribute('data-variant', 'warning');
      });

      it('применяет error variant', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} variant='error' message={testMessage} />,
        );

        const modal = getByRole('dialog');
        expect(modal).toHaveAttribute('data-variant', 'error');
      });

      it('применяет success variant', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} variant='success' message={testMessage} />,
        );

        const modal = getByRole('dialog');
        expect(modal).toHaveAttribute('data-variant', 'success');
      });

      it('применяет info variant', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} variant='info' message={testMessage} />,
        );

        const modal = getByRole('dialog');
        expect(modal).toHaveAttribute('data-variant', 'info');
      });
    });

    describe('width', () => {
      it('применяет default width (400px)', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} message={testMessage} />,
        );

        expect(getByRole('dialog')).toBeInTheDocument();
      });

      it('применяет custom width', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} width='500px' message={testMessage} />,
        );

        expect(getByRole('dialog')).toBeInTheDocument();
      });
    });

    describe('disabled', () => {
      it('не имеет data-disabled по умолчанию', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} message={testMessage} />,
        );

        const modal = getByRole('dialog');
        expect(modal).not.toHaveAttribute('data-disabled');
      });

      it('применяет data-disabled когда disabled=true', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} disabled={true} message={testMessage} />,
        );

        const modal = getByRole('dialog');
        expect(modal).toHaveAttribute('data-disabled', 'true');
      });

      it('блокирует кнопки когда disabled=true', () => {
        const { getByTestId } = renderIsolated(
          <ConfirmDialog visible={true} disabled={true} data-testid='test-dialog' />,
        );

        const confirmButton = getByTestId('test-dialog-confirm') as HTMLButtonElement;
        const cancelButton = getByTestId('test-dialog-cancel') as HTMLButtonElement;

        expect(confirmButton.disabled).toBe(true);
        expect(cancelButton.disabled).toBe(true);
      });

      it('не блокирует кнопки когда disabled=false', () => {
        const { getByTestId } = renderIsolated(
          <ConfirmDialog visible={true} disabled={false} data-testid='test-dialog' />,
        );

        const confirmButton = getByTestId('test-dialog-confirm') as HTMLButtonElement;
        const cancelButton = getByTestId('test-dialog-cancel') as HTMLButtonElement;

        expect(confirmButton.disabled).toBe(false);
        expect(cancelButton.disabled).toBe(false);
      });
    });

    describe('data-testid', () => {
      it('применяет data-testid к Modal', () => {
        const { getByTestId } = renderIsolated(
          <ConfirmDialog visible={true} data-testid='custom-dialog' />,
        );

        expect(getByTestId('custom-dialog')).toBeInTheDocument();
      });

      it('не имеет data-testid по умолчанию', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} message={testMessage} />,
        );

        const modal = getByRole('dialog');
        expect(modal).not.toHaveAttribute('data-testid');
      });

      it('создает test IDs для дочерних элементов', () => {
        const { getByTestId } = renderIsolated(
          <ConfirmDialog visible={true} message={testMessage} data-testid='test-dialog' />,
        );

        expect(getByTestId('test-dialog-content')).toBeInTheDocument();
        expect(getByTestId('test-dialog-message')).toBeInTheDocument();
        expect(getByTestId('test-dialog-actions')).toBeInTheDocument();
        expect(getByTestId('test-dialog-confirm')).toBeInTheDocument();
        expect(getByTestId('test-dialog-cancel')).toBeInTheDocument();
      });

      it('не создает test IDs для дочерних элементов когда data-testid пустой', () => {
        const { queryByTestId } = renderIsolated(
          <ConfirmDialog visible={true} message={testMessage} data-testid='' />,
        );

        expect(queryByTestId('-content')).toBeNull();
        expect(queryByTestId('-message')).toBeNull();
        expect(queryByTestId('-actions')).toBeNull();
        expect(queryByTestId('-confirm')).toBeNull();
        expect(queryByTestId('-cancel')).toBeNull();
      });

      it('не создает test IDs для дочерних элементов когда data-testid=undefined', () => {
        const { queryByTestId } = renderIsolated(
          <ConfirmDialog visible={true} message={testMessage} />,
        );

        expect(queryByTestId('-content')).toBeNull();
        expect(queryByTestId('-message')).toBeNull();
        expect(queryByTestId('-actions')).toBeNull();
        expect(queryByTestId('-confirm')).toBeNull();
        expect(queryByTestId('-cancel')).toBeNull();
      });
    });

    describe('data-state', () => {
      it('применяет data-state="visible" когда visible=true', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} message={testMessage} />,
        );

        const modal = getByRole('dialog');
        expect(modal).toHaveAttribute('data-state', 'visible');
      });

      it('не применяет data-state="visible" когда visible=false', () => {
        const { getModal } = renderIsolated(
          <ConfirmDialog visible={false} />,
        );

        expect(getModal()).toBeNull();
      });
    });

    describe('data-component', () => {
      it('применяет data-component="CoreConfirmDialog"', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} message={testMessage} />,
        );

        const modal = getByRole('dialog');
        expect(modal).toHaveAttribute('data-component', 'CoreConfirmDialog');
      });
    });

    describe('className', () => {
      it('применяет className к Modal', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} className='custom-class' message={testMessage} />,
        );

        const modal = getByRole('dialog');
        const modalContent = modal.querySelector('div');
        expect(modalContent).toHaveClass('custom-class');
      });

      it('не применяет className когда className=undefined', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} message={testMessage} />,
        );

        const modal = getByRole('dialog');
        const modalContent = modal.querySelector('div');
        expect(modalContent).not.toHaveClass('custom-class');
      });
    });

    describe('дополнительные HTML атрибуты', () => {
      it('прокидывает дополнительные HTML атрибуты', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog
            visible={true}
            id='dialog-id'
            data-custom='test-value'
            message={testMessage}
          />,
        );

        const modal = getByRole('dialog');
        expect(modal).toHaveAttribute('id', 'dialog-id');
        expect(modal).toHaveAttribute('data-custom', 'test-value');
      });
    });
  });

  describe('4.3. Кнопки и лейблы', () => {
    describe('confirmLabel', () => {
      it('использует "Подтвердить" по умолчанию', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} message={testMessage} />,
        );

        const buttons = getByRole('button', { name: 'Подтвердить' });
        expect(buttons).toBeInTheDocument();
      });

      it('применяет custom confirmLabel', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} confirmLabel='Yes' />,
        );

        const buttons = getByRole('button', { name: 'Yes' });
        expect(buttons).toBeInTheDocument();
      });
    });

    describe('cancelLabel', () => {
      it('использует "Отменить" по умолчанию', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} message={testMessage} />,
        );

        const buttons = getByRole('button', { name: 'Отменить' });
        expect(buttons).toBeInTheDocument();
      });

      it('применяет custom cancelLabel', () => {
        const { getByRole } = renderIsolated(
          <ConfirmDialog visible={true} cancelLabel='No' />,
        );

        const buttons = getByRole('button', { name: 'No' });
        expect(buttons).toBeInTheDocument();
      });
    });

    describe('порядок кнопок', () => {
      it('отображает кнопку отмены перед кнопкой подтверждения', () => {
        const { getByTestId } = renderIsolated(
          <ConfirmDialog visible={true} data-testid='test-dialog' />,
        );

        const actions = getByTestId('test-dialog-actions');
        const buttons = actions.querySelectorAll('button');

        expect(buttons[0]).toHaveTextContent('Отменить');
        expect(buttons[1]).toHaveTextContent('Подтвердить');
      });
    });
  });

  describe('4.4. Callbacks', () => {
    describe('onConfirm', () => {
      it('вызывает onConfirm при клике на кнопку подтверждения', () => {
        const mockOnConfirm = vi.fn();
        const { getByTestId } = renderIsolated(
          <ConfirmDialog visible={true} onConfirm={mockOnConfirm} data-testid='test-dialog' />,
        );

        const confirmButton = getByTestId('test-dialog-confirm');
        fireEvent.click(confirmButton);

        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      });

      it('не вызывает onConfirm когда disabled=true', () => {
        const mockOnConfirm = vi.fn();
        const { getByTestId } = renderIsolated(
          <ConfirmDialog
            visible={true}
            onConfirm={mockOnConfirm}
            disabled={true}
            data-testid='test-dialog'
          />,
        );

        const confirmButton = getByTestId('test-dialog-confirm');
        fireEvent.click(confirmButton);

        expect(mockOnConfirm).not.toHaveBeenCalled();
      });

      it('не вызывает onConfirm когда onConfirm=undefined', () => {
        const { getByTestId } = renderIsolated(
          <ConfirmDialog visible={true} data-testid='test-dialog' />,
        );

        const confirmButton = getByTestId('test-dialog-confirm');
        expect(() => fireEvent.click(confirmButton)).not.toThrow();
      });
    });

    describe('onCancel', () => {
      it('вызывает onCancel при клике на кнопку отмены', () => {
        const mockOnCancel = vi.fn();
        const { getByTestId } = renderIsolated(
          <ConfirmDialog visible={true} onCancel={mockOnCancel} data-testid='test-dialog' />,
        );

        const cancelButton = getByTestId('test-dialog-cancel');
        fireEvent.click(cancelButton);

        expect(mockOnCancel).toHaveBeenCalledTimes(1);
      });

      it('не вызывает onCancel когда disabled=true', () => {
        const mockOnCancel = vi.fn();
        const { getByTestId } = renderIsolated(
          <ConfirmDialog
            visible={true}
            onCancel={mockOnCancel}
            disabled={true}
            data-testid='test-dialog'
          />,
        );

        const cancelButton = getByTestId('test-dialog-cancel');
        fireEvent.click(cancelButton);

        expect(mockOnCancel).not.toHaveBeenCalled();
      });

      it('не вызывает onCancel когда onCancel=undefined', () => {
        const { getByTestId } = renderIsolated(
          <ConfirmDialog visible={true} data-testid='test-dialog' />,
        );

        const cancelButton = getByTestId('test-dialog-cancel');
        expect(() => fireEvent.click(cancelButton)).not.toThrow();
      });
    });
  });

  describe('4.5. Стилизация', () => {
    it('применяет базовые стили к content', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} message={testMessage} data-testid='test-dialog' />,
      );

      const content = getByTestId('test-dialog-content');
      const computedStyle = window.getComputedStyle(content);

      expect(computedStyle.display).toBe('flex');
      expect(computedStyle.flexDirection).toBe('column');
      expect(computedStyle.gap).toBe('16px');
    });

    it('применяет кастомные стили через style проп', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog
          visible={true}
          message={testMessage}
          style={customStyle}
          data-testid='test-dialog'
        />,
      );

      const content = getByTestId('test-dialog-content');
      const computedStyle = window.getComputedStyle(content);

      expect(computedStyle.borderRadius).toBe('8px');
      expect(computedStyle.padding).toBe('12px');
    });

    it('применяет базовые стили к message', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} message={testMessage} data-testid='test-dialog' />,
      );

      const message = getByTestId('test-dialog-message');
      const computedStyle = window.getComputedStyle(message);

      expect(computedStyle.margin).toBe('0px');
      expect(computedStyle.fontSize).toBe('14px');
      expect(computedStyle.lineHeight).toBe('1.5');
    });

    it('применяет базовые стили к actions', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} data-testid='test-dialog' />,
      );

      const actions = getByTestId('test-dialog-actions');
      const computedStyle = window.getComputedStyle(actions);

      expect(computedStyle.display).toBe('flex');
      expect(computedStyle.justifyContent).toBe('flex-end');
      expect(computedStyle.gap).toBe('8px');
      expect(computedStyle.marginTop).toBe('8px');
    });

    it('применяет базовые стили к кнопке подтверждения', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} data-testid='test-dialog' />,
      );

      const confirmButton = getByTestId('test-dialog-confirm');
      const computedStyle = window.getComputedStyle(confirmButton);

      expect(computedStyle.padding).toBe('8px 16px');
      expect(computedStyle.borderRadius).toBe('6px');
      expect(computedStyle.fontSize).toBe('14px');
      expect(computedStyle.fontWeight).toBe('500');
      expect(computedStyle.minWidth).toBe('80px');
    });

    it('применяет disabled стили к кнопке подтверждения когда disabled=true', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} disabled={true} data-testid='test-dialog' />,
      );

      const confirmButton = getByTestId('test-dialog-confirm');
      const computedStyle = window.getComputedStyle(confirmButton);

      expect(computedStyle.opacity).toBe('0.6');
      expect(computedStyle.cursor).toBe('not-allowed');
    });

    it('применяет базовые стили к кнопке отмены', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} data-testid='test-dialog' />,
      );

      const cancelButton = getByTestId('test-dialog-cancel');
      const computedStyle = window.getComputedStyle(cancelButton);

      expect(computedStyle.padding).toBe('8px 16px');
      expect(computedStyle.borderRadius).toBe('6px');
      expect(computedStyle.fontSize).toBe('14px');
      expect(computedStyle.fontWeight).toBe('500');
      expect(computedStyle.minWidth).toBe('80px');
    });

    it('применяет disabled стили к кнопке отмены когда disabled=true', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} disabled={true} data-testid='test-dialog' />,
      );

      const cancelButton = getByTestId('test-dialog-cancel');
      const computedStyle = window.getComputedStyle(cancelButton);

      expect(computedStyle.opacity).toBe('0.6');
      expect(computedStyle.cursor).toBe('not-allowed');
    });
  });

  describe('4.6. Ref forwarding', () => {
    it('передает ref в Modal', () => {
      const mockRef = createMockRef();
      renderIsolated(
        <ConfirmDialog visible={true} message={testMessage} ref={mockRef} />,
      );

      // Ref должен указывать на внутренний div Modal (тот, что с className)
      expect(mockRef.current).toBeInstanceOf(HTMLDivElement);
      expect(mockRef.current).not.toBeNull();
    });

    it('поддерживает React.createRef', () => {
      const ref = React.createRef<HTMLDivElement>();

      renderIsolated(<ConfirmDialog visible={true} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('4.7. Memoization и производительность', () => {
    it('не ререндерится при одинаковых пропсах', () => {
      let renderCount = 0;

      const TestComponent = ({ visible }: Readonly<{ visible: boolean; }>) => {
        renderCount++;
        return <ConfirmDialog visible={visible} message={testMessage} />;
      };

      const { rerender } = render(<TestComponent visible={true} />);

      expect(renderCount).toBe(1);

      rerender(<TestComponent visible={true} />);
      expect(renderCount).toBe(2); // React.memo предотвращает лишние рендеры компонента
    });

    it('перерендеривается при изменении visible', () => {
      const { getByRole, queryByRole, rerender } = renderIsolated(
        <ConfirmDialog visible={true} message={testMessage} />,
      );

      expect(getByRole('dialog')).toBeInTheDocument();

      rerender(<ConfirmDialog visible={false} message={testMessage} />);

      expect(queryByRole('dialog')).toBeNull();
    });

    it('useMemo для confirmButtonStyle вызывается только при изменении disabled', () => {
      const { getByTestId, rerender } = renderIsolated(
        <ConfirmDialog visible={true} disabled={false} data-testid='test-dialog' />,
      );

      const initialOpacity = window.getComputedStyle(getByTestId('test-dialog-confirm')).opacity;

      rerender(<ConfirmDialog visible={true} disabled={true} data-testid='test-dialog' />);

      const newOpacity = window.getComputedStyle(getByTestId('test-dialog-confirm')).opacity;

      expect(initialOpacity).not.toBe(newOpacity);
    });

    it('useMemo для cancelButtonStyle вызывается только при изменении disabled', () => {
      const { getByTestId, rerender } = renderIsolated(
        <ConfirmDialog visible={true} disabled={false} data-testid='test-dialog' />,
      );

      const initialOpacity = window.getComputedStyle(getByTestId('test-dialog-cancel')).opacity;

      rerender(<ConfirmDialog visible={true} disabled={true} data-testid='test-dialog' />);

      const newOpacity = window.getComputedStyle(getByTestId('test-dialog-cancel')).opacity;

      expect(initialOpacity).not.toBe(newOpacity);
    });

    it('useMemo для contentStyle вызывается только при изменении style', () => {
      const style1 = { padding: '10px' } as const;
      const style2 = { padding: '20px' } as const;
      const { getByTestId, rerender } = renderIsolated(
        <ConfirmDialog visible={true} style={style1} data-testid='test-dialog' />,
      );

      const initialPadding = window.getComputedStyle(getByTestId('test-dialog-content')).padding;

      rerender(<ConfirmDialog visible={true} style={style2} data-testid='test-dialog' />);

      const newPadding = window.getComputedStyle(getByTestId('test-dialog-content')).padding;

      expect(initialPadding).not.toBe(newPadding);
    });
  });

  describe('4.8. Edge cases', () => {
    it('работает с пустой строкой message', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} message='' data-testid='test-dialog' />,
      );

      expect(getByTestId('test-dialog-message')).toHaveTextContent('');
    });

    it('работает с пустой строкой title', () => {
      const { container } = renderIsolated(
        <ConfirmDialog visible={true} title='' />,
      );

      // Modal не рендерит title если он пустая строка
      expect(container.querySelector('h2')).toBeNull();
    });

    it('работает с пустой строкой confirmLabel', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} confirmLabel='' data-testid='test-dialog' />,
      );

      expect(getByTestId('test-dialog-confirm')).toHaveTextContent('');
    });

    it('работает с пустой строкой cancelLabel', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} cancelLabel='' data-testid='test-dialog' />,
      );

      expect(getByTestId('test-dialog-cancel')).toHaveTextContent('');
    });

    it('работает с undefined style', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} style={undefined} data-testid='test-dialog' />,
      );

      expect(getByTestId('test-dialog-content')).toBeInTheDocument();
    });

    it('работает с пустым объектом style', () => {
      const { getByTestId } = renderIsolated(
        <ConfirmDialog visible={true} style={emptyStyle} data-testid='test-dialog' />,
      );

      expect(getByTestId('test-dialog-content')).toBeInTheDocument();
    });

    it('работает без всех опциональных пропсов', () => {
      const { getByRole } = renderIsolated(
        <ConfirmDialog visible={true} message={testMessage} />,
      );

      // Modal должен рендериться с role="dialog"
      expect(getByRole('dialog')).toBeInTheDocument();
    });

    it('работает со всеми пропсами одновременно', () => {
      const mockOnConfirm = vi.fn();
      const mockOnCancel = vi.fn();
      const { getByTestId } = renderIsolated(
        <ConfirmDialog
          visible={true}
          title={testTitle}
          message={testMessage}
          confirmLabel='Yes'
          cancelLabel='No'
          variant='error'
          disabled={false}
          width='500px'
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          style={customStyle}
          className='custom-class'
          data-testid='test-dialog'
        />,
      );

      expect(getByTestId('test-dialog')).toBeInTheDocument();
      expect(getByTestId('test-dialog-message')).toHaveTextContent(testMessage);
      expect(getByTestId('test-dialog-confirm')).toHaveTextContent('Yes');
      expect(getByTestId('test-dialog-cancel')).toHaveTextContent('No');
    });
  });

  describe('4.9. useCallback для обработчиков', () => {
    it('handleConfirm стабилен при одинаковых зависимостях', () => {
      const mockOnConfirm = vi.fn();
      const { getByTestId, rerender } = renderIsolated(
        <ConfirmDialog
          visible={true}
          onConfirm={mockOnConfirm}
          disabled={false}
          data-testid='test-dialog'
        />,
      );

      const confirmButton = getByTestId('test-dialog-confirm');
      const firstClick = () => fireEvent.click(confirmButton);

      firstClick();
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);

      // Перерендер с теми же зависимостями
      rerender(
        <ConfirmDialog
          visible={true}
          onConfirm={mockOnConfirm}
          disabled={false}
          data-testid='test-dialog'
        />,
      );

      const confirmButton2 = getByTestId('test-dialog-confirm');
      fireEvent.click(confirmButton2);
      expect(mockOnConfirm).toHaveBeenCalledTimes(2);
    });

    it('handleCancel стабилен при одинаковых зависимостях', () => {
      const mockOnCancel = vi.fn();
      const { getByTestId, rerender } = renderIsolated(
        <ConfirmDialog
          visible={true}
          onCancel={mockOnCancel}
          disabled={false}
          data-testid='test-dialog'
        />,
      );

      const cancelButton = getByTestId('test-dialog-cancel');
      fireEvent.click(cancelButton);
      expect(mockOnCancel).toHaveBeenCalledTimes(1);

      // Перерендер с теми же зависимостями
      rerender(
        <ConfirmDialog
          visible={true}
          onCancel={mockOnCancel}
          disabled={false}
          data-testid='test-dialog'
        />,
      );

      const cancelButton2 = getByTestId('test-dialog-cancel');
      fireEvent.click(cancelButton2);
      expect(mockOnCancel).toHaveBeenCalledTimes(2);
    });
  });
});
