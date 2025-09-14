/**
 * Stripe Webhook Handler
 * Processes subscription events and updates database accordingly
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    console.log(`🔄 Processing Stripe event: ${event.type}`)

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`)
    }

    // Log the event
    await logBillingEvent(event)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('❌ Webhook processing failed:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  try {
    const customerId = subscription.customer as string
    const workspaceId = subscription.metadata.workspace_id
    
    if (!workspaceId) {
      console.error('❌ No workspace_id in subscription metadata')
      return
    }

    // Determine plan from price ID
    const priceId = subscription.items.data[0]?.price.id
    let plan: 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE' = 'FREE'
    
    if (priceId === process.env.STRIPE_PROFESSIONAL_PRICE_ID) {
      plan = 'PROFESSIONAL'
    } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
      plan = 'ENTERPRISE'
    }

    // Update subscription in database
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        workspace_id: workspaceId,
        plan,
        status: subscription.status as any,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        current_period_start: (subscription as any).current_period_start ? new Date((subscription as any).current_period_start * 1000).toISOString() : null,
        current_period_end: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000).toISOString() : null,
      })

    if (error) {
      console.error('❌ Failed to update subscription in database:', error)
    } else {
      console.log(`✅ Updated subscription for workspace ${workspaceId}: ${plan} (${subscription.status})`)
    }
  } catch (error) {
    console.error('❌ Error handling subscription change:', error)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const workspaceId = subscription.metadata.workspace_id
    
    if (!workspaceId) {
      console.error('❌ No workspace_id in subscription metadata')
      return
    }

    // Downgrade to free plan
    const { error } = await supabase
      .from('subscriptions')
      .upsert({
        workspace_id: workspaceId,
        plan: 'FREE',
        status: 'active',
        stripe_customer_id: null,
        stripe_subscription_id: null,
        current_period_start: null,
        current_period_end: null,
      })

    if (error) {
      console.error('❌ Failed to downgrade subscription:', error)
    } else {
      console.log(`✅ Downgraded workspace ${workspaceId} to FREE plan`)
    }
  } catch (error) {
    console.error('❌ Error handling subscription deletion:', error)
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string
    
    // Get workspace from customer
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
    const workspaceId = customer.metadata?.workspace_id
    
    if (!workspaceId) {
      console.error('❌ No workspace_id in customer metadata')
      return
    }

    console.log(`✅ Payment succeeded for workspace ${workspaceId}: $${(invoice.amount_paid / 100).toFixed(2)}`)
    
    // Optionally send success email or update billing status
  } catch (error) {
    console.error('❌ Error handling payment success:', error)
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  try {
    const customerId = invoice.customer as string
    
    // Get workspace from customer
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer
    const workspaceId = customer.metadata?.workspace_id
    
    if (!workspaceId) {
      console.error('❌ No workspace_id in customer metadata')
      return
    }

    console.log(`❌ Payment failed for workspace ${workspaceId}: $${(invoice.amount_due / 100).toFixed(2)}`)
    
    // Optionally send failure email or update subscription status
  } catch (error) {
    console.error('❌ Error handling payment failure:', error)
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const workspaceId = session.metadata?.workspace_id
    
    if (!workspaceId) {
      console.error('❌ No workspace_id in checkout session metadata')
      return
    }

    console.log(`✅ Checkout completed for workspace ${workspaceId}`)
    
    // The subscription.created event will handle the actual subscription update
    // This is mainly for logging and potential welcome emails
  } catch (error) {
    console.error('❌ Error handling checkout completion:', error)
  }
}

async function logBillingEvent(event: Stripe.Event) {
  try {
    let workspaceId: string | null = null
    let amountCents: number | null = null
    let currency: string = 'usd'

    // Extract workspace ID and amount based on event type
    switch (event.type) {
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        const invoice = event.data.object as Stripe.Invoice
        const customer = await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer
        workspaceId = customer.metadata?.workspace_id || null
        amountCents = invoice.amount_paid || invoice.amount_due
        currency = invoice.currency
        break

      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        workspaceId = session.metadata?.workspace_id || null
        amountCents = session.amount_total
        currency = session.currency || 'usd'
        break
    }

    if (!workspaceId) return

    await supabase
      .from('billing_events')
      .insert({
        workspace_id: workspaceId,
        stripe_event_id: event.id,
        event_type: event.type,
        amount_cents: amountCents,
        currency,
        status: 'processed',
        metadata: event.data.object,
      })

    console.log(`✅ Logged billing event: ${event.type} for workspace ${workspaceId}`)
  } catch (error) {
    console.error('❌ Failed to log billing event:', error)
  }
}