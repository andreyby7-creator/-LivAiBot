/**
 * @file packages/app/src/ui/error-boundary.tsx
 * ============================================================================
 * 🟥 APP UI ERROR BOUNDARY — UI МИКРОСЕРВИС ERROR BOUNDARY
 * ============================================================================
 *
 * Единственная точка входа для ErrorBoundary в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / disabled)
 * - Telemetry
 * - Feature flags
 * - Обработка и логирование ошибок
 *
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 *
 * Архитектурные решения:
 * - Управление обработкой ошибок и восстановлением обрабатывается в App слое
 * - CoreErrorBoundary остается полностью presentational
 */

import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

import { CoreErrorBoundary } from '../../../ui-core/src/components/ErrorBoundary.js';
import type { CoreErrorBoundaryProps } from '../../../ui-core/src/components/ErrorBoundary.js';
import { errorFireAndForget, infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

const ErrorBoundaryTelemetryAction = {
  Mount: 'mount',
  Unmount: 'unmount',
  Error: 'error',
  Reset: 'reset',
} as const;

type ErrorBoundaryTelemetryAction =
  typeof ErrorBoundaryTelemetryAction[keyof typeof ErrorBoundaryTelemetryAction];

type ErrorBoundaryTelemetryPayload = {
  component: 'ErrorBoundary';
  action: ErrorBoundaryTelemetryAction;
  hidden: boolean;
  disabled: boolean;
  hasError: boolean;
  errorName?: string;
  errorMessage?: string;
};

export type AppErrorBoundaryProps = Readonly<
  Omit<CoreErrorBoundaryProps, 'onError' | 'onReset' | 'data-testid' | 'showStack'> & {
    /** Feature flag: скрыть ErrorBoundary */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: отключить ErrorBoundary */
    isDisabledByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Показывать ли stack trace в дефолтном fallback UI (для debug режима). По умолчанию false. */
    showStack?: boolean;

    /** Callback при перехвате ошибки */
    onError?: (error: Error, errorInfo: ErrorInfo) => void;

    /** Callback при сбросе ошибки (reset) */
    onReset?: () => void;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type ErrorBoundaryPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * ErrorBoundaryPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - disabled state
 *
 * Ни один consumer не имеет права повторно интерпретировать
 * feature flags.
 */
function useErrorBoundaryPolicy(props: AppErrorBoundaryProps): ErrorBoundaryPolicy {
  return React.useMemo(() => {
    const hiddenByFeatureFlag = Boolean(props.isHiddenByFeatureFlag);
    const disabledByFeatureFlag = Boolean(props.isDisabledByFeatureFlag);

    return {
      hiddenByFeatureFlag,
      disabledByFeatureFlag,
      telemetryEnabled: props.telemetryEnabled !== false,
    };
  }, [
    props.isHiddenByFeatureFlag,
    props.isDisabledByFeatureFlag,
    props.telemetryEnabled,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitErrorBoundaryTelemetry(payload: ErrorBoundaryTelemetryPayload): void {
  try {
    if (payload.action === ErrorBoundaryTelemetryAction.Error) {
      errorFireAndForget(`ErrorBoundary ${payload.action}`, payload);
    } else {
      infoFireAndForget(`ErrorBoundary ${payload.action}`, payload);
    }
  } catch (telemetryError) {
    // Игнорируем ошибки telemetry, чтобы не ломать UI
    // eslint-disable-next-line no-console
    console.warn('ErrorBoundary telemetry failed:', telemetryError);
  }
}

/** Формирование payload для ErrorBoundary telemetry. */
function getErrorBoundaryPayload(
  action: ErrorBoundaryTelemetryAction,
  policy: ErrorBoundaryPolicy,
  telemetryProps: {
    hasError: boolean;
    errorName?: string;
    errorMessage?: string;
  },
): ErrorBoundaryTelemetryPayload {
  return {
    component: 'ErrorBoundary',
    action,
    hidden: policy.hiddenByFeatureFlag,
    disabled: policy.disabledByFeatureFlag,
    hasError: telemetryProps.hasError,
    ...(telemetryProps.errorName !== undefined && { errorName: telemetryProps.errorName }),
    ...(telemetryProps.errorMessage !== undefined && { errorMessage: telemetryProps.errorMessage }),
  };
}

/* ============================================================================
 * 🎯 APP ERROR BOUNDARY
 * ========================================================================== */

type AppErrorBoundaryInnerProps = Readonly<{
  children: ReactNode;
  policy: ErrorBoundaryPolicy;
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode);
  resetLabel?: string;
  showStack?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  'data-testid'?: string;
}>;

/** Внутренний классовый компонент для обертки CoreErrorBoundary с telemetry. */
class AppErrorBoundaryInner extends Component<
  AppErrorBoundaryInnerProps,
  { hasError: boolean; }
> {
  private readonly lifecyclePayloadRef: {
    mount: ErrorBoundaryTelemetryPayload;
    unmount: ErrorBoundaryTelemetryPayload;
  } | undefined;

  /** Кэшированные props для CoreErrorBoundary для оптимизации рендеринга */
  private cachedCoreProps: Record<string, unknown> | null = null;
  private cachedPropsDeps: {
    children: ReactNode;
    hasError: boolean;
    disabled: boolean;
    telemetry: boolean;
    resetLabel?: string | undefined;
    showStack?: boolean | undefined;
    dataTestId?: string | undefined;
    fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode) | undefined;
  } | null = null;

  constructor(props: AppErrorBoundaryInner['props']) {
    super(props);
    this.state = {
      hasError: false,
    };

    // Фиксируем lifecycle payload для telemetry
    this.lifecyclePayloadRef = {
      mount: getErrorBoundaryPayload(
        ErrorBoundaryTelemetryAction.Mount,
        props.policy,
        { hasError: false },
      ),
      unmount: getErrorBoundaryPayload(
        ErrorBoundaryTelemetryAction.Unmount,
        props.policy,
        { hasError: false },
      ),
    };
  }

  override componentDidMount(): void {
    if (this.props.policy.telemetryEnabled && this.lifecyclePayloadRef) {
      emitErrorBoundaryTelemetry(this.lifecyclePayloadRef.mount);
    }
  }

  override componentWillUnmount(): void {
    if (this.props.policy.telemetryEnabled && this.lifecyclePayloadRef) {
      emitErrorBoundaryTelemetry(this.lifecyclePayloadRef.unmount);
    }
  }

  /** Обработчик ошибки с telemetry. */
  handleError = (error: Error, errorInfo: ErrorInfo): void => {
    this.setState({
      hasError: true,
    });

    if (this.props.policy.telemetryEnabled) {
      const errorPayload = getErrorBoundaryPayload(
        ErrorBoundaryTelemetryAction.Error,
        this.props.policy,
        {
          hasError: true,
          errorName: error.name,
          errorMessage: error.message,
        },
      );
      emitErrorBoundaryTelemetry(errorPayload);
    }

    this.props.onError?.(error, errorInfo);
  };

  /** Обработчик сброса ошибки с telemetry. */
  handleReset = (): void => {
    this.setState({
      hasError: false,
    });

    if (this.props.policy.telemetryEnabled) {
      const resetPayload = getErrorBoundaryPayload(
        ErrorBoundaryTelemetryAction.Reset,
        this.props.policy,
        { hasError: false },
      );
      emitErrorBoundaryTelemetry(resetPayload);
    }

    this.props.onReset?.();
  };

  /** Проверяет, изменились ли зависимости для memoization */
  private hasDepsChanged(currentDeps: {
    children: ReactNode;
    hasError: boolean;
    disabled: boolean;
    telemetry: boolean;
    resetLabel?: string | undefined;
    showStack?: boolean | undefined;
    dataTestId?: string | undefined;
    fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode) | undefined;
  }): boolean {
    if (!this.cachedPropsDeps) {
      return true;
    }
    return (
      this.cachedPropsDeps.children !== currentDeps.children
      || this.cachedPropsDeps.hasError !== currentDeps.hasError
      || this.cachedPropsDeps.disabled !== currentDeps.disabled
      || this.cachedPropsDeps.telemetry !== currentDeps.telemetry
      || this.cachedPropsDeps.resetLabel !== currentDeps.resetLabel
      || this.cachedPropsDeps.showStack !== currentDeps.showStack
      || this.cachedPropsDeps.dataTestId !== currentDeps.dataTestId
      || this.cachedPropsDeps.fallback !== currentDeps.fallback
    );
  }

  /** Создаёт props для CoreErrorBoundary */
  private createCoreProps(
    children: ReactNode,
    policy: ErrorBoundaryPolicy,
    fallback: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode) | undefined,
    resetLabel: string | undefined,
    showStack: boolean | undefined,
    dataTestId: string | undefined,
  ): Record<string, unknown> {
    const baseProps = {
      children,
      onError: this.handleError,
      onReset: this.handleReset,
    } satisfies Pick<CoreErrorBoundaryProps, 'children' | 'onError' | 'onReset'>;

    return {
      ...baseProps,
      ...(fallback !== undefined && { fallback }),
      ...(resetLabel !== undefined && { resetLabel }),
      ...(showStack !== undefined && { showStack }),
      ...(dataTestId !== undefined && { 'data-testid': dataTestId }),
      'data-component': 'AppErrorBoundary',
      'data-state': this.state.hasError ? 'error' : 'normal',
      ...(policy.disabledByFeatureFlag && { 'data-disabled': 'disabled' }),
      // Если feature flag скрытия включен, компонент вообще не рендерится (wrapper возвращает children).
      // Поэтому в DOM этот компонент всегда "visible".
      'data-feature-flag': 'visible',
      'data-telemetry': policy.telemetryEnabled ? 'enabled' : 'disabled',
    };
  }

  override render(): ReactNode {
    const {
      children,
      policy,
      fallback,
      resetLabel,
      showStack,
      'data-testid': dataTestId,
    } = this.props;

    const currentDeps = {
      children,
      hasError: this.state.hasError,
      disabled: policy.disabledByFeatureFlag,
      telemetry: policy.telemetryEnabled,
      resetLabel,
      showStack,
      dataTestId,
      fallback,
    };

    // Всегда вычисляем изменение deps, чтобы покрыть init-case (cachedPropsDeps === null)
    // и сохранить один источник истины для сравнения.
    const depsChanged = this.hasDepsChanged(currentDeps);

    // Пересоздаём props только если изменились зависимости (memoization)
    if (!this.cachedCoreProps || depsChanged) {
      // Кэширование в instance переменных допустимо для оптимизации рендеринга
      // eslint-disable-next-line functional/immutable-data
      this.cachedCoreProps = this.createCoreProps(
        children,
        policy,
        fallback,
        resetLabel,
        showStack,
        dataTestId,
      );
      // eslint-disable-next-line functional/immutable-data
      this.cachedPropsDeps = {
        children: currentDeps.children,
        hasError: currentDeps.hasError,
        disabled: currentDeps.disabled,
        telemetry: currentDeps.telemetry,
        ...(currentDeps.resetLabel !== undefined && { resetLabel: currentDeps.resetLabel }),
        ...(currentDeps.showStack !== undefined && { showStack: currentDeps.showStack }),
        ...(currentDeps.dataTestId !== undefined && { dataTestId: currentDeps.dataTestId }),
        ...(currentDeps.fallback !== undefined && { fallback: currentDeps.fallback }),
      };
    }

    // Type assertion: cachedCoreProps содержит data-атрибуты, не входящие в CoreErrorBoundaryProps
    return <CoreErrorBoundary {...(this.cachedCoreProps as CoreErrorBoundaryProps)} />;
  }
}

/** Функциональный wrapper для AppErrorBoundaryInner с telemetry, feature flags и policy. */
function AppErrorBoundaryComponent(props: AppErrorBoundaryProps): ReactNode {
  const {
    children,
    fallback,
    resetLabel,
    showStack,
    onError,
    onReset,
    'data-testid': dataTestId,
  } = props;

  const policy = useErrorBoundaryPolicy(props);

  if (policy.hiddenByFeatureFlag) {
    return children;
  }

  return (
    <AppErrorBoundaryInner
      policy={policy}
      {...(fallback !== undefined && { fallback })}
      {...(resetLabel !== undefined && { resetLabel })}
      {...(showStack !== undefined && { showStack })}
      {...(onError !== undefined && { onError })}
      {...(onReset !== undefined && { onReset })}
      {...(dataTestId !== undefined && { 'data-testid': dataTestId })}
    >
      {children}
    </AppErrorBoundaryInner>
  );
}

/**
 * UI-контракт ErrorBoundary компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Перехват ошибок в дочерних компонентах
 * - Детерминированный fallback UI при ошибке
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия и отключения
 * - Корректная обработка accessibility (ARIA)
 *
 * Инварианты:
 * - Всегда возвращает валидный ReactNode
 * - Error telemetry отправляется при перехвате ошибки
 * - Reset telemetry отправляется при сбросе ошибки
 * - Feature flags применяются корректно к visibility и disabled
 * - Telemetry отражает состояние policy, а не сырые props
 * - Ошибки telemetry не ломают UI (try/catch защита)
 *
 * Не допускается:
 * - Использование напрямую core ErrorBoundary компонента
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 *
 * @contract Data Attributes (для QA)
 *
 * Компонент добавляет следующие data-атрибуты для тестирования и отладки.
 * Все атрибуты используют консистентную схему строковых значений.
 * QA должен использовать именно эти строковые значения для селекторов:
 *
 * - data-component="AppErrorBoundary": идентификатор компонента
 * - data-state: строго "error" | "normal" (текущее состояние)
 * - data-disabled: строго "disabled" | отсутствует (если компонент отключен через feature flag)
 * - data-feature-flag: строго "hidden" | "visible" (состояние feature flag для скрытия)
 * - data-telemetry: строго "enabled" | "disabled" (состояние telemetry)
 *
 * @example
 * ```tsx
 * // Базовое использование
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * // Расширенное использование с feature flags, telemetry и кастомным fallback
 * <ErrorBoundary
 *   isHiddenByFeatureFlag={!featureFlags.errorBoundaryEnabled}
 *   isDisabledByFeatureFlag={isProcessing}
 *   telemetryEnabled={true}
 *   showStack={process.env.NODE_ENV === 'development'}
 *   fallback={(error, errorInfo) => (
 *     <div>
 *       <h2>Ошибка: {error.message}</h2>
 *       <button onClick={() => window.location.reload()}>Перезагрузить</button>
 *     </div>
 *   )}
 *   onError={(error, errorInfo) => handleError(error, errorInfo)}
 *   onReset={() => handleReset()}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export const ErrorBoundary = React.memo(AppErrorBoundaryComponent);
