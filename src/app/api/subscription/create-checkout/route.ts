/**
 * Create Stripe Checkout Session API
 * Handles subscription upgrade requests
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createCheckoutSession, createStripeCustomer, SUBSCRIPTION_PLANS } from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { plan, workspaceId } = await request.json()

    if (!plan || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields: plan, workspaceId' },
        { status: 400 }
      )
    }

    if (!['PROFESSIONAL', 'ENTERPRISE'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be PROFESSIONAL or ENTERPRISE' },
        { status: 400 }
      )
    }

    // Get workspace and user info
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*, user_id')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    // Get user info
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(workspace.user_id)

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get or create Stripe customer
    let customerId = workspace.stripe_customer_id

    if (!customerId) {
      customerId = await createStripeCustomer(
        user.email!,
        workspaceId,
        workspace.company_name
      )

      // Update workspace with customer ID
      await supabase
        .from('workspaces')
        .update({ stripe_customer_id: customerId })
        .eq('id', workspaceId)
    }

    // Create checkout session
    const planConfig = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]
    const checkoutUrl = await createCheckoutSession(
      customerId,
      planConfig.priceId,
      workspaceId,
      `${request.nextUrl.origin}/dashboard?upgrade=success&plan=${plan}`,
      `${request.nextUrl.origin}/dashboard?upgrade=cancelled`
    )

    return NextResponse.json({ 
      success: true, 
      checkoutUrl,
      plan: planConfig.name,
      price: planConfig.price
    })

  } catch (error) {
    console.error('❌ Failed to create checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}