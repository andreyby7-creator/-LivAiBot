/**
 * @vitest-environment jsdom
 * @file Тесты для App UserProfileDisplay компонента с полным покрытием
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Импортируем для тестов
import type { AuthGuardContext, ID, Permission, UserRole } from '../../../src/lib/auth-guard.js';

// Mock useAuthGuardContext
vi.mock('../../../src/lib/auth-guard.js', async () => {
  const actual = await vi.importActual('../../../src/lib/auth-guard.js');
  return {
    ...actual,
    useAuthGuardContext: () => mockAuthContext,
  };
});

// Mock для Core UserProfileDisplay - возвращаем простой div с переданными пропсами
vi.mock('../../../../ui-core/src/components/UserProfileDisplay.js', () => ({
  UserProfileDisplay: React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<'div'> & {
      profile?: any;
      size?: string;
      variant?: string;
      showAvatar?: boolean;
      showName?: boolean;
      showEmail?: boolean;
      showAdditionalInfo?: boolean;
      customAvatar?: React.ReactNode;
      'data-component'?: string;
      'data-state'?: string;
      'data-feature-flag'?: string;
      'data-telemetry'?: string;
    }
  >((
    {
      profile,
      size,
      variant,
      showAvatar,
      showName,
      showEmail,
      showAdditionalInfo,
      customAvatar,
      'data-component': dataComponent,
      'data-state': dataState,
      'data-feature-flag': dataFeatureFlag,
      'data-telemetry': dataTelemetry,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        data-testid='core-user-profile-display'
        data-component={dataComponent}
        data-state={dataState}
        data-feature-flag={dataFeatureFlag}
        data-telemetry={dataTelemetry}
        data-size={size}
        data-variant={variant}
        data-show-avatar={String(showAvatar)}
        data-show-name={String(showName)}
        data-show-email={String(showEmail)}
        data-show-additional-info={String(showAdditionalInfo)}
        {...props}
      />
    );
  }),
}));

// Mock для UnifiedUIProvider
const mockInfoFireAndForget = vi.fn();
let mockFeatureFlagReturnValue = false;

vi.mock('../../../src/providers/UnifiedUIProvider', () => ({
  useUnifiedUI: () => ({
    featureFlags: {
      isEnabled: () => mockFeatureFlagReturnValue,
      setOverride: vi.fn(),
      clearOverrides: vi.fn(),
      getOverride: () => mockFeatureFlagReturnValue,
    },
    telemetry: {
      track: vi.fn(),
      infoFireAndForget: mockInfoFireAndForget,
    },
  }),
}));

import { UserProfileDisplay } from '../../../src/ui/user-profile-display';

// Mock console.warn для тестирования dev warnings
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Mock контекст авторизации для тестов
const mockAuthContext: AuthGuardContext = {
  isAuthenticated: true,
  accessToken: 'mock-token',
  refreshToken: 'mock-refresh',
  requestId: 'test-request',
  traceId: 'test-trace',
  userAgent: 'test-agent',
  ipAddress: '127.0.0.1',
  sessionId: 'test-session',
  userId: 'test-user-id' as ID,
  roles: new Set(['USER'] as UserRole[]),
  permissions: new Set(['READ_PUBLIC'] as Permission[]),
};

describe('App UserProfileDisplay', () => {
  // Общие тестовые переменные
  const baseProfile = {
    email: 'user@example.com',
    name: 'Иван Иванов',
    avatarUrl: 'https://example.com/avatar.jpg',
    additionalInfo: 'Разработчик',
  };

  const minimalProfile = { email: 'user@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy.mockClear();
    mockFeatureFlagReturnValue = false; // Сбрасываем в дефолтное состояние
  });

  afterEach(() => {
    cleanup();
  });

  describe('Базовый рендеринг', () => {
    it('должен рендерить компонент с обязательными пропсами', () => {
      render(<UserProfileDisplay profile={minimalProfile} />);

      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toBeInTheDocument();
      expect(component).toHaveAttribute('data-component', 'AppUserProfileDisplay');
    });

    it('не должен рендерить компонент когда visible=false', () => {
      render(<UserProfileDisplay profile={minimalProfile} visible={false} />);

      expect(screen.queryByTestId('core-user-profile-display')).not.toBeInTheDocument();
    });

    it('должен рендерить компонент с полным профилем', () => {
      render(<UserProfileDisplay profile={baseProfile} />);

      expect(screen.getByTestId('core-user-profile-display')).toBeInTheDocument();
    });
  });

  describe('Feature flags (Policy)', () => {
    it('должен рендерить компонент когда feature flag отключен', () => {
      mockFeatureFlagReturnValue = false;

      render(<UserProfileDisplay profile={minimalProfile} />);

      expect(screen.getByTestId('core-user-profile-display')).toBeInTheDocument();
    });

    it('не должен рендерить компонент когда isHiddenByFeatureFlag=true', () => {
      render(<UserProfileDisplay profile={minimalProfile} isHiddenByFeatureFlag={true} />);

      expect(screen.queryByTestId('core-user-profile-display')).not.toBeInTheDocument();
    });

    it('должен применять disabled стиль когда isDisabledByFeatureFlag=true', () => {
      render(<UserProfileDisplay profile={minimalProfile} isDisabledByFeatureFlag={true} />);

      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toHaveAttribute('data-state', 'disabled');
      expect(component).toHaveStyle({
        opacity: '0.6',
        pointerEvents: 'none',
      });
    });

    it('должен применять active состояние по умолчанию', () => {
      render(<UserProfileDisplay profile={minimalProfile} />);

      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toHaveAttribute('data-state', 'active');
    });

    it('должен устанавливать правильные data attributes для feature flags', () => {
      render(
        <UserProfileDisplay
          profile={minimalProfile}
          isHiddenByFeatureFlag={false}
          isDisabledByFeatureFlag={false}
        />,
      );

      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toHaveAttribute('data-feature-flag', 'visible');
      expect(component).toHaveAttribute('data-state', 'active');
    });
  });

  describe('Telemetry', () => {
    it('должен отправлять mount и view события при рендере', () => {
      render(<UserProfileDisplay profile={baseProfile} size='medium' variant='default' />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('UserProfileDisplay mount', {
        component: 'UserProfileDisplay',
        action: 'mount',
        hidden: false,
        visible: true,
        disabled: false,
        size: 'medium',
        variant: 'default',
        hasAvatar: true,
        hasName: true,
        hasEmail: true,
        hasAdditionalInfo: false, // showAdditionalInfo не передан, поэтому false
      });

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('UserProfileDisplay view', {
        component: 'UserProfileDisplay',
        action: 'view',
        hidden: false,
        visible: true,
        disabled: false,
        size: 'medium',
        variant: 'default',
        hasAvatar: true,
        hasName: true,
        hasEmail: true,
        hasAdditionalInfo: false, // showAdditionalInfo не передан, поэтому false
      });
    });

    it('должен отправлять unmount событие при размонтировании', () => {
      const { unmount } = render(<UserProfileDisplay profile={minimalProfile} />);

      unmount();

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('UserProfileDisplay unmount', {
        component: 'UserProfileDisplay',
        action: 'unmount',
        hidden: false,
        visible: true,
        disabled: false,
        size: undefined,
        variant: undefined,
        hasAvatar: false,
        hasName: false,
        hasEmail: true,
        hasAdditionalInfo: false,
      });
    });

    it('не должен отправлять telemetry когда telemetryEnabled=false', () => {
      render(<UserProfileDisplay profile={minimalProfile} telemetryEnabled={false} />);

      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });

    it('должен использовать true по умолчанию для telemetry', () => {
      render(<UserProfileDisplay profile={minimalProfile} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith(
        'UserProfileDisplay mount',
        expect.any(Object),
      );
    });

    it('должен отправлять view событие только один раз при первом рендере', () => {
      const { rerender } = render(<UserProfileDisplay profile={minimalProfile} />);

      // View должен быть вызван один раз
      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(2); // mount + view

      // Повторный рендер не должен вызывать view снова
      rerender(<UserProfileDisplay profile={minimalProfile} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(2); // все еще только mount + view
    });

    it('должен правильно вычислять telemetry props для разных профилей', () => {
      // Профиль без имени
      render(<UserProfileDisplay profile={minimalProfile} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('UserProfileDisplay mount', {
        component: 'UserProfileDisplay',
        action: 'mount',
        hidden: false,
        visible: true,
        disabled: false,
        size: undefined,
        variant: undefined,
        hasAvatar: false,
        hasName: false,
        hasEmail: true,
        hasAdditionalInfo: false,
      });
    });

    it('должен правильно вычислять hasAvatar для customAvatar', () => {
      const customAvatar = <div>Custom Avatar</div>;

      render(<UserProfileDisplay profile={minimalProfile} customAvatar={customAvatar} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('UserProfileDisplay mount', {
        component: 'UserProfileDisplay',
        action: 'mount',
        hidden: false,
        visible: true,
        disabled: false,
        size: undefined,
        variant: undefined,
        hasAvatar: true, // customAvatar присутствует
        hasName: false,
        hasEmail: true,
        hasAdditionalInfo: false,
      });
    });
  });

  describe('Props processing и data attributes', () => {
    it('должен передавать size в Core компонент', () => {
      render(<UserProfileDisplay profile={minimalProfile} size='large' />);

      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toHaveAttribute('data-size', 'large');
    });

    it('должен передавать variant в Core компонент', () => {
      render(<UserProfileDisplay profile={minimalProfile} variant='compact' />);

      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toHaveAttribute('data-variant', 'compact');
    });

    it('должен передавать show* пропсы в Core компонент', () => {
      render(
        <UserProfileDisplay
          profile={baseProfile}
          showAvatar={true}
          showName={true}
          showEmail={true}
          showAdditionalInfo={true}
        />,
      );

      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toHaveAttribute('data-show-avatar', 'true');
      expect(component).toHaveAttribute('data-show-name', 'true');
      expect(component).toHaveAttribute('data-show-email', 'true');
      expect(component).toHaveAttribute('data-show-additional-info', 'true');
    });

    it('должен передавать customAvatar в Core компонент', () => {
      const customAvatar = <div>Custom Avatar</div>;

      render(<UserProfileDisplay profile={minimalProfile} customAvatar={customAvatar} />);

      // Custom avatar должен быть передан в Core компонент
      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toBeInTheDocument();
    });

    it('должен применять className', () => {
      render(<UserProfileDisplay profile={minimalProfile} className='custom-class' />);

      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toHaveClass('custom-class');
    });

    it('должен применять style', () => {
      const customStyle = { borderRadius: '8px', padding: '12px' };

      render(<UserProfileDisplay profile={minimalProfile} style={customStyle} />);

      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toHaveStyle({
        borderRadius: '8px',
        padding: '12px',
      });
    });

    it('должен применять data-testid', () => {
      render(<UserProfileDisplay profile={minimalProfile} data-testid='custom-profile' />);

      expect(screen.getByTestId('custom-profile')).toBeInTheDocument();
    });

    it('должен прокидывать дополнительные HTML атрибуты', () => {
      render(
        <UserProfileDisplay
          profile={minimalProfile}
          id='profile-id'
          title='Profile Title'
          data-custom='custom-value'
        />,
      );

      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toHaveAttribute('id', 'profile-id');
      expect(component).toHaveAttribute('title', 'Profile Title');
      expect(component).toHaveAttribute('data-custom', 'custom-value');
    });

    it('должен устанавливать правильные data attributes по умолчанию', () => {
      render(<UserProfileDisplay profile={minimalProfile} />);

      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toHaveAttribute('data-component', 'AppUserProfileDisplay');
      expect(component).toHaveAttribute('data-feature-flag', 'visible');
      expect(component).toHaveAttribute('data-state', 'active');
      expect(component).toHaveAttribute('data-telemetry', 'enabled');
    });

    it('должен устанавливать data-telemetry="disabled" когда telemetry отключен', () => {
      render(<UserProfileDisplay profile={minimalProfile} telemetryEnabled={false} />);

      const component = screen.getByTestId('core-user-profile-display');
      expect(component).toHaveAttribute('data-telemetry', 'disabled');
    });
  });

  describe('Ref forwarding', () => {
    it('должен поддерживать ref forwarding', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<UserProfileDisplay ref={ref} profile={minimalProfile} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute('data-component', 'AppUserProfileDisplay');
    });
  });

  describe('Render stability', () => {
    it('должен корректно рендериться с одинаковыми пропсами', () => {
      const { rerender } = render(<UserProfileDisplay profile={minimalProfile} />);

      const component1 = screen.getByTestId('core-user-profile-display');

      // Ререндеринг с теми же пропсами
      rerender(<UserProfileDisplay profile={minimalProfile} />);

      const component2 = screen.getByTestId('core-user-profile-display');

      // Компонент должен оставаться тем же (React reconciliation)
      expect(component1).toBe(component2);
      expect(component2).toBeInTheDocument();
    });

    it('не должен пересчитывать lifecycle telemetry при изменении пропсов', () => {
      const { rerender } = render(<UserProfileDisplay profile={minimalProfile} />);

      expect(mockInfoFireAndForget).toHaveBeenCalledTimes(2); // mount + view

      mockInfoFireAndForget.mockClear();

      rerender(<UserProfileDisplay profile={baseProfile} />);

      // Lifecycle telemetry не должен пересчитываться при изменении пропсов
      expect(mockInfoFireAndForget).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('должен работать с undefined style', () => {
      render(<UserProfileDisplay profile={minimalProfile} style={undefined} />);

      expect(screen.getByTestId('core-user-profile-display')).toBeInTheDocument();
    });

    it('должен работать с пустым объектом style', () => {
      render(<UserProfileDisplay profile={minimalProfile} style={{}} />);

      expect(screen.getByTestId('core-user-profile-display')).toBeInTheDocument();
    });

    it('должен работать когда все show* пропсы false', () => {
      render(
        <UserProfileDisplay
          profile={baseProfile}
          showAvatar={false}
          showName={false}
          showEmail={false}
          showAdditionalInfo={false}
        />,
      );

      expect(screen.getByTestId('core-user-profile-display')).toBeInTheDocument();
    });

    it('должен правильно комбинировать custom style с disabled style', () => {
      const customStyle = { backgroundColor: 'red' };

      render(
        <UserProfileDisplay
          profile={minimalProfile}
          style={customStyle}
          isDisabledByFeatureFlag={true}
        />,
      );

      const component = screen.getByTestId('core-user-profile-display');
      const computedStyle = window.getComputedStyle(component);
      expect(computedStyle.backgroundColor).toBe('rgb(255, 0, 0)'); // red преобразуется в rgb
      expect(computedStyle.opacity).toBe('0.6');
      expect(computedStyle.pointerEvents).toBe('none');
    });

    it('должен правильно обрабатывать policy комбинации', () => {
      // Скрытый компонент не должен рендериться даже если disabled
      render(
        <UserProfileDisplay
          profile={minimalProfile}
          isHiddenByFeatureFlag={true}
          isDisabledByFeatureFlag={true}
        />,
      );

      expect(screen.queryByTestId('core-user-profile-display')).not.toBeInTheDocument();
    });

    it('должен отправлять корректную telemetry при разных комбинациях policy', () => {
      render(
        <UserProfileDisplay
          profile={baseProfile}
          visible={true}
          isHiddenByFeatureFlag={false}
          isDisabledByFeatureFlag={true}
          telemetryEnabled={true}
        />,
      );

      expect(mockInfoFireAndForget).toHaveBeenCalledWith('UserProfileDisplay mount', {
        component: 'UserProfileDisplay',
        action: 'mount',
        hidden: false,
        visible: true,
        disabled: true,
        size: undefined,
        variant: undefined,
        hasAvatar: true,
        hasName: true,
        hasEmail: true,
        hasAdditionalInfo: false, // showAdditionalInfo не передан, поэтому false
      });
    });
  });
});
