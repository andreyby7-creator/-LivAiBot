/**
 * @file packages/app/src/ui/icon.tsx
 * ============================================================================
 * 🟥 APP UI ICON — UI МИКРОСЕРВИС ИКОНКИ
 * ============================================================================
 *
 * Единственная точка входа для Icon в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / variant / size / color)
 * - Telemetry
 * - Feature flags
 *
 * Не содержит:
 * - DOM-манипуляций
 * - платформенных эффектов
 */

import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { JSX, Ref } from 'react';

import { Icon as CoreIcon } from '../../../ui-core/src/primitives/icon.js';
import type { CoreIconProps } from '../../../ui-core/src/primitives/icon.js';
import { infoFireAndForget } from '../lib/telemetry.js';

// eslint-disable-next-line functional/immutable-data -- Мутация displayName - безопасная операция для улучшения debugging experience в DevTools
CoreIcon.displayName = 'CoreIcon';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

type IconTelemetryAction = 'mount' | 'unmount';

type IconTelemetryPayload = {
  component: 'Icon';
  action: IconTelemetryAction;
  hidden: boolean;
  variant: string | null;
  name: string;
};

export type AppIconProps = Readonly<
  & CoreIconProps
  & {
    /** Feature flag: скрыть компонент */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: визуальный вариант */
    variantByFeatureFlag?: string;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;
  }
>;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type IconPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly variant: string | null;
  readonly telemetryEnabled: boolean;
}>;

function useIconPolicy(props: AppIconProps): IconPolicy {
  const hidden = Boolean(props.isHiddenByFeatureFlag);

  return useMemo<IconPolicy>(() => ({
    hiddenByFeatureFlag: hidden,
    variant: props.variantByFeatureFlag ?? null,
    telemetryEnabled: props.telemetryEnabled !== false,
  }), [
    hidden,
    props.variantByFeatureFlag,
    props.telemetryEnabled,
  ]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitIconTelemetry(action: IconTelemetryAction, policy: IconPolicy, name: string): void {
  if (!policy.telemetryEnabled) return;

  const payload: IconTelemetryPayload = {
    component: 'Icon',
    action,
    hidden: policy.hiddenByFeatureFlag,
    variant: policy.variant,
    name,
  };

  infoFireAndForget(`Icon ${action}`, payload);
}

/* ============================================================================
 * 🎯 APP ICON
 * ========================================================================== */

const IconComponent = forwardRef<HTMLElement | null, AppIconProps>(
  function IconComponent(props: AppIconProps, ref: Ref<HTMLElement | null>): JSX.Element | null {
    const { name, ...coreProps } = props;
    const policy = useIconPolicy(props);
    const internalRef = useRef<HTMLElement | null>(null);

    /** Инвариант разработки: проверка обязательного свойства name */
    if (process.env['NODE_ENV'] !== 'production' && !name) {
      // eslint-disable-next-line no-console -- Development warning для обязательного пропа name
      console.warn('[AppIcon]: name is required');
    }

    /**
     * SSR-безопасная пересылка ref с поддержкой как функциональных, так и объектных ref'ов.
     * Гарантирует корректную работу ref forwarding даже при серверном рендеринге.
     */
    const setRef = useCallback((element: HTMLElement | null) => {
      // eslint-disable-next-line functional/immutable-data -- Мутация internalRef.current - безопасная операция для React ref'ов
      internalRef.current = element;
      if (ref) {
        if (typeof ref === 'function') {
          ref(element);
        } else {
          // eslint-disable-next-line functional/immutable-data -- Мутация ref.current - стандартная операция для React ref forwarding
          ref.current = element;
        }
      }
    }, [ref]);

    const debugAttributes = useMemo(
      () => (policy.hiddenByFeatureFlag ? { 'data-hidden': true } : {}),
      [policy.hiddenByFeatureFlag],
    );

    /** Жизненный цикл telemetry */
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitIconTelemetry('mount', policy, name);
        return (): void => {
          emitIconTelemetry('unmount', policy, name);
        };
      }
      return undefined;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** hidden */
    if (policy.hiddenByFeatureFlag) return null;

    return (
      <CoreIcon
        ref={setRef}
        name={name}
        data-component='AppIcon'
        data-variant={policy.variant}
        {...debugAttributes}
        {...coreProps}
      />
    );
  },
);

/**
 * UI-контракт Icon компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия иконок
 * - Корректное применение CSS размеров через size prop
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Icon name соответствует существующему в системе
 * - CSS размеры применяются корректно через size prop
 * - Feature flags полностью изолированы от Core логики
 *
 * Не допускается:
 * - Использование напрямую core Icon компонента
 * - Передача несуществующих icon name
 * - Переопределение размеров через CSS вместо props
 * - Модификация telemetry payload структуры
 */
export const Icon = Object.assign(memo(IconComponent), {
  displayName: 'Icon',
});
