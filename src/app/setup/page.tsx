'use client'

import { useState, useEffect } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

interface SetupFormData {
  companyName: string
  products: string
  routeFrom: string
  routeTo: string
}

export default function SetupPage() {
  const [user, setUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<SetupFormData>({
    companyName: '',
    products: '',
    routeFrom: '',
    routeTo: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientSupabaseClient()

  // Check authentication and existing workspace
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      setUser(session.user)

      // Check if workspace already exists
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('user_id', session.user.id)
        .single()

      if (workspace) {
        router.push('/dashboard')
      }
    }

    checkUser()
  }, [router, supabase])

  const handleInputChange = (field: keyof SetupFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !formData.companyName.trim()) {
      setError('Company name is required')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Create workspace
      const { error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          user_id: user.id,
          company_name: formData.companyName.trim(),
          products: formData.products.trim() || null,
          route_from: formData.routeFrom.trim() || null,
          route_to: formData.routeTo.trim() || null
        })
        .select()
        .single()

      if (workspaceError) {
        throw workspaceError
      }

      // Create default user preferences
      const { error: prefsError } = await supabase
        .from('user_preferences')
        .insert({
          user_id: user.id,
          email_alerts: true,
          push_notifications: true,
          alert_threshold: 1.0
        })

      if (prefsError) {
        console.warn('Failed to create user preferences:', prefsError)
      }

      // Redirect to dashboard
      router.push('/dashboard')

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create workspace')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">TariffGuard</h1>
          <p className="text-lg text-gray-600">
            Let&apos;s set up your workspace
          </p>
        </div>

        {/* Setup Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Welcome Message */}
            <div className="text-center pb-6 border-b border-gray-200">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">👋</span>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Welcome, {user.user_metadata?.full_name || user.email?.split('@')[0]}!
              </h2>
              <p className="text-gray-600">
                Tell us about your business so we can personalize your experience
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Setup Error
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      {error}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-6">
              {/* Company Name */}
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="e.g., Preston Steel Import Co."
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {/* Products */}
              <div>
                <label htmlFor="products" className="block text-sm font-medium text-gray-700 mb-2">
                  What do you import/export?
                </label>
                <input
                  type="text"
                  id="products"
                  value={formData.products}
                  onChange={(e) => handleInputChange('products', e.target.value)}
                  placeholder="e.g., Steel fasteners, valves, machinery"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This helps us suggest relevant HS codes and monitoring
                </p>
              </div>

              {/* Route From */}
              <div>
                <label htmlFor="routeFrom" className="block text-sm font-medium text-gray-700 mb-2">
                  Shipping from (country/region)
                </label>
                <input
                  type="text"
                  id="routeFrom"
                  value={formData.routeFrom}
                  onChange={(e) => handleInputChange('routeFrom', e.target.value)}
                  placeholder="e.g., China, Taiwan, South Korea"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Route To */}
              <div>
                <label htmlFor="routeTo" className="block text-sm font-medium text-gray-700 mb-2">
                  Shipping to (country/region)
                </label>
                <input
                  type="text"
                  id="routeTo"
                  value={formData.routeTo}
                  onChange={(e) => handleInputChange('routeTo', e.target.value)}
                  placeholder="e.g., United States, Europe, Global"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={loading || !formData.companyName.trim()}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating workspace...
                  </div>
                ) : (
                  'Create Workspace'
                )}
              </button>
            </div>

            {/* Skip Option */}
            <div className="text-center pt-4">
              <button
                type="button"
                onClick={() => handleInputChange('companyName', user.user_metadata?.full_name || 'My Company')}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Skip setup for now
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}