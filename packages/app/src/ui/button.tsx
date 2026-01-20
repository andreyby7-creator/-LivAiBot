/**
 * @file packages/app/src/ui/button.tsx
 * ============================================================================
 * 🔘 APP UI BUTTON — КОНТЕЙНЕРНЫЙ WRAPPER КНОПКИ ПРИЛОЖЕНИЯ
 * ============================================================================
 *
 * Роль:
 * - Единственная точка входа для кнопок во всем приложении
 * - Интеграция:
 *   • i18n
 *   • telemetry
 *   • feature flags (готово к подключению)
 *   • accessibility
 *
 * Архитектура:
 * - ui-core → только визуал
 * - app/ui → адаптация под бизнес-контекст
 * - feature/* → используют ТОЛЬКО app/ui
 */

import React, { useCallback, useMemo } from 'react';
import type { JSX } from 'react';

import { Button as CoreButton } from '../../../ui-core/src/index.js';
import type { ButtonProps as CoreButtonProps } from '../../../ui-core/src/index.js';
import { useI18n } from '../lib/i18n.js';
import type { Namespace, TranslationKey } from '../lib/i18n.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

/** Telemetry событие кнопки */
export type ButtonTelemetryEvent = Readonly<{
  component: 'Button';
  action: 'click';
  disabled: boolean;
  variant: CoreButtonProps['variant'];
}>;

/** App-уровневые пропсы кнопки */
export type AppButtonProps = Readonly<
  & Omit<CoreButtonProps, 'children'>
  & {
    /** Telemetry hook */
    onTelemetry?: (event: ButtonTelemetryEvent) => void;
  }
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
>;

/* ============================================================================
 * 🎯 APP BUTTON
 * ========================================================================== */

/**
 * Контейнерная кнопка приложения.
 *
 * Гарантии:
 * - Без side effects
 * - Детеминированная
 * - SSR safe
 * - Полностью совместима с feature-flags и аналитикой
 *
 * Использовать ТОЛЬКО её во всем проекте. */
/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export function Button(props: AppButtonProps): JSX.Element {
  const { onTelemetry, onClick, disabled = false, variant, ...rest } = props;
  const { translate } = useI18n();

  /** Текст кнопки: i18n → children → пусто */
  const label = useMemo<React.ReactNode>(() => {
    // Narrowing через discriminated union
    if ('i18nKey' in props) {
      const effectiveNs = props.i18nNs ?? 'common';
      return translate(effectiveNs, props.i18nKey, props.i18nParams ?? EMPTY_PARAMS);
    }
    return props.children;
  }, [props, translate]);

  /** Click handler с telemetry */
  const handleClick = useCallback<NonNullable<CoreButtonProps['onClick']>>(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled) {
        onTelemetry?.({
          component: 'Button',
          action: 'click',
          disabled,
          variant,
        });
      }

      onClick?.(event);
    },
    [disabled, onTelemetry, onClick, variant],
  );

  return (
    <CoreButton
      disabled={disabled}
      onClick={handleClick}
      {...rest}
    >
      {label}
    </CoreButton>
  );
}

/* ============================================================================
 * 🧩 ARCHITECTURAL CONTRACT
 * ========================================================================== */
/**
 * Этот файл — UI boundary.
 *
 * Он:
 * - Защищает core UI от бизнес-логики
 * - Защищает бизнес-логику от UI деталей
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
