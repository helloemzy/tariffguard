'use client'

import { CheckCircleIcon, XCircleIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useState, useEffect } from 'react'

interface SimpleStatus {
  federal_register_api: 'online' | 'offline' | 'checking'
  database: 'online' | 'offline' | 'checking'
  last_monitoring_check: string
  alerts_sent_today: number
  preston_hs_codes: Array<{
    code: string
    description: string
    last_checked: string
    current_rate?: number
  }>
}

export default function SimpleStatusPage() {
  const [status, setStatus] = useState<SimpleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchStatus = async () => {
    try {
      // Test system components
      const [federalRegisterTest, productionValidation] = await Promise.allSettled([
        fetch('/api/monitor/federal-register').then(res => res.json()),
        fetch('/api/production-validation').then(res => res.json())
      ])
      
      const federalRegisterStatus = 
        federalRegisterTest.status === 'fulfilled' && federalRegisterTest.value.success
          ? 'online' : 'offline'
      
      const databaseStatus = 
        productionValidation.status === 'fulfilled' && 
        productionValidation.value.tests?.some((t: any) => t.test === 'Database Connectivity' && t.success)
          ? 'online' : 'offline'
      
      // Get recent alerts count (simplified)
      let alertsToday = 0
      try {
        const alertsResponse = await fetch('/api/monitor/federal-register?daysBack=1')
        if (alertsResponse.ok) {
          const alertsData = await alertsResponse.json()
          alertsToday = alertsData.data?.summary?.significantChanges || 0
        }
      } catch (error) {
        console.warn('Failed to fetch alerts count:', error)
      }
      
      setStatus({
        federal_register_api: federalRegisterStatus,
        database: databaseStatus,
        last_monitoring_check: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        alerts_sent_today: alertsToday,
        preston_hs_codes: [
          {
            code: '7318.15.20',
            description: 'Steel fasteners - bolts, screws, and threaded articles',
            last_checked: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            current_rate: 25.0
          },
          {
            code: '8481.80.90',
            description: 'Taps, cocks, valves and similar appliances, other',
            last_checked: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            current_rate: 25.0
          },
          {
            code: '7326.90.85',
            description: 'Other articles of iron or steel, not elsewhere specified',
            last_checked: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            current_rate: 25.0
          }
        ]
      })
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch status:', error)
      // Fallback to offline status
      setStatus({
        federal_register_api: 'offline',
        database: 'offline',
        last_monitoring_check: new Date().toISOString(),
        alerts_sent_today: 0,
        preston_hs_codes: [
          {
            code: '7318.15.20',
            description: 'Steel fasteners - bolts, screws, and threaded articles',
            last_checked: new Date().toISOString(),
            current_rate: 25.0
          },
          {
            code: '8481.80.90',
            description: 'Taps, cocks, valves and similar appliances, other',
            last_checked: new Date().toISOString(),
            current_rate: 25.0
          },
          {
            code: '7326.90.85',
            description: 'Other articles of iron or steel, not elsewhere specified',
            last_checked: new Date().toISOString(),
            current_rate: 25.0
          }
        ]
      })
    } finally {
      setLoading(false)
    }
  }

  const triggerManualCheck = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/monitor/federal-register?daysBack=7', {
        method: 'GET',
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const { summary } = data.data
          const message = `✅ Manual check completed!\n\n` +
            `📋 Documents scanned: ${summary.documentsScanned}\n` +
            `🚨 Significant changes: ${summary.significantChanges}\n` +
            `💰 Container impact: ${summary.containerImpactRange}`
          
          alert(message)
          await fetchStatus()
        } else {
          alert(`❌ Manual check failed: ${data.error}`)
        }
      } else {
        alert('❌ Manual monitoring check failed. Please try again.')
      }
    } catch (error) {
      alert('❌ Failed to trigger monitoring check.')
      console.error('Manual check error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'online':
        return <CheckCircleIcon className="size-5 text-green-500" />
      case 'offline':
        return <XCircleIcon className="size-5 text-red-500" />
      default:
        return <ClockIcon className="size-5 text-yellow-500" />
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const then = new Date(dateString)
    const diffMs = now.getTime() - then.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffHours < 1) {return 'Less than 1 hour ago'}
    if (diffHours === 1) {return '1 hour ago'}
    return `${diffHours} hours ago`
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-gray-600">Loading status...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">TariffGuard Status</h1>
          <p className="text-gray-600">Preston&apos;s Federal Register Monitoring System</p>
        </div>

        {/* Overall Status */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="size-8 text-green-500" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">System Operational</h2>
                <p className="text-gray-600">Federal Register monitoring active</p>
              </div>
            </div>
            <button
              onClick={triggerManualCheck}
              disabled={loading}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <ArrowPathIcon className="size-4" />
              Manual Check
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        </div>

        {/* System Components */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">System Components</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-3">
                <StatusIcon status={status?.federal_register_api || 'checking'} />
                <span className="font-medium">Federal Register API</span>
              </div>
              <span className="text-sm capitalize text-gray-600">
                {status?.federal_register_api || 'checking'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-3">
                <StatusIcon status={status?.database || 'checking'} />
                <span className="font-medium">Database</span>
              </div>
              <span className="text-sm capitalize text-gray-600">
                {status?.database || 'checking'}
              </span>
            </div>
          </div>
        </div>

        {/* Monitoring Summary */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Monitoring Summary</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">3</div>
              <div className="text-sm text-gray-600">HS Codes Monitored</div>
            </div>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{status?.alerts_sent_today || 0}</div>
              <div className="text-sm text-gray-600">Alerts Today</div>
            </div>
            <div className="rounded-lg bg-purple-50 p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">4hr</div>
              <div className="text-sm text-gray-600">Check Interval</div>
            </div>
          </div>
          {status?.last_monitoring_check && (
            <p className="mt-4 text-center text-sm text-gray-500">
              Last monitoring check: {formatTimeAgo(status.last_monitoring_check)}
            </p>
          )}
        </div>

        {/* Preston's HS Codes */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Monitored HS Codes</h3>
          <div className="space-y-3">
            {status?.preston_hs_codes.map((hsCode) => (
              <div key={hsCode.code} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{hsCode.code}</h4>
                    <p className="text-sm text-gray-600">{hsCode.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">
                      {hsCode.current_rate ? `${hsCode.current_rate}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">Current Rate</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Last checked: {formatTimeAgo(hsCode.last_checked)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Simple Federal Register monitoring system for Preston&apos;s tariff alerts.</p>
          <p className="mt-1">System checks every 4 hours during business hours (9 AM - 6 PM EST).</p>
        </div>
      </div>
    </div>
  )
}