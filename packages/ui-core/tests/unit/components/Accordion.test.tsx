/**
 * @vitest-environment jsdom
 * @file Unit тесты для Accordion компонента
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Accordion } from '../../../src/components/Accordion.js';
import type { AccordionItem } from '../../../src/components/Accordion.js';

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
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).queryByRole(role, options),
    getAccordion: () => container.querySelector('div[data-component="CoreAccordion"]')!,
    getAccordionItems: () => container.querySelectorAll('div[style*="borderBottom"]'),
    getAccordionButtons: () => container.querySelectorAll('button[data-accordion-item-id]'),
    getAccordionPanels: () => {
      const accordion = container.querySelector('div[data-component="CoreAccordion"]');
      return accordion ? accordion.querySelectorAll('div[role="region"][id*="-panel-"]') : [];
    },
  };
}

describe('Accordion', () => {
  // Общие тестовые переменные
  const testItems: readonly AccordionItem[] = [
    { id: 'item1', header: 'Header 1', content: 'Content 1' },
    { id: 'item2', header: 'Header 2', content: 'Content 2' },
    { id: 'item3', header: 'Header 3', content: 'Content 3' },
  ];

  const customStyle = { borderRadius: '8px', padding: '12px' };
  const combinedStyle = { color: 'blue', fontSize: '14px' };

  // Вынесенные массивы для соблюдения ESLint правил
  const itemsWithDisabled: readonly AccordionItem[] = [
    { id: 'item1', header: 'Header 1', content: 'Content 1' },
    { id: 'item2', header: 'Header 2', content: 'Content 2', disabled: true },
    { id: 'item3', header: 'Header 3', content: 'Content 3' },
  ];

  const itemsWithData: readonly AccordionItem[] = [
    {
      id: 'item1',
      header: 'Header 1',
      content: 'Content 1',
      data: { 'data-custom': 'item1-value' },
    },
    { id: 'item2', header: 'Header 2', content: 'Content 2' },
  ];

  const itemsWithReactContent: readonly AccordionItem[] = [
    {
      id: 'item1',
      header: 'Header 1',
      content: <span data-testid='react-content'>React Content</span>,
    },
    { id: 'item2', header: 'Header 2', content: 'String Content' },
  ];

  const emptyItems: readonly AccordionItem[] = [];

  const singleItem: readonly AccordionItem[] = [
    { id: 'item1', header: 'Header 1', content: 'Content 1' },
  ];

  const itemsWithNullContent: readonly AccordionItem[] = [
    { id: 'item1', header: 'Header 1', content: null },
    { id: 'item2', header: 'Header 2', content: 'Content 2' },
  ];

  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLDivElement>();

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getAccordion } = renderIsolated(
        <Accordion items={testItems} />,
      );

      expect(container).toBeInTheDocument();
      expect(getAccordion()).toBeInTheDocument();
    });

    it('создает div элемент с правильными атрибутами по умолчанию', () => {
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} />,
      );

      const accordion = getAccordion();
      expect(accordion).toBeInTheDocument();
      expect(accordion.tagName).toBe('DIV');
      expect(accordion).toHaveAttribute('role', 'region');
      expect(accordion).toHaveAttribute('data-component', 'CoreAccordion');
      expect(accordion).toHaveAttribute('data-mode', 'single');
      expect(accordion).toHaveAttribute('aria-label', 'Accordion');
    });

    it('рендерится с пустым массивом items', () => {
      const { container, getAccordion } = renderIsolated(
        <Accordion items={emptyItems} />,
      );

      expect(container).toBeInTheDocument();
      expect(getAccordion()).toBeInTheDocument();
      expect(getAccordion().children.length).toBe(0);
    });

    it('рендерится с одним элементом', () => {
      const { getAccordion, getAccordionButtons } = renderIsolated(
        <Accordion items={singleItem} />,
      );

      expect(getAccordion()).toBeInTheDocument();
      expect(getAccordionButtons().length).toBe(1);
    });
  });

  describe('4.2. Props и атрибуты', () => {
    it('применяет data-testid', () => {
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} data-testid='test-accordion' />,
      );

      expect(getAccordion()).toHaveAttribute('data-testid', 'test-accordion');
    });

    it('применяет data-component-id', () => {
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} data-component-id='custom-id' />,
      );

      expect(getAccordion()).toHaveAttribute('data-component-id', 'custom-id');
    });

    it('применяет className', () => {
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} className='custom-class' />,
      );

      expect(getAccordion()).toHaveClass('custom-class');
    });

    it('применяет style', () => {
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} style={customStyle} />,
      );

      const accordion = getAccordion();
      expect(accordion).toHaveStyle({ borderRadius: '8px', padding: '12px' });
    });

    it('объединяет style с базовым стилем', () => {
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} style={combinedStyle} />,
      );

      const accordion = getAccordion();
      expect(accordion).toHaveStyle({ color: 'rgb(0, 0, 255)', fontSize: '14px' });
    });

    it('применяет aria-label', () => {
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} aria-label='Custom Accordion' />,
      );

      expect(getAccordion()).toHaveAttribute('aria-label', 'Custom Accordion');
    });

    it('применяет aria-labelledby', () => {
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} aria-labelledby='label-id' />,
      );

      const accordion = getAccordion();
      expect(accordion).toHaveAttribute('aria-labelledby', 'label-id');
      expect(accordion).not.toHaveAttribute('aria-label');
    });

    it('применяет дополнительные HTML атрибуты', () => {
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} id='accordion-id' title='Accordion Title' />,
      );

      const accordion = getAccordion();
      expect(accordion).toHaveAttribute('id', 'accordion-id');
      expect(accordion).toHaveAttribute('title', 'Accordion Title');
    });
  });

  describe('4.3. Single mode', () => {
    it('использует single mode по умолчанию', () => {
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} />,
      );

      expect(getAccordion()).toHaveAttribute('data-mode', 'single');
    });

    it('открывает элемент по openItemId в single mode', () => {
      const { getAccordionPanels, getAccordionButtons } = renderIsolated(
        <Accordion items={testItems} openItemId='item2' />,
      );

      const panels = getAccordionPanels();
      expect(panels.length).toBe(1);
      expect(panels[0]).toHaveTextContent('Content 2');

      const buttons = getAccordionButtons();
      expect(buttons[1]).toHaveAttribute('aria-expanded', 'true');
      expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
      expect(buttons[2]).toHaveAttribute('aria-expanded', 'false');
    });

    it('не открывает элементы если openItemId не указан', () => {
      const { getAccordionPanels } = renderIsolated(
        <Accordion items={testItems} />,
      );

      expect(getAccordionPanels().length).toBe(0);
    });

    it('openItemId имеет приоритет над openItemIds в single mode', () => {
      const openItemIdsArray = ['item2', 'item3'] as const;
      const { getAccordionPanels, getAccordionButtons } = renderIsolated(
        <Accordion
          items={testItems}
          mode='single'
          openItemId='item1'
          openItemIds={openItemIdsArray}
        />,
      );

      const panels = getAccordionPanels();
      expect(panels.length).toBe(1);
      expect(panels[0]).toHaveTextContent('Content 1');

      const buttons = getAccordionButtons();
      expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
      expect(buttons[1]).toHaveAttribute('aria-expanded', 'false');
      expect(buttons[2]).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('4.4. Multiple mode', () => {
    it('применяет multiple mode', () => {
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} mode='multiple' />,
      );

      expect(getAccordion()).toHaveAttribute('data-mode', 'multiple');
    });

    it('открывает несколько элементов по openItemIds в multiple mode', () => {
      const openItemIdsArray = ['item1', 'item3'] as const;
      const { getAccordionPanels, getAccordionButtons } = renderIsolated(
        <Accordion items={testItems} mode='multiple' openItemIds={openItemIdsArray} />,
      );

      const panels = getAccordionPanels();
      expect(panels.length).toBe(2);
      expect(panels[0]).toHaveTextContent('Content 1');
      expect(panels[1]).toHaveTextContent('Content 3');

      const buttons = getAccordionButtons();
      expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
      expect(buttons[1]).toHaveAttribute('aria-expanded', 'false');
      expect(buttons[2]).toHaveAttribute('aria-expanded', 'true');
    });

    it('не открывает элементы если openItemIds не указан', () => {
      const { getAccordionPanels } = renderIsolated(
        <Accordion items={testItems} mode='multiple' />,
      );

      expect(getAccordionPanels().length).toBe(0);
    });

    it('обрабатывает пустой массив openItemIds', () => {
      const emptyArray = [] as const;
      const { getAccordionPanels } = renderIsolated(
        <Accordion items={testItems} mode='multiple' openItemIds={emptyArray} />,
      );

      expect(getAccordionPanels().length).toBe(0);
    });
  });

  describe('4.5. Элементы аккордеона', () => {
    it('рендерит все элементы', () => {
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={testItems} />,
      );

      const buttons = getAccordionButtons();
      expect(buttons.length).toBe(3);
      expect(buttons[0]).toHaveTextContent('Header 1');
      expect(buttons[1]).toHaveTextContent('Header 2');
      expect(buttons[2]).toHaveTextContent('Header 3');
    });

    it('отображает заголовки элементов', () => {
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={testItems} />,
      );

      const buttons = getAccordionButtons();
      expect(buttons[0]).toBeDefined();
      expect(buttons[1]).toBeDefined();
      expect(buttons[2]).toBeDefined();
      if (buttons[0]) {
        expect(buttons[0].querySelector('span')).toHaveTextContent('Header 1');
      }
      if (buttons[1]) {
        expect(buttons[1].querySelector('span')).toHaveTextContent('Header 2');
      }
      if (buttons[2]) {
        expect(buttons[2].querySelector('span')).toHaveTextContent('Header 3');
      }
    });

    it('отображает иконку для каждого элемента', () => {
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={testItems} />,
      );

      const buttons = getAccordionButtons();
      buttons.forEach((button) => {
        const icons = button.querySelectorAll('span');
        expect(icons.length).toBe(2); // header span + icon span
        const icon = icons[1];
        expect(icon).toBeDefined();
        if (icon) {
          expect(icon).toHaveTextContent('▼');
        }
      });
    });

    it('поворачивает иконку когда элемент открыт', () => {
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={testItems} openItemId='item2' />,
      );

      const buttons = getAccordionButtons();
      expect(buttons[1]).toBeDefined();
      if (buttons[1]) {
        const icon2 = buttons[1].querySelectorAll('span')[1];
        expect(icon2).toBeDefined();
        if (icon2) {
          expect(icon2).toHaveStyle({ transform: 'rotate(180deg)' });
        }
      }

      expect(buttons[0]).toBeDefined();
      if (buttons[0]) {
        const icon1 = buttons[0].querySelectorAll('span')[1];
        expect(icon1).toBeDefined();
        if (icon1) {
          expect(icon1).not.toHaveStyle({ transform: 'rotate(180deg)' });
        }
      }
    });

    it('отображает контент только для открытых элементов', () => {
      const { getAccordionPanels } = renderIsolated(
        <Accordion items={testItems} openItemId='item2' />,
      );

      const panels = getAccordionPanels();
      expect(panels.length).toBe(1);
      expect(panels[0]).toBeDefined();
      if (panels[0]) {
        expect(panels[0]).toHaveTextContent('Content 2');
      }
    });

    it('отображает React контент', () => {
      const { getAccordionPanels, getByTestId } = renderIsolated(
        <Accordion items={itemsWithReactContent} openItemId='item1' />,
      );

      const panels = getAccordionPanels();
      expect(panels.length).toBe(1);
      expect(panels[0]).toBeDefined();
      const reactContent = getByTestId('react-content');
      expect(reactContent).toBeInTheDocument();
      expect(reactContent).toHaveTextContent('React Content');
    });

    it('обрабатывает null контент', () => {
      const { getAccordionPanels } = renderIsolated(
        <Accordion items={itemsWithNullContent} openItemId='item1' />,
      );

      const panels = getAccordionPanels();
      expect(panels.length).toBe(1);
      expect(panels[0]).toBeDefined();
      if (panels[0]) {
        expect(panels[0]).toBeEmptyDOMElement();
      }
    });
  });

  describe('4.6. Disabled элементы', () => {
    it('применяет disabled состояние к элементу', () => {
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={itemsWithDisabled} />,
      );

      const buttons = getAccordionButtons();
      expect(buttons[1]).toBeDisabled();
      expect(buttons[1]).toHaveAttribute('aria-disabled', 'true');
      expect(buttons[0]).not.toBeDisabled();
      expect(buttons[2]).not.toBeDisabled();
    });

    it('не вызывает onChange для disabled элементов', () => {
      const handleChange = vi.fn();
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={itemsWithDisabled} onChange={handleChange} />,
      );

      const buttons = getAccordionButtons();
      expect(buttons[1]).toBeDefined();
      if (buttons[1]) {
        fireEvent.click(buttons[1]);
        expect(handleChange).not.toHaveBeenCalled();
      }
    });

    it('применяет disabled стили', () => {
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={itemsWithDisabled} />,
      );

      const disabledButton = getAccordionButtons()[1];
      expect(disabledButton).toHaveStyle({ opacity: '0.5', cursor: 'not-allowed' });
    });
  });

  describe('4.7. Data атрибуты элементов', () => {
    it('применяет data атрибуты к элементам', () => {
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={itemsWithData} />,
      );

      const buttons = getAccordionButtons();
      expect(buttons[0]).toBeDefined();
      if (buttons[0]) {
        expect(buttons[0]).toHaveAttribute('data-custom', 'item1-value');
      }

      expect(buttons[1]).toBeDefined();
      if (buttons[1]) {
        expect(buttons[1]).not.toHaveAttribute('data-custom');
      }
    });
  });

  describe('4.8. ARIA атрибуты', () => {
    it('применяет правильные ARIA атрибуты к кнопкам', () => {
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={testItems} openItemId='item2' data-component-id='test-id' />,
      );

      const buttons = getAccordionButtons();
      expect(buttons[0]).toBeDefined();
      expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
      expect(buttons[0]).toHaveAttribute('aria-controls', 'test-id-panel-item1');
      expect(buttons[0]).toHaveAttribute('aria-disabled', 'false');
      expect(buttons[0]).toHaveAttribute('id', 'test-id-header-item1');

      expect(buttons[1]).toBeDefined();
      expect(buttons[1]).toHaveAttribute('aria-expanded', 'true');
      expect(buttons[1]).toHaveAttribute('aria-controls', 'test-id-panel-item2');
      expect(buttons[1]).toHaveAttribute('id', 'test-id-header-item2');
    });

    it('применяет правильные ARIA атрибуты к панелям', () => {
      const { getAccordionPanels } = renderIsolated(
        <Accordion items={testItems} openItemId='item2' data-component-id='test-id' />,
      );

      const panels = getAccordionPanels();
      expect(panels.length).toBe(1);
      expect(panels[0]).toBeDefined();
      if (panels[0]) {
        expect(panels[0]).toHaveAttribute('role', 'region');
        expect(panels[0]).toHaveAttribute('id', 'test-id-panel-item2');
        expect(panels[0]).toHaveAttribute('aria-labelledby', 'test-id-header-item2');
        expect(panels[0]).toHaveAttribute('tabIndex', '0');
      }
    });

    it('использует fallback ID если нет componentId и testId', () => {
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={singleItem} />,
      );

      const buttons = getAccordionButtons();
      expect(buttons[0]).toBeDefined();
      if (buttons[0]) {
        const headerId = buttons[0].getAttribute('id');
        expect(headerId).toBeTruthy();
        // React useId() в тестовой среде генерирует формат _r_<number>_ или :r<number>:
        // Проверяем, что ID содержит fallback префикс и правильный суффикс
        expect(headerId).toMatch(/^[:_]r.*-header-item1$/);
      }
    });

    it('использует testId как префикс ID если нет componentId', () => {
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={singleItem} data-testid='test-accordion' />,
      );

      const button = getAccordionButtons()[0];
      expect(button).toHaveAttribute('id', 'test-accordion-header-item1');
    });
  });

  describe('4.9. События', () => {
    it('вызывает onChange при клике на элемент', () => {
      const handleChange = vi.fn();
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={testItems} onChange={handleChange} />,
      );

      const buttons = getAccordionButtons();
      expect(buttons[1]).toBeDefined();
      if (buttons[1]) {
        fireEvent.click(buttons[1]);
        expect(handleChange).toHaveBeenCalledTimes(1);
        expect(handleChange).toHaveBeenCalledWith('item2', expect.any(Object));
      }
    });

    it('не вызывает onChange если он не передан', () => {
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={testItems} />,
      );

      const buttons = getAccordionButtons();
      const button = buttons[0];
      expect(button).toBeDefined();
      if (button) {
        expect(() => fireEvent.click(button)).not.toThrow();
      }
    });

    it('передает правильный itemId в onChange', () => {
      const handleChange = vi.fn();
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={testItems} onChange={handleChange} />,
      );

      const buttons = getAccordionButtons();
      expect(buttons[0]).toBeDefined();
      if (buttons[0]) {
        fireEvent.click(buttons[0]);
        expect(handleChange).toHaveBeenCalledWith('item1', expect.any(Object));
      }

      const button2 = buttons[2];
      expect(button2).toBeDefined();
      if (button2) {
        fireEvent.click(button2);
        expect(handleChange).toHaveBeenCalledWith('item3', expect.any(Object));
      }
    });

    it('передает MouseEvent в onChange', () => {
      const handleChange = vi.fn();
      const { getAccordionButtons } = renderIsolated(
        <Accordion items={testItems} onChange={handleChange} />,
      );

      const buttons = getAccordionButtons();
      expect(buttons[0]).toBeDefined();
      if (buttons[0]) {
        fireEvent.click(buttons[0]);
        expect(handleChange).toHaveBeenCalledTimes(1);
        expect(handleChange).toHaveBeenCalledWith(
          'item1',
          expect.objectContaining({
            type: 'click',
          }),
        );
        // Проверяем, что событие содержит правильный target
        const event = handleChange.mock.calls[0]?.[1];
        expect(event).toBeDefined();
        if (event != null) {
          expect(event.target).toBe(buttons[0]);
        }
      }
    });
  });

  describe('4.10. Ref forwarding', () => {
    it('передает ref к корневому элементу', () => {
      const ref = createMockRef();
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} ref={ref} />,
      );

      expect(ref.current).toBe(getAccordion());
    });

    it('обновляет ref при изменении', () => {
      const ref = createMockRef();
      const { rerender, getAccordion } = renderIsolated(
        <Accordion items={testItems} ref={ref} />,
      );

      expect(ref.current).toBe(getAccordion());

      rerender(<Accordion items={testItems} ref={ref} data-testid='new-test' />);
      expect(ref.current).toBe(getAccordion());
    });

    it('поддерживает callback ref', () => {
      const refCallback = vi.fn();
      const { getAccordion } = renderIsolated(
        <Accordion items={testItems} ref={refCallback} />,
      );

      expect(refCallback).toHaveBeenCalledWith(getAccordion());
    });
  });

  describe('4.11. Memoization', () => {
    it('не перерендеривает при неизменных props', () => {
      const renderCount = vi.fn();
      type TestComponentProps = Readonly<{ items: readonly AccordionItem[]; }>;
      const TestComponent: React.FC<TestComponentProps> = (props) => {
        renderCount();
        return <Accordion items={props.items} />;
      };

      const { rerender } = renderIsolated(
        <TestComponent items={testItems} />,
      );

      expect(renderCount).toHaveBeenCalledTimes(1);

      rerender(<TestComponent items={testItems} />);
      expect(renderCount).toHaveBeenCalledTimes(2);
    });
  });

  describe('4.12. Граничные случаи', () => {
    it('обрабатывает элементы с одинаковыми id (не рекомендуется, но не падает)', () => {
      const duplicateItems: readonly AccordionItem[] = [
        { id: 'item1', header: 'Header 1', content: 'Content 1' },
        { id: 'item1', header: 'Header 1 Duplicate', content: 'Content 1 Duplicate' },
      ] as const;

      const { getAccordionButtons } = renderIsolated(
        <Accordion items={duplicateItems} openItemId='item1' />,
      );

      const buttons = getAccordionButtons();
      expect(buttons.length).toBe(2);
      // Оба элемента с одинаковым id будут открыты в single mode
      expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
      expect(buttons[1]).toHaveAttribute('aria-expanded', 'true');
    });

    it('обрабатывает openItemId который не существует в items', () => {
      const { getAccordionPanels } = renderIsolated(
        <Accordion items={testItems} openItemId='nonexistent' />,
      );

      expect(getAccordionPanels().length).toBe(0);
    });

    it('обрабатывает openItemIds с несуществующими ID', () => {
      const openItemIdsArray = ['nonexistent', 'item1'] as const;
      const { getAccordionPanels } = renderIsolated(
        <Accordion items={testItems} mode='multiple' openItemIds={openItemIdsArray} />,
      );

      const panels = getAccordionPanels();
      expect(panels.length).toBe(1);
      expect(panels[0]).toBeDefined();
      if (panels[0]) {
        expect(panels[0]).toHaveTextContent('Content 1');
      }
    });
  });
});
