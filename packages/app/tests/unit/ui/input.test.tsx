import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Input } from '../../../src/ui/input';

// Mock dependencies
vi.mock('../../../src/lib/feature-flags', () => ({
  useFeatureFlag: () => false,
  useFeatureFlagOverride: () => false,
}));

vi.mock('../../../src/lib/i18n', () => ({
  useI18n: () => ({
    translate: (_ns: string, key: string) => key,
  }),
}));

vi.mock('../../../src/lib/telemetry', () => ({
  infoFireAndForget: vi.fn(),
}));

vi.mock('../../../src/ui-core/src/index.js', () => ({
  Input: ({ children, ...props }: any) => <input {...props} />,
}));

describe('Input Component', () => {
  describe('Basic functionality', () => {
    it('should work normally with only value', () => {
      expect(() => {
        render(<Input value='test' onChange={() => {}} />);
      }).not.toThrow();
    });

    it('should work normally with only defaultValue', () => {
      expect(() => {
        render(<Input defaultValue='test' />);
      }).not.toThrow();
    });
  });
});
