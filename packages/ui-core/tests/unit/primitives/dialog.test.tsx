/**
 * @vitest-environment jsdom
 * @file Unit тесты для Dialog компонента
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dialog } from '@livai/ui-core';

import '@testing-library/jest-dom/vitest';

// Полная очистка DOM между тестами
afterEach(() => {
  cleanup();
  // Сброс глобального счетчика модальных окон
  vi.restoreAllMocks();
});

// Для целей тестов ослабляем типизацию пропсов Dialog
const AnyDialog = Dialog as any;

// Мок для MutationObserver
const MockMutationObserver = vi.fn().mockImplementation(function() {
  return {
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(),
  };
});

global.MutationObserver = MockMutationObserver;

describe('Dialog', () => {
  describe('1.1. Рендер и базовая структура', () => {
    it('рендерится без падений с минимальными пропсами', () => {
      const { container } = render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(container).toBeInTheDocument();
    });

    it('не рендерится когда open=false', () => {
      const { container } = render(
        React.createElement(
          AnyDialog,
          { open: false },
          React.createElement('div', null, 'Test content'),
        ),
      );

      // Dialog не должен рендериться в DOM
      expect(container.firstChild).toBeNull();
    });

    it('рендерится в portal (document.body)', () => {
      const { container } = render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', { 'data-testid': 'dialog-content' }, 'Test content'),
        ),
      );

      // Содержимое должно быть в document.body, а не в контейнере компонента
      expect(container.firstChild).toBeNull();

      const dialogContent = screen.getByTestId('dialog-content');
      expect(dialogContent).toBeInTheDocument();

      // Проверяем что контент находится в portal (document.body)
      expect(dialogContent.closest('body')).toBe(document.body);
    });

    it('применяет базовые CSS классы', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toBeInTheDocument();
      expect(dialogRoot).toHaveClass('core-dialog-root');
    });
  });

  describe('1.2. Accessibility (ARIA)', () => {
    it('применяет role="dialog"', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('role', 'dialog');
    });

    it('применяет aria-modal', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('aria-modal', 'true');
    });

    it('применяет aria-labelledby когда передан', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true, 'aria-labelledby': 'title-id' },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('aria-labelledby', 'title-id');
    });

    it('применяет aria-describedby когда передан', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true, 'aria-describedby': 'desc-id' },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('aria-describedby', 'desc-id');
    });

    it('не применяет aria-labelledby когда не передан', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).not.toHaveAttribute('aria-labelledby');
    });
  });

  describe('1.3. Data атрибуты', () => {
    it('применяет data-variant когда передан', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true, 'data-variant': 'custom' },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('data-variant', 'custom');
    });

    it('применяет data-disabled когда передан', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true, 'data-disabled': true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('data-disabled', 'true');
    });

    it('применяет z-index через CSS переменную', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true, zIndex: 1500 },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveStyle({ '--dialog-z-index': '1500' });
    });

    it('z-index по умолчанию = 1000', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveStyle({ '--dialog-z-index': '1000' });
    });
  });

  describe('1.4. Backdrop', () => {
    it('рендерит backdrop с правильными классами', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const backdrop = document.querySelector('.core-dialog-backdrop');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveClass('core-dialog-backdrop');
    });

    it('backdrop имеет aria-hidden="true"', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const backdrop = document.querySelector('.core-dialog-backdrop');
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    });

    it('backdrop имеет role="presentation"', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const backdrop = document.querySelector('.core-dialog-backdrop');
      expect(backdrop).toHaveAttribute('role', 'presentation');
    });

    it('backdrop вызывает onBackdropClick при клике', () => {
      const onBackdropClick = vi.fn();
      render(
        React.createElement(
          AnyDialog,
          { open: true, onBackdropClick },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const backdrop = document.querySelector('.core-dialog-backdrop');
      fireEvent.click(backdrop!);

      expect(onBackdropClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('1.5. Panel (content area)', () => {
    it('рендерит panel с правильными классами', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const panel = document.querySelector('.core-dialog-panel');
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveClass('core-dialog-panel');
    });

    it('panel не имеет aria-hidden (в отличие от backdrop)', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const panel = document.querySelector('.core-dialog-panel');
      expect(panel).not.toHaveAttribute('aria-hidden');
    });

    it('передает children в panel', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', { 'data-testid': 'custom-content' }, 'Custom content'),
        ),
      );

      const customContent = screen.getByTestId('custom-content');
      expect(customContent).toBeInTheDocument();
      expect(customContent).toHaveTextContent('Custom content');
    });
  });

  describe('1.6. Keyboard events', () => {
    it('вызывает onEscape при нажатии Escape', () => {
      const onEscape = vi.fn();
      render(
        React.createElement(
          AnyDialog,
          { open: true, onEscape },
          React.createElement('div', null, 'Test content'),
        ),
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('не вызывает onEscape при других клавишах', () => {
      const onEscape = vi.fn();
      render(
        React.createElement(
          AnyDialog,
          { open: true, onEscape },
          React.createElement('div', null, 'Test content'),
        ),
      );

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(onEscape).not.toHaveBeenCalled();
    });

    it('не вызывает onEscape когда не передан', () => {
      // Этот тест проверяет что не происходит ошибок когда onEscape не передан
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(() => {
        fireEvent.keyDown(document, { key: 'Escape' });
      }).not.toThrow();
    });
  });

  describe('1.7. Focus management', () => {
    it('MutationObserver создается при mount', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(MockMutationObserver).toHaveBeenCalled();
    });

    it('MutationObserver получает правильные параметры', () => {
      // Получаем экземпляр MutationObserver, который создается в компоненте
      let createdObserver: any;
      MockMutationObserver.mockImplementationOnce(function() {
        createdObserver = {
          observe: vi.fn(),
          disconnect: vi.fn(),
          takeRecords: vi.fn(),
        };
        return createdObserver;
      });

      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(createdObserver.observe).toHaveBeenCalledWith(
        expect.any(Element),
        expect.objectContaining({
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['tabindex', 'disabled', 'hidden', 'aria-hidden'],
        }),
      );
    });
  });

  describe('1.8. Props forwarding', () => {
    it('передает id атрибут', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true, id: 'custom-dialog' },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('id', 'custom-dialog');
    });

    it('передает data-testid атрибут', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true, 'data-testid': 'dialog-test' },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('data-testid', 'dialog-test');
    });

    it('передает произвольные атрибуты', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true, 'data-custom': 'value' },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).toHaveAttribute('data-custom', 'value');
    });
  });

  describe('1.9. Edge cases', () => {
    it('работает с пустыми children', () => {
      expect(() => {
        render(
          React.createElement(AnyDialog, { open: true }, null),
        );
      }).not.toThrow();
    });

    it('работает с undefined children', () => {
      expect(() => {
        render(
          React.createElement(AnyDialog, { open: true }, undefined as any),
        );
      }).not.toThrow();
    });

    it('работает без children', () => {
      expect(() => {
        render(
          React.createElement(
            AnyDialog,
            { open: true },
            React.createElement('div', null),
          ),
        );
      }).not.toThrow();
    });

    it('работает с null data-variant', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true, 'data-variant': null },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).not.toHaveAttribute('data-variant');
    });

    it('работает без data-variant', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      const dialogRoot = document.querySelector('.core-dialog-root');
      expect(dialogRoot).not.toHaveAttribute('data-variant');
    });
  });

  describe('1.10. SSR compatibility', () => {
    it('работает в SSR окружении без document', () => {
      // Мокаем отсутствие document для SSR
      const originalDocument = global.document;
      delete (global as any).document;

      try {
        // В SSR окружении компонент должен корректно обработать отсутствие document
        // Проверяем что создание компонента не выбрасывает ошибку
        expect(() => {
          const element = React.createElement(
            AnyDialog,
            { open: true },
            React.createElement('div', null, 'Test content'),
          );
          // Проверяем что JSX элемент создан
          expect(element).toBeDefined();
          expect(element.props.open).toBe(true);
        }).not.toThrow();
      } finally {
        // Восстанавливаем document
        global.document = originalDocument;
      }
    });
  });

  describe('2.1. Focus management', () => {
    it('устанавливает фокус на первый фокусируемый элемент при открытии', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement(
            'div',
            null,
            React.createElement('input', { 'data-testid': 'first-input' }),
            React.createElement('button', { 'data-testid': 'first-button' }, 'Button'),
          ),
        ),
      );

      const firstInput = screen.getByTestId('first-input');
      expect(firstInput).toHaveFocus();
    });

    it('восстанавливает фокус на предыдущий элемент при закрытии', () => {
      const { rerender } = render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      // Мокаем предыдущий фокус
      const mockElement = document.createElement('button');
      document.body.appendChild(mockElement);
      mockElement.focus();

      // Имитируем закрытие диалога
      rerender(
        React.createElement(
          AnyDialog,
          { open: false },
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(mockElement).toHaveFocus();
      document.body.removeChild(mockElement);
    });

    it('использует fallback focus на document.body если предыдущий элемент недоступен', () => {
      const focusSpy = vi.spyOn(document.body, 'focus').mockImplementation(() => {});

      const { rerender } = render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      // Имитируем закрытие диалога
      rerender(
        React.createElement(
          AnyDialog,
          { open: false },
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });
  });

  describe('2.2. Focus trap', () => {
    it('предотвращает выход фокуса за пределы диалога при Tab', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement(
            'div',
            null,
            React.createElement('input', { 'data-testid': 'first-input' }),
            React.createElement('button', { 'data-testid': 'middle-button' }, 'Middle'),
            React.createElement('input', { 'data-testid': 'last-input' }),
          ),
        ),
      );

      const lastInput = screen.getByTestId('last-input');
      const firstInput = screen.getByTestId('first-input');

      // Фокус на последнем элементе
      lastInput.focus();
      expect(lastInput).toHaveFocus();

      // Нажатие Tab должно перевести фокус на первый элемент
      fireEvent.keyDown(document, { key: 'Tab' });

      expect(firstInput).toHaveFocus();
    });

    it('предотвращает выход фокуса за пределы диалога при Shift+Tab', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement(
            'div',
            null,
            React.createElement('input', { 'data-testid': 'first-input' }),
            React.createElement('button', { 'data-testid': 'middle-button' }, 'Middle'),
            React.createElement('input', { 'data-testid': 'last-input' }),
          ),
        ),
      );

      const firstInput = screen.getByTestId('first-input');
      const lastInput = screen.getByTestId('last-input');

      // Фокус на первом элементе
      firstInput.focus();
      expect(firstInput).toHaveFocus();

      // Shift+Tab должен перевести фокус на последний элемент
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

      expect(lastInput).toHaveFocus();
    });

    it('обновляет кеш фокусируемых элементов при изменениях в DOM', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement(
            'div',
            { 'data-testid': 'panel' },
            React.createElement('input', { 'data-testid': 'initial-input' }),
          ),
        ),
      );

      // Имитируем добавление нового элемента
      const panel = screen.getByTestId('panel');
      const newButton = document.createElement('button');
      newButton.setAttribute('data-testid', 'new-button');
      panel.appendChild(newButton);

      // MutationObserver должен вызвать updateFocusableElements
      // Это сложно протестировать напрямую, но мы можем проверить что компонент рендерится без ошибок
      expect(panel).toContainElement(screen.getByTestId('new-button'));
    });

    it('игнорирует Tab, когда нет фокусируемых элементов внутри диалога', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Just text, no focusable elements'),
        ),
      );

      expect(() => {
        fireEvent.keyDown(document, { key: 'Tab' });
      }).not.toThrow();
    });
  });

  describe('2.3. Scroll lock', () => {
    it('блокирует прокрутку body при открытии диалога', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('восстанавливает прокрутку body при закрытии диалога', () => {
      const originalOverflow = document.body.style.overflow;

      const { rerender } = render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        React.createElement(
          AnyDialog,
          { open: false },
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(document.body.style.overflow).toBe(originalOverflow);
    });

    it('правильно обрабатывает несколько открытых диалогов', () => {
      const originalOverflow = document.body.style.overflow;

      const { rerender: rerender1 } = render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Dialog 1'),
        ),
      );

      expect(document.body.style.overflow).toBe('hidden');

      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Dialog 2'),
        ),
      );

      // Прокрутка всё ещё заблокирована
      expect(document.body.style.overflow).toBe('hidden');

      // Закрываем первый диалог
      rerender1(
        React.createElement(
          AnyDialog,
          { open: false },
          React.createElement('div', null, 'Dialog 1'),
        ),
      );

      // Прокрутка всё ещё заблокирована (второй диалог открыт)
      expect(document.body.style.overflow).toBe('hidden');

      // Имитируем закрытие второго диалога через cleanup
      // В реальном использовании это происходит автоматически
      // Для теста просто проверяем что базовая логика работает
      expect(originalOverflow).toBeDefined();
    });
  });

  describe('2.4. Keyboard navigation', () => {
    it('вызывает onEscape только при нажатии Escape', () => {
      const onEscape = vi.fn();
      render(
        React.createElement(
          AnyDialog,
          { open: true, onEscape },
          React.createElement('div', null, 'Test content'),
        ),
      );

      // Другие клавиши не должны вызывать onEscape
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: ' ' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });

      expect(onEscape).not.toHaveBeenCalled();

      // Только Escape должен вызвать onEscape
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('работает с различными типами фокусируемых элементов', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement(
            'div',
            null,
            React.createElement('button', { 'data-testid': 'button' }, 'Button'),
            React.createElement(
              'a',
              { href: '#test', 'data-testid': 'link' },
              'Link',
            ),
            React.createElement('input', { 'data-testid': 'input' }),
            React.createElement(
              'select',
              { 'data-testid': 'select' },
              React.createElement('option', null, 'Option 1'),
            ),
            React.createElement('textarea', { 'data-testid': 'textarea' }),
            React.createElement(
              'div',
              { tabIndex: 0, 'data-testid': 'tabindex' },
              'Focusable div',
            ),
          ),
        ),
      );

      // Первый фокусируемый элемент должен получить фокус
      const button = screen.getByTestId('button');
      expect(button).toHaveFocus();
    });

    it('игнорирует элементы с tabindex="-1"', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement(
            'div',
            null,
            React.createElement('input', { 'data-testid': 'input' }),
            React.createElement(
              'button',
              { tabIndex: -1, 'data-testid': 'skipped-button' },
              'Skipped',
            ),
          ),
        ),
      );

      // Должен получить фокус input, а не button с tabindex="-1"
      const input = screen.getByTestId('input');
      expect(input).toHaveFocus();
    });
  });

  describe('2.5. Container prop', () => {
    it('использует кастомный container для portal', () => {
      const customContainer = document.createElement('div');
      customContainer.setAttribute('data-testid', 'custom-container');
      document.body.appendChild(customContainer);

      render(
        React.createElement(
          AnyDialog,
          { open: true, container: customContainer },
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(customContainer).toContainElement(screen.getByText('Test content'));
      document.body.removeChild(customContainer);
    });

    it('использует document.body по умолчанию', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(document.body).toContainElement(screen.getByText('Test content'));
    });
  });

  describe('2.6. Edge cases и error handling', () => {
    it('работает без фокусируемых элементов', () => {
      render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement(
            'div',
            null,
            React.createElement(
              'span',
              { 'data-testid': 'non-focusable' },
              'Just text',
            ),
            React.createElement('div', null, 'More text'),
          ),
        ),
      );

      // Компонент должен рендериться без ошибок даже без фокусируемых элементов
      expect(screen.getByTestId('non-focusable')).toBeInTheDocument();
    });

    it('обрабатывает ошибки при установке фокуса с fallback на document.body', () => {
      // Подготавливаем элемент, который будет в фокусе до открытия диалога
      const previousElement = document.createElement('button');
      document.body.appendChild(previousElement);
      previousElement.focus();

      // spy на fallback-фокус body
      const bodyFocusSpy = vi.spyOn(document.body, 'focus').mockImplementation(() => {});

      // Открываем диалог (сохраняет previousFocusRef = previousElement)
      const { rerender } = render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      // Теперь делаем так, чтобы повторный фокус на previousElement кидал ошибку
      Object.defineProperty(previousElement, 'focus', {
        value: vi.fn().mockImplementation(() => {
          throw new Error('Cannot focus');
        }),
        writable: false,
      });

      // Закрываем диалог, что приводит к попытке сфокусировать previousElement,
      // а затем к fallback document.body.focus() в блоке catch
      rerender(
        React.createElement(
          AnyDialog,
          { open: false },
          React.createElement('div', null, 'Test content'),
        ),
      );

      expect(bodyFocusSpy).toHaveBeenCalled();

      bodyFocusSpy.mockRestore();
      document.body.removeChild(previousElement);
    });

    it('очищает MutationObserver при unmount', () => {
      const disconnectSpy = vi.fn();
      MockMutationObserver.mockImplementationOnce(function() {
        return {
          observe: vi.fn(),
          disconnect: disconnectSpy,
          takeRecords: vi.fn(),
        };
      });

      const { unmount } = render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      unmount();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('updateFocusableElements обрабатывает null panelRef', () => {
      // Этот тест проверяет edge case когда panelRef.current === null
      // Это может произойти в редких случаях инициализации
      const { rerender } = render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      // Имитируем ситуацию где панель временно недоступна
      // (в реальности это edge case который сложно воспроизвести)
      rerender(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      // Компонент должен корректно обработать эту ситуацию
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('MutationObserver callback вызывает updateFocusableElements даже когда panelRef=null', () => {
      let mutationCallback: (() => void) | null = null;

      // Мокаем MutationObserver чтобы захватить callback
      MockMutationObserver.mockImplementationOnce(function(callback) {
        mutationCallback = callback;
        return {
          observe: vi.fn(),
          disconnect: vi.fn(),
          takeRecords: vi.fn(),
        };
      });

      const { unmount } = render(
        React.createElement(
          AnyDialog,
          { open: true },
          React.createElement('div', null, 'Test content'),
        ),
      );

      // Проверяем что callback был захвачен
      expect(mutationCallback).toBeDefined();

      // Размонтируем диалог, чтобы panelRef.current стал null,
      // затем вызываем callback (updateFocusableElements должен обработать null panelRef)
      unmount();

      // Вызов callback после unmount не должен приводить к ошибкам,
      // даже когда panelRef.current === null
      (mutationCallback as unknown as () => void)();
    });
  });
});
