/**
 * Team Invitation Acceptance API
 * Handles accepting team invitations and adding users to workspaces
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Accept team invitation
export async function POST(request: NextRequest) {
  try {
    const { token, userId } = await request.json()

    if (!token || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: token, userId' },
        { status: 400 }
      )
    }

    // Find the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('invitation_token', token)
      .eq('status', 'pending')
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation token' },
        { status: 400 }
      )
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      // Update invitation status to expired
      await supabase
        .from('team_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)

      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }

    // Get user info to verify email matches
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify email matches invitation
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email address does not match invitation' },
        { status: 400 }
      )
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', invitation.workspace_id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (existingMember) {
      // Update invitation as accepted anyway
      await supabase
        .from('team_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_by: userId
        })
        .eq('id', invitation.id)

      return NextResponse.json(
        { error: 'User is already a member of this workspace' },
        { status: 400 }
      )
    }

    // Add user to workspace using the database function
    const { error: memberError } = await supabase
      .rpc('add_team_member', {
        p_workspace_id: invitation.workspace_id,
        p_user_id: userId,
        p_role: invitation.role,
        p_invited_by: invitation.invited_by
      })

    if (memberError) {
      await logger.error('Failed to add team member via invitation', {
        invitationId: invitation.id,
        userId,
        workspaceId: invitation.workspace_id,
        errorMessage: memberError.message
      }, memberError)

      return NextResponse.json(
        { error: 'Failed to join workspace' },
        { status: 500 }
      )
    }

    // Update invitation status to accepted
    await supabase
      .from('team_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: userId
      })
      .eq('id', invitation.id)

    // Get workspace info for response
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('company_name, id')
      .eq('id', invitation.workspace_id)
      .single()

    await logger.info('team_member_joined', {
      workspaceId: invitation.workspace_id,
      role: invitation.role,
      companyName: workspace?.company_name
    })

    console.log(`✅ User ${user.email} joined workspace ${workspace?.company_name} as ${invitation.role}`)

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace?.id,
        name: workspace?.company_name,
        role: invitation.role
      },
      message: `Welcome to ${workspace?.company_name}!`
    })

  } catch (error) {
    await logger.error('Failed to accept team invitation', {
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}

// Get invitation details (for join page)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Missing required parameter: token' },
        { status: 400 }
      )
    }

    // Find the invitation
    const { data: invitation, error } = await supabase
      .from('team_invitations')
      .select(`
        id,
        workspace_id,
        email,
        role,
        personal_message,
        expires_at,
        status,
        created_at,
        invited_by
      `)
      .eq('invitation_token', token)
      .single()

    if (error || !invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      )
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      )
    }

    // Check if already accepted
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Invitation has already been processed' },
        { status: 400 }
      )
    }

    // Get workspace info
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('company_name, primary_products')
      .eq('id', invitation.workspace_id)
      .single()

    // Get inviter info
    const { data: inviter } = await supabase.auth.admin.getUserById(invitation.invited_by)

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        message: invitation.personal_message,
        expiresAt: invitation.expires_at,
        workspace: {
          name: workspace?.company_name,
          products: workspace?.primary_products
        },
        inviter: {
          email: inviter.user?.email,
          name: inviter.user?.user_metadata?.full_name || inviter.user?.email?.split('@')[0]
        }
      }
    })

  } catch (error) {
    await logger.error('Failed to get invitation details', {
      errorMessage: (error as Error).message
    }, error as Error)

    return NextResponse.json(
      { error: 'Failed to get invitation details' },
      { status: 500 }
    )
  }
}