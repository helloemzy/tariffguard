/**
 * Production Logging System
 * Provides structured logging with different levels and integrations
 */

export interface LogContext {
  userId?: string
  workspaceId?: string
  requestId?: string
  userAgent?: string
  ip?: string
  endpoint?: string
  method?: string
  statusCode?: number
  duration?: number
  [key: string]: any
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context: LogContext
  stack?: string
  environment: string
}

class Logger {
  private readonly environment: string
  private readonly serviceName: string

  constructor() {
    this.environment = process.env.NODE_ENV || 'development'
    this.serviceName = 'tariffguard-api'
  }

  private formatLogEntry(level: LogLevel, message: string, context: LogContext, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        service: this.serviceName,
        environment: this.environment,
        ...context
      },
      stack: error?.stack,
      environment: this.environment
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.environment === 'production') {
      return level === LogLevel.ERROR || level === LogLevel.WARN || level === LogLevel.INFO
    }
    return true // Log everything in development
  }

  private async writeLog(entry: LogEntry) {
    if (!this.shouldLog(entry.level)) return

    // Console output (always available)
    const consoleMessage = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(consoleMessage, entry.context, entry.stack)
        break
      case LogLevel.WARN:
        console.warn(consoleMessage, entry.context)
        break
      case LogLevel.INFO:
        console.info(consoleMessage, entry.context)
        break
      case LogLevel.DEBUG:
        console.debug(consoleMessage, entry.context)
        break
    }

    // Send to external logging service in production
    if (this.environment === 'production') {
      await this.sendToExternalService(entry)
    }

    // Store critical errors in database
    if (entry.level === LogLevel.ERROR) {
      await this.storeErrorInDatabase(entry)
    }
  }

  private async sendToExternalService(entry: LogEntry) {
    try {
      // Example: Send to Sentry, LogRocket, or other service
      if (process.env.SENTRY_DSN && entry.level === LogLevel.ERROR) {
        // Sentry integration would go here
        // Sentry.captureException(new Error(entry.message), { contexts: { custom: entry.context } })
      }

      // Example: Send to custom logging endpoint
      if (process.env.LOGGING_ENDPOINT) {
        await fetch(process.env.LOGGING_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        }).catch(() => {
          // Fail silently to prevent logging errors from breaking the app
        })
      }
    } catch (error) {
      // Fail silently - we don't want logging to break the app
    }
  }

  private async storeErrorInDatabase(entry: LogEntry) {
    try {
      // Only import Supabase when needed to avoid circular dependencies
      const { createClient } = await import('@supabase/supabase-js')

      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        )

        await supabase
          .from('error_logs')
          .insert({
            timestamp: entry.timestamp,
            level: entry.level,
            message: entry.message,
            context: entry.context,
            stack_trace: entry.stack,
            environment: entry.environment,
            workspace_id: entry.context.workspaceId || null,
            user_id: entry.context.userId || null,
            endpoint: entry.context.endpoint || null,
            method: entry.context.method || null,
            status_code: entry.context.statusCode || null,
            duration_ms: entry.context.duration || null
          })
      }
    } catch (error) {
      // Fail silently - we don't want logging to break the app
    }
  }

  async error(message: string, context: LogContext = {}, error?: Error) {
    const entry = this.formatLogEntry(LogLevel.ERROR, message, context, error)
    await this.writeLog(entry)
  }

  async warn(message: string, context: LogContext = {}) {
    const entry = this.formatLogEntry(LogLevel.WARN, message, context)
    await this.writeLog(entry)
  }

  async info(message: string, context: LogContext = {}) {
    const entry = this.formatLogEntry(LogLevel.INFO, message, context)
    await this.writeLog(entry)
  }

  async debug(message: string, context: LogContext = {}) {
    const entry = this.formatLogEntry(LogLevel.DEBUG, message, context)
    await this.writeLog(entry)
  }

  // Convenience methods for common scenarios
  async apiError(endpoint: string, method: string, statusCode: number, error: Error, context: LogContext = {}) {
    await this.error(`API Error: ${method} ${endpoint}`, {
      ...context,
      endpoint,
      method,
      statusCode,
      errorName: error.name,
      errorMessage: error.message
    }, error)
  }

  async apiSuccess(endpoint: string, method: string, statusCode: number, duration: number, context: LogContext = {}) {
    await this.info(`API Success: ${method} ${endpoint}`, {
      ...context,
      endpoint,
      method,
      statusCode,
      duration
    })
  }

  async userAction(action: string, userId: string, workspaceId?: string, context: LogContext = {}) {
    await this.info(`User Action: ${action}`, {
      ...context,
      userId,
      workspaceId,
      action
    })
  }

  async businessEvent(event: string, context: LogContext = {}) {
    await this.info(`Business Event: ${event}`, {
      ...context,
      eventType: 'business',
      event
    })
  }

  async securityEvent(event: string, severity: 'low' | 'medium' | 'high', context: LogContext = {}) {
    const level = severity === 'high' ? LogLevel.ERROR : severity === 'medium' ? LogLevel.WARN : LogLevel.INFO
    const entry = this.formatLogEntry(level, `Security Event: ${event}`, {
      ...context,
      eventType: 'security',
      severity,
      event
    })
    await this.writeLog(entry)
  }

  async performanceEvent(operation: string, duration: number, context: LogContext = {}) {
    const level = duration > 5000 ? LogLevel.WARN : LogLevel.INFO
    const entry = this.formatLogEntry(level, `Performance: ${operation} took ${duration}ms`, {
      ...context,
      eventType: 'performance',
      operation,
      duration
    })
    await this.writeLog(entry)
  }
}

// Singleton instance
export const logger = new Logger()

// Helper function to extract request context from Next.js Request
export function getRequestContext(request: Request): LogContext {
  const url = new URL(request.url)

  return {
    endpoint: url.pathname,
    method: request.method,
    userAgent: request.headers.get('user-agent') || undefined,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    origin: request.headers.get('origin') || undefined,
    referer: request.headers.get('referer') || undefined
  }
}

// Error boundary helper for React components
export function logError(error: Error, errorInfo?: { componentStack?: string }, context: LogContext = {}) {
  logger.error('React Component Error', {
    ...context,
    componentStack: errorInfo?.componentStack,
    errorName: error.name,
    errorMessage: error.message
  }, error)
}

// Performance monitoring helper
export function withPerformanceLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  operationName: string,
  context: LogContext = {}
): T {
  return (async (...args: any[]) => {
    const start = performance.now()
    try {
      const result = await fn(...args)
      const duration = Math.round(performance.now() - start)
      await logger.performanceEvent(operationName, duration, context)
      return result
    } catch (error) {
      const duration = Math.round(performance.now() - start)
      await logger.error(`${operationName} failed after ${duration}ms`, context, error as Error)
      throw error
    }
  }) as T
}

export default logger