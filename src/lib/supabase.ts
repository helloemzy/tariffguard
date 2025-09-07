/**
 * Enhanced Supabase Client for TariffGuard SaaS
 * 
 * Provides authentication, database operations, and real-time subscriptions
 * for the multi-tenant TariffGuard platform.
 */

import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Database types
export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          user_id: string
          company_name: string
          products: string | null
          route_from: string | null
          route_to: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_name: string
          products?: string | null
          route_from?: string | null
          route_to?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_name?: string
          products?: string | null
          route_from?: string | null
          route_to?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      calculations: {
        Row: {
          id: string
          workspace_id: string
          name: string
          line_items: any[]
          total_value: number
          total_duty: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name?: string
          line_items: any[]
          total_value: number
          total_duty: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          line_items?: any[]
          total_value?: number
          total_duty?: number
          created_at?: string
          updated_at?: string
        }
      }
      tariff_rates: {
        Row: {
          hs_code: string
          description: string | null
          current_rate: number | null
          general_rate: string | null
          special_rate: string | null
          previous_rate: number | null
          source: string | null
          last_verified: string | null
          effective_date: string | null
          is_current: boolean | null
          last_updated: string | null
          request_id: string | null
        }
        Insert: {
          hs_code: string
          description?: string | null
          current_rate?: number | null
          general_rate?: string | null
          special_rate?: string | null
          previous_rate?: number | null
          source?: string | null
          last_verified?: string | null
          effective_date?: string | null
          is_current?: boolean | null
          last_updated?: string | null
          request_id?: string | null
        }
        Update: {
          hs_code?: string
          description?: string | null
          current_rate?: number | null
          general_rate?: string | null
          special_rate?: string | null
          previous_rate?: number | null
          source?: string | null
          last_verified?: string | null
          effective_date?: string | null
          is_current?: boolean | null
          last_updated?: string | null
          request_id?: string | null
        }
      }
      alerts: {
        Row: {
          id: string
          workspace_id: string
          hs_code: string
          old_rate: number | null
          new_rate: number
          message: string | null
          is_read: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          hs_code: string
          old_rate?: number | null
          new_rate: number
          message?: string | null
          is_read?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          hs_code?: string
          old_rate?: number | null
          new_rate?: number
          message?: string | null
          is_read?: boolean | null
          created_at?: string
        }
      }
      user_preferences: {
        Row: {
          user_id: string
          email_alerts: boolean | null
          push_notifications: boolean | null
          alert_threshold: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email_alerts?: boolean | null
          push_notifications?: boolean | null
          alert_threshold?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          email_alerts?: boolean | null
          push_notifications?: boolean | null
          alert_threshold?: number | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// Client-side Supabase client
export const createClientSupabaseClient = () => {
  return createClientComponentClient<Database>()
}

// Server-side Supabase client
export const createServerSupabaseClient = () => {
  return createServerComponentClient<Database>({
    cookies: () => cookies()
  })
}

// Service role client (for admin operations)
export const createServiceSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Helper functions for common operations
export const supabaseHelpers = {
  /**
   * Get or create workspace for user
   */
  async getOrCreateWorkspace(userId: string, companyName: string) {
    const supabase = createServiceSupabaseClient()
    
    // Check if workspace exists
    const { data: existing } = await supabase
      .from('workspaces')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (existing) {
      return existing
    }
    
    // Create new workspace
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .insert({
        user_id: userId,
        company_name: companyName
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return workspace
  },

  /**
   * Get tariff rate with caching
   */
  async getTariffRate(hsCode: string) {
    const supabase = createServiceSupabaseClient()
    
    const { data, error } = await supabase
      .from('tariff_rates')
      .select('*')
      .eq('hs_code', hsCode)
      .single()
    
    if (error) {
      console.warn(`No cached rate for HS code ${hsCode}`)
      return null
    }
    
    return data
  },

  /**
   * Save calculation to database
   */
  async saveCalculation(calculation: Database['public']['Tables']['calculations']['Insert']) {
    const supabase = createServiceSupabaseClient()
    
    const { data, error } = await supabase
      .from('calculations')
      .insert(calculation)
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return data
  },

  /**
   * Create alert for rate change
   */
  async createAlert(alert: Database['public']['Tables']['alerts']['Insert']) {
    const supabase = createServiceSupabaseClient()
    
    const { data, error } = await supabase
      .from('alerts')
      .insert(alert)
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return data
  },

  /**
   * Get unread alerts for workspace
   */
  async getUnreadAlerts(workspaceId: string) {
    const supabase = createServiceSupabaseClient()
    
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw error
    }
    
    return data || []
  }
}

// Export types for use in components
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type Calculation = Database['public']['Tables']['calculations']['Row']
export type TariffRate = Database['public']['Tables']['tariff_rates']['Row']
export type Alert = Database['public']['Tables']['alerts']['Row']
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row']