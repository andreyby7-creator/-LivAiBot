/**
 * @file packages/ui-core/src/primitives/card.tsx
 * ============================================================================
 * 🔵 CORE UI CARD — BEHAVIORAL PRIMITIVE
 * ============================================================================
 *
 * Роль:
 * - Базовый UI-примитив для отображения Card (карточка, контейнер)
 * - Детерминированный, предсказуемый и side-effect free
 * - SSR-safe, Concurrent-safe
 *
 * Не содержит:
 * - feature flags
 * - telemetry
 * - бизнес-логики
 * - продуктовых решений
 */

import { forwardRef, memo, useMemo } from 'react';
import type { AriaRole, CSSProperties, HTMLAttributes, JSX, ReactNode } from 'react';

import type { UISize } from '../types/ui.js';

/* ============================================================================
 * 🧬 TYPES & CONSTANTS
 * ========================================================================== */

export type CardVariant = 'default' | 'outlined' | 'elevated' | 'flat';
export type CardSize = 'small' | 'medium' | 'large';

const CARD_PADDING: Record<CardSize, string> = {
  small: '12px',
  medium: '16px',
  large: '24px',
};

const CARD_BORDER_RADIUS: Record<CardSize, string> = {
  small: '8px',
  medium: '12px',
  large: '16px',
};

const DEFAULT_BG_COLOR = 'var(--card-bg, #FFFFFF)';
const DEFAULT_BORDER_COLOR = 'var(--card-border, #E5E7EB)';
const DEFAULT_SHADOW = 'var(--card-shadow, 0 1px 3px 0 rgba(0, 0, 0, 0.1))';
const DEFAULT_ELEVATED_SHADOW = 'var(--card-shadow-elevated, 0 4px 6px -1px rgba(0, 0, 0, 0.1))';

export type CoreCardProps = Readonly<
  Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'> & {
    /** Содержимое карточки */
    children: ReactNode;

    /** Размер карточки */
    size?: CardSize;

    /** Визуальный вариант карточки */
    variant?: CardVariant;

    /** Кастомный цвет фона */
    bgColor?: string;

    /** Кастомный цвет границы */
    borderColor?: string;

    /** Кастомная тень */
    shadow?: string;

    /**
     * Ширина карточки.
     *
     * @example
     * - "300px" - фиксированная ширина в пикселях
     * - "50%" - процент от родителя
     * - "20rem" - в rem единицах
     * - "var(--card-width)" - CSS переменная
     *
     * @remarks
     * Передаваемый string должен быть валидным CSS значением для width.
     * Runtime валидация не выполняется - браузер сам обработает невалидные значения.
     */
    width?: UISize;

    /**
     * Высота карточки.
     *
     * @example
     * - "200px" - фиксированная высота в пикселях
     * - "100%" - процент от родителя
     * - "10rem" - в rem единицах
     * - "var(--card-height)" - CSS переменная
     *
     * @remarks
     * Передаваемый string должен быть валидным CSS значением для height.
     * Runtime валидация не выполняется - браузер сам обработает невалидные значения.
     */
    height?: UISize;

    /**
     * ARIA роль элемента (по умолчанию 'group').
     *
     * @example
     * - "group" - группа связанных элементов (по умолчанию)
     * - "article" - самостоятельная статья/контент
     * - "region" - значимая область страницы
     * - "complementary" - дополнительный контент
     *
     * @remarks
     * Все ARIA атрибуты (aria-label, aria-labelledby, aria-describedby и т.д.)
     * можно передавать через rest props, они будут проброшены в DOM элемент.
     */
    role?: AriaRole;

    /** Test ID для автотестов */
    'data-testid'?: string;
  }
>;

/* ============================================================================
 * 🎯 CORE CARD
 * ========================================================================== */

const CoreCardComponent = forwardRef<HTMLDivElement, CoreCardProps>(
  function CoreCardComponent(props, ref): JSX.Element {
    const {
      children,
      size = 'medium',
      variant = 'default',
      bgColor,
      borderColor,
      shadow,
      width,
      height,
      role = 'group',
      style,
      className,
      'data-testid': testId,
      ...rest
    } = props;

    const padding = CARD_PADDING[size];
    const borderRadius = CARD_BORDER_RADIUS[size];

    // variantStyle с useMemo оправдан - там switch statement с условной логикой
    const variantStyle = useMemo<CSSProperties>(() => {
      switch (variant) {
        case 'outlined':
          return {
            backgroundColor: bgColor ?? DEFAULT_BG_COLOR,
            border: `1px solid ${borderColor ?? DEFAULT_BORDER_COLOR}`,
            boxShadow: 'none',
          };
        case 'elevated':
          return {
            backgroundColor: bgColor ?? DEFAULT_BG_COLOR,
            borderWidth: '0px',
            borderStyle: 'none',
            boxShadow: shadow ?? DEFAULT_ELEVATED_SHADOW,
          };
        case 'flat':
          return {
            backgroundColor: bgColor ?? DEFAULT_BG_COLOR,
            borderWidth: '0px',
            borderStyle: 'none',
            boxShadow: 'none',
          };
        case 'default':
        default:
          return {
            backgroundColor: bgColor ?? DEFAULT_BG_COLOR,
            borderWidth: '0px',
            borderStyle: 'none',
            boxShadow: shadow ?? DEFAULT_SHADOW,
          };
      }
    }, [variant, bgColor, borderColor, shadow]);

    // sizeStyle вынесен в отдельный useMemo для прозрачности зависимостей
    // padding и borderRadius уже зависят от size, поэтому size не нужен в deps
    const sizeStyle = useMemo<CSSProperties>(() => ({
      padding,
      borderRadius,
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
    }), [padding, borderRadius, width, height]);

    // combinedStyle - merge объектов, useMemo нужен для react-perf/jsx-no-new-object-as-prop
    const combinedStyle: CSSProperties = useMemo(() => ({
      display: 'block',
      boxSizing: 'border-box',
      ...variantStyle,
      ...sizeStyle,
      ...style,
    }), [variantStyle, sizeStyle, style]);

    return (
      <div
        ref={ref}
        role={role}
        data-component='CoreCard'
        data-variant={variant}
        data-size={size}
        data-testid={testId}
        className={className}
        style={combinedStyle}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

/**
 * Memoized CoreCard.
 *
 * Гарантии:
 * - Никаких side-effects
 * - Полная детерминированность
 * - Совместимость с strict-mode и concurrent rendering
 * - Поддержка ref forwarding
 */
export const Card = memo(CoreCardComponent);
