'use client'

import { useState, useEffect } from 'react'
import { createClientSupabaseClient, type Workspace, type Alert, type Calculation } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { 
  CalculatorIcon, 
  BellIcon, 
  ChartBarIcon, 
  DocumentTextIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'

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

      if (error) throw error
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

      if (error) throw error
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <header className='border-b bg-white shadow-sm'>
        <div className='mx-auto max-w-7xl px-4 py-4'>
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
                <UserCircleIcon className='w-5 h-5 mr-1' />
                {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
              </div>
              
              <button
                onClick={handleSignOut}
                className='inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50'
              >
                <ArrowRightOnRectangleIcon className='w-4 h-4 mr-1' />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-4 py-8'>
        {/* Quick Actions */}
        <div className='mb-8'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>Quick Actions</h2>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <Link
              href="/dashboard/calculator"
              className='relative group bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all'
            >
              <div className='flex items-center'>
                <div className='flex-shrink-0'>
                  <CalculatorIcon className='h-6 w-6 text-blue-600' />
                </div>
                <div className='ml-4'>
                  <h3 className='text-sm font-medium text-gray-900'>
                    Calculate Duties
                  </h3>
                  <p className='text-sm text-gray-500'>
                    Import duty calculator
                  </p>
                </div>
                <ArrowRightIcon className='ml-auto h-4 w-4 text-gray-400 group-hover:text-blue-600' />
              </div>
            </Link>

            <div className='relative bg-white p-6 rounded-lg shadow-sm border border-gray-200 opacity-75'>
              <div className='flex items-center'>
                <div className='flex-shrink-0'>
                  <BellIcon className='h-6 w-6 text-gray-400' />
                </div>
                <div className='ml-4'>
                  <h3 className='text-sm font-medium text-gray-500'>
                    Set Up Alerts
                  </h3>
                  <p className='text-sm text-gray-400'>
                    Coming soon
                  </p>
                </div>
              </div>
            </div>

            <div className='relative bg-white p-6 rounded-lg shadow-sm border border-gray-200 opacity-75'>
              <div className='flex items-center'>
                <div className='flex-shrink-0'>
                  <ChartBarIcon className='h-6 w-6 text-gray-400' />
                </div>
                <div className='ml-4'>
                  <h3 className='text-sm font-medium text-gray-500'>
                    Analytics
                  </h3>
                  <p className='text-sm text-gray-400'>
                    Coming soon
                  </p>
                </div>
              </div>
            </div>

            <div className='relative bg-white p-6 rounded-lg shadow-sm border border-gray-200 opacity-75'>
              <div className='flex items-center'>
                <div className='flex-shrink-0'>
                  <DocumentTextIcon className='h-6 w-6 text-gray-400' />
                </div>
                <div className='ml-4'>
                  <h3 className='text-sm font-medium text-gray-500'>
                    Reports
                  </h3>
                  <p className='text-sm text-gray-400'>
                    Coming soon
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className='mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4'>
          <div className='rounded-lg bg-white p-6 shadow-sm border'>
            <div className='flex items-center'>
              <div className='flex-shrink-0'>
                <CalculatorIcon className='h-8 w-8 text-blue-600' />
              </div>
              <div className='ml-4'>
                <h3 className='text-sm font-medium text-gray-500 uppercase tracking-wide'>
                  Total Calculations
                </h3>
                <p className='mt-1 text-2xl font-bold text-gray-900'>{stats.totalCalculations}</p>
              </div>
            </div>
          </div>

          <div className='rounded-lg bg-white p-6 shadow-sm border'>
            <div className='flex items-center'>
              <div className='flex-shrink-0'>
                <ChartBarIcon className='h-8 w-8 text-green-600' />
              </div>
              <div className='ml-4'>
                <h3 className='text-sm font-medium text-gray-500 uppercase tracking-wide'>
                  Import Value
                </h3>
                <p className='mt-1 text-2xl font-bold text-gray-900'>
                  ${stats.totalValue.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className='rounded-lg bg-white p-6 shadow-sm border'>
            <div className='flex items-center'>
              <div className='flex-shrink-0'>
                <BellIcon className={`h-8 w-8 ${stats.unreadAlerts > 0 ? 'text-yellow-600' : 'text-gray-400'}`} />
              </div>
              <div className='ml-4'>
                <h3 className='text-sm font-medium text-gray-500 uppercase tracking-wide'>
                  Unread Alerts
                </h3>
                <p className={`mt-1 text-2xl font-bold ${stats.unreadAlerts > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                  {stats.unreadAlerts}
                </p>
              </div>
            </div>
          </div>

          <div className='rounded-lg bg-white p-6 shadow-sm border'>
            <div className='flex items-center'>
              <div className='flex-shrink-0'>
                <DocumentTextIcon className='h-8 w-8 text-indigo-600' />
              </div>
              <div className='ml-4'>
                <h3 className='text-sm font-medium text-gray-500 uppercase tracking-wide'>
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
          <div className='rounded-lg bg-white p-6 shadow-sm border'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-lg font-semibold text-gray-900'>
                Recent Calculations
              </h2>
              <Link 
                href="/dashboard/calculator"
                className='text-sm text-blue-600 hover:text-blue-800 font-medium'
              >
                View all →
              </Link>
            </div>
            
            {recentCalculations.length > 0 ? (
              <div className='space-y-4'>
                {recentCalculations.map((calc) => (
                  <div key={calc.id} className='flex items-center justify-between p-3 bg-gray-50 rounded-lg'>
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
              <div className='text-center py-8'>
                <CalculatorIcon className='w-12 h-12 text-gray-300 mx-auto mb-4' />
                <p className='text-gray-500 mb-4'>No calculations yet</p>
                <Link
                  href="/dashboard/calculator"
                  className='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700'
                >
                  <CalculatorIcon className='w-4 h-4 mr-2' />
                  Create First Calculation
                </Link>
              </div>
            )}
          </div>

          {/* Recent Alerts */}
          <div className='rounded-lg bg-white p-6 shadow-sm border'>
            <div className='flex items-center justify-between mb-6'>
              <h2 className='text-lg font-semibold text-gray-900'>Recent Alerts</h2>
              <span className='text-sm text-gray-500'>Auto-monitoring coming soon</span>
            </div>
            
            {recentAlerts.length > 0 ? (
              <div className='space-y-3'>
                {recentAlerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`flex items-start p-3 rounded-lg border ${
                      alert.is_read 
                        ? 'bg-gray-50 border-gray-200' 
                        : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className={`mr-3 mt-0.5 w-3 h-3 rounded-full flex-shrink-0 ${
                      alert.is_read ? 'bg-gray-400' : 'bg-yellow-400'
                    }`} />
                    <div className='flex-1'>
                      <p className='font-medium text-gray-900'>
                        Rate change: {alert.old_rate}% → {alert.new_rate}%
                      </p>
                      <p className='text-sm text-gray-600'>HS {alert.hs_code}</p>
                      <p className='text-xs text-gray-500 mt-1'>
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-8'>
                <BellIcon className='w-12 h-12 text-gray-300 mx-auto mb-4' />
                <p className='text-gray-500 mb-2'>No alerts yet</p>
                <p className='text-sm text-gray-400'>
                  Automatic monitoring and alerts coming in Phase 2
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Workspace Info */}
        <div className='mt-8 bg-white rounded-lg shadow-sm border p-6'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>Workspace Information</h2>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div>
              <h3 className='text-sm font-medium text-gray-700 mb-2'>Company Details</h3>
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
              <h3 className='text-sm font-medium text-gray-700 mb-2'>Account Status</h3>
              <div className='space-y-2'>
                <div className='flex items-center'>
                  <CheckCircleIcon className='w-4 h-4 text-green-500 mr-2' />
                  <span className='text-sm text-gray-600'>Free Plan Active</span>
                </div>
                <div className='flex items-center'>
                  <CheckCircleIcon className='w-4 h-4 text-green-500 mr-2' />
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
    </div>
  )
}