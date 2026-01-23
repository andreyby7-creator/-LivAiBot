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
import { useI18n } from '../lib/i18n.js';
import type { Namespace, TranslationKey } from '../lib/i18n.js';
import { infoFireAndForget } from '../lib/telemetry.js';

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
  & Omit<CoreButtonProps, 'children'>
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

function emitButtonTelemetry(payload: ButtonTelemetryPayload): void {
  infoFireAndForget(`Button ${payload.action}`, payload);
}

/* ============================================================================
 * 🎯 APP BUTTON
 * ========================================================================== */

const ButtonComponent = memo<AppButtonProps>(
  function ButtonComponent(props: AppButtonProps): JSX.Element {
    const { onClick, disabled = false, variant, ...rest } = props;
    const { translate } = useI18n();
    const policy = useButtonPolicy();

    /** Текст кнопки: i18n → children → пусто */
    const label = useMemo<React.ReactNode>(() => {
      // Narrowing через discriminated union
      if ('i18nKey' in props) {
        const effectiveNs = props.i18nNs ?? 'common';
        return translate(effectiveNs, props.i18nKey, props.i18nParams ?? EMPTY_PARAMS);
      }
      return props.children;
    }, [props, translate]);

    /** Click handler с централизованной telemetry */
    const handleClick = useCallback<NonNullable<CoreButtonProps['onClick']>>(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!disabled && policy.telemetryEnabled) {
          emitButtonTelemetry({
            component: 'Button',
            action: ButtonTelemetryAction.Click,
            variant: variant ?? null,
            disabled,
          });
        }

        onClick?.(event);
      },
      [disabled, onClick, variant, policy.telemetryEnabled],
    );

    return (
      <CoreButton
        disabled={disabled}
        onClick={handleClick}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        {...rest}
      >
        {label}
      </CoreButton>
    );
  },
);

/* eslint-disable functional/immutable-data */
ButtonComponent.displayName = 'Button';
/* eslint-enable functional/immutable-data */

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
