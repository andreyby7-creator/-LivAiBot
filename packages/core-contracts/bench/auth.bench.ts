/**
 * Performance benchmarks for authentication functionality
 */
import { bench, describe } from 'vitest';

import type { LoginRequest, RegisterRequest } from '../src/domain/auth.js';

// Benchmark configuration constants
const MIN_PASSWORD_LENGTH = 8;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_SECOND = 1000;
const ONE_HOUR_MS = SECONDS_PER_MINUTE * MINUTES_PER_HOUR * MS_PER_SECOND;

// Test password for benchmarks (can be overridden via environment variable)
const TEST_PASSWORD = process.env['BENCH_TEST_PASSWORD'] ?? 'SecurePass123!';

describe('Authentication Performance', () => {
  const registerRequest: RegisterRequest = {
    email: 'test@example.com',
    password: TEST_PASSWORD,
    workspace_name: 'Test Workspace',
  };

  const loginRequest: LoginRequest = {
    email: 'test@example.com',
    password: TEST_PASSWORD,
  };

  bench('RegisterRequest validation', () => {
    // Benchmark validation logic
    const emailValid = registerRequest.email.includes('@');
    const passwordValid = registerRequest.password.length >= MIN_PASSWORD_LENGTH;
    const workspaceValid = registerRequest.workspace_name.length > 0;

    // В benchmark-коде не бросаем исключения (fp/no-throw).
    // "Потребляем" результат через вызов функции (ESLint считает вызовы допустимыми выражениями).
    const isValid = emailValid && passwordValid && workspaceValid;
    Boolean(isValid);
  });

  bench('LoginRequest validation', () => {
    // Benchmark validation logic
    const emailValid = loginRequest.email.includes('@');
    const passwordValid = loginRequest.password.length >= MIN_PASSWORD_LENGTH;

    const isValid = emailValid && passwordValid;
    Boolean(isValid);
  });

  bench('Token generation simulation', () => {
    // Simulate JWT-like token generation
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
      sub: 'user123',
      iat: Date.now(),
      exp: Date.now() + ONE_HOUR_MS,
    })).toString('base64');
    const signature = 'simulated_signature';

    const token = `${header}.${payload}.${signature}`;
    token.includes('.');
  });
});
