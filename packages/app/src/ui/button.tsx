/**
 * @file packages/app/src/ui/button.tsx
 * ============================================================================
 * 🔘 APP UI BUTTON — UI МИКРОСЕРВИС BUTTON
 * ============================================================================
 *
 * Единственная точка входа для Button в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (feature flags)
 * - Telemetry (fire-and-forget)
 * - I18n (интернационализация текста)
 * - Контроль поведения на App-уровне
 *
 * Не содержит:
 * - DOM-манипуляций кроме Core
 * - Платформенных эффектов кроме telemetry
 */

import React, { memo, useCallback, useMemo } from 'react';
import type { JSX } from 'react';

import { Button as CoreButton } from '../../../ui-core/src/primitives/button.js';
import type { ButtonProps as CoreButtonProps } from '../../../ui-core/src/primitives/button.js';
import type { Namespace, TranslationKey } from '../lib/i18n.js';
import { useUnifiedUI } from '../providers/UnifiedUIProvider.js';
import type { Json } from '../types/common.js';
import type {
  AppWrapperProps,
  MapCoreProps,
  UiFeatureFlags,
  UiPrimitiveProps,
  UiTelemetryApi,
} from '../types/ui-contracts.js';

/** Алиас для UI feature flags в контексте button wrapper */
export type ButtonUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте button */
export type ButtonWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте button */
export type ButtonMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

/* ============================================================================
 * 🛠️ УТИЛИТЫ
 * ========================================================================== */

// Фильтрует указанные ключи из объекта
function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Omit<T, K> {
  const keySet = new Set(keys as readonly string[]);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keySet.has(key)),
  ) as Omit<T, K>;
}

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

enum ButtonTelemetryAction {
  Click = 'click',
}

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

type ButtonTelemetryPayload = {
  component: 'Button';
  action: ButtonTelemetryAction;
  variant: string | null;
  disabled: boolean;
};

/** App props для Button */
export type AppButtonProps = Readonly<
  & Omit<CoreButtonProps, 'children' | 'aria-label'>
  & (
    | {
      /** I18n режим: ключ локализации обязателен */
      i18nKey: TranslationKey;
      i18nNs?: Namespace;
      i18nParams?: Record<string, string | number>;
      children?: never;
    }
    | {
      /** Children режим: children обязательны */
      i18nKey?: never;
      i18nNs?: never;
      i18nParams?: never;
      children: React.ReactNode;
    }
  )
  & (
    | {
      /** I18n aria-label режим */
      ariaLabelI18nKey: TranslationKey;
      ariaLabelI18nNs?: Namespace;
      ariaLabelI18nParams?: Record<string, string | number>;
      'aria-label'?: never;
    }
    | {
      /** Обычный aria-label режим */
      ariaLabelI18nKey?: never;
      ariaLabelI18nNs?: never;
      ariaLabelI18nParams?: never;
      'aria-label'?: string;
    }
  )
>;

// Бизнес-пропсы, которые не должны попадать в DOM
// i18n пропсы трансформируются в соответствующие атрибуты, не должны протекать в Core
const BUSINESS_PROPS = [
  'i18nKey',
  'i18nNs',
  'i18nParams',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type ButtonPolicy = Readonly<{
  readonly telemetryEnabled: boolean;
}>;

/**
 * Хук управления policy Button.
 * Учитывает feature flags и настройки.
 * @returns ButtonPolicy
 */
function useButtonPolicy(): ButtonPolicy {
  // Пока нет feature flags для Button, но архитектура готова
  return useMemo(() => ({
    telemetryEnabled: true, // Всегда включена для кнопок
  }), []);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitButtonTelemetry(telemetry: UiTelemetryApi, payload: ButtonTelemetryPayload): void {
  telemetry.infoFireAndForget(`Button ${payload.action}`, payload);
}

/* ============================================================================
 * 🎯 APP BUTTON
 * ========================================================================== */

const ButtonComponent = memo<AppButtonProps>(
  function ButtonComponent(props: AppButtonProps): JSX.Element {
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    const { onClick, disabled = false, variant, ...filteredCoreProps } = domProps;
    const { i18n, telemetry } = useUnifiedUI();
    const { translate } = i18n;
    const policy = useButtonPolicy();

    // Текст кнопки: i18n → children → пусто
    const label = useMemo<React.ReactNode>(() => {
      // Narrowing через discriminated union
      if ('i18nKey' in props) {
        const effectiveNs = props.i18nNs ?? 'common';
        return translate(effectiveNs, props.i18nKey, props.i18nParams ?? EMPTY_PARAMS);
      }
      return props.children;
    }, [props, translate]);

    // Aria-label: i18n → обычный aria-label → undefined
    const ariaLabel = useMemo<string | undefined>(() => {
      // Narrowing через discriminated union для aria-label
      if ('ariaLabelI18nKey' in props) {
        const effectiveNs = props.ariaLabelI18nNs ?? 'common';
        return translate(
          effectiveNs,
          props.ariaLabelI18nKey,
          props.ariaLabelI18nParams ?? EMPTY_PARAMS,
        );
      }
      // Проверяем наличие обычного aria-label в отфильтрованных пропсах
      return filteredCoreProps['aria-label'];
    }, [props, translate, filteredCoreProps]);

    // Click handler с централизованной telemetry
    const handleClick = useCallback<NonNullable<CoreButtonProps['onClick']>>(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!disabled && policy.telemetryEnabled) {
          emitButtonTelemetry(telemetry, {
            component: 'Button',
            action: ButtonTelemetryAction.Click,
            variant: variant ?? null,
            disabled,
          });
        }

        onClick?.(event);
      },
      [disabled, onClick, variant, policy.telemetryEnabled, telemetry],
    );

    return (
      <CoreButton
        disabled={disabled}
        onClick={handleClick}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        {...filteredCoreProps}
      >
        {label}
      </CoreButton>
    );
  },
);

ButtonComponent.displayName = 'Button';
/**
 * UI-контракт кнопки приложения.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Поддержка feature flags для управления поведением
 * - Корректная обработка i18n локализации
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element
 * - Telemetry отправляется только при реальных кликах
 * - i18n ключи разрешаются в существующие переводы
 * - Feature flags не влияют на базовую функциональность
 *
 * Не допускается:
 * - Использование напрямую core Button компонента
 * - Переопределение onClick без вызова super
 * - Модификация telemetry payload структуры
 * - Игнорирование accessibility атрибутов
 */
export const Button = ButtonComponent;

/* ============================================================================
 * 🧩 ARCHITECTURAL CONTRACT
 * ========================================================================== */

/**
 * Этот файл — UI boundary.
 *
 * Он:
 * - Защищает core UI от бизнес-логики
 * - Защищает бизнес-логик от UI деталей
 * - Делает проект масштабируемым
 *
 * Любая новая:
 * - аналитика
 * - A/B тест
 * - feature flag
 * - security audit
 *
 * добавляется сюда без изменения feature-кода.
 */
