#!/usr/bin/env node

/**
 * Complete System Test for Preston's Tariff Monitoring
 * 
 * This script demonstrates the full Federal Register integration
 * working with Preston's specific HS codes and business requirements.
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000'

async function runSystemTest() {
  console.log('🚀 Testing Preston\'s Tariff Monitoring System')
  console.log('=' .repeat(60))
  
  const tests = [
    {
      name: 'Federal Register API Integration',
      endpoint: '/api/test/federal-register',
      method: 'GET'
    },
    {
      name: 'Manual Monitoring Check',
      endpoint: '/api/monitor/federal-register?daysBack=7',
      method: 'GET'
    },
    {
      name: 'Production System Validation',
      endpoint: '/api/production-validation',
      method: 'GET'
    }
  ]
  
  let passed = 0
  let failed = 0
  
  for (const test of tests) {
    console.log(`\n🔄 Running: ${test.name}`)
    
    try {
      const startTime = Date.now()
      const response = await fetch(`${BASE_URL}${test.endpoint}`, {
        method: test.method
      })
      
      const duration = Date.now() - startTime
      const data = await response.json()
      
      if (data.success) {
        passed++
        console.log(`✅ PASSED (${duration}ms)`)
        
        // Show relevant details
        if (test.name.includes('Federal Register')) {
          console.log(`   📊 Tests Run: ${data.totalTests}, Passed: ${data.passedTests}`)
        } else if (test.name.includes('Monitoring')) {
          console.log(`   📋 Documents Scanned: ${data.data.summary.documentsScanned}`)
          console.log(`   🚨 Significant Changes: ${data.data.summary.significantChanges}`)
          console.log(`   💰 Container Impact: ${data.data.summary.containerImpactRange}`)
        } else if (test.name.includes('Production')) {
          const tests = data.tests || []
          const testsPassed = tests.filter(t => t.success).length
          console.log(`   🔧 System Tests: ${testsPassed}/${tests.length} passed`)
        }
        
      } else {
        failed++
        console.log(`❌ FAILED (${duration}ms)`)
        console.log(`   Error: ${data.error || 'Unknown error'}`)
      }
      
    } catch (error) {
      failed++
      console.log(`❌ FAILED - Connection Error`)
      console.log(`   Error: ${error.message}`)
    }
  }
  
  console.log(`\n${  '=' .repeat(60)}`)
  console.log('📊 SYSTEM TEST RESULTS')
  console.log('=' .repeat(60))
  console.log(`✅ Tests Passed: ${passed}`)
  console.log(`❌ Tests Failed: ${failed}`)
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Preston\'s tariff monitoring system is ready.')
    console.log('\n📋 Key Features Working:')
    console.log('   • Federal Register API connectivity')
    console.log('   • Document search for steel tariffs')
    console.log('   • HS code specific monitoring (7318.15.20, 8481.80.90, 7326.90.85)')
    console.log('   • Rate change detection with 1% threshold')
    console.log('   • Container cost impact calculations')
    console.log('   • Manual monitoring triggers')
    console.log('   • Database integration for storing findings')
    console.log('   • Alert generation for significant changes')
    
    console.log('\n🔗 System URLs:')
    console.log(`   • Homepage: ${BASE_URL}`)
    console.log(`   • Status Dashboard: ${BASE_URL}/status`)
    console.log(`   • Manual Check API: ${BASE_URL}/api/monitor/federal-register`)
    console.log(`   • Test Suite: ${BASE_URL}/api/test/federal-register`)
    
  } else {
    console.log('\n⚠️  Some tests failed. Please check the system configuration.')
  }
  
  console.log(`\n${  '=' .repeat(60)}`)
}

// Run if called directly
if (require.main === module) {
  runSystemTest().catch(console.error)
}

module.exports = { runSystemTest }