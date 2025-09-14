'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientSupabaseClient, type Alert, type Workspace } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface NotificationHook {
  alerts: Alert[]
  unreadCount: number
  isSubscribed: boolean
  markAsRead: (alertId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  subscribeToAlerts: (workspaceId: string) => void
  unsubscribeFromAlerts: () => void
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  toasts: ToastNotification[]
  dismissToast: (id: string) => void
}

interface ToastNotification {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  timestamp: Date
  autoClose?: boolean
}

export function useNotifications(workspace: Workspace | null): NotificationHook {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null)
  const [toasts, setToasts] = useState<ToastNotification[]>([])
  
  const supabase = createClientSupabaseClient()

  // Load initial alerts
  const loadAlerts = useCallback(async (workspaceId: string) => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error loading alerts:', error)
        return
      }

      setAlerts(data || [])
      setUnreadCount(data?.filter(alert => !alert.is_read).length || 0)
    } catch (error) {
      console.error('Alert loading error:', error)
    }
  }, [supabase])

  // Subscribe to real-time alert changes
  const subscribeToAlerts = useCallback((workspaceId: string) => {
    if (!workspaceId || isSubscribed) {
      return
    }

    // Load initial alerts
    loadAlerts(workspaceId)

    // Set up real-time subscription
    const channel = supabase
      .channel('alerts-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          console.log('New alert received:', payload)
          
          const newAlert = payload.new as Alert
          
          // Add to alerts list
          setAlerts(current => [newAlert, ...current])
          setUnreadCount(current => current + 1)

          // Show toast notification
          showToast(
            `Tariff rate changed: HS ${newAlert.hs_code} (${newAlert.old_rate}% → ${newAlert.new_rate}%)`,
            'warning'
          )

          // Trigger email alert if enabled
          triggerEmailAlert(newAlert.id, workspaceId)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'alerts',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          console.log('Alert updated:', payload)
          
          const updatedAlert = payload.new as Alert
          
          // Update alerts list
          setAlerts(current =>
            current.map(alert =>
              alert.id === updatedAlert.id ? updatedAlert : alert
            )
          )

          // Update unread count if alert was marked as read
          if (updatedAlert.is_read && !payload.old?.is_read) {
            setUnreadCount(current => Math.max(0, current - 1))
          }
        }
      )
      .subscribe((status) => {
        console.log('Alerts subscription status:', status)
        if (status === 'SUBSCRIBED') {
          setIsSubscribed(true)
        }
      })

    setRealtimeChannel(channel)
  }, [isSubscribed, loadAlerts, supabase])

  // Unsubscribe from real-time alerts
  const unsubscribeFromAlerts = useCallback(() => {
    if (realtimeChannel) {
      console.log('Unsubscribing from alerts')
      supabase.removeChannel(realtimeChannel)
      setRealtimeChannel(null)
      setIsSubscribed(false)
    }
  }, [realtimeChannel, supabase])

  // Mark single alert as read
  const markAsRead = useCallback(async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('id', alertId)

      if (error) {
        console.error('Error marking alert as read:', error)
        return
      }

      // Update local state
      setAlerts(current =>
        current.map(alert =>
          alert.id === alertId ? { ...alert, is_read: true } : alert
        )
      )
      setUnreadCount(current => Math.max(0, current - 1))
    } catch (error) {
      console.error('Mark as read error:', error)
    }
  }, [supabase])

  // Mark all alerts as read
  const markAllAsRead = useCallback(async () => {
    if (!workspace) return

    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('workspace_id', workspace.id)
        .eq('is_read', false)

      if (error) {
        console.error('Error marking all alerts as read:', error)
        return
      }

      // Update local state
      setAlerts(current =>
        current.map(alert => ({ ...alert, is_read: true }))
      )
      setUnreadCount(0)
    } catch (error) {
      console.error('Mark all as read error:', error)
    }
  }, [workspace, supabase])

  // Show toast notification
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString()
    const newToast: ToastNotification = {
      id,
      message,
      type,
      timestamp: new Date(),
      autoClose: true
    }

    setToasts(current => [...current, newToast])

    // Auto-dismiss after 5 seconds
    if (newToast.autoClose) {
      setTimeout(() => {
        setToasts(current => current.filter(toast => toast.id !== id))
      }, 5000)
    }
  }, [])

  // Dismiss toast
  const dismissToast = useCallback((id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  // Trigger email alert
  const triggerEmailAlert = useCallback(async (alertId: string, workspaceId: string) => {
    try {
      const response = await fetch('/api/email/send-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alertId,
          workspaceId
        })
      })

      if (!response.ok) {
        console.error('Failed to trigger email alert:', response.statusText)
      } else {
        console.log('Email alert triggered successfully')
      }
    } catch (error) {
      console.error('Error triggering email alert:', error)
    }
  }, [])

  // Auto-subscribe when workspace is available
  useEffect(() => {
    if (workspace && !isSubscribed) {
      subscribeToAlerts(workspace.id)
    }

    // Cleanup on unmount
    return () => {
      unsubscribeFromAlerts()
    }
  }, [workspace, isSubscribed, subscribeToAlerts, unsubscribeFromAlerts])

  return {
    alerts,
    unreadCount,
    isSubscribed,
    markAsRead,
    markAllAsRead,
    subscribeToAlerts,
    unsubscribeFromAlerts,
    showToast,
    toasts,
    dismissToast
  }
}