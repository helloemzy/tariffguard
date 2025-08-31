/**
 * Minimal middleware for TariffGuard production deployment
 * 
 * Simplified middleware without complex auth dependencies
 * Focus on basic functionality for Preston's use case
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Basic middleware for production deployment
 */
export function middleware(request: NextRequest) {
  try {
    // Basic logging for production monitoring
    const { pathname } = request.nextUrl
    
    // Log API requests for monitoring
    if (pathname.startsWith('/api/')) {
      console.log(`API Request: ${request.method} ${pathname} from ${getClientIP(request)}`)
    }
    
    // Basic security headers
    const response = NextResponse.next()
    
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    
    // CORS for API routes
    if (pathname.startsWith('/api/')) {
      response.headers.set('Access-Control-Allow-Origin', '*')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
    
    return response
    
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

/**
 * Get client IP address for logging
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  
  if (realIP) {
    return realIP.trim()
  }
  
  return 'unknown'
}

/**
 * Configure which paths the middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}