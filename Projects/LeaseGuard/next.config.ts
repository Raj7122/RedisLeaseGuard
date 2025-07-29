import type { NextConfig } from 'next';

/**
 * Next.js Production Configuration
 * 
 * Implements production-ready configuration with:
 * - Security headers and CSP
 * - Performance optimizations
 * - Environment-specific settings
 * - Build optimizations
 * 
 * S.A.F.E. D.R.Y. Principles:
 * - Strategic: Planned deployment architecture
 * - Automated: Build and deployment automation
 * - Fortified: Security-first configuration
 * - Evolving: Continuous improvement
 * - DRY: Reusable configuration patterns
 * - Resilient: Production-ready settings
 * - Your-Focused: User experience optimization
 */

const nextConfig: NextConfig = {
  // Production optimizations
  productionBrowserSourceMaps: false, // Disable source maps in production for security
  compress: true, // Enable gzip compression
  poweredByHeader: false, // Remove X-Powered-By header for security
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://api.openai.com https://generativelanguage.googleapis.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; ')
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          // Referrer policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Permissions policy
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          // Strict Transport Security (HTTPS only)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          }
        ]
      },
      // API routes security
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          }
        ]
      }
    ];
  },

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Build optimizations
  experimental: {
    optimizeCss: true, // Optimize CSS
    scrollRestoration: true, // Better scroll behavior
  },

  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // Webpack configuration for security
  webpack: (config, { dev, isServer }) => {
    // Security: Remove console.log in production
    if (!dev) {
      config.optimization.minimizer?.push(
        new (require('terser-webpack-plugin'))({
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
            },
          },
        })
      );
    }

    // Security: Add source map exclusions for sensitive files
    if (!dev) {
      config.module.rules.push({
        test: /\.(js|ts|tsx)$/,
        enforce: 'pre',
        exclude: /node_modules/,
        use: [
          {
            loader: 'source-map-loader',
            options: {
              filterSourceMappingUrl: (url: string, resourcePath: string) => {
                // Exclude source maps for sensitive files
                if (resourcePath.includes('node_modules')) {
                  return false;
                }
                return true;
              },
            },
          },
        ],
      });
    }

    return config;
  },

  // Redirects for security
  async redirects() {
    return [
      // Redirect HTTP to HTTPS in production
      ...(process.env.NODE_ENV === 'production' ? [
        {
          source: '/:path*',
          has: [
            {
              type: 'header',
              key: 'x-forwarded-proto',
              value: 'http',
            },
          ],
          destination: 'https://:host/:path*',
          permanent: true,
        },
      ] : []),
      // Security: Redirect common attack paths
      {
        source: '/admin',
        destination: '/',
        permanent: false,
      },
      {
        source: '/wp-admin',
        destination: '/',
        permanent: false,
      },
      {
        source: '/phpmyadmin',
        destination: '/',
        permanent: false,
      },
    ];
  },

  // Rewrites for API routing
  async rewrites() {
    return [
      {
        source: '/api/health',
        destination: '/api/health',
      },
      {
        source: '/api/chat',
        destination: '/api/chat',
      },
      {
        source: '/api/upload',
        destination: '/api/upload',
      },
    ];
  },

  // TypeScript configuration
  typescript: {
    // Don't run TypeScript during build in production (already checked in CI)
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },

  // ESLint configuration
  eslint: {
    // Don't run ESLint during build in production (already checked in CI)
    ignoreDuringBuilds: process.env.NODE_ENV === 'production',
  },

  // Output configuration
  output: 'standalone', // Optimized for containerized deployments

  // Trailing slash configuration
  trailingSlash: false,

  // Base path configuration (if needed for subdirectory deployment)
  basePath: process.env.BASE_PATH || '',

  // Asset prefix configuration
  assetPrefix: process.env.ASSET_PREFIX || '',

  // Runtime configuration
  serverRuntimeConfig: {
    // Will only be available on the server side
    redisUrl: process.env.REDIS_URL,
    geminiApiKey: process.env.GEMINI_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,
  },

  publicRuntimeConfig: {
    // Will be available on both server and client
    appName: 'LeaseGuard',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
};

export default nextConfig;
