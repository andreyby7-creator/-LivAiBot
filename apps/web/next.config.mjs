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
    // Здесь можно добавить кастомные правила Webpack

    // Оптимизация бандла Effect.js (использовать с осторожностью)
    // Примечание: 'effect': false может вызвать проблемы runtime если модули Effect нужны
    // Рассмотрите ручной tree-shaking или оптимизации бандлера Effect
    // webpack: (config, { dev, isServer }) => {
    //   if (!dev && !isServer) {
    //     config.resolve.alias = {
    //       ...config.resolve.alias,
    //       'effect': false, // Tree shake неиспользуемых модулей Effect
    //     };
    //   }
    //   return config;
    // }

    return config;
  },
};

export default nextConfig;