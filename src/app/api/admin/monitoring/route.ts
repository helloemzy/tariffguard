/**
 * Error Monitoring Dashboard API
 * Provides error statistics and monitoring data for admin dashboard
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
  const hoursBack = parseInt(searchParams.get('hours') || '24')
  const workspaceId = searchParams.get('workspaceId') || undefined

  try {
    // Get error statistics
    const { data: errorStats } = await supabase
      .rpc('get_error_statistics', {
        p_workspace_id: workspaceId,
        p_hours_back: hoursBack
      })

    // Get performance statistics
    const { data: performanceStats } = await supabase
      .rpc('get_performance_statistics', {
        p_workspace_id: workspaceId,
        p_hours_back: hoursBack
      })

    // Get recent critical errors
    const { data: criticalErrors } = await supabase
      .from('error_logs')
      .select('*')
      .eq('level', 'error')
      .eq('resolved', false)
      .gte('timestamp', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false })
      .limit(10)

    // Get security events
    const { data: securityEvents } = await supabase
      .from('security_events')
      .select('*')
      .in('severity', ['high', 'critical'])
      .eq('investigated', false)
      .gte('timestamp', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false })
      .limit(5)

    // Get system health metrics
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const { data: healthMetrics } = await supabase
      .from('error_logs')
      .select('level, timestamp')
      .gte('timestamp', oneHourAgo.toISOString())

    // Calculate health score (0-100)
    const totalLogs = healthMetrics?.length || 0
    const errorLogs = healthMetrics?.filter(log => log.level === 'error').length || 0
    const healthScore = Math.max(0, 100 - (errorLogs / Math.max(totalLogs, 1)) * 100)

    await logger.info('Monitoring dashboard accessed', {
      hoursBack,
      workspaceId,
      criticalErrorsCount: criticalErrors?.length || 0,
      securityEventsCount: securityEvents?.length || 0
    })

    return NextResponse.json({
      success: true,
      data: {
        timeRange: {
          hoursBack,
          from: new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString()
        },
        systemHealth: {
          score: Math.round(healthScore),
          status: healthScore >= 95 ? 'excellent' :
                  healthScore >= 85 ? 'good' :
                  healthScore >= 70 ? 'fair' : 'poor',
          totalLogs,
          errorLogs
        },
        errorStatistics: errorStats || {},
        performanceStatistics: performanceStats || {},
        criticalErrors: criticalErrors || [],
        securityEvents: securityEvents || [],
        alerts: {
          unresolved_errors: criticalErrors?.length || 0,
          security_events: securityEvents?.length || 0,
          performance_issues: performanceStats?.p99_response_time_ms > 5000 ? 1 : 0
        }
      }
    })

  } catch (error) {
    await logger.error('Failed to fetch monitoring data', {
      hoursBack,
      workspaceId,
      errorName: (error as Error).name,
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to fetch monitoring data' },
      { status: 500 }
    )
  }
}

export const GET = withLogging(handler, {
  logSuccessfulRequests: false // Don't log successful monitoring requests to avoid noise
})

// Mark error as resolved
async function resolveErrorHandler(request: NextRequest) {
  try {
    const { errorId, resolution } = await request.json()

    if (!errorId) {
      return NextResponse.json(
        { error: 'Missing errorId' },
        { status: 400 }
      )
    }

    // Note: In a real app, you'd want to verify admin permissions here
    const { error } = await supabase
      .from('error_logs')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        context: {
          resolution: resolution || 'Marked as resolved via admin dashboard'
        } as any
      })
      .eq('id', errorId)

    if (error) {
      throw error
    }

    await logger.userAction('error_resolved', 'admin', undefined as string | undefined, {
      errorId,
      resolution
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    await logger.error('Failed to resolve error', {
      errorName: (error as Error).name,
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to resolve error' },
      { status: 500 }
    )
  }
}

export const POST = withLogging(resolveErrorHandler)