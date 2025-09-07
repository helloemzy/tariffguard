# TariffGuard MVP: Complete Implementation Guide for Claude Code

## Project Overview
Build a web app that helps importers calculate tariffs using real US government data (USITC API). Users can manually enter products or upload invoices (PDFs/images) to get instant duty calculations with real-time rate monitoring.

---

## User Experience Workflows (Visual Guide)

### Flow 1: New User Journey
```
Landing Page (/)
├── Hero: "Never miss a tariff change"
├── [Start Free] button
└── Sample calculation preview

    ↓ Click [Start Free]

Login Page (/login)
├── Google Sign In button
└── "No credit card required"

    ↓ Google OAuth

Setup Page (/setup)
├── "Let's set up your workspace"
├── Company name: [________________]
├── What do you ship? [________________]
├── From where? [________________]
├── To where? [________________]
└── [Create Workspace] button

    ↓ Submit

Dashboard (/dashboard)
├── Welcome, [Company Name]
├── 4 Metric Cards:
│   ├── Monitored Products: 12
│   ├── Avg Rate Change: +2.5%
│   ├── Monthly Impact: $24,500
│   └── Active Alerts: 3
├── 6 Tariff Cards (grid):
│   └── [HS Code | Description | Rate% | Change]
└── [Calculate New Import] button
```

### Flow 2: Calculation Process (Main Feature)
```
Dashboard → Click [Calculate New Import]

Calculator Page (/calculator)

STEP 1: Manual Entry
┌─────────────────────────────────┐
│ Enter Products You're Importing │
│                                 │
│ Product    HS Code   Value  Qty │
│ [______]   [_____]   [___]  [_] │
│ [______]   [_____]   [___]  [_] │
│                                 │
│ [+ Add Another]    [Continue →] │
└─────────────────────────────────┘

    ↓ Click Continue

STEP 2: Upload Documents (Optional)
┌─────────────────────────────────┐
│     📎 Drag invoices here       │
│                                 │
│   PDF, JPG, PNG supported       │
│                                 │
│ [Skip]    [Process Documents]  │
└─────────────────────────────────┘

    ↓ Process

Loading State:
"⏳ Fetching rates from USITC..."
"✓ Retrieved rate for 8517.12"
"✓ Calculating duties..."

    ↓ Complete

RESULTS Screen:
┌─────────────────────────────────┐
│ Calculation Results             │
│ Source: USITC (Official)        │
├─────────────────────────────────┤
│ iPhone 15 | 8517.12 | 7.5%     │
│ Value: $100,000 | Duty: $7,500 │
├─────────────────────────────────┤
│ Total Import: $100,000          │
│ Total Duties: $7,500            │
│ Total Cost: $107,500            │
├─────────────────────────────────┤
│ [Save] [Export PDF] [New Calc]  │
└─────────────────────────────────┘
```

### Flow 3: Real-Time Alerts
```
User on any page
    ↓
Rate change detected (background)
    ↓
Toast notification (top-right):
┌─────────────────────────┐
│ ⚠️ Tariff Alert        │
│ 8517.12: 5% → 7.5%     │
│ [Details] [Dismiss]     │
└─────────────────────────┘
```

---

## Technical Architecture (Simple)

```yaml
Frontend: Next.js 14 (App Router)
Styling: Tailwind CSS
Database: Supabase (PostgreSQL + Auth + Realtime)
Document Processing: 
  - Tesseract.js (OCR for images)
  - PDF.js (text extraction from PDFs)
External API:
  - USITC API (official US tariff rates)
Deployment: Vercel
Background Jobs: Vercel Cron
```

---

## Database Schema

```sql
-- Run this in Supabase SQL Editor

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  company_name TEXT,
  products TEXT,
  route_from TEXT,
  route_to TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tariff_rates (
  hs_code TEXT PRIMARY KEY,
  description TEXT,
  rate DECIMAL(5,2),
  previous_rate DECIMAL(5,2),
  source TEXT DEFAULT 'USITC',
  last_verified TIMESTAMP DEFAULT NOW()
);

CREATE TABLE calculations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  name TEXT,
  line_items JSONB,
  total_value DECIMAL(10,2),
  total_duty DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  hs_code TEXT,
  old_rate DECIMAL(5,2),
  new_rate DECIMAL(5,2),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed sample data
INSERT INTO tariff_rates (hs_code, description, rate, previous_rate) VALUES
('8517.12', 'Smartphones', 7.5, 5.0),
('8471.30', 'Laptops', 0, 0),
('6109.10', 'Cotton T-shirts', 16.5, 16.5),
('6403.99', 'Footwear', 37.5, 35.0);
```

---

## Core Features to Build

### 1. Authentication (Google OAuth)
- Use Supabase Auth
- Single sign-on with Google
- Redirect to setup or dashboard

### 2. Dashboard
- Show 4 key metrics
- Display 6 tariff cards from database
- Real-time alert notifications
- Link to calculator

### 3. Calculator (Main Feature)
**Step 1**: Manual entry form
- Product name, HS code, value, quantity
- Add multiple rows
- Continue button

**Step 2**: Document upload
- Drag-and-drop zone
- Process PDFs with PDF.js
- Process images with Tesseract.js
- Extract HS codes and values

**Step 3**: Results
- Fetch rates from USITC API
- Calculate duties
- Show breakdown
- Save to database

### 4. USITC API Integration
```typescript
// How to fetch real tariff rates:
async function getUSITCRate(hsCode: string) {
  // Check cache first (24 hour old is OK)
  const cached = await checkCache(hsCode);
  if (cached) return cached;
  
  // Fetch from USITC
  const response = await fetch(
    `https://api.usitc.gov/tariff/v2/search?hts=${hsCode}`
  );
  const data = await response.json();
  
  // Parse rate (might be "Free" or "7.5%")
  const rate = parseFloat(data.results[0]?.duty_rate) || 0;
  
  // Cache for 24 hours
  await saveToCache(hsCode, rate);
  
  return rate;
}
```

### 5. Document Processing
```typescript
// For PDFs:
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// For images (OCR):
import Tesseract from 'tesseract.js';
// First run downloads language data (15MB)

// Extract HS codes from text:
const hsCodeRegex = /\b\d{4}\.?\d{2}\b/g;
const matches = text.match(hsCodeRegex);
```

### 6. Background Rate Monitoring
- Vercel Cron job every 6 hours
- Check USITC API for rate changes
- Create alerts when rates change
- Broadcast via Supabase Realtime

---

## File Structure

```
/app
  /page.tsx              # Landing page
  /login/page.tsx        # Google auth
  /setup/page.tsx        # Workspace setup
  /dashboard/page.tsx    # Main dashboard
  /calculator/page.tsx   # 3-step calculator
  /api
    /cron
      /check-rates/route.ts  # Rate monitoring
/components
  /DocumentUpload.tsx    # File processor
  /Calculator.tsx        # Calculation form
  /TariffCard.tsx       # Rate display card
/lib
  /supabase.ts          # Database client
  /usitc-api.ts         # USITC API client
  /document-processor.ts # OCR/PDF logic
```

---

## Environment Variables

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
CRON_SECRET=random_string_for_security
```

---

## Step-by-Step Implementation

### Day 1-2: Setup & Auth
1. Create Next.js app with TypeScript and Tailwind
2. Set up Supabase project and tables
3. Implement Google OAuth login
4. Create setup flow for new users

### Day 3-4: Dashboard
1. Build metric cards
2. Create tariff grid
3. Add navigation
4. Style with Tailwind (clean, minimal)

### Day 5-6: Calculator
1. Build manual entry form
2. Add document upload with react-dropzone
3. Integrate PDF.js and Tesseract.js
4. Connect to USITC API

### Day 7-8: Polish & Deploy
1. Add loading states
2. Implement error handling
3. Create toast notifications
4. Deploy to Vercel
5. Set up cron job

---

## Key Implementation Notes

### USITC API
- Free to use, no API key needed
- Returns rates as strings ("7.5%" or "Free")
- Cache responses for 24 hours
- Fallback to database if API fails

### Document Processing
- Process files client-side (no upload needed)
- PDF.js extracts text from PDFs
- Tesseract.js does OCR on images
- Look for patterns like "8517.12" for HS codes

### Real-time Updates
- Use Supabase Realtime for instant alerts
- Subscribe to database changes
- Show toast notifications

### Design Guidelines
- Clean, minimal interface
- White cards on gray background
- Black primary buttons
- Red for alerts/warnings
- Show data sources (builds trust)

---

## Testing Checklist

- [ ] Can create account with Google
- [ ] Setup flow saves workspace
- [ ] Dashboard shows real tariffs
- [ ] Manual entry calculates correctly
- [ ] PDF upload extracts text
- [ ] USITC API returns rates
- [ ] Results show with attribution
- [ ] Calculations save to database
- [ ] Toast alerts appear
- [ ] Mobile responsive

---

## Demo Script (2 minutes)

1. **Problem** (15s): Show spreadsheet chaos
2. **Solution** (10s): "Real-time federal tariff data"
3. **Sign up** (15s): Google login → Quick setup
4. **Calculate** (40s):
   - Enter: "iPhone, 8517.12, $1000, 100"
   - Show: "Fetching from USITC..."
   - Result: "$7,500 duty (7.5% rate)"
   - Upload invoice → Extract more items
5. **Alert** (20s): Toast shows rate change
6. **Value** (20s): "Save $25,000 with real-time data"

---

## Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| PDF.js not working | Check worker URL path |
| Tesseract slow | First run downloads data (wait) |
| USITC API fails | Use cached rates from database |
| No Google auth | Enable in Supabase dashboard |
| Cron not running | Add CRON_SECRET to Vercel |

This guide gives Claude Code everything needed: visual flows, technical details, and implementation steps in a clear, structured format.