/**
 * @file packages/ui-core/src/primitives/avatar.tsx
 * ============================================================================
 * 🔵 CORE UI AVATAR — BEHAVIORAL PRIMITIVE
 * ============================================================================
 * Роль:
 * - Базовый UI-примитив для отображения аватаров
 * - Детерминированный и side-effect isolated
 * - SSR-safe
 * Не содержит:
 * - feature flags
 * - telemetry
 * - бизнес-логики
 * - продуктовых решений
 */

import { forwardRef, memo, useMemo } from 'react';
import type { HTMLAttributes, JSX } from 'react';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

// Типизированные размеры для консистентности UI
const AVATAR_SIZES = {
  small: 24,
  medium: 32,
  large: 48,
  extraLarge: 64,
} as const;

const DEFAULT_SIZE = AVATAR_SIZES.medium;
// Theme-friendly default - можно переопределить через bgColor prop для dark/light mode
const DEFAULT_BACKGROUND_COLOR = 'var(--avatar-bg, #E5E7EB)';
// Theme-friendly default для цвета текста инициалов
const DEFAULT_FALLBACK_TEXT_COLOR = 'var(--avatar-text, white)';
const MIN_FONT_SIZE = 12;
const FONT_SIZE_RATIO = 0.4;

export type AvatarSize = typeof AVATAR_SIZES[keyof typeof AVATAR_SIZES];

export type CoreAvatarProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'size'> & {
    /** URL изображения аватара */
    src?: string;

    /** Размер аватара в пикселях (типизированные размеры для консистентности) */
    size?: AvatarSize;

    /** Цвет фона, если src не указан (поддерживает CSS custom properties для theme tokens) */
    bgColor?: string;

    /** Текстовая подпись (alt) для accessibility */
    alt?: string | null;

    /** CSS класс для кастомизации (CSS-in-JS, Tailwind и т.д.) */
    className?: string;

    /** Способ масштабирования изображения (для будущих square avatars или crop variants) */
    objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';

    /** Test ID для автоматизированного тестирования */
    'data-testid'?: string;

    /** Кастомный текст для fallback отображения (инициалы), переопределяет автоматическое вычисление из alt */
    fallbackText?: string;

    /** Цвет текста для fallback инициалов (theme-aware, поддерживает CSS custom properties) */
    fallbackTextColor?: string;
  }
>;

/* ============================================================================
 * 🎯 CORE AVATAR
 * ========================================================================== */

const CoreAvatarComponent = forwardRef<HTMLDivElement, CoreAvatarProps>(
  function CoreAvatarComponent(props, ref): JSX.Element {
    const {
      src,
      size = DEFAULT_SIZE,
      bgColor = DEFAULT_BACKGROUND_COLOR,
      alt,
      className,
      objectFit = 'cover',
      fallbackText,
      fallbackTextColor = DEFAULT_FALLBACK_TEXT_COLOR,
      style,
      'data-testid': testId,
      ...rest
    } = props;

    // Явное default значение для alt
    const altText = alt ?? 'avatar';

    // Валидация размера для type safety
    const validatedSize = Object.values(AVATAR_SIZES).includes(size)
      ? size
      : DEFAULT_SIZE;

    // Определяем текст для fallback отображения
    const getFallbackDisplayText = (): string => {
      if (fallbackText != null) return fallbackText;
      if (!altText || altText === 'avatar') return '';
      return altText
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
    };

    const fallbackDisplayText = getFallbackDisplayText();

    const initialsStyle = useMemo(() => ({
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: fallbackTextColor,
      fontSize: `${Math.max(MIN_FONT_SIZE, validatedSize * FONT_SIZE_RATIO)}px`,
      fontWeight: 'bold',
      textAlign: 'center',
      userSelect: 'none',
      pointerEvents: 'none',
    } as const), [validatedSize, fallbackTextColor]);

    // Объединенный стиль для оптимизации - меньше объектов и useMemo вызовов
    const combinedStyle = useMemo(() => ({
      width: `${validatedSize}px`,
      height: `${validatedSize}px`,
      borderRadius: '50%',
      display: 'inline-block',
      overflow: 'hidden',
      position: 'relative', // Для корректного позиционирования fallback инициалов
      backgroundColor: src != null ? undefined : bgColor,
      ...style,
    } as const), [validatedSize, src, bgColor, style]);

    // TODO: если появятся props для image (borderRadius), добавить их в deps useMemo
    const imageStyle = useMemo(() => ({
      width: '100%',
      height: '100%',
      borderRadius: 'inherit',
      objectFit,
    }), [objectFit]);

    return (
      <div
        ref={ref}
        data-component='CoreAvatar'
        data-testid={testId}
        role='img'
        aria-label={altText}
        title={altText}
        className={className}
        style={combinedStyle}
        {...rest}
      >
        {src != null
          ? (
            <img
              src={src}
              alt={altText}
              style={imageStyle}
              loading='lazy'
              decoding='async'
            />
          )
          : (
            fallbackDisplayText && (
              <span
                style={initialsStyle}
                aria-hidden='true'
              >
                {fallbackDisplayText}
              </span>
            )
          )}
      </div>
    );
  },
);

/**
 * Memoized CoreAvatar.
 * Гарантии:
 * - Никаких side-effects
 * - SSR-safe
 * - Полная совместимость с strict-mode и concurrent rendering
 * - Поддержка ref forwarding
 * Примеры использования:
 * ```tsx
 * // Базовое использование
 * <Avatar src="/user.jpg" alt="John Doe" />
 * // С theme tokens для dark/light mode
 * <Avatar bgColor="var(--avatar-bg, #E5E7EB)" alt="User" />
 * // С типизированными размерами
 * <Avatar size={48} alt="Large avatar" />
 * // С кастомным objectFit для square avatars
 * <Avatar src="/square.jpg" objectFit="contain" alt="Square avatar" />
 * // С data-testid для тестирования
 * <Avatar src="/user.jpg" alt="Test user" data-testid="user-avatar" />
 * // С кастомным fallback текстом и цветом
 * <Avatar fallbackText="JD" fallbackTextColor="var(--avatar-text, black)" alt="John Doe" />
 * ```
 */
export const Avatar = memo(CoreAvatarComponent);
