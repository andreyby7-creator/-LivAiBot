/**
 * @vitest-environment jsdom
 * @file Unit тесты для Modal компонента
 */

import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Modal } from '@livai/ui-core';

import '@testing-library/jest-dom/vitest';

const AnyModal = Modal as any;

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
    getModal: () => container.querySelector('div[data-component="CoreModal"]')!,
  };
}

describe('Modal', () => {
  // Общие тестовые переменные
  const testContent = 'Test modal content';
  const testTitle = 'Test Modal Title';

  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLDivElement>();

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container } = renderIsolated(
        React.createElement(AnyModal, { visible: true } as any, testContent),
      );

      expect(container).toBeInTheDocument();
      expect(container.querySelector('div[data-component="CoreModal"]')!).toBeInTheDocument();
    });

    it('не рендерится когда visible=false', () => {
      const { container } = renderIsolated(
        React.createElement(AnyModal, { visible: false } as any, testContent),
      );

      expect(container).toBeInTheDocument();
      expect(container.querySelector('div[data-component="CoreModal"]')!).toBeNull();
    });

    it('рендерится с title', () => {
      const { container } = renderIsolated(
        React.createElement(AnyModal, { visible: true, title: testTitle } as any, testContent),
      );

      expect(container).toBeInTheDocument();
      expect(container.querySelector('div[data-component="CoreModal"]')!).toBeInTheDocument();
      expect(container.querySelector('h2')).toHaveTextContent(testTitle);
    });

    it('рендерится без title', () => {
      const { container } = renderIsolated(
        React.createElement(AnyModal, { visible: true } as any, testContent),
      );

      expect(container).toBeInTheDocument();
      expect(container.querySelector('div[data-component="CoreModal"]')!).toBeInTheDocument();
      expect(container.querySelector('h2')).toBeNull();
    });
  });

  describe('4.2. Пропсы и атрибуты', () => {
    describe('variant', () => {
      it('применяет default variant по умолчанию', () => {
        const { container } = renderIsolated(
          React.createElement(AnyModal, { visible: true } as any, testContent),
        );

        expect(container.querySelector('div[data-component="CoreModal"]')!).toHaveAttribute(
          'data-variant',
          'default',
        );
      });

      it('применяет warning variant', () => {
        const { container } = renderIsolated(
          React.createElement(AnyModal, { visible: true, variant: 'warning' } as any, testContent),
        );

        expect(container.querySelector('div[data-component="CoreModal"]')!).toHaveAttribute(
          'data-variant',
          'warning',
        );
      });

      it('применяет error variant', () => {
        const { container } = renderIsolated(
          React.createElement(AnyModal, { visible: true, variant: 'error' } as any, testContent),
        );

        expect(container.querySelector('div[data-component="CoreModal"]')!).toHaveAttribute(
          'data-variant',
          'error',
        );
      });

      it('применяет success variant', () => {
        const { container } = renderIsolated(
          React.createElement(AnyModal, { visible: true, variant: 'success' } as any, testContent),
        );

        expect(container.querySelector('div[data-component="CoreModal"]')!).toHaveAttribute(
          'data-variant',
          'success',
        );
      });
    });

    describe('width и height', () => {
      it('принимает width и height пропсы', () => {
        const { container } = renderIsolated(
          React.createElement(
            AnyModal,
            { visible: true, width: '400px', height: '300px' } as any,
            testContent,
          ),
        );

        const modalDiv = container.querySelector('div[role="dialog"]')!;
        expect(modalDiv).toBeInTheDocument();
      });

      it('принимает width и height как числа', () => {
        const { container } = renderIsolated(
          React.createElement(
            AnyModal,
            { visible: true, width: 500 as any, height: 400 as any } as any,
            testContent,
          ),
        );

        const modalDiv = container.querySelector('div[role="dialog"]')!;
        expect(modalDiv).toBeInTheDocument();
      });

      it('работает без width и height', () => {
        const { container } = renderIsolated(
          React.createElement(AnyModal, { visible: true } as any, testContent),
        );

        const modalDiv = container.querySelector('div[role="dialog"]')!;
        expect(modalDiv).toBeInTheDocument();
      });
    });

    describe('overlayZIndex', () => {
      it('применяет default z-index', () => {
        const { container } = renderIsolated(
          React.createElement(AnyModal, { visible: true } as any, testContent),
        );

        expect(container.querySelector('div[data-component="CoreModal"]')!).toHaveStyle({
          zIndex: '9999',
        });
      });

      it('применяет custom z-index', () => {
        const { container } = renderIsolated(
          React.createElement(
            AnyModal,
            { visible: true, overlayZIndex: 1234 } as any,
            testContent,
          ),
        );

        expect(container.querySelector('div[data-component="CoreModal"]')!).toHaveStyle({
          zIndex: '1234',
        });
      });
    });

    describe('data-testid', () => {
      it('применяет data-testid', () => {
        const { getByTestId } = renderIsolated(
          React.createElement(
            AnyModal,
            { visible: true, 'data-testid': 'custom-modal' } as any,
            testContent,
          ),
        );

        expect(getByTestId('custom-modal')).toBeInTheDocument();
      });

      it('не имеет data-testid по умолчанию', () => {
        const { container } = renderIsolated(
          React.createElement(AnyModal, { visible: true } as any, testContent),
        );

        expect(container.querySelector('[data-testid]')).toBeNull();
      });
    });
  });

  describe('4.3. Стилизация', () => {
    it('применяет className к modal container', () => {
      const { container } = renderIsolated(
        React.createElement(
          AnyModal,
          { visible: true, className: 'custom-class' } as any,
          testContent,
        ),
      );

      const modalDiv = container.querySelector('div[role="dialog"] > div')!;
      expect(modalDiv).toHaveClass('custom-class');
    });

    it('применяет базовые стили overlay', () => {
      const { container } = renderIsolated(
        React.createElement(AnyModal, { visible: true } as any, testContent),
      );

      const overlay = container.querySelector('div[data-component="CoreModal"]')!;
      expect(overlay).toHaveStyle({
        position: 'fixed',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        zIndex: '9999',
      });
    });

    it('применяет базовые стили modal', () => {
      const { container } = renderIsolated(
        React.createElement(AnyModal, { visible: true } as any, testContent),
      );

      const modalDiv = container.querySelector('div[role="dialog"]')!;
      expect(modalDiv).toBeInTheDocument();
      expect(modalDiv).toHaveStyle({ display: 'flex' });
    });
  });

  describe('4.4. Доступность (A11y)', () => {
    it('имеет правильные ARIA атрибуты по умолчанию', () => {
      const { container } = renderIsolated(
        React.createElement(AnyModal, { visible: true } as any, testContent),
      );

      expect(container.querySelector('div[data-component="CoreModal"]')!).toHaveAttribute(
        'role',
        'dialog',
      );
      expect(container.querySelector('div[data-component="CoreModal"]')!).toHaveAttribute(
        'aria-modal',
        'true',
      );
      expect(container.querySelector('div[data-component="CoreModal"]')!).toHaveAttribute(
        'data-state',
        'visible',
      );
      expect(container.querySelector('div[data-component="CoreModal"]')!).toHaveAttribute(
        'data-component',
        'CoreModal',
      );
    });

    it('применяет aria-label', () => {
      const { container } = renderIsolated(
        React.createElement(
          AnyModal,
          { visible: true, 'aria-label': 'Custom label' } as any,
          testContent,
        ),
      );

      expect(container.querySelector('div[data-component="CoreModal"]')!).toHaveAttribute(
        'aria-label',
        'Custom label',
      );
    });

    it('применяет aria-labelledby', () => {
      const { container } = renderIsolated(
        React.createElement(
          AnyModal,
          { visible: true, 'aria-labelledby': 'title-id' } as any,
          testContent,
        ),
      );

      expect(container.querySelector('div[data-component="CoreModal"]')!).toHaveAttribute(
        'aria-labelledby',
        'title-id',
      );
    });

    it('title имеет правильные стили', () => {
      const { container } = renderIsolated(
        React.createElement(AnyModal, { visible: true, title: testTitle } as any, testContent),
      );

      const titleElement = container.querySelector('h2')!;
      expect(titleElement).toHaveStyle({
        margin: '0px 0px 12px 0px',
      });
    });
  });

  describe('4.5. Ref forwarding', () => {
    it('передает ref в modal container', () => {
      const mockRef = createMockRef();
      const { container } = renderIsolated(
        React.createElement(AnyModal, { visible: true, ref: mockRef } as any, testContent),
      );

      const modalDiv = container.querySelector('div[data-component="CoreModal"] > div')!;
      expect(mockRef.current).toBe(modalDiv);
    });
  });

  describe('4.6. Children', () => {
    it('рендерит children', () => {
      const { container } = renderIsolated(
        React.createElement(
          AnyModal,
          { visible: true } as any,
          React.createElement('div', { 'data-testid': 'modal-content' }, testContent),
        ),
      );

      expect(container.querySelector('[data-testid="modal-content"]')).toHaveTextContent(
        testContent,
      );
    });

    it('рендерит сложные children', () => {
      const { container } = renderIsolated(
        React.createElement(
          AnyModal,
          { visible: true } as any,
          React.createElement(
            'div',
            null,
            React.createElement('p', null, 'Paragraph 1'),
            React.createElement('button', null, 'Action Button'),
            React.createElement('span', null, 'Some text'),
          ),
        ),
      );

      expect(container.querySelector('p')).toHaveTextContent('Paragraph 1');
      expect(container.querySelector('button')).toBeInTheDocument();
      expect(container.querySelector('span')).toHaveTextContent('Some text');
    });
  });

  describe('4.7. Edge cases', () => {
    it('работает с пустыми children', () => {
      const { container } = renderIsolated(
        React.createElement(AnyModal, { visible: true } as any, null),
      );

      expect(container).toBeInTheDocument();
      expect(container.querySelector('div[data-component="CoreModal"]')!).toBeInTheDocument();
    });

    it('работает с null title', () => {
      const { container } = renderIsolated(
        React.createElement(
          AnyModal,
          { visible: true, title: null as any } as any,
          testContent,
        ),
      );

      expect(container.querySelector('h2')).toBeNull();
    });

    it('работает с undefined title', () => {
      const { container } = renderIsolated(
        React.createElement(
          AnyModal,
          { visible: true, title: undefined as any } as any,
          testContent,
        ),
      );

      expect(container.querySelector('h2')).toBeNull();
    });

    it('работает с пустой строкой title', () => {
      const { container } = renderIsolated(
        React.createElement(AnyModal, { visible: true, title: '' } as any, testContent),
      );

      expect(container.querySelector('h2')).toBeNull();
    });
  });

  describe('4.8. Мемоизация и производительность', () => {
    it('стабильно рендерится с одинаковыми пропсами', () => {
      const { container: container1, rerender } = render(
        React.createElement(AnyModal, { visible: true } as any, testContent),
      );

      const initialHtml = container1.innerHTML;

      rerender(React.createElement(AnyModal, { visible: true } as any, testContent));

      expect(container1.innerHTML).toBe(initialHtml);
    });

    it('перерендеривается при изменении visible', () => {
      const { container, rerender } = render(
        React.createElement(AnyModal, { visible: true } as any, testContent),
      );

      expect(container.querySelector('[data-component="CoreModal"]')).toBeInTheDocument();

      rerender(React.createElement(AnyModal, { visible: false } as any, testContent));

      expect(container.querySelector('[data-component="CoreModal"]')).toBeNull();
    });
  });
});
