'use client'

import { useState, useEffect } from 'react'
import {
  CurrencyDollarIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  CalendarIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface RevenueData {
  kpiMetrics: {
    mrr: number
    arpu: number
    conversionRate: number
    totalRevenue: number
    activeSubscriptions: number
    newCustomers: number
  }
  revenueTrends: {
    trends: Array<{ date: string; revenue: number }>
    totalRevenue: number
  }
  subscriptionMetrics: {
    total: number
    newSubscriptions: number
    activeSubscriptions: number
    canceledSubscriptions: number
  }
  customerMetrics: {
    totalCustomers: number
    newCustomers: number
    activeCustomers: number
    customerGrowthRate: number
  }
  planDistribution: {
    FREE: number
    PROFESSIONAL: number
    ENTERPRISE: number
  }
  usageAnalytics: {
    totalCalculations: number
    totalOcrProcessing: number
    averageCalculationsPerUser: number
    activeUsers: number
  }
  churnAnalysis: {
    churned: number
    churnRate: number
    totalSubscriptions: number
  }
}

export default function RevenueAnalyticsPage() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(30)
  const [granularity, setGranularity] = useState('day')

  useEffect(() => {
    fetchRevenueData()
  }, [period, granularity])

  const fetchRevenueData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/revenue?period=${period}&granularity=${granularity}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        console.error('Failed to fetch revenue data:', result.error)
      }
    } catch (error) {
      console.error('Revenue data fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Failed to Load Data</h2>
          <button
            onClick={fetchRevenueData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Chart configurations
  const revenueChartData = {
    labels: data.revenueTrends.trends.map(t => new Date(t.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Revenue ($)',
        data: data.revenueTrends.trends.map(t => t.revenue),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3
      }
    ]
  }

  const planDistributionData = {
    labels: ['Free', 'Professional', 'Enterprise'],
    datasets: [
      {
        data: [
          data.planDistribution.FREE,
          data.planDistribution.PROFESSIONAL,
          data.planDistribution.ENTERPRISE
        ],
        backgroundColor: ['#e5e7eb', '#3b82f6', '#1e40af'],
        borderWidth: 0
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#f3f4f6'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revenue Analytics</h1>
            <p className="mt-2 text-gray-600">Business metrics and financial insights</p>
          </div>

          {/* Filters */}
          <div className="mt-4 sm:mt-0 flex space-x-4">
            <select
              value={period}
              onChange={(e) => setPeriod(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>

            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Monthly Recurring Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.kpiMetrics.mrr)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UsersIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
                <p className="text-2xl font-bold text-gray-900">{data.kpiMetrics.activeSubscriptions}</p>
                <p className="text-xs text-green-600 flex items-center">
                  <ArrowUpIcon className="h-3 w-3 mr-1" />
                  {data.customerMetrics.newCustomers} new this period
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ArrowTrendingUpIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Average Revenue Per User</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.kpiMetrics.arpu)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold text-gray-900">{formatPercentage(data.kpiMetrics.conversionRate)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <ArrowDownIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Churn Rate</p>
                <p className="text-2xl font-bold text-gray-900">{formatPercentage(data.churnAnalysis.churnRate)}</p>
                <p className="text-xs text-gray-500">{data.churnAnalysis.churned} churned</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <CalendarIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.kpiMetrics.totalRevenue)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Revenue Trend Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trends</h3>
            <div className="h-80">
              <Line data={revenueChartData} options={chartOptions} />
            </div>
          </div>

          {/* Plan Distribution Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Plans</h3>
            <div className="h-80 flex items-center justify-center">
              <Doughnut
                data={planDistributionData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        padding: 20
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Customer Metrics */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Customers</span>
                <span className="font-semibold">{data.customerMetrics.totalCustomers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Active Customers</span>
                <span className="font-semibold">{data.customerMetrics.activeCustomers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Growth Rate</span>
                <span className="font-semibold text-green-600">
                  {formatPercentage(data.customerMetrics.customerGrowthRate)}
                </span>
              </div>
            </div>
          </div>

          {/* Usage Analytics */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Analytics</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Calculations</span>
                <span className="font-semibold">{data.usageAnalytics.totalCalculations.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">OCR Processing</span>
                <span className="font-semibold">{data.usageAnalytics.totalOcrProcessing.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg per User</span>
                <span className="font-semibold">{data.usageAnalytics.averageCalculationsPerUser}</span>
              </div>
            </div>
          </div>

          {/* Subscription Health */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Health</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Active</span>
                <span className="font-semibold text-green-600">{data.subscriptionMetrics.activeSubscriptions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">New This Period</span>
                <span className="font-semibold text-blue-600">{data.subscriptionMetrics.newSubscriptions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Canceled</span>
                <span className="font-semibold text-red-600">{data.subscriptionMetrics.canceledSubscriptions}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}