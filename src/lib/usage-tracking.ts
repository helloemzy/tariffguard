/**
 * Usage Tracking and Enforcement
 * Handles calculation limits and usage counting for subscription tiers
 */

import { createClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_PLANS, canMakeCalculation as checkPlanLimits } from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface UsageInfo {
  canMakeCalculation: boolean
  currentUsage: number
  limit: number
  plan: string
  reason?: string
}

/**
 * Check if workspace can make a calculation based on their subscription plan
 */
export async function checkCalculationLimit(workspaceId: string): Promise<UsageInfo> {
  try {
    // Get workspace subscription info
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('subscription_plan, subscription_status')
      .eq('id', workspaceId)
      .single()

    if (workspaceError || !workspace) {
      return {
        canMakeCalculation: false,
        currentUsage: 0,
        limit: 0,
        plan: 'FREE',
        reason: 'Workspace not found'
      }
    }

    // Check if subscription is active
    if (workspace.subscription_status !== 'active') {
      return {
        canMakeCalculation: false,
        currentUsage: 0,
        limit: 0,
        plan: workspace.subscription_plan,
        reason: 'Subscription is not active'
      }
    }

    const plan = workspace.subscription_plan as keyof typeof SUBSCRIPTION_PLANS
    const planConfig = SUBSCRIPTION_PLANS[plan]

    // Get current month usage
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
    
    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('calculations_count')
      .eq('workspace_id', workspaceId)
      .eq('month_year', currentMonth)
      .single()

    const currentUsage = usage?.calculations_count || 0
    const limit = planConfig.calculationsPerMonth
    
    // Check limits
    const canMake = checkPlanLimits(plan, currentUsage)
    
    return {
      canMakeCalculation: canMake,
      currentUsage,
      limit: limit === -1 ? Infinity : limit,
      plan,
      reason: canMake ? undefined : 'Monthly calculation limit reached'
    }

  } catch (error) {
    console.error('❌ Error checking calculation limit:', error)
    return {
      canMakeCalculation: false,
      currentUsage: 0,
      limit: 0,
      plan: 'FREE',
      reason: 'Error checking limits'
    }
  }
}

/**
 * Increment calculation usage for workspace
 */
export async function incrementCalculationUsage(workspaceId: string): Promise<boolean> {
  try {
    // Use the database function to increment usage
    const { error } = await supabase.rpc('increment_calculation_usage', {
      workspace_uuid: workspaceId
    })

    if (error) {
      console.error('❌ Error incrementing calculation usage:', error)
      return false
    }

    console.log(`✅ Incremented calculation usage for workspace ${workspaceId}`)
    return true
  } catch (error) {
    console.error('❌ Error incrementing calculation usage:', error)
    return false
  }
}

/**
 * Get usage statistics for workspace
 */
export async function getUsageStatistics(workspaceId: string, months = 6) {
  try {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    const { data: usageData, error } = await supabase
      .from('usage_tracking')
      .select('month_year, calculations_count, ocr_processing_count, email_alerts_sent')
      .eq('workspace_id', workspaceId)
      .gte('month_year', startDate.toISOString().slice(0, 7))
      .lte('month_year', endDate.toISOString().slice(0, 7))
      .order('month_year', { ascending: true })

    if (error) {
      console.error('❌ Error fetching usage statistics:', error)
      return []
    }

    return usageData || []
  } catch (error) {
    console.error('❌ Error getting usage statistics:', error)
    return []
  }
}

/**
 * Get billing history for workspace
 */
export async function getBillingHistory(workspaceId: string, limit = 10) {
  try {
    const { data: billingData, error } = await supabase
      .from('billing_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('processed_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('❌ Error fetching billing history:', error)
      return []
    }

    return billingData || []
  } catch (error) {
    console.error('❌ Error getting billing history:', error)
    return []
  }
}

/**
 * Middleware function to check usage before calculation
 */
export async function enforceUsageLimit(workspaceId: string) {
  const usageInfo = await checkCalculationLimit(workspaceId)
  
  if (!usageInfo.canMakeCalculation) {
    throw new Error(usageInfo.reason || 'Usage limit exceeded')
  }
  
  return usageInfo
}

/**
 * Get plan upgrade suggestions based on usage
 */
export async function getUpgradeSuggestions(workspaceId: string) {
  try {
    const usageInfo = await checkCalculationLimit(workspaceId)
    
    // If usage is approaching limit, suggest upgrade
    const usagePercentage = usageInfo.limit === Infinity ? 0 : 
                           (usageInfo.currentUsage / usageInfo.limit) * 100

    if (usagePercentage > 80) {
      const currentPlan = usageInfo.plan as keyof typeof SUBSCRIPTION_PLANS
      
      if (currentPlan === 'FREE') {
        return {
          shouldUpgrade: true,
          suggestedPlan: 'PROFESSIONAL',
          reason: 'You\'re approaching your monthly calculation limit',
          currentUsage: usageInfo.currentUsage,
          currentLimit: usageInfo.limit
        }
      } else if (currentPlan === 'PROFESSIONAL') {
        return {
          shouldUpgrade: true,
          suggestedPlan: 'ENTERPRISE',
          reason: 'Consider upgrading for unlimited calculations',
          currentUsage: usageInfo.currentUsage,
          currentLimit: usageInfo.limit
        }
      }
    }

    return {
      shouldUpgrade: false,
      currentUsage: usageInfo.currentUsage,
      currentLimit: usageInfo.limit
    }
  } catch (error) {
    console.error('❌ Error getting upgrade suggestions:', error)
    return { shouldUpgrade: false, currentUsage: 0, currentLimit: 0 }
  }
}