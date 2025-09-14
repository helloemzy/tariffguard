/**
 * Create Stripe Billing Portal Session API
 * Allows customers to manage their billing, view invoices, and cancel subscriptions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createBillingPortalSession } from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await request.json()

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Missing required field: workspaceId' },
        { status: 400 }
      )
    }

    // Get workspace info
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('stripe_customer_id')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    if (!workspace.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Please subscribe to a plan first.' },
        { status: 400 }
      )
    }

    // Create billing portal session
    const portalUrl = await createBillingPortalSession(
      workspace.stripe_customer_id,
      `${request.nextUrl.origin}/dashboard/billing`
    )

    return NextResponse.json({ 
      success: true, 
      portalUrl 
    })

  } catch (error) {
    console.error('❌ Failed to create billing portal session:', error)
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    )
  }
}