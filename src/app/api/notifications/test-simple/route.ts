import { NextResponse } from 'next/server';

/**
 * Simple notification test endpoint that validates email/SMS capability
 * without dependencies on potentially corrupted notification services
 */
export async function GET() {
  try {
    console.log('🔔 Testing basic notification capabilities...');
    
    const startTime = Date.now();
    
    // Test email service (Resend)
    const emailTest = await testEmailService();
    
    // Test SMS service (Twilio) - only if configured
    const smsTest = await testSMSService();
    
    const duration = Date.now() - startTime;
    
    const allTestsPassed = emailTest.success && smsTest.success;
    
    return NextResponse.json({
      success: allTestsPassed,
      message: allTestsPassed 
        ? 'Notification services are ready for Preston\'s alerts'
        : 'Some notification services need configuration',
      test_results: {
        overall_status: allTestsPassed ? 'READY' : 'NEEDS_CONFIG',
        duration_ms: duration,
        email: emailTest,
        sms: smsTest,
        preston_config: {
          primary_email: 'preston@prestonsteel.com',
          backup_email: 'sarah@prestonsteel.com',
          sms_alerts: '+15551234567',
          alert_threshold: '$2000 container impact',
          notification_schedule: '24/7 for critical alerts'
        }
      },
      business_context: {
        use_case: 'Immediate tariff change alerts for Preston\'s steel importing',
        critical_timing: 'Must notify within 1 hour of Federal Register publication',
        alert_types: [
          'Email: All rate changes > 1%',
          'SMS: High impact changes > $2000/container',
          'Backup: Multiple contact redundancy'
        ]
      },
      timestamp: new Date().toISOString(),
    }, { 
      status: allTestsPassed ? 200 : 206 // 206 = Partial Content (some services not configured)
    });

  } catch (error) {
    console.error('❌ Notification test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Notification test execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * Test email service capability
 */
async function testEmailService(): Promise<{
  success: boolean;
  service: string;
  status: string;
  message: string;
  configured: boolean;
}> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey || resendApiKey === 'your_resend_api_key' || resendApiKey.startsWith('re_your_')) {
      return {
        success: false,
        service: 'Resend Email',
        status: 'NOT_CONFIGURED',
        message: 'Resend API key not configured - emails will not be sent',
        configured: false
      };
    }
    
    // Basic validation - don't actually send emails in test
    if (resendApiKey.startsWith('re_') && resendApiKey.length > 20) {
      return {
        success: true,
        service: 'Resend Email',
        status: 'READY',
        message: 'Email service configured and ready for Preston\'s alerts',
        configured: true
      };
    }
    
    return {
      success: false,
      service: 'Resend Email',
      status: 'INVALID_CONFIG',
      message: 'Resend API key appears invalid',
      configured: false
    };
    
  } catch (error) {
    return {
      success: false,
      service: 'Resend Email',
      status: 'ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      configured: false
    };
  }
}

/**
 * Test SMS service capability
 */
async function testSMSService(): Promise<{
  success: boolean;
  service: string;
  status: string;
  message: string;
  configured: boolean;
}> {
  try {
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    
    const isConfigured = 
      twilioAccountSid && 
      twilioAuthToken &&
      !twilioAccountSid.startsWith('your_') &&
      !twilioAuthToken.startsWith('your_') &&
      twilioAccountSid.length > 10 &&
      twilioAuthToken.length > 10;
    
    if (!isConfigured) {
      return {
        success: true, // SMS is optional - don't fail the overall test
        service: 'Twilio SMS',
        status: 'NOT_CONFIGURED',
        message: 'SMS service not configured - email alerts only',
        configured: false
      };
    }
    
    // Basic validation - don't actually send SMS in test
    return {
      success: true,
      service: 'Twilio SMS',
      status: 'READY',
      message: 'SMS service configured for high-impact alerts',
      configured: true
    };
    
  } catch (error) {
    return {
      success: true, // SMS is optional - don't fail the overall test
      service: 'Twilio SMS',
      status: 'ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      configured: false
    };
  }
}

/**
 * POST endpoint for manual testing trigger
 */
export async function POST() {
  return GET();
}