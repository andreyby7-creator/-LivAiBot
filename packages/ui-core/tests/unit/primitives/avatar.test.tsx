/**
 * @vitest-environment jsdom
 * @file Unit тесты для Avatar компонента
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Avatar } from '../../../src/primitives/avatar.js';
import type { AvatarSize } from '../../../src/primitives/avatar.js';

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
    getAvatar: () => container.querySelector('div[data-component="CoreAvatar"]')!,
    getImage: () => container.querySelector('img'),
    getFallbackSpan: () => container.querySelector('span[aria-hidden="true"]'),
  };
}

describe('Avatar', () => {
  describe('1.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getAvatar } = renderIsolated(<Avatar alt='Test User' />);

      expect(container).toBeInTheDocument();
      expect(getAvatar()).toBeInTheDocument();
    });

    it('создает div элемент с правильными атрибутами по умолчанию', () => {
      const { getAvatar } = renderIsolated(<Avatar alt='Test User' />);

      const avatar = getAvatar();
      expect(avatar).toBeInTheDocument();
      expect(avatar.tagName).toBe('DIV');
      expect(avatar).toHaveAttribute('data-component', 'CoreAvatar');
      expect(avatar).toHaveAttribute('role', 'img');
      expect(avatar).toHaveAttribute('aria-label', 'Test User');
      expect(avatar).toHaveAttribute('title', 'Test User');
    });
  });

  describe('1.2. Src и изображение', () => {
    it('рендерит img элемент когда src передан', () => {
      const { getImage } = renderIsolated(<Avatar src='/test.jpg' alt='Test User' />);

      const img = getImage();
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/test.jpg');
      expect(img).toHaveAttribute('alt', 'Test User');
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img).toHaveAttribute('decoding', 'async');
    });

    it('не рендерит img элемент когда src не передан', () => {
      const { getImage } = renderIsolated(<Avatar alt='Test User' />);

      expect(getImage()).not.toBeInTheDocument();
    });

    it('применяет objectFit к img', () => {
      const { getImage } = renderIsolated(
        <Avatar src='/test.jpg' alt='Test User' objectFit='contain' />,
      );

      const img = getImage();
      expect(img).toBeInTheDocument();
      expect(img?.style.objectFit).toBe('contain');
    });
  });

  describe('1.3. Размеры (size)', () => {
    it('применяет размер по умолчанию', () => {
      const { getAvatar } = renderIsolated(<Avatar alt='Test User' />);

      const avatar = getAvatar();
      // @ts-expect-error - DOM element has style property
      expect(avatar.style.width).toBe('32px');
      // @ts-expect-error - DOM element has style property
      expect(avatar.style.height).toBe('32px');
    });

    it.each([
      [24, '24px'],
      [32, '32px'],
      [48, '48px'],
      [64, '64px'],
    ])('применяет типизированный размер %ipx', (size, expected) => {
      const { getAvatar } = renderIsolated(<Avatar alt='Test User' size={size as AvatarSize} />);

      const avatar = getAvatar();
      expect((avatar as HTMLElement).style.width).toBe(expected);
      expect((avatar as HTMLElement).style.height).toBe(expected);
    });

    it('использует размер по умолчанию для невалидного size', () => {
      const { getAvatar } = renderIsolated(<Avatar alt='Test User' size={999 as any} />);

      const avatar = getAvatar();
      // @ts-expect-error - DOM element has style property
      expect(avatar.style.width).toBe('32px');
      // @ts-expect-error - DOM element has style property
      expect(avatar.style.height).toBe('32px');
    });
  });

  describe('1.4. Цвета и стили', () => {
    it('применяет bgColor когда src не передан', () => {
      const { getAvatar } = renderIsolated(<Avatar alt='Test User' bgColor='#FF0000' />);

      const avatar = getAvatar();
      expect((avatar as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('не применяет bgColor когда src передан', () => {
      const { getAvatar } = renderIsolated(
        <Avatar src='/test.jpg' alt='Test User' bgColor='#FF0000' />,
      );

      const avatar = getAvatar();
      expect((avatar as HTMLElement).style.backgroundColor).toBe('');
    });

    it('применяет theme token по умолчанию для bgColor', () => {
      const { getAvatar } = renderIsolated(<Avatar alt='Test User' />);

      const avatar = getAvatar();
      expect((avatar as HTMLElement).style.backgroundColor).toBe('var(--avatar-bg, #E5E7EB)');
    });

    it('применяет fallbackTextColor по умолчанию', () => {
      const { getFallbackSpan } = renderIsolated(<Avatar alt='Test User' />);

      const span = getFallbackSpan();
      expect(span).toBeInTheDocument();
      // @ts-expect-error - DOM element has style property
      expect(span?.style.color).toBe('var(--avatar-text, white)');
    });

    it('применяет кастомный fallbackTextColor', () => {
      const { getFallbackSpan } = renderIsolated(
        <Avatar alt='Test User' fallbackTextColor='#000000' />,
      );

      const span = getFallbackSpan();
      expect(span).toBeInTheDocument();
      // @ts-expect-error - DOM element has style property
      expect(span?.style.color).toBe('rgb(0, 0, 0)');
    });
  });

  describe('1.5. Fallback инициалы', () => {
    it('генерирует инициалы из alt по умолчанию', () => {
      const { getFallbackSpan } = renderIsolated(<Avatar alt='John Doe' />);

      const span = getFallbackSpan();
      expect(span).toBeInTheDocument();
      expect(span?.textContent).toBe('JD');
    });

    it('использует fallbackText вместо генерации из alt', () => {
      const { getFallbackSpan } = renderIsolated(<Avatar alt='John Doe' fallbackText='XX' />);

      const span = getFallbackSpan();
      expect(span).toBeInTheDocument();
      expect(span?.textContent).toBe('XX');
    });

    it('не рендерит fallback когда src передан', () => {
      const { getFallbackSpan } = renderIsolated(<Avatar src='/test.jpg' alt='Test User' />);

      expect(getFallbackSpan()).not.toBeInTheDocument();
    });

    it('генерирует инициалы из многословного имени', () => {
      const { getFallbackSpan } = renderIsolated(<Avatar alt='John Michael Doe' />);

      const span = getFallbackSpan();
      expect(span).toBeInTheDocument();
      expect(span?.textContent).toBe('JM');
    });

    it('генерирует инициалы из односимвольного имени', () => {
      const { getFallbackSpan } = renderIsolated(<Avatar alt='A' />);

      const span = getFallbackSpan();
      expect(span).toBeInTheDocument();
      expect(span?.textContent).toBe('A');
    });

    it('не рендерит fallback для пустого alt', () => {
      const { getFallbackSpan } = renderIsolated(<Avatar alt='' />);

      expect(getFallbackSpan()).not.toBeInTheDocument();
    });
  });

  describe('1.6. Accessibility', () => {
    it('применяет aria-label из alt', () => {
      const { getAvatar } = renderIsolated(<Avatar alt='John Doe' />);

      const avatar = getAvatar();
      expect(avatar).toHaveAttribute('aria-label', 'John Doe');
    });

    it('применяет title из alt для tooltip', () => {
      const { getAvatar } = renderIsolated(<Avatar alt='John Doe' />);

      const avatar = getAvatar();
      expect(avatar).toHaveAttribute('title', 'John Doe');
    });

    it('fallback span имеет aria-hidden', () => {
      const { getFallbackSpan } = renderIsolated(<Avatar alt='Test User' />);

      const span = getFallbackSpan();
      expect(span).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('1.7. Проп forwarding', () => {
    it('передает className', () => {
      const { getAvatar } = renderIsolated(<Avatar alt='Test User' className='custom-class' />);

      const avatar = getAvatar();
      expect(avatar).toHaveClass('custom-class');
    });

    it('передает data-testid', () => {
      const { getAvatar } = renderIsolated(<Avatar alt='Test User' data-testid='avatar-test' />);

      const avatar = getAvatar();
      expect(avatar).toHaveAttribute('data-testid', 'avatar-test');
    });

    it('передает другие HTML атрибуты', () => {
      const { getAvatar } = renderIsolated(<Avatar alt='Test User' id='test-id' />);

      const avatar = getAvatar();
      expect(avatar).toHaveAttribute('id', 'test-id');
    });
  });

  describe('1.8. Font size расчет', () => {
    it('рассчитывает fontSize для разных размеров', () => {
      const { getFallbackSpan } = renderIsolated(<Avatar alt='Test User' size={48} />);

      const span = getFallbackSpan();
      expect(span).toBeInTheDocument();
      // 48 * 0.4 = 19.2, но MIN_FONT_SIZE = 12, так что должно быть 19.2
      // @ts-expect-error - DOM element has style property
      expect(span?.style.fontSize).toMatch(/^19\.2\d*px$/);
    });

    it('применяет MIN_FONT_SIZE для маленьких аватаров', () => {
      const { getFallbackSpan } = renderIsolated(<Avatar alt='Test User' size={24} />);

      const span = getFallbackSpan();
      expect(span).toBeInTheDocument();
      // 24 * 0.4 = 9.6, но MIN_FONT_SIZE = 12, так что должно быть 12
      // @ts-expect-error - DOM element has style property
      expect(span?.style.fontSize).toBe('12px');
    });
  });

  describe('1.9. Position relative', () => {
    it('применяет position relative для корректного позиционирования fallback', () => {
      const { getAvatar } = renderIsolated(<Avatar alt='Test User' />);

      const avatar = getAvatar();
      expect((avatar as HTMLElement).style.position).toBe('relative');
    });
  });

  describe('1.10. Edge cases', () => {
    it('работает с null alt', () => {
      const { getAvatar, getFallbackSpan } = renderIsolated(<Avatar alt={null} />);

      const avatar = getAvatar();
      expect(avatar).toHaveAttribute('aria-label', 'avatar');
      expect(avatar).toHaveAttribute('title', 'avatar');

      // Для null alt fallback не генерируется
      expect(getFallbackSpan()).not.toBeInTheDocument();
    });

    it('работает с undefined alt', () => {
      const { getAvatar, getFallbackSpan } = renderIsolated(<Avatar />);

      const avatar = getAvatar();
      expect(avatar).toHaveAttribute('aria-label', 'avatar');
      expect(avatar).toHaveAttribute('title', 'avatar');

      // Для undefined alt fallback не генерируется
      expect(getFallbackSpan()).not.toBeInTheDocument();
    });

    it('fallbackText переопределяет генерацию из alt', () => {
      const { getFallbackSpan } = renderIsolated(<Avatar alt='John Doe' fallbackText='CUSTOM' />);

      const span = getFallbackSpan();
      expect(span).toBeInTheDocument();
      expect(span?.textContent).toBe('CUSTOM');
    });
  });

  describe('1.11. Render stability', () => {
    it('компонент стабилен при перерендере', () => {
      const { rerender, container } = render(<Avatar alt='Test User' />);
      const avatar1 = container.querySelector('div[data-component="CoreAvatar"]');

      rerender(<Avatar alt='Test User' />);
      const avatar2 = container.querySelector('div[data-component="CoreAvatar"]');

      expect(avatar1).toBe(avatar2);
    });

    it('стили стабильны при перерендере', () => {
      const { rerender, container } = render(<Avatar alt='Test User' size={48} />);
      const avatar1 = container.querySelector('div[data-component="CoreAvatar"]')!;

      rerender(<Avatar alt='Test User' size={48} />);
      const avatar2 = container.querySelector('div[data-component="CoreAvatar"]')!;

      expect((avatar1 as HTMLElement).style.width).toBe((avatar2 as HTMLElement).style.width);
      expect((avatar1 as HTMLElement).style.height).toBe((avatar2 as HTMLElement).style.height);
    });
  });
});
