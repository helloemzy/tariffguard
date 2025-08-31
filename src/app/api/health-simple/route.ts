import { NextResponse } from 'next/server';

/**
 * Simple health check endpoint without complex dependencies
 * Used to validate basic API functionality for production deployment
 */
export async function GET() {
  try {
    const startTime = Date.now();
    
    // Basic system health checks
    const healthCheck = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      
      // Preston's TariffGuard specific info
      system: {
        name: 'TariffGuard - Preston Steel Import Monitor',
        version: '1.0.0',
        target_customer: 'Preston - Steel Fastener Importer',
        monitored_hs_codes: ['7318.15.20', '8481.80.90', '7326.90.85']
      },
      
      // Basic configuration check
      config: {
        federal_register_url: process.env.NEXT_PUBLIC_FEDERAL_REGISTER_API_URL || 'https://www.federalregister.gov/api/v1',
        app_url: process.env.NEXT_PUBLIC_APP_URL || 'localhost:3000',
        has_supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        has_resend_key: Boolean(process.env.RESEND_API_KEY),
        has_twilio_config: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
      },
      
      // Response time
      response_time_ms: Date.now() - startTime
    };
    
    return NextResponse.json(healthCheck, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      system: 'TariffGuard - Preston Steel Import Monitor'
    }, { 
      status: 500 
    });
  }
}

/**
 * POST endpoint for health check
 */
export async function POST() {
  return GET();
}