/**
 * @vitest-environment jsdom
 * @file Тесты для App ErrorBoundary компонента с 100% покрытием
 */

import type { ErrorInfo, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/* ============================================================================
 * Mocks
 * ========================================================================== */

type CoreErrorBoundaryMockProps = Readonly<{
  children: ReactNode;
  fallback?: ReactNode | ((error: Readonly<Error>, errorInfo: Readonly<ErrorInfo>) => ReactNode);
  resetLabel?: string;
  showStack?: boolean;
  onError?: (error: Readonly<Error>, errorInfo: Readonly<ErrorInfo>) => void;
  onReset?: () => void;
  'data-testid'?: string;
  'data-component'?: string;
  'data-state'?: string;
  'data-disabled'?: string;
  'data-feature-flag'?: string;
  'data-telemetry'?: string;
}>;

let lastCoreProps: CoreErrorBoundaryMockProps | null = null;

vi.mock('../../../../ui-core/src/components/ErrorBoundary', () => ({
  CoreErrorBoundary: (props: Readonly<Record<string, unknown>>) => {
    const typedProps = props as unknown as CoreErrorBoundaryMockProps;
    lastCoreProps = typedProps;
    return (
      <div
        data-testid={typedProps['data-testid'] ?? 'core-error-boundary'}
        data-component={typedProps['data-component']}
        data-state={typedProps['data-state']}
        data-disabled={typedProps['data-disabled']}
        data-feature-flag={typedProps['data-feature-flag']}
        data-telemetry={typedProps['data-telemetry']}
      >
        <div data-testid='core-children'>{typedProps.children}</div>
      </div>
    );
  },
}));

vi.mock('../../../src/lib/telemetry', () => ({
  infoFireAndForget: vi.fn(),
  errorFireAndForget: vi.fn(),
}));

import { ErrorBoundary } from '../../../src/ui/error-boundary';
import { errorFireAndForget, infoFireAndForget } from '../../../src/lib/telemetry';

const mockInfoFireAndForget = vi.mocked(infoFireAndForget);
const mockErrorFireAndForget = vi.mocked(errorFireAndForget);

/* ============================================================================
 * Helpers
 * ========================================================================== */

const testChild = <div data-testid='child'>Child</div>;

const createErrorInfo = (): Readonly<ErrorInfo> => ({ componentStack: 'TestStack' });

const createTestError = (): Readonly<Error> => {
  const err = new Error('Boom');
  err.name = 'TestError';
  return err;
};

/* ============================================================================
 * Tests
 * ========================================================================== */

describe('ErrorBoundary (App UI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastCoreProps = null;
  });

  afterEach(() => {
    cleanup();
  });

  it('возвращает children напрямую когда isHiddenByFeatureFlag=true (не монтирует core и не шлёт telemetry)', () => {
    render(<ErrorBoundary isHiddenByFeatureFlag={true}>{testChild}</ErrorBoundary>);

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByTestId('core-error-boundary')).not.toBeInTheDocument();

    expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    expect(mockErrorFireAndForget).not.toHaveBeenCalled();
  });

  it('шлёт mount/unmount telemetry и выставляет базовые data-атрибуты', () => {
    const { unmount } = render(<ErrorBoundary>{testChild}</ErrorBoundary>);

    const core = screen.getByTestId('core-error-boundary');
    expect(core).toBeInTheDocument();
    expect(core).toHaveAttribute('data-component', 'AppErrorBoundary');
    expect(core).toHaveAttribute('data-state', 'normal');
    expect(core).toHaveAttribute('data-feature-flag', 'visible');
    expect(core).toHaveAttribute('data-telemetry', 'enabled');
    expect(core).not.toHaveAttribute('data-disabled');

    expect(mockInfoFireAndForget).toHaveBeenCalledTimes(1);
    expect(mockInfoFireAndForget).toHaveBeenCalledWith('ErrorBoundary mount', {
      component: 'ErrorBoundary',
      action: 'mount',
      hidden: false,
      disabled: false,
      hasError: false,
    });

    unmount();

    expect(mockInfoFireAndForget).toHaveBeenCalledTimes(2);
    expect(mockInfoFireAndForget).toHaveBeenLastCalledWith('ErrorBoundary unmount', {
      component: 'ErrorBoundary',
      action: 'unmount',
      hidden: false,
      disabled: false,
      hasError: false,
    });
  });

  it('обрабатывает ошибку: обновляет data-state, шлёт error telemetry и вызывает onError', async () => {
    const mockOnError = vi.fn();

    render(
      <ErrorBoundary onError={mockOnError} data-testid='app-boundary'>
        {testChild}
      </ErrorBoundary>,
    );

    expect(lastCoreProps).not.toBeNull();
    const propsSnapshot = lastCoreProps as CoreErrorBoundaryMockProps;
    const err = createTestError();
    const info = createErrorInfo();

    await act(async () => {
      propsSnapshot.onError?.(err, info);
    });

    const core = screen.getByTestId('app-boundary');
    expect(core).toHaveAttribute('data-state', 'error');

    expect(mockErrorFireAndForget).toHaveBeenCalledTimes(2);

    // Первый вызов - маппинг ошибки
    expect(mockErrorFireAndForget).toHaveBeenNthCalledWith(1, 'ErrorBoundary error mapped', {
      originalErrorType: 'Error',
      mappedErrorCode: 'UNKNOWN_ERROR',
      errorMessage: 'Boom',
    });

    // Второй вызов - основная ошибка
    expect(mockErrorFireAndForget).toHaveBeenNthCalledWith(2, 'ErrorBoundary error', {
      component: 'ErrorBoundary',
      action: 'error',
      hidden: false,
      disabled: false,
      hasError: true,
      errorCode: 'UnknownError',
      errorMessage: 'Boom',
    });

    expect(mockOnError).toHaveBeenCalledTimes(1);
    expect(mockOnError).toHaveBeenCalledWith(err, info);
  });

  it('обрабатывает reset: шлёт reset telemetry, обновляет data-state и вызывает onReset', async () => {
    const mockOnReset = vi.fn();

    render(
      <ErrorBoundary onReset={mockOnReset} data-testid='app-boundary'>
        {testChild}
      </ErrorBoundary>,
    );

    const err = createTestError();
    const info = createErrorInfo();

    await act(async () => {
      (lastCoreProps as CoreErrorBoundaryMockProps).onError?.(err, info);
    });

    expect(screen.getByTestId('app-boundary')).toHaveAttribute('data-state', 'error');

    await act(async () => {
      (lastCoreProps as CoreErrorBoundaryMockProps).onReset?.();
    });

    expect(screen.getByTestId('app-boundary')).toHaveAttribute('data-state', 'normal');

    expect(mockInfoFireAndForget).toHaveBeenCalledWith('ErrorBoundary reset', {
      component: 'ErrorBoundary',
      action: 'reset',
      hidden: false,
      disabled: false,
      hasError: false,
    });

    expect(mockOnReset).toHaveBeenCalledTimes(1);
  });

  it('не шлёт telemetry если telemetryEnabled=false (включая mount/error/reset/unmount) и выставляет data-telemetry="disabled"', async () => {
    const { unmount } = render(
      <ErrorBoundary telemetryEnabled={false} data-testid='app-boundary'>
        {testChild}
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('app-boundary')).toHaveAttribute('data-telemetry', 'disabled');

    const err = createTestError();
    const info = createErrorInfo();

    await act(async () => {
      (lastCoreProps as CoreErrorBoundaryMockProps).onError?.(err, info);
    });

    await act(async () => {
      (lastCoreProps as CoreErrorBoundaryMockProps).onReset?.();
    });

    unmount();

    expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    expect(mockErrorFireAndForget).not.toHaveBeenCalled();
  });

  it('прокидывает optional props в Core и выставляет data-disabled при isDisabledByFeatureFlag=true', async () => {
    const fallback = <div data-testid='fallback'>Fallback</div>;

    render(
      <ErrorBoundary
        isDisabledByFeatureFlag={true}
        resetLabel='Try again'
        showStack={true}
        fallback={fallback}
        data-testid='app-boundary'
      >
        {testChild}
      </ErrorBoundary>,
    );

    expect(screen.getByTestId('app-boundary')).toHaveAttribute('data-disabled', 'disabled');

    expect(lastCoreProps).not.toBeNull();
    expect((lastCoreProps as CoreErrorBoundaryMockProps).resetLabel).toBe('Try again');
    expect((lastCoreProps as CoreErrorBoundaryMockProps).showStack).toBe(true);
    // fallback теперь функция, проверяем что она возвращает ожидаемый элемент
    const fallbackFn = (lastCoreProps as CoreErrorBoundaryMockProps).fallback as (
      error: Readonly<Error>,
      errorInfo: Readonly<ErrorInfo>,
    ) => ReactNode;
    expect(typeof fallbackFn).toBe('function');
    expect(fallbackFn(new Error('test'), { componentStack: '' })).toEqual(fallback);

    // Покрываем ветку memoization: повторный setState без изменения deps
    await act(async () => {
      (lastCoreProps as CoreErrorBoundaryMockProps).onReset?.();
    });

    expect(screen.getByTestId('app-boundary')).toHaveAttribute('data-state', 'normal');
  });

  it('не пересоздаёт Core props при rerender с теми же зависимостями (memoization ветка без изменений)', () => {
    const { rerender } = render(
      <ErrorBoundary data-testid='app-boundary'>{testChild}</ErrorBoundary>,
    );

    const firstPropsRef = lastCoreProps;
    expect(firstPropsRef).not.toBeNull();

    rerender(<ErrorBoundary data-testid='app-boundary'>{testChild}</ErrorBoundary>);

    expect(lastCoreProps).toBe(firstPropsRef);
  });

  it('не ломает UI если telemetry бросает исключение (try/catch защита)', async () => {
    // Проверяем что UI продолжает работать даже если telemetry падает
    let telemetryCallCount = 0;
    mockErrorFireAndForget.mockImplementation(() => {
      telemetryCallCount++;
      if (telemetryCallCount === 1) {
        throw new Error('Telemetry down');
      }
      // Второй вызов (из handleError) проходит нормально
    });

    render(<ErrorBoundary data-testid='app-boundary'>{testChild}</ErrorBoundary>);

    const err = createTestError();
    const info = createErrorInfo();

    // Ожидаем что handleError выполнится несмотря на ошибки telemetry
    await act(async () => {
      (lastCoreProps as CoreErrorBoundaryMockProps).onError?.(err, info);
    });

    // Проверяем что состояние изменилось несмотря на ошибки telemetry
    expect(screen.getByTestId('app-boundary')).toHaveAttribute('data-state', 'error');
    expect(telemetryCallCount).toBeGreaterThan(0);
  });
});
