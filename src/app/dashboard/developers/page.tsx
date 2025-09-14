'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  KeyIcon,
  CodeBracketIcon,
  ChartBarIcon,
  DocumentTextIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

interface ApiToken {
  id: string
  name: string
  prefix: string
  scopes: string[]
  rateLimits: {
    perMinute: number
    perHour: number
    perDay: number
  }
  status: string
  lastUsedAt: string | null
  expiresAt: string | null
  usageCount: number
  createdAt: string
  creator: {
    email: string
    name: string
  }
}

interface ApiScope {
  id: string
  name: string
  description: string
  category: string
}

const availableScopes: ApiScope[] = [
  { id: 'calculations.read', name: 'Read Calculations', description: 'View calculations and results', category: 'calculations' },
  { id: 'calculations.create', name: 'Create Calculations', description: 'Create new import duty calculations', category: 'calculations' },
  { id: 'calculations.update', name: 'Update Calculations', description: 'Modify existing calculations', category: 'calculations' },
  { id: 'rates.read', name: 'Read Tariff Rates', description: 'Access current and historical tariff rates', category: 'rates' },
  { id: 'alerts.read', name: 'Read Alerts', description: 'View tariff rate change alerts', category: 'alerts' },
  { id: 'analytics.read', name: 'Read Analytics', description: 'Access analytics and reporting data', category: 'analytics' }
]

export default function DeveloperPortalPage() {
  const router = useRouter()
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTokenVisible, setNewTokenVisible] = useState<string | null>(null)

  const [createForm, setCreateForm] = useState({
    name: '',
    scopes: ['calculations.read'] as string[],
    expiresInDays: 90,
    rateLimits: {
      perMinute: 60,
      perHour: 1000,
      perDay: 10000
    }
  })

  useEffect(() => {
    fetchTokens()
  }, [])

  const fetchTokens = async () => {
    try {
      const workspaceId = localStorage.getItem('currentWorkspaceId')
      if (!workspaceId) {
        router.push('/dashboard')
        return
      }

      const response = await fetch(`/api/tokens?workspaceId=${workspaceId}`)
      const data = await response.json()

      if (data.success) {
        setTokens(data.tokens)
      }
    } catch (error) {
      console.error('Failed to fetch API tokens:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const workspaceId = localStorage.getItem('currentWorkspaceId')
      const currentUserId = localStorage.getItem('currentUserId')

      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          createdBy: currentUserId,
          ...createForm
        })
      })

      const data = await response.json()

      if (data.success) {
        setNewTokenVisible(data.token.token)
        setShowCreateModal(false)
        setCreateForm({
          name: '',
          scopes: ['calculations.read'],
          expiresInDays: 90,
          rateLimits: { perMinute: 60, perHour: 1000, perDay: 10000 }
        })
        fetchTokens()
        alert('API token created successfully!')
      } else {
        alert('Failed to create token: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to create token:', error)
      alert('Failed to create token')
    }
  }

  const handleToggleTokenStatus = async (tokenId: string, currentStatus: string) => {
    const action = currentStatus === 'active' ? 'revoke' : 'activate'

    if (!confirm(`Are you sure you want to ${action} this token?`)) {
      return
    }

    try {
      const workspaceId = localStorage.getItem('currentWorkspaceId')

      const response = await fetch('/api/tokens', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId,
          workspaceId,
          action
        })
      })

      const data = await response.json()

      if (data.success) {
        fetchTokens()
        alert(`Token ${action}d successfully!`)
      } else {
        alert(`Failed to ${action} token: ` + data.error)
      }
    } catch (error) {
      console.error(`Failed to ${action} token:`, error)
      alert(`Failed to ${action} token`)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  const getScopesByCategory = () => {
    return availableScopes.reduce((acc, scope) => {
      if (!acc[scope.category]) {
        acc[scope.category] = []
      }
      acc[scope.category]!.push(scope)
      return acc
    }, {} as Record<string, ApiScope[]>)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Developer Portal</h1>
              <p className="mt-2 text-gray-600">Manage API tokens and integrate with TariffGuard</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Token
            </button>
          </div>
        </div>

        {/* New Token Display */}
        {newTokenVisible && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-green-900">Token Created Successfully</h3>
              <button
                onClick={() => setNewTokenVisible(null)}
                className="text-green-600 hover:text-green-800"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-white rounded border p-4">
              <p className="text-sm text-gray-600 mb-2">
                Copy this token now - it won't be shown again:
              </p>
              <div className="flex items-center space-x-2">
                <code className="bg-gray-100 px-3 py-2 rounded text-sm font-mono flex-1">
                  {newTokenVisible}
                </code>
                <button
                  onClick={() => copyToClipboard(newTokenVisible)}
                  className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* API Tokens */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6">
                <div className="flex items-center mb-6">
                  <KeyIcon className="h-6 w-6 text-blue-600 mr-3" />
                  <h2 className="text-xl font-semibold text-gray-900">API Tokens</h2>
                </div>

                <div className="space-y-4">
                  {tokens.map((token) => (
                    <div key={token.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">{token.name}</h3>
                          <p className="text-sm text-gray-500">{token.prefix}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              token.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {token.status}
                          </span>
                          <button
                            onClick={() => handleToggleTokenStatus(token.id, token.status)}
                            className={`text-sm px-2 py-1 rounded ${
                              token.status === 'active'
                                ? 'text-red-600 hover:text-red-800'
                                : 'text-green-600 hover:text-green-800'
                            }`}
                          >
                            {token.status === 'active' ? 'Revoke' : 'Activate'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                        <div>
                          <span className="font-medium">Usage:</span> {token.usageCount} requests
                        </div>
                        <div>
                          <span className="font-medium">Last used:</span>{' '}
                          {token.lastUsedAt
                            ? new Date(token.lastUsedAt).toLocaleDateString()
                            : 'Never'}
                        </div>
                        <div>
                          <span className="font-medium">Created:</span>{' '}
                          {new Date(token.createdAt).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="font-medium">Expires:</span>{' '}
                          {token.expiresAt
                            ? new Date(token.expiresAt).toLocaleDateString()
                            : 'Never'}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {token.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                  {tokens.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <KeyIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No API tokens created yet</p>
                      <p className="text-sm">Create your first token to get started</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Documentation & Quick Actions */}
          <div className="space-y-6">
            {/* Quick Start */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <DocumentTextIcon className="h-6 w-6 text-green-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">Quick Start</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-700">1. Create an API token</p>
                  <p className="text-gray-600">Generate a token with the required scopes</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">2. Make API requests</p>
                  <p className="text-gray-600">Include token in Authorization header</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">3. Monitor usage</p>
                  <p className="text-gray-600">Track requests and rate limits</p>
                </div>
              </div>
            </div>

            {/* Example Request */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <CodeBracketIcon className="h-6 w-6 text-purple-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">Example Request</h3>
              </div>
              <div className="bg-gray-100 rounded p-3 text-xs font-mono">
                <div className="text-gray-600 mb-2"># Get tariff rate for HS code</div>
                <div>curl -X GET \</div>
                <div className="ml-2">"https://tariffguard.vercel.app/api/v1/rates?hsCode=8471.30.01" \</div>
                <div className="ml-2">-H "Authorization: Bearer YOUR_TOKEN"</div>
              </div>
              <button
                onClick={() => copyToClipboard(`curl -X GET "https://tariffguard.vercel.app/api/v1/rates?hsCode=8471.30.01" -H "Authorization: Bearer YOUR_TOKEN"`)}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800"
              >
                Copy example
              </button>
            </div>

            {/* Rate Limits */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <ChartBarIcon className="h-6 w-6 text-orange-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">Default Rate Limits</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Per minute:</span>
                  <span className="font-medium">60 requests</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Per hour:</span>
                  <span className="font-medium">1,000 requests</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Per day:</span>
                  <span className="font-medium">10,000 requests</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create Token Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Create API Token</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleCreateToken} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Token Name
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Production API Token"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Permissions (Scopes)
                  </label>
                  <div className="space-y-4">
                    {Object.entries(getScopesByCategory()).map(([category, scopes]) => (
                      <div key={category} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2 capitalize">{category}</h4>
                        <div className="space-y-2">
                          {scopes.map((scope) => (
                            <label key={scope.id} className="flex items-start">
                              <input
                                type="checkbox"
                                checked={createForm.scopes.includes(scope.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setCreateForm({
                                      ...createForm,
                                      scopes: [...createForm.scopes, scope.id]
                                    })
                                  } else {
                                    setCreateForm({
                                      ...createForm,
                                      scopes: createForm.scopes.filter(s => s !== scope.id)
                                    })
                                  }
                                }}
                                className="mt-1 mr-3"
                              />
                              <div>
                                <div className="text-sm font-medium text-gray-900">{scope.name}</div>
                                <div className="text-xs text-gray-500">{scope.description}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expires In (Days)
                  </label>
                  <select
                    value={createForm.expiresInDays}
                    onChange={(e) => setCreateForm({ ...createForm, expiresInDays: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                    <option value={180}>6 months</option>
                    <option value={365}>1 year</option>
                    <option value={0}>Never expires</option>
                  </select>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700"
                  >
                    Create Token
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}