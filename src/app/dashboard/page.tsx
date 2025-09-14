'use client'

import { 
  CalculatorIcon, 
  BellIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  UsersIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

import { createClientSupabaseClient, type Workspace, type Alert, type Calculation } from '@/lib/supabase'
import { useNotifications } from '@/hooks/useNotifications'
import { ToastContainer } from '@/components/ToastNotification'

interface DashboardStats {
  totalCalculations: number
  totalValue: number
  unreadAlerts: number
  savedDuties: number
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    totalCalculations: 0,
    totalValue: 0,
    unreadAlerts: 0,
    savedDuties: 0
  })
  const [recentCalculations, setRecentCalculations] = useState<Calculation[]>([])
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const supabase = createClientSupabaseClient()
  
  // Initialize notification system
  const {
    alerts: liveAlerts,
    unreadCount: liveUnreadCount,
    markAsRead,
    markAllAsRead,
    toasts,
    dismissToast
  } = useNotifications(workspace)

  // Authentication and data loading
  useEffect(() => {
    const loadDashboard = async () => {
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

        // Load dashboard data
        await Promise.all([
          loadStats(workspaceData.id),
          loadRecentCalculations(workspaceData.id),
          loadRecentAlerts(workspaceData.id)
        ])

      } catch (error) {
        console.error('Dashboard load error:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [router, supabase])

  // Update stats when live notifications change
  useEffect(() => {
    if (liveUnreadCount !== undefined) {
      setStats(prevStats => ({
        ...prevStats,
        unreadAlerts: liveUnreadCount
      }))
    }
  }, [liveUnreadCount])

  // Replace recent alerts with live alerts when available
  useEffect(() => {
    if (liveAlerts.length > 0) {
      setRecentAlerts(liveAlerts.slice(0, 5))
    }
  }, [liveAlerts])

  const loadStats = async (workspaceId: string) => {
    try {
      // Get calculations stats
      const { data: calculations } = await supabase
        .from('calculations')
        .select('total_value, total_duty')
        .eq('workspace_id', workspaceId)

      // Get unread alerts count
      const { data: alerts } = await supabase
        .from('alerts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('is_read', false)

      const totalCalculations = calculations?.length || 0
      const totalValue = calculations?.reduce((sum, calc) => sum + calc.total_value, 0) || 0
      const savedDuties = calculations?.reduce((sum, calc) => sum + calc.total_duty, 0) || 0
      const unreadAlerts = alerts?.length || 0

      setStats({
        totalCalculations,
        totalValue,
        unreadAlerts,
        savedDuties
      })
    } catch (error) {
      console.error('Stats load error:', error)
    }
  }

  const loadRecentCalculations = async (workspaceId: string) => {
    try {
      const { data, error } = await supabase
        .from('calculations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {throw error}
      setRecentCalculations(data || [])
    } catch (error) {
      console.error('Recent calculations load error:', error)
    }
  }

  const loadRecentAlerts = async (workspaceId: string) => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {throw error}
      setRecentAlerts(data || [])
    } catch (error) {
      console.error('Recent alerts load error:', error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
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
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-bold text-gray-900'>
                {workspace?.company_name} Dashboard
              </h1>
              <p className='text-gray-600'>Monitor tariffs and calculate duties</p>
            </div>

            {/* User Menu */}
            <div className='flex items-center space-x-4'>
              <div className='flex items-center text-sm text-gray-700'>
                <UserCircleIcon className='mr-1 size-5' />
                {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              </div>
              
              <button
                onClick={handleSignOut}
                className='inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50'
              >
                <ArrowRightOnRectangleIcon className='mr-1 size-4' />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-4 py-8'>
        {/* Quick Actions */}
        <div className='mb-8'>
          <h2 className='mb-4 text-lg font-semibold text-gray-900'>Quick Actions</h2>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6'>
            <Link
              href="/dashboard/calculator"
              className='group relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-blue-300 hover:shadow-md'
            >
              <div className='flex items-center'>
                <div className='shrink-0'>
                  <CalculatorIcon className='size-6 text-blue-600' />
                </div>
                <div className='ml-4'>
                  <h3 className='text-sm font-medium text-gray-900'>
                    Calculate Duties
                  </h3>
                  <p className='text-sm text-gray-500'>
                    Import duty calculator
                  </p>
                </div>
                <ArrowRightIcon className='ml-auto size-4 text-gray-400 group-hover:text-blue-600' />
              </div>
            </Link>

            <Link
              href="/dashboard/alerts"
              className='group relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-green-300 hover:shadow-md'
            >
              <div className='flex items-center'>
                <div className='shrink-0'>
                  <BellIcon className='size-6 text-green-600' />
                </div>
                <div className='ml-4'>
                  <h3 className='text-sm font-medium text-gray-900'>
                    Alert Settings
                  </h3>
                  <p className='text-sm text-gray-500'>
                    Live monitoring active
                  </p>
                </div>
                <ArrowRightIcon className='ml-auto size-4 text-gray-400 group-hover:text-green-600' />
              </div>
            </Link>

            <Link
              href="/dashboard/analytics"
              className='group relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-purple-300 hover:shadow-md'
            >
              <div className='flex items-center'>
                <div className='shrink-0'>
                  <ChartBarIcon className='size-6 text-purple-600' />
                </div>
                <div className='ml-4'>
                  <h3 className='text-sm font-medium text-gray-900'>
                    Analytics
                  </h3>
                  <p className='text-sm text-gray-500'>
                    Import insights & trends
                  </p>
                </div>
                <ArrowRightIcon className='ml-auto size-4 text-gray-400 group-hover:text-purple-600' />
              </div>
            </Link>

            <Link
              href="/dashboard/billing"
              className='group relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-orange-300 hover:shadow-md'
            >
              <div className='flex items-center'>
                <div className='shrink-0'>
                  <DocumentTextIcon className='size-6 text-orange-600' />
                </div>
                <div className='ml-4'>
                  <h3 className='text-sm font-medium text-gray-900'>
                    Billing & Usage
                  </h3>
                  <p className='text-sm text-gray-500'>
                    Manage subscription
                  </p>
                </div>
                <ArrowRightIcon className='ml-auto size-4 text-gray-400 group-hover:text-orange-600' />
              </div>
            </Link>

            <Link
              href="/dashboard/team"
              className='group relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md'
            >
              <div className='flex items-center'>
                <div className='shrink-0'>
                  <UsersIcon className='size-6 text-indigo-600' />
                </div>
                <div className='ml-4'>
                  <h3 className='text-sm font-medium text-gray-900'>
                    Team
                  </h3>
                  <p className='text-sm text-gray-500'>
                    Manage members
                  </p>
                </div>
                <ArrowRightIcon className='ml-auto size-4 text-gray-400 group-hover:text-indigo-600' />
              </div>
            </Link>

            <Link
              href="/dashboard/developers"
              className='group relative rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-cyan-300 hover:shadow-md'
            >
              <div className='flex items-center'>
                <div className='shrink-0'>
                  <CodeBracketIcon className='size-6 text-cyan-600' />
                </div>
                <div className='ml-4'>
                  <h3 className='text-sm font-medium text-gray-900'>
                    Developer Portal
                  </h3>
                  <p className='text-sm text-gray-500'>
                    API tokens & docs
                  </p>
                </div>
                <ArrowRightIcon className='ml-auto size-4 text-gray-400 group-hover:text-cyan-600' />
              </div>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className='mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4'>
          <div className='rounded-lg border bg-white p-6 shadow-sm'>
            <div className='flex items-center'>
              <div className='shrink-0'>
                <CalculatorIcon className='size-8 text-blue-600' />
              </div>
              <div className='ml-4'>
                <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
                  Total Calculations
                </h3>
                <p className='mt-1 text-2xl font-bold text-gray-900'>{stats.totalCalculations}</p>
              </div>
            </div>
          </div>

          <div className='rounded-lg border bg-white p-6 shadow-sm'>
            <div className='flex items-center'>
              <div className='shrink-0'>
                <ChartBarIcon className='size-8 text-green-600' />
              </div>
              <div className='ml-4'>
                <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
                  Import Value
                </h3>
                <p className='mt-1 text-2xl font-bold text-gray-900'>
                  ${stats.totalValue.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className='rounded-lg border bg-white p-6 shadow-sm'>
            <div className='flex items-center'>
              <div className='shrink-0'>
                <BellIcon className={`size-8 ${stats.unreadAlerts > 0 ? 'text-yellow-600' : 'text-gray-400'}`} />
              </div>
              <div className='ml-4'>
                <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
                  Unread Alerts
                </h3>
                <p className={`mt-1 text-2xl font-bold ${stats.unreadAlerts > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                  {stats.unreadAlerts}
                </p>
              </div>
            </div>
          </div>

          <div className='rounded-lg border bg-white p-6 shadow-sm'>
            <div className='flex items-center'>
              <div className='shrink-0'>
                <DocumentTextIcon className='size-8 text-indigo-600' />
              </div>
              <div className='ml-4'>
                <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
                  Total Duties
                </h3>
                <p className='mt-1 text-2xl font-bold text-gray-900'>
                  ${stats.savedDuties.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className='grid grid-cols-1 gap-8 lg:grid-cols-2'>
          {/* Recent Calculations */}
          <div className='rounded-lg border bg-white p-6 shadow-sm'>
            <div className='mb-6 flex items-center justify-between'>
              <h2 className='text-lg font-semibold text-gray-900'>
                Recent Calculations
              </h2>
              <Link 
                href="/dashboard/calculator"
                className='text-sm font-medium text-blue-600 hover:text-blue-800'
              >
                View all →
              </Link>
            </div>
            
            {recentCalculations.length > 0 ? (
              <div className='space-y-4'>
                {recentCalculations.map((calc) => (
                  <div key={calc.id} className='flex items-center justify-between rounded-lg bg-gray-50 p-3'>
                    <div>
                      <p className='font-medium text-gray-900'>{calc.name}</p>
                      <p className='text-sm text-gray-600'>
                        {new Date(calc.created_at).toLocaleDateString()} • {calc.line_items.length} items
                      </p>
                    </div>
                    <div className='text-right'>
                      <p className='font-medium text-gray-900'>${calc.total_duty.toLocaleString()}</p>
                      <p className='text-sm text-gray-500'>duty</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='py-8 text-center'>
                <CalculatorIcon className='mx-auto mb-4 size-12 text-gray-300' />
                <p className='mb-4 text-gray-500'>No calculations yet</p>
                <Link
                  href="/dashboard/calculator"
                  className='inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700'
                >
                  <CalculatorIcon className='mr-2 size-4' />
                  Create First Calculation
                </Link>
              </div>
            )}
          </div>

          {/* Recent Alerts */}
          <div className='rounded-lg border bg-white p-6 shadow-sm'>
            <div className='mb-6 flex items-center justify-between'>
              <h2 className='text-lg font-semibold text-gray-900'>Recent Alerts</h2>
              <div className="flex items-center space-x-3">
                {liveUnreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    Mark all as read
                  </button>
                )}
                <span className='text-sm text-gray-500'>Live monitoring active</span>
              </div>
            </div>
            
            {recentAlerts.length > 0 ? (
              <div className='space-y-3'>
                {recentAlerts.map((alert) => (
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
                    <div className='flex-1'>
                      <p className='font-medium text-gray-900'>
                        Rate change: {alert.old_rate}% → {alert.new_rate}%
                      </p>
                      <p className='text-sm text-gray-600'>HS {alert.hs_code}</p>
                      <p className='mt-1 text-xs text-gray-500'>
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='py-8 text-center'>
                <BellIcon className='mx-auto mb-4 size-12 text-gray-300' />
                <p className='mb-2 text-gray-500'>No tariff alerts yet</p>
                <p className='text-sm text-gray-400'>
                  Real-time monitoring is active. You'll be notified when tariff rates change for your HS codes.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Workspace Info */}
        <div className='mt-8 rounded-lg border bg-white p-6 shadow-sm'>
          <h2 className='mb-4 text-lg font-semibold text-gray-900'>Workspace Information</h2>
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <div>
              <h3 className='mb-2 text-sm font-medium text-gray-700'>Company Details</h3>
              <div className='space-y-2'>
                <div className='flex justify-between'>
                  <span className='text-sm text-gray-600'>Company:</span>
                  <span className='text-sm font-medium text-gray-900'>{workspace?.company_name}</span>
                </div>
                {workspace?.products && (
                  <div className='flex justify-between'>
                    <span className='text-sm text-gray-600'>Products:</span>
                    <span className='text-sm font-medium text-gray-900'>{workspace.products}</span>
                  </div>
                )}
                {workspace?.route_from && (
                  <div className='flex justify-between'>
                    <span className='text-sm text-gray-600'>Shipping From:</span>
                    <span className='text-sm font-medium text-gray-900'>{workspace.route_from}</span>
                  </div>
                )}
                {workspace?.route_to && (
                  <div className='flex justify-between'>
                    <span className='text-sm text-gray-600'>Shipping To:</span>
                    <span className='text-sm font-medium text-gray-900'>{workspace.route_to}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className='mb-2 text-sm font-medium text-gray-700'>Account Status</h3>
              <div className='space-y-2'>
                <div className='flex items-center'>
                  <CheckCircleIcon className='mr-2 size-4 text-green-500' />
                  <span className='text-sm text-gray-600'>Free Plan Active</span>
                </div>
                <div className='flex items-center'>
                  <CheckCircleIcon className='mr-2 size-4 text-green-500' />
                  <span className='text-sm text-gray-600'>Unlimited Manual Calculations</span>
                </div>
                <div className='mt-4'>
                  <p className='text-xs text-gray-500'>
                    Workspace created: {new Date(workspace?.created_at || '').toLocaleDateString()}
                  </p>
                </div>
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