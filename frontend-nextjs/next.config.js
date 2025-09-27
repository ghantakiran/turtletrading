/** @type {import('next').NextConfig} */

const budgetConfig = require('./performance-budget.config.js')

const nextConfig = {
  // Performance optimizations
  experimental: {
    // Enable modern bundling features
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
    // Performance monitoring
    instrumentationHook: true,
    // WebAssembly support for trading calculations
    serverComponentsExternalPackages: ['talib'],
  },

  // Bundle analyzer in development
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config, { dev, isServer }) => {
      if (dev && !isServer) {
        const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'server',
            analyzerPort: 8888,
            openAnalyzer: true,
          })
        )
      }
      return config
    },
  }),

  // Performance budgets enforcement
  webpack: (config, { dev, isServer }) => {
    // Add performance budgets
    if (!dev && !isServer) {
      config.performance = {
        hints: 'error',
        maxAssetSize: budgetConfig.budgets.find(b => b.name === 'main')?.maximumError || 300 * 1024,
        maxEntrypointSize: budgetConfig.budgets.find(b => b.type === 'initial')?.maximumError || 800 * 1024,
        assetFilter: (assetFilename) => {
          // Apply budgets to JS and CSS files
          return assetFilename.endsWith('.js') || assetFilename.endsWith('.css')
        }
      }

      // Split chunks for optimal loading
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              maxSize: budgetConfig.budgets.find(b => b.name === 'vendor')?.maximumError || 500 * 1024,
            },
            trading: {
              test: /[\\/](trading|analysis|indicators)[\\/]/,
              name: 'trading',
              chunks: 'all',
              priority: 8,
              maxSize: 150 * 1024,
            },
            charts: {
              test: /[\\/](chart|graph|visualization)[\\/]/,
              name: 'charts',
              chunks: 'all',
              priority: 7,
              maxSize: 200 * 1024,
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5,
              reuseExistingChunk: true,
              maxSize: 100 * 1024,
            }
          }
        }
      }
    }

    return config
  },

  // Environment-specific optimizations
  env: {
    PERFORMANCE_MONITORING: process.env.NODE_ENV === 'production' ? 'true' : 'false',
    WEB_VITALS_DEBUG: process.env.NODE_ENV === 'development' ? 'true' : 'false',
  },

  // Headers for performance and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Performance headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          // Trading platform security
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:; frame-src 'none';"
          },
          // Performance monitoring headers
          {
            key: 'Server-Timing',
            value: 'app;desc="App",db;desc="Database"'
          }
        ]
      },
      // Static assets caching
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  },

  // Redirects for SEO and performance
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ]
  },

  // Image optimization for trading charts and logos
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Output configuration for performance
  output: 'standalone',

  // Enable compression
  compress: true,

  // Trading platform specific configuration
  poweredByHeader: false,
  generateEtags: true,

  // Development performance
  ...(process.env.NODE_ENV === 'development' && {
    typescript: {
      // Ignore build errors during development for faster iteration
      ignoreBuildErrors: false,
    },
    eslint: {
      // Ignore ESLint errors during development builds
      ignoreDuringBuilds: false,
    },
  }),
}

module.exports = nextConfig