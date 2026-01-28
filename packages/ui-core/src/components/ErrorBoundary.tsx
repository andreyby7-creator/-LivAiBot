/**
 * @file packages/ui-core/src/components/ErrorBoundary.tsx
 * ============================================================================
 * 🔵 CORE UI ERROR BOUNDARY — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-компонент для перехвата и отображения ошибок React
 * - Полностью детерминированный fallback UI
 * - SSR-safe, Concurrent-safe
 *
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием ошибок (только отображение)
 * - Логику восстановления (только отображение fallback)
 *
 * Управление:
 * - Обработкой ошибок и восстановлением управляет App-слой
 */

import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import type { UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

export type CoreErrorBoundaryProps = Readonly<{
  /** Дочерние компоненты, которые могут выбросить ошибку */
  children: ReactNode;

  /** Fallback UI для отображения при ошибке. Если функция, то errorInfo всегда non-null (гарантируется компонентом). */
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode);

  /** Callback при перехвате ошибки */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /** Callback при сбросе ошибки (reset) */
  onReset?: () => void;

  /** Текст на кнопке сброса ошибки. По умолчанию 'Попробовать снова'. Кнопка всегда рендерится в дефолтном fallback. */
  resetLabel?: string;

  /** Показывать ли stack trace в дефолтном fallback UI (для debug режима). По умолчанию false. */
  showStack?: boolean;

  /** Test ID для автотестов */
  'data-testid'?: UITestId;
}>;

type CoreErrorBoundaryState = Readonly<{
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}>;

/* ============================================================================
 * 🎨 BASE STYLES
 * ========================================================================== */

const ERROR_CONTAINER_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  minHeight: '200px',
  textAlign: 'center',
};

const ERROR_TITLE_STYLE: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: 'var(--error-boundary-title-color, #DC2626)',
  margin: '0 0 12px 0',
};

const ERROR_MESSAGE_STYLE: React.CSSProperties = {
  fontSize: '14px',
  color: 'var(--error-boundary-text-color, #6B7280)',
  margin: '0 0 16px 0',
  maxWidth: '600px',
};

const ERROR_RESET_BUTTON_STYLE: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: '500',
  cursor: 'pointer',
  border: '1px solid var(--error-boundary-button-border-color, #DC2626)',
  backgroundColor: 'var(--error-boundary-button-bg, #DC2626)',
  color: 'var(--error-boundary-button-text-color, #FFFFFF)',
  transition: 'background-color 0.2s ease, opacity 0.2s ease',
};

const ERROR_STACK_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--error-boundary-stack-color, #9CA3AF)',
  margin: '16px 0 0 0',
  padding: '12px',
  backgroundColor: 'var(--error-boundary-stack-bg, #F3F4F6)',
  borderRadius: '4px',
  textAlign: 'left',
  maxWidth: '100%',
  overflow: 'auto',
  fontFamily: 'monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const ERROR_STACK_SUMMARY_STYLE: React.CSSProperties = {
  cursor: 'pointer',
  marginBottom: '8px',
};

/* ============================================================================
 * 🎯 CORE ERROR BOUNDARY
 * ========================================================================== */

/**
 * Core ErrorBoundary компонент.
 * Классовый компонент, так как Error Boundary в React может быть только классовым.
 *
 * @example
 * Базовое использование:
 * ```tsx
 * <CoreErrorBoundary>
 *   <ComponentThatMightThrow />
 * </CoreErrorBoundary>
 * ```
 *
 * @example
 * Расширенное использование с кастомным fallback и обработкой ошибок:
 * ```tsx
 * <CoreErrorBoundary
 *   // Вариант 1: fallback как функция (errorInfo всегда non-null, проверки не нужны)
 *   fallback={(error, errorInfo) => (
 *     <div>
 *       Что-то пошло не так: {error.message}
 *       <button onClick={() => window.location.reload()}>Перезагрузить</button>
 *     </div>
 *   )}
 *   // Вариант 2: fallback как ReactNode
 *   // fallback={<CustomErrorComponent />}
 *   // Показывать stack trace в debug режиме для диагностики
 *   showStack={process.env.NODE_ENV === 'development'}
 *   onError={(error, errorInfo) => {
 *     console.error('Error caught:', error, errorInfo);
 *     sendToErrorTracking(error);
 *   }}
 *   resetLabel="Попробовать снова"
 * >
 *   <ComponentThatMightThrow />
 * </CoreErrorBoundary>
 * ```
 *
 * @note
 * Компонент является классовым и не может быть обёрнут в React.memo.
 * Для оптимизации используйте мемоизацию дочерних компонентов.
 */
export class CoreErrorBoundary extends Component<
  CoreErrorBoundaryProps,
  CoreErrorBoundaryState
> {
  constructor(props: CoreErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Обновляет состояние при возникновении ошибки.
   * Вызывается React автоматически при ошибке в дочерних компонентах.
   */
  static getDerivedStateFromError(error: Error): Partial<CoreErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Вызывается после того, как компонент получил ошибку.
   * Используется для логирования и side-effects.
   */
  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Используем functional setState для защиты от race conditions
    this.setState((prev) => ({
      ...prev,
      error,
      errorInfo,
    }));

    // Вызываем callback для обработки ошибки в App слое
    this.props.onError?.(error, errorInfo);
  }

  /** Сброс состояния ошибки. Вызывается из fallback UI для восстановления. */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    this.props.onReset?.();
  };

  /** Рендерит fallback UI или дочерние компоненты. */
  override render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const {
      children,
      fallback,
      resetLabel = 'Попробовать снова',
      showStack = false,
      'data-testid': testId,
    } = this.props;

    if (!hasError || !error) {
      return children;
    }

    // Если передан кастомный fallback
    if (fallback !== undefined) {
      if (typeof fallback === 'function') {
        // Безопасная типизация errorInfo для передачи в функцию
        const safeErrorInfo: ErrorInfo = errorInfo ?? { componentStack: '' };
        return fallback(error, safeErrorInfo);
      }
      return fallback;
    }

    // Дефолтный fallback UI
    const stackTrace = error.stack ?? errorInfo?.componentStack ?? null;

    return (
      <div
        role='alert'
        aria-live='assertive'
        data-component='CoreErrorBoundary'
        data-state='error'
        data-testid={testId}
        style={ERROR_CONTAINER_STYLE}
      >
        <h2
          style={ERROR_TITLE_STYLE}
          {...(testId != null && testId !== '' && { 'data-testid': `${testId}-title` })}
        >
          Произошла ошибка
        </h2>
        <p
          style={ERROR_MESSAGE_STYLE}
          {...(testId != null && testId !== '' && { 'data-testid': `${testId}-message` })}
        >
          {error.message || 'Неизвестная ошибка'}
        </p>
        {showStack && stackTrace != null && (
          <details
            tabIndex={0}
            style={ERROR_STACK_STYLE}
            {...(testId != null && testId !== '' && { 'data-testid': `${testId}-stack` })}
          >
            <summary style={ERROR_STACK_SUMMARY_STYLE}>Stack trace</summary>
            {stackTrace}
          </details>
        )}
        <button
          type='button'
          onClick={this.handleReset}
          style={ERROR_RESET_BUTTON_STYLE}
          aria-label={resetLabel}
          {...(testId != null && testId !== '' && { 'data-testid': `${testId}-reset` })}
        >
          {resetLabel}
        </button>
      </div>
    );
  }
}

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * ========================================================================== */

/**
 * CoreErrorBoundary — это чистый presentational primitive:
 *
 * - Перехватывает ошибки в дочерних компонентах
 * - Отображает fallback UI при ошибке
 * - Поддерживает кастомный fallback через props
 * - Вызывает callbacks для обработки ошибок в App слое
 *
 * Любая бизнес-логика:
 * - когда показывать fallback
 * - что делать при ошибке (telemetry, логирование)
 * - логика восстановления
 *
 * должна реализовываться на App-слое.
 *
 * Это гарантирует:
 * - переиспользуемость
 * - тестируемость
 * - архитектурную чистоту
 *
 * CSS Contract
 *
 * Компонент использует следующие CSS Variables для кастомизации через app theme:
 *
 * - --error-boundary-title-color: цвет заголовка ошибки (default: #DC2626)
 * - --error-boundary-text-color: цвет текста сообщения (default: #6B7280)
 * - --error-boundary-button-border-color: цвет границы кнопки сброса (default: #DC2626)
 * - --error-boundary-button-bg: цвет фона кнопки сброса (default: #DC2626)
 * - --error-boundary-button-text-color: цвет текста кнопки сброса (default: #FFFFFF)
 * - --error-boundary-stack-color: цвет текста stack trace (default: #9CA3AF)
 * - --error-boundary-stack-bg: цвет фона stack trace (default: #F3F4F6)
 *
 * Это превращает компонент в UI protocol, не просто в компонент.
 *
 * Reset Button Contract
 *
 * В дефолтном fallback UI кнопка reset всегда рендерится с текстом из resetLabel
 * (по умолчанию 'Попробовать снова'). Кнопка имеет type='button' для предотвращения
 * submit в формах и aria-label для accessibility.
 *
 * Fallback Function Contract
 *
 * Если fallback передан как функция, то errorInfo всегда non-null (гарантируется компонентом).
 * App-слой не должен делать проверки на null/undefined для errorInfo в fallback функции.
 * Компонент автоматически предоставляет безопасное значение { componentStack: '' } если errorInfo отсутствует.
 */
