/**
 * @file packages/app/src/ui/status-indicator.tsx
 * ============================================================================
 * 🟥 APP UI STATUS INDICATOR — UI МИКРОСЕРВИС STATUS INDICATOR
 * ============================================================================
 *
 * Единственная точка входа для Status Indicator в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / visibility)
 * - Telemetry
 * - Feature flags
 *
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов
 *
 * Архитектурные решения:
 * - Управление видимостью и параметрами обрабатывается в App слое
 * - CoreStatusIndicator остается полностью presentational
 *
 * @recommendedUsage
 * - Всегда оборачивайте в родительский layout, который контролирует `visible` и feature flags
 * - Используйте `telemetryEnabled` только при необходимости для аналитики
 * - Убедитесь, что `status` приходит из валидированной бизнес-логики (idle | loading | success | error)
 */

import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { JSX, Ref } from 'react';

import { StatusIndicator as CoreStatusIndicator } from '../../../ui-core/src/primitives/status-indicator.js';
import type {
  CoreStatusIndicatorProps,
  StatusIndicatorSize,
  StatusIndicatorStatus,
  StatusIndicatorVariant,
} from '../../../ui-core/src/primitives/status-indicator.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

enum StatusIndicatorTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
  StatusChange = 'status-change',
}

/** Валидные статусы для StatusIndicator (используется в runtime проверке) */
const VALID_STATUSES: readonly StatusIndicatorStatus[] = [
  'idle',
  'loading',
  'success',
  'error',
] as const;

type StatusIndicatorTelemetryPayload = {
  component: 'StatusIndicator';
  action: StatusIndicatorTelemetryAction;
  hidden: boolean;
  visible: boolean;
  status: StatusIndicatorStatus;
  variant?: StatusIndicatorVariant;
  size?: StatusIndicatorSize;
};

export type AppStatusIndicatorProps = Readonly<
  Omit<CoreStatusIndicatorProps, 'data-testid'> & {
    /** Видимость Status Indicator (App policy). Default = true */
    visible?: boolean;

    /** Feature flag: скрыть Status Indicator */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type StatusIndicatorPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

/**
 * StatusIndicatorPolicy является единственным источником истины
 * для:
 * - DOM rendering
 * - telemetry
 * - visibility state
 *
 * Ни один consumer не имеет права повторно интерпретировать props.visible
 * или feature flags.
 *
 * @note Чистая функция без side-effects. Использует только useMemo для вычислений.
 */
function useStatusIndicatorPolicy(
  props: AppStatusIndicatorProps,
): StatusIndicatorPolicy {
  const hiddenByFeatureFlag = Boolean(props.isHiddenByFeatureFlag);

  return useMemo(() => {
    const isRendered = !hiddenByFeatureFlag && props.visible !== false;
    return {
      hiddenByFeatureFlag,
      isRendered,
      telemetryEnabled: props.telemetryEnabled !== false,
    };
  }, [hiddenByFeatureFlag, props.visible, props.telemetryEnabled]);
}

/* ============================================================================
 * 🛠️ UTILITIES
 * ========================================================================== */

/**
 * Утилита для условного добавления свойств в объект.
 * Используется для соблюдения exactOptionalPropertyTypes.
 *
 * @template T - Тип объекта (может быть object | undefined для большей безопасности)
 */
function optionalProp<T extends object | undefined>(
  condition: boolean,
  obj: T,
): Partial<Exclude<T, undefined>> {
  return condition
    ? (obj as Partial<Exclude<T, undefined>>)
    : ({} as Partial<Exclude<T, undefined>>);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitStatusIndicatorTelemetry(
  payload: StatusIndicatorTelemetryPayload,
): void {
  infoFireAndForget(`StatusIndicator ${payload.action}`, payload);
}

/* ============================================================================
 * 🎯 APP STATUS INDICATOR
 * ========================================================================== */

const StatusIndicatorComponent = forwardRef<
  HTMLSpanElement,
  AppStatusIndicatorProps
>(function StatusIndicatorComponent(
  props: AppStatusIndicatorProps,
  ref: Ref<HTMLSpanElement>,
): JSX.Element | null {
  const {
    status = 'idle',
    variant,
    size,
    color,
    text,
    'data-testid': testId,
    ...coreProps
  } = props;

  /** Runtime проверка валидности status */
  if (
    process.env['NODE_ENV'] !== 'production'
    && !VALID_STATUSES.includes(status)
  ) {
    throw new Error(`Invalid StatusIndicator status: ${status}`);
  }

  /** Policy */
  const policy = useStatusIndicatorPolicy(props);

  /** Base payload для telemetry */
  const getStatusIndicatorPayloadBase = useCallback(
    (action: StatusIndicatorTelemetryAction): StatusIndicatorTelemetryPayload => ({
      component: 'StatusIndicator',
      action,
      hidden: policy.hiddenByFeatureFlag,
      visible: policy.isRendered,
      status,
      ...(variant !== undefined && { variant }),
      ...(size !== undefined && { size }),
    }),
    [policy.hiddenByFeatureFlag, policy.isRendered, status, variant, size],
  );

  /** Lifecycle payload (фиксируется на mount) */
  const lifecyclePayloadRef = useRef<
    {
      mount: StatusIndicatorTelemetryPayload;
      unmount: StatusIndicatorTelemetryPayload;
    } | undefined
  >(undefined);

  // eslint-disable-next-line functional/immutable-data
  lifecyclePayloadRef.current ??= {
    mount: getStatusIndicatorPayloadBase(StatusIndicatorTelemetryAction.Mount),
    unmount: getStatusIndicatorPayloadBase(
      StatusIndicatorTelemetryAction.Unmount,
    ),
  };

  const lifecyclePayload = lifecyclePayloadRef.current;

  /** Lifecycle telemetry */
  useEffect(() => {
    if (!policy.telemetryEnabled) return;

    emitStatusIndicatorTelemetry(lifecyclePayload.mount);
    return (): void => {
      emitStatusIndicatorTelemetry(lifecyclePayload.unmount);
    };
  }, [policy.telemetryEnabled, lifecyclePayload]);

  /** Visibility effect (единственный источник истины для show/hide telemetry) */
  const previousIsRenderedRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (!policy.telemetryEnabled) return;

    const wasRendered = previousIsRenderedRef.current;
    const isRendered = policy.isRendered;

    if (wasRendered === undefined) {
      // Первый рендер - telemetry отправляется только после mount через lifecycle effect
      // eslint-disable-next-line functional/immutable-data
      previousIsRenderedRef.current = isRendered;
      return;
    }

    if (wasRendered !== isRendered) {
      emitStatusIndicatorTelemetry(
        getStatusIndicatorPayloadBase(StatusIndicatorTelemetryAction.StatusChange),
      );
    }

    // eslint-disable-next-line functional/immutable-data
    previousIsRenderedRef.current = isRendered;
  }, [policy.isRendered, policy.telemetryEnabled, getStatusIndicatorPayloadBase]);

  /** Status change telemetry */
  const previousStatusRef = useRef<StatusIndicatorStatus | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!policy.telemetryEnabled) return;

    const previousStatus = previousStatusRef.current;
    const currentStatus = status;

    if (previousStatus === undefined) {
      // Первый рендер - не отправляем status-change
      // eslint-disable-next-line functional/immutable-data
      previousStatusRef.current = currentStatus;
      return;
    }

    if (previousStatus !== currentStatus && policy.isRendered) {
      emitStatusIndicatorTelemetry(
        getStatusIndicatorPayloadBase(
          StatusIndicatorTelemetryAction.StatusChange,
        ),
      );
    }

    // eslint-disable-next-line functional/immutable-data
    previousStatusRef.current = currentStatus;
  }, [
    status,
    policy.isRendered,
    policy.telemetryEnabled,
    getStatusIndicatorPayloadBase,
  ]);

  /** Core props (должен быть до early return для соблюдения правил хуков) */
  const coreStatusIndicatorProps: CoreStatusIndicatorProps = useMemo(
    () => ({
      status,
      ...optionalProp(variant !== undefined, { variant }),
      ...optionalProp(size !== undefined, { size }),
      ...optionalProp(color !== undefined, { color }),
      ...optionalProp(text !== undefined, { text }),
      'data-component': 'AppStatusIndicator',
      'data-state': policy.isRendered ? 'visible' : 'hidden',
      'data-feature-flag': policy.hiddenByFeatureFlag ? 'hidden' : 'visible',
      'data-telemetry': policy.telemetryEnabled ? 'enabled' : 'disabled',
      ...optionalProp(variant !== undefined, { 'data-variant': variant }),
      ...optionalProp(size !== undefined, { 'data-size': size }),
      ...optionalProp(testId !== undefined, { 'data-testid': testId }),
      ...coreProps,
    }),
    [
      status,
      variant,
      size,
      color,
      text,
      testId,
      policy.isRendered,
      policy.hiddenByFeatureFlag,
      policy.telemetryEnabled,
      coreProps,
    ],
  );

  /** Policy: hidden */
  if (!policy.isRendered) return null;

  return <CoreStatusIndicator ref={ref} {...coreStatusIndicatorProps} />;
});

// eslint-disable-next-line functional/immutable-data
StatusIndicatorComponent.displayName = 'StatusIndicator';

/**
 * UI-контракт StatusIndicator компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия индикаторов
 * - Корректное отображение статусов процесса
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Статусы отображаются корректно с правильными цветами
 * - Feature flags полностью изолированы от Core логики
 * - Telemetry payload содержит корректный статус
 *
 * Не допускается:
 * - Использование напрямую core StatusIndicator компонента
 * - Передача невалидных статусов
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 */
export const StatusIndicator = memo(StatusIndicatorComponent);
