/**
 * Logging Middleware
 * Automatically logs all API requests with timing and error handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger, getRequestContext } from '@/lib/logger'

export interface LoggingConfig {
  excludePaths?: RegExp[]
  includeBody?: boolean
  includeHeaders?: boolean
  logSuccessfulRequests?: boolean
}

const DEFAULT_CONFIG: LoggingConfig = {
  excludePaths: [
    /\/_next\//,
    /\/favicon\.ico/,
    /\/api\/health/,
    /\.png$/,
    /\.jpg$/,
    /\.css$/,
    /\.js$/
  ],
  includeBody: false,
  includeHeaders: false,
  logSuccessfulRequests: true
}

export function withLogging(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: LoggingConfig = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  return async (request: NextRequest): Promise<NextResponse> => {
    const start = performance.now()
    const requestContext = getRequestContext(request)
    const url = new URL(request.url)

    // Check if we should exclude this path
    const shouldExclude = finalConfig.excludePaths?.some(pattern =>
      pattern.test(url.pathname)
    )

    if (shouldExclude) {
      return handler(request)
    }

    // Generate request ID for tracing
    const requestId = crypto.randomUUID()
    requestContext.requestId = requestId

    let response: NextResponse
    let error: Error | null = null

    try {
      // Log incoming request
      await logger.info(`Incoming ${request.method} request`, {
        ...requestContext,
        query: Object.fromEntries(url.searchParams.entries()),
        ...(finalConfig.includeHeaders && {
          headers: Object.fromEntries(request.headers.entries())
        })
      })

      // Execute the handler
      response = await handler(request)

      const duration = Math.round(performance.now() - start)
      const statusCode = response.status

      if (finalConfig.logSuccessfulRequests || statusCode >= 400) {
        if (statusCode >= 500) {
          await logger.error(`Server error on ${request.method} ${url.pathname}`, {
            ...requestContext,
            statusCode,
            duration,
            responseHeaders: Object.fromEntries(response.headers.entries())
          })
        } else if (statusCode >= 400) {
          await logger.warn(`Client error on ${request.method} ${url.pathname}`, {
            ...requestContext,
            statusCode,
            duration
          })
        } else {
          await logger.apiSuccess(url.pathname, request.method, statusCode, duration, requestContext)
        }
      }

      return response

    } catch (err) {
      error = err as Error
      const duration = Math.round(performance.now() - start)

      await logger.apiError(
        url.pathname,
        request.method,
        500,
        error,
        { ...requestContext, duration }
      )

      // Return a generic error response
      return NextResponse.json(
        { error: 'Internal server error', requestId },
        { status: 500 }
      )
    }
  }
}

// Request timing middleware
export function withRequestTiming<T>(
  operation: () => Promise<T>,
  operationName: string,
  context: Record<string, any> = {}
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const start = performance.now()

    try {
      const result = await operation()
      const duration = Math.round(performance.now() - start)

      await logger.performanceEvent(operationName, duration, context)
      resolve(result)
    } catch (error) {
      const duration = Math.round(performance.now() - start)

      await logger.error(`${operationName} failed`, {
        ...context,
        duration,
        errorName: (error as Error).name,
        errorMessage: (error as Error).message
      }, error as Error)

      reject(error)
    }
  })
}

// Rate limiting detection
export async function logRateLimitViolation(
  request: NextRequest,
  limit: number,
  windowMs: number
) {
  const context = getRequestContext(request)

  await logger.securityEvent(
    'Rate limit exceeded',
    'medium',
    {
      ...context,
      limit,
      windowMs,
      details: {
        message: 'Client exceeded API rate limit',
        action: 'Request blocked'
      }
    }
  )
}

// Security event helpers
export async function logSecurityViolation(
  type: 'authentication_failure' | 'authorization_failure' | 'invalid_input' | 'suspicious_activity',
  request: NextRequest,
  details: Record<string, any> = {}
) {
  const context = getRequestContext(request)
  const severity = type === 'suspicious_activity' ? 'high' : 'medium'

  await logger.securityEvent(
    `Security violation: ${type.replace('_', ' ')}`,
    severity,
    {
      ...context,
      violationType: type,
      details
    }
  )
}

// User action logging
export async function logUserAction(
  action: string,
  userId: string,
  workspaceId?: string,
  metadata: Record<string, any> = {}
) {
  await logger.userAction(action, userId, workspaceId, {
    metadata,
    actionType: 'user_initiated'
  })
}

// Business event logging
export async function logBusinessEvent(
  event: string,
  data: Record<string, any> = {}
) {
  await logger.businessEvent(event, {
    eventData: data,
    source: 'application'
  })
}

export default withLogging