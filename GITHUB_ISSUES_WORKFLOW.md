# GitHub Issues Resolution Workflow

## Current Status: Issue #4 - Stock Analysis Data Loading

### Issue Analysis
**Problem**: Stock Analysis page (`/analysis/AAPL`) fails with error "Unable to fetch data for AAPL"
**Root Cause**: Deployed Vercel instance likely missing proper API configuration or environment variables
**Priority**: Critical (blocks core functionality)

---

## TDD Workflow for Issue #4

### ✅ Phase 1: RED - Write Failing Tests (COMPLETED)

**Test File Created**: `backend/tests/test_issue_4_stock_analysis.py`

**Test Coverage**:
- ✅ Basic AAPL analysis endpoint test
- ✅ Query parameter validation
- ✅ Error handling tests
- ✅ Performance tests
- ✅ Concurrent request tests
- ✅ Caching tests
- ✅ Integration tests

**Command to Run Tests**:
```bash
cd /Users/kiranreddyghanta/TurtleTrading/backend
python3 -m pytest tests/test_issue_4_stock_analysis.py -v
```

### 🔄 Phase 2: GREEN - Fix Implementation (IN PROGRESS)

**Backend Analysis**:
- Stock service code is well-structured (`app/services/stock_service.py`)
- Has yfinance + Alpha Vantage fallback
- Comprehensive error handling exists
- Rate limiting implemented

**API Endpoint**: `/api/v1/stocks/{symbol}/analysis` (in `app/api/endpoints/stocks.py`)

**Likely Issues**:
1. Missing environment variables in Vercel deployment
2. API keys not configured (Alpha Vantage, etc.)
3. CORS configuration for Vercel domain
4. Cache configuration (Redis optional but referenced)

**Fix Steps**:
```bash
# 1. Test locally first
cd backend
uvicorn app.main:app --reload --port 8000

# 2. Test endpoint
curl http://localhost:8000/api/v1/stocks/AAPL/price
curl http://localhost:8000/api/v1/stocks/AAPL/analysis

# 3. Check environment variables needed
cat .env.example

# 4. Run tests
python3 -m pytest tests/test_issue_4_stock_analysis.py -v

# 5. Deploy to Vercel
vercel --prod

# 6. Verify production
curl https://your-app.vercel.app/api/v1/stocks/AAPL/analysis
```

### Phase 3: E2E Testing

**E2E Test File**: `tests/e2e-stock-analysis.spec.ts` (TO CREATE)

```typescript
// tests/e2e-stock-analysis.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Issue #4: Stock Analysis Page', () => {
  test('should load AAPL stock analysis successfully', async ({ page }) => {
    await page.goto('/analysis/AAPL');

    // Should not show error message
    await expect(page.getByText('Unable to fetch data')).not.toBeVisible();

    // Should show stock data
    await expect(page.getByText('AAPL')).toBeVisible();
    await expect(page.getByText(/\$\d+\.\d+/)).toBeVisible(); // Price

    // Should show analysis components
    await expect(page.getByText('Technical Indicators')).toBeVisible();
    await expect(page.getByText('AI Prediction')).toBeVisible();
  });
});
```

**Run E2E Tests**:
```bash
cd /Users/kiranreddyghanta/TurtleTrading/tests
npm test -- e2e-stock-analysis.spec.ts
```

### Phase 4: Deployment & Verification

**Vercel Deployment Checklist**:
- [ ] Environment variables configured
  - `ALPHA_VANTAGE_API_KEY`
  - `DATABASE_URL` (if needed)
  - `REDIS_URL` (optional, falls back gracefully)
  - `CORS_ORIGINS` (include Vercel domain)
- [ ] API routes properly configured
- [ ] Build succeeds
- [ ] Health check passes
- [ ] Stock analysis endpoint returns 200

**Deploy Commands**:
```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Set environment variables
vercel env add ALPHA_VANTAGE_API_KEY
# (paste API key)

# Redeploy
vercel --prod --force
```

**Verification**:
```bash
# Test deployed API
DEPLOY_URL="https://your-app.vercel.app"

curl $DEPLOY_URL/health
curl $DEPLOY_URL/api/v1/stocks/AAPL/price
curl $DEPLOY_URL/api/v1/stocks/AAPL/analysis

# Run E2E against production
PLAYWRIGHT_BASE_URL=$DEPLOY_URL npm test
```

### Phase 5: Close GitHub Issue

**Steps**:
1. Verify fix on production
2. Document the fix
3. Close issue with comment

**Command**:
```bash
gh issue close 4 --comment "Fixed stock analysis data loading issue.

**Changes Made**:
- Added comprehensive unit tests (test_issue_4_stock_analysis.py)
- Configured proper environment variables in Vercel
- Verified yfinance + Alpha Vantage fallback mechanism
- Added E2E tests for stock analysis page

**Testing**:
- Unit tests: ✅ All passing
- E2E tests: ✅ Verified on production
- Manual testing: ✅ AAPL and other symbols load successfully

**Deployment**: https://your-app.vercel.app/analysis/AAPL

Fixes #4"
```

---

## Next Issues Queue

### Issue #6: Stock Search Error (Priority: High)
- Similar to Issue #4
- Search functionality broken
- Same fix approach likely applies

### Issue #5: AI Analysis Page 404 (Priority: High)
- Missing Next.js page file
- Need to create: `frontend-nextjs/src/app/analysis/page.tsx`

### Issue #7: Settings Page 404 (Priority: Medium)
- Missing Next.js page file
- Need to create: `frontend-nextjs/src/app/settings/page.tsx`

### Issue #9: Watchlist Functionality (Priority: Medium)
- Frontend component not implemented
- Need watchlist state management + UI

### Issue #10: Notification Button (Priority: Medium)
- Frontend component not implemented
- Need notification system + UI

### Issue #11: AI Insights Button (Priority: High)
- Frontend component not implemented
- Need AI insights panel/modal + backend integration

---

## Testing Infrastructure

### Backend Tests (pytest)
```bash
cd backend

# Run all tests
python3 -m pytest tests/ -v

# Run specific test file
python3 -m pytest tests/test_issue_4_stock_analysis.py -v

# Run with coverage
python3 -m pytest tests/ --cov=app --cov-report=html

# Run integration tests (requires APIs)
python3 -m pytest tests/ -m integration -v
```

### Frontend E2E Tests (Playwright)
```bash
cd tests

# Run all E2E tests
npm test

# Run specific test
npm test -- stock-analysis.spec.ts

# Run with UI
npm test -- --ui

# Run against production
PLAYWRIGHT_BASE_URL=https://your-app.vercel.app npm test
```

### Continuous Integration
GitHub Actions workflow (`.github/workflows/test.yml`):
```yaml
name: Test & Deploy

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run backend tests
        run: |
          cd backend
          pip install -r requirements.txt
          pytest tests/ -v

      - name: Run E2E tests
        run: |
          cd tests
          npm install
          npm test

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

---

## Environment Variables Required

### Backend (.env)
```bash
# API Keys
ALPHA_VANTAGE_API_KEY=your_api_key_here

# Database (optional for testing)
DATABASE_URL=postgresql://user:pass@localhost/turtletrading

# Redis (optional, graceful fallback)
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGINS=http://localhost:3000,https://your-app.vercel.app

# Logging
LOG_LEVEL=INFO
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_API_BASE_URL_PROD=https://your-backend.vercel.app
```

### Vercel Environment Variables
Set these in Vercel dashboard or via CLI:
- `ALPHA_VANTAGE_API_KEY`
- `CORS_ORIGINS`
- `DATABASE_URL` (if using database)
- `REDIS_URL` (if using Redis)

---

## Success Criteria

### Issue #4 Complete When:
- ✅ Unit tests pass
- ✅ E2E tests pass
- ✅ `/analysis/AAPL` loads without error on production
- ✅ All stock symbols work (AAPL, MSFT, GOOGL, TSLA)
- ✅ Error handling is robust
- ✅ GitHub issue closed with documentation

### Overall Workflow Complete When:
- All critical issues (#4, #6) resolved
- All high-priority missing pages created (#5, #7, #11)
- Medium-priority features implemented (#8, #9, #10)
- Comprehensive test coverage (>80%)
- Production deployment stable
- All GitHub issues closed

---

## Useful Commands Reference

```bash
# Backend
cd /Users/kiranreddyghanta/TurtleTrading/backend
python3 -m uvicorn app.main:app --reload --port 8000
python3 -m pytest tests/ -v
python3 -m pytest tests/ --cov=app

# Frontend
cd /Users/kiranreddyghanta/TurtleTrading/frontend-nextjs
npm run dev
npm run build
npm test

# E2E Tests
cd /Users/kiranreddyghanta/TurtleTrading/tests
npm test
npm test -- --ui
npx playwright show-report

# Deployment
vercel
vercel --prod
vercel env ls
vercel logs

# GitHub
gh issue list
gh issue view 4
gh issue close 4 --comment "Fixed"
gh pr create --title "Fix Issue #4" --body "Fixes #4"

# Docker (if needed)
docker-compose up -d
docker-compose logs -f backend
docker-compose down
```

---

**Last Updated**: October 2, 2025
**Status**: Issue #4 - TDD Red phase complete, moving to Green phase
**Next Step**: Run tests locally, fix any failures, deploy to Vercel
