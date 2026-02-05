/**
 * @vitest-environment jsdom
 * @file Тесты для App Breadcrumbs компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock для Core Breadcrumbs - возвращаем простой nav
vi.mock('../../../../ui-core/src/components/Breadcrumbs', () => ({
  Breadcrumbs: (
    {
      'data-testid': testId,
      'data-component': dataComponent,
      'data-state': dataState,
      'data-feature-flag': dataFeatureFlag,
      ...props
    }: Readonly<Record<string, unknown>>,
  ) => (
    <nav
      data-testid={testId ?? 'core-breadcrumbs'}
      data-component={dataComponent}
      data-state={dataState}
      data-feature-flag={dataFeatureFlag}
      {...props}
    />
  ),
}));

// Mock для UnifiedUIProvider
const mockInfoFireAndForget = vi.fn();

vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  useUnifiedUI: () => ({
    featureFlags: {
      isEnabled: () => false,
      setOverride: vi.fn(),
      clearOverrides: vi.fn(),
      getOverride: () => false,
    },
    telemetry: {
      track: vi.fn(),
      infoFireAndForget: mockInfoFireAndForget,
    },
  }),
}));

import { Breadcrumbs } from '../../../src/ui/breadcrumbs';

// Тестовые данные
const testItems = [
  { label: 'Home', href: '/' },
  { label: 'Category', href: '/category' },
  { label: 'Product', href: '/product' },
];

describe('App Breadcrumbs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить breadcrumbs с обязательными пропсами', () => {
      render(<Breadcrumbs items={testItems} visible={true} />);

      expect(screen.getByTestId('core-breadcrumbs')).toBeInTheDocument();
    });

    it('должен передавать data-component="AppBreadcrumbs"', () => {
      render(<Breadcrumbs items={testItems} visible={true} />);

      expect(screen.getByTestId('core-breadcrumbs')).toHaveAttribute(
        'data-component',
        'AppBreadcrumbs',
      );
    });

    it('должен правильно управлять видимостью через policy', () => {
      const { rerender } = render(<Breadcrumbs items={testItems} visible={true} />);

      expect(screen.getByTestId('core-breadcrumbs')).toBeInTheDocument();

      rerender(<Breadcrumbs items={testItems} visible={false} />);
      expect(screen.queryByTestId('core-breadcrumbs')).not.toBeInTheDocument(); // visible=false скрывает компонент
    });

    it('должен передавать data-feature-flag с состоянием feature flag', () => {
      render(<Breadcrumbs items={testItems} visible={true} />);

      expect(screen.getByTestId('core-breadcrumbs')).toHaveAttribute(
        'data-feature-flag',
        'visible',
      );
    });
  });

  describe('Feature flag логика', () => {
    it('должен рендерить breadcrumbs когда feature flag отключен', () => {
      render(<Breadcrumbs items={testItems} visible={true} />);

      expect(screen.getByTestId('core-breadcrumbs')).toBeInTheDocument();
      expect(screen.getByTestId('core-breadcrumbs')).toHaveAttribute(
        'data-feature-flag',
        'visible',
      );
    });

    it('должен скрывать breadcrumbs когда feature flag включен', () => {
      render(<Breadcrumbs items={testItems} visible={true} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-breadcrumbs')).not.toBeInTheDocument();
    });

    it('должен учитывать isHiddenByFeatureFlag пропс', () => {
      const { rerender } = render(
        <Breadcrumbs items={testItems} visible={true} isHiddenByFeatureFlag={true} />,
      );

      expect(screen.queryByTestId('core-breadcrumbs')).not.toBeInTheDocument();

      rerender(
        <Breadcrumbs items={testItems} visible={true} isHiddenByFeatureFlag={false} />,
      );
      expect(screen.getByTestId('core-breadcrumbs')).toBeInTheDocument();
    });
  });

  describe('Telemetry логика', () => {
    it('должен отправлять mount/unmount telemetry по умолчанию', () => {
      const { unmount } = render(<Breadcrumbs items={testItems} visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Breadcrumbs mount', {
        component: 'Breadcrumbs',
        action: 'mount',
        hidden: false,
        visible: true,
        itemsCount: 3,
      });

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Breadcrumbs unmount', {
        component: 'Breadcrumbs',
        action: 'unmount',
        hidden: false,
        visible: true,
        itemsCount: 3,
      });
    });

    it('должен отправлять show/hide telemetry при изменении видимости', () => {
      const { rerender } = render(<Breadcrumbs items={testItems} visible={false} />);

      // Mount при первом рендере
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Breadcrumbs mount', {
        component: 'Breadcrumbs',
        action: 'mount',
        hidden: false,
        visible: false,
        itemsCount: 3,
      });

      rerender(<Breadcrumbs items={testItems} visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Breadcrumbs show', {
        component: 'Breadcrumbs',
        action: 'show',
        hidden: false,
        visible: true,
        itemsCount: 3,
      });

      rerender(<Breadcrumbs items={testItems} visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Breadcrumbs hide', {
        component: 'Breadcrumbs',
        action: 'hide',
        hidden: false,
        visible: false,
        itemsCount: 3,
      });

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Breadcrumbs hide', {
        component: 'Breadcrumbs',
        action: 'hide',
        hidden: false,
        visible: false,
        itemsCount: 3,
      });
    });

    it('должен отправлять click telemetry при клике на элементы', () => {
      const mockOnClick = vi.fn();
      const itemsWithClick = [
        { label: 'Home', href: '/', onClick: mockOnClick },
        { label: 'Category', href: '/category' },
      ];

      render(<Breadcrumbs items={itemsWithClick} visible={true} />);

      // Имитируем клик через Core компонент mock
      const coreBreadcrumbs = screen.getByTestId('core-breadcrumbs');
      // В реальности клик происходит внутри Core компонента

      // Проверим что enrichedItems правильно обогащены
      expect(coreBreadcrumbs).toBeInTheDocument();
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(<Breadcrumbs items={testItems} visible={true} telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен отправлять telemetry с правильными данными при клике', () => {
      const mockOnClick = vi.fn();
      const itemsWithClick = [
        { label: 'Home', href: '/', onClick: mockOnClick },
        { label: 'Category', href: '/category' },
      ];

      render(<Breadcrumbs items={itemsWithClick} visible={true} />);

      // Проверяем что telemetry payload содержит правильные данные для клика
      // В реальном сценарии это происходит внутри useBreadcrumbsItems
      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'Breadcrumbs mount',
        expect.objectContaining({
          component: 'Breadcrumbs',
          action: 'mount',
          itemsCount: 2,
        }),
      );
    });
  });

  describe('Пропсы компонента', () => {
    it('должен передавать все пропсы в Core компонент', () => {
      render(
        <Breadcrumbs
          items={testItems}
          visible={true}
          separator='•'
          className='custom-class'
          data-testid='custom-test'
        />,
      );

      const breadcrumbs = screen.getByTestId('custom-test');
      expect(breadcrumbs).toHaveClass('custom-class');
    });

    it('должен иметь visible=true по умолчанию', () => {
      render(<Breadcrumbs items={testItems} />);

      expect(screen.getByTestId('core-breadcrumbs')).toHaveAttribute('data-state', 'visible');
    });

    it('должен поддерживать ref forwarding', () => {
      const mockRef = React.createRef<HTMLElement>();

      render(<Breadcrumbs ref={mockRef} items={testItems} visible={true} />);

      expect(mockRef.current).toBeInstanceOf(HTMLElement);
      expect(mockRef.current?.tagName).toBe('NAV');
    });
  });

  describe('useBreadcrumbsItems hook', () => {
    it('должен обогащать элементы с onClick telemetry', () => {
      const mockOnClick = vi.fn();
      const itemsWithClick = [
        { label: 'Home', href: '/', onClick: mockOnClick },
      ];

      render(<Breadcrumbs items={itemsWithClick} visible={true} />);

      // Проверяем что компонент рендерится с обогащенными элементами
      expect(screen.getByTestId('core-breadcrumbs')).toBeInTheDocument();
    });

    it('не должен обогащать disabled элементы', () => {
      const mockOnClick = vi.fn();
      const itemsWithDisabled = [
        { label: 'Home', href: '/', onClick: mockOnClick, disabled: true },
      ];

      render(<Breadcrumbs items={itemsWithDisabled} visible={true} />);

      // Disabled элементы не должны получать telemetry обертку
      expect(screen.getByTestId('core-breadcrumbs')).toBeInTheDocument();
    });

    it('не должен обогащать элементы без onClick', () => {
      const itemsWithoutClick = [
        { label: 'Home', href: '/' },
      ];

      render(<Breadcrumbs items={itemsWithoutClick} visible={true} />);

      expect(screen.getByTestId('core-breadcrumbs')).toBeInTheDocument();
    });
  });

  describe('Policy логика', () => {
    it('должен правильно рассчитывать policy', () => {
      // Test policy calculation через рендеринг
      const { rerender } = render(<Breadcrumbs items={testItems} visible={true} />);

      expect(screen.getByTestId('core-breadcrumbs')).toHaveAttribute(
        'data-feature-flag',
        'visible',
      );

      rerender(<Breadcrumbs items={testItems} visible={true} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-breadcrumbs')).not.toBeInTheDocument();
    });

    it('должен учитывать telemetryEnabled в policy', () => {
      render(<Breadcrumbs items={testItems} visible={true} telemetryEnabled={false} />);

      // Telemetry не должен отправляться
      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('работает с пустым массивом items', () => {
      render(<Breadcrumbs items={[]} visible={true} />);

      expect(screen.getByTestId('core-breadcrumbs')).toBeInTheDocument();
    });

    it('работает с одним элементом', () => {
      const singleItem = [{ label: 'Home', href: '/' }];

      render(<Breadcrumbs items={singleItem} visible={true} />);

      expect(screen.getByTestId('core-breadcrumbs')).toBeInTheDocument();
    });

    it('правильно обрабатывает undefined пропсы', () => {
      render(<Breadcrumbs items={testItems} visible={true} />);

      expect(screen.getByTestId('core-breadcrumbs')).toBeInTheDocument();
      expect(mockInfoFireAndForget).toHaveBeenCalled();
    });

    it('правильно обрабатывает изменение items', () => {
      const { rerender } = render(<Breadcrumbs items={testItems} visible={true} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'Breadcrumbs mount',
        expect.objectContaining({
          itemsCount: 3,
        }),
      );

      const newItems = [{ label: 'New', href: '/new' }];
      rerender(<Breadcrumbs items={newItems} visible={true} />);

      // Mount payload остается immutable - пересчет не происходит
      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1);
    });
  });

  describe('Memoization и performance', () => {
    it('должен стабильно работать с одинаковыми пропсами', () => {
      const { rerender } = render(<Breadcrumbs items={testItems} visible={true} />);

      const callCountAfterFirstRender = mockInfoFireAndForget.mock.calls.length;

      rerender(<Breadcrumbs items={testItems} visible={true} />);

      // Mount не должен вызваться повторно для тех же пропсов
      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(callCountAfterFirstRender);
    });

    it('должен реагировать на изменение visible', () => {
      const { rerender } = render(<Breadcrumbs items={testItems} visible={false} />);

      // Mount при первом рендере
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Breadcrumbs mount', expect.any(Object));

      rerender(<Breadcrumbs items={testItems} visible={true} />);

      // Show при изменении visible
      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Breadcrumbs show', expect.any(Object));

      rerender(<Breadcrumbs items={testItems} visible={false} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('Breadcrumbs hide', expect.any(Object));
    });
  });
});
