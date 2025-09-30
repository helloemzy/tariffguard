export const dynamic = 'force-dynamic'
/**
 * Get Subscription Status API
 * Returns current subscription information and usage statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SUBSCRIPTION_PLANS } from '@/lib/stripe'

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

    // Get subscription info
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    if (subError && subError.code !== 'PGRST116') { // Not found error
      console.error('❌ Error fetching subscription:', subError)
      return NextResponse.json(
        { error: 'Failed to fetch subscription' },
        { status: 500 }
      )
    }

    // If no subscription exists, create a free one
    if (!subscription) {
      const { error: createError } = await supabase
        .from('subscriptions')
        .insert({
          workspace_id: workspaceId,
          plan: 'FREE',
          status: 'active'
        })

      if (createError) {
        console.error('❌ Error creating free subscription:', createError)
        return NextResponse.json(
          { error: 'Failed to create subscription' },
          { status: 500 }
        )
      }

      const planConfig = SUBSCRIPTION_PLANS.FREE
      return NextResponse.json({
        success: true,
        subscription: {
          plan: 'FREE',
          status: 'active',
          currentPeriodEnd: null,
          planConfig,
        },
        usage: {
          currentMonth: 0,
          limit: planConfig.calculationsPerMonth,
          canMakeCalculation: true,
        }
      })
    }

    // Get current month usage
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('calculations_count')
      .eq('workspace_id', workspaceId)
      .eq('month_year', currentMonth)
      .single()

    const currentUsage = usage?.calculations_count || 0
    const planConfig = SUBSCRIPTION_PLANS[subscription.plan as keyof typeof SUBSCRIPTION_PLANS]
    
    // Check if can make calculation
    const canMakeCalculation = planConfig.calculationsPerMonth === -1 || 
                              currentUsage < planConfig.calculationsPerMonth

    return NextResponse.json({
      success: true,
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end,
        stripeCustomerId: subscription.stripe_customer_id,
        planConfig,
      },
      usage: {
        currentMonth: currentUsage,
        limit: planConfig.calculationsPerMonth,
        canMakeCalculation,
      }
    })

  } catch (error) {
    console.error('❌ Failed to get subscription status:', error)
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    )
  }
}