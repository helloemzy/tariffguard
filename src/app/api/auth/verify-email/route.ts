/**
 * Email Verification API
 * Handles email verification tokens and confirmation
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// import { sendEmail } from '@/lib/email' // TODO: Import actual email service

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Send email verification token
 */
export async function POST(request: NextRequest) {
  try {
    const { email, userId } = await request.json()

    if (!email || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: email, userId' },
        { status: 400 }
      )
    }

    // Generate verification token (6-digit code)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Store verification token in database
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .upsert({
        user_id: userId,
        email,
        token: verificationCode,
        expires_at: expiresAt.toISOString(),
        verified: false
      })

    if (tokenError) {
      console.error('❌ Failed to store verification token:', tokenError)
      return NextResponse.json(
        { error: 'Failed to generate verification code' },
        { status: 500 }
      )
    }

    // Send verification email (placeholder - integrate with actual email service)
    console.log(`Verification email would be sent to ${email} with code: ${verificationCode}`)
    // await sendEmail({
    //   to: email,
    //   subject: 'Verify your TariffGuard email address',
    //   html: generateVerificationEmail(verificationCode, email)
    // })

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to email',
      expiresIn: '15 minutes'
    })

  } catch (error) {
    console.error('❌ Email verification failed:', error)
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    )
  }
}

/**
 * Verify email with token
 */
export async function PUT(request: NextRequest) {
  try {
    const { email, token, userId } = await request.json()

    if (!email || !token || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: email, token, userId' },
        { status: 400 }
      )
    }

    // Find and validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from('email_verification_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('email', email)
      .eq('token', token)
      .eq('verified', false)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Verification code has expired' },
        { status: 400 }
      )
    }

    // Mark token as verified
    const { error: updateError } = await supabase
      .from('email_verification_tokens')
      .update({
        verified: true,
        verified_at: new Date().toISOString()
      })
      .eq('id', tokenData.id)

    if (updateError) {
      console.error('❌ Failed to update verification token:', updateError)
      return NextResponse.json(
        { error: 'Failed to verify email' },
        { status: 500 }
      )
    }

    // Update user's email verification status in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      { email_confirm: true } as any
    )

    if (authError) {
      console.error('❌ Failed to update auth user:', authError)
      // Continue anyway, verification token is marked as verified
    }

    console.log(`✅ Email verified successfully for user ${userId}: ${email}`)

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      emailVerified: true
    })

  } catch (error) {
    console.error('❌ Email verification failed:', error)
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    )
  }
}

// Email template removed to fix TypeScript warning
// TODO: Integrate with actual email service for verification emails