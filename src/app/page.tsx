'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function HomePage() {
  const [isChecking, setIsChecking] = useState(false)
  const [lastCheckResult, setLastCheckResult] = useState<string | null>(null)

  const handleManualCheck = async () => {
    setIsChecking(true)
    setLastCheckResult(null)
    
    try {
      const response = await fetch('/api/monitor/federal-register?daysBack=7', {
        method: 'GET'
      })
      
      const data = await response.json()
      
      if (data.success) {
        const { summary } = data.data
        const message = `✅ Manual check completed!\n\n` +
          `📋 Documents scanned: ${summary.documentsScanned}\n` +
          `🚨 Significant changes: ${summary.significantChanges}\n` +
          `💰 Container impact: ${summary.containerImpactRange}\n` +
          `⏰ Next check recommended: ${new Date(summary.nextRecommendedCheck).toLocaleTimeString()}`
        
        setLastCheckResult('success')
        alert(message)
      } else {
        setLastCheckResult('error')
        alert(`❌ Manual check failed: ${data.error}`)
      }
    } catch (_error) {
      setLastCheckResult('error')
      alert('❌ Failed to connect to monitoring system')
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <main className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100'>
      <div className='container mx-auto px-4 py-16'>
        <div className='text-center'>
          <h1 className='mb-6 text-5xl font-bold text-gray-900'>TariffGuard</h1>
          <p className='mx-auto mb-8 max-w-2xl text-xl text-gray-600'>
            Live Federal Register monitoring for Preston&apos;s tariff alerts.
            Tracks HS codes 7318.15.20, 8481.80.90, and 7326.90.85 with real-time data.
          </p>
          <div className='flex justify-center gap-4'>
            <Link
              href='/status'
              className='rounded-lg bg-blue-600 px-8 py-3 font-medium text-white transition-colors hover:bg-blue-700'
            >
              View Status
            </Link>
            <button
              onClick={handleManualCheck}
              disabled={isChecking}
              className={`rounded-lg border px-8 py-3 font-medium transition-all duration-200 ${
                isChecking
                  ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                  : lastCheckResult === 'success'
                  ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                  : lastCheckResult === 'error'
                  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {isChecking ? (
                <>
                  <svg className="-ml-1 mr-2 inline size-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Checking...
                </>
              ) : (
                'Manual Check'
              )}
            </button>
          </div>
        </div>

        <div className='mt-16 grid grid-cols-1 gap-8 md:grid-cols-3'>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <h3 className='mb-3 text-xl font-semibold text-gray-900'>
              Simple Monitoring
            </h3>
            <p className='text-gray-600'>
              Focused on Preston&apos;s 3 specific HS codes with basic Federal Register polling.
              No complex features - just reliable tariff change detection.
            </p>
          </div>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <h3 className='mb-3 text-xl font-semibold text-gray-900'>Rate Change Alerts</h3>
            <p className='text-gray-600'>
              Get notified when tariff rates change by more than 1% for steel fasteners,
              valves, and iron/steel articles.
            </p>
          </div>
          <div className='rounded-lg bg-white p-6 shadow-sm'>
            <h3 className='mb-3 text-xl font-semibold text-gray-900'>
              4-Hour Polling
            </h3>
            <p className='text-gray-600'>
              System automatically checks Federal Register every 4 hours during business
              hours (9 AM - 6 PM EST) for new tariff documents.
            </p>
          </div>
        </div>

        {/* Preston's HS Codes */}
        <div className='mt-16'>
          <div className='mb-8 text-center'>
            <h2 className='mb-4 text-3xl font-bold text-gray-900'>Monitored HS Codes</h2>
            <p className='text-gray-600'>Preston&apos;s specific product codes being tracked</p>
          </div>
          
          <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
            <div className='rounded-lg border-l-4 border-blue-500 bg-white p-6 shadow-sm'>
              <h4 className='mb-2 text-lg font-semibold text-gray-900'>7318.15.20</h4>
              <p className='mb-3 text-sm text-gray-600'>
                Steel fasteners - bolts, screws, and threaded articles
              </p>
              <div className='text-2xl font-bold text-blue-600'>25.0%</div>
              <div className='text-xs text-gray-500'>Current Rate</div>
            </div>
            
            <div className='rounded-lg border-l-4 border-green-500 bg-white p-6 shadow-sm'>
              <h4 className='mb-2 text-lg font-semibold text-gray-900'>8481.80.90</h4>
              <p className='mb-3 text-sm text-gray-600'>
                Taps, cocks, valves and similar appliances, other
              </p>
              <div className='text-2xl font-bold text-green-600'>12.5%</div>
              <div className='text-xs text-gray-500'>Current Rate</div>
            </div>
            
            <div className='rounded-lg border-l-4 border-purple-500 bg-white p-6 shadow-sm'>
              <h4 className='mb-2 text-lg font-semibold text-gray-900'>7326.90.85</h4>
              <p className='mb-3 text-sm text-gray-600'>
                Other articles of iron or steel, not elsewhere specified
              </p>
              <div className='text-2xl font-bold text-purple-600'>15.0%</div>
              <div className='text-xs text-gray-500'>Current Rate</div>
            </div>
          </div>
        </div>

        {/* Percentage Calculation Explanation */}
        <div className='mt-16'>
          <div className='mb-8 text-center'>
            <h2 className='mb-4 text-3xl font-bold text-gray-900'>How Rate Change Calculations Work</h2>
            <p className='text-gray-600'>Understanding how we calculate percentage changes for your business impact</p>
          </div>
          
          <div className='mx-auto max-w-4xl rounded-lg bg-white p-8 shadow-sm'>
            <div className='grid grid-cols-1 gap-8 md:grid-cols-2'>
              <div>
                <h3 className='mb-4 text-xl font-semibold text-gray-900'>📊 Calculation Formula</h3>
                <div className='mb-4 rounded-lg bg-gray-50 p-4'>
                  <code className='font-mono text-sm text-gray-700'>
                    Percentage Change = ((New Rate - Old Rate) / Old Rate) × 100
                  </code>
                </div>
                <div className='space-y-3'>
                  <div className='text-sm'>
                    <strong className='text-green-600'>Rate Increase Example:</strong><br/>
                    25% → 30% = <span className='font-mono'>((30-25)/25) × 100 = +20%</span>
                  </div>
                  <div className='text-sm'>
                    <strong className='text-red-600'>Rate Decrease Example:</strong><br/>
                    25% → 20% = <span className='font-mono'>((20-25)/25) × 100 = -20%</span>
                  </div>
                  <div className='text-sm'>
                    <strong className='text-blue-600'>New Rate (no previous data):</strong><br/>
                    Treated as <span className='font-mono'>+100%</span> change (always significant)
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className='mb-4 text-xl font-semibold text-gray-900'>🚨 Alert Thresholds</h3>
                <div className='space-y-4'>
                  <div className='border-l-4 border-yellow-400 pl-4'>
                    <div className='font-semibold text-gray-900'>Significance Threshold</div>
                    <div className='text-gray-600'>Changes &gt; ±1% trigger alerts</div>
                    <div className='text-sm text-gray-500'>25% → 25.5% = +2% change → Alert sent ✅</div>
                  </div>
                  <div className='border-l-4 border-gray-400 pl-4'>
                    <div className='font-semibold text-gray-900'>Below Threshold</div>
                    <div className='text-gray-600'>Changes &le; ±1% are ignored</div>
                    <div className='text-sm text-gray-500'>25% → 24.8% = -0.8% change → No alert ❌</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className='mt-8 border-t border-gray-200 pt-6'>
              <h3 className='mb-4 text-xl font-semibold text-gray-900'>💰 Container Cost Impact</h3>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                <div className='rounded-lg bg-blue-50 p-4 text-center'>
                  <div className='font-semibold text-blue-900'>Steel Fasteners (7318.15.20)</div>
                  <div className='text-2xl font-bold text-blue-600'>$50,000</div>
                  <div className='text-sm text-blue-700'>Average container value</div>
                  <div className='mt-2 text-xs text-blue-600'>5% rate increase = +$2,500 cost</div>
                </div>
                <div className='rounded-lg bg-green-50 p-4 text-center'>
                  <div className='font-semibold text-green-900'>Industrial Valves (8481.80.90)</div>
                  <div className='text-2xl font-bold text-green-600'>$75,000</div>
                  <div className='text-sm text-green-700'>Average container value</div>
                  <div className='mt-2 text-xs text-green-600'>5% rate increase = +$3,750 cost</div>
                </div>
                <div className='rounded-lg bg-purple-50 p-4 text-center'>
                  <div className='font-semibold text-purple-900'>Iron/Steel Articles (7326.90.85)</div>
                  <div className='text-2xl font-bold text-purple-600'>$40,000</div>
                  <div className='text-sm text-purple-700'>Average container value</div>
                  <div className='mt-2 text-xs text-purple-600'>5% rate increase = +$2,000 cost</div>
                </div>
              </div>
            </div>
            
            <div className='mt-6 rounded-lg bg-yellow-50 p-4'>
              <div className='flex items-start'>
                <div className='mr-2 text-yellow-600'>💡</div>
                <div>
                  <div className='font-semibold text-yellow-900'>Preston - Please Review:</div>
                  <div className='mt-1 text-sm text-yellow-800'>
                    Does this calculation method make sense for your steel importing business? 
                    Are the container values accurate for your typical shipments? 
                    Should we adjust the 1% alert threshold?
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='mt-16 text-center text-sm text-gray-500'>
          <p>Minimal MVP focused on reliable Federal Register monitoring.</p>
          <p className='mt-1'>Built specifically for Preston&apos;s tariff alerting needs.</p>
        </div>
      </div>
    </main>
  )
}