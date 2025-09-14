/**
 * API Authentication and Rate Limiting Middleware
 * Handles API token validation and rate limiting for public API endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import crypto from 'crypto'

interface ApiContext {
  token: any
  workspace: any
  rateLimitStatus: any
}

export async function withApiAuth(
  request: NextRequest,
  handler: (request: NextRequest, context: ApiContext) => Promise<NextResponse>
): Promise<NextResponse> {
  const supabase = createServerSupabaseClient()
  const startTime = Date.now()

  try {
    // Extract API token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return await logApiUsage(supabase, request, null, null, 401, Date.now() - startTime, 'Missing or invalid authorization header')
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    if (!token.startsWith('tg_')) {
      return await logApiUsage(supabase, request, null, null, 401, Date.now() - startTime, 'Invalid token format')
    }

    // Hash the token for lookup
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    // Find token in database
    const { data: apiToken, error: tokenError } = await supabase
      .from('api_tokens')
      .select(`
        *,
        workspace:workspaces(*)
      `)
      .eq('token_hash', tokenHash)
      .eq('status', 'active')
      .single()

    if (tokenError || !apiToken) {
      return await logApiUsage(supabase, request, null, null, 401, Date.now() - startTime, 'Invalid or inactive token')
    }

    // Check if token has expired
    if (apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
      return await logApiUsage(supabase, request, apiToken.id, apiToken.workspace_id, 401, Date.now() - startTime, 'Token has expired')
    }

    // Check rate limits
    const rateLimitChecks = await Promise.all([
      supabase.rpc('check_rate_limit', { p_token_id: apiToken.id, p_window: 'minute' }),
      supabase.rpc('check_rate_limit', { p_token_id: apiToken.id, p_window: 'hour' }),
      supabase.rpc('check_rate_limit', { p_token_id: apiToken.id, p_window: 'day' })
    ])

    const [minuteLimit, hourLimit, dayLimit] = rateLimitChecks.map(check => check.data)

    // Check if any rate limit is exceeded
    if (!minuteLimit?.allowed || !hourLimit?.allowed || !dayLimit?.allowed) {
      const exceededLimit = !minuteLimit?.allowed ? 'minute' : !hourLimit?.allowed ? 'hour' : 'day'

      return await logApiUsage(
        supabase,
        request,
        apiToken.id,
        apiToken.workspace_id,
        429,
        Date.now() - startTime,
        `Rate limit exceeded for ${exceededLimit} window`,
        {
          'X-RateLimit-Limit-Minute': minuteLimit?.rate_limit?.toString(),
          'X-RateLimit-Remaining-Minute': Math.max(0, (minuteLimit?.rate_limit || 0) - (minuteLimit?.current_usage || 0)).toString(),
          'X-RateLimit-Reset-Minute': new Date(minuteLimit?.reset_at || Date.now()).toISOString(),
          'X-RateLimit-Limit-Hour': hourLimit?.rate_limit?.toString(),
          'X-RateLimit-Remaining-Hour': Math.max(0, (hourLimit?.rate_limit || 0) - (hourLimit?.current_usage || 0)).toString(),
          'X-RateLimit-Reset-Hour': new Date(hourLimit?.reset_at || Date.now()).toISOString(),
          'X-RateLimit-Limit-Day': dayLimit?.rate_limit?.toString(),
          'X-RateLimit-Remaining-Day': Math.max(0, (dayLimit?.rate_limit || 0) - (dayLimit?.current_usage || 0)).toString(),
          'X-RateLimit-Reset-Day': new Date(dayLimit?.reset_at || Date.now()).toISOString()
        }
      )
    }

    // Check API scope permissions
    const endpoint = getEndpointFromRequest(request)
    const requiredScope = getRequiredScope(endpoint, request.method)

    if (requiredScope && !apiToken.scopes.includes(requiredScope)) {
      return await logApiUsage(
        supabase,
        request,
        apiToken.id,
        apiToken.workspace_id,
        403,
        Date.now() - startTime,
        `Insufficient permissions. Required scope: ${requiredScope}`
      )
    }

    // Create context for the handler
    const context: ApiContext = {
      token: apiToken,
      workspace: apiToken.workspace,
      rateLimitStatus: {
        minute: minuteLimit,
        hour: hourLimit,
        day: dayLimit
      }
    }

    // Call the actual handler
    const response = await handler(request, context)

    // Log successful API usage
    const responseTime = Date.now() - startTime
    await logApiUsage(
      supabase,
      request,
      apiToken.id,
      apiToken.workspace_id,
      response.status,
      responseTime
    )

    // Add rate limit headers to response
    response.headers.set('X-RateLimit-Limit-Minute', minuteLimit?.rate_limit?.toString() || '0')
    response.headers.set('X-RateLimit-Remaining-Minute', Math.max(0, (minuteLimit?.rate_limit || 0) - (minuteLimit?.current_usage || 0) - 1).toString())
    response.headers.set('X-RateLimit-Reset-Minute', new Date(minuteLimit?.reset_at || Date.now()).toISOString())

    response.headers.set('X-RateLimit-Limit-Hour', hourLimit?.rate_limit?.toString() || '0')
    response.headers.set('X-RateLimit-Remaining-Hour', Math.max(0, (hourLimit?.rate_limit || 0) - (hourLimit?.current_usage || 0) - 1).toString())
    response.headers.set('X-RateLimit-Reset-Hour', new Date(hourLimit?.reset_at || Date.now()).toISOString())

    return response

  } catch (error) {
    console.error('API middleware error:', error)
    return await logApiUsage(supabase, request, null, null, 500, Date.now() - startTime, 'Internal server error')
  }
}

// Helper function to log API usage
async function logApiUsage(
  supabase: any,
  request: NextRequest,
  tokenId: string | null,
  workspaceId: string | null,
  statusCode: number,
  responseTime: number,
  errorMessage?: string,
  extraHeaders?: Record<string, string>
): Promise<NextResponse> {
  try {
    if (tokenId && workspaceId) {
      await supabase.rpc('log_api_usage', {
        p_workspace_id: workspaceId,
        p_token_id: tokenId,
        p_endpoint: getEndpointFromRequest(request),
        p_method: request.method,
        p_status_code: statusCode,
        p_response_time_ms: responseTime,
        p_ip_address: getClientIP(request),
        p_user_agent: request.headers.get('user-agent'),
        p_error_message: errorMessage
      })
    }
  } catch (logError) {
    console.error('Failed to log API usage:', logError)
  }

  // Create error response
  const errorResponse = {
    error: getErrorMessage(statusCode, errorMessage),
    statusCode,
    timestamp: new Date().toISOString()
  }

  const response = NextResponse.json(errorResponse, { status: statusCode })

  // Add extra headers if provided (for rate limiting)
  if (extraHeaders) {
    Object.entries(extraHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  return response
}

// Helper function to extract endpoint from request
function getEndpointFromRequest(request: NextRequest): string {
  const url = new URL(request.url)
  return url.pathname.replace('/api/v1', '') // Remove API version prefix if present
}

// Helper function to get required scope for endpoint
function getRequiredScope(endpoint: string, method: string): string | null {
  const scopeMap: Record<string, Record<string, string>> = {
    '/calculations': {
      'GET': 'calculations.read',
      'POST': 'calculations.create',
      'PUT': 'calculations.update',
      'PATCH': 'calculations.update',
      'DELETE': 'calculations.delete'
    },
    '/rates': {
      'GET': 'rates.read'
    },
    '/alerts': {
      'GET': 'alerts.read'
    },
    '/analytics': {
      'GET': 'analytics.read'
    },
    '/team': {
      'GET': 'team.read'
    },
    '/webhooks': {
      'POST': 'webhooks.create',
      'PUT': 'webhooks.create',
      'DELETE': 'webhooks.create'
    }
  }

  // Find matching endpoint pattern
  for (const [pattern, methods] of Object.entries(scopeMap)) {
    if (endpoint.startsWith(pattern)) {
      return methods[method] || null
    }
  }

  return null
}

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }

  if (realIP) {
    return realIP
  }

  return 'unknown'
}

// Helper function to get appropriate error message
function getErrorMessage(statusCode: number, errorMessage?: string): string {
  const defaultMessages: Record<number, string> = {
    401: 'Unauthorized - Invalid or missing API token',
    403: 'Forbidden - Insufficient permissions',
    429: 'Too Many Requests - Rate limit exceeded',
    500: 'Internal Server Error'
  }

  return errorMessage || defaultMessages[statusCode] || 'Unknown error'
}

// Scope validation helper
export function requireScope(requiredScope: string) {
  return (context: ApiContext) => {
    if (!context.token.scopes.includes(requiredScope)) {
      throw new Error(`Insufficient permissions. Required scope: ${requiredScope}`)
    }
  }
}