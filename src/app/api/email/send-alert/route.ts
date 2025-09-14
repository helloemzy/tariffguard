/**
 * Email Alert Sending API Endpoint
 * Triggered when tariff alerts need to be sent via email
 */

import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { emailService } from '@/lib/email'
import type { Alert, Workspace, UserPreferences } from '@/lib/supabase'

interface EmailAlertRequest {
  alertId: string
  workspaceId: string
}

export async function POST(request: Request) {
  try {
    const { alertId, workspaceId }: EmailAlertRequest = await request.json()

    if (!alertId || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameters: alertId and workspaceId' },
        { status: 400 }
      )
    }

    const supabase = createServiceSupabaseClient()

    // Get alert details
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .select('*')
      .eq('id', alertId)
      .eq('workspace_id', workspaceId)
      .single()

    if (alertError || !alert) {
      console.error('Alert not found:', alertError)
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      )
    }

    // Get workspace details
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      console.error('Workspace not found:', workspaceError)
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // Get user details and preferences  
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById((workspace as Workspace).user_id)

    if (userError || !user) {
      console.error('User not found:', userError)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get user preferences to check if email alerts are enabled
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Skip sending email if user has disabled email alerts
    if (preferences && !(preferences as UserPreferences).email_alerts) {
      console.log(`Email alerts disabled for user ${user.id}, skipping email`)
      return NextResponse.json({
        success: true,
        message: 'Email alerts disabled for user'
      })
    }

    // Send email alert
    const emailSent = await emailService.sendTariffAlert({
      alert: alert as Alert,
      workspace: workspace as Workspace,
      userEmail: user.email!,
      userName: user.user_metadata?.full_name || user.email!.split('@')[0]
    })

    if (emailSent) {
      // Log successful email send (optional: track in database)
      console.log(`Email alert sent successfully for alert ${alertId}`)
      
      return NextResponse.json({
        success: true,
        message: 'Email alert sent successfully'
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to send email alert' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Email alert API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  try {
    const isConnected = await emailService.testConnection()
    
    return NextResponse.json({
      status: 'Email service status',
      connected: isConnected,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Email service health check failed' },
      { status: 500 }
    )
  }
}