'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import EmailVerification from '@/components/EmailVerification'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userIdParam = searchParams.get('userId')
    const emailParam = searchParams.get('email')

    if (!userIdParam || !emailParam) {
      // If no parameters, redirect to login
      router.push('/login')
      return
    }

    setUserId(userIdParam)
    setEmail(decodeURIComponent(emailParam))
    setLoading(false)
  }, [router, searchParams])

  const handleVerified = () => {
    // Redirect to setup or dashboard after verification
    router.push('/setup')
  }

  const handleSkip = () => {
    // Allow skipping verification and continue to setup
    router.push('/setup')
  }

  const handleBackToLogin = () => {
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!userId || !email) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Verification Link</h1>
          <p className="text-gray-600 mb-6">
            This verification link is invalid or has expired.
          </p>
          <button
            onClick={handleBackToLogin}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">🛡️ TariffGuard</h1>
          <p className="mt-2 text-gray-600">Professional Import Duty Monitoring</p>
        </div>
      </div>

      {/* Back Button */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-6">
        <button
          onClick={handleBackToLogin}
          className="flex items-center text-gray-600 hover:text-gray-800 text-sm"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Login
        </button>
      </div>

      {/* Verification Component */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <EmailVerification
          email={email}
          userId={userId}
          onVerified={handleVerified}
          onSkip={handleSkip}
          required={false} // Allow skipping for now
        />
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-gray-500">
          Having trouble? <a href="mailto:support@tariffguard.com" className="text-blue-600 hover:text-blue-700">Contact Support</a>
        </p>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}