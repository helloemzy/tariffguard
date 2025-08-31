# TariffGuard - Minimal MVP

Simple Federal Register monitoring system focused on Preston's specific tariff alerting needs.

## Overview

This is a streamlined version of TariffGuard that monitors exactly 3 HS codes for tariff rate changes:

- **7318.15.20** - Steel fasteners (bolts, screws, and threaded articles)
- **8481.80.90** - Taps, cocks, valves and similar appliances, other
- **7326.90.85** - Other articles of iron or steel, not elsewhere specified

## Key Features

- **Simple Architecture**: Only 3 database tables (hs_codes, tariff_rates, alerts_sent)
- **Federal Register Monitoring**: Polls Federal Register API every 4 hours during business hours
- **Change Detection**: Flags rate changes > 1% as significant
- **Basic Alerting**: Console logs and placeholder email notifications
- **Manual Triggers**: Manual monitoring checks via web interface

## Database Schema

### hs_codes

- Basic HS code storage with descriptions
- Preston's 3 codes pre-populated

### tariff_rates

- Current and historical rates
- Change percentage calculation
- Source URL tracking from Federal Register

### alerts_sent

- Alert history and delivery status
- Links to specific rate changes
- Simple message generation

## API Endpoints

- `GET|POST /api/monitor/federal-register` - Trigger monitoring check
- `POST /api/tariff-rates/detect-change` - Process rate changes
- `POST /api/alerts/create` - Create alerts for significant changes

## Web Interface

- **/** - Home page with HS code overview and manual check button
- **/status** - Simple system status page

## Setup

1. **Database**: Apply migration `100_minimal_mvp_schema.sql`
2. **Environment**: Configure Supabase connection
3. **Monitoring**: System auto-polls every 4 hours (9 AM - 6 PM EST)

## Monitoring Process

1. **Poll Federal Register**: Search for tariff-related documents from last 7 days
2. **Analyze Documents**: Extract rate information for Preston's HS codes
3. **Detect Changes**: Compare with previous rates, flag >1% changes
4. **Generate Alerts**: Create alert records and log notifications

## Removed Complexity

- ❌ 30+ database tables reduced to 3 essential tables
- ❌ Complex subscription and billing systems
- ❌ Enterprise monitoring infrastructure
- ❌ Advanced backup and disaster recovery
- ❌ Team management and user roles
- ❌ API rate limiting and usage tracking
- ❌ Webhook delivery systems
- ❌ Comprehensive documentation

## Focus

✅ **Reliability**: Simple, focused Federal Register monitoring  
✅ **Specific Use Case**: Preston's 3 HS codes only  
✅ **Essential Features**: Rate change detection and basic alerting  
✅ **Minimal Maintenance**: Reduced infrastructure complexity

---

_This minimal MVP prioritizes simplicity and reliability over comprehensive features._
