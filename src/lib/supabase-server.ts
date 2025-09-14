/**
 * Server-side Supabase client utility
 * Safe for build-time and runtime usage
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Create Supabase client safely for server-side API routes
 * Only initializes when actually called, preventing build-time errors
 */
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!supabaseKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

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
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
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
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      }
    }
  }
}