'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface InvitationDetails {
  id: string
  email: string
  role: string
  message?: string
  expiresAt: string
  workspace: {
    name: string
    products?: string[]
  }
  inviter: {
    email: string
    name: string
  }
}

export default function JoinTeamPage() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const token = params.token as string

  useEffect(() => {
    if (token) {
      fetchInvitationDetails()
    }
  }, [token])

  const fetchInvitationDetails = async () => {
    try {
      const response = await fetch(`/api/team/join?token=${token}`)
      const data = await response.json()

      if (data.success) {
        setInvitation(data.invitation)
      } else {
        setError(data.error || 'Invalid invitation')
      }
    } catch (err) {
      setError('Failed to load invitation details')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinTeam = async () => {
    if (!user || !invitation) return

    try {
      setJoining(true)
      setError(null)

      const response = await fetch('/api/team/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          userId: user.id
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } else {
        setError(data.error || 'Failed to join team')
      }
    } catch (err) {
      setError('Failed to join team')
    } finally {
      setJoining(false)
    }
  }

  const handleSignIn = () => {
    router.push(`/login?redirect=${encodeURIComponent(`/join/${token}`)}`)
  }

  const getRoleDescription = (role: string) => {
    const descriptions = {
      admin: 'Full access to manage team members, settings, and all calculations',
      manager: 'Can approve calculations and manage team projects',
      calculator: 'Can create and edit calculations',
      viewer: 'Read-only access to calculations and reports'
    }
    return descriptions[role as keyof typeof descriptions] || 'Team member'
  }

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      admin: 'bg-red-100 text-red-800',
      manager: 'bg-blue-100 text-blue-800',
      calculator: 'bg-green-100 text-green-800',
      viewer: 'bg-gray-100 text-gray-800'
    }
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Invalid Invitation</h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <div className="mt-6">
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Welcome to the Team!</h2>
            <p className="mt-2 text-sm text-gray-600">
              You've successfully joined {invitation?.workspace.name}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <UserGroupIcon className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Join Team</h2>
            <p className="mt-2 text-sm text-gray-600">
              You've been invited to join <strong>{invitation?.workspace.name}</strong>
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Invited by</span>
                <span className="text-sm text-gray-900">{invitation?.inviter.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Role</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(invitation?.role || 'viewer')}`}>
                  {invitation?.role}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Expires</span>
                <span className="text-sm text-gray-900 flex items-center">
                  <ClockIcon className="h-4 w-4 mr-1" />
                  {invitation?.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString() : 'Unknown'}
                </span>
              </div>
            </div>

            {invitation?.message && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">{invitation.message}</p>
              </div>
            )}

            <div className="mt-6">
              <p className="text-xs text-gray-600 mb-4">
                Sign in with the invited email address to join this team:
              </p>
              <button
                onClick={handleSignIn}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700"
              >
                Sign In to Join
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // User is signed in, check if email matches
  if (user.email?.toLowerCase() !== invitation?.email.toLowerCase()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-500" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Email Mismatch</h2>
            <p className="mt-2 text-sm text-gray-600">
              This invitation was sent to <strong>{invitation?.email}</strong>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              You're signed in as <strong>{user.email}</strong>
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => router.push('/login')}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700"
              >
                Sign In with Correct Email
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full bg-gray-200 text-gray-900 py-2 px-4 rounded-lg font-medium hover:bg-gray-300"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
            <BuildingOfficeIcon className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Join Team</h2>
          <p className="mt-2 text-sm text-gray-600">
            You've been invited to join <strong>{invitation?.workspace.name}</strong>
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Invited by</span>
              <span className="text-sm text-gray-900">{invitation?.inviter.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Your Role</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(invitation?.role || 'viewer')}`}>
                {invitation?.role}
              </span>
            </div>
            <div className="text-xs text-gray-600">
              {getRoleDescription(invitation?.role || 'viewer')}
            </div>
          </div>

          {invitation?.message && (
            <div className="mb-6 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">{invitation.message}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            onClick={handleJoinTeam}
            disabled={joining}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {joining ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Joining Team...
              </>
            ) : (
              'Join Team'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}