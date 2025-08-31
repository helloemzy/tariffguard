/**
 * Comprehensive Build Optimization Configuration
 * 
 * This file centralizes all optimization settings for different environments
 * and provides utilities for build performance monitoring.
 */

const path = require('path')

// Environment-specific configurations
const ENVIRONMENTS = {
  development: {
    name: 'development',
    NODE_ENV: 'development',
    sourceMaps: true,
    minification: false,
    bundleAnalyzer: false,
    compression: false,
    optimizeImages: false,
    inlineStyles: false,
    treeShaking: false,
  },
  test: {
    name: 'test',
    NODE_ENV: 'test',
    sourceMaps: true,
    minification: false,
    bundleAnalyzer: false,
    compression: false,
    optimizeImages: false,
    inlineStyles: false,
    treeShaking: false,
  },
  staging: {
    name: 'staging',
    NODE_ENV: 'production',
    sourceMaps: true,
    minification: true,
    bundleAnalyzer: true,
    compression: true,
    optimizeImages: true,
    inlineStyles: true,
    treeShaking: true,
  },
  production: {
    name: 'production',
    NODE_ENV: 'production',
    sourceMaps: false,
    minification: true,
    bundleAnalyzer: false,
    compression: true,
    optimizeImages: true,
    inlineStyles: true,
    treeShaking: true,
  }
}

// Performance budgets for different environments
const PERFORMANCE_BUDGETS = {
  development: {
    bundleSize: '2MB',
    initialJS: '500KB',
    totalJS: '1.5MB',
    css: '200KB',
    images: '1MB',
  },
  production: {
    bundleSize: '800KB',
    initialJS: '250KB',
    totalJS: '600KB',
    css: '100KB',
    images: '500KB',
  }
}

// Optimization strategies
const OPTIMIZATION_STRATEGIES = {
  // Code splitting configuration
  codeSplitting: {
    chunks: 'all',
    minSize: 20000,
    maxSize: 244000,
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: 10,
        reuseExistingChunk: true,
      },
      common: {
        name: 'common',
        minChunks: 2,
        priority: 5,
        reuseExistingChunk: true,
      },
      styles: {
        name: 'styles',
        test: /\\.css$/,
        chunks: 'all',
        enforce: true,
      }
    }
  },

  // Tree shaking configuration
  treeShaking: {
    usedExports: true,
    sideEffects: [
      '*.css',
      '*.scss',
      '*.sass',
      '*.less'
    ]
  },

  // Compression settings
  compression: {
    gzip: {
      threshold: 1024,
      minRatio: 0.8
    },
    brotli: {
      threshold: 1024,
      minRatio: 0.8
    }
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
  },

  // Bundle analysis
  bundleAnalysis: {
    analyzerMode: 'static',
    openAnalyzer: false,
    generateStatsFile: true,
    statsFilename: 'webpack-stats.json',
  }
}

// Cache strategies for different environments
const CACHE_STRATEGIES = {
  development: {
    buildCache: true,
    nodeModulesCache: true,
    nextCache: true,
    vercelCache: false,
    maxAge: '1h',
  },
  ci: {
    buildCache: true,
    nodeModulesCache: true,
    nextCache: true,
    vercelCache: false,
    maxAge: '24h',
  },
  production: {
    buildCache: true,
    nodeModulesCache: false,
    nextCache: true,
    vercelCache: true,
    maxAge: '7d',
  }
}

// Monitoring and reporting configuration
const MONITORING_CONFIG = {
  lighthouse: {
    performance: {
      minScore: 85,
      budget: {
        'first-contentful-paint': 2000,
        'largest-contentful-paint': 3000,
        'cumulative-layout-shift': 0.1,
        'total-blocking-time': 500,
      }
    },
    accessibility: { minScore: 90 },
    bestPractices: { minScore: 90 },
    seo: { minScore: 90 },
  },
  bundleSize: {
    limits: {
      'client-bundle': '300KB',
      'initial-js': '150KB',
      'css-total': '50KB',
    }
  }
}

// Utility functions for optimization
const OptimizationUtils = {
  /**
   * Get configuration for current environment
   */
  getEnvironmentConfig(env = process.env.NODE_ENV || 'development') {
    return ENVIRONMENTS[env] || ENVIRONMENTS.development
  },

  /**
   * Get performance budget for environment
   */
  getPerformanceBudget(env = process.env.NODE_ENV || 'development') {
    return PERFORMANCE_BUDGETS[env] || PERFORMANCE_BUDGETS.development
  },

  /**
   * Get cache strategy for environment
   */
  getCacheStrategy(env = process.env.NODE_ENV || 'development') {
    const envType = env === 'production' ? 'production' : 
                   process.env.CI ? 'ci' : 'development'
    return CACHE_STRATEGIES[envType]
  },

  /**
   * Generate webpack optimization config
   */
  getWebpackOptimization(env) {
    const config = this.getEnvironmentConfig(env)
    
    return {
      minimize: config.minification,
      splitChunks: config.treeShaking ? OPTIMIZATION_STRATEGIES.codeSplitting : false,
      usedExports: config.treeShaking,
      sideEffects: config.treeShaking ? OPTIMIZATION_STRATEGIES.treeShaking.sideEffects : false,
    }
  },

  /**
   * Check if feature should be enabled
   */
  isFeatureEnabled(feature, env) {
    const config = this.getEnvironmentConfig(env)
    return config[feature] || false
  },

  /**
   * Get build report template
   */
  getBuildReportTemplate() {
    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      buildTime: null,
      bundleSize: null,
      performance: {
        lighthouse: null,
        sizeCheck: null,
      },
      optimizations: {
        codeSplitting: false,
        treeShaking: false,
        compression: false,
        imageOptimization: false,
      }
    }
  }
}

module.exports = {
  ENVIRONMENTS,
  PERFORMANCE_BUDGETS,
  OPTIMIZATION_STRATEGIES,
  CACHE_STRATEGIES,
  MONITORING_CONFIG,
  OptimizationUtils,
}

// Export for ES modules
module.exports.default = module.exports