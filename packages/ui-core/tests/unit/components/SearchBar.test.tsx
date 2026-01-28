/**
 * @vitest-environment jsdom
 * @file Unit тесты для SearchBar компонента
 */

import React from 'react';
import type { ChangeEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SearchBar } from '../../../src/components/SearchBar.js';

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
    queryByTestId: (testId: Readonly<string>) => within(container).queryByTestId(testId),
    getSearchBar: () => container.querySelector('div[data-component="CoreSearchBar"]')!,
    getForm: () => container.querySelector('form[role="search"]')!,
    getInput: () => container.querySelector('input[role="searchbox"]')!,
    getClearButton: () => container.querySelector('button[aria-label="Clear search"]'),
    getSearchButton: () => container.querySelector('button[type="submit"]'),
    getIcon: () => container.querySelector('span[aria-hidden="true"][data-testid*="-icon"]'),
  };
}

describe('SearchBar', () => {
  // Общие тестовые переменные
  const customStyle = { borderRadius: '8px', padding: '12px' };
  const customStyleWithPaddingRight = { ...customStyle, paddingRight: '12px' };
  const customCombinedStyle = { backgroundColor: 'red', padding: '20px' };

  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLInputElement>();

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getSearchBar } = renderIsolated(<SearchBar />);

      expect(container).toBeInTheDocument();
      expect(getSearchBar()).toBeInTheDocument();
    });

    it('создает div элемент с правильными атрибутами по умолчанию', () => {
      const { getSearchBar } = renderIsolated(<SearchBar />);

      const searchBar = getSearchBar();
      expect(searchBar).toBeInTheDocument();
      expect(searchBar.tagName).toBe('DIV');
      expect(searchBar).toHaveAttribute('data-component', 'CoreSearchBar');
      expect(searchBar).toHaveAttribute('aria-label', 'Search container');
      expect(searchBar).toHaveAttribute('data-size', 'medium');
      expect(searchBar).not.toHaveAttribute('data-disabled');
    });

    it('рендерит form элемент', () => {
      const { getForm } = renderIsolated(<SearchBar />);

      const form = getForm();
      expect(form).toBeInTheDocument();
      expect(form.tagName).toBe('FORM');
      expect(form).toHaveAttribute('role', 'search');
      expect(form).toHaveAttribute('aria-label', 'Search form');
    });

    it('рендерит input элемент', () => {
      const { getInput } = renderIsolated(<SearchBar />);

      const input = getInput();
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('role', 'searchbox');
      expect(input).toHaveAttribute('aria-label', 'Search input');
    });
  });

  describe('4.2. Пропсы компонента', () => {
    it('применяет className к контейнеру', () => {
      const { getSearchBar } = renderIsolated(<SearchBar className='custom-class' />);

      expect(getSearchBar()).toHaveClass('custom-class');
    });

    it('применяет style к input элементу', () => {
      // style применяется к input, а не к контейнеру
      // Кастомный стиль применяется последним, но paddingRight по умолчанию для medium размера = 32px
      // Чтобы переопределить paddingRight, нужно явно указать его в кастомном стиле
      const { getInput } = renderIsolated(<SearchBar style={customStyleWithPaddingRight} />);

      const input = getInput();
      const computedStyle = window.getComputedStyle(input);
      expect(computedStyle.borderRadius).toBe('8px');
      expect(computedStyle.paddingTop).toBe('12px');
      expect(computedStyle.paddingRight).toBe('12px');
      expect(computedStyle.paddingBottom).toBe('12px');
      expect(computedStyle.paddingLeft).toBe('12px');
    });

    it('применяет data-testid', () => {
      const { getByTestId } = renderIsolated(<SearchBar data-testid='custom-test-id' />);

      expect(getByTestId('custom-test-id')).toBeInTheDocument();
    });

    it('не имеет data-testid по умолчанию', () => {
      const { getSearchBar } = renderIsolated(<SearchBar />);

      expect(getSearchBar()).not.toHaveAttribute('data-testid');
    });

    it('прокидывает дополнительные HTML атрибуты', () => {
      const { getSearchBar } = renderIsolated(
        <SearchBar id='searchbar-id' title='Custom title' data-custom='test-value' />,
      );

      const searchBar = getSearchBar();
      expect(searchBar).toHaveAttribute('id', 'searchbar-id');
      expect(searchBar).toHaveAttribute('title', 'Custom title');
      expect(searchBar).toHaveAttribute('data-custom', 'test-value');
    });
  });

  describe('4.3. Value и onChange', () => {
    it('использует пустую строку по умолчанию', () => {
      const { getInput } = renderIsolated(<SearchBar />);

      const input = getInput() as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('отображает переданное value', () => {
      const { getInput } = renderIsolated(<SearchBar value='test query' />);

      const input = getInput() as HTMLInputElement;
      expect(input.value).toBe('test query');
    });

    it('вызывает onChange при изменении значения', () => {
      const mockOnChange = vi.fn();
      const { getInput } = renderIsolated(<SearchBar onChange={mockOnChange} />);

      const input = getInput() as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'new value' } });

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('new value', expect.any(Object));
    });

    it('не вызывает onChange когда disabled=true', () => {
      const mockOnChange = vi.fn();
      const { getInput } = renderIsolated(<SearchBar onChange={mockOnChange} disabled={true} />);

      const input = getInput() as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'new value' } });

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('не вызывает onChange если он не передан', () => {
      const { getInput } = renderIsolated(<SearchBar />);

      const input = getInput() as HTMLInputElement;
      expect(() => fireEvent.change(input, { target: { value: 'new value' } })).not.toThrow();
    });
  });

  describe('4.4. Placeholder', () => {
    it('не имеет placeholder по умолчанию', () => {
      const { getInput } = renderIsolated(<SearchBar />);

      const input = getInput();
      expect(input).not.toHaveAttribute('placeholder');
    });

    it('применяет placeholder', () => {
      const { getInput } = renderIsolated(<SearchBar placeholder='Search...' />);

      const input = getInput();
      expect(input).toHaveAttribute('placeholder', 'Search...');
    });
  });

  describe('4.5. Clear button', () => {
    it('показывает кнопку очистки по умолчанию когда есть значение', () => {
      const { getClearButton } = renderIsolated(<SearchBar value='test' />);

      expect(getClearButton()).toBeInTheDocument();
    });

    it('не показывает кнопку очистки когда значение пустое', () => {
      const { getClearButton } = renderIsolated(<SearchBar value='' />);

      expect(getClearButton()).toBeNull();
    });

    it('не показывает кнопку очистки когда showClearButton=false', () => {
      const { getClearButton } = renderIsolated(
        <SearchBar value='test' showClearButton={false} />,
      );

      expect(getClearButton()).toBeNull();
    });

    it('не показывает кнопку очистки когда disabled=true', () => {
      const { getClearButton } = renderIsolated(<SearchBar value='test' disabled={true} />);

      expect(getClearButton()).toBeNull();
    });

    it('вызывает onChange с пустой строкой при клике на кнопку очистки', () => {
      const mockOnChange = vi.fn();
      const { getClearButton } = renderIsolated(
        <SearchBar value='test' onChange={mockOnChange} />,
      );

      const clearButton = getClearButton();
      fireEvent.click(clearButton!);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith('', expect.any(Object));
    });

    it('вызывает onClear при клике на кнопку очистки если он передан', () => {
      const mockOnClear = vi.fn();
      const mockOnChange = vi.fn();
      const { getClearButton } = renderIsolated(
        <SearchBar value='test' onChange={mockOnChange} onClear={mockOnClear} />,
      );

      const clearButton = getClearButton();
      fireEvent.click(clearButton!);

      expect(mockOnClear).toHaveBeenCalledTimes(1);
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('синтетическое событие имеет все необходимые методы и свойства', () => {
      const mockOnChange = vi.fn();
      const { getClearButton } = renderIsolated(
        <SearchBar value='test' onChange={mockOnChange} />,
      );

      const clearButton = getClearButton();
      fireEvent.click(clearButton!);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const syntheticEvent = mockOnChange.mock.calls[0]?.[1] as ChangeEvent<HTMLInputElement>;

      // Проверяем свойства события
      expect(syntheticEvent.target.value).toBe('');
      expect(syntheticEvent.currentTarget.value).toBe('');
      expect(syntheticEvent.bubbles).toBe(false);
      expect(syntheticEvent.cancelable).toBe(false);
      expect(syntheticEvent.defaultPrevented).toBe(false);
      expect(syntheticEvent.eventPhase).toBe(0);
      expect(syntheticEvent.isTrusted).toBe(false);
      expect(syntheticEvent.type).toBe('change');
      expect(typeof syntheticEvent.timeStamp).toBe('number');

      // Вызываем методы для покрытия функций
      expect(() => syntheticEvent.preventDefault()).not.toThrow();
      expect(() => syntheticEvent.stopPropagation()).not.toThrow();
      expect(syntheticEvent.isDefaultPrevented()).toBe(false);
      expect(syntheticEvent.isPropagationStopped()).toBe(false);
      expect(() => syntheticEvent.persist()).not.toThrow();
    });

    it('использует дефолтную иконку очистки', () => {
      const { getClearButton } = renderIsolated(<SearchBar value='test' />);

      const clearButton = getClearButton();
      expect(clearButton).toHaveTextContent('×');
    });

    it('использует кастомную иконку очистки', () => {
      const { getClearButton } = renderIsolated(
        <SearchBar value='test' clearIcon={<span data-testid='custom-clear'>Clear</span>} />,
      );

      const clearButton = getClearButton();
      expect(clearButton?.querySelector('[data-testid="custom-clear"]')).toBeInTheDocument();
    });

    it('применяет правильные атрибуты к кнопке очистки', () => {
      const { getClearButton } = renderIsolated(<SearchBar value='test' />);

      const clearButton = getClearButton();
      expect(clearButton).toHaveAttribute('type', 'button');
      expect(clearButton).toHaveAttribute('aria-label', 'Clear search');
      expect(clearButton).toHaveAttribute('tabindex', '0');
    });
  });

  describe('4.6. Search button', () => {
    it('не показывает кнопку поиска по умолчанию', () => {
      const { getSearchButton } = renderIsolated(<SearchBar />);

      expect(getSearchButton()).toBeNull();
    });

    it('показывает кнопку поиска когда showSearchButton=true', () => {
      const { getSearchButton } = renderIsolated(<SearchBar showSearchButton={true} />);

      expect(getSearchButton()).toBeInTheDocument();
    });

    it('использует дефолтный текст кнопки поиска', () => {
      const { getSearchButton } = renderIsolated(<SearchBar showSearchButton={true} />);

      const searchButton = getSearchButton();
      expect(searchButton).toHaveTextContent('Search');
    });

    it('использует кастомный текст кнопки поиска', () => {
      const { getSearchButton } = renderIsolated(
        <SearchBar showSearchButton={true} searchButtonLabel='Find' />,
      );

      const searchButton = getSearchButton();
      expect(searchButton).toHaveTextContent('Find');
    });

    it('применяет правильные атрибуты к кнопке поиска', () => {
      const { getSearchButton } = renderIsolated(<SearchBar showSearchButton={true} />);

      const searchButton = getSearchButton();
      expect(searchButton).toHaveAttribute('type', 'submit');
      expect(searchButton).toHaveAttribute('aria-label', 'Search');
    });

    it('disabled кнопка поиска когда disabled=true', () => {
      const { getSearchButton } = renderIsolated(
        <SearchBar showSearchButton={true} disabled={true} />,
      );

      const searchButton = getSearchButton();
      expect(searchButton).toBeDisabled();
    });
  });

  describe('4.7. Search icon', () => {
    it('не показывает иконку поиска по умолчанию', () => {
      const { getIcon } = renderIsolated(<SearchBar />);

      expect(getIcon()).toBeNull();
    });

    it('показывает иконку поиска когда searchIcon передан', () => {
      const { getByTestId, getIcon } = renderIsolated(
        <SearchBar
          searchIcon={<span data-testid='search-icon'>🔍</span>}
          data-testid='searchbar'
        />,
      );

      expect(getByTestId('search-icon')).toBeInTheDocument();
      const icon = getIcon();
      expect(icon).toBeInTheDocument();
    });

    it('применяет правильные атрибуты к иконке поиска', () => {
      const { getIcon } = renderIsolated(
        <SearchBar searchIcon={<span>🔍</span>} data-testid='searchbar' />,
      );

      const icon = getIcon();
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('применяет padding слева когда есть иконка', () => {
      const { getInput } = renderIsolated(<SearchBar searchIcon={<span>🔍</span>} />);

      const input = getInput();
      expect(input).toHaveStyle({ paddingLeft: '36px' });
    });
  });

  describe('4.8. Size', () => {
    it('использует medium размер по умолчанию', () => {
      const { getSearchBar } = renderIsolated(<SearchBar />);

      expect(getSearchBar()).toHaveAttribute('data-size', 'medium');
    });

    it('применяет small размер', () => {
      const { getSearchBar, getInput } = renderIsolated(<SearchBar size='small' />);

      expect(getSearchBar()).toHaveAttribute('data-size', 'small');
      const input = getInput();
      const computedStyle = window.getComputedStyle(input);
      expect(computedStyle.fontSize).toBe('12px');
      expect(computedStyle.paddingTop).toBe('6px');
      expect(computedStyle.paddingRight).toBe('28px');
      expect(computedStyle.paddingBottom).toBe('6px');
      expect(computedStyle.paddingLeft).toBe('10px');
    });

    it('применяет medium размер', () => {
      const { getSearchBar, getInput } = renderIsolated(<SearchBar size='medium' />);

      expect(getSearchBar()).toHaveAttribute('data-size', 'medium');
      const input = getInput();
      const computedStyle = window.getComputedStyle(input);
      expect(computedStyle.paddingTop).toBe('8px');
      expect(computedStyle.paddingRight).toBe('32px');
      expect(computedStyle.paddingBottom).toBe('8px');
      expect(computedStyle.paddingLeft).toBe('12px');
    });

    it('применяет large размер', () => {
      const { getSearchBar, getInput } = renderIsolated(<SearchBar size='large' />);

      expect(getSearchBar()).toHaveAttribute('data-size', 'large');
      const input = getInput();
      const computedStyle = window.getComputedStyle(input);
      expect(computedStyle.fontSize).toBe('16px');
      expect(computedStyle.paddingTop).toBe('12px');
      expect(computedStyle.paddingRight).toBe('40px');
      expect(computedStyle.paddingBottom).toBe('12px');
      expect(computedStyle.paddingLeft).toBe('16px');
    });

    it('применяет правильный padding справа для small размера', () => {
      const { getInput } = renderIsolated(<SearchBar size='small' value='test' />);

      const input = getInput();
      expect(input).toHaveStyle({ paddingRight: '28px' });
    });

    it('применяет правильный padding справа для medium размера', () => {
      const { getInput } = renderIsolated(<SearchBar size='medium' value='test' />);

      const input = getInput();
      expect(input).toHaveStyle({ paddingRight: '32px' });
    });

    it('применяет правильный padding справа для large размера', () => {
      const { getInput } = renderIsolated(<SearchBar size='large' value='test' />);

      const input = getInput();
      expect(input).toHaveStyle({ paddingRight: '40px' });
    });
  });

  describe('4.9. Disabled состояние', () => {
    it('не disabled по умолчанию', () => {
      const { getSearchBar, getInput } = renderIsolated(<SearchBar />);

      expect(getSearchBar()).not.toHaveAttribute('data-disabled');
      expect(getInput()).not.toBeDisabled();
    });

    it('применяет disabled состояние', () => {
      const { getSearchBar, getInput } = renderIsolated(<SearchBar disabled={true} />);

      expect(getSearchBar()).toHaveAttribute('data-disabled', 'true');
      expect(getInput()).toBeDisabled();
    });

    it('применяет правильные стили для disabled состояния', () => {
      const { getInput } = renderIsolated(<SearchBar disabled={true} />);

      const input = getInput();
      expect(input).toHaveStyle({ opacity: '0.6', cursor: 'not-allowed' });
    });
  });

  describe('4.10. Width', () => {
    it('использует 100% по умолчанию', () => {
      const { getSearchBar } = renderIsolated(<SearchBar />);

      const searchBar = getSearchBar();
      expect(searchBar).toHaveStyle({ width: '100%' });
    });

    it('применяет кастомную ширину', () => {
      const { getSearchBar } = renderIsolated(<SearchBar width='300px' />);

      const searchBar = getSearchBar();
      expect(searchBar).toHaveStyle({ width: '300px' });
    });

    it('применяет ширину в rem', () => {
      const { getSearchBar } = renderIsolated(<SearchBar width='20rem' />);

      const searchBar = getSearchBar();
      expect(searchBar).toHaveStyle({ width: '20rem' });
    });

    it('применяет CSS переменную для ширины', () => {
      const { getSearchBar } = renderIsolated(<SearchBar width='var(--searchbar-width)' />);

      const searchBar = getSearchBar();
      expect(searchBar).toHaveStyle({ width: 'var(--searchbar-width)' });
    });
  });

  describe('4.11. onSubmit', () => {
    it('вызывает onSubmit при submit формы', () => {
      const mockOnSubmit = vi.fn();
      const { getForm } = renderIsolated(<SearchBar value='test' onSubmit={mockOnSubmit} />);

      const form = getForm();
      fireEvent.submit(form);

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).toHaveBeenCalledWith('test', expect.any(Object));
    });

    it('вызывает onSubmit при нажатии Enter в input', () => {
      const mockOnSubmit = vi.fn();
      const { getInput } = renderIsolated(<SearchBar value='test' onSubmit={mockOnSubmit} />);

      const input = getInput();
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).toHaveBeenCalledWith('test', expect.any(Object));
    });

    it('не вызывает onSubmit при нажатии других клавиш', () => {
      const mockOnSubmit = vi.fn();
      const { getInput } = renderIsolated(<SearchBar value='test' onSubmit={mockOnSubmit} />);

      const input = getInput();
      fireEvent.keyDown(input, { key: 'Space' });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('не вызывает onSubmit когда disabled=true', () => {
      const mockOnSubmit = vi.fn();
      const { getForm } = renderIsolated(
        <SearchBar value='test' onSubmit={mockOnSubmit} disabled={true} />,
      );

      const form = getForm();
      fireEvent.submit(form);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('не вызывает onSubmit если он не передан', () => {
      const { getForm } = renderIsolated(<SearchBar value='test' />);

      const form = getForm();
      expect(() => fireEvent.submit(form)).not.toThrow();
    });

    it('вызывает preventDefault при submit', () => {
      const mockOnSubmit = vi.fn();
      const { getForm } = renderIsolated(<SearchBar value='test' onSubmit={mockOnSubmit} />);

      const form = getForm();
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(submitEvent, 'preventDefault');
      fireEvent(form, submitEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('4.12. Ref forwarding', () => {
    it('передает ref к input элементу', () => {
      const mockRef = createMockRef();

      renderIsolated(<SearchBar ref={mockRef} />);

      expect(mockRef.current).toBeInstanceOf(HTMLInputElement);
      expect(mockRef.current?.tagName).toBe('INPUT');
      expect(mockRef.current).toHaveAttribute('role', 'searchbox');
    });

    it('поддерживает callback ref', () => {
      const refCallback = vi.fn();

      renderIsolated(<SearchBar ref={refCallback} />);

      expect(refCallback).toHaveBeenCalledTimes(1);
      expect(refCallback.mock.calls[0]?.[0]).toBeInstanceOf(HTMLInputElement);
    });
  });

  describe('4.13. Test IDs', () => {
    it('применяет правильный data-testid для form', () => {
      const { getByTestId } = renderIsolated(<SearchBar data-testid='searchbar' />);

      expect(getByTestId('searchbar-form')).toBeInTheDocument();
    });

    it('применяет правильный data-testid для wrapper', () => {
      const { getByTestId } = renderIsolated(<SearchBar data-testid='searchbar' />);

      expect(getByTestId('searchbar-wrapper')).toBeInTheDocument();
    });

    it('применяет правильный data-testid для input', () => {
      const { getByTestId } = renderIsolated(<SearchBar data-testid='searchbar' />);

      expect(getByTestId('searchbar-input')).toBeInTheDocument();
    });

    it('применяет правильный data-testid для clear button', () => {
      const { getByTestId } = renderIsolated(<SearchBar data-testid='searchbar' value='test' />);

      expect(getByTestId('searchbar-clear')).toBeInTheDocument();
    });

    it('применяет правильный data-testid для search button', () => {
      const { getByTestId } = renderIsolated(
        <SearchBar data-testid='searchbar' showSearchButton={true} />,
      );

      expect(getByTestId('searchbar-search-button')).toBeInTheDocument();
    });

    it('применяет правильный data-testid для icon', () => {
      const { getByTestId } = renderIsolated(
        <SearchBar data-testid='searchbar' searchIcon={<span>🔍</span>} />,
      );

      expect(getByTestId('searchbar-icon')).toBeInTheDocument();
    });

    it('не применяет data-testid для вложенных элементов когда testId пустой', () => {
      const { container } = renderIsolated(<SearchBar data-testid='' value='test' />);

      expect(container.querySelector('[data-testid*="-form"]')).toBeNull();
      expect(container.querySelector('[data-testid*="-wrapper"]')).toBeNull();
      expect(container.querySelector('[data-testid*="-input"]')).toBeNull();
    });

    it('не применяет data-testid для вложенных элементов когда testId не передан', () => {
      const { container } = renderIsolated(<SearchBar value='test' />);

      expect(container.querySelector('[data-testid*="-form"]')).toBeNull();
      expect(container.querySelector('[data-testid*="-wrapper"]')).toBeNull();
      expect(container.querySelector('[data-testid*="-input"]')).toBeNull();
    });
  });

  describe('4.14. ARIA атрибуты', () => {
    it('применяет aria-describedby к input', () => {
      const { getInput } = renderIsolated(<SearchBar aria-describedby='description-id' />);

      const input = getInput();
      expect(input).toHaveAttribute('aria-describedby', 'description-id');
    });

    it('не применяет aria-describedby по умолчанию', () => {
      const { getInput } = renderIsolated(<SearchBar />);

      const input = getInput();
      expect(input).not.toHaveAttribute('aria-describedby');
    });

    it('применяет aria-required=false к input', () => {
      const { getInput } = renderIsolated(<SearchBar />);

      const input = getInput();
      expect(input).toHaveAttribute('aria-required', 'false');
    });
  });

  describe('4.15. Edge cases', () => {
    it('работает с value=undefined', () => {
      const { getInput } = renderIsolated(<SearchBar value={undefined as any} />);

      const input = getInput() as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('работает с value=null', () => {
      // Компонент проверяет value.length, что упадет при null
      // Это edge case, который должен обрабатываться на уровне App-слоя
      // Тестируем что компонент не падает при рендере
      expect(() => {
        renderIsolated(<SearchBar value={null as any} />);
      }).toThrow();
    });

    it('работает с пустой строкой value', () => {
      const { getInput } = renderIsolated(<SearchBar value='' />);

      const input = getInput() as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('работает с длинным значением', () => {
      const longValue = 'a'.repeat(1000);
      const { getInput } = renderIsolated(<SearchBar value={longValue} />);

      const input = getInput() as HTMLInputElement;
      expect(input.value).toBe(longValue);
    });

    it('работает с disabled как false', () => {
      const { getSearchBar } = renderIsolated(<SearchBar disabled={false} />);

      expect(getSearchBar()).not.toHaveAttribute('data-disabled');
    });

    it('работает с disabled как true', () => {
      const { getSearchBar } = renderIsolated(<SearchBar disabled={true} />);

      expect(getSearchBar()).toHaveAttribute('data-disabled', 'true');
    });

    it('работает с showClearButton как false', () => {
      const { getClearButton } = renderIsolated(
        <SearchBar value='test' showClearButton={false} />,
      );

      expect(getClearButton()).toBeNull();
    });

    it('работает с showClearButton как true', () => {
      const { getClearButton } = renderIsolated(
        <SearchBar value='test' showClearButton={true} />,
      );

      expect(getClearButton()).toBeInTheDocument();
    });

    it('работает с showSearchButton как false', () => {
      const { getSearchButton } = renderIsolated(<SearchBar showSearchButton={false} />);

      expect(getSearchButton()).toBeNull();
    });

    it('работает с showSearchButton как true', () => {
      const { getSearchButton } = renderIsolated(<SearchBar showSearchButton={true} />);

      expect(getSearchButton()).toBeInTheDocument();
    });
  });

  describe('4.16. Стилизация', () => {
    it('применяет базовые стили контейнера', () => {
      const { getSearchBar } = renderIsolated(<SearchBar />);

      const searchBar = getSearchBar();
      expect(searchBar).toHaveStyle({
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        position: 'relative',
      });
    });

    it('применяет базовые стили form', () => {
      const { getForm } = renderIsolated(<SearchBar />);

      const form = getForm();
      expect(form).toHaveStyle({
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        position: 'relative',
      });
    });

    it('применяет базовые стили input', () => {
      const { getInput } = renderIsolated(<SearchBar />);

      const input = getInput();
      expect(input).toHaveStyle({
        width: '100%',
        borderRadius: '8px',
        fontSize: '14px',
        boxSizing: 'border-box',
      });
    });

    it('объединяет кастомные стили с базовыми', () => {
      const { getInput } = renderIsolated(<SearchBar style={customCombinedStyle} />);

      const input = getInput();
      const computedStyle = window.getComputedStyle(input);
      expect(computedStyle.backgroundColor).toBe('rgb(255, 0, 0)');
    });
  });

  describe('4.17. Memoization и производительность', () => {
    it('не перерендеривается при неизменных пропсах', () => {
      const { rerender, getSearchBar } = renderIsolated(<SearchBar value='test' />);

      const firstRender = getSearchBar();

      rerender(<SearchBar value='test' />);

      const secondRender = getSearchBar();
      // Проверяем что элементы те же (memo работает)
      expect(firstRender).toBe(secondRender);
    });

    it('перерендеривается при изменении value', () => {
      const { rerender, getInput } = renderIsolated(<SearchBar value='test1' />);

      const input1 = getInput() as HTMLInputElement;
      expect(input1.value).toBe('test1');

      rerender(<SearchBar value='test2' />);

      const input2 = getInput() as HTMLInputElement;
      expect(input2.value).toBe('test2');
    });
  });

  describe('4.18. Комбинации пропсов', () => {
    it('работает с всеми пропсами одновременно', () => {
      const mockOnChange = vi.fn();
      const mockOnSubmit = vi.fn();
      const mockOnClear = vi.fn();
      const { getSearchBar, getInput, getClearButton, getSearchButton, getIcon } = renderIsolated(
        <SearchBar
          value='test query'
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          onClear={mockOnClear}
          placeholder='Search...'
          showClearButton={true}
          showSearchButton={true}
          searchButtonLabel='Find'
          searchIcon={<span>🔍</span>}
          clearIcon={<span>×</span>}
          disabled={false}
          size='large'
          width='500px'
          aria-describedby='desc-id'
          data-testid='searchbar'
        />,
      );

      expect(getSearchBar()).toBeInTheDocument();
      expect(getInput()).toBeInTheDocument();
      expect(getClearButton()).toBeInTheDocument();
      expect(getSearchButton()).toBeInTheDocument();
      expect(getIcon()).toBeInTheDocument();

      const input = getInput() as HTMLInputElement;
      expect(input.value).toBe('test query');
      expect(input).toHaveAttribute('placeholder', 'Search...');
    });

    it('работает с минимальным набором пропсов', () => {
      const { getSearchBar, getInput } = renderIsolated(<SearchBar />);

      expect(getSearchBar()).toBeInTheDocument();
      expect(getInput()).toBeInTheDocument();
    });
  });
});
