/**
 * Authentication Callback Handler
 * 
 * Handles OAuth callbacks from Supabase Auth and redirects users
 * to the appropriate page after successful authentication.
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  if (code) {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth callback error:', error)
        return NextResponse.redirect(`${requestUrl.origin}/login?error=${encodeURIComponent(error.message)}`)
      }

      if (data.session) {
        // Check if user has a workspace
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('id')
          .eq('user_id', data.session.user.id)
          .single()

        // If no workspace exists, redirect to setup
        if (!workspace) {
          return NextResponse.redirect(`${requestUrl.origin}/setup`)
        }

        // Otherwise redirect to dashboard or specified next URL
        return NextResponse.redirect(`${requestUrl.origin}${next}`)
      }
    } catch (error) {
      console.error('Unexpected auth error:', error)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=Authentication failed`)
    }
  }

  // No code provided, redirect to login
  return NextResponse.redirect(`${requestUrl.origin}/login`)
}