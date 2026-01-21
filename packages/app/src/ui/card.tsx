/**
 * @file packages/app/src/ui/card.tsx
 * ============================================================================
 * 🟥 APP UI CARD — КОНТЕЙНЕРНЫЙ WRAPPER КАРТОЧКИ ПРИЛОЖЕНИЯ
 * ============================================================================
 *
 * Роль:
 * - Единственная точка входа для Card во всём приложении
 * - UI boundary между ui-core и бизнес-логикой
 *
 * Интеграции:
 * - telemetry ✓ (централизованная, fire-and-forget, lifecycle-aware)
 * - feature flags ✓ (hidden / disabled / variant / behavior)
 * - accessibility ✓ (aria-role, aria-disabled, tabIndex)
 * - performance ✓ (memo, useMemo, useCallback)
 *
 * Принципы:
 * - props → policy → handlers → view
 * - Side-effects строго изолированы
 * - JSX максимально «тупой»
 * - Компонент детерминированный и SSR-safe
 */

import React, { memo, useCallback, useEffect, useMemo } from 'react';
import type { HTMLAttributes, JSX } from 'react';

import { useFeatureFlag } from '../lib/feature-flags.js';
import { infoFireAndForget } from '../lib/telemetry.js';

/* ============================================================================
 * 🧬 TYPES
 * ========================================================================== */

/** Telemetry payload для Card. Типы не экспортируются наружу — telemetry централизована. */
type CardTelemetryPayload = Readonly<{
  component: 'Card';
  action: 'mount' | 'unmount' | 'click';
  variant: string | null;
  hidden: boolean;
  disabled: boolean;
}>;

/** App-уровневые пропсы Card. */
export type AppCardProps = Readonly<
  & HTMLAttributes<HTMLDivElement>
  & {
    /** Feature flag: скрыть карточку полностью */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: запретить интерактивность */
    isDisabledByFeatureFlag?: boolean;

    /** Feature flag: вариант карточки (data-variant) */
    variantByFeatureFlag?: string;

    /** Accessibility: aria-label, если нет семантического заголовка */
    ariaLabel?: string;

    /** Telemetry: включена ли аналитика кликов (по умолчанию true) */
    telemetryOnClick?: boolean;
  }
>;

/* ============================================================================
 * 🧠 POLICY LAYER
 * ========================================================================== */

/** CardPolicy — контракт поведения компонента. Именно это и есть «микросервисный API» Card. */
type CardPolicy = Readonly<{
  hidden: boolean;
  disabled: boolean;
  variant: string | null;
  telemetryEnabled: boolean;
  // Future hooks для стратегического расширения
  experimentGroup?: string;
  securityLevel?: 'low' | 'high';
}>;

/** Resolve policy из props + feature flags. Единственное место, где UI знает про флаги. */
function useCardPolicy(props: AppCardProps): CardPolicy {
  const hidden = useFeatureFlag(props.isHiddenByFeatureFlag);
  const disabled = useFeatureFlag(props.isDisabledByFeatureFlag);

  return useMemo<CardPolicy>(() => ({
    hidden,
    disabled,
    variant: props.variantByFeatureFlag ?? null,
    telemetryEnabled: props.telemetryOnClick !== false,
  }), [hidden, disabled, props.variantByFeatureFlag, props.telemetryOnClick]);
}

/* ============================================================================
 * 📡 TELEMETRY EFFECTS
 * ========================================================================== */

function emitCardTelemetry(
  action: CardTelemetryPayload['action'],
  policy: CardPolicy,
): void {
  infoFireAndForget(`Card ${action}`, {
    component: 'Card',
    action,
    variant: policy.variant,
    hidden: policy.hidden,
    disabled: policy.disabled,
  });
}

/* ============================================================================
 * 🎯 APP CARD
 * ========================================================================== */

function CardComponent(props: AppCardProps): JSX.Element | null {
  const {
    children,
    onClick,
    ariaLabel,
    ...rest
  } = props;

  /** Policy */
  const policy = useCardPolicy(props);

  /** Lifecycle telemetry */
  useEffect((): () => void => {
    emitCardTelemetry('mount', policy);
    return (): void => {
      emitCardTelemetry('unmount', policy);
    };
    // policy намеренно фиксируется на mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Derived state */
  const isInteractive = Boolean(onClick) && !policy.disabled;

  /** Handlers (effects isolated here) */
  const handleActivation = useCallback(
    (event?: React.SyntheticEvent<HTMLDivElement>) => {
      if (policy.telemetryEnabled && !policy.disabled) {
        emitCardTelemetry('click', policy);
      }
      if (!policy.disabled) {
        onClick?.(event as React.MouseEvent<HTMLDivElement>);
      }
    },
    [policy, onClick],
  );

  /** Hidden state */
  if (policy.hidden) {
    return null;
  }

  /** View (максимально «тупая») */
  return (
    <div
      {...rest}
      onClick={(e) => {
        handleActivation(e);
      }}
      onKeyDown={isInteractive
        ? (e: React.KeyboardEvent<HTMLDivElement>): void => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleActivation(e);
          }
        }
        : undefined}
      data-variant={policy.variant}
      data-disabled={policy.disabled || undefined}
      role={isInteractive ? 'button' : 'group'}
      tabIndex={isInteractive ? 0 : undefined}
      aria-disabled={!isInteractive}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

/**
 * Memoized Card.
 * Оптимизирована для:
 * - списков
 * - dashboards
 * - карточных layout'ов
 */
export const Card = Object.assign(memo(CardComponent), {
  displayName: 'Card',
});

/* ============================================================================
 * 🧩 ARCHITECTURAL CONTRACT
 * ========================================================================== */
/**
 * Этот файл — UI boundary и UI-микросервис.
 *
 * Card теперь:
 * - полностью управляется через policy
 * - telemetry готова к продуктовой аналитике
 * - feature flags не протекают в feature-код
 * - accessibility соответствует enterprise-уровню
 * - готов к A/B тестам, security audit и runtime overrides
 *
 * Любая новая:
 * - аналитика
 * - эксперимент
 * - изменение поведения
 *
 * добавляется ТОЛЬКО здесь.
 *
 * Feature-код не меняется.
 * ui-core не меняется.
 */
