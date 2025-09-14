/**
 * Email Service for TariffGuard
 * Handles sending tariff alert notifications via email
 */

import nodemailer from 'nodemailer'
import type { Alert, Workspace } from './supabase'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

interface EmailAlert {
  alert: Alert
  workspace: Workspace
  userEmail: string
  userName: string
}

export class EmailService {
  private transporter: nodemailer.Transporter
  
  constructor() {
    // Configure email transporter based on environment
    const emailConfig: EmailConfig = {
      host: process.env.SMTP_HOST || 'smtp.resend.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || ''
      }
    }

    this.transporter = nodemailer.createTransport(emailConfig)
  }

  /**
   * Send tariff alert email notification
   */
  async sendTariffAlert(emailAlert: EmailAlert): Promise<boolean> {
    try {
      const { alert, workspace, userEmail, userName } = emailAlert

      const subject = `🚨 Tariff Alert: HS ${alert.hs_code} Rate Changed`
      
      const htmlContent = this.generateTariffAlertHTML({
        alert,
        workspace,
        userName: userName
      })

      const textContent = this.generateTariffAlertText({
        alert,
        workspace,
        userName: userName
      })

      const mailOptions = {
        from: `TariffGuard Alerts <alerts@tariffguard.com>`,
        to: userEmail,
        subject,
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Priority': '2', // High priority for tariff alerts
          'X-MSMail-Priority': 'High',
          'Importance': 'high'
        }
      }

      const result = await this.transporter.sendMail(mailOptions)
      console.log(`Email sent successfully to ${userEmail}:`, result.messageId)
      return true

    } catch (error) {
      console.error('Failed to send tariff alert email:', error)
      return false
    }
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(userEmail: string, userName: string, workspace: Workspace): Promise<boolean> {
    try {
      const subject = `Welcome to TariffGuard - Your Import Duty Monitoring is Active`
      
      const htmlContent = this.generateWelcomeHTML({
        userName,
        workspace
      })

      const textContent = this.generateWelcomeText({
        userName,
        workspace
      })

      const mailOptions = {
        from: `TariffGuard <welcome@tariffguard.com>`,
        to: userEmail,
        subject,
        text: textContent,
        html: htmlContent
      }

      const result = await this.transporter.sendMail(mailOptions)
      console.log(`Welcome email sent to ${userEmail}:`, result.messageId)
      return true

    } catch (error) {
      console.error('Failed to send welcome email:', error)
      return false
    }
  }

  /**
   * Generate HTML email template for tariff alerts
   */
  private generateTariffAlertHTML({ alert, workspace, userName }: {
    alert: Alert
    workspace: Workspace
    userName: string
  }): string {
    const rateChange = alert.old_rate !== null 
      ? `${alert.old_rate}% → ${alert.new_rate}%`
      : `New rate: ${alert.new_rate}%`

    const changeDirection = alert.old_rate !== null && alert.new_rate > alert.old_rate ? 'increased' : 'decreased'
    const changeColor = alert.old_rate !== null && alert.new_rate > alert.old_rate ? '#dc2626' : '#16a34a'

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tariff Rate Alert</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; }
        .alert-box { background: white; border: 2px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .rate-change { font-size: 24px; font-weight: bold; color: ${changeColor}; text-align: center; margin: 15px 0; }
        .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 Tariff Rate Alert</h1>
          <p>Important change detected for your monitored HS codes</p>
        </div>
        
        <div class="content">
          <p>Hello <strong>${userName}</strong>,</p>
          
          <p>We've detected a tariff rate change for one of your monitored HS codes at <strong>${workspace.company_name}</strong>:</p>
          
          <div class="alert-box">
            <h3>HS Code: ${alert.hs_code}</h3>
            <div class="rate-change">${rateChange}</div>
            <p><strong>Status:</strong> Rate ${changeDirection}</p>
            <p><strong>Detected:</strong> ${new Date(alert.created_at).toLocaleString()}</p>
            ${alert.message ? `<p><strong>Details:</strong> ${alert.message}</p>` : ''}
          </div>
          
          <p><strong>What this means for your business:</strong></p>
          <ul>
            <li>Your import duties for this HS code have changed</li>
            <li>Future calculations will use the new rate</li>
            <li>You may want to review pending orders</li>
          </ul>
          
          <div style="text-align: center;">
            <a href="https://tariffguard.vercel.app/dashboard" class="button">
              View in Dashboard
            </a>
          </div>
          
          <p>This alert was sent because you have email notifications enabled. You can manage your notification preferences in your dashboard.</p>
        </div>
        
        <div class="footer">
          <p>© 2025 TariffGuard - Import Duty Monitoring Platform</p>
          <p>
            <a href="https://tariffguard.vercel.app/dashboard/alerts">Manage Alerts</a> | 
            <a href="https://tariffguard.vercel.app">Visit TariffGuard</a>
          </p>
        </div>
      </div>
    </body>
    </html>
    `
  }

  /**
   * Generate plain text email for tariff alerts
   */
  private generateTariffAlertText({ alert, workspace, userName }: {
    alert: Alert
    workspace: Workspace
    userName: string
  }): string {
    const rateChange = alert.old_rate !== null 
      ? `${alert.old_rate}% → ${alert.new_rate}%`
      : `New rate: ${alert.new_rate}%`

    return `
TARIFF RATE ALERT

Hello ${userName},

We've detected a tariff rate change for one of your monitored HS codes at ${workspace.company_name}:

HS Code: ${alert.hs_code}
Rate Change: ${rateChange}
Detected: ${new Date(alert.created_at).toLocaleString()}
${alert.message ? `Details: ${alert.message}` : ''}

What this means for your business:
- Your import duties for this HS code have changed
- Future calculations will use the new rate  
- You may want to review pending orders

View full details in your dashboard:
https://tariffguard.vercel.app/dashboard

This alert was sent because you have email notifications enabled. You can manage your notification preferences in your dashboard.

© 2025 TariffGuard - Import Duty Monitoring Platform
Manage Alerts: https://tariffguard.vercel.app/dashboard/alerts
Visit TariffGuard: https://tariffguard.vercel.app
    `.trim()
  }

  /**
   * Generate HTML welcome email template
   */
  private generateWelcomeHTML({ userName, workspace }: {
    userName: string
    workspace: Workspace
  }): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to TariffGuard</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e40af; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; }
        .feature-box { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 15px 0; }
        .button { display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to TariffGuard!</h1>
          <p>Your import duty monitoring is now active</p>
        </div>
        
        <div class="content">
          <p>Hello <strong>${userName}</strong>,</p>
          
          <p>Welcome to TariffGuard! Your workspace for <strong>${workspace.company_name}</strong> has been successfully created and is now monitoring tariff rate changes.</p>
          
          <h3>🚀 What you can do now:</h3>
          
          <div class="feature-box">
            <h4>📊 Calculate Import Duties</h4>
            <p>Use our interactive calculator to determine duties for your shipments with real-time government rates.</p>
          </div>
          
          <div class="feature-box">
            <h4>🔔 Monitor Rate Changes</h4>
            <p>Get instant notifications when tariff rates change for your HS codes.</p>
          </div>
          
          <div class="feature-box">
            <h4>📄 Upload Documents</h4>
            <p>Process invoices and commercial documents to automatically extract line items.</p>
          </div>
          
          <div style="text-align: center;">
            <a href="https://tariffguard.vercel.app/dashboard" class="button">
              Go to Dashboard
            </a>
          </div>
          
          <p><strong>Pro tip:</strong> Start by using our duty calculator to get familiar with the interface, then set up your notification preferences for the HS codes you import most frequently.</p>
          
          <p>If you have any questions, feel free to reach out. We're here to help make your import operations smoother and more predictable.</p>
        </div>
        
        <div class="footer">
          <p>© 2025 TariffGuard - Import Duty Monitoring Platform</p>
          <p>
            <a href="https://tariffguard.vercel.app/dashboard">Dashboard</a> | 
            <a href="https://tariffguard.vercel.app">Visit TariffGuard</a>
          </p>
        </div>
      </div>
    </body>
    </html>
    `
  }

  /**
   * Generate plain text welcome email
   */
  private generateWelcomeText({ userName, workspace }: {
    userName: string
    workspace: Workspace
  }): string {
    return `
WELCOME TO TARIFFGUARD!

Hello ${userName},

Welcome to TariffGuard! Your workspace for ${workspace.company_name} has been successfully created and is now monitoring tariff rate changes.

What you can do now:

📊 Calculate Import Duties
Use our interactive calculator to determine duties for your shipments with real-time government rates.

🔔 Monitor Rate Changes  
Get instant notifications when tariff rates change for your HS codes.

📄 Upload Documents
Process invoices and commercial documents to automatically extract line items.

Get started: https://tariffguard.vercel.app/dashboard

Pro tip: Start by using our duty calculator to get familiar with the interface, then set up your notification preferences for the HS codes you import most frequently.

If you have any questions, feel free to reach out. We're here to help make your import operations smoother and more predictable.

© 2025 TariffGuard - Import Duty Monitoring Platform
Dashboard: https://tariffguard.vercel.app/dashboard
Visit TariffGuard: https://tariffguard.vercel.app
    `.trim()
  }

  /**
   * Send team invitation email
   */
  async sendTeamInvitation(invitation: {
    email: string
    inviterName: string
    workspaceName: string
    role: string
    inviteUrl: string
    expiresAt: string
  }): Promise<boolean> {
    try {
      const subject = `You've been invited to join ${invitation.workspaceName} on TariffGuard`
      const htmlContent = this.generateTeamInvitationHTML(invitation)
      const textContent = this.generateTeamInvitationText(invitation)

      const mailOptions = {
        from: `TariffGuard Team <team@tariffguard.com>`,
        to: invitation.email,
        subject,
        html: htmlContent,
        text: textContent
      }

      const result = await this.transporter.sendMail(mailOptions)
      console.log(`✅ Team invitation sent to ${invitation.email}:`, result.messageId)
      return true
    } catch (error) {
      console.error('❌ Failed to send team invitation:', error)
      return false
    }
  }

  /**
   * Generate team invitation HTML email
   */
  private generateTeamInvitationHTML(invitation: {
    inviterName: string
    workspaceName: string
    role: string
    inviteUrl: string
    expiresAt: string
  }): string {
    const expirationDate = new Date(invitation.expiresAt).toLocaleDateString()
    const roleDescription = this.getRoleDescription(invitation.role)

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Invitation - TariffGuard</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f8fafc; }
        .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 20px 0; }
        .btn { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .btn:hover { background: #1d4ed8; }
        .role-badge { background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600; }
        .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; font-size: 14px; }
        .warning { background: #fef3cd; color: #92400e; padding: 15px; border-radius: 5px; border-left: 4px solid #f59e0b; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎉 You're Invited!</h1>
        <p>Join ${invitation.workspaceName} on TariffGuard</p>
    </div>
    
    <div class="content">
        <div class="card">
            <h2>Team Invitation</h2>
            <p>Hi there!</p>
            <p><strong>${invitation.inviterName}</strong> has invited you to join <strong>${invitation.workspaceName}</strong> on TariffGuard as a <span class="role-badge">${invitation.role.toUpperCase()}</span>.</p>
            
            <p>${roleDescription}</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${invitation.inviteUrl}" class="btn">Accept Invitation</a>
            </div>
            
            <div class="warning">
                <strong>⏰ Time Sensitive:</strong> This invitation expires on ${expirationDate}. Make sure to accept it before then!
            </div>
        </div>
        
        <div class="card">
            <h3>About TariffGuard</h3>
            <p>TariffGuard helps businesses monitor tariff rate changes and calculate import duties accurately. With our platform, you can:</p>
            <ul>
                <li>💰 Calculate import duties in real-time</li>
                <li>🔔 Get alerts on tariff rate changes</li>
                <li>📊 Analyze import costs and trends</li>
                <li>👥 Collaborate with your team</li>
            </ul>
        </div>
    </div>
    
    <div class="footer">
        <p>© 2024 TariffGuard - Import Duty Monitoring Platform</p>
        <p>This invitation was sent to you by ${invitation.inviterName}</p>
        <p>If you have any questions, please contact us at support@tariffguard.com</p>
    </div>
</body>
</html>
    `.trim()
  }

  /**
   * Generate team invitation text email
   */
  private generateTeamInvitationText(invitation: {
    inviterName: string
    workspaceName: string
    role: string
    inviteUrl: string
    expiresAt: string
  }): string {
    const expirationDate = new Date(invitation.expiresAt).toLocaleDateString()
    const roleDescription = this.getRoleDescription(invitation.role)

    return `
You're Invited to Join ${invitation.workspaceName} on TariffGuard!

Hi there!

${invitation.inviterName} has invited you to join ${invitation.workspaceName} on TariffGuard as a ${invitation.role.toUpperCase()}.

${roleDescription}

To accept this invitation, please click the link below:
${invitation.inviteUrl}

⏰ IMPORTANT: This invitation expires on ${expirationDate}. Make sure to accept it before then!

About TariffGuard:
TariffGuard helps businesses monitor tariff rate changes and calculate import duties accurately. With our platform, you can calculate import duties, get alerts on changes, analyze costs, and collaborate with your team.

If you have any questions, please contact us at support@tariffguard.com

© 2024 TariffGuard - Import Duty Monitoring Platform
    `.trim()
  }

  /**
   * Get role description for invitations
   */
  private getRoleDescription(role: string): string {
    switch (role) {
      case 'admin':
        return 'As an admin, you\'ll be able to manage team members, view all calculations, and configure workspace settings.'
      case 'member':
        return 'As a member, you\'ll be able to create calculations, view shared results, and collaborate with the team.'
      case 'viewer':
        return 'As a viewer, you\'ll be able to view calculations and reports shared with you by the team.'
      default:
        return 'You\'ll have access to collaborate with the team on import duty calculations and tariff monitoring.'
    }
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      console.log('Email service connection successful')
      return true
    } catch (error) {
      console.error('Email service connection failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const emailService = new EmailService()