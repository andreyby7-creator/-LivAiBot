/**
 * @file packages/app/src/ui/avatar.tsx
 * ============================================================================
 * 🟥 APP UI AVATAR — UI МИКРОСЕРВИС АВАТАРА
 * ============================================================================
 *
 * Единственная точка входа для Avatar в приложении.
 * UI boundary между ui-core и бизнес-логикой.
 *
 * Ответственность:
 * - Policy (hidden / size / fallback)
 * - Telemetry
 * - Feature flags
 *
 * Не содержит:
 * - DOM-манипуляций
 * - платформенных эффектов
 */

import { Avatar as CoreAvatar } from '@livai/ui-core';
import type { CoreAvatarProps } from '@livai/ui-core';
import { forwardRef, memo, useEffect, useMemo, useRef } from 'react';
import type { JSX, Ref } from 'react';

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

/** Алиас для UI feature flags в контексте avatar wrapper */
export type AvatarUiFeatureFlags = UiFeatureFlags;

/** Алиас для wrapper props в контексте avatar */
export type AvatarWrapperProps<TData = Json> = AppWrapperProps<UiPrimitiveProps, TData>;

/** Алиас для маппинга core props в контексте avatar */
export type AvatarMapCoreProps<TData = Json> = MapCoreProps<UiPrimitiveProps, TData>;

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

enum AvatarTelemetryAction {
  Mount = 'mount',
  Unmount = 'unmount',
}

type AvatarTelemetryPayload = {
  component: 'Avatar';
  action: AvatarTelemetryAction;
  hidden: boolean;
  name: string | null;
};

/** Стабильная ссылка на пустой объект параметров */
const EMPTY_PARAMS: Record<string, string | number> = Object.freeze({});

export type AppAvatarProps = Readonly<
  & Omit<CoreAvatarProps, 'aria-label'>
  & {
    /** Feature flag: скрыть компонент */
    isHiddenByFeatureFlag?: boolean;

    /** Telemetry master switch */
    telemetryEnabled?: boolean;

    /** Имя пользователя для fallback, если src нет */
    name?: string | null;
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

// Бизнес-пропсы, которые не должны попадать в DOM
// name трансформируется в fallbackText, не должен протекать в Core
const BUSINESS_PROPS = [
  'isHiddenByFeatureFlag',
  'telemetryEnabled',
  'name',
  'ariaLabelI18nKey',
  'ariaLabelI18nNs',
  'ariaLabelI18nParams',
] as const;

/* ============================================================================
 * 🧠 POLICY
 * ========================================================================== */

type AvatarPolicy = Readonly<{
  readonly hiddenByFeatureFlag: boolean;
  readonly isRendered: boolean;
  readonly telemetryEnabled: boolean;
}>;

function useAvatarPolicy(props: AppAvatarProps): AvatarPolicy {
  const hidden = Boolean(props.isHiddenByFeatureFlag);

  return useMemo<AvatarPolicy>(() => ({
    hiddenByFeatureFlag: hidden,
    isRendered: !hidden,
    telemetryEnabled: props.telemetryEnabled !== false,
  }), [hidden, props.telemetryEnabled]);
}

/* ============================================================================
 * 📡 TELEMETRY
 * ========================================================================== */

function emitAvatarTelemetry(telemetry: UiTelemetryApi, payload: AvatarTelemetryPayload): void {
  telemetry.infoFireAndForget(`Avatar ${payload.action}`, payload);
}

/* ============================================================================
 * 🎯 APP AVATAR
 * ========================================================================== */

const AvatarComponent = forwardRef<HTMLDivElement, AppAvatarProps>(
  function AvatarComponent(props: AppAvatarProps, ref: Ref<HTMLDivElement>): JSX.Element | null {
    const { telemetry, i18n } = useUnifiedUI();
    const { translate } = i18n;
    // Фильтруем бизнес-пропсы, оставляем только DOM-безопасные
    const domProps = omit(props, BUSINESS_PROPS);

    const { src, ...filteredCoreProps } = domProps;

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

    // name - бизнес-проп, берем из оригинальных props
    const { name } = props;
    const policy = useAvatarPolicy(props);

    // Мемоизированные вычисления должны быть перед любыми условными return
    const alt = useMemo(() => name ?? 'avatar', [name]);
    const fallbackText = useMemo(() => {
      if (name == null || name === '') return '';
      return name
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase())
        .slice(0, 2) // Максимум 2 инициала
        .join('');
    }, [name]);

    // Immutable lifecycle telemetry snapshot
    const lifecyclePayloadRef = useRef<
      {
        mount: AvatarTelemetryPayload;
        unmount: AvatarTelemetryPayload;
      } | undefined
    >(undefined);

    lifecyclePayloadRef.current ??= {
      mount: {
        component: 'Avatar' as const,
        action: AvatarTelemetryAction.Mount,
        hidden: policy.hiddenByFeatureFlag,
        name: name ?? null,
      },
      unmount: {
        component: 'Avatar' as const,
        action: AvatarTelemetryAction.Unmount,
        hidden: policy.hiddenByFeatureFlag,
        name: name ?? null,
      },
    };

    const lifecyclePayload = lifecyclePayloadRef.current;

    // Dev invariant: strict validation for development
    if (
      process.env['NODE_ENV'] !== 'production'
      && process.env['NODE_ENV'] !== 'test'
      && src == null
      && name == null
    ) {
      throw new Error(
        '[AppAvatar] Development Error: Either "src" or "name" prop must be provided. '
          + 'Avatar needs either an image source or a name to generate fallback initials. '
          + 'Example: <Avatar src="/user.jpg" alt="John" /> or <Avatar name="John Doe" />',
      );
    }

    // Telemetry lifecycle
    useEffect(() => {
      if (policy.telemetryEnabled) {
        emitAvatarTelemetry(telemetry, lifecyclePayload.mount);
        return (): void => {
          emitAvatarTelemetry(telemetry, lifecyclePayload.unmount);
        };
      }
      return undefined;
      // Policy намеренно заморожена при монтировании
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // hidden
    if (!policy.isRendered) return null;

    return (
      <CoreAvatar
        ref={ref}
        {...(src != null ? { src } : {})}
        {...(ariaLabel !== undefined && { 'aria-label': ariaLabel })}
        alt={alt}
        fallbackText={fallbackText}
        data-component='AppAvatar'
        {...filteredCoreProps}
      />
    );
  },
);

// Устанавливаем displayName для лучшей отладки

AvatarComponent.displayName = 'Avatar';

/**
 * UI-контракт Avatar компонента.
 *
 * @contract
 *
 * Гарантируется:
 * - Детерминированный рендеринг без side effects (кроме telemetry)
 * - SSR-safe и concurrent rendering compatible
 * - Полная интеграция с централизованной telemetry системой
 * - Управление feature flags для скрытия аватаров
 * - Автоматическая генерация fallback текста из имени
 *
 * Инварианты:
 * - Всегда возвращает валидный JSX.Element или null
 * - Fallback текст генерируется из alt атрибута
 * - Feature flags полностью изолированы от Core логики
 * - Изображения загружаются с error handling
 *
 * Не допускается:
 * - Использование напрямую core Avatar компонента
 * - Передача пустого alt атрибута
 * - Игнорирование feature flag логики
 * - Модификация telemetry payload структуры
 */
export const Avatar = memo(AvatarComponent);
