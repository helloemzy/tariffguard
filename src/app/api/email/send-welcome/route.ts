/**
 * Welcome Email API Endpoint
 * Triggered when new users complete workspace setup
 */

import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { emailService } from '@/lib/email'
import type { Workspace } from '@/lib/supabase'

interface WelcomeEmailRequest {
  userId: string
  workspaceId: string
}

export async function POST(request: Request) {
  try {
    const { userId, workspaceId }: WelcomeEmailRequest = await request.json()

    if (!userId || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId and workspaceId' },
        { status: 400 }
      )
    }

    const supabase = createServiceSupabaseClient()

    // Get user details
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)

    if (userError || !user) {
      console.error('User not found:', userError)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get workspace details
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('user_id', userId)
      .single()

    if (workspaceError || !workspace) {
      console.error('Workspace not found:', workspaceError)
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // Send welcome email
    const emailSent = await emailService.sendWelcomeEmail(
      user.email!,
      user.user_metadata?.full_name || user.email!.split('@')[0],
      workspace as Workspace
    )

    if (emailSent) {
      console.log(`Welcome email sent successfully to ${user.email}`)
      
      return NextResponse.json({
        success: true,
        message: 'Welcome email sent successfully'
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to send welcome email' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Welcome email API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}