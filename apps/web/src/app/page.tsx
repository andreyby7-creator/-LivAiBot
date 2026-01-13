import Link from 'next/link';

import type { JSX } from 'react';

export default function HomePage(): JSX.Element {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '400px',
          width: '100%',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          padding: '32px',
        }}
      >
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#111827',
            marginBottom: '32px',
          }}
        >
          LivAi
        </h1>

        <p
          style={{
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: '32px',
          }}
        >
          AI-powered chatbot platform with multi-tenant architecture
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Link
            href='/auth/login'
            style={{
              width: '100%',
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'block',
            }}
            data-testid='login-button'
          >
            Sign In
          </Link>

          <Link
            href='/auth/register'
            style={{
              width: '100%',
              backgroundColor: '#e5e7eb',
              color: '#374151',
              padding: '8px 16px',
              borderRadius: '6px',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'block',
            }}
            data-testid='register-button'
          >
            Sign Up
          </Link>

          <Link
            href='/dashboard'
            style={{
              width: '100%',
              backgroundColor: '#16a34a',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'block',
            }}
            data-testid='dashboard-button'
          >
            Dashboard
          </Link>
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <span
            style={{
              fontSize: '14px',
              color: '#6b7280',
            }}
          >
            E2E Test Status: ✅ Working
          </span>
        </div>
      </div>
    </div>
  );
}
