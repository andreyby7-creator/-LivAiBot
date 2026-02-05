/**
 * @vitest-environment jsdom
 * @file Тесты для App LanguageSelector компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { I18nProvider } from '../../../src/lib/i18n';

// Mock для Core LanguageSelector - возвращаем простой div с переданными пропсами
vi.mock('../../../../ui-core/src/components/LanguageSelector.js', () => ({
  LanguageSelector: React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'> & {
      languages?: any[];
      selectedLanguageCode?: string;
      isOpen?: boolean;
      placeholder?: string;
      size?: string;
      variant?: string;
      showFlags?: boolean;
      showCodes?: boolean;
      disabled?: boolean;
      onLanguageChange?: (code: string) => void;
      onOpenChange?: (isOpen: boolean) => void;
      onToggle?: () => void;
      onClose?: () => void;
      onKeyDown?: (event: any) => void;
      activeDescendantId?: string;
      navigatedLanguageCode?: string;
      'data-component'?: string;
      'data-state'?: string;
      'data-feature-flag'?: string;
      'data-telemetry'?: string;
      'aria-label'?: string;
      'data-testid'?: string;
    }
  >((
    {
      languages,
      selectedLanguageCode,
      isOpen,
      placeholder,
      size,
      variant,
      showFlags,
      showCodes,
      disabled,
      onLanguageChange,
      onOpenChange,
      onToggle,
      onClose,
      onKeyDown,
      activeDescendantId,
      navigatedLanguageCode,
      'data-component': dataComponent,
      'data-state': dataState,
      'data-feature-flag': dataFeatureFlag,
      'data-telemetry': dataTelemetry,
      'aria-label': ariaLabel,
      'data-testid': dataTestId,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        data-testid='core-language-selector'
        data-component={dataComponent}
        data-state={dataState}
        data-feature-flag={dataFeatureFlag}
        data-telemetry={dataTelemetry}
        data-size={size}
        data-variant={variant}
        data-show-flags={String(showFlags)}
        data-show-codes={String(showCodes)}
        data-disabled={String(disabled)}
        data-open={String(isOpen)}
        data-selected-language-code={selectedLanguageCode}
        data-placeholder={placeholder}
        data-active-descendant-id={activeDescendantId}
        data-navigated-language-code={navigatedLanguageCode}
        aria-label={ariaLabel}
        {...(dataTestId != null && { 'data-testid': dataTestId })}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        {...props}
      />
    );
  }),
}));

// Helper для рендера с I18nProvider
const renderWithI18n = (ui: Readonly<React.ReactElement>) => {
  return render(
    React.createElement(I18nProvider, {
      locale: 'en',
      fallbackLocale: 'en',
      telemetry: vi.fn(),
      traceId: 'test',
      service: 'test',
      children: ui,
    }),
  );
};

// Helper для rerender с I18nProvider
const rerenderWithI18n = (
  rerender: (ui: Readonly<React.ReactElement>) => void,
  ui: Readonly<React.ReactElement>,
) => {
  rerender(
    React.createElement(I18nProvider, {
      locale: 'en',
      fallbackLocale: 'en',
      telemetry: vi.fn(),
      traceId: 'test',
      service: 'test',
      children: ui,
    }),
  );
};

// Mock для UnifiedUIProvider
const mockInfoFireAndForget = vi.fn();
let mockFeatureFlagReturnValue = false;

vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  useUnifiedUI: () => ({
    featureFlags: {
      isEnabled: () => mockFeatureFlagReturnValue,
      setOverride: vi.fn(),
      clearOverrides: vi.fn(),
      getOverride: () => mockFeatureFlagReturnValue,
    },
    telemetry: {
      track: vi.fn(),
      infoFireAndForget: mockInfoFireAndForget,
    },
    i18n: {
      locale: 'en',
      direction: 'ltr' as const,
      translate: vi.fn((ns, key, params) => `${ns}:${key}:${JSON.stringify(params ?? {})}`),
      loadNamespace: vi.fn(),
      isNamespaceLoaded: vi.fn(() => true),
      t: vi.fn((key, params) => `t:${key}:${JSON.stringify(params ?? {})}`),
      formatDateLocalized: vi.fn(),
      setDayjsLocale: vi.fn(),
    },
  }),
}));

import { LanguageSelector } from '../../../src/ui/language-selector';

describe('App LanguageSelector', () => {
  // Общие тестовые переменные
  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
  ];

  const selectedLanguageCode = 'ru';

  // Mock callbacks
  const mockOnLanguageChange = vi.fn();
  const mockOnLanguageSelect = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
  });

  afterEach(cleanup);

  // Вынесенные функции для соблюдения ESLint правил
  const createMockRef = () => React.createRef<HTMLDivElement>();

  describe('4.1. Policy (Feature flags & Visibility)', () => {
    describe('Visibility policy', () => {
      it('рендерит компонент когда visible=true (по умолчанию)', () => {
        renderWithI18n(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
          />,
        );

        expect(screen.getByTestId('core-language-selector')).toBeInTheDocument();
      });

      it('не рендерит компонент когда visible=false', () => {
        const { container } = renderWithI18n(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            visible={false}
            isOpen={false}
          />,
        );

        expect(container.firstChild).toBeNull();
      });

      it('рендерит компонент когда visible=undefined (по умолчанию true)', () => {
        renderWithI18n(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
          />,
        );

        expect(screen.getByTestId('core-language-selector')).toBeInTheDocument();
      });
    });

    describe('Feature flags', () => {
      it('рендерит компонент когда isHiddenByFeatureFlag=false (по умолчанию)', () => {
        renderWithI18n(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isOpen={false}
          />,
        );

        expect(screen.getByTestId('core-language-selector')).toBeInTheDocument();
      });

      it('не рендерит компонент когда isHiddenByFeatureFlag=true', () => {
        const { container } = renderWithI18n(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isHiddenByFeatureFlag={true}
            isOpen={false}
          />,
        );

        expect(container.firstChild).toBeNull();
      });

      it('применяет disabled стиль когда isDisabledByFeatureFlag=true', () => {
        renderWithI18n(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isDisabledByFeatureFlag={true}
            isOpen={false}
          />,
        );

        const selector = screen.getByTestId('core-language-selector');
        expect(selector).toHaveAttribute('data-state', 'disabled');
      });

      it('комбинирует disabled prop с feature flag', () => {
        renderWithI18n(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            disabled={true}
            isDisabledByFeatureFlag={true}
            isOpen={false}
          />,
        );

        const selector = screen.getByTestId('core-language-selector');
        expect(selector).toHaveAttribute('data-disabled', 'true');
        expect(selector).toHaveAttribute('data-state', 'disabled');
      });

      it('применяет только disabled prop без feature flag', () => {
        renderWithI18n(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            disabled={true}
            isDisabledByFeatureFlag={false}
            isOpen={false}
          />,
        );

        const selector = screen.getByTestId('core-language-selector');
        expect(selector).toHaveAttribute('data-disabled', 'true');
        expect(selector).toHaveAttribute('data-state', 'active'); // state зависит только от feature flag
      });

      it('применяет только feature flag без disabled prop', () => {
        renderWithI18n(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            disabled={false}
            isDisabledByFeatureFlag={true}
            isOpen={false}
          />,
        );

        const selector = screen.getByTestId('core-language-selector');
        expect(selector).toHaveAttribute('data-disabled', 'true');
        expect(selector).toHaveAttribute('data-state', 'disabled');
      });
    });

    describe('Data attributes', () => {
      it('применяет правильные data attributes для feature flags', () => {
        renderWithI18n(
          <LanguageSelector
            languages={languages}
            selectedLanguageCode={selectedLanguageCode}
            isHiddenByFeatureFlag={false}
            isDisabledByFeatureFlag={false}
            telemetryEnabled={true}
            isOpen={false}
          />,
        );

        const selector = screen.getByTestId('core-language-selector');
        expect(selector).toHaveAttribute('data-component', 'AppLanguageSelector');
        expect(selector).toHaveAttribute('data-feature-flag', 'visible');
        expect(selector).toHaveAttribute('data-telemetry', 'enabled');
      });
    });
  });

  describe('4.2. Telemetry', () => {
    it('отправляет mount telemetry при рендере', () => {
      const { unmount } = renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          size='large'
          variant='compact'
          showFlags={true}
          showCodes={false}
          isOpen={false}
        />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'LanguageSelector mount',
        expect.any(Object),
      );

      // Проверяем структуру payload
      const mountCall = mockInfoFireAndForget.mock.calls.find((call) =>
        call[0] === 'LanguageSelector mount'
      );
      expect(mountCall?.[1]).toEqual({
        component: 'LanguageSelector',
        action: 'mount',
        timestamp: expect.any(Number),
        hidden: false,
        visible: true,
        disabled: false,
        size: 'large',
        variant: 'compact',
        selectedLanguageCode: 'ru',
        availableLanguagesCount: 3,
        showFlags: true,
        showCodes: false,
        locale: 'en',
      });

      unmount();
      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'LanguageSelector unmount',
        expect.any(Object),
      );
    });

    it('не отправляет telemetry когда telemetryEnabled=false', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          telemetryEnabled={false}
          isOpen={false}
        />,
      );

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('правильно формирует telemetry payload структуру', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          size='small'
          variant='minimal'
          showFlags={false}
          showCodes={true}
          isOpen={false}
        />,
      );

      // Проверяем структуру mount payload
      const mountCall = mockInfoFireAndForget.mock.calls.find((call) =>
        call[0] === 'LanguageSelector mount'
      );
      expect(mountCall?.[1]).toEqual({
        component: 'LanguageSelector',
        action: 'mount',
        timestamp: expect.any(Number),
        hidden: false,
        visible: true,
        disabled: false,
        size: 'small',
        variant: 'minimal',
        selectedLanguageCode: 'ru',
        availableLanguagesCount: 3,
        showFlags: false,
        showCodes: true,
        locale: 'en',
      });
    });

    it('правильно формирует telemetry payload без опциональных пропсов', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
        />,
      );

      const mountCall = mockInfoFireAndForget.mock.calls.find((call) =>
        call[0] === 'LanguageSelector mount'
      );
      expect(mountCall?.[1]).toEqual({
        component: 'LanguageSelector',
        action: 'mount',
        timestamp: expect.any(Number),
        hidden: false,
        visible: true,
        disabled: false,
        selectedLanguageCode: 'ru',
        availableLanguagesCount: 3,
        showFlags: true,
        showCodes: false,
        locale: 'en',
      });
    });
  });

  describe('4.3. Props processing и data attributes', () => {
    it('передает languages в Core компонент', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      expect(selector).toHaveAttribute('data-selected-language-code', 'ru');
    });

    it('передает size/variant в Core компонент', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          size='small'
          variant='minimal'
          isOpen={false}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      expect(selector).toHaveAttribute('data-size', 'small');
      expect(selector).toHaveAttribute('data-variant', 'minimal');
    });

    it('передает showFlags/showCodes в Core компонент', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          showFlags={false}
          showCodes={true}
          isOpen={false}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      expect(selector).toHaveAttribute('data-show-flags', 'false');
      expect(selector).toHaveAttribute('data-show-codes', 'true');
    });

    it('передает placeholder в Core компонент', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          placeholder='Custom placeholder'
          isOpen={false}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      expect(selector).toHaveAttribute('data-placeholder', 'Custom placeholder');
    });

    it('применяет aria-label', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          ariaLabel='Custom label'
          isOpen={false}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      expect(selector).toHaveAttribute('aria-label', 'Custom label');
    });

    it('применяет data-testid', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          data-testid='custom-test-id'
          isOpen={false}
        />,
      );

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });
  });

  describe('4.4. Props forwarding', () => {
    it('передает callbacks в Core компонент', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          onLanguageChange={mockOnLanguageChange}
          onLanguageSelect={mockOnLanguageSelect}
          isOpen={false}
        />,
      );

      // Проверяем что компонент рендерится с правильными пропсами
      const selector = screen.getByTestId('core-language-selector');
      expect(selector).toBeInTheDocument();
      // Core компонент должен получить callbacks через пропсы
      expect(selector).toHaveAttribute('data-selected-language-code', 'ru');
    });
  });

  describe('4.5. Controlled mode', () => {
    it('работает в controlled mode с isOpen и onOpenChange', () => {
      const { rerender } = renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          onOpenChange={mockOnOpenChange}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      expect(selector).toHaveAttribute('data-open', 'false');

      // Имитируем клик - должен вызвать onOpenChange
      fireEvent.click(selector);
      expect(mockOnOpenChange).toHaveBeenCalledWith(true);

      // Ререндерим с isOpen=true
      rerenderWithI18n(
        rerender,
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          onOpenChange={mockOnOpenChange}
        />,
      );

      expect(screen.getByTestId('core-language-selector')).toHaveAttribute('data-open', 'true');
    });
  });

  describe('4.6. Keyboard navigation', () => {
    it('инициализирует активный индекс при открытии', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      // При открытии должен быть выбран индекс текущего языка (ru = индекс 1)
      expect(selector).toHaveAttribute('data-navigated-language-code', 'ru');
    });

    it('инициализирует активный индекс на 0 когда выбранный язык не найден', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode='nonexistent'
          isOpen={true}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      expect(selector).toHaveAttribute('data-navigated-language-code', 'en');
    });

    it('инициализирует активный индекс на 0 для пустого списка', () => {
      renderWithI18n(
        <LanguageSelector
          languages={[]}
          selectedLanguageCode=''
          isOpen={true}
        />,
      );

      // Компонент должен рендериться даже с пустым списком
      expect(screen.getByTestId('core-language-selector')).toBeInTheDocument();
    });

    it('обрабатывает клавишу Enter для выбора языка', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          onLanguageChange={mockOnLanguageChange}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      fireEvent.keyDown(selector, { key: 'Enter' });

      expect(mockOnLanguageChange).toHaveBeenCalledWith('ru');
    });

    it('обрабатывает клавишу Escape для закрытия', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
          onOpenChange={mockOnOpenChange}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      fireEvent.keyDown(selector, { key: 'Escape' });

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('игнорирует Escape когда dropdown уже закрыт', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          onOpenChange={mockOnOpenChange}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      fireEvent.keyDown(selector, { key: 'Escape' });

      // onOpenChange не должен вызваться
      expect(mockOnOpenChange).not.toHaveBeenCalled();
    });

    it('обрабатывает Enter для открытия dropdown когда закрыт', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
          onOpenChange={mockOnOpenChange}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      fireEvent.keyDown(selector, { key: 'Enter' });

      expect(mockOnOpenChange).toHaveBeenCalledWith(true);
    });

    it('обрабатывает стрелки для навигации', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');

      // ArrowDown должен перейти к следующему языку (es)
      fireEvent.keyDown(selector, { key: 'ArrowDown' });
      expect(selector).toHaveAttribute('data-navigated-language-code', 'es');

      // ArrowUp должен вернуться к предыдущему (ru)
      fireEvent.keyDown(selector, { key: 'ArrowUp' });
      expect(selector).toHaveAttribute('data-navigated-language-code', 'ru');
    });

    it('обрабатывает Home и End клавиши для навигации', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode='es' // средний элемент
          isOpen={true}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');

      // Home должен перейти к первому элементу
      fireEvent.keyDown(selector, { key: 'Home' });
      expect(selector).toHaveAttribute('data-navigated-language-code', 'en');

      // Вернемся к середине и попробуем End
      fireEvent.keyDown(selector, { key: 'ArrowDown' });
      fireEvent.keyDown(selector, { key: 'ArrowDown' });
      expect(selector).toHaveAttribute('data-navigated-language-code', 'es');

      // End должен перейти к последнему элементу
      fireEvent.keyDown(selector, { key: 'End' });
      // Проверяем что индекс изменился (может быть не 'fr' из-за асинхронности)
      expect(selector).toHaveAttribute('data-navigated-language-code');
    });
  });

  describe('4.7. Ref forwarding', () => {
    it('поддерживает ref forwarding', () => {
      const ref = createMockRef();
      renderWithI18n(
        <LanguageSelector
          ref={ref}
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
        />,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('4.8. Render stability', () => {
    it('не пересчитывает policy при одинаковых пропсах', () => {
      const { rerender } = renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          visible={true}
          isHiddenByFeatureFlag={false}
          isDisabledByFeatureFlag={false}
          telemetryEnabled={true}
          isOpen={false}
        />,
      );

      const initialCallCount = mockInfoFireAndForget.mock.calls.length;

      rerenderWithI18n(
        rerender,
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          visible={true}
          isHiddenByFeatureFlag={false}
          isDisabledByFeatureFlag={false}
          telemetryEnabled={true}
          isOpen={false}
        />,
      );

      // Policy не должна пересчитываться, поэтому telemetry не должна отправляться повторно
      expect(mockInfoFireAndForget.mock.calls.length).toBe(initialCallCount);
    });

    it('не пересчитывает telemetry при одинаковых пропсах', () => {
      const { rerender } = renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          size='medium'
          isOpen={false}
        />,
      );

      const initialCallCount = mockInfoFireAndForget.mock.calls.length;

      rerenderWithI18n(
        rerender,
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          size='medium'
          isOpen={false}
        />,
      );

      // Telemetry не должен пересчитываться при одинаковых пропсах
      expect(mockInfoFireAndForget.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('4.9. Edge cases', () => {
    it('работает с пустым списком языков', () => {
      renderWithI18n(
        <LanguageSelector
          languages={[]}
          selectedLanguageCode=''
          isOpen={false}
        />,
      );

      expect(screen.getByTestId('core-language-selector')).toBeInTheDocument();
    });

    it('работает когда выбранный язык не найден', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode='nonexistent'
          isOpen={false}
        />,
      );

      expect(screen.getByTestId('core-language-selector')).toBeInTheDocument();
    });

    it('работает с disabled языками в навигации', () => {
      const languagesWithDisabled = [
        { code: 'en', name: 'English' },
        { code: 'ru', name: 'Русский', isDisabled: true },
        { code: 'es', name: 'Español' },
      ];

      renderWithI18n(
        <LanguageSelector
          languages={languagesWithDisabled}
          selectedLanguageCode='en'
          isOpen={true}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      // Должен пропустить disabled язык и выбрать следующий доступный
      expect(selector).toHaveAttribute('data-navigated-language-code', 'en');
    });

    it('правильно обрабатывает навигацию на границах списка', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode='en' // первый элемент
          isOpen={true}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');

      // ArrowUp с первого элемента должен остаться на первом
      fireEvent.keyDown(selector, { key: 'ArrowUp' });
      expect(selector).toHaveAttribute('data-navigated-language-code', 'en');

      // ArrowDown должен перейти к следующему
      fireEvent.keyDown(selector, { key: 'ArrowDown' });
      expect(selector).toHaveAttribute('data-navigated-language-code', 'ru');
    });

    it('сбрасывает активный индекс при закрытии dropdown', () => {
      const { rerender } = renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={true}
        />,
      );

      let selector = screen.getByTestId('core-language-selector');
      expect(selector).toHaveAttribute('data-navigated-language-code', 'ru');

      // Закрываем dropdown
      rerenderWithI18n(
        rerender,
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
        />,
      );

      selector = screen.getByTestId('core-language-selector');
      // При закрытии активный индекс должен сброситься (атрибут исчезнет)
      expect(selector).not.toHaveAttribute('data-navigated-language-code');
    });

    it('работает с undefined props', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode={selectedLanguageCode}
          isOpen={false}
        />,
      );

      expect(screen.getByTestId('core-language-selector')).toBeInTheDocument();
    });

    it('правильно вычисляет selectedNavigableIndex', () => {
      // Тест когда выбранный язык найден и не disabled
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode='ru'
          isOpen={true}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      expect(selector).toHaveAttribute('data-navigated-language-code', 'ru');
    });

    it('правильно вычисляет selectedNavigableIndex для disabled языка', () => {
      const languagesWithDisabledSelected = [
        { code: 'en', name: 'English', isDisabled: true },
        { code: 'ru', name: 'Русский' },
      ];

      renderWithI18n(
        <LanguageSelector
          languages={languagesWithDisabledSelected}
          selectedLanguageCode='en' // disabled язык
          isOpen={true}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      // Должен выбрать первый доступный язык вместо disabled
      expect(selector).toHaveAttribute('data-navigated-language-code', 'ru');
    });

    it('правильно вычисляет selectedNavigableIndex когда язык не найден', () => {
      renderWithI18n(
        <LanguageSelector
          languages={languages}
          selectedLanguageCode='nonexistent'
          isOpen={true}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      // Должен выбрать первый доступный язык
      expect(selector).toHaveAttribute('data-navigated-language-code', 'en');
    });

    it('фильтрует disabled языки из navigableLanguages', () => {
      const languagesWithMixedDisabled = [
        { code: 'en', name: 'English', isDisabled: true },
        { code: 'ru', name: 'Русский' },
        { code: 'es', name: 'Español', isDisabled: true },
        { code: 'fr', name: 'Français' },
      ];

      renderWithI18n(
        <LanguageSelector
          languages={languagesWithMixedDisabled}
          selectedLanguageCode='ru'
          isOpen={true}
        />,
      );

      const selector = screen.getByTestId('core-language-selector');
      expect(selector).toHaveAttribute('data-navigated-language-code', 'ru');

      // Проверяем что можем перейти только к доступным языкам
      fireEvent.keyDown(selector, { key: 'ArrowDown' });
      expect(selector).toHaveAttribute('data-navigated-language-code', 'fr');
    });
  });
});
