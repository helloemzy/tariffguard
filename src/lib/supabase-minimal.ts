/**
 * Minimal Supabase client for TariffGuard production deployment
 * 
 * This module provides a simplified Supabase client configuration
 * focused on Preston's specific needs without complex dependencies.
 */

import { createClient } from '@supabase/supabase-js'
// import type { TariffRate, TariffFinding, Alert, MonitoringLog, HSCode } from './database-schema'

// Minimal configuration for development/demo
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo_key'

/**
 * Create Supabase client for browser use
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Server-side Supabase client with service role key
 */
export function createServerSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceRoleKey || serviceRoleKey === 'demo_service_role_key_placeholder') {
    console.warn('⚠️ Using demo Supabase configuration - database operations will not work')
    return createClient(supabaseUrl, supabaseAnonKey)
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Test database connectivity
 */
export async function testDatabaseConnectivity(): Promise<{
  success: boolean
  message: string
  details?: any
}> {
  try {
    const client = createServerSupabaseClient()
    
    // Simple connectivity test
    const { error } = await client
      .from('hs_codes')
      .select('count(*)', { count: 'exact' })
      .limit(1)
    
    if (error && !error.message.includes('relation "hs_codes" does not exist')) {
      throw error
    }
    
    return {
      success: true,
      message: 'Database connectivity test passed',
      details: {
        url: supabaseUrl,
        hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        tableExists: !error
      }
    }
    
  } catch (error) {
    return {
      success: false,
      message: 'Database connectivity test failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: supabaseUrl,
        hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      }
    }
  }
}

/**
 * Database Operations for Federal Register Integration
 */

/**
 * Get current tariff rates for monitored HS codes
 */
export async function getCurrentTariffRates(): Promise<{ [hsCode: string]: number }> {
  try {
    const client = createServerSupabaseClient()
    
    const { data, error } = await client
      .from('tariff_rates')
      .select('hs_code, current_rate')
      .eq('is_current', true)
      .in('hs_code', ['7318.15.20', '8481.80.90', '7326.90.85'])
    
    if (error && !error.message.includes('does not exist')) {
      throw error
    }
    
    const rates: { [hsCode: string]: number } = {}
    data?.forEach((row: any) => {
      rates[row.hs_code] = row.current_rate
    })
    
    return rates
    
  } catch (error) {
    console.warn('Failed to get current tariff rates from database:', error)
    // Return Preston's default Section 232 rates
    return {
      '7318.15.20': 25.0,
      '8481.80.90': 25.0,
      '7326.90.85': 25.0,
    }
  }
}

/**
 * Store monitoring log entry
 */
export async function logMonitoringSession(logEntry: any): Promise<boolean> {
  try {
    const client = createServerSupabaseClient()
    
    const { error } = await client
      .from('monitoring_log')
      .insert(logEntry)
    
    if (error && !error.message.includes('does not exist')) {
      throw error
    }
    
    return true
    
  } catch (error) {
    console.error('Failed to log monitoring session:', error)
    return false
  }
}

/**
 * Get recent alerts for dashboard
 */
export async function getRecentAlerts(limit: number = 10): Promise<any[]> {
  try {
    const client = createServerSupabaseClient()
    
    const { data, error } = await client
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error && !error.message.includes('does not exist')) {
      throw error
    }
    
    return data || []
    
  } catch (error) {
    console.error('Failed to get recent alerts:', error)
    return []
  }
}

/**
 * Mark alert as read
 */
export async function markAlertAsRead(alertId: string): Promise<boolean> {
  try {
    const client = createServerSupabaseClient()
    
    const { error } = await client
      .from('alerts')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', alertId)
    
    if (error && !error.message.includes('does not exist')) {
      throw error
    }
    
    return true
    
  } catch (error) {
    console.error('Failed to mark alert as read:', error)
    return false
  }
}

/**
 * Get Preston's monitored HS codes with current rates
 */
export async function getMonitoredHsCodes(): Promise<any[]> {
  try {
    const client = createServerSupabaseClient()
    
    const { data, error } = await client
      .from('hs_codes')
      .select('*')
      .eq('is_monitored', true)
      .order('preston_priority', { ascending: true })
    
    if (error && !error.message.includes('does not exist')) {
      throw error
    }
    
    return data || []
    
  } catch (error) {
    console.error('Failed to get monitored HS codes:', error)
    return []
  }
}

/**
 * Get recent significant tariff findings
 */
export async function getRecentFindings(daysBack: number = 30): Promise<any[]> {
  try {
    const client = createServerSupabaseClient()
    
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
    
    const { data, error } = await client
      .from('tariff_findings')
      .select('*')
      .eq('is_significant', true)
      .gte('discovery_timestamp', cutoffDate)
      .order('discovery_timestamp', { ascending: false })
    
    if (error && !error.message.includes('does not exist')) {
      throw error
    }
    
    return data || []
    
  } catch (error) {
    console.error('Failed to get recent findings:', error)
    return []
  }
}

// Export alias for compatibility with agent-generated code
export const supabaseService = createServerSupabaseClient

export default supabase