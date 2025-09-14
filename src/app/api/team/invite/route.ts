/**
 * Team Invitations API
 * Handles sending team invitations and managing invitation flow
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { emailService } from '@/lib/email'
import crypto from 'crypto'

// Send team invitation
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()

  try {
    const { email, role, workspaceId, inviterName, workspaceName } = await request.json()

    if (!email || !role || !workspaceId || !inviterName || !workspaceName) {
      return NextResponse.json(
        { error: 'Missing required fields: email, role, workspaceId, inviterName, workspaceName' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['admin', 'manager', 'calculator', 'viewer'] // Can't invite owners
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: ' + validRoles.join(', ') },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    // Check if user is already a member by looking up their email
    const { data: existingUser } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existingUser) {
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', existingUser.id)
        .single()

      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a member of this workspace' },
          { status: 400 }
        )
      }
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation } = await supabase
      .from('team_invitations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('email', email.toLowerCase())
      .gt('expires_at', new Date().toISOString())
      .single()

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'There is already a pending invitation for this email' },
        { status: 400 }
      )
    }

    // Get current user (inviter)
    const { searchParams } = new URL(request.url)
    const inviterUserId = searchParams.get('inviterUserId')
    
    if (!inviterUserId) {
      return NextResponse.json(
        { error: 'Missing inviter information' },
        { status: 400 }
      )
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex')

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from('team_invitations')
      .insert({
        workspace_id: workspaceId,
        email: email.toLowerCase(),
        role,
        token,
        invited_by: inviterUserId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select()
      .single()

    if (inviteError) {
      console.error('❌ Error creating invitation:', inviteError)
      return NextResponse.json(
        { error: 'Failed to create invitation' },
        { status: 500 }
      )
    }

    // Send invitation email
    try {
      const inviteUrl = `${request.nextUrl.origin}/team/join?token=${token}`
      
      await emailService.sendTeamInvitation({
        email,
        inviterName,
        workspaceName,
        role,
        inviteUrl,
        expiresAt: invitation.expires_at
      })

      console.log(`✅ Sent team invitation to ${email} for workspace ${workspaceName}`)
    } catch (emailError) {
      console.error('❌ Failed to send invitation email:', emailError)
      // Don't fail the request if email fails, but log it
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at
      }
    })

  } catch (error) {
    console.error('❌ Failed to send team invitation:', error)
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    )
  }
}

// Get pending invitations for a workspace
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()

  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameter: workspaceId' },
        { status: 400 }
      )
    }

    // Get pending invitations
    const { data: invitations, error } = await supabase
      .from('team_invitations')
      .select(`
        id,
        email,
        role,
        expires_at,
        created_at,
        invited_by
      `)
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching invitations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      )
    }

    // Format the response with inviter lookup
    const formattedInvitations = await Promise.all(
      invitations?.map(async invitation => {
        // Get inviter name
        const { data: inviter } = await supabase
          .from('auth.users')
          .select('email, user_metadata')
          .eq('id', invitation.invited_by)
          .single()

        return {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expires_at,
          createdAt: invitation.created_at,
          inviterName: inviter?.user_metadata?.full_name || 
                       inviter?.email?.split('@')[0] || 'Unknown'
        }
      }) || []
    )

    return NextResponse.json({
      success: true,
      invitations: formattedInvitations
    })

  } catch (error) {
    console.error('❌ Failed to fetch invitations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}

// Cancel invitation
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabaseClient()

  try {
    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('invitationId')

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Missing required parameter: invitationId' },
        { status: 400 }
      )
    }

    // Delete the invitation
    const { error } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', invitationId)

    if (error) {
      console.error('❌ Error canceling invitation:', error)
      return NextResponse.json(
        { error: 'Failed to cancel invitation' },
        { status: 500 }
      )
    }

    console.log(`✅ Canceled invitation ${invitationId}`)

    return NextResponse.json({
      success: true,
      message: 'Invitation canceled successfully'
    })

  } catch (error) {
    console.error('❌ Failed to cancel invitation:', error)
    return NextResponse.json(
      { error: 'Failed to cancel invitation' },
      { status: 500 }
    )
  }
}