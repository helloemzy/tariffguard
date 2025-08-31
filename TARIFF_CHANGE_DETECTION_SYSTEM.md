# TariffGuard Change Detection & Alert System

## Overview

The TariffGuard Change Detection & Alert System is a comprehensive solution that monitors tariff rate changes across multiple government data sources and provides automated business-focused alerts for Preston's steel importing operations.

## System Architecture

### Core Components

1. **Change Detection Engine** (`/src/lib/change-detection-engine.ts`)
   - Multi-source rate comparison (Federal Register + USITC DataWeb)
   - Business impact calculation
   - Alert priority determination
   - Cross-validation between data sources

2. **Alert Notification System** (`/src/lib/alert-notification-system.ts`)
   - Email alerts via Resend API
   - SMS alerts via Twilio API
   - Dashboard notifications
   - Business-focused message templates

3. **API Endpoints**
   - `/api/alerts` - Alert management
   - `/api/monitoring/comprehensive` - Full system monitoring
   - `/api/test-system` - System testing and validation

### Data Sources

- **Federal Register API**: Future tariff changes and announcements
- **USITC DataWeb API**: Current official tariff rates
- **Database**: Historical rates and alert tracking

## Preston's Business Configuration

### Monitored HS Codes

- **7318.15.20**: Steel fasteners ($50k containers, 24/year)
- **8481.80.90**: Valves ($75k containers, 12/year)
- **7326.90.85**: Iron/steel articles ($40k containers, 18/year)

### Alert Priorities

- **Critical** (≥$2,000 container impact): SMS + Email + Dashboard
- **High** (≥$1,000 container impact): Email + Dashboard
- **Medium** (≥$500 container impact): Email + Dashboard
- **Low** (<$500 container impact): Dashboard only

## Setup Instructions

### Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# USITC DataWeb (requires Login.gov account)
USITC_DATAWEB_USERNAME=your_login_gov_username
USITC_DATAWEB_PASSWORD=your_login_gov_password

# Email notifications (Resend)
RESEND_API_KEY=your_resend_api_key

# SMS notifications (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=your_twilio_phone_number

# Preston's contact info
PRESTON_PHONE_NUMBER=+1234567890
```

### Database Setup

The system uses the existing database schema with these key tables:

- `hs_codes` - Monitored HS codes
- `tariff_rates` - Current and historical rates
- `alerts_sent` - Alert delivery tracking

## Usage Guide

### Manual Monitoring Check

```bash
curl "https://your-domain.com/api/monitoring/comprehensive?daysBack=7&sendAlerts=true"
```

### Quick Health Check

```bash
curl -X POST "https://your-domain.com/api/monitoring/comprehensive" \
  -H "Content-Type: application/json" \
  -d '{"action": "health-check"}'
```

### Send Test Alert

```bash
curl -X POST "https://your-domain.com/api/alerts" \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}'
```

### Create Manual Alert

```bash
curl -X POST "https://your-domain.com/api/alerts" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "manual",
    "hsCode": "7318.15.20",
    "oldRate": 25.0,
    "newRate": 30.0,
    "effectiveDate": "2024-09-15",
    "priority": "critical"
  }'
```

### System Testing

```bash
# Run all tests
curl "https://your-domain.com/api/test-system?type=all"

# Run only component tests
curl "https://your-domain.com/api/test-system?type=components"

# Run business scenarios (skip actual alerts)
curl "https://your-domain.com/api/test-system?type=scenarios&skipAlerts=true"
```

## Alert Message Examples

### Critical Rate Increase Email

```
Subject: 🚨 TARIFF INCREASE ALERT - 7318.15.20 (+20.0%)

IMMEDIATE ACTION REQUIRED

Product: Steel fasteners - bolts, screws, and threaded articles
HS Code: 7318.15.20
Rate Change: 25.0% → 30.0% (+5.0%)
Effective Date: September 15, 2024

BUSINESS IMPACT ANALYSIS:
• Container Impact: +$2,500 per container
• Annual Impact: +$60,000 (based on 24 containers/year)
• Container Value: $50,000
• Impact on Margin: +33.3%

RECOMMENDED ACTIONS:
1. Contact customers within 24 hours to discuss pricing adjustments
2. Consider accelerating pending orders before effective date
3. Update internal cost calculations and quoting process
4. Review customer contracts for pricing adjustment clauses

Timeline: You have 10 business days to adjust pricing.
```

### Critical Rate Increase SMS

```
🚨 TARIFF INCREASE ALERT

7318.15.20: +20.0%
Container Impact: +$2,500
Annual Impact: +$60,000
Effective in 10 days

Check email for full details and action items.
```

## Monitoring Workflow

### Automated Schedule (Recommended)

1. **Daily Quick Check** (6 AM): 3-day lookback, critical alerts only
2. **Weekly Deep Scan** (Monday 7 AM): 14-day lookback, all alerts
3. **Health Check** (Every 4 hours): System component status

### Cron Job Examples

```bash
# Daily quick check at 6 AM
0 6 * * * curl -s "https://your-domain.com/api/monitoring/comprehensive?daysBack=3"

# Weekly deep scan on Mondays at 7 AM
0 7 * * 1 curl -s "https://your-domain.com/api/monitoring/comprehensive?daysBack=14"

# Health check every 4 hours
0 */4 * * * curl -s -X POST "https://your-domain.com/api/monitoring/comprehensive" -d '{"action":"health-check"}'
```

## Business Impact Calculations

### Container Cost Impact

```
Change Impact = Container Value × Rate Change Percentage
Annual Impact = Change Impact × Containers Per Year

Example:
- Steel Fasteners: $50,000 × 5% = $2,500 per container
- Annual: $2,500 × 24 containers = $60,000
```

### Margin Impact

```
Margin Impact = (Change Impact ÷ Current Margin) × 100

Example:
- Current Margin: $50,000 × 15% = $7,500
- Impact: $2,500 ÷ $7,500 = 33.3% margin impact
```

## Troubleshooting

### Common Issues

1. **USITC Authentication Failed**
   - Verify Login.gov credentials
   - Check for MFA requirements
   - Ensure account has DataWeb access

2. **Email Notifications Not Sending**
   - Verify Resend API key
   - Check from/to email addresses
   - Review rate limits

3. **SMS Notifications Failed**
   - Verify Twilio credentials
   - Check phone number format (+1234567890)
   - Ensure sufficient Twilio balance

4. **Database Connection Issues**
   - Verify Supabase credentials
   - Check Row Level Security policies
   - Ensure service role key permissions

### System Health Indicators

- **Green**: All components operational, alerts delivering
- **Yellow**: Some components degraded, partial functionality
- **Red**: Critical components failed, manual intervention required

## Development & Testing

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev

# Run tests
curl "http://localhost:3000/api/test-system"
```

### Production Deployment

1. Configure all environment variables
2. Run system tests: `GET /api/test-system`
3. Verify database connectivity
4. Test notification delivery
5. Set up monitoring cron jobs

## Security Considerations

- Use service role key only on server-side
- Store sensitive credentials in environment variables
- Implement rate limiting for API endpoints
- Monitor for unusual activity patterns
- Regular security audits of external API access

## Support & Maintenance

### Regular Maintenance Tasks

1. **Weekly**: Review alert accuracy and delivery rates
2. **Monthly**: Update HS code monitoring list if needed
3. **Quarterly**: Review business impact calculations
4. **Annually**: Audit external API access and credentials

### Monitoring Metrics

- Alert accuracy rate (target: >99%)
- Notification delivery rate (target: >99%)
- API response times (target: <30s)
- System uptime (target: >99.9%)
- False positive rate (target: <1%)

## Contact Information

- **Primary Contact**: Preston (preston@prestonsteelimports.com)
- **Phone**: Configured in PRESTON_PHONE_NUMBER environment variable
- **Support**: support@tariffguard.com
