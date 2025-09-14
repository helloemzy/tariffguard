/**
 * API Token Management
 * Handles creation, listing, and management of API access tokens
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generate a secure API token
function generateApiToken(): { token: string; hash: string; prefix: string } {
  const token = `tg_${crypto.randomBytes(32).toString('hex')}`
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const prefix = token.substring(0, 12) + '...'

  return { token, hash, prefix }
}

// Create new API token
export async function POST(request: NextRequest) {
  try {
    const {
      workspaceId,
      name,
      scopes,
      expiresInDays,
      rateLimits,
      createdBy
    } = await request.json()

    if (!workspaceId || !name || !createdBy) {
      return NextResponse.json(
        { error: 'Missing required fields: workspaceId, name, createdBy' },
        { status: 400 }
      )
    }

    // Verify user has permission to create API tokens
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role, status')
      .eq('workspace_id', workspaceId)
      .eq('user_id', createdBy)
      .eq('status', 'active')
      .single()

    if (!member) {
      return NextResponse.json(
        { error: 'User is not a member of this workspace' },
        { status: 403 }
      )
    }

    if (!['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create API tokens' },
        { status: 403 }
      )
    }

    // Generate token
    const { token, hash, prefix } = generateApiToken()

    // Calculate expiry date
    let expiresAt = null
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date(Date.now() + (expiresInDays * 24 * 60 * 60 * 1000)).toISOString()
    }

    // Create token record
    const { data: apiToken, error } = await supabase
      .from('api_tokens')
      .insert({
        workspace_id: workspaceId,
        created_by: createdBy,
        name,
        token_hash: hash,
        token_prefix: prefix,
        scopes: scopes || ['calculations.read'],
        rate_limit_per_minute: rateLimits?.perMinute || 60,
        rate_limit_per_hour: rateLimits?.perHour || 1000,
        rate_limit_per_day: rateLimits?.perDay || 10000,
        expires_at: expiresAt
      })
      .select()
      .single()

    if (error) {
      await logger.error('Failed to create API token', {
        workspaceId,
        createdBy,
        errorMessage: error.message
      }, error)

      return NextResponse.json(
        { error: 'Failed to create API token' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase.rpc('log_team_activity', {
      p_workspace_id: workspaceId,
      p_activity_type: 'api_token_created',
      p_description: `API token "${name}" created`,
      p_user_id: createdBy,
      p_entity_type: 'api_token',
      p_entity_id: apiToken.id,
      p_activity_data: {
        token_name: name,
        scopes: scopes,
        expires_at: expiresAt
      }
    })

    return NextResponse.json({
      success: true,
      token: {
        id: apiToken.id,
        name: apiToken.name,
        token: token, // Only returned on creation
        prefix: apiToken.token_prefix,
        scopes: apiToken.scopes,
        rateLimits: {
          perMinute: apiToken.rate_limit_per_minute,
          perHour: apiToken.rate_limit_per_hour,
          perDay: apiToken.rate_limit_per_day
        },
        expiresAt: apiToken.expires_at,
        createdAt: apiToken.created_at
      }
    })

  } catch (error) {
    await logger.error('Failed to create API token', {
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to create API token' },
      { status: 500 }
    )
  }
}

// Get API tokens for workspace
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameter: workspaceId' },
        { status: 400 }
      )
    }

    // Get tokens for workspace
    const { data: tokens, error } = await supabase
      .from('api_tokens')
      .select(`
        id,
        name,
        token_prefix,
        scopes,
        rate_limit_per_minute,
        rate_limit_per_hour,
        rate_limit_per_day,
        status,
        last_used_at,
        expires_at,
        usage_count,
        created_at,
        created_by
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      await logger.error('Failed to fetch API tokens', {
        workspaceId,
        errorMessage: error.message
      }, error)

      return NextResponse.json(
        { error: 'Failed to fetch API tokens' },
        { status: 500 }
      )
    }

    // Get creator details for each token
    const formattedTokens = await Promise.all(
      tokens?.map(async (token) => {
        const { data: creator } = await supabase.auth.admin.getUserById(token.created_by)

        return {
          id: token.id,
          name: token.name,
          prefix: token.token_prefix,
          scopes: token.scopes,
          rateLimits: {
            perMinute: token.rate_limit_per_minute,
            perHour: token.rate_limit_per_hour,
            perDay: token.rate_limit_per_day
          },
          status: token.status,
          lastUsedAt: token.last_used_at,
          expiresAt: token.expires_at,
          usageCount: token.usage_count,
          createdAt: token.created_at,
          creator: {
            email: creator.user?.email,
            name: creator.user?.user_metadata?.full_name || creator.user?.email?.split('@')[0]
          }
        }
      }) || []
    )

    return NextResponse.json({
      success: true,
      tokens: formattedTokens
    })

  } catch (error) {
    await logger.error('Failed to fetch API tokens', {
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to fetch API tokens' },
      { status: 500 }
    )
  }
}

// Update or revoke API token
export async function PATCH(request: NextRequest) {
  try {
    const {
      tokenId,
      workspaceId,
      action, // 'revoke', 'activate', 'update'
      name,
      scopes,
      rateLimits
    } = await request.json()

    if (!tokenId || !workspaceId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: tokenId, workspaceId, action' },
        { status: 400 }
      )
    }

    // Verify token belongs to workspace
    const { data: token, error: tokenError } = await supabase
      .from('api_tokens')
      .select('*')
      .eq('id', tokenId)
      .eq('workspace_id', workspaceId)
      .single()

    if (tokenError || !token) {
      return NextResponse.json(
        { error: 'API token not found' },
        { status: 404 }
      )
    }

    let updateData: any = { updated_at: new Date().toISOString() }

    switch (action) {
      case 'revoke':
        updateData.status = 'revoked'
        break
      case 'activate':
        updateData.status = 'active'
        break
      case 'update':
        if (name) updateData.name = name
        if (scopes) updateData.scopes = scopes
        if (rateLimits) {
          updateData.rate_limit_per_minute = rateLimits.perMinute
          updateData.rate_limit_per_hour = rateLimits.perHour
          updateData.rate_limit_per_day = rateLimits.perDay
        }
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be revoke, activate, or update' },
          { status: 400 }
        )
    }

    // Update token
    const { error: updateError } = await supabase
      .from('api_tokens')
      .update(updateData)
      .eq('id', tokenId)

    if (updateError) {
      await logger.error('Failed to update API token', {
        tokenId,
        action,
        errorMessage: updateError.message
      }, updateError)

      return NextResponse.json(
        { error: 'Failed to update API token' },
        { status: 500 }
      )
    }

    // Log activity
    await supabase.rpc('log_team_activity', {
      p_workspace_id: workspaceId,
      p_activity_type: `api_token_${action}`,
      p_description: `API token "${token.name}" ${action}d`,
      p_entity_type: 'api_token',
      p_entity_id: tokenId,
      p_activity_data: {
        action,
        token_name: token.name
      }
    })

    return NextResponse.json({
      success: true,
      message: `Token ${action}d successfully`
    })

  } catch (error) {
    await logger.error('Failed to update API token', {
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to update API token' },
      { status: 500 }
    )
  }
}