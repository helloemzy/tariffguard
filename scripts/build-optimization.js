#!/usr/bin/env node

/**
 * Build Optimization Script
 * Configures environment-specific build optimizations for Next.js
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BUILD_TYPES = {
  development: {
    NODE_ENV: 'development',
    NEXT_TELEMETRY_DISABLED: '1',
    ANALYZE: 'false',
    BUILD_STANDALONE: 'false',
    SOURCE_MAPS: 'true',
    WEBPACK_BUNDLE_ANALYZER: 'false',
  },
  production: {
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    ANALYZE: 'false',
    BUILD_STANDALONE: 'false',
    SOURCE_MAPS: 'false',
    WEBPACK_BUNDLE_ANALYZER: 'false',
  },
  analyze: {
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    ANALYZE: 'true',
    BUILD_STANDALONE: 'false',
    SOURCE_MAPS: 'false',
    WEBPACK_BUNDLE_ANALYZER: 'true',
  },
  standalone: {
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    ANALYZE: 'false',
    BUILD_STANDALONE: 'true',
    SOURCE_MAPS: 'false',
    WEBPACK_BUNDLE_ANALYZER: 'false',
  },
}

function setBuildEnvironment(buildType) {
  const config = BUILD_TYPES[buildType]
  if (!config) {
    console.error(`❌ Invalid build type: ${buildType}`)
    console.log('Available types:', Object.keys(BUILD_TYPES).join(', '))
    process.exit(1)
  }

  console.log(`🔧 Configuring build environment for: ${buildType}`)
  
  // Set environment variables
  Object.entries(config).forEach(([key, value]) => {
    process.env[key] = value
    console.log(`   ${key}=${value}`)
  })
}

function cleanBuildArtifacts() {
  console.log('🧹 Cleaning build artifacts...')
  const dirsToClean = ['.next', 'dist', 'out']
  
  dirsToClean.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      console.log(`   Removed: ${dir}`)
    }
  })
}

function analyzeBundle() {
  console.log('📊 Running bundle analysis...')
  
  try {
    execSync('npx @next/bundle-analyzer .next', { stdio: 'inherit' })
    console.log('✅ Bundle analysis complete')
  } catch (error) {
    console.warn('⚠️  Bundle analysis failed:', error.message)
  }
}

function measureBuildTime() {
  console.log('⏱️  Measuring build time...')
  const startTime = Date.now()
  
  return () => {
    const duration = Date.now() - startTime
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)
    console.log(`🏁 Build completed in ${minutes}m ${seconds}s`)
  }
}

function optimizeBuild() {
  console.log('🚀 Optimizing build configuration...')
  
  // Optimize package.json for production builds
  if (process.env.NODE_ENV === 'production') {
    console.log('   Applying production optimizations...')
    
    // Remove dev dependencies from production bundle
    try {
      execSync('npm prune --omit=dev', { stdio: 'pipe' })
      console.log('   ✅ Pruned development dependencies')
    } catch (error) {
      console.warn('   ⚠️  Could not prune dev dependencies')
    }
  }
}

function generateBuildReport() {
  const buildInfo = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV,
    buildType: process.argv[2] || 'production',
    features: {
      bundleAnalyzer: process.env.ANALYZE === 'true',
      standalone: process.env.BUILD_STANDALONE === 'true',
      sourceMaps: process.env.SOURCE_MAPS === 'true',
    },
  }

  // Check if .next directory exists and get size
  if (fs.existsSync('.next')) {
    try {
      const stats = execSync('du -sh .next', { encoding: 'utf-8' })
      buildInfo.buildSize = stats.trim().split('\t')[0]
    } catch (error) {
      buildInfo.buildSize = 'unknown'
    }
  }

  const reportPath = path.join(process.cwd(), 'build-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(buildInfo, null, 2))
  console.log(`📋 Build report saved to: ${reportPath}`)
}

async function main() {
  const buildType = process.argv[2] || 'production'
  const shouldClean = process.argv.includes('--clean')
  const shouldAnalyze = process.argv.includes('--analyze') || buildType === 'analyze'
  
  console.log('🏗️  Next.js Build Optimization Script')
  console.log('=====================================')
  
  try {
    // Clean if requested
    if (shouldClean) {
      cleanBuildArtifacts()
    }

    // Set environment
    setBuildEnvironment(buildType)
    
    // Optimize build
    optimizeBuild()
    
    // Start timing
    const endTimer = measureBuildTime()
    
    // Run build
    console.log('🔨 Starting build...')
    execSync('next build', { 
      stdio: 'inherit',
      env: { ...process.env }
    })
    
    // End timing
    endTimer()
    
    // Analyze bundle if requested
    if (shouldAnalyze) {
      analyzeBundle()
    }
    
    // Generate report
    generateBuildReport()
    
    console.log('✅ Build optimization complete!')
    
  } catch (error) {
    console.error('❌ Build optimization failed:', error.message)
    process.exit(1)
  }
}

// Help text
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Next.js Build Optimization Script

Usage:
  node scripts/build-optimization.js [build-type] [options]

Build Types:
  development  - Development build with source maps
  production   - Production build (default)
  analyze      - Production build with bundle analysis
  standalone   - Standalone production build

Options:
  --clean      - Clean build artifacts before building
  --analyze    - Run bundle analysis after build
  --help, -h   - Show this help message

Examples:
  node scripts/build-optimization.js production
  node scripts/build-optimization.js analyze --clean
  node scripts/build-optimization.js standalone --clean
`)
  process.exit(0)
}

main()