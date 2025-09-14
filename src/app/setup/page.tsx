'use client'

import type { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

import { createClientSupabaseClient } from '@/lib/supabase'

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
      const { data: workspace, error: workspaceError } = await supabase
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

      if (workspaceError || !workspace) {
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

      // Send welcome email (non-blocking)
      fetch('/api/email/send-welcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          workspaceId: workspace.id
        })
      }).catch(error => {
        console.warn('Failed to send welcome email:', error)
      })

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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="size-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">TariffGuard</h1>
          <p className="text-lg text-gray-600">
            Let&apos;s set up your workspace
          </p>
        </div>

        {/* Setup Card */}
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Welcome Message */}
            <div className="border-b border-gray-200 pb-6 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-blue-100">
                <span className="text-2xl">👋</span>
              </div>
              <h2 className="mb-2 text-2xl font-semibold text-gray-900">
                Welcome, {user.user_metadata?.full_name || user.email?.split('@')[0]}!
              </h2>
              <p className="text-gray-600">
                Tell us about your business so we can personalize your experience
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4">
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
                <label htmlFor="companyName" className="mb-2 block text-sm font-medium text-gray-700">
                  Company Name *
                </label>
                <input
                  type="text"
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="e.g., Preston Steel Import Co."
                  className="w-full rounded-md border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Products */}
              <div>
                <label htmlFor="products" className="mb-2 block text-sm font-medium text-gray-700">
                  What do you import/export?
                </label>
                <input
                  type="text"
                  id="products"
                  value={formData.products}
                  onChange={(e) => handleInputChange('products', e.target.value)}
                  placeholder="e.g., Steel fasteners, valves, machinery"
                  className="w-full rounded-md border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This helps us suggest relevant HS codes and monitoring
                </p>
              </div>

              {/* Route From */}
              <div>
                <label htmlFor="routeFrom" className="mb-2 block text-sm font-medium text-gray-700">
                  Shipping from (country/region)
                </label>
                <input
                  type="text"
                  id="routeFrom"
                  value={formData.routeFrom}
                  onChange={(e) => handleInputChange('routeFrom', e.target.value)}
                  placeholder="e.g., China, Taiwan, South Korea"
                  className="w-full rounded-md border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Route To */}
              <div>
                <label htmlFor="routeTo" className="mb-2 block text-sm font-medium text-gray-700">
                  Shipping to (country/region)
                </label>
                <input
                  type="text"
                  id="routeTo"
                  value={formData.routeTo}
                  onChange={(e) => handleInputChange('routeTo', e.target.value)}
                  placeholder="e.g., United States, Europe, Global"
                  className="w-full rounded-md border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={loading || !formData.companyName.trim()}
                className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="mr-2 size-4 animate-spin rounded-full border-b-2 border-white" />
                    Creating workspace...
                  </div>
                ) : (
                  'Create Workspace'
                )}
              </button>
            </div>

            {/* Skip Option */}
            <div className="pt-4 text-center">
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