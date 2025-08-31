# Product Brief: TariffGuard

## Margin Protection Through Intelligent Tariff Monitoring

### Executive Summary

TariffGuard is a focused SaaS platform that monitors tariff changes for specific products that import/export businesses deal with regularly. By providing proactive alerts on duty rate changes before they impact quotes and orders, TariffGuard protects the thin profit margins that determine whether these businesses succeed or fail.

---

## Problem Definition

### Primary Problem

Import/export businesses quote delivered prices (DDP) to clients where profit margins depend on accurately calculating total landed costs. A single unnoticed tariff change can transform profitable orders into losses, often discovered months later when it's too late to recover costs.

### Current State Pain Points

1. **Fragmented Information**: Tariff changes are published across multiple government sources (Federal Register, USITC, CBP bulletins) that businesses don't regularly monitor
2. **Reactive Discovery**: Most businesses discover rate changes only after shipments clear customs, when losses have already occurred
3. **Manual Processes**: Checking tariff rates requires searching multiple databases for each HS code before every quote
4. **Lack of Context**: Even when changes are found, understanding their impact on specific products and margins requires manual calculation
5. **Time Pressure**: In competitive bidding situations, there's insufficient time for comprehensive tariff research

### Cost of Inaction

- **Direct Loss**: Preston's example - steel product tariffs increased from 55% to 87% without notice
- **Opportunity Cost**: Lost bids due to overpricing when using outdated (higher) rates
- **Cash Flow Impact**: Margin allocated for operations evaporates unexpectedly
- **Relationship Damage**: Unable to honor quoted prices or forced to take losses

---

## Solution Overview

### Product Vision

A dedicated monitoring system that watches specific HS codes for tariff changes and provides actionable intelligence before quotes are issued, enabling import/export businesses to protect margins and quote with confidence.

### Core Value Proposition

"Never lose money on a tariff change again. TariffGuard watches your products 24/7 and alerts you before changes impact your quotes."

### Key Capabilities

1. **Automated Monitoring**: Continuous scanning of federal sources for changes to user-specified HS codes
2. **Proactive Alerts**: Notification of proposed and enacted changes with lead time for adjustment
3. **Impact Analysis**: Automatic calculation of rate changes' effect on typical order values
4. **Historical Tracking**: Complete audit trail of rate changes with source documentation
5. **Quote Validation**: Pre-quote checker to ensure current rates are being used

---

## Target User

### Primary Persona: Import/Export Business Owner/Manager

- **Company Size**: 5-50 employees
- **Import Volume**: $1M-$50M annually
- **Products**: 5-20 regular HS codes (focused product line)
- **Current Tools**: Flexport for shipping, manual checking for tariffs
- **Technical Sophistication**: Moderate (uses SaaS tools but not developers)
- **Critical Need**: Margin protection and quote accuracy

### User Journey

1. **Trigger**: Discovers a tariff change after the fact, loses money
2. **Research**: Searches for tariff monitoring solutions
3. **Trial**: Tests with their specific HS codes
4. **Activation**: Receives first relevant alert before quoting
5. **Retention**: Avoided loss pays for subscription multiple times over

---

## Feature Specifications

### MVP Features (Launch)

#### 1. Product Monitoring Dashboard

- Add up to 10 HS codes with product descriptions
- Visual status indicators (stable/changing/at-risk)
- Current rate display with component breakdown (base + additional duties)
- 30-day trend visualization

#### 2. Alert System

- Email alerts on any rate change detection
- SMS for critical changes (>5% increase)
- Configurable frequency (immediate/daily/weekly digest)
- Federal Register proposed rule notifications with comment deadlines

#### 3. Quote Helper

- Quick rate lookup for any monitored product
- Duty calculator with current rates
- Warning if rates changed since last quote
- Export calculation for client documentation

#### 4. Change History

- Complete timeline of rate changes per HS code
- Source documentation links
- Impact calculator showing effect on standard order sizes
- Comparison with previously quoted rates

### Phase 2 Features (Month 2-3)

- API webhook integration
- Team accounts with role-based access
- Bulk HS code upload via CSV
- Custom alert rules and thresholds
- Quote history tracking and reconciliation

### Phase 3 Features (Month 4-6)

- AI-powered Federal Register interpretation
- Competitive intelligence (industry-wide tariff impacts)
- Integration with Flexport/Freightos APIs
- Landed cost optimizer
- Mobile app

---

## Technical Architecture

### Technology Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: Supabase (PostgreSQL)
- **Job Queue**: Vercel Cron + Upstash Queue
- **Notifications**: Resend (email), Twilio (SMS)
- **Monitoring**: Sentry, Vercel Analytics
- **Hosting**: Vercel Pro

### Data Sources

1. **USITC DataWeb API**: Current harmonized tariff rates
2. **Federal Register API**: Proposed rule changes
3. **CBP CSMS**: Immediate implementation notices
4. **HTSUS Database**: HS code validation and descriptions

### Security & Compliance

- SOC 2 Type I compliance roadmap
- End-to-end encryption for sensitive data
- GDPR compliant data handling
- Regular security audits

---

## Business Model

### Pricing Strategy

- **Free Tier**: 2 HS codes, weekly email alerts only (user acquisition)
- **Professional**: $99/month - 10 HS codes, daily alerts, SMS, CSV export
- **Business**: $299/month - 50 HS codes, 3 users, API access, priority support
- **Enterprise**: Custom pricing - Unlimited codes, white-label option, SLA

### Revenue Projections

- Year 1: 100 paying customers × $99 average = $118,800 ARR
- Year 2: 500 paying customers × $149 average = $894,000 ARR
- Year 3: 2000 paying customers × $199 average = $4,788,000 ARR

### Unit Economics

- CAC: $200 (primarily Google Ads + content marketing)
- LTV: $2,400 (24-month average retention)
- Gross Margin: 85% (mainly server costs)
- Payback Period: 2 months

---

## Success Metrics

### Primary KPIs

- **Alert Accuracy**: >99% (no missed changes affecting users)
- **Alert Timeliness**: <24 hours from publication
- **User Activation**: 80% set up monitoring within 24 hours
- **Weekly Active Users**: >60% check dashboard weekly
- **Revenue Retention**: >95% annual

### Secondary Metrics

- Time to first alert: <7 days average
- Support ticket volume: <5% of MAU
- Feature adoption: >40% use Quote Helper weekly
- NPS: >50

---

## Go-to-Market Strategy

### Launch Strategy (Month 1)

1. **Direct Outreach**: Contact Preston and his network for beta testing
2. **Content Marketing**: "How We Lost $50K to a Tariff Change" case studies
3. **Reddit/Forums**: Engage in r/ImportExport, TradeGecko forums
4. **Google Ads**: Target "HS code lookup" "tariff calculator" searches

### Growth Channels

- **SEO**: Build HS code lookup pages for organic traffic
- **Partnerships**: Integration with freight forwarders and customs brokers
- **Referral Program**: 20% revenue share for customer referrals
- **Trade Publications**: PR in Journal of Commerce, American Shipper

### Competitive Positioning

- **vs. Flexport**: Focused solely on tariff monitoring (does one thing perfectly)
- **vs. Manual Checking**: Automated, comprehensive, proactive
- **vs. Enterprise Solutions**: Affordable, quick setup, no contracts

---

## Risk Analysis

### Technical Risks

- **Data Source Changes**: Government APIs may change → Mitigation: Multiple data sources, scraping fallbacks
- **Scale**: High-frequency monitoring → Mitigation: Efficient caching, rate limiting
- **Accuracy**: False positives → Mitigation: Multi-source verification

### Business Risks

- **Competition**: Flexport adds similar feature → Mitigation: Focus on SMB market they underserve
- **Regulation**: Changes to data access → Mitigation: Build direct government relationships
- **Market Size**: Limited TAM → Mitigation: Expand to export monitoring, other countries

---

## Development Timeline

### Week 1-2: Core Infrastructure

- Database schema and Supabase setup
- Federal Register API integration
- Basic HS code CRUD operations
- Email notification system

### Week 3-4: Monitoring Engine

- USITC scraper implementation
- Change detection logic
- Alert triggering system
- Historical data storage

### Week 5-6: User Interface

- Dashboard design and implementation
- Quote Helper tool
- Alert preferences
- Change history view

### Week 7-8: Testing & Launch

- Beta user onboarding (Preston + 5 others)
- Bug fixes and performance optimization
- Payment integration (Stripe)
- Production deployment

---

## Team Requirements

### Immediate (MVP)

- Full-stack developer (can be AI-assisted)
- Part-time UX designer (10 hours/week)
- Founder doing product/sales/support

### 6-Month Horizon

- Customer Success Manager
- Data Engineer (optimize scrapers)
- Sales Development Rep

---

## Investment Requirements

### MVP Budget: $10,000

- Development tools and AI assistants: $500
- Infrastructure (6 months): $1,200
- Design contractor: $2,000
- Legal/compliance review: $2,000
- Initial marketing: $3,000
- Buffer: $1,300

### Series Seed Target: $500K (Month 6)

- Team expansion
- Enterprise features
- Market expansion
- Sales acceleration

---

## Conclusion

TariffGuard addresses a critical, painful problem for import/export businesses with a focused, achievable solution. The combination of accessible government data, clear monetization path, and urgent user need creates a compelling opportunity for rapid MVP development and market validation. The narrow focus on tariff monitoring (rather than comprehensive logistics) allows for quick development while solving the highest-value problem in the landed cost calculation chain.
