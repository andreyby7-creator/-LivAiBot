/**
 * @vitest-environment jsdom
 * @file Unit тесты для DatePicker компонента
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DatePicker } from '../../../src/components/DatePicker.js';
import type { CalendarDay, CalendarMonth } from '../../../src/components/DatePicker.js';

// Полная очистка DOM между тестами
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Функция для изолированного рендера
function renderIsolated(component: Readonly<React.ReactElement>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const result = render(component, { container });

  return {
    ...result,
    container,
    getDatePicker: () => container.querySelector('div[data-component="CoreDatePicker"]')!,
    getInput: () => container.querySelector('input[type="text"]') as HTMLInputElement,
    getToggleButton: () =>
      container.querySelector('button[aria-label="Open calendar"]') as HTMLButtonElement,
    getCalendar: () => container.querySelector('div[role="dialog"]'),
    getNavPrev: () =>
      container.querySelector('button[aria-label="Previous month"]') as HTMLButtonElement,
    getNavNext: () =>
      container.querySelector('button[aria-label="Next month"]') as HTMLButtonElement,
    getDayButtons: () => container.querySelectorAll('button[data-date]'),
    getDayButton: (date: string) =>
      container.querySelector(`button[data-date="${date}"]`) as HTMLButtonElement,
  };
}

// Тестовые данные для календаря
const createTestCalendar = (): CalendarMonth => {
  const week1: readonly CalendarDay[] = [
    { date: '2024-01-01', day: 1, isCurrentMonth: true, isToday: false, isSelected: false },
    { date: '2024-01-02', day: 2, isCurrentMonth: true, isToday: true, isSelected: false },
    { date: '2024-01-03', day: 3, isCurrentMonth: true, isToday: false, isSelected: true },
    {
      date: '2024-01-04',
      day: 4,
      isCurrentMonth: true,
      isToday: false,
      isSelected: false,
      disabled: true,
    },
    { date: '2024-01-05', day: 5, isCurrentMonth: true, isToday: false, isSelected: false },
    { date: '2024-01-06', day: 6, isCurrentMonth: true, isToday: false, isSelected: false },
    { date: '2024-01-07', day: 7, isCurrentMonth: true, isToday: false, isSelected: false },
  ];

  const week2: readonly CalendarDay[] = [
    { date: '2024-01-08', day: 8, isCurrentMonth: true, isToday: false, isSelected: false },
    { date: '2024-01-09', day: 9, isCurrentMonth: true, isToday: false, isSelected: false },
    { date: '2024-01-10', day: 10, isCurrentMonth: true, isToday: false, isSelected: false },
    { date: '2023-12-28', day: 28, isCurrentMonth: false, isToday: false, isSelected: false },
    { date: '2023-12-29', day: 29, isCurrentMonth: false, isToday: false, isSelected: false },
    { date: '2023-12-30', day: 30, isCurrentMonth: false, isToday: false, isSelected: false },
    { date: '2023-12-31', day: 31, isCurrentMonth: false, isToday: false, isSelected: false },
  ];

  return [week1, week2];
};

const testCalendar = createTestCalendar();

// Вынесенные константы для соблюдения ESLint правил
const customStyle = { color: 'red', fontSize: '16px' };
const emptyCalendar: CalendarMonth = [];
const calendarWithEmptyWeeks: CalendarMonth = [[], []];

describe('DatePicker', () => {
  describe('4.1. Рендер и базовая структура', () => {
    it('рендерится без падений с обязательными пропсами', () => {
      const { container, getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} />,
      );

      expect(container).toBeInTheDocument();
      expect(getDatePicker()).toBeInTheDocument();
    });

    it('создает корневой div с правильными атрибутами', () => {
      const { getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} data-testid='test-datepicker' />,
      );

      const datePicker = getDatePicker();
      expect(datePicker).toBeInTheDocument();
      expect(datePicker.tagName).toBe('DIV');
      expect(datePicker).toHaveAttribute('data-component', 'CoreDatePicker');
      expect(datePicker).toHaveAttribute('data-testid', 'test-datepicker');
    });

    it('применяет data-state по умолчанию (closed)', () => {
      const { getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} />,
      );

      expect(getDatePicker()).toHaveAttribute('data-state', 'closed');
    });

    it('применяет data-state=open когда isOpen=true', () => {
      const { getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      expect(getDatePicker()).toHaveAttribute('data-state', 'open');
    });

    it('применяет кастомный data-state', () => {
      const { getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} data-state='custom' />,
      );

      expect(getDatePicker()).toHaveAttribute('data-state', 'custom');
    });
  });

  describe('4.2. Input элемент', () => {
    it('рендерит input с правильными атрибутами', () => {
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} value='2024-01-15' placeholder='Select date' />,
      );

      const input = getInput();
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
      expect(input.type).toBe('text');
      expect(input.value).toBe('2024-01-15');
      expect(input.placeholder).toBe('Select date');
    });

    it('применяет placeholder по умолчанию', () => {
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} />,
      );

      expect(getInput().placeholder).toBe('Select date');
    });

    it('применяет кастомный placeholder', () => {
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} placeholder='Выберите дату' />,
      );

      expect(getInput().placeholder).toBe('Выберите дату');
    });

    it('применяет disabled состояние к input', () => {
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} disabled={true} />,
      );

      expect(getInput().disabled).toBe(true);
    });

    it('применяет ARIA атрибуты к input', () => {
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} data-testid='test-picker' />,
      );

      const input = getInput();
      expect(input).toHaveAttribute('aria-label', 'Date picker input');
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-haspopup', 'dialog');
      expect(input).toHaveAttribute('aria-controls', 'test-picker-calendar');
    });

    it('применяет кастомный aria-label к input', () => {
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} aria-label='Custom label' />,
      );

      expect(getInput().getAttribute('aria-label')).toBe('Custom label');
    });

    it('применяет aria-controls только когда isOpen=true', () => {
      const { getInput: getInputClosed } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={false} data-testid='test-picker' />,
      );

      expect(getInputClosed().getAttribute('aria-controls')).toBeNull();

      const { getInput: getInputOpen } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} data-testid='test-picker' />,
      );

      expect(getInputOpen().getAttribute('aria-controls')).toBe('test-picker-calendar');
    });

    it('применяет data-testid к input', () => {
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} data-testid='test-picker' />,
      );

      expect(getInput().getAttribute('data-testid')).toBe('test-picker-input');
    });

    it('не применяет data-testid к input когда testId не указан', () => {
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} />,
      );

      expect(getInput().getAttribute('data-testid')).toBeNull();
    });
  });

  describe('4.3. Кнопка открытия календаря', () => {
    it('рендерит кнопку открытия календаря', () => {
      const { getToggleButton } = renderIsolated(
        <DatePicker calendar={testCalendar} />,
      );

      expect(getToggleButton()).toBeInTheDocument();
    });

    it('применяет правильные атрибуты к кнопке', () => {
      const { getToggleButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} data-testid='test-picker' />,
      );

      const button = getToggleButton();
      expect(button.type).toBe('button');
      expect(button.getAttribute('aria-label')).toBe('Open calendar');
      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(button.getAttribute('data-testid')).toBe('test-picker-toggle');
    });

    it('применяет disabled состояние к кнопке', () => {
      const { getToggleButton } = renderIsolated(
        <DatePicker calendar={testCalendar} disabled={true} />,
      );

      expect(getToggleButton().disabled).toBe(true);
    });

    it('рендерит SVG иконку в кнопке', () => {
      const { container } = renderIsolated(
        <DatePicker calendar={testCalendar} />,
      );

      const svg = container.querySelector('button[aria-label="Open calendar"] svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute('width')).toBe('16');
      expect(svg?.getAttribute('height')).toBe('16');
    });
  });

  describe('4.4. Календарь', () => {
    it('не рендерит календарь когда isOpen=false', () => {
      const { getCalendar } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={false} />,
      );

      expect(getCalendar()).toBeNull();
    });

    it('рендерит календарь когда isOpen=true', () => {
      const { getCalendar } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      expect(getCalendar()).toBeInTheDocument();
    });

    it('применяет правильные ARIA атрибуты к календарю', () => {
      const { getCalendar } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} data-testid='test-picker' />,
      );

      const calendar = getCalendar();
      expect(calendar?.getAttribute('role')).toBe('dialog');
      expect(calendar?.getAttribute('aria-modal')).toBe('false');
      expect(calendar?.getAttribute('aria-label')).toBe('Calendar');
      expect(calendar?.getAttribute('id')).toBe('test-picker-calendar');
      expect(calendar?.getAttribute('data-testid')).toBe('test-picker-calendar');
    });

    it('использует дефолтный id когда testId не указан', () => {
      const { getCalendar } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      expect(getCalendar()?.getAttribute('id')).toBe('datepicker-calendar');
    });

    it('рендерит заголовки дней недели', () => {
      const { container } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      const calendar = container.querySelector('div[role="dialog"]');
      const weekdays = calendar?.querySelectorAll('div[aria-label]');
      expect(weekdays?.length).toBe(7);
      expect(weekdays?.[0]?.getAttribute('aria-label')).toBe('Sun');
      expect(weekdays?.[1]?.getAttribute('aria-label')).toBe('Mon');
    });

    it('рендерит дни календаря', () => {
      const { getDayButtons } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      const dayButtons = getDayButtons();
      expect(dayButtons.length).toBeGreaterThan(0);
    });

    it('применяет правильные атрибуты к дням', () => {
      const { getDayButton } = renderIsolated(
        <DatePicker
          calendar={testCalendar}
          isOpen={true}
          currentMonthLabel='January 2024'
          data-testid='test-picker'
        />,
      );

      const dayButton = getDayButton('2024-01-01');
      expect(dayButton).toBeInTheDocument();
      expect(dayButton.type).toBe('button');
      expect(dayButton.getAttribute('aria-label')).toBe('1 January 2024');
      expect(dayButton.getAttribute('data-date')).toBe('2024-01-01');
      expect(dayButton.getAttribute('data-testid')).toBe('test-picker-day-2024-01-01');
    });

    it('применяет aria-selected к выбранным дням', () => {
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      const selectedDay = getDayButton('2024-01-03');
      expect(selectedDay.getAttribute('aria-selected')).toBe('true');
    });

    it('не применяет aria-selected к невыбранным дням', () => {
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      const day = getDayButton('2024-01-01');
      expect(day.getAttribute('aria-selected')).toBe('false');
    });

    it('применяет disabled к disabled дням', () => {
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      const disabledDay = getDayButton('2024-01-04');
      expect(disabledDay.disabled).toBe(true);
    });

    it('отображает номер дня в кнопке', () => {
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      const dayButton = getDayButton('2024-01-01');
      expect(dayButton.textContent).toBe('1');
    });
  });

  describe('4.5. Навигация по календарю', () => {
    it('рендерит кнопки навигации', () => {
      const { getNavPrev, getNavNext } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      expect(getNavPrev()).toBeInTheDocument();
      expect(getNavNext()).toBeInTheDocument();
    });

    it('применяет правильные aria-label к кнопкам навигации', () => {
      const { getNavPrev, getNavNext } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} data-testid='test-picker' />,
      );

      expect(getNavPrev().getAttribute('aria-label')).toBe('Previous month');
      expect(getNavNext().getAttribute('aria-label')).toBe('Next month');
      expect(getNavPrev().getAttribute('data-testid')).toBe('test-picker-nav-prev');
      expect(getNavNext().getAttribute('data-testid')).toBe('test-picker-nav-next');
    });

    it('отображает currentMonthLabel', () => {
      const { container } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} currentMonthLabel='January 2024' />,
      );

      const calendar = container.querySelector('div[role="dialog"]');
      const header = calendar?.querySelector('div[style*="display"]');
      const monthLabel = header?.querySelector('div');
      expect(monthLabel?.textContent).toBe('January 2024');
    });

    it('вызывает onNavigate при клике на prev', () => {
      const handleNavigate = vi.fn();
      const { getNavPrev } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} onNavigate={handleNavigate} />,
      );

      const prevButton = getNavPrev();
      fireEvent.click(prevButton);

      expect(handleNavigate).toHaveBeenCalledTimes(1);
      expect(handleNavigate).toHaveBeenCalledWith('prev', expect.any(Object));
    });

    it('вызывает onNavigate при клике на next', () => {
      const handleNavigate = vi.fn();
      const { getNavNext } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} onNavigate={handleNavigate} />,
      );

      const nextButton = getNavNext();
      fireEvent.click(nextButton);

      expect(handleNavigate).toHaveBeenCalledTimes(1);
      expect(handleNavigate).toHaveBeenCalledWith('next', expect.any(Object));
    });

    it('не вызывает onNavigate когда callback не передан', () => {
      const { getNavPrev } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      const prevButton = getNavPrev();
      fireEvent.click(prevButton);

      // Не должно быть ошибок
      expect(prevButton).toBeInTheDocument();
    });
  });

  describe('4.6. Выбор даты', () => {
    it('вызывает onSelectDate при клике на день', () => {
      const handleSelectDate = vi.fn();
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} onSelectDate={handleSelectDate} />,
      );

      const dayButton = getDayButton('2024-01-01');
      fireEvent.click(dayButton);

      expect(handleSelectDate).toHaveBeenCalledTimes(1);
      expect(handleSelectDate).toHaveBeenCalledWith('2024-01-01', expect.any(Object));
    });

    it('не вызывает onSelectDate для disabled дней', () => {
      const handleSelectDate = vi.fn();
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} onSelectDate={handleSelectDate} />,
      );

      const disabledDay = getDayButton('2024-01-04');
      fireEvent.click(disabledDay);

      expect(handleSelectDate).not.toHaveBeenCalled();
    });

    it('не вызывает onSelectDate когда callback не передан', () => {
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      const dayButton = getDayButton('2024-01-01');
      fireEvent.click(dayButton);

      // Не должно быть ошибок
      expect(dayButton).toBeInTheDocument();
    });

    it('вызывает onSelectDate при нажатии Enter на дне', () => {
      const handleSelectDate = vi.fn();
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} onSelectDate={handleSelectDate} />,
      );

      const dayButton = getDayButton('2024-01-01');
      fireEvent.keyDown(dayButton, { key: 'Enter' });

      expect(handleSelectDate).toHaveBeenCalledTimes(1);
      expect(handleSelectDate).toHaveBeenCalledWith('2024-01-01', expect.any(Object));
    });

    it('вызывает onSelectDate при нажатии Space на дне', () => {
      const handleSelectDate = vi.fn();
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} onSelectDate={handleSelectDate} />,
      );

      const dayButton = getDayButton('2024-01-01');
      fireEvent.keyDown(dayButton, { key: ' ' });

      expect(handleSelectDate).toHaveBeenCalledTimes(1);
      expect(handleSelectDate).toHaveBeenCalledWith('2024-01-01', expect.any(Object));
    });

    it('не вызывает onSelectDate для других клавиш', () => {
      const handleSelectDate = vi.fn();
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} onSelectDate={handleSelectDate} />,
      );

      const dayButton = getDayButton('2024-01-01');
      fireEvent.keyDown(dayButton, { key: 'Tab' });

      expect(handleSelectDate).not.toHaveBeenCalled();
    });

    it('не вызывает onSelectDate для disabled дней при нажатии Enter', () => {
      const handleSelectDate = vi.fn();
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} onSelectDate={handleSelectDate} />,
      );

      const disabledDay = getDayButton('2024-01-04');
      fireEvent.keyDown(disabledDay, { key: 'Enter' });

      expect(handleSelectDate).not.toHaveBeenCalled();
    });

    it('не вызывает onSelectDate для disabled дней при нажатии Space', () => {
      const handleSelectDate = vi.fn();
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} onSelectDate={handleSelectDate} />,
      );

      const disabledDay = getDayButton('2024-01-04');
      fireEvent.keyDown(disabledDay, { key: ' ' });

      expect(handleSelectDate).not.toHaveBeenCalled();
    });
  });

  describe('4.7. Input события', () => {
    it('вызывает onChange при изменении значения', () => {
      const handleChange = vi.fn();
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} onChange={handleChange} />,
      );

      const input = getInput();
      fireEvent.change(input, { target: { value: '2024-01-15' } });

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange).toHaveBeenCalledWith('2024-01-15', expect.any(Object));
    });

    it('не вызывает onChange когда callback не передан', () => {
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} />,
      );

      const input = getInput();
      fireEvent.change(input, { target: { value: '2024-01-15' } });

      // Не должно быть ошибок
      expect(input).toBeInTheDocument();
    });
  });

  describe('4.8. Keyboard navigation для input', () => {
    it('вызывает onToggle при нажатии Enter когда календарь закрыт', () => {
      const handleToggle = vi.fn();
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={false} onToggle={handleToggle} />,
      );

      const input = getInput();
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(handleToggle).toHaveBeenCalledTimes(1);
      expect(handleToggle).toHaveBeenCalledWith(true, expect.any(Object));
    });

    it('вызывает onToggle при нажатии Space когда календарь закрыт', () => {
      const handleToggle = vi.fn();
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={false} onToggle={handleToggle} />,
      );

      const input = getInput();
      fireEvent.keyDown(input, { key: ' ' });

      expect(handleToggle).toHaveBeenCalledTimes(1);
      expect(handleToggle).toHaveBeenCalledWith(true, expect.any(Object));
    });

    it('вызывает onToggle при нажатии Escape когда календарь открыт', () => {
      const handleToggle = vi.fn();
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} onToggle={handleToggle} />,
      );

      const input = getInput();
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(handleToggle).toHaveBeenCalledTimes(1);
      expect(handleToggle).toHaveBeenCalledWith(false, expect.any(Object));
    });

    it('не вызывает onToggle при нажатии Escape когда календарь закрыт', () => {
      const handleToggle = vi.fn();
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={false} onToggle={handleToggle} />,
      );

      const input = getInput();
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(handleToggle).not.toHaveBeenCalled();
    });

    it('не вызывает onToggle для других клавиш', () => {
      const handleToggle = vi.fn();
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={false} onToggle={handleToggle} />,
      );

      const input = getInput();
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(handleToggle).not.toHaveBeenCalled();
    });
  });

  describe('4.9. Focus события', () => {
    it('вызывает onToggle при focus когда календарь закрыт и не disabled', () => {
      const handleToggle = vi.fn();
      const { getInput } = renderIsolated(
        <DatePicker
          calendar={testCalendar}
          isOpen={false}
          disabled={false}
          onToggle={handleToggle}
        />,
      );

      const input = getInput();
      fireEvent.focus(input);

      expect(handleToggle).toHaveBeenCalledTimes(1);
      expect(handleToggle).toHaveBeenCalledWith(true, expect.any(Object));
    });

    it('не вызывает onToggle при focus когда disabled', () => {
      const handleToggle = vi.fn();
      const { getInput } = renderIsolated(
        <DatePicker
          calendar={testCalendar}
          isOpen={false}
          disabled={true}
          onToggle={handleToggle}
        />,
      );

      const input = getInput();
      fireEvent.focus(input);

      expect(handleToggle).not.toHaveBeenCalled();
    });

    it('не вызывает onToggle при focus когда календарь уже открыт', () => {
      const handleToggle = vi.fn();
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} onToggle={handleToggle} />,
      );

      const input = getInput();
      fireEvent.focus(input);

      expect(handleToggle).not.toHaveBeenCalled();
    });
  });

  describe('4.10. Toggle кнопка', () => {
    it('вызывает onToggle при клике на кнопку открытия', () => {
      const handleToggle = vi.fn();
      const { getToggleButton } = renderIsolated(
        <DatePicker
          calendar={testCalendar}
          isOpen={false}
          disabled={false}
          onToggle={handleToggle}
        />,
      );

      const button = getToggleButton();
      fireEvent.click(button);

      expect(handleToggle).toHaveBeenCalledTimes(1);
      expect(handleToggle).toHaveBeenCalledWith(true, expect.any(Object));
    });

    it('вызывает onToggle для закрытия при клике когда календарь открыт', () => {
      const handleToggle = vi.fn();
      const { getToggleButton } = renderIsolated(
        <DatePicker
          calendar={testCalendar}
          isOpen={true}
          disabled={false}
          onToggle={handleToggle}
        />,
      );

      const button = getToggleButton();
      fireEvent.click(button);

      expect(handleToggle).toHaveBeenCalledTimes(1);
      expect(handleToggle).toHaveBeenCalledWith(false, expect.any(Object));
    });

    it('не вызывает onToggle когда disabled', () => {
      const handleToggle = vi.fn();
      const { getToggleButton } = renderIsolated(
        <DatePicker
          calendar={testCalendar}
          isOpen={false}
          disabled={true}
          onToggle={handleToggle}
        />,
      );

      const button = getToggleButton();
      fireEvent.click(button);

      expect(handleToggle).not.toHaveBeenCalled();
    });

    it('не вызывает onToggle при клике на кнопку когда disabled и календарь открыт', () => {
      const handleToggle = vi.fn();
      const { getToggleButton } = renderIsolated(
        <DatePicker
          calendar={testCalendar}
          isOpen={true}
          disabled={true}
          onToggle={handleToggle}
        />,
      );

      const button = getToggleButton();
      fireEvent.click(button);

      expect(handleToggle).not.toHaveBeenCalled();
    });
  });

  describe('4.11. Ref forwarding', () => {
    it('передает ref к корневому элементу', () => {
      const ref = React.createRef<HTMLDivElement>();
      const { getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} ref={ref} />,
      );

      expect(ref.current).toBe(getDatePicker());
    });

    it('обновляет ref при изменении', () => {
      const ref = React.createRef<HTMLDivElement>();
      const { rerender, getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} ref={ref} />,
      );

      expect(ref.current).toBe(getDatePicker());

      rerender(<DatePicker calendar={testCalendar} ref={ref} value='2024-01-15' />);

      expect(ref.current).toBe(getDatePicker());
    });
  });

  describe('4.12. HTML атрибуты', () => {
    it('передает className к корневому элементу', () => {
      const { getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} className='custom-class' />,
      );

      expect(getDatePicker()).toHaveClass('custom-class');
    });

    it('передает style к корневому элементу', () => {
      const { getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} style={customStyle} />,
      );

      const datePicker = getDatePicker();
      expect(datePicker).toHaveStyle({ color: 'rgb(255, 0, 0)', fontSize: '16px' });
    });

    it('передает aria-label к корневому элементу', () => {
      const { getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} aria-label='Custom date picker' />,
      );

      expect(getDatePicker()).toHaveAttribute('aria-label', 'Custom date picker');
    });

    it('передает aria-labelledby к корневому элементу', () => {
      const { getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} aria-labelledby='label-id' />,
      );

      expect(getDatePicker()).toHaveAttribute('aria-labelledby', 'label-id');
    });

    it('передает другие HTML атрибуты', () => {
      const { getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} id='test-id' title='Test title' />,
      );

      const datePicker = getDatePicker();
      expect(datePicker).toHaveAttribute('id', 'test-id');
      expect(datePicker).toHaveAttribute('title', 'Test title');
    });
  });

  describe('4.13. Edge cases', () => {
    it('обрабатывает пустой calendar', () => {
      const { getDatePicker } = renderIsolated(
        <DatePicker calendar={emptyCalendar} isOpen={true} />,
      );

      expect(getDatePicker()).toBeInTheDocument();
    });

    it('обрабатывает calendar с пустыми неделями', () => {
      const { getDatePicker } = renderIsolated(
        <DatePicker calendar={calendarWithEmptyWeeks} isOpen={true} />,
      );

      expect(getDatePicker()).toBeInTheDocument();
    });

    it('обрабатывает пустое значение value', () => {
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} value='' />,
      );

      expect(getInput().value).toBe('');
    });

    it('обрабатывает undefined value', () => {
      const { getInput } = renderIsolated(
        <DatePicker calendar={testCalendar} />,
      );

      expect(getInput().value).toBe('');
    });

    it('обрабатывает все состояния дней (disabled, selected, today, other month)', () => {
      const { getDayButton } = renderIsolated(
        <DatePicker calendar={testCalendar} isOpen={true} />,
      );

      const normalDay = getDayButton('2024-01-01');
      const todayDay = getDayButton('2024-01-02');
      const selectedDay = getDayButton('2024-01-03');
      const disabledDay = getDayButton('2024-01-04');
      const otherMonthDay = getDayButton('2023-12-28');

      expect(normalDay).toBeInTheDocument();
      expect(todayDay).toBeInTheDocument();
      expect(selectedDay).toBeInTheDocument();
      expect(disabledDay).toBeInTheDocument();
      expect(otherMonthDay).toBeInTheDocument();
    });
  });

  describe('4.14. Memoization и стабильность', () => {
    it('не пересоздает компонент при неизменных props', () => {
      const { rerender, getDatePicker } = renderIsolated(
        <DatePicker calendar={testCalendar} value='2024-01-15' />,
      );

      const firstRender = getDatePicker();

      rerender(<DatePicker calendar={testCalendar} value='2024-01-15' />);

      const secondRender = getDatePicker();
      // Компонент должен быть мемоизирован, но DOM элемент может быть тем же
      expect(secondRender).toBe(firstRender);
    });
  });
});
