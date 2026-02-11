/**
 * @vitest-environment jsdom
 * @file Unit тесты для Card компонента
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Card } from '../../../src/primitives/card.js';

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
    getByTestId: (testId: Readonly<string>) => within(container).getByTestId(testId),
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).queryByRole(role, options),
    getCard: (): HTMLElement =>
      container.querySelector('[data-component="CoreCard"]') as HTMLElement,
  };
}

describe('Card', () => {
  // Общие тестовые переменные
  const customStyle: Readonly<{ opacity: string; transform: string; }> = {
    opacity: '0.8',
    transform: 'scale(1.1)',
  } as const;

  describe('5.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getCard } = renderIsolated(<Card>Content</Card>);

      expect(container).toBeInTheDocument();
      expect(getCard()).toBeInTheDocument();
    });

    it('создает div элемент с правильными атрибутами по умолчанию', () => {
      const { getCard } = renderIsolated(<Card>Content</Card>);

      const card = getCard();
      expect(card).toBeInTheDocument();
      expect(card.tagName).toBe('DIV');
      expect(card).toHaveAttribute('data-component', 'CoreCard');
      expect(card).toHaveAttribute('role', 'group');
      expect(card).toHaveAttribute('data-variant', 'default');
      expect(card).toHaveAttribute('data-size', 'medium');
    });

    it('принимает ref с типобезопасностью', () => {
      const ref = React.createRef<HTMLDivElement>();
      renderIsolated(<Card ref={ref}>Content</Card>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('5.2. Содержимое (children)', () => {
    it('отображает текстовое содержимое', () => {
      const { getCard } = renderIsolated(<Card>Test Content</Card>);

      const card = getCard();
      expect(card).toHaveTextContent('Test Content');
    });

    it('отображает React элементы как children', () => {
      const { getCard } = renderIsolated(
        <Card>
          <h3>Title</h3>
          <p>Description</p>
        </Card>,
      );

      const card = getCard();
      expect(card.querySelector('h3')).toHaveTextContent('Title');
      expect(card.querySelector('p')).toHaveTextContent('Description');
    });

    it('отображает пустое содержимое', () => {
      const { getCard } = renderIsolated(<Card>{null}</Card>);

      const card = getCard();
      expect(card).toBeInTheDocument();
    });
  });

  describe('5.3. Размеры (size)', () => {
    it('применяет размер по умолчанию (medium)', () => {
      const { getCard } = renderIsolated(<Card>Content</Card>);

      const card = getCard();
      const computedStyle = window.getComputedStyle(card);
      expect(computedStyle.padding).toBe('16px');
      expect(computedStyle.borderRadius).toBe('12px');
      expect(card).toHaveAttribute('data-size', 'medium');
    });

    it('применяет size="small"', () => {
      const { getCard } = renderIsolated(<Card size='small'>Content</Card>);

      const card = getCard();
      const computedStyle = window.getComputedStyle(card);
      expect(computedStyle.padding).toBe('12px');
      expect(computedStyle.borderRadius).toBe('8px');
      expect(card).toHaveAttribute('data-size', 'small');
    });

    it('применяет size="large"', () => {
      const { getCard } = renderIsolated(<Card size='large'>Content</Card>);

      const card = getCard();
      const computedStyle = window.getComputedStyle(card);
      expect(computedStyle.padding).toBe('24px');
      expect(computedStyle.borderRadius).toBe('16px');
      expect(card).toHaveAttribute('data-size', 'large');
    });
  });

  describe('5.4. Варианты (variant)', () => {
    it('применяет variant по умолчанию (default)', () => {
      const { getCard } = renderIsolated(<Card>Content</Card>);

      const card = getCard();
      // В jsdom border: 'none' может не работать как ожидается, проверяем через borderWidth и borderStyle
      expect(card.style.borderWidth).toBe('0px');
      expect(card.style.borderStyle).toBe('none');
      expect(card).toHaveAttribute('data-variant', 'default');
    });

    it('применяет variant="outlined"', () => {
      const { getCard } = renderIsolated(<Card variant='outlined'>Content</Card>);

      const card = getCard();
      // Проверяем inline style напрямую
      expect(card.style.border).toContain('1px solid');
      expect(card.style.boxShadow).toBe('none');
      expect(card).toHaveAttribute('data-variant', 'outlined');
    });

    it('применяет variant="elevated"', () => {
      const { getCard } = renderIsolated(<Card variant='elevated'>Content</Card>);

      const card = getCard();
      // В jsdom border: 'none' может не работать как ожидается, проверяем через borderWidth и borderStyle
      expect(card.style.borderWidth).toBe('0px');
      expect(card.style.borderStyle).toBe('none');
      expect(card.style.boxShadow).not.toBe('none');
      expect(card.style.boxShadow).toBeTruthy();
      expect(card).toHaveAttribute('data-variant', 'elevated');
    });

    it('применяет variant="flat"', () => {
      const { getCard } = renderIsolated(<Card variant='flat'>Content</Card>);

      const card = getCard();
      // В jsdom border: 'none' может не работать как ожидается, проверяем через borderWidth и borderStyle
      expect(card.style.borderWidth).toBe('0px');
      expect(card.style.borderStyle).toBe('none');
      expect(card.style.boxShadow).toBe('none');
      expect(card).toHaveAttribute('data-variant', 'flat');
    });
  });

  describe('5.5. Кастомные стили', () => {
    it('применяет кастомный bgColor', () => {
      const { getCard } = renderIsolated(<Card bgColor='#FF0000'>Content</Card>);

      const card = getCard();
      const computedStyle = window.getComputedStyle(card);
      expect(computedStyle.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('применяет кастомный borderColor для outlined variant', () => {
      const { getCard } = renderIsolated(
        <Card variant='outlined' borderColor='#0000FF'>Content</Card>,
      );

      const card = getCard();
      const computedStyle = window.getComputedStyle(card);
      expect(computedStyle.borderColor).toBe('rgb(0, 0, 255)');
    });

    it('применяет кастомный shadow', () => {
      const { getCard } = renderIsolated(
        <Card shadow='0 10px 20px rgba(0,0,0,0.5)'>Content</Card>,
      );

      const card = getCard();
      const computedStyle = window.getComputedStyle(card);
      // Браузер нормализует rgba, убирая пробелы, поэтому проверяем содержимое
      expect(computedStyle.boxShadow).toContain('0 10px 20px');
      expect(computedStyle.boxShadow).toContain('rgba(0,0,0,0.5)');
    });

    it('применяет кастомный width', () => {
      const { getCard } = renderIsolated(<Card width='300px'>Content</Card>);

      const card = getCard();
      const computedStyle = window.getComputedStyle(card);
      expect(computedStyle.width).toBe('300px');
    });

    it('применяет кастомный height', () => {
      const { getCard } = renderIsolated(<Card height='200px'>Content</Card>);

      const card = getCard();
      const computedStyle = window.getComputedStyle(card);
      expect(computedStyle.height).toBe('200px');
    });

    it('применяет кастомный style через prop', () => {
      const { getCard } = renderIsolated(<Card style={customStyle}>Content</Card>);

      const card = getCard();
      const computedStyle = window.getComputedStyle(card);
      expect(computedStyle.opacity).toBe('0.8');
      // Браузер может преобразовать scale() в matrix(), проверяем что transform применяется
      expect(computedStyle.transform).toMatch(/scale\(1\.1\)|matrix\(1\.1/);
    });
  });

  describe('5.6. Props spreading', () => {
    it('передает className', () => {
      const { getCard } = renderIsolated(<Card className='custom-class'>Content</Card>);

      const card = getCard();
      expect(card).toHaveClass('custom-class');
    });

    it('передает data-testid', () => {
      const { getCard, getByTestId } = renderIsolated(
        <Card data-testid='test-card'>Content</Card>,
      );

      expect(getCard()).toBe(getByTestId('test-card'));
    });

    it('передает остальные HTML атрибуты', () => {
      const { getCard } = renderIsolated(
        <Card id='card-id' data-custom='value'>Content</Card>,
      );

      const card = getCard();
      expect(card).toHaveAttribute('id', 'card-id');
      expect(card).toHaveAttribute('data-custom', 'value');
    });
  });

  describe('5.7. Ref forwarding', () => {
    it('передает ref в DOM элемент', () => {
      const ref = React.createRef<HTMLDivElement>();
      renderIsolated(<Card ref={ref}>Content</Card>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.tagName).toBe('DIV');
    });

    it('ref указывает на правильный элемент', () => {
      const ref = React.createRef<HTMLDivElement>();
      const { getCard } = renderIsolated(<Card ref={ref}>Content</Card>);

      expect(ref.current).toBe(getCard());
    });
  });

  describe('5.8. Memoization', () => {
    it('не перерендеривается при одинаковых пропсах', () => {
      const { rerender, getCard } = renderIsolated(<Card size='medium'>Content</Card>);

      const firstRender = getCard();

      rerender(<Card size='medium'>Content</Card>);

      const secondRender = getCard();
      expect(firstRender).toBe(secondRender);
    });

    it('перерендеривается при изменении пропсов', () => {
      const { rerender, getCard } = renderIsolated(<Card size='small'>Content</Card>);

      const firstRender = getCard();
      const firstSize = firstRender.getAttribute('data-size');

      rerender(<Card size='large'>Content</Card>);

      const secondRender = getCard();
      const secondSize = secondRender.getAttribute('data-size');
      // Проверяем, что атрибут изменился (React может переиспользовать DOM элемент)
      expect(firstSize).toBe('small');
      expect(secondSize).toBe('large');
      expect(secondRender).toHaveAttribute('data-size', 'large');
    });
  });

  describe('5.9. Edge cases', () => {
    it('обрабатывает все варианты одновременно', () => {
      const { getCard } = renderIsolated(
        <Card
          variant='elevated'
          size='large'
          bgColor='#FF0000'
          width='500px'
          height='300px'
          data-testid='full-card'
          className='test-class'
        >
          Full Content
        </Card>,
      );

      const card = getCard();
      expect(card).toHaveAttribute('data-variant', 'elevated');
      expect(card).toHaveAttribute('data-size', 'large');
      expect(card).toHaveTextContent('Full Content');
      expect(card).toHaveClass('test-class');
    });

    it('обрабатывает пустые children', () => {
      const { getCard } = renderIsolated(<Card>{null}</Card>);

      const card = getCard();
      expect(card).toBeInTheDocument();
    });

    it('правильно применяет CSS custom properties', () => {
      const { getCard } = renderIsolated(<Card>Content</Card>);

      const card = getCard();
      const computedStyle = window.getComputedStyle(card);
      // Проверяем, что используются CSS переменные или дефолтные значения
      const bgColor = computedStyle.backgroundColor;
      expect(
        bgColor.includes('var') || bgColor === 'rgb(255, 255, 255)',
      ).toBe(true);
    });

    it('применяет точные значения padding через inline styles', () => {
      const { getCard: getSmall } = renderIsolated(
        <Card size='small'>Content</Card>,
      );
      const { getCard: getMedium } = renderIsolated(
        <Card size='medium'>Content</Card>,
      );
      const { getCard: getLarge } = renderIsolated(
        <Card size='large'>Content</Card>,
      );

      const smallStyle = window.getComputedStyle(getSmall());
      const mediumStyle = window.getComputedStyle(getMedium());
      const largeStyle = window.getComputedStyle(getLarge());

      expect(smallStyle.padding).toBe('12px');
      expect(mediumStyle.padding).toBe('16px');
      expect(largeStyle.padding).toBe('24px');
    });

    it('применяет точные значения borderRadius через inline styles', () => {
      const { getCard: getSmall } = renderIsolated(
        <Card size='small'>Content</Card>,
      );
      const { getCard: getMedium } = renderIsolated(
        <Card size='medium'>Content</Card>,
      );
      const { getCard: getLarge } = renderIsolated(
        <Card size='large'>Content</Card>,
      );

      const smallStyle = window.getComputedStyle(getSmall());
      const mediumStyle = window.getComputedStyle(getMedium());
      const largeStyle = window.getComputedStyle(getLarge());

      expect(smallStyle.borderRadius).toBe('8px');
      expect(mediumStyle.borderRadius).toBe('12px');
      expect(largeStyle.borderRadius).toBe('16px');
    });

    it('применяет boxShadow для elevated variant через inline styles', () => {
      const { getCard: getDefault } = renderIsolated(
        <Card variant='default'>Content</Card>,
      );
      const { getCard: getElevated } = renderIsolated(
        <Card variant='elevated'>Content</Card>,
      );

      const defaultStyle = window.getComputedStyle(getDefault());
      const elevatedStyle = window.getComputedStyle(getElevated());

      // Оба должны иметь boxShadow, но elevated должен быть более выраженным
      expect(defaultStyle.boxShadow).not.toBe('none');
      expect(elevatedStyle.boxShadow).not.toBe('none');
      expect(elevatedStyle.boxShadow).not.toBe(defaultStyle.boxShadow);
    });
  });

  describe('5.10. Snapshot тесты для всех variant и size', () => {
    const variants: readonly ('default' | 'outlined' | 'elevated' | 'flat')[] = [
      'default',
      'outlined',
      'elevated',
      'flat',
    ] as const;
    const sizes: readonly ('small' | 'medium' | 'large')[] = [
      'small',
      'medium',
      'large',
    ] as const;

    variants.forEach((variant) => {
      sizes.forEach((size) => {
        it(`рендерит корректный snapshot для variant="${variant}" и size="${size}"`, () => {
          const { container } = renderIsolated(
            <Card variant={variant} size={size}>
              Card Content
            </Card>,
          );

          expect(container.firstChild).toMatchSnapshot();
        });
      });
    });
  });

  describe('5.11. RTL тесты для role', () => {
    it('имеет role="group" по умолчанию', () => {
      const { getByRole } = renderIsolated(<Card>Content</Card>);

      expect(getByRole('group')).toBeInTheDocument();
    });

    it('принимает кастомный role через props', () => {
      const { getByRole } = renderIsolated(<Card role='article'>Content</Card>);

      expect(getByRole('article')).toBeInTheDocument();
    });

    it('принимает role="region"', () => {
      const { getByRole } = renderIsolated(<Card role='region'>Content</Card>);

      expect(getByRole('region')).toBeInTheDocument();
    });

    it('принимает role="complementary"', () => {
      const { getByRole } = renderIsolated(
        <Card role='complementary'>Content</Card>,
      );

      expect(getByRole('complementary')).toBeInTheDocument();
    });
  });

  describe('5.12. Проверка inline стилей', () => {
    it('применяет все базовые inline стили', () => {
      const { getCard } = renderIsolated(<Card>Content</Card>);

      const card = getCard();
      const computedStyle = window.getComputedStyle(card);

      expect(computedStyle.display).toBe('block');
      expect(computedStyle.boxSizing).toBe('border-box');
      expect(computedStyle.padding).toBeTruthy();
      expect(computedStyle.borderRadius).toBeTruthy();
    });

    it('применяет variant стили через inline styles', () => {
      const { getCard: getOutlined } = renderIsolated(
        <Card variant='outlined'>Content</Card>,
      );
      const { getCard: getElevated } = renderIsolated(
        <Card variant='elevated'>Content</Card>,
      );
      const { getCard: getFlat } = renderIsolated(
        <Card variant='flat'>Content</Card>,
      );

      // Outlined должен иметь border - проверяем inline style напрямую
      const outlinedCard = getOutlined();
      expect(outlinedCard.style.border).not.toBe('none');
      expect(outlinedCard.style.border).toContain('1px solid');

      // Elevated должен иметь boxShadow - проверяем inline style напрямую
      const elevatedCard = getElevated();
      expect(elevatedCard.style.boxShadow).not.toBe('none');
      expect(elevatedCard.style.boxShadow).toBeTruthy();

      // Flat не должен иметь ни border, ни boxShadow - проверяем inline style напрямую
      const flatCard = getFlat();
      // В jsdom border: 'none' может не работать как ожидается, проверяем через borderWidth и borderStyle
      expect(flatCard.style.borderWidth).toBe('0px');
      expect(flatCard.style.borderStyle).toBe('none');
      expect(flatCard.style.boxShadow).toBe('none');
    });

    it('применяет size стили через inline styles', () => {
      const { getCard: getSmall } = renderIsolated(
        <Card size='small'>Content</Card>,
      );
      const { getCard: getMedium } = renderIsolated(
        <Card size='medium'>Content</Card>,
      );
      const { getCard: getLarge } = renderIsolated(
        <Card size='large'>Content</Card>,
      );

      const smallStyle = window.getComputedStyle(getSmall());
      const mediumStyle = window.getComputedStyle(getMedium());
      const largeStyle = window.getComputedStyle(getLarge());

      // Проверяем, что padding и borderRadius различаются
      expect(smallStyle.padding).not.toBe(mediumStyle.padding);
      expect(mediumStyle.padding).not.toBe(largeStyle.padding);
      expect(smallStyle.borderRadius).not.toBe(mediumStyle.borderRadius);
      expect(mediumStyle.borderRadius).not.toBe(largeStyle.borderRadius);
    });

    it('применяет точные значения padding через inline styles', () => {
      const { getCard: getSmall } = renderIsolated(
        <Card size='small'>Content</Card>,
      );
      const { getCard: getMedium } = renderIsolated(
        <Card size='medium'>Content</Card>,
      );
      const { getCard: getLarge } = renderIsolated(
        <Card size='large'>Content</Card>,
      );

      const smallStyle = window.getComputedStyle(getSmall());
      const mediumStyle = window.getComputedStyle(getMedium());
      const largeStyle = window.getComputedStyle(getLarge());

      expect(smallStyle.padding).toBe('12px');
      expect(mediumStyle.padding).toBe('16px');
      expect(largeStyle.padding).toBe('24px');
    });

    it('применяет точные значения borderRadius через inline styles', () => {
      const { getCard: getSmall } = renderIsolated(
        <Card size='small'>Content</Card>,
      );
      const { getCard: getMedium } = renderIsolated(
        <Card size='medium'>Content</Card>,
      );
      const { getCard: getLarge } = renderIsolated(
        <Card size='large'>Content</Card>,
      );

      const smallStyle = window.getComputedStyle(getSmall());
      const mediumStyle = window.getComputedStyle(getMedium());
      const largeStyle = window.getComputedStyle(getLarge());

      expect(smallStyle.borderRadius).toBe('8px');
      expect(mediumStyle.borderRadius).toBe('12px');
      expect(largeStyle.borderRadius).toBe('16px');
    });

    it('применяет boxShadow для elevated variant через inline styles', () => {
      const { getCard: getDefault } = renderIsolated(
        <Card variant='default'>Content</Card>,
      );
      const { getCard: getElevated } = renderIsolated(
        <Card variant='elevated'>Content</Card>,
      );

      const defaultStyle = window.getComputedStyle(getDefault());
      const elevatedStyle = window.getComputedStyle(getElevated());

      // Оба должны иметь boxShadow, но elevated должен быть более выраженным
      expect(defaultStyle.boxShadow).not.toBe('none');
      expect(elevatedStyle.boxShadow).not.toBe('none');
      expect(elevatedStyle.boxShadow).not.toBe(defaultStyle.boxShadow);
    });

    it('применяет width и height через inline styles', () => {
      const { getCard } = renderIsolated(
        <Card width='300px' height='200px'>Content</Card>,
      );

      const card = getCard();
      const computedStyle = window.getComputedStyle(card);

      expect(computedStyle.width).toBe('300px');
      expect(computedStyle.height).toBe('200px');
    });

    it('применяет кастомные единицы измерения для width/height', () => {
      const { getCard: getPercent } = renderIsolated(
        <Card width='50%' height='100%'>Content</Card>,
      );
      const { getCard: getRem } = renderIsolated(
        <Card width='20rem' height='10rem'>Content</Card>,
      );

      const percentStyle = window.getComputedStyle(getPercent());
      const remStyle = window.getComputedStyle(getRem());

      expect(percentStyle.width).toBe('50%');
      expect(percentStyle.height).toBe('100%');
      expect(remStyle.width).toBe('20rem');
      expect(remStyle.height).toBe('10rem');
    });
  });

  describe('5.13. Улучшенная проверка ref forwarding', () => {
    it('ref указывает на правильный DOM элемент', () => {
      const ref = React.createRef<HTMLDivElement>();
      const { getCard } = renderIsolated(<Card ref={ref}>Content</Card>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toBe(getCard());
    });

    it('ref обновляется при перерендере', () => {
      const ref = React.createRef<HTMLDivElement>();
      const { rerender } = renderIsolated(<Card ref={ref}>Content</Card>);

      const firstRef = ref.current;

      rerender(<Card ref={ref}>New Content</Card>);

      expect(ref.current).toBe(firstRef); // Тот же элемент
      expect(ref.current?.textContent).toBe('New Content');
    });

    it('ref работает с callback ref', () => {
      let refElement: HTMLDivElement | null = null;
      // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
      const callbackRef = (element: HTMLDivElement | null): void => {
        refElement = element;
      };

      const { getCard } = renderIsolated(
        <Card ref={callbackRef}>Content</Card>,
      );

      expect(refElement).toBeInstanceOf(HTMLDivElement);
      expect(refElement).toBe(getCard());
    });

    it('ref сохраняется при изменении props', () => {
      const ref = React.createRef<HTMLDivElement>();
      const { rerender } = renderIsolated(
        <Card ref={ref} variant='default'>Content</Card>,
      );

      const firstRef = ref.current;

      rerender(<Card ref={ref} variant='elevated'>Content</Card>);

      expect(ref.current).toBe(firstRef); // Тот же элемент
      expect(ref.current).toHaveAttribute('data-variant', 'elevated');
    });
  });

  describe('5.14. Проверка role и data-* атрибутов', () => {
    it('имеет правильные data-* атрибуты для всех variant', () => {
      const variants: readonly ('default' | 'outlined' | 'elevated' | 'flat')[] = [
        'default',
        'outlined',
        'elevated',
        'flat',
      ] as const;

      variants.forEach((variant) => {
        const { getCard } = renderIsolated(
          <Card variant={variant}>Content</Card>,
        );

        const card = getCard();
        expect(card).toHaveAttribute('data-component', 'CoreCard');
        expect(card).toHaveAttribute('data-variant', variant);
      });
    });

    it('имеет правильные data-* атрибуты для всех size', () => {
      const sizes: readonly ('small' | 'medium' | 'large')[] = [
        'small',
        'medium',
        'large',
      ] as const;

      sizes.forEach((size) => {
        const { getCard } = renderIsolated(<Card size={size}>Content</Card>);

        const card = getCard();
        expect(card).toHaveAttribute('data-component', 'CoreCard');
        expect(card).toHaveAttribute('data-size', size);
      });
    });

    it('имеет data-component="CoreCard" всегда', () => {
      const { getCard } = renderIsolated(<Card>Content</Card>);

      const card = getCard();
      expect(card).toHaveAttribute('data-component', 'CoreCard');
    });

    it('принимает кастомный role через props', () => {
      const { getByRole } = renderIsolated(
        <Card role='article'>Content</Card>,
      );

      expect(getByRole('article')).toBeInTheDocument();
    });

    it('принимает role="region"', () => {
      const { getByRole } = renderIsolated(<Card role='region'>Content</Card>);

      expect(getByRole('region')).toBeInTheDocument();
    });

    it('принимает role="complementary"', () => {
      const { getByRole } = renderIsolated(
        <Card role='complementary'>Content</Card>,
      );

      expect(getByRole('complementary')).toBeInTheDocument();
    });

    it('прокидывает aria-* атрибуты через rest props', () => {
      const { getCard } = renderIsolated(
        <Card
          aria-label='Test Card'
          aria-labelledby='card-title'
          aria-describedby='card-desc'
          aria-live='polite'
        >
          Content
        </Card>,
      );

      const card = getCard();
      expect(card).toHaveAttribute('aria-label', 'Test Card');
      expect(card).toHaveAttribute('aria-labelledby', 'card-title');
      expect(card).toHaveAttribute('aria-describedby', 'card-desc');
      expect(card).toHaveAttribute('aria-live', 'polite');
    });

    it('комбинирует role и data-* атрибуты корректно', () => {
      const { getCard } = renderIsolated(
        <Card
          role='article'
          variant='elevated'
          size='large'
          data-testid='test-card'
        >
          Content
        </Card>,
      );

      const card = getCard();
      expect(card).toHaveAttribute('role', 'article');
      expect(card).toHaveAttribute('data-component', 'CoreCard');
      expect(card).toHaveAttribute('data-variant', 'elevated');
      expect(card).toHaveAttribute('data-size', 'large');
      expect(card).toHaveAttribute('data-testid', 'test-card');
    });
  });
});
