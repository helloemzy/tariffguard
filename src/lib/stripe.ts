/**
 * Stripe Payment Service for TariffGuard
 * Handles subscription management, billing, and payment processing
 */

import Stripe from 'stripe'
import { loadStripe } from '@stripe/stripe-js'

// Server-side Stripe instance (lazy initialized)
let _stripeInstance: Stripe | null = null

export function getStripeClient(): Stripe {
  if (!_stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required')
    }

    _stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
    })
  }

  return _stripeInstance
}

// Legacy export for backward compatibility (creates client on-demand)
export const stripe = new Proxy({} as Stripe, {
  get: (_target, prop) => {
    const client = getStripeClient()
    return client[prop as keyof Stripe]
  }
})

// Client-side Stripe instance
export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// Subscription Plans Configuration
export const SUBSCRIPTION_PLANS = {
  FREE: {
    name: 'Free',
    priceId: 'price_free', // No Stripe price for free tier
    price: 0,
    calculationsPerMonth: 5,
    features: [
      '5 calculations per month',
      'Basic HS code lookup',
      'Email support',
    ],
  },
  PROFESSIONAL: {
    name: 'Professional',
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID!,
    price: 49,
    calculationsPerMonth: 1000,
    features: [
      '1,000 calculations per month',
      'Unlimited HS codes',
      'Document OCR processing',
      'Email & SMS alerts',
      'Export to CSV/PDF',
      'Priority support',
    ],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
    price: 199,
    calculationsPerMonth: -1, // Unlimited
    features: [
      'Unlimited calculations',
      'Team collaboration',
      'API access',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
    ],
  },
} as const

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS

export interface SubscriptionInfo {
  plan: SubscriptionPlan
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete'
  currentPeriodEnd: Date
  customerId?: string
  subscriptionId?: string
}

/**
 * Create a new customer in Stripe
 */
export async function createStripeCustomer(
  email: string,
  workspaceId: string,
  companyName?: string
): Promise<string> {
  try {
    const customer = await stripe.customers.create({
      email,
      metadata: {
        workspace_id: workspaceId,
        company_name: companyName || '',
      },
    })
    
    console.log(`✅ Created Stripe customer: ${customer.id} for ${email}`)
    return customer.id
  } catch (error) {
    console.error('❌ Failed to create Stripe customer:', error)
    throw new Error('Failed to create customer')
  }
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  workspaceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        workspace_id: workspaceId,
      },
    })
    
    console.log(`✅ Created checkout session: ${session.id}`)
    return session.url!
  } catch (error) {
    console.error('❌ Failed to create checkout session:', error)
    throw new Error('Failed to create checkout session')
  }
}

/**
 * Create a billing portal session
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    
    console.log(`✅ Created billing portal session for customer: ${customerId}`)
    return session.url
  } catch (error) {
    console.error('❌ Failed to create billing portal session:', error)
    throw new Error('Failed to create billing portal session')
  }
}

/**
 * Get subscription information for a customer
 */
export async function getSubscriptionInfo(customerId: string): Promise<SubscriptionInfo | null> {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1,
    })
    
    if (subscriptions.data.length === 0) {
      return {
        plan: 'FREE',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      }
    }
    
    const subscription = subscriptions.data[0]!
    const priceId = subscription.items.data[0]?.price.id
    
    // Determine plan based on price ID
    let plan: SubscriptionPlan = 'FREE'
    if (priceId === SUBSCRIPTION_PLANS.PROFESSIONAL.priceId) {
      plan = 'PROFESSIONAL'
    } else if (priceId === SUBSCRIPTION_PLANS.ENTERPRISE.priceId) {
      plan = 'ENTERPRISE'
    }
    
    return {
      plan,
      status: subscription.status as SubscriptionInfo['status'],
      currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
      customerId,
      subscriptionId: subscription.id,
    }
  } catch (error) {
    console.error('❌ Failed to get subscription info:', error)
    return null
  }
}

/**
 * Cancel a subscription (at period end)
 */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })
    
    console.log(`✅ Subscription ${subscriptionId} will be canceled at period end`)
    return true
  } catch (error) {
    console.error('❌ Failed to cancel subscription:', error)
    return false
  }
}

/**
 * Reactivate a canceled subscription
 */
export async function reactivateSubscription(subscriptionId: string): Promise<boolean> {
  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    })
    
    console.log(`✅ Subscription ${subscriptionId} reactivated`)
    return true
  } catch (error) {
    console.error('❌ Failed to reactivate subscription:', error)
    return false
  }
}

/**
 * Utility function to check if a plan allows a certain number of calculations
 */
export function canMakeCalculation(
  plan: SubscriptionPlan,
  currentMonthCalculations: number
): boolean {
  const planConfig = SUBSCRIPTION_PLANS[plan]
  
  if (planConfig.calculationsPerMonth === -1) {
    return true // Unlimited
  }
  
  return currentMonthCalculations < planConfig.calculationsPerMonth
}

/**
 * Get plan configuration
 */
export function getPlanConfig(plan: SubscriptionPlan) {
  return SUBSCRIPTION_PLANS[plan]
}