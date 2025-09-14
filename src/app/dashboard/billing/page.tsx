'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  CreditCardIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  ArrowUpCircleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import { SUBSCRIPTION_PLANS } from '@/lib/stripe'

interface SubscriptionInfo {
  plan: keyof typeof SUBSCRIPTION_PLANS
  status: string
  currentPeriodEnd?: string
  stripeCustomerId?: string
  planConfig: {
    name: string
    price: number
    calculationsPerMonth: number
    features: string[]
  }
}

interface UsageInfo {
  currentMonth: number
  limit: number
  canMakeCalculation: boolean
}

interface UpgradeInfo {
  shouldUpgrade: boolean
  suggestedPlan?: string
  reason?: string
}

export default function BillingPage() {
  const router = useRouter()
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [usage, setUsage] = useState<UsageInfo | null>(null)
  const [upgradeInfo, setUpgradeInfo] = useState<UpgradeInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchBillingInfo()
  }, [])

  const fetchBillingInfo = async () => {
    try {
      // Get workspace ID from local storage or context
      const workspaceId = localStorage.getItem('currentWorkspaceId')
      if (!workspaceId) {
        router.push('/dashboard')
        return
      }

      // Fetch subscription status
      const response = await fetch(`/api/subscription/status?workspaceId=${workspaceId}`)
      const data = await response.json()

      if (data.success) {
        setSubscription(data.subscription)
        setUsage(data.usage)
        
        // Check for upgrade suggestions
        const usagePercent = data.usage.limit === -1 ? 0 : (data.usage.currentMonth / data.usage.limit) * 100
        if (usagePercent > 80) {
          setUpgradeInfo({
            shouldUpgrade: true,
            suggestedPlan: data.subscription.plan === 'FREE' ? 'PROFESSIONAL' : 'ENTERPRISE',
            reason: usagePercent > 90 ? 'You\'re close to your limit!' : 'Consider upgrading for more capacity'
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch billing info:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (plan: string) => {
    try {
      setActionLoading('upgrade')
      const workspaceId = localStorage.getItem('currentWorkspaceId')
      
      const response = await fetch('/api/subscription/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, workspaceId })
      })

      const data = await response.json()
      if (data.success) {
        window.location.href = data.checkoutUrl
      } else {
        alert('Failed to create checkout session: ' + data.error)
      }
    } catch (error) {
      console.error('Upgrade failed:', error)
      alert('Failed to start upgrade process')
    } finally {
      setActionLoading(null)
    }
  }

  const handleManageBilling = async () => {
    try {
      setActionLoading('portal')
      const workspaceId = localStorage.getItem('currentWorkspaceId')
      
      const response = await fetch('/api/subscription/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      })

      const data = await response.json()
      if (data.success) {
        window.location.href = data.portalUrl
      } else {
        alert('Failed to open billing portal: ' + data.error)
      }
    } catch (error) {
      console.error('Billing portal failed:', error)
      alert('Failed to open billing portal')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'past_due': return 'text-yellow-600 bg-yellow-100'
      case 'canceled': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getUsagePercentage = () => {
    if (!usage || usage.limit === -1) return 0
    return Math.min((usage.currentMonth / usage.limit) * 100, 100)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="mt-2 text-gray-600">Manage your subscription, view usage, and billing history</p>
        </div>

        {/* Upgrade Alert */}
        {upgradeInfo?.shouldUpgrade && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">{upgradeInfo.reason}</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Consider upgrading to {upgradeInfo.suggestedPlan} for more capacity.
                </p>
              </div>
              <button
                onClick={() => handleUpgrade(upgradeInfo.suggestedPlan!)}
                className="ml-3 text-sm font-medium text-yellow-800 hover:text-yellow-900"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Plan */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <CreditCardIcon className="h-6 w-6 text-blue-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">Current Plan</h2>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription?.status || 'active')}`}>
                  {subscription?.status?.replace('_', ' ').toUpperCase() || 'ACTIVE'}
                </span>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">{subscription?.planConfig.name}</h3>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-blue-600">${subscription?.planConfig.price}</p>
                    <p className="text-sm text-gray-600">{subscription?.planConfig.price === 0 ? 'Forever' : 'per month'}</p>
                  </div>
                </div>

                {subscription?.currentPeriodEnd && (
                  <div className="flex items-center text-sm text-gray-600 mb-4">
                    <ClockIcon className="h-4 w-4 mr-2" />
                    Next billing: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </div>
                )}

                <div className="space-y-2">
                  {subscription?.planConfig.features.map((feature, index) => (
                    <div key={index} className="flex items-center text-sm text-gray-700">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                {subscription?.plan === 'FREE' ? (
                  <>
                    <button
                      onClick={() => handleUpgrade('PROFESSIONAL')}
                      disabled={actionLoading === 'upgrade'}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                    >
                      {actionLoading === 'upgrade' ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <ArrowUpCircleIcon className="h-4 w-4 mr-2" />
                          Upgrade to Professional
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    {subscription?.plan === 'PROFESSIONAL' && (
                      <button
                        onClick={() => handleUpgrade('ENTERPRISE')}
                        disabled={actionLoading === 'upgrade'}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                      >
                        {actionLoading === 'upgrade' ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <ArrowUpCircleIcon className="h-4 w-4 mr-2" />
                            Upgrade to Enterprise
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={handleManageBilling}
                      disabled={actionLoading === 'portal'}
                      className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center"
                    >
                      {actionLoading === 'portal' ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      ) : (
                        <>
                          <CreditCardIcon className="h-4 w-4 mr-2" />
                          Manage Billing
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              <div className="flex items-center mb-6">
                <ChartBarIcon className="h-6 w-6 text-green-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">Usage This Month</h2>
              </div>

              <div className="space-y-6">
                {/* Calculations Usage */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Calculations</span>
                    <span className="text-sm text-gray-600">
                      {usage?.currentMonth || 0} / {usage?.limit === -1 ? '∞' : usage?.limit || 0}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${ 
                        getUsagePercentage() > 90 ? 'bg-red-500' :
                        getUsagePercentage() > 75 ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.max(getUsagePercentage(), 2)}%` }}
                    ></div>
                  </div>
                  {usage?.limit !== -1 && getUsagePercentage() > 80 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      {getUsagePercentage() > 95 ? 'Limit almost reached!' : 'Approaching limit'}
                    </p>
                  )}
                </div>

                {/* Status Indicators */}
                <div className="space-y-3 pt-4 border-t border-gray-100">
                  <div className="flex items-center text-sm">
                    <div className={`w-2 h-2 rounded-full mr-3 ${ 
                      usage?.canMakeCalculation ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-gray-700">
                      {usage?.canMakeCalculation ? 'Can make calculations' : 'Limit reached'}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-4">
                    Usage resets on the 1st of each month
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Available Plans */}
        {subscription?.plan === 'FREE' && (
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Available Plans</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Professional Plan */}
                <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Professional</h3>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">$49</p>
                      <p className="text-sm text-gray-600">per month</p>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {SUBSCRIPTION_PLANS.PROFESSIONAL.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-700">
                        <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleUpgrade('PROFESSIONAL')}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700"
                  >
                    Upgrade to Professional
                  </button>
                </div>

                {/* Enterprise Plan */}
                <div className="border-2 border-blue-500 rounded-lg p-6 relative hover:shadow-md transition-shadow">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Most Popular
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Enterprise</h3>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">$199</p>
                      <p className="text-sm text-gray-600">per month</p>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6">
                    {SUBSCRIPTION_PLANS.ENTERPRISE.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-700">
                        <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleUpgrade('ENTERPRISE')}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700"
                  >
                    Upgrade to Enterprise
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}