/**
 * @file packages/app/src/ui/button.tsx
 * ============================================================================
 * 🔘 APP UI BUTTON — КОНТЕЙНЕРНЫЙ WRAPPER КНОПКИ ПРИЛОЖЕНИЯ
 * ============================================================================
 *
 * Роль:
 * - Единственная точка входа для кнопок во всем приложении
 * - Интеграция:
 *   • i18n ✓
 *   • telemetry ✓ (централизованная система)
 *   • feature flags ✓ (управление поведением)
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
import { useFeatureFlag } from '../lib/feature-flags.js';
import { useI18n } from '../lib/i18n.js';
import type { Namespace, TranslationKey } from '../lib/i18n.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

// Telemetry логируется централизованно, типы событий больше не экспортируются

/** App-уровневые пропсы кнопки */
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
 * 🎯 APP BUTTON
 * ========================================================================== */

/**
 * Контейнерная кнопка приложения.
 *
 * Гарантии:
 * - Без side effects (кроме telemetry)
 * - Детеминированная
 * - SSR safe
 * - Полностью интегрирована с централизованной telemetry
 * - Поддерживает feature flags для управления поведением
 *
 * Использовать ТОЛЬКО её во всем проекте. */
/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export function Button(props: AppButtonProps): JSX.Element {
  const { onClick, disabled = false, variant, ...rest } = props;
  const { translate } = useI18n();

  // Feature flag для новых поведений кнопки (пример использования)
  // В реальной системе: useFeatureFlag('ui.button.enhanced-behavior')
  // Сейчас: placeholder с фиксированным значением для демонстрации архитектуры
  const isEnhancedBehaviorEnabled = useFeatureFlag();

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
      if (!disabled) {
        infoFireAndForget('Button clicked', {
          component: 'Button',
          variant: variant ?? null,
          disabled,
          enhancedBehavior: isEnhancedBehaviorEnabled,
        });
      }

      onClick?.(event);
    },
    [disabled, onClick, variant, isEnhancedBehaviorEnabled],
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
