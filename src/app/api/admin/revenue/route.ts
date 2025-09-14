/**
 * Revenue Analytics API
 * Provides comprehensive revenue metrics and business intelligence
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { withLogging } from '@/middleware/logging'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '30' // days
  const granularity = searchParams.get('granularity') || 'day' // day, week, month

  try {
    const periodDays = parseInt(period)
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)

    // Get subscription metrics
    const subscriptionMetrics = await getSubscriptionMetrics(startDate, granularity)

    // Get revenue trends
    const revenueTrends = await getRevenueTrends(startDate, granularity)

    // Get customer metrics
    const customerMetrics = await getCustomerMetrics(startDate)

    // Get plan distribution
    const planDistribution = await getPlanDistribution()

    // Get usage analytics
    const usageAnalytics = await getUsageAnalytics(startDate)

    // Get churn analysis
    const churnAnalysis = await getChurnAnalysis(startDate)

    // Calculate key metrics
    const kpiMetrics = calculateKPIs(subscriptionMetrics, customerMetrics, revenueTrends)

    await logger.businessEvent('revenue_dashboard_accessed', {
      period: periodDays,
      granularity,
      metricsGenerated: Object.keys(kpiMetrics).length
    })

    return NextResponse.json({
      success: true,
      data: {
        timeRange: {
          period: periodDays,
          granularity,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        },
        kpiMetrics,
        subscriptionMetrics,
        revenueTrends,
        customerMetrics,
        planDistribution,
        usageAnalytics,
        churnAnalysis,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    await logger.error('Failed to generate revenue analytics', {
      period,
      granularity,
      errorName: (error as Error).name,
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to generate revenue analytics' },
      { status: 500 }
    )
  }
}

async function getSubscriptionMetrics(startDate: Date, _granularity: string) {
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('*')
    .gte('created_at', startDate.toISOString())

  const { data: allSubscriptions } = await supabase
    .from('subscriptions')
    .select('*')

  return {
    total: allSubscriptions?.length || 0,
    newSubscriptions: subscriptions?.length || 0,
    activeSubscriptions: allSubscriptions?.filter(s => s.status === 'active').length || 0,
    canceledSubscriptions: allSubscriptions?.filter(s => s.status === 'canceled').length || 0,
    trialSubscriptions: allSubscriptions?.filter(s => s.status === 'trial').length || 0
  }
}

async function getRevenueTrends(startDate: Date, granularity: string) {
  // Get billing events for revenue calculation
  const { data: billingEvents } = await supabase
    .from('billing_events')
    .select('*')
    .eq('event_type', 'invoice.payment_succeeded')
    .gte('processed_at', startDate.toISOString())
    .order('processed_at', { ascending: true })

  // Group by time period
  const trends: Record<string, number> = {}

  billingEvents?.forEach(event => {
    const date = new Date(event.processed_at)
    let key: string

    switch (granularity) {
      case 'day':
        key = date.toISOString().split('T')[0]!
        break
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0]!
        break
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        break
      default:
        key = date.toISOString().split('T')[0]!
    }

    trends[key] = (trends[key] || 0) + (event.amount_cents / 100)
  })

  return {
    trends: Object.entries(trends).map(([date, revenue]) => ({ date, revenue })),
    totalRevenue: Object.values(trends).reduce((sum, revenue) => sum + revenue, 0)
  }
}

async function getCustomerMetrics(startDate: Date) {
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('created_at, subscription_plan')

  const newCustomers = workspaces?.filter(w =>
    new Date(w.created_at) >= startDate
  ).length || 0

  const { data: activeCustomers } = await supabase
    .from('subscriptions')
    .select('workspace_id')
    .eq('status', 'active')

  return {
    totalCustomers: workspaces?.length || 0,
    newCustomers,
    activeCustomers: activeCustomers?.length || 0,
    customerGrowthRate: workspaces?.length ? (newCustomers / workspaces.length) * 100 : 0
  }
}

async function getPlanDistribution() {
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('status', 'active')

  const distribution = subscriptions?.reduce((acc, sub) => {
    acc[sub.plan] = (acc[sub.plan] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  return {
    FREE: distribution.FREE || 0,
    PROFESSIONAL: distribution.PROFESSIONAL || 0,
    ENTERPRISE: distribution.ENTERPRISE || 0
  }
}

async function getUsageAnalytics(_startDate: Date) {
  const currentMonth = new Date().toISOString().slice(0, 7)

  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('month_year', currentMonth)

  const totalCalculations = usage?.reduce((sum, u) => sum + u.calculations_count, 0) || 0
  const totalOcrProcessing = usage?.reduce((sum, u) => sum + (u.ocr_processing_count || 0), 0) || 0
  const averageCalculationsPerUser = usage?.length ? totalCalculations / usage.length : 0

  return {
    totalCalculations,
    totalOcrProcessing,
    averageCalculationsPerUser: Math.round(averageCalculationsPerUser * 100) / 100,
    activeUsers: usage?.length || 0
  }
}

async function getChurnAnalysis(_startDate: Date) {
  const { data: canceledSubs } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('status', 'canceled')
    .gte('updated_at', _startDate.toISOString())

  const { data: totalSubs } = await supabase
    .from('subscriptions')
    .select('id')

  const churnRate = totalSubs?.length ?
    ((canceledSubs?.length || 0) / totalSubs.length) * 100 : 0

  return {
    churned: canceledSubs?.length || 0,
    churnRate: Math.round(churnRate * 100) / 100,
    totalSubscriptions: totalSubs?.length || 0
  }
}

function calculateKPIs(subscriptionMetrics: any, customerMetrics: any, revenueTrends: any) {
  const mrr = revenueTrends.totalRevenue / (revenueTrends.trends.length || 1) * 30 // Monthly recurring revenue estimate
  const arpu = customerMetrics.activeCustomers ? revenueTrends.totalRevenue / customerMetrics.activeCustomers : 0
  const conversionRate = customerMetrics.totalCustomers ?
    (subscriptionMetrics.activeSubscriptions / customerMetrics.totalCustomers) * 100 : 0

  return {
    mrr: Math.round(mrr * 100) / 100,
    arpu: Math.round(arpu * 100) / 100,
    conversionRate: Math.round(conversionRate * 100) / 100,
    totalRevenue: revenueTrends.totalRevenue,
    activeSubscriptions: subscriptionMetrics.activeSubscriptions,
    newCustomers: customerMetrics.newCustomers
  }
}

export const GET = withLogging(handler, {
  logSuccessfulRequests: false
})