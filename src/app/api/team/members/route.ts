/**
 * Team Members Management API
 * Handles team member operations like listing, adding, updating, and removing members
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Get team members for a workspace
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

    // Get team members
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        role,
        status,
        invited_at,
        joined_at,
        created_at,
        updated_at,
        user_id
      `)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('❌ Error fetching team members:', error)
      return NextResponse.json(
        { error: 'Failed to fetch team members' },
        { status: 500 }
      )
    }

    // Format the response with user lookup
    const formattedMembers = await Promise.all(
      members?.map(async member => {
        // Get user details
        const { data: user } = await supabase
          .from('auth.users')
          .select('id, email, user_metadata')
          .eq('id', member.user_id)
          .single()

        return {
          id: member.id,
          userId: member.user_id,
          role: member.role,
          status: member.status,
          email: user?.email || 'Unknown',
          name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown',
          avatar: user?.user_metadata?.avatar_url,
          invitedAt: member.invited_at,
          joinedAt: member.joined_at,
          createdAt: member.created_at
        }
      }) || []
    )

    return NextResponse.json({
      success: true,
      members: formattedMembers
    })

  } catch (error) {
    console.error('❌ Failed to fetch team members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    )
  }
}

// Update team member role
export async function PATCH(request: NextRequest) {
  try {
    const { memberId, role, workspaceId } = await request.json()

    if (!memberId || !role || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields: memberId, role, workspaceId' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'manager', 'calculator', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: ' + validRoles.join(', ') },
        { status: 400 }
      )
    }

    // Update member role
    const { data: member, error } = await supabase
      .from('workspace_members')
      .update({ 
        role,
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('❌ Error updating member role:', error)
      return NextResponse.json(
        { error: 'Failed to update member role' },
        { status: 500 }
      )
    }

    console.log(`✅ Updated member ${memberId} role to ${role}`)

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        role: member.role,
        updatedAt: member.updated_at
      }
    })

  } catch (error) {
    console.error('❌ Failed to update member role:', error)
    return NextResponse.json(
      { error: 'Failed to update member role' },
      { status: 500 }
    )
  }
}

// Remove team member
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const workspaceId = searchParams.get('workspaceId')

    if (!memberId || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameters: memberId, workspaceId' },
        { status: 400 }
      )
    }

    // Check if this is the last owner
    const { data: owners, error: ownersError } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner')
      .eq('status', 'active')

    if (ownersError) {
      console.error('❌ Error checking owners:', ownersError)
      return NextResponse.json(
        { error: 'Failed to verify ownership' },
        { status: 500 }
      )
    }

    // Get the member being removed
    const { data: memberToRemove, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('id', memberId)
      .single()

    if (memberError || !memberToRemove) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Prevent removing the last owner
    if (memberToRemove.role === 'owner' && owners.length <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last owner. Please transfer ownership first.' },
        { status: 400 }
      )
    }

    // Remove the member
    const { error: deleteError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId)
      .eq('workspace_id', workspaceId)

    if (deleteError) {
      console.error('❌ Error removing member:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      )
    }

    console.log(`✅ Removed member ${memberId} from workspace ${workspaceId}`)

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully'
    })

  } catch (error) {
    console.error('❌ Failed to remove member:', error)
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    )
  }
}