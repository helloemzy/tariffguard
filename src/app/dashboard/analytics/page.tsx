'use client'

import { 
  ChartBarIcon, 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon,
  ChevronLeftIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { format, subMonths, endOfMonth, eachMonthOfInterval } from 'date-fns'

import { createClientSupabaseClient, type Workspace, type Calculation, type Alert } from '@/lib/supabase'

interface AnalyticsData {
  monthlyCalculations: Array<{
    month: string
    calculations: number
    totalValue: number
    totalDuty: number
    avgRate: number
  }>
  dutyTrends: Array<{
    month: string
    actualDuty: number
    projectedDuty: number
    savings: number
  }>
  topHSCodes: Array<{
    hsCode: string
    description: string
    frequency: number
    totalValue: number
    avgRate: number
    rateChange?: number
  }>
  costBreakdown: Array<{
    category: string
    value: number
    percentage: number
    color: string
  }>
  alertTrends: Array<{
    month: string
    alerts: number
    rateIncreases: number
    rateDecreases: number
  }>
}

export default function AnalyticsPage() {
  const [, setUser] = useState<User | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '12m'>('6m')

  const router = useRouter()
  const supabase = createClientSupabaseClient()

  // Authentication and data loading
  useEffect(() => {
    const loadAnalytics = async () => {
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

        // Load analytics data
        await loadAnalyticsData(workspaceData.id)

      } catch (error) {
        console.error('Analytics page load error:', error)
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [router, supabase, timeRange])

  const loadAnalyticsData = async (workspaceId: string) => {
    try {
      setRefreshing(true)

      // Calculate date range
      const monthsToShow = timeRange === '3m' ? 3 : timeRange === '6m' ? 6 : 12
      const endDate = new Date()
      const startDate = subMonths(endDate, monthsToShow)

      // Get calculations for the time period
      const { data: calculations, error: calcError } = await supabase
        .from('calculations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      if (calcError) {
        console.error('Error loading calculations:', calcError)
        return
      }

      // Get alerts for the time period
      const { data: alerts, error: alertError } = await supabase
        .from('alerts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })

      if (alertError) {
        console.error('Error loading alerts:', alertError)
      }

      // Process data into analytics format
      const analyticsData = processAnalyticsData(calculations || [], alerts || [], monthsToShow)
      setAnalytics(analyticsData)

    } catch (error) {
      console.error('Analytics data load error:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const processAnalyticsData = (
    calculations: Calculation[], 
    alerts: Alert[], 
    monthsToShow: number
  ): AnalyticsData => {
    const endDate = new Date()
    const startDate = subMonths(endDate, monthsToShow)
    
    // Generate month intervals
    const monthIntervals = eachMonthOfInterval({ start: startDate, end: endDate })

    // Process monthly calculations
    const monthlyCalculations = monthIntervals.map(monthStart => {
      const monthEnd = endOfMonth(monthStart)
      const monthCalcs = calculations.filter(calc => {
        const calcDate = new Date(calc.created_at)
        return calcDate >= monthStart && calcDate <= monthEnd
      })

      const totalValue = monthCalcs.reduce((sum, calc) => sum + calc.total_value, 0)
      const totalDuty = monthCalcs.reduce((sum, calc) => sum + calc.total_duty, 0)
      const avgRate = totalValue > 0 ? (totalDuty / totalValue) * 100 : 0

      return {
        month: format(monthStart, 'MMM yyyy'),
        calculations: monthCalcs.length,
        totalValue,
        totalDuty,
        avgRate: parseFloat(avgRate.toFixed(2))
      }
    })

    // Process duty trends with projections
    const dutyTrends = monthlyCalculations.map((month, index) => {
      const projectedDuty = index > 0 && monthlyCalculations[index - 1]
        ? monthlyCalculations[index - 1]!.totalDuty * 1.05 // 5% projected increase
        : month.totalDuty
      
      return {
        month: month.month,
        actualDuty: month.totalDuty,
        projectedDuty,
        savings: Math.max(0, projectedDuty - month.totalDuty)
      }
    })

    // Process top HS codes
    const hsCodeMap = new Map<string, {
      frequency: number
      totalValue: number
      totalDuty: number
      description: string
    }>()

    calculations.forEach(calc => {
      calc.line_items?.forEach((item: any) => {
        if (item.hsCode) {
          const existing = hsCodeMap.get(item.hsCode) || {
            frequency: 0,
            totalValue: 0,
            totalDuty: 0,
            description: item.description || 'Unknown item'
          }

          existing.frequency += 1
          existing.totalValue += item.value || 0
          existing.totalDuty += item.duty || 0

          hsCodeMap.set(item.hsCode, existing)
        }
      })
    })

    const topHSCodes = Array.from(hsCodeMap.entries())
      .map(([hsCode, data]) => ({
        hsCode,
        description: data.description,
        frequency: data.frequency,
        totalValue: data.totalValue,
        avgRate: data.totalValue > 0 ? (data.totalDuty / data.totalValue) * 100 : 0
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 8)

    // Process cost breakdown
    const totalValue = calculations.reduce((sum, calc) => sum + calc.total_value, 0)
    const totalDuty = calculations.reduce((sum, calc) => sum + calc.total_duty, 0)
    const costBreakdown = [
      {
        category: 'Import Duties',
        value: totalDuty,
        percentage: totalValue > 0 ? (totalDuty / totalValue) * 100 : 0,
        color: '#ef4444'
      },
      {
        category: 'Goods Value',
        value: totalValue - totalDuty,
        percentage: totalValue > 0 ? ((totalValue - totalDuty) / totalValue) * 100 : 100,
        color: '#3b82f6'
      }
    ]

    // Process alert trends
    const alertTrends = monthIntervals.map(monthStart => {
      const monthEnd = endOfMonth(monthStart)
      const monthAlerts = alerts.filter(alert => {
        const alertDate = new Date(alert.created_at)
        return alertDate >= monthStart && alertDate <= monthEnd
      })

      const rateIncreases = monthAlerts.filter(alert => 
        alert.new_rate > (alert.old_rate || 0)
      ).length

      const rateDecreases = monthAlerts.filter(alert => 
        alert.new_rate < (alert.old_rate || 0)
      ).length

      return {
        month: format(monthStart, 'MMM yyyy'),
        alerts: monthAlerts.length,
        rateIncreases,
        rateDecreases
      }
    })

    return {
      monthlyCalculations,
      dutyTrends,
      topHSCodes,
      costBreakdown,
      alertTrends
    }
  }

  const handleRefresh = () => {
    if (workspace) {
      loadAnalyticsData(workspace.id)
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
          <div className='flex items-center justify-between'>
            <div className="flex items-center">
              <Link
                href="/dashboard"
                className="mr-4 flex items-center text-gray-600 hover:text-gray-900"
              >
                <ChevronLeftIcon className="size-5 mr-1" />
                Back to Dashboard
              </Link>
              <div>
                <h1 className='text-2xl font-bold text-gray-900'>Import Analytics</h1>
                <p className='text-gray-600'>Comprehensive insights and cost analysis</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Time Range Selector */}
              <div className="flex rounded-md shadow-sm">
                {(['3m', '6m', '12m'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setTimeRange(period)}
                    className={`px-3 py-2 text-sm font-medium ${
                      timeRange === period
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    } ${
                      period === '3m' ? 'rounded-l-md' :
                      period === '12m' ? 'rounded-r-md' : ''
                    } border border-gray-300`}
                  >
                    {period === '3m' ? '3 Months' : period === '6m' ? '6 Months' : '12 Months'}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <ArrowPathIcon className={`mr-2 size-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-4 py-8'>
        {analytics ? (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4'>
              <div className='rounded-lg border bg-white p-6 shadow-sm'>
                <div className='flex items-center'>
                  <div className='shrink-0'>
                    <ChartBarIcon className='size-8 text-blue-600' />
                  </div>
                  <div className='ml-4'>
                    <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
                      Total Calculations
                    </h3>
                    <p className='mt-1 text-2xl font-bold text-gray-900'>
                      {analytics.monthlyCalculations.reduce((sum, month) => sum + month.calculations, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className='rounded-lg border bg-white p-6 shadow-sm'>
                <div className='flex items-center'>
                  <div className='shrink-0'>
                    <CurrencyDollarIcon className='size-8 text-green-600' />
                  </div>
                  <div className='ml-4'>
                    <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
                      Total Import Value
                    </h3>
                    <p className='mt-1 text-2xl font-bold text-gray-900'>
                      ${analytics.monthlyCalculations.reduce((sum, month) => sum + month.totalValue, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className='rounded-lg border bg-white p-6 shadow-sm'>
                <div className='flex items-center'>
                  <div className='shrink-0'>
                    <ArrowTrendingUpIcon className='size-8 text-red-600' />
                  </div>
                  <div className='ml-4'>
                    <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
                      Total Duties Paid
                    </h3>
                    <p className='mt-1 text-2xl font-bold text-gray-900'>
                      ${analytics.monthlyCalculations.reduce((sum, month) => sum + month.totalDuty, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className='rounded-lg border bg-white p-6 shadow-sm'>
                <div className='flex items-center'>
                  <div className='shrink-0'>
                    <ArrowTrendingDownIcon className='size-8 text-indigo-600' />
                  </div>
                  <div className='ml-4'>
                    <h3 className='text-sm font-medium uppercase tracking-wide text-gray-500'>
                      Potential Savings
                    </h3>
                    <p className='mt-1 text-2xl font-bold text-gray-900'>
                      ${analytics.dutyTrends.reduce((sum, trend) => sum + trend.savings, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Monthly Import Volume Trend */}
              <div className='rounded-lg border bg-white p-6 shadow-sm'>
                <div className='mb-6 flex items-center justify-between'>
                  <h2 className='text-lg font-semibold text-gray-900'>Import Volume Trends</h2>
                  <CalendarIcon className='size-5 text-gray-400' />
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.monthlyCalculations}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'totalValue' ? `$${value.toLocaleString()}` : value.toLocaleString(),
                        name === 'totalValue' ? 'Import Value' : 'Calculations'
                      ]}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="totalValue" 
                      stackId="1" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.6}
                      name="Import Value ($)"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="calculations" 
                      stackId="2" 
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.6}
                      name="Number of Calculations"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Duty Rate Analysis */}
              <div className='rounded-lg border bg-white p-6 shadow-sm'>
                <div className='mb-6 flex items-center justify-between'>
                  <h2 className='text-lg font-semibold text-gray-900'>Duty Rate Analysis</h2>
                  <ArrowTrendingUpIcon className='size-5 text-gray-400' />
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.monthlyCalculations}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'Average Rate']}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="avgRate" 
                      stroke="#ef4444" 
                      strokeWidth={3}
                      dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                      name="Average Duty Rate (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              {/* Top HS Codes */}
              <div className='rounded-lg border bg-white p-6 shadow-sm lg:col-span-2'>
                <div className='mb-6 flex items-center justify-between'>
                  <h2 className='text-lg font-semibold text-gray-900'>Most Imported HS Codes</h2>
                  <ChartBarIcon className='size-5 text-gray-400' />
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.topHSCodes} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      type="category" 
                      dataKey="hsCode" 
                      width={80}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'totalValue' ? `$${value.toLocaleString()}` : value,
                        name === 'totalValue' ? 'Import Value' : 'Frequency'
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="frequency" fill="#3b82f6" name="Import Frequency" />
                    <Bar dataKey="totalValue" fill="#10b981" name="Total Value ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cost Breakdown */}
              <div className='rounded-lg border bg-white p-6 shadow-sm'>
                <div className='mb-6 flex items-center justify-between'>
                  <h2 className='text-lg font-semibold text-gray-900'>Cost Breakdown</h2>
                  <CurrencyDollarIcon className='size-5 text-gray-400' />
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.costBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, percentage }) => `${category}: ${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analytics.costBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Insights Panel */}
            <div className='rounded-lg border bg-blue-50 p-6'>
              <div className='flex items-start'>
                <InformationCircleIcon className='mr-3 size-6 text-blue-600 shrink-0' />
                <div>
                  <h3 className='text-lg font-medium text-blue-900'>Analytics Insights</h3>
                  <div className='mt-2 text-sm text-blue-800'>
                    <ul className='list-disc list-inside space-y-1'>
                      <li>
                        Your average duty rate is {' '}
                        {analytics.monthlyCalculations.length > 0 
                          ? (analytics.monthlyCalculations.reduce((sum, m) => sum + m.avgRate, 0) / analytics.monthlyCalculations.length).toFixed(2)
                          : 0}% 
                        across all imports
                      </li>
                      <li>
                        Most frequently imported HS code: {' '}
                        {analytics.topHSCodes[0]?.hsCode || 'N/A'} 
                        ({analytics.topHSCodes[0]?.frequency || 0} times)
                      </li>
                      <li>
                        Total potential savings identified: ${analytics.dutyTrends.reduce((sum, trend) => sum + trend.savings, 0).toLocaleString()}
                      </li>
                      <li>
                        Import volume trend: {' '}
                        {analytics.monthlyCalculations.length >= 2 
                          ? (analytics.monthlyCalculations[analytics.monthlyCalculations.length - 1]?.totalValue || 0) > 
                            (analytics.monthlyCalculations[analytics.monthlyCalculations.length - 2]?.totalValue || 0)
                            ? '📈 Increasing' 
                            : '📉 Decreasing'
                          : 'Insufficient data'}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <ChartBarIcon className="mx-auto size-12 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No analytics data available yet</p>
            <p className="text-sm text-gray-400">Start using the calculator to see your import analytics</p>
          </div>
        )}
      </main>
    </div>
  )
}