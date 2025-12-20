/**
 * @file index.ts - Main entry point for @livai/core-contracts
 *
 * Core Contracts - Foundation layer for effects, auth, domain, errors, and infrastructure contracts.
 * This package provides the fundamental building blocks for LivAiBot platform.
 */

// ==================== ERRORS MODULE ====================

/**
 * Enterprise-grade error system for LivAiBot
 * - Discriminated union types with deep immutability
 * - Chain manipulation with circular reference protection
 * - Builders for all business domains (Domain, Infra, Service, Admin)
 * - Comprehensive validation and sanitization
 * - Performance optimizations with lazy evaluation and memoization
 */
export * as Errors from './errors/base/index.js';

// ==================== PLACEHOLDERS FOR FUTURE MODULES ====================

/**
 * IO contracts and utilities (TBD)
 * Network, filesystem, database abstractions
 */
// export * as IO from './io/index.js';

/**
 * Functional programming utilities (TBD)
 * Pure functions, immutable data structures, composition helpers
 */
// export * as FP from './fp/index.js';

/**
 * Domain contracts and business logic (TBD)
 * Core business entities, value objects, domain services
 */
// export * as Domain from './domain/index.js';

/**
 * Context and dependency injection (TBD)
 * Effect context, service locator, configuration management
 */
// export * as Context from './context/index.js';

// ==================== UTILITY EXPORTS ====================

/**
 * Re-export commonly used types for convenience
 * These are safe to import without pulling in implementation details
 */
export type {
  BaseError,
  UserContext,
  ErrorMetadata,
} from './errors/base/BaseError.js';

export {
  isBaseError,
  toBaseError,
} from './errors/base/BaseError.js';