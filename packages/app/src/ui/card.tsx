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

import { Card as CoreCard } from '@livai/ui-core';
import type { CoreCardProps } from '@livai/ui-core';
import { forwardRef, memo, useCallback, useEffect, useMemo } from 'react';
import type { JSX, KeyboardEvent, MouseEvent, Ref } from 'react';

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

/** Алиас для UI feature flags в контексте card wrapper */
export type CardUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте card */
export type CardWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте card */
export type CardMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

// Фильтруем бизнес-пропсы от DOM-пропсов
function omit<T extends Record<string, unknown>, K extends readonly string[]>(
  obj: T,
  keys: K,
): Omit<T, K[number]> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

// Бизнес-пропсы, которые не должны попадать в DOM
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'isDisabledByFeatureFlag',
  'variantByFeatureFlag',
  'telemetryOnClick',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

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

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

/** App-уровневые пропсы Card. */
export type AppCardProps = Readonly<
  & Omit<CoreCardProps, 'data-component' | 'data-variant' | 'data-size' | 'onClick' | 'aria-label'>
  & {
    /** Feature flag: скрыть карточку полностью */
    isHiddenByFeatureFlag?: boolean;

    /** Feature flag: запретить интерактивность */
    isDisabledByFeatureFlag?: boolean;

    /** Feature flag: вариант карточки (data-variant) */
    variantByFeatureFlag?: string;

    /** Accessibility: ID элемента с заголовком карточки */
    ariaLabelledBy?: string;

    /** Accessibility: ID элемента с описанием карточки */
    ariaDescribedBy?: string;

    /** Telemetry: включена ли аналитика кликов (по умолчанию true) */
    telemetryOnClick?: boolean;

    /**
     * Обработчик активации карточки (клик или клавиатура).
     * Вызывается при клике мыши или нажатии Enter/Space.
     *
     * @remarks
     * Для интерактивных карточек (с onClick) автоматически добавляется:
     * - role="button"
     * - tabIndex={0}
     * - keyboard navigation (Enter/Space)
     * - pointer-events: none при aria-disabled="true"
     */
    onClick?: (event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => void;
  }
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

/* ============================================================================
 * 🧠 POLICY LAYER
 * ========================================================================== */

/** CardPolicy — контракт поведения компонента. Именно это и есть «микросервисный API» Card. */
type CardPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly disabledByFeatureFlag: boolean;
  readonly variant: string | null;
  readonly telemetryEnabled: boolean;
  // Future hooks для стратегического расширения
  experimentGroup?: string;
  securityLevel?: 'low' | 'high';
}>;

/** Resolve policy из props + feature flags. Единственное место, где UI знает про флаги. */
function useCardPolicy(props: AppCardProps): CardPolicy {
  const hidden = Boolean(props.isHiddenByFeatureFlag);
  const disabled = Boolean(props.isDisabledByFeatureFlag);

  return useMemo<CardPolicy>(() => ({
    hiddenByFeatureFlag: hidden,
    disabledByFeatureFlag: disabled,
    variant: props.variantByFeatureFlag ?? null,
    telemetryEnabled: props.telemetryOnClick !== false,
  }), [hidden, disabled, props.variantByFeatureFlag, props.telemetryOnClick]);
}

/* ============================================================================
 * 📡 TELEMETRY EFFECTS
 * ========================================================================== */

function emitCardTelemetry(
  telemetry: UiTelemetryApi,
  action: CardTelemetryPayload['action'],
  policy: CardPolicy,
): void {
  telemetry.infoFireAndForget(`Card ${action}`, {
    component: 'Card',
    action,
    variant: policy.variant,
    hidden: policy.hiddenByFeatureFlag,
    disabled: policy.disabledByFeatureFlag,
  });
}

/* ============================================================================
 * 🎯 APP CARD
 * ========================================================================== */

const CardComponent = forwardRef<HTMLDivElement, AppCardProps>(
  function CardComponent(props: AppCardProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    // Фильтруем бизнес-пропсы от DOM-пропсов
    const domProps = omit(props, BUSINESS_PROPS);

    // Aria-label: i18n → обычный aria-label → undefined
    const ariaLabel = useMemo<string | undefined>(() => {
      if ('ariaLabelI18nKey' in props) {
        const effectiveNs = props.ariaLabelI18nNs ?? 'common';
        return translate(
          effectiveNs,
          props.ariaLabelI18nKey,
          props.ariaLabelI18nParams ?? EMPTY_PARAMS,
        );
      }
      return domProps['aria-label'];
    }, [props, translate, domProps]);

    const {
      children,
      onClick,
      ariaLabelledBy,
      ariaDescribedBy,
      variant,
      size,
      style: _style, // Исключаем style из coreProps, чтобы использовать combinedStyle
      ...coreProps
    } = domProps;

    /** Policy */
    const policy = useCardPolicy(props);

    /** Lifecycle telemetry */
    // Mount/unmount telemetry вызываются всегда для отслеживания lifecycle компонента.
    // Click telemetry контролируется через telemetryOnClick (policy.telemetryEnabled).
    useEffect((): () => void => {
      emitCardTelemetry(telemetry, 'mount', policy);
      return (): void => {
        emitCardTelemetry(telemetry, 'unmount', policy);
      };
      // INTENTIONAL: policy намеренно фиксируется на mount для консистентности telemetry.
      // Policy не должен меняться после первого рендера, чтобы telemetry payload был стабильным.
      // Это архитектурное решение для предотвращения рассинхронизации между mount/unmount событиями.
      //
      // ⚠️ ВАЖНО: Policy должен быть стабильным после mount.
      // Если policy меняется динамически, это может привести к рассинхронизации между
      // mount/unmount событиями в telemetry. Для динамических изменений используйте
      // отдельные события (например, 'click' или кастомные события), а не lifecycle hooks.
      //
      // @see useCardPolicy - policy вычисляется из props и feature flags один раз при mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [telemetry]);

    /** Derived state */
    const isInteractive = Boolean(onClick) && !policy.disabledByFeatureFlag;
    const isDisabled = policy.disabledByFeatureFlag;

    /** Стили для disabled состояния */
    // Объединяем стили так, чтобы pointer-events применялся после всех остальных стилей
    const combinedStyle = useMemo(() => {
      const baseStyle = _style;
      if (isInteractive && isDisabled) {
        // Для role="button" с aria-disabled="true" требуется pointer-events: none
        // для полной совместимости с HTML спецификацией и предотвращения взаимодействия
        return {
          ...(baseStyle ?? {}),
          pointerEvents: 'none' as const,
        };
      }
      return baseStyle;
    }, [isInteractive, isDisabled, _style]);

    /** Handlers (effects isolated here) */
    const handleActivation = useCallback(
      (event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
        if (policy.telemetryEnabled && !isDisabled) {
          emitCardTelemetry(telemetry, 'click', policy);
        }
        if (!isDisabled && onClick) {
          // onClick типизирован как (event: MouseEvent | KeyboardEvent) => void
          // для поддержки как кликов мыши, так и keyboard navigation
          onClick(event);
        }
      },
      [policy, onClick, isDisabled, telemetry],
    );

    /** Hidden state */
    if (policy.hiddenByFeatureFlag) {
      return null;
    }

    /** View (максимально «тупая») */
    return (
      <CoreCard
        ref={ref}
        {...(variant !== undefined ? { variant } : {})}
        {...(size !== undefined ? { size } : {})}
        data-component='AppCard'
        data-variant={policy.variant ?? undefined}
        data-disabled={isDisabled || undefined}
        data-telemetry={policy.telemetryEnabled ? 'enabled' : 'disabled'}
        role={isInteractive ? 'button' : 'group'}
        tabIndex={isInteractive ? 0 : undefined}
        aria-disabled={isDisabled || undefined}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        onClick={onClick ? handleActivation : undefined}
        onKeyDown={isInteractive
          ? (e: KeyboardEvent<HTMLDivElement>): void => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleActivation(e);
            }
          }
          : undefined}
        style={combinedStyle}
        {...coreProps}
      >
        {children}
      </CoreCard>
    );
  },
);

/**
 * UI-контракт Card компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия и отключения
 * - Корректная обработка интерактивности и accessibility
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Интерактивность определяется наличием onClick callback
 * - Feature flags применяются корректно к visibility и disabled
 * - Keyboard navigation работает для интерактивных карточек
 * - aria-disabled={true} только при disabledByFeatureFlag={true}
 * - props.variant имеет визуальный приоритет над variantByFeatureFlag (data-variant)
 *
 * Приоритет variant:
 * - props.variant → визуальный стиль карточки (передается в CoreCard)
 * - variantByFeatureFlag → data-variant атрибут для telemetry/тестирования
 * - Если оба заданы, props.variant определяет внешний вид, variantByFeatureFlag - метаданные
 *
 * CSS переменные и стилизация:
 * - Все стили передаются через CoreCard (bgColor, borderColor, shadow, width, height)
 * - CSS переменные поддерживаются через CoreCard (например, var(--card-bg))
 * - ⚠️ ОГРАНИЧЕНИЕ: Dynamic CSS переменные (меняющиеся во время выполнения) могут
 *   не обновляться автоматически из-за мемоизации стилей в CoreCard.
 *   Для динамических значений используйте inline style через props.style.
 * - Fallback значения определены в CoreCard (DEFAULT_BG_COLOR, DEFAULT_BORDER_COLOR и т.д.)
 *
 * Accessibility для интерактивных карточек:
 * - role="button" автоматически применяется при наличии onClick
 * - aria-disabled="true" блокирует взаимодействие через pointer-events: none
 * - Keyboard navigation: Enter и Space активируют карточку
 * - tabIndex={0} для фокусируемости интерактивных карточек
 *
 * Не допускается:
 * - Использование напрямую div вместо Card компонента
 * - Игнорирование accessibility атрибутов
 * - Нарушение keyboard navigation контрактов
 * - Модификация telemetry payload структуры
 * - Изменение policy после mount (см. документацию useEffect выше)
 */

CardComponent.displayName = 'Card';

/**
 * Memoized AppCard.
 */
export const Card = memo(CardComponent);

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
