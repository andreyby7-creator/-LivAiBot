# @livai/core

Core domain logic and business policies for LivAI platform.

## Overview

This package contains the fundamental business logic and domain policies that define the behavior of the LivAI platform. It provides:

- **Domain Policies**: Business rules and invariants (AuthPolicy, BotPolicy, etc.)
- **Domain Models**: Core entities and value objects
- **Business Logic**: Pure functions implementing domain rules

## Architecture

The core package follows Domain-Driven Design principles:

- **No side effects**: Pure business logic only
- **No infrastructure dependencies**: Platform-agnostic
- **Stable contracts**: Used across all layers (API, UI, Workers)
- **Type-safe**: Full TypeScript coverage with strict types

## Key Components

### AuthPolicy

Authentication and session management policies:

```typescript
import { AuthPolicy } from '@livai/core';

const policy = new AuthPolicy({
  accessTokenTtlMs: 15 * 60 * 1000, // 15 minutes
  refreshTokenTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  // ... other config
});

// Validate tokens and sessions
const tokenDecision = policy.evaluateToken(tokenState, now);
const sessionDecision = policy.evaluateSession(sessionState, now);
const refreshDecision = policy.canRefresh(refreshToken, session, now);
```

## Usage

```typescript
import { AuthPolicy } from '@livai/core';

// Configure policy with your requirements
const authPolicy = new AuthPolicy({
  accessTokenTtlMs: 900000, // 15 minutes
  refreshTokenTtlMs: 604800000, // 7 days
  sessionMaxLifetimeMs: 2592000000, // 30 days
  sessionIdleTimeoutMs: 3600000, // 1 hour
  requireRefreshRotation: true,
  maxRefreshRotations: 10,
});

// Use in your application logic
const result = authPolicy.evaluateToken(token, Date.now());
if (result.isDenied()) {
  // Handle invalid token
}
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Testing Strategy

- **Unit tests** for all policy decisions
- **Property-based testing** for edge cases
- **Contract tests** for API compatibility
- **High coverage requirements** (90%+ statements, branches, functions, lines)
