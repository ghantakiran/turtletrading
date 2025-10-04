# Issue: Backend Infrastructure & Environment Setup

**Created**: 2025-10-03
**Severity**: 🔴 Critical
**Priority**: 🔥 High
**Status**: Open

## Problem Statement

The backend server cannot start due to multiple infrastructure, dependency, and configuration issues. This is blocking all API endpoints and preventing the frontend from loading stock data.

## Discovered Issues

### 1. Missing Python Dependencies
- **Package**: `scikit-learn` (required for ML models)
  - Status: ✅ Installed manually
  - File: `backend/app/services/anomaly_detection.py`

- **Package**: `arch` (required for GARCH models)
  - Status: ✅ Installed manually
  - File: `backend/app/services/anomaly_detection.py`

- **Issue**: Dependencies not in `requirements.txt` or venv

### 2. Outdated Requirements File
- **File**: `backend/requirements.txt`
- **Issue**: Specifies `tensorflow==2.15.0` which is incompatible with Python 3.12
- **Available versions**: 2.16.0+, but not 2.15.0
- **Impact**: Cannot install dependencies via `pip install -r requirements.txt`

### 3. Missing Core Modules
- **Module**: `app.core.cache`
  - File: `backend/app/core/cache.py` does not exist
  - Used by: `backend/app/services/anomaly_detection.py`
  - Impact: Backend fails to import
  - Workaround: ✅ Commented out cache imports

- **Model**: `StockData` class
  - Expected in: `backend/app/models/schemas.py`
  - Status: Does not exist
  - Used by: `backend/app/services/anomaly_detection.py`
  - Workaround: ✅ Commented out import

### 4. Pydantic v2 Incompatibility
- **Issue**: Code uses deprecated `regex=` parameter instead of `pattern=`
- **Status**: ✅ Fixed - replaced all `regex=` with `pattern=` across model files
- **Files affected**:
  - `backend/app/models/schemas.py`
  - `backend/app/models/sentiment_ingestion_models.py`
  - `backend/app/models/execution_models.py`

### 5. Authentication Function Missing
- **File**: `backend/app/core/auth.py`
- **Issue**: `get_current_user()` function missing after authentication was disabled
- **Status**: ✅ Fixed - added stub function
- **Used by**: `backend/app/api/v1/scanners.py`

### 6. Incorrect Import Paths
- **File**: `backend/app/api/v1/scanners.py` line 25
- **Issue**: Imports from `...models.auth` instead of `...models.auth_schemas`
- **Status**: ✅ Fixed

### 7. External Service Dependencies
- **Service**: Redis
  - Expected at: `localhost:6379`
  - Status: Not running (warnings in logs)
  - Impact: Rate limiting and caching unavailable

## Current Workarounds Applied

```python
# backend/app/core/auth.py (Line 333-341)
async def get_current_user(token: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Stub function for getting current user.
    Returns None since authentication is currently disabled (Issue #2).
    This allows API endpoints to work without authentication.
    """
    # Authentication temporarily disabled - return None
    # TODO: Re-implement when authentication system is re-enabled (Issue #2, #3)
    return None

# backend/app/services/anomaly_detection.py (Lines 24-26)
# from app.core.cache import cache_manager  # TODO: Re-enable when cache module exists
from app.services.stock_service import StockService
# from app.models.schemas import StockData  # TODO: StockData class doesn't exist, needs to be created

# backend/app/services/anomaly_detection.py (Line 677)
# @cache_manager.cached(ttl=300, key_prefix="anomaly_detection")  # TODO: Re-enable when cache exists

# backend/app/api/v1/scanners.py (Line 25)
from ...models.auth_schemas import User  # Fixed from ...models.auth
```

## Files Modified

1. ✅ `backend/app/core/auth.py` - Added `get_current_user()` stub
2. ✅ `backend/app/api/v1/scanners.py` - Fixed import path
3. ✅ `backend/app/models/schemas.py` - Changed `regex=` to `pattern=`
4. ✅ `backend/app/models/sentiment_ingestion_models.py` - Changed `regex=` to `pattern=`
5. ✅ `backend/app/models/execution_models.py` - Changed `regex=` to `pattern=`
6. ✅ `backend/app/services/anomaly_detection.py` - Commented out cache and StockData imports

## Recommended Solutions

### Immediate Priority (P0)
1. **Create Missing Modules**
   - [ ] Create `backend/app/core/cache.py` with basic cache manager
   - [ ] Add `StockData` model to `backend/app/models/schemas.py`

2. **Fix Requirements**
   - [ ] Update `requirements.txt` to use Python 3.12 compatible versions
   - [ ] Add missing dependencies: `scikit-learn`, `arch`
   - [ ] Update TensorFlow to compatible version (2.16.0+) or make optional

3. **Documentation**
   - [ ] Create `backend/SETUP.md` with environment setup instructions
   - [ ] Document required external services (Redis, PostgreSQL)
   - [ ] Add troubleshooting guide

### High Priority (P1)
4. **Docker Setup**
   - [ ] Create `docker-compose.yml` for backend services
   - [ ] Include Redis, PostgreSQL containers
   - [ ] Add backend Dockerfile with all dependencies

5. **Dependency Management**
   - [ ] Pin all dependency versions in requirements.txt
   - [ ] Create `requirements-dev.txt` for development dependencies
   - [ ] Add dependency lock file (e.g., `requirements.lock`)

### Medium Priority (P2)
6. **Environment Configuration**
   - [ ] Create `.env.example` with all required environment variables
   - [ ] Add environment validation on startup
   - [ ] Document configuration options

7. **Health Checks**
   - [ ] Improve `/health` endpoint to check all dependencies
   - [ ] Add startup checks for required services
   - [ ] Provide clear error messages for missing dependencies

## Acceptance Criteria

- [ ] Backend starts successfully with `uvicorn app.main:app --reload`
- [ ] All API endpoints are accessible
- [ ] `/health` endpoint returns 200 OK
- [ ] No import errors in logs
- [ ] Dependencies can be installed via `pip install -r requirements.txt`
- [ ] Documentation exists for setting up development environment
- [ ] Docker Compose setup works for local development

## Impact

**Severity**: 🔴 Critical
**Priority**: 🔥 High
**Blocking**: Yes - prevents all backend functionality

**Affected Components**:
- All API endpoints
- Stock analysis page
- Real-time data streaming
- Authentication system
- Background jobs

## Related Issues

- Issue #4: Stock Analysis Page - Data Loading (blocked by this issue)
- Issue #2: Authentication System Temporarily Disabled

## Environment

- Python: 3.12
- OS: macOS (Darwin 24.6.0)
- Current working directory: `/Users/kiranreddyghanta/TurtleTrading/backend`
- Virtual Environment: `/Users/kiranreddyghanta/TurtleTrading/backend/venv`

## Investigation Timeline

**Date**: 2025-10-03

1. **17:40** - Started investigating Issue #4 (Stock Analysis Page not loading)
2. **17:43** - Backend not responding to health checks
3. **17:45** - Discovered missing `get_current_user` import error
4. **17:50** - Fixed auth import, found missing `sklearn` dependency
5. **18:00** - Installed `sklearn`, found missing `arch` dependency
6. **18:05** - Installed `arch`, found Pydantic v2 incompatibility
7. **18:10** - Fixed Pydantic issues, found missing `cache` module
8. **18:15** - Commented out cache imports, found missing `StockData` model
9. **18:20** - Applied all workarounds, backend still failing with additional errors

**Total Issues Found**: 7 major infrastructure problems

## Notes

The backend infrastructure has significant technical debt and missing components. This suggests:
1. Incomplete migration to Pydantic v2
2. Missing module implementations
3. Outdated dependency specifications
4. Lack of development environment documentation

A comprehensive infrastructure overhaul is needed to make the backend production-ready.

---

🤖 Investigation completed with [Claude Code](https://claude.com/claude-code)
