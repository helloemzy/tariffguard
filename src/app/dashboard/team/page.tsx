'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  UsersIcon,
  PlusIcon,
  EnvelopeIcon,
  XMarkIcon,
  ShieldCheckIcon,
  EyeIcon,
  CogIcon
} from '@heroicons/react/24/outline'

interface TeamMember {
  id: string
  userId: string
  role: 'owner' | 'admin' | 'manager' | 'calculator' | 'viewer'
  status: string
  email: string
  name: string
  avatar?: string
  joinedAt: string
  createdAt: string
}

interface TeamInvitation {
  id: string
  email: string
  role: 'admin' | 'manager' | 'calculator' | 'viewer'
  expiresAt: string
  createdAt: string
  inviterName: string
}

const roleIcons = {
  owner: ShieldCheckIcon,
  admin: CogIcon,
  manager: UsersIcon,
  calculator: PlusIcon,
  viewer: EyeIcon
}

const roleColors = {
  owner: 'text-purple-600 bg-purple-100',
  admin: 'text-red-600 bg-red-100',
  manager: 'text-blue-600 bg-blue-100',
  calculator: 'text-green-600 bg-green-100',
  viewer: 'text-gray-600 bg-gray-100'
}

export default function TeamPage() {
  const router = useRouter()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'viewer' as 'admin' | 'manager' | 'calculator' | 'viewer'
  })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchTeamData()
  }, [])

  const fetchTeamData = async () => {
    try {
      const workspaceId = localStorage.getItem('currentWorkspaceId')
      if (!workspaceId) {
        router.push('/dashboard')
        return
      }

      // Fetch team members and invitations in parallel
      const [membersResponse, invitationsResponse] = await Promise.all([
        fetch(`/api/team/members?workspaceId=${workspaceId}`),
        fetch(`/api/team/invite?workspaceId=${workspaceId}`)
      ])

      const [membersData, invitationsData] = await Promise.all([
        membersResponse.json(),
        invitationsResponse.json()
      ])

      if (membersData.success) {
        setMembers(membersData.members)
      }

      if (invitationsData.success) {
        setInvitations(invitationsData.invitations)
      }
    } catch (error) {
      console.error('Failed to fetch team data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)

    try {
      const workspaceId = localStorage.getItem('currentWorkspaceId')
      const currentUserName = localStorage.getItem('currentUserName') || 'Team Member'
      const workspaceName = localStorage.getItem('currentWorkspaceName') || 'Workspace'

      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteForm.email,
          role: inviteForm.role,
          workspaceId,
          inviterName: currentUserName,
          workspaceName
        })
      })

      const data = await response.json()

      if (data.success) {
        alert('Invitation sent successfully!')
        setShowInviteModal(false)
        setInviteForm({ email: '', role: 'viewer' })
        fetchTeamData() // Refresh the data
      } else {
        alert('Failed to send invitation: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to send invitation:', error)
      alert('Failed to send invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!confirm(`Are you sure you want to change this member's role to ${newRole}?`)) {
      return
    }

    setActionLoading(`role-${memberId}`)

    try {
      const workspaceId = localStorage.getItem('currentWorkspaceId')

      const response = await fetch('/api/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          role: newRole,
          workspaceId
        })
      })

      const data = await response.json()

      if (data.success) {
        // Update local state
        setMembers(prev => prev.map(member => 
          member.id === memberId 
            ? { ...member, role: newRole as any }
            : member
        ))
        alert('Member role updated successfully!')
      } else {
        alert('Failed to update role: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to update role:', error)
      alert('Failed to update member role')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from the team?`)) {
      return
    }

    setActionLoading(`remove-${memberId}`)

    try {
      const workspaceId = localStorage.getItem('currentWorkspaceId')

      const response = await fetch(`/api/team/members?memberId=${memberId}&workspaceId=${workspaceId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        // Remove from local state
        setMembers(prev => prev.filter(member => member.id !== memberId))
        alert('Member removed successfully!')
      } else {
        alert('Failed to remove member: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to remove member:', error)
      alert('Failed to remove member')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return
    }

    setActionLoading(`cancel-${invitationId}`)

    try {
      const response = await fetch(`/api/team/invite?invitationId=${invitationId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        // Remove from local state
        setInvitations(prev => prev.filter(invite => invite.id !== invitationId))
        alert('Invitation canceled successfully!')
      } else {
        alert('Failed to cancel invitation: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to cancel invitation:', error)
      alert('Failed to cancel invitation')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
              <p className="mt-2 text-gray-600">Manage team members and permissions</p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Invite Member
            </button>
          </div>
        </div>

        {/* Team Members */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-6">
            <div className="flex items-center mb-6">
              <UsersIcon className="h-6 w-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Team Members ({members.length})</h2>
            </div>

            <div className="space-y-4">
              {members.map((member) => {
                const RoleIcon = roleIcons[member.role]
                return (
                  <div key={member.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {member.name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-500">{member.email}</p>
                        <p className="text-xs text-gray-400">
                          Joined {new Date(member.joinedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${roleColors[member.role]}`}>
                        <RoleIcon className="h-4 w-4 mr-1" />
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </div>

                      {member.role !== 'owner' && (
                        <div className="relative">
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                            disabled={actionLoading === `role-${member.id}`}
                            className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
                          >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="calculator">Calculator</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </div>
                      )}

                      {member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.id, member.email)}
                          disabled={actionLoading === `remove-${member.id}`}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                          title="Remove member"
                        >
                          {actionLoading === `remove-${member.id}` ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <XMarkIcon className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6">
              <div className="flex items-center mb-6">
                <EnvelopeIcon className="h-6 w-6 text-yellow-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">Pending Invitations ({invitations.length})</h2>
              </div>

              <div className="space-y-4">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="flex items-center justify-between p-4 border border-yellow-200 rounded-lg bg-yellow-50">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center">
                        <EnvelopeIcon className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{invitation.email}</p>
                        <p className="text-sm text-gray-600">
                          Invited by {invitation.inviterName} as {invitation.role}
                        </p>
                        <p className="text-xs text-gray-500">
                          Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCancelInvitation(invitation.id)}
                      disabled={actionLoading === `cancel-${invitation.id}`}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      title="Cancel invitation"
                    >
                      {actionLoading === `cancel-${invitation.id}` ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      ) : (
                        <XMarkIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Invite Team Member</h3>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSendInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="colleague@company.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="viewer">Viewer - Read-only access to calculations</option>
                    <option value="calculator">Calculator - Can create calculations</option>
                    <option value="manager">Manager - Can approve calculations</option>
                    <option value="admin">Admin - Can manage team and settings</option>
                  </select>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md font-medium hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    {inviteLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      'Send Invitation'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}