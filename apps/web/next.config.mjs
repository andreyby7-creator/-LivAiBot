import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import createNextIntlPlugin from 'next-intl/plugin';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Настройка next-intl плагина
const withNextIntl = createNextIntlPlugin('./next-intl.config.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Конфигурация вывода для Docker развертывания
  output: 'standalone',

  // Строгий режим TypeScript
  typescript: {
    tsconfigPath: './tsconfig.build.json',
  },

  // Конфигурация изображений
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // dangerouslyAllowSVG: true, // Убрано для совместимости с Next.js 16
  },

  // Заголовки для безопасности и производительности
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  // Перенаправления (отключены для E2E тестов)
  // async redirects() {
  //   return [
  //     {
  //       source: '/',
  //       destination: '/dashboard',
  //       permanent: true, // Постоянное перенаправление для SEO
  //     },
  //   ];
  // },

  // Конфигурация Webpack
  webpack: (config, { isServer }) => {
    // Compile-time environment constant для оптимизации bundler'а
    const webpack = require('webpack');

    // Разрешение .js импортов из TypeScript файлов (для ESM с moduleResolution: NodeNext)
    // Когда пакеты используют .js в импортах, webpack должен искать .ts/.tsx файлы
    // Порядок важен: .ts/.tsx должны быть первыми, иначе webpack может подтянуть реальные .js из node_modules
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };

    // Исключаем серверные модули из клиентского бандла
    // Эти модули используют Node.js API (node:crypto) и не должны попадать в клиентский код
    if (!isServer) {
      // Fallback для node:* модулей в клиентском коде
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'node:crypto': false,
        crypto: false,
      };

      // Заменяем серверные модули на пустые заглушки в клиентском коде
      // Используем NormalModuleReplacementPlugin для более точной замены
      // Создаем пустой модуль для замены
      const emptyModule = path.resolve(__dirname, 'src/lib/empty-module.js');
      
      // Заменяем risk-scoring модуль на пустую заглушку
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /packages\/feature-auth\/src\/effects\/login\/risk-scoring\.(ts|js)$/,
          emptyModule
        )
      );
    }
    config.plugins.push(
      new webpack.DefinePlugin({
        __ENVIRONMENT__: JSON.stringify(
          process.env.NODE_ENV === 'production'
            ? 'prod'
            : process.env.NEXT_PUBLIC_APP_ENV === 'staging'
              ? 'stage'
              : 'dev'
        ),
      })
    );

    return config;
  },
};

export default withNextIntl(nextConfig);