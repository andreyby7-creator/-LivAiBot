/**
 * @file packages/ui-core/src/components/UserProfileDisplay.tsx
 * ============================================================================
 * 🔵 CORE UI USER PROFILE DISPLAY — PRESENTATIONAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-компонент для отображения профиля пользователя
 * - Полностью детерминированный и side-effect free
 * - SSR-safe, Concurrent-safe
 * Не содержит:
 * - Feature flags
 * - Telemetry
 * - Управление состоянием данных профиля
 * - Логику загрузки данных
 * - Бизнес-логику
 * Управление:
 * - Данными профиля управляет App-слой
 */

import React, { forwardRef, memo, useMemo } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import type { UITestId } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * =========================================================================== */

/**
 * Данные профиля пользователя для отображения.
 * Минимальный набор полей для базового отображения профиля.
 */
export type UserProfileData = Readonly<{
  /** Email пользователя */
  email: string;

  /** Имя пользователя (опционально) */
  name?: string | null;

  /** URL аватара пользователя (опционально) */
  avatarUrl?: string | null;

  /** Дополнительная информация (опционально) */
  additionalInfo?: string | null;
}>;

export type CoreUserProfileDisplayProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
    /** Данные профиля пользователя */
    profile: UserProfileData;

    /** Размер отображения профиля. По умолчанию 'medium'. */
    size?: 'small' | 'medium' | 'large';

    /** Вариант отображения. По умолчанию 'default'. */
    variant?: 'default' | 'compact' | 'detailed';

    /** Показывать ли аватар. По умолчанию true. */
    showAvatar?: boolean;

    /** Показывать ли имя. По умолчанию true. */
    showName?: boolean;

    /** Показывать ли email. По умолчанию true. */
    showEmail?: boolean;

    /** Показывать ли дополнительную информацию. По умолчанию false. */
    showAdditionalInfo?: boolean;

    /** Кастомный компонент аватара (ReactNode). Если передан, заменяет стандартный аватар. */
    customAvatar?: ReactNode;

    /** Test ID для автотестов */
    'data-testid'?: UITestId;
  }
>;

/* ============================================================================
 * 🎨 BASE STYLES
 * =========================================================================== */

const CONTAINER_BASE_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: '100%',
};

const CONTAINER_COMPACT_STYLE: CSSProperties = {
  ...CONTAINER_BASE_STYLE,
  gap: '8px',
};

const CONTAINER_DETAILED_STYLE: CSSProperties = {
  ...CONTAINER_BASE_STYLE,
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '8px',
};

const AVATAR_WRAPPER_STYLE: CSSProperties = {
  flexShrink: 0,
};

const AVATAR_SIZES = {
  small: 32,
  medium: 48,
  large: 64,
} as const;

const INFO_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  flex: 1,
  minWidth: 0, // Для корректного truncate текста
};

const NAME_STYLE: CSSProperties = {
  fontSize: '16px',
  fontWeight: '600',
  color: 'var(--user-profile-name-color, #111827)',
  lineHeight: '1.5',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const NAME_SMALL_STYLE: CSSProperties = {
  ...NAME_STYLE,
  fontSize: '14px',
};

const NAME_LARGE_STYLE: CSSProperties = {
  ...NAME_STYLE,
  fontSize: '18px',
};

const EMAIL_STYLE: CSSProperties = {
  fontSize: '14px',
  color: 'var(--user-profile-email-color, #6B7280)',
  lineHeight: '1.5',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const EMAIL_SMALL_STYLE: CSSProperties = {
  ...EMAIL_STYLE,
  fontSize: '12px',
};

const ADDITIONAL_INFO_STYLE: CSSProperties = {
  fontSize: '12px',
  color: 'var(--user-profile-additional-info-color, #9CA3AF)',
  lineHeight: '1.5',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const DEFAULT_AVATAR_STYLE: CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  backgroundColor: 'var(--user-profile-avatar-bg, #E5E7EB)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--user-profile-avatar-text-color, #6B7280)',
  fontSize: '14px',
  fontWeight: '600',
  userSelect: 'none',
};

const MIN_FONT_SIZE = 12;
const FONT_SIZE_RATIO = 0.4;

/* ============================================================================
 * 🎨 STYLE HELPERS
 * =========================================================================== */

/** Получает стили для имени на основе размера. */
function getNameStyle(size: 'small' | 'medium' | 'large'): CSSProperties {
  if (size === 'small') return NAME_SMALL_STYLE;
  if (size === 'large') return NAME_LARGE_STYLE;
  return NAME_STYLE;
}

/** Получает стили для email на основе размера. */
function getEmailStyle(size: 'small' | 'medium' | 'large'): CSSProperties {
  if (size === 'small') return EMAIL_SMALL_STYLE;
  return EMAIL_STYLE;
}

/** Генерирует инициалы из имени пользователя. */
function getInitials(name: string | null | undefined): string {
  if (name == null || name.trim() === '') return '';
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

/** Генерирует инициалы из email, если имя отсутствует. */
function getInitialsFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  if (localPart.length === 0) return '';
  return localPart.charAt(0).toUpperCase();
}

/* ============================================================================
 * 🎯 CORE USER PROFILE DISPLAY
 * =========================================================================== */

const CoreUserProfileDisplayComponent = forwardRef<HTMLDivElement, CoreUserProfileDisplayProps>(
  function CoreUserProfileDisplayComponent(
    props: CoreUserProfileDisplayProps,
    ref: React.ForwardedRef<HTMLDivElement>,
  ) {
    const {
      profile,
      size = 'medium',
      variant = 'default',
      showAvatar = true,
      showName = true,
      showEmail = true,
      showAdditionalInfo = false,
      customAvatar,
      style,
      className,
      'data-testid': testId,
      ...rest
    } = props;

    const { email, name, avatarUrl, additionalInfo } = profile;

    /** Определяем стили контейнера на основе variant */
    const containerStyle = useMemo<CSSProperties>(() => {
      const baseStyle = variant === 'compact'
        ? CONTAINER_COMPACT_STYLE
        : variant === 'detailed'
        ? CONTAINER_DETAILED_STYLE
        : CONTAINER_BASE_STYLE;
      return {
        ...baseStyle,
        ...style,
      };
    }, [variant, style]);

    /** Размер аватара */
    const avatarSize = AVATAR_SIZES[size];

    /** Инициалы для fallback аватара */
    const initials = useMemo(() => {
      const nameInitials = getInitials(name);
      if (nameInitials) return nameInitials;
      return getInitialsFromEmail(email);
    }, [name, email]);

    /** Стили для аватара */
    const avatarWrapperStyle = useMemo<CSSProperties>(() => ({
      ...AVATAR_WRAPPER_STYLE,
      width: `${avatarSize}px`,
      height: `${avatarSize}px`,
    }), [avatarSize]);

    const avatarImageStyle = useMemo<CSSProperties>(() => ({
      width: `${avatarSize}px`,
      height: `${avatarSize}px`,
      borderRadius: '50%',
      objectFit: 'cover' as const,
    }), [avatarSize]);

    const defaultAvatarStyle = useMemo<CSSProperties>(() => ({
      ...DEFAULT_AVATAR_STYLE,
      width: `${avatarSize}px`,
      height: `${avatarSize}px`,
      fontSize: `${Math.max(MIN_FONT_SIZE, avatarSize * FONT_SIZE_RATIO)}px`,
    }), [avatarSize]);

    /** Стили для текста */
    const nameStyle = useMemo(() => getNameStyle(size), [size]);
    const emailStyle = useMemo(() => getEmailStyle(size), [size]);

    /** ARIA label для accessibility */
    const ariaLabel = useMemo(
      () => `Профиль пользователя ${name ?? email}`,
      [name, email],
    );

    /** UI contract type для создания test ID с суффиксом */
    type MakeTestId = (suffix: string) => string | undefined;

    /** Helper для создания test ID с суффиксом */
    const makeTestId = useMemo<MakeTestId>(
      (): MakeTestId => (suffix: string): string | undefined =>
        testId != null && testId !== '' ? `${testId}-${suffix}` : undefined,
      [testId],
    );

    /** Компонент-обертка для аватара */
    const AvatarWrapper = ({ children }: { children: ReactNode; }): ReactNode => (
      <div
        style={avatarWrapperStyle}
        data-testid={makeTestId('avatar-wrapper')}
      >
        {children}
      </div>
    );

    /** Рендер аватара */
    const renderAvatar = (): ReactNode | null => {
      if (customAvatar != null) {
        return <AvatarWrapper>{customAvatar}</AvatarWrapper>;
      }

      if (avatarUrl != null && avatarUrl !== '') {
        return (
          <AvatarWrapper>
            <img
              src={avatarUrl}
              alt={name ?? email}
              style={avatarImageStyle}
              loading='lazy'
              decoding='async'
              data-testid={makeTestId('avatar-image')}
            />
          </AvatarWrapper>
        );
      }

      if (initials !== '') {
        return (
          <AvatarWrapper>
            <div
              style={defaultAvatarStyle}
              data-testid={makeTestId('avatar-fallback')}
              aria-hidden='true'
            >
              {initials}
            </div>
          </AvatarWrapper>
        );
      }

      return null;
    };

    return (
      <div
        ref={ref}
        data-component='CoreUserProfileDisplay'
        data-size={size}
        data-variant={variant}
        data-testid={testId}
        style={containerStyle}
        className={className}
        role='article'
        aria-roledescription='User profile'
        aria-label={ariaLabel}
        {...rest}
      >
        {showAvatar && renderAvatar()}
        <div
          style={INFO_CONTAINER_STYLE}
          data-testid={makeTestId('info')}
        >
          {showName && name != null && name !== '' && (
            <h3
              style={nameStyle}
              data-testid={makeTestId('name')}
            >
              {name}
            </h3>
          )}
          {showEmail && (
            <p
              style={emailStyle}
              data-testid={makeTestId('email')}
            >
              {email}
            </p>
          )}
          {showAdditionalInfo && additionalInfo != null && additionalInfo !== '' && (
            <p
              style={ADDITIONAL_INFO_STYLE}
              data-testid={makeTestId('additional-info')}
            >
              {additionalInfo}
            </p>
          )}
        </div>
      </div>
    );
  },
);

CoreUserProfileDisplayComponent.displayName = 'CoreUserProfileDisplay';

/**
 * Memoized CoreUserProfileDisplay.
 * Полностью детерминированный, side-effect free, SSR и concurrent safe.
 * Поддерживает ref forwarding. Подходит как building-block для App-слоя.
 *
 * @example
 * ```tsx
 * // Базовое использование
 * <UserProfileDisplay profile={{ email: 'user@example.com', name: 'Иван Иванов' }} />
 * // С аватаром и дополнительной информацией
 * <UserProfileDisplay
 *   profile={{ email: 'user@example.com', name: 'Иван Иванов', avatarUrl: '/avatars/user.jpg', additionalInfo: 'Разработчик' }}
 *   size="large"
 *   variant="detailed"
 *   showAdditionalInfo={true}
 * />
 * // Компактный вариант
 * <UserProfileDisplay profile={{ email: 'user@example.com', name: 'Иван Иванов' }} size="small" variant="compact" />
 * // С кастомным аватаром
 * <UserProfileDisplay profile={{ email: 'user@example.com', name: 'Иван Иванов' }} customAvatar={<CustomAvatarComponent />} />
 * ```
 */
export const UserProfileDisplay = memo(CoreUserProfileDisplayComponent);

/* ============================================================================
 * 🧪 ARCHITECTURAL NOTES
 * =========================================================================== */

/**
 * CSS Variables для кастомизации через app theme:
 * - --user-profile-name-color: цвет имени пользователя (default: #111827)
 * - --user-profile-email-color: цвет email (default: #6B7280)
 * - --user-profile-additional-info-color: цвет дополнительной информации (default: #9CA3AF)
 * - --user-profile-avatar-bg: цвет фона fallback аватара (default: #E5E7EB)
 * - --user-profile-avatar-text-color: цвет текста инициалов (default: #6B7280)
 * Data Attributes для QA:
 * Компонент добавляет следующие data-атрибуты для тестирования и отладки.
 * Все атрибуты используют консистентную схему строковых значений.
 * QA должен использовать именно эти строковые значения для селекторов:
 * - data-component="CoreUserProfileDisplay": идентификатор компонента
 * - data-size: строго "small" | "medium" | "large" (размер отображения профиля)
 * - data-variant: строго "default" | "compact" | "detailed" (вариант отображения)
 */
