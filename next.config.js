/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },

  // Disable ESLint during builds for production deployment
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Performance optimizations
  images: {
    domains: ['www.federalregister.gov'],
  },

  // Environment variables
  env: {
    CUSTOM_ENV_LOADED: 'true',
  },

  // Build configuration
  poweredByHeader: false,
  compress: true,

  // Output configuration for production deployment
  // output: 'standalone', // Disabled for Vercel deployment
}

module.exports = nextConfig
