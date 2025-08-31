# Monitoring and Alerting Configuration Guide

This guide explains how to configure the comprehensive monitoring and alerting system for the Manifest application.

## Prerequisites

Before configuring monitoring, ensure you have the following:

### Required Secrets

Add these secrets to your GitHub repository settings (`Settings > Secrets and variables > Actions`):

#### Deployment Secrets

```
VERCEL_TOKEN          # Vercel deployment token
VERCEL_ORG_ID         # Vercel organization ID
VERCEL_PROJECT_ID     # Vercel project ID
```

#### Notification Secrets

```
SLACK_WEBHOOK_URL     # Slack webhook URL for notifications
SMTP_HOST             # Email SMTP server host
SMTP_PORT             # Email SMTP server port
SMTP_USERNAME         # Email SMTP username
SMTP_PASSWORD         # Email SMTP password
NOTIFICATION_EMAIL    # Email address for critical alerts
```

#### Security Monitoring Secrets

```
SNYK_TOKEN           # Snyk authentication token (optional)
CODECLIMATE_TOKEN    # Code Climate token (optional)
```

## Slack Integration Setup

### 1. Create Slack Webhook

1. Go to your Slack workspace
2. Navigate to `Apps > Manage > Custom Integrations > Incoming Webhooks`
3. Click "Add to Slack"
4. Choose the channel for notifications (e.g., `#deployments`, `#alerts`)
5. Copy the webhook URL
6. Add it as `SLACK_WEBHOOK_URL` secret in GitHub

### 2. Slack Channel Configuration

Create dedicated channels for different types of alerts:

- `#deployments` - Deployment notifications
- `#monitoring` - Health check alerts
- `#security` - Security incident notifications
- `#performance` - Performance degradation alerts

### 3. Slack Alert Types

The system sends different types of notifications:

#### Deployment Notifications

- ✅ Successful deployments
- ❌ Failed deployments
- ⚠️ Deployment warnings

#### Monitoring Alerts

- 🚨 Critical system failures
- ⚠️ Performance degradation
- 🔒 Security incidents
- 📊 Regular status updates

## Email Notification Setup

### 1. SMTP Configuration

Configure SMTP settings for email notifications:

```yaml
SMTP_HOST: smtp.gmail.com # For Gmail
SMTP_PORT: 587 # TLS port
SMTP_USERNAME: your-email@gmail.com
SMTP_PASSWORD: your-app-password # Use app password for Gmail
NOTIFICATION_EMAIL: alerts@yourcompany.com
```

### 2. Email Alert Types

- **Critical Alerts**: Immediate system failures
- **Security Incidents**: High/critical vulnerabilities
- **Performance Issues**: Significant degradation
- **Weekly Reports**: Summary of system health

## Monitoring Configuration

### 1. Health Check Intervals

```yaml
# Real-time monitoring (.github/workflows/monitoring-alerts.yml)
Health Checks: Every 5 minutes
Performance Checks: Every 30 minutes
Security Scans: Daily at 3 AM UTC
Certificate Checks: Weekly
# Custom intervals can be configured by modifying cron expressions:
# */5 * * * *    - Every 5 minutes
# */30 * * * *   - Every 30 minutes
# 0 3 * * *      - Daily at 3 AM
# 0 0 * * 0      - Weekly on Sunday
```

### 2. Alert Thresholds

Customize alert thresholds by modifying environment variables:

```yaml
# Performance thresholds
ALERT_THRESHOLD_RESPONSE_TIME: 5000 # 5 seconds
ALERT_THRESHOLD_ERROR_RATE: 5 # 5%
LIGHTHOUSE_PERFORMANCE_THRESHOLD: 90 # 90%
LIGHTHOUSE_LCP_THRESHOLD: 2500 # 2.5 seconds

# Security thresholds
CRITICAL_VULNERABILITY_THRESHOLD: 1 # Any critical vulnerability
HIGH_VULNERABILITY_THRESHOLD: 5 # 5 high vulnerabilities
SSL_EXPIRY_WARNING_DAYS: 30 # 30 days before expiry
```

### 3. Monitoring Endpoints

The system monitors these endpoints:

```yaml
Production: https://tariffguard.vercel.app
Staging: https://tariffguard-staging.vercel.app

Health Endpoints:
  - /healthz
  - /api/health
  - /api/fetch-tariff-rates

Critical User Flows:
  - Landing page load
  - Dashboard access
  - API availability
```

## Dashboard and Reporting

### 1. GitHub Actions Dashboard

Monitor workflow status at:

```
https://github.com/[your-org]/[your-repo]/actions
```

### 2. Performance Reports

Performance reports are generated and stored as artifacts:

- Lighthouse reports (HTML/JSON)
- Bundle size analysis
- Core Web Vitals tracking
- Historical performance data

### 3. Security Reports

Security scan results include:

- Dependency vulnerability scans
- Code security analysis
- Infrastructure security checks
- SSL/TLS certificate monitoring

## Incident Response

### 1. Critical Alert Response

When critical alerts are triggered:

1. **Immediate notification** sent to Slack and email
2. **GitHub issue created** with incident details
3. **Automated deployment rollback** (if configured)
4. **Status page updated** (if integrated)

### 2. Alert Escalation

```yaml
Level 1 (5 minutes): Slack notification
Level 2 (15 minutes): Email to on-call team
Level 3 (30 minutes): SMS/phone alerts (external service)
Level 4 (60 minutes): Management escalation
```

### 3. Recovery Verification

After incident resolution:

1. Re-run health checks
2. Verify performance metrics
3. Close GitHub issue
4. Update incident log
5. Send recovery notification

## Customization Options

### 1. Workflow Triggers

Modify workflow triggers in the YAML files:

```yaml
# Add manual triggers
workflow_dispatch:
  inputs:
    environment:
      description: 'Environment to monitor'
      required: true
      type: choice
      options: [production, staging, all]

# Modify schedule
schedule:
  - cron: '*/10 * * * *' # Every 10 minutes instead of 5
```

### 2. Custom Metrics

Add custom monitoring checks:

```yaml
- name: Custom Business Metric Check
  run: |
    # Check your specific business metrics
    METRIC_VALUE=$(curl -s "$PRODUCTION_URL/api/metrics" | jq '.active_users')
    if [ "$METRIC_VALUE" -lt 100 ]; then
      echo "::error::Active users below threshold: $METRIC_VALUE"
      exit 1
    fi
```

### 3. Integration with External Services

Extend monitoring with external services:

- **Datadog**: Custom metrics and APM
- **New Relic**: Application monitoring
- **PagerDuty**: Advanced incident management
- **StatusPage**: Public status reporting

## Troubleshooting

### Common Issues

1. **Slack notifications not working**
   - Verify `SLACK_WEBHOOK_URL` is correct
   - Check webhook permissions
   - Test webhook manually: `curl -X POST -H 'Content-type: application/json' --data '{"text":"Test"}' YOUR_WEBHOOK_URL`

2. **Performance tests failing**
   - Check if site is accessible
   - Verify Lighthouse can connect
   - Review network connectivity

3. **Security scans timing out**
   - Increase timeout values
   - Run scans during off-peak hours
   - Use `continue-on-error: true` for non-critical scans

### Debug Mode

Enable debug logging by setting:

```yaml
env:
  DEBUG: true
  GITHUB_ACTIONS_LOG_LEVEL: debug
```

## Maintenance

### 1. Regular Updates

- Update action versions monthly
- Review and adjust thresholds quarterly
- Update security scan tools regularly

### 2. Performance Optimization

- Archive old reports (>90 days)
- Optimize workflow concurrency
- Use caching for dependencies

### 3. Security Maintenance

- Rotate webhook URLs annually
- Review access permissions quarterly
- Update security scan configurations

## Support

For issues with the monitoring system:

1. Check GitHub Actions logs
2. Review repository issues
3. Consult this configuration guide
4. Contact the platform team

## Monitoring Checklist

- [ ] All required secrets configured
- [ ] Slack integration tested
- [ ] Email notifications verified
- [ ] Health check endpoints responding
- [ ] Performance baselines established
- [ ] Security scans completed successfully
- [ ] Alert thresholds appropriate
- [ ] Incident response procedures documented
- [ ] Team trained on alert handling
- [ ] Regular maintenance scheduled

---

**Last Updated**: 2024-08-30  
**Version**: 1.0  
**Maintainer**: Platform Engineering Team
