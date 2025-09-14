'use client'

import { 
  BellIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ChevronLeftIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

import { createClientSupabaseClient, type Workspace, type UserPreferences } from '@/lib/supabase'
import { useNotifications } from '@/hooks/useNotifications'
import { ToastContainer } from '@/components/ToastNotification'

export default function AlertsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const router = useRouter()
  const supabase = createClientSupabaseClient()
  
  // Initialize notification system
  const {
    alerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
    showToast,
    toasts,
    dismissToast
  } = useNotifications(workspace)

  // Authentication and data loading
  useEffect(() => {
    const loadAlertsPage = async () => {
      try {
        // Check authentication
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push('/login')
          return
        }

        setUser(session.user)

        // Get workspace
        const { data: workspaceData, error: workspaceError } = await supabase
          .from('workspaces')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (workspaceError || !workspaceData) {
          router.push('/setup')
          return
        }

        setWorkspace(workspaceData)

        // Get user preferences
        const { data: prefsData } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (prefsData) {
          setPreferences(prefsData)
        } else {
          // Create default preferences if they don't exist
          const defaultPrefs: Omit<UserPreferences, 'created_at' | 'updated_at'> = {
            user_id: session.user.id,
            email_alerts: true,
            push_notifications: true,
            alert_threshold: 1.0
          }
          
          const { data: newPrefs, error } = await supabase
            .from('user_preferences')
            .insert(defaultPrefs)
            .select()
            .single()

          if (!error && newPrefs) {
            setPreferences(newPrefs)
          }
        }

      } catch (error) {
        console.error('Alerts page load error:', error)
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    loadAlertsPage()
  }, [router, supabase])

  const handlePreferenceChange = async (
    field: keyof Omit<UserPreferences, 'user_id' | 'created_at' | 'updated_at'>,
    value: boolean | number
  ) => {
    if (!preferences || !user) return

    try {
      setSaving(true)

      const { error } = await supabase
        .from('user_preferences')
        .update({ [field]: value })
        .eq('user_id', user.id)

      if (error) throw error

      setPreferences(prev => prev ? { ...prev, [field]: value } : null)
      showToast('Preferences updated successfully', 'success')

    } catch (error) {
      console.error('Failed to update preferences:', error)
      showToast('Failed to update preferences', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="size-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <header className='border-b bg-white shadow-sm'>
        <div className='mx-auto max-w-7xl p-4'>
          <div className='flex items-center'>
            <Link
              href="/dashboard"
              className="mr-4 flex items-center text-gray-600 hover:text-gray-900"
            >
              <ChevronLeftIcon className="size-5 mr-1" />
              Back to Dashboard
            </Link>
            <div>
              <h1 className='text-2xl font-bold text-gray-900'>Alert Settings</h1>
              <p className='text-gray-600'>Manage your notification preferences and alert history</p>
            </div>
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-4xl px-4 py-8'>
        {/* Alert Statistics */}
        <div className='mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3'>
          <div className='rounded-lg border bg-white p-6 shadow-sm'>
            <div className='flex items-center'>
              <div className='shrink-0'>
                <BellIcon className='size-8 text-blue-600' />
              </div>
              <div className='ml-4'>
                <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
                  Total Alerts
                </h3>
                <p className='mt-1 text-2xl font-bold text-gray-900'>{alerts.length}</p>
              </div>
            </div>
          </div>

          <div className='rounded-lg border bg-white p-6 shadow-sm'>
            <div className='flex items-center'>
              <div className='shrink-0'>
                <ExclamationTriangleIcon className={`size-8 ${unreadCount > 0 ? 'text-yellow-600' : 'text-gray-400'}`} />
              </div>
              <div className='ml-4'>
                <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
                  Unread Alerts
                </h3>
                <p className={`mt-1 text-2xl font-bold ${unreadCount > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                  {unreadCount}
                </p>
              </div>
            </div>
          </div>

          <div className='rounded-lg border bg-white p-6 shadow-sm'>
            <div className='flex items-center'>
              <div className='shrink-0'>
                <CheckCircleIcon className='size-8 text-green-600' />
              </div>
              <div className='ml-4'>
                <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
                  Monitoring Status
                </h3>
                <p className='mt-1 text-lg font-bold text-green-600'>Active</p>
              </div>
            </div>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-8 lg:grid-cols-2'>
          {/* Notification Preferences */}
          <div className='rounded-lg border bg-white p-6 shadow-sm'>
            <div className='mb-6 flex items-center'>
              <Cog6ToothIcon className='mr-3 size-6 text-gray-700' />
              <h2 className='text-lg font-semibold text-gray-900'>Notification Preferences</h2>
            </div>
            
            <div className='space-y-6'>
              {/* Email Alerts */}
              <div className='flex items-start justify-between'>
                <div>
                  <h3 className='text-sm font-medium text-gray-900'>Email Alerts</h3>
                  <p className='text-sm text-gray-600'>
                    Receive email notifications when tariff rates change
                  </p>
                </div>
                <button
                  onClick={() => handlePreferenceChange('email_alerts', !preferences?.email_alerts)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    preferences?.email_alerts ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                      preferences?.email_alerts ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Push Notifications */}
              <div className='flex items-start justify-between'>
                <div>
                  <h3 className='text-sm font-medium text-gray-900'>In-App Notifications</h3>
                  <p className='text-sm text-gray-600'>
                    Show toast notifications in the app when alerts are received
                  </p>
                </div>
                <button
                  onClick={() => handlePreferenceChange('push_notifications', !preferences?.push_notifications)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    preferences?.push_notifications ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                      preferences?.push_notifications ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Alert Threshold */}
              <div>
                <label htmlFor="threshold" className='block text-sm font-medium text-gray-900 mb-2'>
                  Alert Threshold
                </label>
                <p className='text-sm text-gray-600 mb-3'>
                  Only alert for rate changes greater than this percentage
                </p>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    id="threshold"
                    min="0"
                    max="10"
                    step="0.5"
                    value={preferences?.alert_threshold || 1.0}
                    onChange={(e) => handlePreferenceChange('alert_threshold', parseFloat(e.target.value))}
                    disabled={saving}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-900 min-w-[3rem]">
                    {preferences?.alert_threshold || 1.0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className='mt-6 pt-6 border-t border-gray-200'>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className='inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                >
                  <CheckCircleIcon className='mr-2 size-4' />
                  Mark All Alerts as Read
                </button>
              )}
            </div>
          </div>

          {/* Recent Alerts */}
          <div className='rounded-lg border bg-white p-6 shadow-sm'>
            <div className='mb-6 flex items-center justify-between'>
              <h2 className='text-lg font-semibold text-gray-900'>Recent Alerts</h2>
              <span className='text-sm text-gray-500'>{alerts.length} total</span>
            </div>
            
            {alerts.length > 0 ? (
              <div className='space-y-3 max-h-96 overflow-y-auto'>
                {alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`flex items-start rounded-lg border p-3 cursor-pointer transition-colors ${
                      alert.is_read 
                        ? 'border-gray-200 bg-gray-50 hover:bg-gray-100' 
                        : 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100'
                    }`}
                    onClick={() => !alert.is_read && markAsRead(alert.id)}
                  >
                    <div className={`mr-3 mt-0.5 size-3 shrink-0 rounded-full ${
                      alert.is_read ? 'bg-gray-400' : 'bg-yellow-400'
                    }`} />
                    <div className='flex-1 min-w-0'>
                      <p className='font-medium text-gray-900 truncate'>
                        Rate change: {alert.old_rate}% → {alert.new_rate}%
                      </p>
                      <p className='text-sm text-gray-600'>HS {alert.hs_code}</p>
                      {alert.message && (
                        <p className='text-sm text-gray-500 mt-1'>{alert.message}</p>
                      )}
                      <p className='mt-1 text-xs text-gray-400'>
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='py-8 text-center'>
                <BellIcon className='mx-auto mb-4 size-12 text-gray-300' />
                <p className='mb-2 text-gray-500'>No alerts yet</p>
                <p className='text-sm text-gray-400'>
                  Real-time monitoring is active. You'll be notified when tariff rates change.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Information Panel */}
        <div className='mt-8 rounded-lg border bg-blue-50 p-6'>
          <div className='flex items-start'>
            <InformationCircleIcon className='mr-3 size-6 text-blue-600 shrink-0' />
            <div>
              <h3 className='text-sm font-medium text-blue-900'>How Alert Monitoring Works</h3>
              <div className='mt-2 text-sm text-blue-800'>
                <ul className='list-disc list-inside space-y-1'>
                  <li>TariffGuard monitors tariff rates in real-time using government data sources</li>
                  <li>Alerts are triggered when rates change by more than your threshold setting</li>
                  <li>Email notifications are sent immediately when enabled in preferences</li>
                  <li>In-app notifications appear as toast messages when you're active</li>
                  <li>All alerts are stored in your account history for future reference</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Toast Notifications */}
      <ToastContainer 
        toasts={toasts} 
        onDismiss={dismissToast}
        position="top-right"
      />
    </div>
  )
}