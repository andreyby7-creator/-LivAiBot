/**
 * @file packages/core/src/index.ts
 *
 * =============================================================================
 * 🔧 CORE PACKAGE EXPORTS
 * =============================================================================
 *
 * Central exports for the core domain logic package.
 * Provides access to business policies and domain models.
 */

// Domain Policies
export { AuthPolicy } from './domain/AuthPolicy.js';
export { BotPermissions } from './domain/BotPermissions.js';
export { BotPolicy } from './domain/BotPolicy.js';
export { ChatPolicy } from './domain/ChatPolicy.js';
export { BillingPolicy } from './domain/BillingPolicy.js';

// Re-export types for convenience
export type {
  AuthPolicyConfig,
  AuthSessionState,
  AuthTokenState,
  AuthTokenType,
  RefreshDecision,
  SessionDecision,
  TokenDecision,
  TokenInvalidReason,
} from './domain/AuthPolicy.js';

export type {
  BotAction,
  BotPermissionDecision,
  BotPermissionDeniedReason,
  BotPermissionsConfig,
  BotRole,
  BotUserContext,
} from './domain/BotPermissions.js';

export type {
  BotActorContext,
  BotMode,
  BotPolicyAction,
  BotPolicyConfig,
  BotPolicyDecision,
  BotPolicyDeniedReason,
  BotState,
} from './domain/BotPolicy.js';

export type {
  ChatAction,
  ChatActorContext,
  ChatActorType,
  ChatDecision,
  ChatDeniedReason,
  ChatMessageContext,
  ChatMode,
  ChatPolicyConfig,
  ChatRole,
  ChatState,
} from './domain/ChatPolicy.js';

export type {
  BillingAction,
  BillingDecision,
  BillingDeniedReason,
  BillingPlan,
  BillingPolicyConfig,
  BillingSubjectState,
  BillingSubjectType,
  BillingUsageContext,
  OveruseStrategy,
} from './domain/BillingPolicy.js';

export { ComposedPolicy } from './domain/ComposedPolicy.js';

export type { ComposedPolicyConfig } from './domain/ComposedPolicy.js';
