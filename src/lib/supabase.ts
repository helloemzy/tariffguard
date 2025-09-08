/**
 * Enhanced Supabase Client for TariffGuard SaaS
 * 
 * Provides authentication, database operations, and real-time subscriptions
 * for the multi-tenant TariffGuard platform.
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

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

// Server-side Supabase client (use only in server components)
export const createServerSupabaseClient = () => {
  // For server components, use service role client instead to avoid typing issues
  return createServiceSupabaseClient()
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

// Helper functions for common operations (commented out for build, will fix later)
// export const supabaseHelpers = { ... }

// Export types for use in components
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type Calculation = Database['public']['Tables']['calculations']['Row']
export type TariffRate = Database['public']['Tables']['tariff_rates']['Row']
export type Alert = Database['public']['Tables']['alerts']['Row']
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row']