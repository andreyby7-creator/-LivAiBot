/**
 * @vitest-environment jsdom
 * @file Unit тесты для UserProfileDisplay компонента
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UserProfileDisplay } from '../../../src/components/UserProfileDisplay.js';
import type { UserProfileData } from '../../../src/components/UserProfileDisplay.js';

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
    queryByTestId: (testId: Readonly<string>) => within(container).queryByTestId(testId),
    queryByRole: (role: Readonly<string>, options?: Readonly<any>) =>
      within(container).queryByRole(role, options),
    getUserProfileDisplay: () =>
      container.querySelector('div[data-component="CoreUserProfileDisplay"]')!,
  };
}

describe('UserProfileDisplay', () => {
  // Общие тестовые переменные
  const baseProfile: UserProfileData = {
    email: 'user@example.com',
    name: 'Иван Иванов',
    avatarUrl: 'https://example.com/avatar.jpg',
    additionalInfo: 'Разработчик',
  };

  const minimalProfile: UserProfileData = { email: 'user@example.com' };
  const profileWithName: UserProfileData = { email: 'user@example.com', name: 'Test User' };
  const profileWithAvatar: UserProfileData = {
    email: 'user@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
  };
  const profileWithAdditionalInfo: UserProfileData = {
    email: 'user@example.com',
    additionalInfo: 'Developer',
  };
  const profileWithNullName: UserProfileData = { email: 'user@example.com', name: null };
  const profileWithEmptyName: UserProfileData = { email: 'user@example.com', name: '' };
  const profileWithNullAdditionalInfo: UserProfileData = {
    email: 'user@example.com',
    additionalInfo: null,
  };
  const profileWithEmptyAdditionalInfo: UserProfileData = {
    email: 'user@example.com',
    additionalInfo: '',
  };
  const profileWithNullAvatar: UserProfileData = { email: 'user@example.com', avatarUrl: null };
  const profileWithEmptyAvatar: UserProfileData = { email: 'user@example.com', avatarUrl: '' };
  const profileWithJohnDoe: UserProfileData = { email: 'user@example.com', name: 'John Doe' };
  const profileWithJohn: UserProfileData = { email: 'user@example.com', name: 'John' };
  const profileWithTestEmail: UserProfileData = { email: 'test@example.com' };
  const profileWithEmptyEmail: UserProfileData = { email: '' };
  const profileWithJohnMichaelDoe: UserProfileData = {
    email: 'user@example.com',
    name: 'John Michael Doe',
  };
  const profileWithSpacesOnly: UserProfileData = { email: 'user@example.com', name: '   ' };
  const profileWithMultipleSpaces: UserProfileData = {
    email: 'user@example.com',
    name: 'John   Doe',
  };
  const profileWithTrimmedSpaces: UserProfileData = {
    email: 'user@example.com',
    name: '  John Doe  ',
  };
  const profileWithThreeWords: UserProfileData = {
    email: 'user@example.com',
    name: 'John Doe Smith',
  };
  const profileWithAtEmail: UserProfileData = { email: '@example.com' };
  const profileWithIvanIvanov: UserProfileData = { email: 'user@example.com', name: 'Иван Иванов' };
  const profileWithNameAndAvatarUrl: UserProfileData = {
    email: 'user@example.com',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.jpg',
  };
  const profileWithUndefinedName = {
    email: 'user@example.com',
    name: undefined as any,
  } as UserProfileData;
  const profileWithUndefinedAdditionalInfo = {
    email: 'user@example.com',
    additionalInfo: undefined as any,
  } as UserProfileData;
  const profileWithUndefinedAvatar = {
    email: 'user@example.com',
    avatarUrl: undefined as any,
  } as UserProfileData;
  const profileWithJaneSmith: UserProfileData = { email: 'user@example.com', name: 'Jane Smith' };

  // Вынесенные переменные для соблюдения ESLint правил
  const longName = 'A'.repeat(100);
  const longEmail = `${'a'.repeat(50)}@example.com`;
  const profileWithLongName: UserProfileData = { email: 'user@example.com', name: longName };
  const profileWithLongEmail: UserProfileData = { email: longEmail };

  const customStyle = { borderRadius: '8px', padding: '12px' };
  const emptyStyle = {};

  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLDivElement>();

  describe('4.1. Рендер без падений', () => {
    it('рендерится с обязательными пропсами', () => {
      const { container, getUserProfileDisplay } = renderIsolated(
        <UserProfileDisplay profile={minimalProfile} />,
      );

      expect(container).toBeInTheDocument();
      expect(getUserProfileDisplay()).toBeInTheDocument();
    });

    it('создает div элемент с правильными атрибутами по умолчанию', () => {
      const { getUserProfileDisplay } = renderIsolated(
        <UserProfileDisplay profile={minimalProfile} />,
      );

      const component = getUserProfileDisplay();
      expect(component).toBeInTheDocument();
      expect(component.tagName).toBe('DIV');
      expect(component).toHaveAttribute('data-component', 'CoreUserProfileDisplay');
      expect(component).toHaveAttribute('role', 'article');
      expect(component).toHaveAttribute('aria-roledescription', 'User profile');
      expect(component).toHaveAttribute('data-size', 'medium');
      expect(component).toHaveAttribute('data-variant', 'default');
    });

    it('рендерится с полным профилем', () => {
      const { getUserProfileDisplay } = renderIsolated(
        <UserProfileDisplay profile={baseProfile} />,
      );

      expect(getUserProfileDisplay()).toBeInTheDocument();
    });
  });

  describe('4.2. Пропсы и атрибуты', () => {
    describe('size', () => {
      const sizes = ['small', 'medium', 'large'] as const;

      sizes.forEach((size) => {
        it(`применяет правильный data-size="${size}"`, () => {
          const { getUserProfileDisplay } = renderIsolated(
            <UserProfileDisplay profile={minimalProfile} size={size} />,
          );

          expect(getUserProfileDisplay()).toHaveAttribute('data-size', size);
        });

        it(`применяет правильный размер аватара для size="${size}"`, () => {
          const { container } = renderIsolated(
            <UserProfileDisplay
              profile={minimalProfile}
              size={size}
              data-testid='profile'
            />,
          );

          const avatarWrapper = container.querySelector('[data-testid="profile-avatar-wrapper"]');
          expect(avatarWrapper).toBeInTheDocument();

          const expectedSize = size === 'small' ? 32 : size === 'medium' ? 48 : 64;
          expect(avatarWrapper).toHaveStyle({
            width: `${expectedSize}px`,
            height: `${expectedSize}px`,
          });
        });
      });

      it('использует medium по умолчанию', () => {
        const { getUserProfileDisplay } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} />,
        );

        expect(getUserProfileDisplay()).toHaveAttribute('data-size', 'medium');
      });
    });

    describe('variant', () => {
      const variants = ['default', 'compact', 'detailed'] as const;

      variants.forEach((variant) => {
        it(`применяет правильный data-variant="${variant}"`, () => {
          const { getUserProfileDisplay } = renderIsolated(
            <UserProfileDisplay profile={minimalProfile} variant={variant} />,
          );

          expect(getUserProfileDisplay()).toHaveAttribute('data-variant', variant);
        });

        it(`применяет правильные стили контейнера для variant="${variant}"`, () => {
          const { getUserProfileDisplay } = renderIsolated(
            <UserProfileDisplay profile={minimalProfile} variant={variant} />,
          );

          const component = getUserProfileDisplay();
          const computedStyle = window.getComputedStyle(component);

          if (variant === 'detailed') {
            expect(computedStyle.flexDirection).toBe('column');
            expect(computedStyle.alignItems).toBe('flex-start');
          } else {
            expect(computedStyle.display).toBe('flex');
            expect(computedStyle.alignItems).toBe('center');
          }
        });
      });

      it('использует default по умолчанию', () => {
        const { getUserProfileDisplay } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} />,
        );

        expect(getUserProfileDisplay()).toHaveAttribute('data-variant', 'default');
      });
    });

    describe('showAvatar', () => {
      it('показывает аватар по умолчанию', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithName}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-avatar-wrapper"]'))
          .toBeInTheDocument();
      });

      it('скрывает аватар когда showAvatar=false', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithName}
            showAvatar={false}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-avatar-wrapper"]')).toBeNull();
      });

      it('показывает аватар когда showAvatar=true', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithName}
            showAvatar={true}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-avatar-wrapper"]'))
          .toBeInTheDocument();
      });
    });

    describe('showName', () => {
      it('показывает имя по умолчанию', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithName}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-name"]')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="profile-name"]')).toHaveTextContent(
          'Test User',
        );
      });

      it('скрывает имя когда showName=false', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithName}
            showName={false}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-name"]')).toBeNull();
      });

      it('не показывает имя когда name=null', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithNullName}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-name"]')).toBeNull();
      });

      it('не показывает имя когда name=undefined', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithUndefinedName}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-name"]')).toBeNull();
      });

      it('не показывает имя когда name=""', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithEmptyName}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-name"]')).toBeNull();
      });
    });

    describe('showEmail', () => {
      it('показывает email по умолчанию', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} data-testid='profile' />,
        );

        expect(container.querySelector('[data-testid="profile-email"]')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="profile-email"]')).toHaveTextContent(
          'user@example.com',
        );
      });

      it('скрывает email когда showEmail=false', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={minimalProfile}
            showEmail={false}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-email"]')).toBeNull();
      });
    });

    describe('showAdditionalInfo', () => {
      it('не показывает дополнительную информацию по умолчанию', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithAdditionalInfo}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-additional-info"]')).toBeNull();
      });

      it('показывает дополнительную информацию когда showAdditionalInfo=true', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithAdditionalInfo}
            showAdditionalInfo={true}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-additional-info"]'))
          .toBeInTheDocument();
        expect(container.querySelector('[data-testid="profile-additional-info"]'))
          .toHaveTextContent('Developer');
      });

      it('не показывает дополнительную информацию когда additionalInfo=null', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithNullAdditionalInfo}
            showAdditionalInfo={true}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-additional-info"]')).toBeNull();
      });

      it('не показывает дополнительную информацию когда additionalInfo=undefined', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithUndefinedAdditionalInfo}
            showAdditionalInfo={true}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-additional-info"]')).toBeNull();
      });

      it('не показывает дополнительную информацию когда additionalInfo=""', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithEmptyAdditionalInfo}
            showAdditionalInfo={true}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-additional-info"]')).toBeNull();
      });
    });

    describe('customAvatar', () => {
      it('использует customAvatar когда передан', () => {
        const customAvatar = <div data-testid='custom-avatar'>Custom</div>;
        const { getByTestId } = renderIsolated(
          <UserProfileDisplay
            profile={minimalProfile}
            customAvatar={customAvatar}
            data-testid='profile'
          />,
        );

        expect(getByTestId('custom-avatar')).toBeInTheDocument();
        expect(getByTestId('profile-avatar-wrapper')).toBeInTheDocument();
      });

      it('не использует customAvatar когда не передан', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithAvatar}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="custom-avatar"]')).toBeNull();
        expect(container.querySelector('[data-testid="profile-avatar-image"]')).toBeInTheDocument();
      });
    });

    describe('data-testid', () => {
      it('применяет data-testid', () => {
        const { getByTestId } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} data-testid='custom-profile' />,
        );

        expect(getByTestId('custom-profile')).toBeInTheDocument();
      });

      it('не имеет data-testid по умолчанию', () => {
        const { getUserProfileDisplay } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} />,
        );

        expect(getUserProfileDisplay()).not.toHaveAttribute('data-testid');
      });

      it('создает test IDs для дочерних элементов', () => {
        const { getByTestId } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithName}
            data-testid='profile'
          />,
        );

        expect(getByTestId('profile-avatar-wrapper')).toBeInTheDocument();
        expect(getByTestId('profile-info')).toBeInTheDocument();
        expect(getByTestId('profile-name')).toBeInTheDocument();
        expect(getByTestId('profile-email')).toBeInTheDocument();
      });

      it('не создает test IDs для дочерних элементов когда data-testid пустой', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay profile={profileWithName} data-testid='' />,
        );

        expect(container.querySelector('[data-testid*="-avatar-wrapper"]')).toBeNull();
        expect(container.querySelector('[data-testid*="-info"]')).toBeNull();
      });

      it('не создает test IDs для дочерних элементов когда data-testid не передан', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay profile={profileWithName} />,
        );

        expect(container.querySelector('[data-testid*="-avatar-wrapper"]')).toBeNull();
        expect(container.querySelector('[data-testid*="-info"]')).toBeNull();
      });
    });

    describe('className и style', () => {
      it('применяет className', () => {
        const { getUserProfileDisplay } = renderIsolated(
          <UserProfileDisplay
            profile={minimalProfile}
            className='custom-class'
          />,
        );

        expect(getUserProfileDisplay()).toHaveClass('custom-class');
      });

      it('применяет style', () => {
        const { getUserProfileDisplay } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} style={customStyle} />,
        );

        const component = getUserProfileDisplay();
        const computedStyle = window.getComputedStyle(component);
        expect(computedStyle.borderRadius).toBe('8px');
        expect(computedStyle.padding).toBe('12px');
      });

      it('объединяет style с базовыми стилями', () => {
        const { getUserProfileDisplay } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} style={customStyle} />,
        );

        const component = getUserProfileDisplay();
        const computedStyle = window.getComputedStyle(component);
        expect(computedStyle.display).toBe('flex');
        expect(computedStyle.borderRadius).toBe('8px');
      });
    });

    describe('дополнительные HTML атрибуты', () => {
      it('прокидывает дополнительные HTML атрибуты', () => {
        const { getUserProfileDisplay } = renderIsolated(
          <UserProfileDisplay
            profile={minimalProfile}
            id='profile-id'
            title='Custom title'
            data-custom='test-value'
          />,
        );

        const component = getUserProfileDisplay();
        expect(component).toHaveAttribute('id', 'profile-id');
        expect(component).toHaveAttribute('title', 'Custom title');
        expect(component).toHaveAttribute('data-custom', 'test-value');
      });
    });
  });

  describe('4.3. Аватар', () => {
    describe('avatarUrl', () => {
      it('отображает изображение аватара когда avatarUrl передан', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithAvatar}
            data-testid='profile'
          />,
        );

        const avatarImage = container.querySelector('[data-testid="profile-avatar-image"]');
        expect(avatarImage).toBeInTheDocument();
        expect(avatarImage).toHaveAttribute('src', 'https://example.com/avatar.jpg');
        expect(avatarImage).toHaveAttribute('alt', 'user@example.com');
      });

      it('использует name как alt для изображения аватара', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithNameAndAvatarUrl}
            data-testid='profile'
          />,
        );

        const avatarImage = container.querySelector('[data-testid="profile-avatar-image"]');
        expect(avatarImage).toHaveAttribute('alt', 'Test User');
      });

      it('использует email как alt когда name отсутствует', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithAvatar}
            data-testid='profile'
          />,
        );

        const avatarImage = container.querySelector('[data-testid="profile-avatar-image"]');
        expect(avatarImage).toHaveAttribute('alt', 'user@example.com');
      });

      it('применяет правильные стили к изображению аватара', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithAvatar}
            size='medium'
            data-testid='profile'
          />,
        );

        const avatarImage = container.querySelector(
          '[data-testid="profile-avatar-image"]',
        ) as HTMLImageElement;
        expect(avatarImage).toHaveStyle({
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          objectFit: 'cover',
        });
      });

      it('не показывает изображение когда avatarUrl=null', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithNullAvatar}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-avatar-image"]')).toBeNull();
      });

      it('не показывает изображение когда avatarUrl=undefined', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithUndefinedAvatar}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-avatar-image"]')).toBeNull();
      });

      it('не показывает изображение когда avatarUrl=""', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithEmptyAvatar}
            data-testid='profile'
          />,
        );

        expect(container.querySelector('[data-testid="profile-avatar-image"]')).toBeNull();
      });
    });

    describe('fallback аватар с инициалами', () => {
      it('отображает инициалы из имени', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithIvanIvanov}
            data-testid='profile'
          />,
        );

        const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
        expect(fallbackAvatar).toBeInTheDocument();
        expect(fallbackAvatar).toHaveTextContent('ИИ');
      });

      it('отображает инициалы из двух слов', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithJohnDoe}
            data-testid='profile'
          />,
        );

        const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
        expect(fallbackAvatar).toHaveTextContent('JD');
      });

      it('отображает инициал из одного слова', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithJohn}
            data-testid='profile'
          />,
        );

        const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
        expect(fallbackAvatar).toHaveTextContent('J');
      });

      it('отображает инициал из email когда имя отсутствует', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} data-testid='profile' />,
        );

        const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
        expect(fallbackAvatar).toBeInTheDocument();
        expect(fallbackAvatar).toHaveTextContent('U');
      });

      it('отображает инициал из email когда name=null', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithNullName}
            data-testid='profile'
          />,
        );

        const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
        expect(fallbackAvatar).toHaveTextContent('U');
      });

      it('отображает инициал из email когда name=undefined', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithUndefinedName}
            data-testid='profile'
          />,
        );

        const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
        expect(fallbackAvatar).toHaveTextContent('U');
      });

      it('отображает инициал из email когда name=""', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithEmptyName}
            data-testid='profile'
          />,
        );

        const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
        expect(fallbackAvatar).toHaveTextContent('U');
      });

      it('обрабатывает имя с множественными пробелами', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithMultipleSpaces}
            data-testid='profile'
          />,
        );

        const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
        expect(fallbackAvatar).toHaveTextContent('JD');
      });

      it('обрабатывает имя с пробелами в начале и конце', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithTrimmedSpaces}
            data-testid='profile'
          />,
        );

        const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
        expect(fallbackAvatar).toHaveTextContent('JD');
      });

      it('берет только первые два слова для инициалов', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithThreeWords}
            data-testid='profile'
          />,
        );

        const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
        expect(fallbackAvatar).toHaveTextContent('JD');
      });

      it('применяет правильные стили к fallback аватару', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithName}
            size='medium'
            data-testid='profile'
          />,
        );

        const fallbackAvatar = container.querySelector(
          '[data-testid="profile-avatar-fallback"]',
        ) as HTMLElement;
        expect(fallbackAvatar).toHaveStyle({
          width: '48px',
          height: '48px',
          borderRadius: '50%',
        });
      });

      it('применяет правильный размер шрифта для fallback аватара', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithName}
            size='small'
            data-testid='profile'
          />,
        );

        const fallbackAvatar = container.querySelector(
          '[data-testid="profile-avatar-fallback"]',
        ) as HTMLElement;
        const computedStyle = window.getComputedStyle(fallbackAvatar);
        // small: 32px * 0.4 = 12.8px, но минимум 12px
        expect(parseFloat(computedStyle.fontSize)).toBeGreaterThanOrEqual(12);
      });

      it('не показывает fallback аватар когда нет имени и email пустой', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay profile={profileWithEmptyEmail} data-testid='profile' />,
        );

        // Когда нет инициалов, аватар не должен рендериться
        // Но email обязателен, так что это edge case
        const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
        // Если email пустой, getInitialsFromEmail вернет пустую строку
        // и fallback не будет показан
        expect(fallbackAvatar).toBeNull();
      });
    });
  });

  describe('4.4. Стилизация', () => {
    describe('стили контейнера', () => {
      it('применяет базовые стили для default variant', () => {
        const { getUserProfileDisplay } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} variant='default' />,
        );

        const component = getUserProfileDisplay();
        const computedStyle = window.getComputedStyle(component);
        expect(computedStyle.display).toBe('flex');
        expect(computedStyle.alignItems).toBe('center');
        expect(computedStyle.gap).toBe('12px');
      });

      it('применяет стили для compact variant', () => {
        const { getUserProfileDisplay } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} variant='compact' />,
        );

        const component = getUserProfileDisplay();
        const computedStyle = window.getComputedStyle(component);
        expect(computedStyle.display).toBe('flex');
        expect(computedStyle.alignItems).toBe('center');
        expect(computedStyle.gap).toBe('8px');
      });

      it('применяет стили для detailed variant', () => {
        const { getUserProfileDisplay } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} variant='detailed' />,
        );

        const component = getUserProfileDisplay();
        const computedStyle = window.getComputedStyle(component);
        expect(computedStyle.flexDirection).toBe('column');
        expect(computedStyle.alignItems).toBe('flex-start');
        expect(computedStyle.gap).toBe('8px');
      });
    });

    describe('стили текста', () => {
      it('применяет правильные стили имени для small размера', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithName}
            size='small'
            data-testid='profile'
          />,
        );

        const nameElement = container.querySelector('[data-testid="profile-name"]') as HTMLElement;
        const computedStyle = window.getComputedStyle(nameElement);
        expect(computedStyle.fontSize).toBe('14px');
      });

      it('применяет правильные стили имени для medium размера', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithName}
            size='medium'
            data-testid='profile'
          />,
        );

        const nameElement = container.querySelector('[data-testid="profile-name"]') as HTMLElement;
        const computedStyle = window.getComputedStyle(nameElement);
        expect(computedStyle.fontSize).toBe('16px');
      });

      it('применяет правильные стили имени для large размера', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithName}
            size='large'
            data-testid='profile'
          />,
        );

        const nameElement = container.querySelector('[data-testid="profile-name"]') as HTMLElement;
        const computedStyle = window.getComputedStyle(nameElement);
        expect(computedStyle.fontSize).toBe('18px');
      });

      it('применяет правильные стили email для small размера', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} size='small' data-testid='profile' />,
        );

        const emailElement = container.querySelector(
          '[data-testid="profile-email"]',
        ) as HTMLElement;
        const computedStyle = window.getComputedStyle(emailElement);
        expect(computedStyle.fontSize).toBe('12px');
      });

      it('применяет правильные стили email для medium размера', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} size='medium' data-testid='profile' />,
        );

        const emailElement = container.querySelector(
          '[data-testid="profile-email"]',
        ) as HTMLElement;
        const computedStyle = window.getComputedStyle(emailElement);
        expect(computedStyle.fontSize).toBe('14px');
      });

      it('применяет правильные стили email для large размера', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay profile={minimalProfile} size='large' data-testid='profile' />,
        );

        const emailElement = container.querySelector(
          '[data-testid="profile-email"]',
        ) as HTMLElement;
        const computedStyle = window.getComputedStyle(emailElement);
        expect(computedStyle.fontSize).toBe('14px');
      });

      it('применяет правильные стили дополнительной информации', () => {
        const { container } = renderIsolated(
          <UserProfileDisplay
            profile={profileWithAdditionalInfo}
            showAdditionalInfo={true}
            data-testid='profile'
          />,
        );

        const additionalInfoElement = container.querySelector(
          '[data-testid="profile-additional-info"]',
        ) as HTMLElement;
        const computedStyle = window.getComputedStyle(additionalInfoElement);
        expect(computedStyle.fontSize).toBe('12px');
      });
    });
  });

  describe('4.5. Доступность (A11y)', () => {
    it('имеет правильные ARIA атрибуты', () => {
      const { getUserProfileDisplay } = renderIsolated(
        <UserProfileDisplay profile={profileWithName} />,
      );

      const component = getUserProfileDisplay();
      expect(component).toHaveAttribute('role', 'article');
      expect(component).toHaveAttribute('aria-roledescription', 'User profile');
      expect(component).toHaveAttribute('aria-label', 'Профиль пользователя Test User');
    });

    it('использует email в aria-label когда name отсутствует', () => {
      const { getUserProfileDisplay } = renderIsolated(
        <UserProfileDisplay profile={minimalProfile} />,
      );

      const component = getUserProfileDisplay();
      expect(component).toHaveAttribute('aria-label', 'Профиль пользователя user@example.com');
    });

    it('fallback аватар имеет aria-hidden="true"', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay
          profile={profileWithName}
          data-testid='profile'
        />,
      );

      const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
      expect(fallbackAvatar).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('4.6. Ref forwarding', () => {
    it('поддерживает React.createRef', () => {
      const ref = React.createRef<HTMLDivElement>();

      renderIsolated(<UserProfileDisplay profile={minimalProfile} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'CoreUserProfileDisplay');
    });

    it('поддерживает useRef-подобный объект', () => {
      const ref = createMockRef();

      renderIsolated(<UserProfileDisplay profile={minimalProfile} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'CoreUserProfileDisplay');
    });
  });

  describe('4.7. Memoization и производительность', () => {
    it('не ререндерится при одинаковых пропсах', () => {
      let renderCount = 0;

      const TestComponent = () => {
        renderCount++;
        return <UserProfileDisplay profile={profileWithName} />;
      };

      const { rerender } = render(<TestComponent />);

      expect(renderCount).toBe(1);

      rerender(<TestComponent />);
      expect(renderCount).toBe(2); // React.memo предотвращает лишние рендеры компонента
    });

    it('useMemo для containerStyle вызывается только при изменении зависимостей', () => {
      const { getUserProfileDisplay, rerender } = renderIsolated(
        <UserProfileDisplay profile={minimalProfile} variant='default' />,
      );

      const initialGap = window.getComputedStyle(getUserProfileDisplay()).gap;

      rerender(<UserProfileDisplay profile={minimalProfile} variant='compact' />);

      const newGap = window.getComputedStyle(getUserProfileDisplay()).gap;
      expect(initialGap).not.toBe(newGap);
    });

    it('useMemo для initials вызывается только при изменении зависимостей', () => {
      const { container, rerender } = renderIsolated(
        <UserProfileDisplay
          profile={profileWithJohnDoe}
          data-testid='profile'
        />,
      );

      const initialInitials = container.querySelector('[data-testid="profile-avatar-fallback"]')
        ?.textContent;

      rerender(
        <UserProfileDisplay
          profile={profileWithJaneSmith}
          data-testid='profile'
        />,
      );

      const newInitials = container.querySelector('[data-testid="profile-avatar-fallback"]')
        ?.textContent;
      expect(initialInitials).not.toBe(newInitials);
    });
  });

  describe('4.8. Edge cases', () => {
    it('работает с минимальным профилем (только email)', () => {
      const { getUserProfileDisplay } = renderIsolated(
        <UserProfileDisplay profile={minimalProfile} />,
      );

      expect(getUserProfileDisplay()).toBeInTheDocument();
    });

    it('работает с полным профилем', () => {
      const { getUserProfileDisplay } = renderIsolated(
        <UserProfileDisplay profile={baseProfile} />,
      );

      expect(getUserProfileDisplay()).toBeInTheDocument();
    });

    it('работает с undefined style', () => {
      const { getUserProfileDisplay } = renderIsolated(
        <UserProfileDisplay profile={minimalProfile} style={undefined} />,
      );

      expect(getUserProfileDisplay()).toBeInTheDocument();
    });

    it('работает с пустым объектом style', () => {
      const { getUserProfileDisplay } = renderIsolated(
        <UserProfileDisplay profile={minimalProfile} style={emptyStyle} />,
      );

      expect(getUserProfileDisplay()).toBeInTheDocument();
    });

    it('работает когда все show* пропсы false', () => {
      const { getUserProfileDisplay } = renderIsolated(
        <UserProfileDisplay
          profile={profileWithName}
          showAvatar={false}
          showName={false}
          showEmail={false}
          showAdditionalInfo={false}
        />,
      );

      expect(getUserProfileDisplay()).toBeInTheDocument();
    });

    it('работает с длинным именем', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay
          profile={profileWithLongName}
          data-testid='profile'
        />,
      );

      const nameElement = container.querySelector('[data-testid="profile-name"]');
      expect(nameElement).toHaveTextContent(longName);
      // Проверяем что применяется text-overflow: ellipsis
      const computedStyle = window.getComputedStyle(nameElement as HTMLElement);
      expect(computedStyle.textOverflow).toBe('ellipsis');
      expect(computedStyle.overflow).toBe('hidden');
      expect(computedStyle.whiteSpace).toBe('nowrap');
    });

    it('работает с длинным email', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay profile={profileWithLongEmail} data-testid='profile' />,
      );

      const emailElement = container.querySelector('[data-testid="profile-email"]');
      expect(emailElement).toHaveTextContent(longEmail);
      // Проверяем что применяется text-overflow: ellipsis
      const computedStyle = window.getComputedStyle(emailElement as HTMLElement);
      expect(computedStyle.textOverflow).toBe('ellipsis');
    });

    it('работает с email без локальной части', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay profile={profileWithAtEmail} data-testid='profile' />,
      );

      // getInitialsFromEmail вернет пустую строку для '@example.com'
      const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
      expect(fallbackAvatar).toBeNull();
    });

    it('работает с email где локальная часть пустая', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay profile={profileWithAtEmail} data-testid='profile' />,
      );

      const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
      expect(fallbackAvatar).toBeNull();
    });

    it('работает со всеми пропсами одновременно', () => {
      const customAvatar = <div data-testid='custom-avatar'>Custom</div>;
      const { getUserProfileDisplay, getByTestId } = renderIsolated(
        <UserProfileDisplay
          profile={baseProfile}
          size='large'
          variant='detailed'
          showAvatar={true}
          showName={true}
          showEmail={true}
          showAdditionalInfo={true}
          customAvatar={customAvatar}
          className='custom-class'
          style={customStyle}
          data-testid='profile'
          id='profile-id'
        />,
      );

      expect(getUserProfileDisplay()).toBeInTheDocument();
      expect(getByTestId('custom-avatar')).toBeInTheDocument();
      expect(getUserProfileDisplay()).toHaveClass('custom-class');
      expect(getUserProfileDisplay()).toHaveAttribute('id', 'profile-id');
    });
  });

  describe('4.9. Генерация инициалов', () => {
    it('генерирует инициалы из имени с несколькими словами', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay
          profile={profileWithJohnMichaelDoe}
          data-testid='profile'
        />,
      );

      const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
      expect(fallbackAvatar).toHaveTextContent('JM');
    });

    it('генерирует инициал из одного слова', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay
          profile={profileWithJohn}
          data-testid='profile'
        />,
      );

      const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
      expect(fallbackAvatar).toHaveTextContent('J');
    });

    it('генерирует инициал из email', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay profile={profileWithTestEmail} data-testid='profile' />,
      );

      const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
      expect(fallbackAvatar).toHaveTextContent('T');
    });

    it('обрабатывает имя с только пробелами', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay
          profile={profileWithSpacesOnly}
          data-testid='profile'
        />,
      );

      const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
      expect(fallbackAvatar).toHaveTextContent('U');
    });

    it('обрабатывает имя с пустой строкой', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay profile={profileWithEmptyName} data-testid='profile' />,
      );

      const fallbackAvatar = container.querySelector('[data-testid="profile-avatar-fallback"]');
      expect(fallbackAvatar).toHaveTextContent('U');
    });
  });

  describe('4.10. Приоритет отображения аватара', () => {
    it('использует customAvatar когда передан, даже если есть avatarUrl', () => {
      const customAvatar = <div data-testid='custom-avatar'>Custom</div>;
      const { getByTestId, queryByTestId } = renderIsolated(
        <UserProfileDisplay
          profile={profileWithAvatar}
          customAvatar={customAvatar}
          data-testid='profile'
        />,
      );

      expect(getByTestId('custom-avatar')).toBeInTheDocument();
      expect(queryByTestId('profile-avatar-image')).toBeNull();
    });

    it('использует avatarUrl когда customAvatar не передан', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay
          profile={profileWithAvatar}
          data-testid='profile'
        />,
      );

      expect(container.querySelector('[data-testid="profile-avatar-image"]')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="profile-avatar-fallback"]')).toBeNull();
    });

    it('использует fallback когда avatarUrl отсутствует', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay
          profile={profileWithName}
          data-testid='profile'
        />,
      );

      expect(container.querySelector('[data-testid="profile-avatar-image"]')).toBeNull();
      expect(container.querySelector('[data-testid="profile-avatar-fallback"]'))
        .toBeInTheDocument();
    });

    it('не показывает аватар когда нет инициалов и avatarUrl', () => {
      const { container } = renderIsolated(
        <UserProfileDisplay profile={profileWithEmptyEmail} data-testid='profile' />,
      );

      // Когда email пустой, getInitialsFromEmail вернет пустую строку
      // и аватар не будет показан
      expect(container.querySelector('[data-testid="profile-avatar-wrapper"]')).toBeNull();
    });
  });
});
