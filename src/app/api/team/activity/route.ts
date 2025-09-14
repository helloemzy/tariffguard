/**
 * Team Activity Feed API
 * Provides activity timeline and collaboration updates
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Get team activity feed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const activityType = searchParams.get('type') // Optional filter

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameter: workspaceId' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabase
      .from('team_activity_feed')
      .select(`
        id,
        activity_type,
        description,
        user_id,
        target_user_id,
        entity_type,
        entity_id,
        activity_data,
        visibility,
        importance,
        created_at
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add type filter if specified
    if (activityType) {
      query = query.eq('activity_type', activityType)
    }

    const { data: activities, error } = await query

    if (error) {
      await logger.error('Failed to fetch team activity', {
        workspaceId,
        errorMessage: error.message
      }, error)

      return NextResponse.json(
        { error: 'Failed to fetch activity' },
        { status: 500 }
      )
    }

    // Get user details for all actors
    const userIds = new Set<string>()
    activities?.forEach(activity => {
      if (activity.user_id) userIds.add(activity.user_id)
      if (activity.target_user_id) userIds.add(activity.target_user_id)
    })

    const userMap = new Map()
    if (userIds.size > 0) {
      const { data: users } = await supabase.auth.admin.listUsers()
      users.users?.forEach(user => {
        if (userIds.has(user.id)) {
          userMap.set(user.id, {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email?.split('@')[0],
            avatar: user.user_metadata?.avatar_url
          })
        }
      })
    }

    // Format activities
    const formattedActivities = activities?.map(activity => ({
      id: activity.id,
      type: activity.activity_type,
      description: activity.description,
      entityType: activity.entity_type,
      entityId: activity.entity_id,
      data: activity.activity_data,
      visibility: activity.visibility,
      importance: activity.importance,
      createdAt: activity.created_at,
      user: activity.user_id ? userMap.get(activity.user_id) : null,
      targetUser: activity.target_user_id ? userMap.get(activity.target_user_id) : null
    })) || []

    return NextResponse.json({
      success: true,
      activities: formattedActivities,
      pagination: {
        limit,
        offset,
        hasMore: activities?.length === limit
      }
    })

  } catch (error) {
    await logger.error('Failed to fetch team activity', {
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    )
  }
}

// Mark activities as read
export async function POST(request: NextRequest) {
  try {
    const { activityIds, userId } = await request.json()

    if (!activityIds || !Array.isArray(activityIds) || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: activityIds (array), userId' },
        { status: 400 }
      )
    }

    // Update read status for activities - using a database function
    const readTimestamp = new Date().toISOString()

    const { error } = await supabase.rpc('mark_activities_as_read', {
      p_user_id: userId,
      p_activity_ids: activityIds,
      p_read_timestamp: readTimestamp
    })

    if (error) {
      await logger.error('Failed to mark activities as read', {
        activityIds,
        userId,
        errorMessage: error.message
      }, error)

      return NextResponse.json(
        { error: 'Failed to mark activities as read' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      markedAsRead: activityIds.length
    })

  } catch (error) {
    await logger.error('Failed to mark activities as read', {
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to mark activities as read' },
      { status: 500 }
    )
  }
}

// Get activity statistics
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const userId = searchParams.get('userId')

    if (!workspaceId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: workspaceId, userId' },
        { status: 400 }
      )
    }

    // Get unread count
    const { data: activities, error } = await supabase
      .from('team_activity_feed')
      .select('id, read_by')
      .eq('workspace_id', workspaceId)

    if (error) {
      await logger.error('Failed to fetch activity statistics', {
        workspaceId,
        userId,
        errorMessage: error.message
      }, error)

      return NextResponse.json(
        { error: 'Failed to fetch statistics' },
        { status: 500 }
      )
    }

    const unreadCount = activities?.filter(activity => {
      const readBy = activity.read_by as Record<string, string> | null
      return !readBy || !readBy[userId]
    }).length || 0

    // Get activity type breakdown for last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: recentActivities } = await supabase
      .from('team_activity_feed')
      .select('activity_type')
      .eq('workspace_id', workspaceId)
      .gte('created_at', sevenDaysAgo)

    const typeBreakdown = recentActivities?.reduce((acc, activity) => {
      acc[activity.activity_type] = (acc[activity.activity_type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    return NextResponse.json({
      success: true,
      statistics: {
        unreadCount,
        totalActivities: activities?.length || 0,
        recentTypeBreakdown: typeBreakdown
      }
    })

  } catch (error) {
    await logger.error('Failed to fetch activity statistics', {
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}