/**
 * @file Основная конфигурация Vite для React приложений LivAI
 *
 * Поддержка мульти-приложений, алиасов, простой валидации env и разных портов.
 */

import react from '@vitejs/plugin-react';
import { type ConfigEnv, defineConfig, loadEnv, type UserConfig } from 'vite';

// ------------------ ПРОСТАЯ ВАЛИДАЦИЯ ENV -----------------------------

/** Допустимые приложения */
const VALID_APPS = ['web', 'admin', 'mobile', 'desktop', 'backend', 'electron'] as const;

/** Тип допустимых приложений */
type AppName = (typeof VALID_APPS)[number];

/** Конфигурация приложения */
interface AppConfig {
  port: number;
  base: string;
  desc: string;
}

/** Допустимые окружения */
const VALID_ENVS = ['development', 'production', 'test'] as const;
type EnvName = typeof VALID_ENVS[number];

/** Приложения, использующие Next.js */
const NEXT_APPS: AppName[] = ['admin'];

/** Типизация env переменных для строгой валидации */
interface AppEnv {
  NODE_ENV?: EnvName;
  VITE_APP?: string;
  VITE_API_URL?: string;
  VITE_APP_ENV?: string;
  VITE_PORT?: string;
  NEXT_PUBLIC_API_URL?: string;
  NEXT_PUBLIC_APP_ENV?: string;
}

/** Валидация URL */
function validateUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}

/** Расширенная валидация env переменных с типизацией */
function validateEnv(
  env: AppEnv,
  app: AppName,
): { errors: string[]; warnings: string[]; updatedEnv: AppEnv; } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const updatedEnv = { ...env } as AppEnv;

  // NODE_ENV
  if (!env.NODE_ENV || !VALID_ENVS.includes(env.NODE_ENV)) {
    updatedEnv.NODE_ENV = 'development';
    warnings.push(`NODE_ENV set to development (was: ${env.NODE_ENV || 'undefined'})`);
  }

  // VITE_APP
  if (!env.VITE_APP || !VALID_APPS.includes(env.VITE_APP as AppName)) {
    errors.push(`VITE_APP must be: ${VALID_APPS.join(', ')}`);
  }

  const framework = getAppFramework(app);
  const isProduction = updatedEnv.NODE_ENV === 'production';

  // Фреймворк-специфичные переменные
  if (framework === 'next') {
    const apiKey = 'NEXT_PUBLIC_API_URL';
    if (!env[apiKey]) {
      if (isProduction) {
        errors.push(`${apiKey} required in production`);
      } else {
        updatedEnv[apiKey] = 'http://localhost:3001';
        warnings.push(`${apiKey} set to localhost`);
      }
    } else if (!validateUrl(env[apiKey])) {
      errors.push(`${apiKey} must be valid URL`);
    }

    // NEXT_PUBLIC_APP_ENV
    if (!env.NEXT_PUBLIC_APP_ENV) {
      updatedEnv.NEXT_PUBLIC_APP_ENV = isProduction ? 'production' : 'development';
    }
  } else {
    const apiKey = 'VITE_API_URL';
    if (!env[apiKey]) {
      if (isProduction) {
        errors.push(`${apiKey} required in production`);
      } else {
        updatedEnv[apiKey] = 'http://localhost:3001';
        warnings.push(`${apiKey} set to localhost`);
      }
    } else if (!validateUrl(env[apiKey])) {
      errors.push(`${apiKey} must be valid URL`);
    }

    // VITE_APP_ENV
    if (!env.VITE_APP_ENV) {
      updatedEnv.VITE_APP_ENV = isProduction ? 'production' : 'development';
    }

    // VITE_PORT (опционально)
    if (env.VITE_PORT && isNaN(Number(env.VITE_PORT))) {
      errors.push('VITE_PORT must be a valid number');
    }
  }

  return { errors, warnings, updatedEnv };
}

/** Определение фреймворка по приложению */
function getAppFramework(app: AppName): 'next' | 'vite' {
  return NEXT_APPS.includes(app) ? 'next' : 'vite';
}

/** Получение префиксов env для фреймворка */
function getEnvPrefixes(framework: 'next' | 'vite'): string[] {
  return framework === 'next' ? ['NEXT_PUBLIC_'] : ['VITE_'];
}

/** Генерация define маппинга для фреймворка */
function generateDefineMapping(app: string, env: AppEnv): Record<string, string> {
  // Переменные окружения теперь доступны через import.meta.env благодаря envPrefix
  // Оставляем define только для необходимых случаев
  return {};
}

// ------------------ КОНСТАНТЫ -----------------------------

const CONSTANTS = {
  PRODUCTION: 'production',
  DEVELOPMENT: 'development',
} as const;

const ENV_VARS = {
  NODE_ENV: 'NODE_ENV',
  VITE: {
    APP: 'VITE_APP',
    API_URL: 'VITE_API_URL',
    APP_ENV: 'VITE_APP_ENV',
    PORT: 'VITE_PORT',
  },
  NEXT_PUBLIC: {
    API_URL: 'NEXT_PUBLIC_API_URL',
    APP_ENV: 'NEXT_PUBLIC_APP_ENV',
  },
} as const;

// ------------------ КОНФИГУРАЦИИ ПРИЛОЖЕНИЙ -----------------------------

const APP_CONFIGS: Record<AppName, AppConfig> = {
  web: { port: 3000, base: '/', desc: 'Web app' },
  admin: { port: 3002, base: '/admin/', desc: 'Admin panel' },
  mobile: { port: 3001, base: '/mobile/', desc: 'Mobile app' },
  desktop: { port: 3003, base: '/desktop/', desc: 'Desktop' },
  backend: { port: 4000, base: '/api/', desc: 'Backend API' },
  electron: { port: 3004, base: '/electron/', desc: 'Electron' },
} as const;

const getAppConfig = (app: string): AppConfig => APP_CONFIGS[app as AppName] ?? APP_CONFIGS.web;

const getAppPort = (app: string, env: AppEnv): number => {
  const envPort = env[ENV_VARS.VITE.PORT];
  const parsed = Number(envPort);
  return envPort && parsed > 0 && parsed <= 65535 ? parsed : getAppConfig(app).port;
};

// ------------------ ГЕНЕРАТОР БАЗОВОЙ КОНФИГУРАЦИИ -----------------------------

function createBaseViteConfig({
  app,
  mode,
  env,
  appFramework,
}: {
  app: AppName;
  mode: string;
  env: AppEnv;
  appFramework?: 'next' | 'vite';
}): UserConfig {
  const cfg = getAppConfig(app);
  const framework = appFramework || getAppFramework(app) as 'next' | 'vite';
  const envPrefixes = getEnvPrefixes(framework);

  return {
    base: cfg.base,
    build: {
      outDir: `dist/${app}`,
      sourcemap: mode === CONSTANTS.DEVELOPMENT,
    },
    resolve: {
      alias: {
        '@': '/src',
        '@services': '/src/services',
        '@infra': '/src/infra',
        '@core': '/src/core',
        '@ui': '/src/ui',
        '@utils': '/src/utils',
        '@config': '/src/config',
        '@types': '/src/types',
      },
    },
    envPrefix: envPrefixes,
    server: {
      port: getAppPort(app, env),
      host: true,
    },
  };
}

// ------------------ ЭКСПОРТЫ -----------------------------

export { createBaseViteConfig };
export { CONSTANTS };
export { ENV_VARS };

// ------------------ ОСНОВНАЯ КОНФИГУРАЦИЯ VITE -----------------------------

export default defineConfig(({ mode }: ConfigEnv) => {
  // Единый источник env переменных
  const env = loadEnv(mode, process.cwd(), '') as AppEnv;
  const app = (env[ENV_VARS.VITE.APP] || 'web') as AppName;
  const cfg = getAppConfig(app);
  const port = getAppPort(app, env);

  // Вычисляем appFramework один раз
  const appFramework = getAppFramework(app);

  if (process.env.VITEST_ENV_DEBUG === 'true') {
    console.log(`🏗️  Building ${app} in ${mode} (${appFramework})`);
    console.log(`   base: ${cfg.base}`);
    console.log(`   out: dist/${app}`);
    console.log(`   port: ${port}`);
  }

  // -------------------- ВАЛИДАЦИЯ ПЕРЕМЕННЫХ ОКРУЖЕНИЯ --------------------
  const { errors, warnings, updatedEnv } = validateEnv(env, app);
  Object.assign(env, updatedEnv);

  if (errors.length) {
    throw new Error(
      `❌ Environment validation failed for ${app} app:\n${
        errors.map((err) => `   - ${err}`).join('\n')
      }`,
    );
  }
  if (warnings.length) {
    console.warn(
      `⚠️  Missing environment variables for ${app} app:\n${
        warnings.map((w) => `   - ${w}`).join('\n')
      }\n   Using fallback values - consider setting these in production`,
    );
  }

  // -------------------- БАЗОВАЯ КОНФИГУРАЦИЯ + ПЛАГИНЫ --------------------
  const base = createBaseViteConfig({
    app,
    mode,
    env,
    appFramework,
  });

  // -------------------- ОПРЕДЕЛЕНИЯ ПЕРЕМЕННЫХ --------------------
  const frameworkEnv = generateDefineMapping(app, env);

  return {
    ...base,
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(env[ENV_VARS.NODE_ENV] ?? mode ?? 'development'),
      ...frameworkEnv,
    },
  };
});
