import { createRequire } from 'module';
import createNextIntlPlugin from 'next-intl/plugin';

const require = createRequire(import.meta.url);

// Настройка next-intl плагина
const withNextIntl = createNextIntlPlugin('./next-intl.config.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Конфигурация вывода для Docker развертывания
  output: 'standalone',

  // Строгий режим TypeScript
  typescript: {
    tsconfigPath: './tsconfig.json',
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
  webpack: (config) => {
    // Разрешение .js импортов из TypeScript файлов (для ESM с moduleResolution: NodeNext)
    // Когда пакеты используют .js в импортах, webpack должен искать .ts/.tsx файлы
    // Порядок важен: .ts/.tsx должны быть первыми, иначе webpack может подтянуть реальные .js из node_modules
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };

    // Compile-time environment constant для оптимизации bundler'а
    const webpack = require('webpack');
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