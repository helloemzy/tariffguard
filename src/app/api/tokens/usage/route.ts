/**
 * API Usage Analytics
 * Provides usage statistics and analytics for API tokens
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Get API usage analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const tokenId = searchParams.get('tokenId') // Optional - for specific token
    const timeframe = searchParams.get('timeframe') || '7d' // '1d', '7d', '30d'
    const groupBy = searchParams.get('groupBy') || 'day' // 'hour', 'day', 'week'

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameter: workspaceId' },
        { status: 400 }
      )
    }

    // Calculate time range
    let startDate: Date
    switch (timeframe) {
      case '1d':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }

    // Base query for usage logs
    let query = supabase
      .from('api_usage_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString())

    if (tokenId) {
      query = query.eq('token_id', tokenId)
    }

    const { data: usageLogs, error } = await query
      .order('created_at', { ascending: true })

    if (error) {
      await logger.error('Failed to fetch API usage analytics', {
        workspaceId,
        tokenId,
        errorMessage: error.message
      }, error)

      return NextResponse.json(
        { error: 'Failed to fetch usage analytics' },
        { status: 500 }
      )
    }

    // Process data for analytics
    const analytics = processUsageData(usageLogs || [], groupBy)

    // Get current rate limit status for tokens
    const rateLimitStatus = await getCurrentRateLimitStatus(workspaceId, tokenId || undefined)

    // Get top endpoints
    const endpointStats = getEndpointStats(usageLogs || [])

    // Get error statistics
    const errorStats = getErrorStats(usageLogs || [])

    return NextResponse.json({
      success: true,
      analytics: {
        timeframe,
        groupBy,
        totalRequests: usageLogs?.length || 0,
        successRate: calculateSuccessRate(usageLogs || []),
        averageResponseTime: calculateAverageResponseTime(usageLogs || []),
        dataPoints: analytics,
        rateLimitStatus,
        topEndpoints: endpointStats,
        errorBreakdown: errorStats
      }
    })

  } catch (error) {
    await logger.error('Failed to fetch API usage analytics', {
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to fetch usage analytics' },
      { status: 500 }
    )
  }
}

// Helper function to process usage data into time series
function processUsageData(logs: any[], groupBy: string) {
  const grouped = logs.reduce((acc, log) => {
    let key: string
    const date = new Date(log.created_at)

    switch (groupBy) {
      case 'hour':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`
        break
      case 'day':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        break
      case 'week':
        const week = getWeekNumber(date)
        key = `${date.getFullYear()}-W${week}`
        break
      default:
        key = date.toISOString().split('T')[0]!
    }

    if (!acc[key]) {
      acc[key] = {
        timestamp: key,
        requests: 0,
        errors: 0,
        totalResponseTime: 0,
        responseTimeCount: 0
      }
    }

    acc[key].requests++
    if (log.status_code >= 400) {
      acc[key].errors++
    }
    if (log.response_time_ms) {
      acc[key].totalResponseTime += log.response_time_ms
      acc[key].responseTimeCount++
    }

    return acc
  }, {} as Record<string, any>)

  return Object.values(grouped).map((group: any) => ({
    timestamp: group.timestamp,
    requests: group.requests,
    errors: group.errors,
    successRate: ((group.requests - group.errors) / group.requests) * 100,
    averageResponseTime: group.responseTimeCount > 0
      ? group.totalResponseTime / group.responseTimeCount
      : 0
  }))
}

// Helper function to get current rate limit status
async function getCurrentRateLimitStatus(_workspaceId: string, tokenId?: string) {
  if (!tokenId) return null

  try {
    // Check rate limits for minute, hour, day
    const [minute, hour, day] = await Promise.all([
      supabase.rpc('check_rate_limit', { p_token_id: tokenId, p_window: 'minute' }),
      supabase.rpc('check_rate_limit', { p_token_id: tokenId, p_window: 'hour' }),
      supabase.rpc('check_rate_limit', { p_token_id: tokenId, p_window: 'day' })
    ])

    return {
      minute: minute.data,
      hour: hour.data,
      day: day.data
    }
  } catch (error) {
    return null
  }
}

// Helper function to get endpoint statistics
function getEndpointStats(logs: any[]) {
  const endpointCounts = logs.reduce((acc, log) => {
    const endpoint = log.endpoint
    if (!acc[endpoint]) {
      acc[endpoint] = {
        endpoint,
        requests: 0,
        errors: 0,
        totalResponseTime: 0,
        responseTimeCount: 0
      }
    }

    acc[endpoint].requests++
    if (log.status_code >= 400) {
      acc[endpoint].errors++
    }
    if (log.response_time_ms) {
      acc[endpoint].totalResponseTime += log.response_time_ms
      acc[endpoint].responseTimeCount++
    }

    return acc
  }, {} as Record<string, any>)

  return Object.values(endpointCounts)
    .map((stat: any) => ({
      endpoint: stat.endpoint,
      requests: stat.requests,
      errorRate: (stat.errors / stat.requests) * 100,
      averageResponseTime: stat.responseTimeCount > 0
        ? stat.totalResponseTime / stat.responseTimeCount
        : 0
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10) // Top 10 endpoints
}

// Helper function to get error statistics
function getErrorStats(logs: any[]) {
  const errorCounts = logs
    .filter(log => log.status_code >= 400)
    .reduce((acc, log) => {
      const status = log.status_code
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<number, number>)

  return Object.entries(errorCounts)
    .map(([status, count]) => ({
      statusCode: parseInt(status),
      count: count as number,
      percentage: ((count as number) / logs.length) * 100
    }))
    .sort((a, b) => b.count - a.count)
}

// Helper functions
function calculateSuccessRate(logs: any[]): number {
  if (logs.length === 0) return 100
  const successCount = logs.filter(log => log.status_code < 400).length
  return (successCount / logs.length) * 100
}

function calculateAverageResponseTime(logs: any[]): number {
  const responseTimes = logs
    .filter(log => log.response_time_ms !== null)
    .map(log => log.response_time_ms)

  if (responseTimes.length === 0) return 0
  return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}