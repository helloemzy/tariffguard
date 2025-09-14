'use client'

import { useState, useEffect } from 'react'
import {
  EnvelopeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

interface EmailVerificationProps {
  email: string
  userId: string
  onVerified?: () => void
  onSkip?: () => void
  required?: boolean
}

export default function EmailVerification({
  email,
  userId,
  onVerified,
  onSkip,
  required = false
}: EmailVerificationProps) {
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [codeSent, setCodeSent] = useState(false)
  const [timeLeft, setTimeLeft] = useState(900) // 15 minutes in seconds
  const [canResend, setCanResend] = useState(false)

  // Countdown timer
  useEffect(() => {
    if (codeSent && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setCanResend(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
    return undefined
  }, [codeSent, timeLeft])

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const sendVerificationCode = async () => {
    try {
      setSendingCode(true)
      setError(null)

      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userId })
      })

      const data = await response.json()

      if (data.success) {
        setCodeSent(true)
        setTimeLeft(900) // Reset timer
        setCanResend(false)
        setSuccess('Verification code sent to your email!')

        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error || 'Failed to send verification code')
      }
    } catch (err) {
      setError('Failed to send verification code')
      console.error('Send verification code error:', err)
    } finally {
      setSendingCode(false)
    }
  }

  const verifyEmail = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/auth/verify-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          userId,
          token: verificationCode
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Email verified successfully! 🎉')
        setTimeout(() => {
          onVerified?.()
        }, 1500)
      } else {
        setError(data.error || 'Invalid verification code')
        setVerificationCode('') // Clear the input
      }
    } catch (err) {
      setError('Failed to verify email')
      console.error('Email verification error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCodeInput = (value: string) => {
    // Only allow digits and limit to 6 characters
    const cleaned = value.replace(/\D/g, '').slice(0, 6)
    setVerificationCode(cleaned)
    setError(null) // Clear error when user starts typing
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <EnvelopeIcon className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
        <p className="text-gray-600">
          We've sent a verification code to:
        </p>
        <p className="font-medium text-gray-900 mt-1">{email}</p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
          <span className="text-green-700 text-sm">{success}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {!codeSent ? (
        /* Send Code Step */
        <div className="text-center">
          <p className="text-gray-600 mb-6">
            Click below to receive a 6-digit verification code in your email.
          </p>
          <button
            onClick={sendVerificationCode}
            disabled={sendingCode}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {sendingCode ? (
              <>
                <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                Sending Code...
              </>
            ) : (
              <>
                <EnvelopeIcon className="h-4 w-4 mr-2" />
                Send Verification Code
              </>
            )}
          </button>

          {!required && onSkip && (
            <button
              onClick={onSkip}
              className="w-full mt-3 text-gray-600 text-sm hover:text-gray-800"
            >
              Skip verification (not recommended)
            </button>
          )}
        </div>
      ) : (
        /* Verification Step */
        <form onSubmit={verifyEmail}>
          <div className="mb-4">
            <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-2">
              Verification Code
            </label>
            <input
              type="text"
              id="verification-code"
              value={verificationCode}
              onChange={(e) => handleCodeInput(e.target.value)}
              placeholder="Enter 6-digit code"
              className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 tracking-widest"
              maxLength={6}
              autoComplete="one-time-code"
              inputMode="numeric"
            />
          </div>

          {/* Timer */}
          <div className="text-center mb-4">
            {timeLeft > 0 ? (
              <p className="text-sm text-gray-600">
                Code expires in: <span className="font-mono font-medium">{formatTime(timeLeft)}</span>
              </p>
            ) : (
              <p className="text-sm text-red-600 font-medium">
                Verification code has expired
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || verificationCode.length !== 6 || timeLeft === 0}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mb-3"
          >
            {loading ? (
              <>
                <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4 mr-2" />
                Verify Email
              </>
            )}
          </button>

          {/* Resend Code */}
          <div className="text-center">
            <button
              type="button"
              onClick={sendVerificationCode}
              disabled={!canResend || sendingCode || timeLeft > 0}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingCode ? 'Sending...' : 'Resend Code'}
            </button>
          </div>

          {!required && onSkip && (
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={onSkip}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Continue without verifying
              </button>
            </div>
          )}
        </form>
      )}

      {/* Help Text */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          Didn't receive the email? Check your spam folder or contact support if you continue to have issues.
        </p>
      </div>
    </div>
  )
}