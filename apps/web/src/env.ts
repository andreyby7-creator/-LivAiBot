// apps/web/src/env.ts
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

/**
 * ============================================================
 * ENVIRONMENT CONFIGURATION + DEV HELPER + RUNTIME CHECK + next-intl
 * ============================================================
 *
 * ⚠️ Типизированная конфигурация переменных окружения для LivAI Web
 * - Разделение server / public
 * - Генерация dev-секретов с предупреждением
 * - Runtime check отсутствующих env с подсказками default-dev
 * - Поддержка next-intl
 * ============================================================
 */

/* ============================================================
 * 1️⃣ HELPERS & CONSTANTS
 * ============================================================ */
const SECRET_MIN_LENGTH = 32;
const DEFAULT_PORT = 3000;
const DEFAULT_ISR_REVALIDATE = 3600;

const generateSecret = (length: number = SECRET_MIN_LENGTH): string =>
  crypto.randomBytes(length).toString('base64');

// Dev: генерируем секреты если не заданы
if (process.env.NODE_ENV === 'development') {
  if (process.env['NEXTAUTH_SECRET'] === undefined || process.env['NEXTAUTH_SECRET'] === '') {
    // eslint-disable-next-line functional/immutable-data
    Object.assign(process.env, { NEXTAUTH_SECRET: generateSecret() });
    // eslint-disable-next-line no-console
    console.warn('⚠️ NEXTAUTH_SECRET автоматически сгенерирован для DEV. Не использовать в PROD!');
  }
  if (process.env['JWT_SECRET'] === undefined || process.env['JWT_SECRET'] === '') {
    // eslint-disable-next-line functional/immutable-data
    Object.assign(process.env, { JWT_SECRET: generateSecret() });
    // eslint-disable-next-line no-console
    console.warn('⚠️ JWT_SECRET автоматически сгенерирован для DEV. Не использовать в PROD!');
  }
}

/* ============================================================
 * 2️⃣ SERVER-ONLY VARIABLES
 * ============================================================ */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']), // среда выполнения
  WEB_BASE_URL: z.string().url(), // базовый URL сервера
  NEXTAUTH_SECRET: z.string().min(SECRET_MIN_LENGTH), // секрет NextAuth
  NEXTAUTH_URL: z.string().url(), // URL приложения для NextAuth
  JWT_SECRET: z.string().min(SECRET_MIN_LENGTH), // JWT секрет для auth-service
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'), // срок жизни refresh токена
  PORT: z.coerce.number().default(DEFAULT_PORT), // порт локального dev сервера
  TEST_API_URL: z.string().url().optional(), // тестовый API URL
});

/* ============================================================
 * 3️⃣ PUBLIC VARIABLES (NEXT_PUBLIC_*)
 * ============================================================ */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'), // окружение для клиента
  NEXT_PUBLIC_API_URL: z.string().url(), // Public API Gateway
  NEXT_PUBLIC_WEB_BASE_URL: z.string().url(), // Public Base URL
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(['en', 'ru']).default('en'), // default locale для next-intl
  NEXT_PUBLIC_SUPPORTED_LOCALES: z
    .string()
    .default('en,ru')
    .transform((val) => val.split(',').map((x) => x.trim())), // массив локалей
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(), // Sentry DSN
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(), // PostHog API Key
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default('https://app.posthog.com'), // PostHog host
  NEXT_PUBLIC_ANALYTICS_DEBUG: z.coerce.boolean().default(false), // debug mode аналитики
  NEXT_PUBLIC_ENABLE_ISR: z.coerce.boolean().default(true), // ISR включен
  NEXT_PUBLIC_ISR_REVALIDATE: z.coerce.number().default(DEFAULT_ISR_REVALIDATE), // ISR интервал
  NEXT_PUBLIC_DEBUG: z.coerce.boolean().default(false), // расширенное логирование
  NEXT_PUBLIC_CSP_STRICT: z.coerce.boolean().default(true), // строгий CSP
  NEXT_PUBLIC_CSRF_PROTECTION: z.coerce.boolean().default(true), // защита CSRF
  NEXT_PUBLIC_ENABLE_SW: z.coerce.boolean().default(true), // Service Worker
  NEXT_PUBLIC_SW_STRATEGY: z.enum(['network-first', 'cache-first', 'stale-while-revalidate'])
    .default('stale-while-revalidate'), // стратегия SW
  NEXT_PUBLIC_OPENAI_API_KEY: z.string().optional(), // OpenAI API key для теста
  CI: z.coerce.boolean().default(false), // CI флаг
});

/* ============================================================
 * 4️⃣ PARSE ENV WITH ERROR HANDLING
 * ============================================================ */
function parseEnv<S extends z.ZodTypeAny>(
  schema: S,
  env: Record<string, string | undefined>,
  type: 'Server' | 'Public',
): z.infer<S> {
  try {
    return schema.parse(env);
  } catch (err) {
    if (err instanceof z.ZodError) {
      // eslint-disable-next-line no-console
      console.error(`❌ Ошибка в ${type} переменных окружения:`);
      err.issues.forEach((issue) => {
        // eslint-disable-next-line no-console
        console.error(`  - ${issue.path.join('.')} : ${issue.message}`);
      });
      process.exit(1);
    }
    throw err;
  }
}

export const serverEnv = parseEnv(serverEnvSchema, process.env, 'Server');
export const publicEnv = parseEnv(publicEnvSchema, process.env, 'Public');

/* ============================================================
 * 5️⃣ next-intl HELPERS
 * ============================================================ */
export const locales = publicEnv.NEXT_PUBLIC_SUPPORTED_LOCALES; // массив локалей для next-intl
export const defaultLocale = publicEnv.NEXT_PUBLIC_DEFAULT_LOCALE; // default locale для next-intl

/* ============================================================
 * 6️⃣ RUNTIME CHECK FOR MISSING ENV IN .env.local (DEV ONLY)
 * ============================================================ */
if (process.env.NODE_ENV === 'development') {
  const envFilePath = path.resolve(process.cwd(), '.env.local');
  const localEnv: Record<string, string> = {};
  try {
    fs.accessSync(envFilePath, fs.constants.F_OK);
    fs.readFileSync(envFilePath, 'utf-8')
      .split(/\r?\n/)
      .forEach((line) => {
        const match = line.match(/^\s*([\w_]+)\s*=/);
        const key = match?.[1];
        if (key !== undefined && key !== '') {
          // eslint-disable-next-line functional/immutable-data
          Object.assign(localEnv, { [key]: line });
        }
      });
  } catch {
    // File doesn't exist, skip
  }

  const checkVars = [
    ...Object.keys(serverEnvSchema.shape),
    ...Object.keys(publicEnvSchema.shape),
  ];

  const missingVars = checkVars.filter((v) => !(v in process.env));

  if (missingVars.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('⚠️ Отсутствующие переменные окружения в .env.local:');
    missingVars.forEach((v) => {
      let defaultHint = '';
      if (v.includes('SECRET')) defaultHint = '<сгенерировать безопасный dev-секрет>';
      else if (v.includes('PORT')) defaultHint = String(DEFAULT_PORT);
      else if (v.includes('URL')) defaultHint = 'http://localhost:3000';
      else if (v.includes('LOCALE')) defaultHint = 'en';
      else defaultHint = '<установите значение>';
      // eslint-disable-next-line no-console
      console.warn(`  - ${v} (рекомендуемое значение для DEV: ${defaultHint})`);
    });
  }
}

/* ============================================================
 * 7️⃣ ПРИМЕР ИСПОЛЬЗОВАНИЯ
 * ============================================================ */
// Пример использования:
// import { serverEnv, publicEnv, locales, defaultLocale } from '@/env';
// console.log(serverEnv.WEB_BASE_URL);
// console.log(publicEnv.NEXT_PUBLIC_API_URL);
// console.log(locales); // ['en','ru']
// console.log(defaultLocale); // 'en'
