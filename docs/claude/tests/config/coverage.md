# Coverage Configuration (100% enforced)

- **Tooling (language/framework)**:
  - **Backend**: Python with pytest-cov and coverage.py
  - **Frontend**: Vitest with v8 coverage provider
  - **E2E**: Playwright with code coverage collection
  - **Integration**: Combined coverage reporting across all layers

- **Commands to run locally**:

## Backend Coverage (Python/FastAPI)
```bash
# Install coverage dependencies
pip install pytest pytest-cov pytest-asyncio coverage

# Run unit tests with coverage
cd backend
pytest --cov=app --cov-report=html --cov-report=term --cov-report=xml --cov-fail-under=100

# Detailed coverage report
coverage report --show-missing --fail-under=100

# Generate HTML coverage report
coverage html
open htmlcov/index.html  # View detailed coverage report

# Coverage for specific modules
pytest tests/test_stock_service.py --cov=app.services.stock_service --cov-report=term-missing
```

## Frontend Coverage (TypeScript/React/Vitest)
```bash
# Install testing dependencies
cd frontend
npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom

# Run unit tests with coverage
npm run test:coverage

# Generate detailed coverage report
npm run test:coverage -- --reporter=html
open coverage/index.html

# Watch mode with coverage
npm run test:watch -- --coverage

# Coverage for specific components
npx vitest run --coverage src/components/StockAnalysis.test.tsx
```

## E2E Coverage (Playwright)
```bash
# Install Playwright coverage tools
cd tests
npm install --save-dev @playwright/test playwright-coverage

# Run E2E tests with coverage
npm run test:e2e:coverage

# Generate combined coverage report (frontend + E2E)
npm run coverage:merge

# View E2E coverage report
open playwright-report/coverage/index.html
```

## Combined Coverage Report
```bash
# Generate unified coverage report across all layers
cd /Users/kiranreddyghanta/TurtleTrading
make coverage:all

# Commands defined in Makefile:
# make coverage:backend    # Backend Python coverage
# make coverage:frontend   # Frontend TypeScript coverage
# make coverage:e2e        # E2E Playwright coverage
# make coverage:merge      # Merge all coverage reports
# make coverage:enforce    # Fail if any module < 100%
```

- **CI configuration (threshold gates)**:

## GitHub Actions Workflow (.github/workflows/test-coverage.yml)
```yaml
name: Test Coverage Enforcement

on: [push, pull_request]

jobs:
  backend-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest-cov coverage

      - name: Run backend tests with coverage
        run: |
          cd backend
          pytest --cov=app --cov-report=xml --cov-fail-under=100

      - name: Upload backend coverage
        uses: codecov/codecov-action@v3
        with:
          file: backend/coverage.xml
          flags: backend
          fail_ci_if_error: true

  frontend-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Run frontend tests with coverage
        run: |
          cd frontend
          npm run test:coverage -- --run

      - name: Enforce 100% coverage threshold
        run: |
          cd frontend
          npm run coverage:check  # Custom script that fails if < 100%

      - name: Upload frontend coverage
        uses: codecov/codecov-action@v3
        with:
          file: frontend/coverage/lcov.info
          flags: frontend
          fail_ci_if_error: true

  e2e-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: |
          cd tests
          npm ci
          npx playwright install

      - name: Start services for E2E tests
        run: |
          docker-compose up -d --build
          # Wait for services to be ready
          ./scripts/wait-for-services.sh

      - name: Run E2E tests with coverage
        run: |
          cd tests
          npm run test:e2e:coverage

      - name: Upload E2E coverage
        uses: codecov/codecov-action@v3
        with:
          file: tests/coverage/lcov.info
          flags: e2e
          fail_ci_if_error: true

  coverage-merge:
    needs: [backend-coverage, frontend-coverage, e2e-coverage]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download all coverage reports
        uses: actions/download-artifact@v3

      - name: Merge coverage reports
        run: |
          ./scripts/merge-coverage.sh

      - name: Enforce combined 100% coverage
        run: |
          ./scripts/enforce-coverage-thresholds.sh
          # Fails CI if any module below 100%

      - name: Generate coverage badge
        run: |
          ./scripts/generate-coverage-badge.sh
```

## Coverage Enforcement Scripts
```bash
# scripts/enforce-coverage-thresholds.sh
#!/bin/bash
set -e

echo "Enforcing 100% coverage thresholds..."

# Backend coverage check
cd backend
coverage report --fail-under=100 || {
    echo "❌ Backend coverage below 100%"
    exit 1
}

# Frontend coverage check
cd ../frontend
npm run coverage:check || {
    echo "❌ Frontend coverage below 100%"
    exit 1
}

# E2E coverage check
cd ../tests
./check-e2e-coverage.sh || {
    echo "❌ E2E coverage below 100%"
    exit 1
}

echo "✅ All modules meet 100% coverage requirement"
```

- **Reporting (HTML/LCOV/JUnit)**:

## Coverage Report Formats
```json
{
  "coverage_formats": {
    "backend": {
      "html": "backend/htmlcov/index.html",
      "xml": "backend/coverage.xml",
      "json": "backend/coverage.json",
      "terminal": "pytest --cov-report=term-missing"
    },
    "frontend": {
      "html": "frontend/coverage/index.html",
      "lcov": "frontend/coverage/lcov.info",
      "json": "frontend/coverage/coverage-final.json",
      "text": "frontend/coverage/coverage.txt"
    },
    "e2e": {
      "html": "tests/coverage/index.html",
      "lcov": "tests/coverage/lcov.info",
      "json": "tests/coverage/coverage.json"
    },
    "combined": {
      "html": "coverage/combined/index.html",
      "json": "coverage/combined/coverage.json",
      "badge": "coverage/badge.svg"
    }
  }
}
```

## Package.json Scripts (Frontend)
```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch",
    "coverage:check": "vitest run --coverage --reporter=json && node scripts/check-coverage.js",
    "coverage:html": "vitest run --coverage --reporter=html",
    "coverage:lcov": "vitest run --coverage --reporter=lcov"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "@vitest/ui": "^1.0.0"
  }
}
```

## Pytest Configuration (Backend)
```ini
# pytest.ini
[tool:pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts =
    --cov=app
    --cov-report=html
    --cov-report=term-missing
    --cov-report=xml
    --cov-fail-under=100
    --strict-markers
    --disable-warnings
asyncio_mode = auto

[coverage:run]
source = app
omit =
    app/main.py
    */tests/*
    */venv/*
    */__pycache__/*

[coverage:report]
precision = 2
show_missing = true
skip_covered = false
exclude_lines =
    pragma: no cover
    def __repr__
    raise AssertionError
    raise NotImplementedError
```

- **How to debug missed lines/branches**:

## Coverage Debugging Guide
```bash
# 1. Generate detailed HTML report
cd backend
pytest --cov=app --cov-report=html
open htmlcov/index.html

# 2. Identify missed lines
coverage report --show-missing

# 3. Debug specific module
pytest tests/test_stock_service.py --cov=app.services.stock_service --cov-report=term-missing -v

# 4. Branch coverage analysis
coverage report --show-missing --skip-covered

# 5. Interactive coverage debugging
coverage debug sys  # Show coverage configuration
coverage debug data  # Show coverage data file location

# 6. Find untested code paths
coverage html --show-contexts
# Open htmlcov/index.html and look for red (uncovered) lines

# 7. Test specific scenarios for missed branches
pytest tests/ -k "test_error_handling" --cov-branch --cov-report=term-missing
```

## Frontend Coverage Debugging
```bash
# 1. Detailed component coverage
cd frontend
npx vitest run --coverage --reporter=verbose src/components/

# 2. Interactive coverage UI
npx vitest --ui --coverage

# 3. Coverage for specific files
npx vitest run --coverage src/services/stockService.ts

# 4. Debug uncovered branches
npm run test:coverage -- --reporter=html
open coverage/index.html
# Look for yellow (partial) and red (uncovered) lines

# 5. Component interaction testing
npx vitest run --coverage src/components/ src/hooks/
```

## Common Coverage Issues and Solutions
```bash
# Issue: Async code not covered
# Solution: Use proper async test patterns
async def test_async_function():
    result = await async_function()
    assert result is not None

# Issue: Exception handling not covered
# Solution: Test both success and failure paths
def test_error_handling():
    with pytest.raises(CustomException):
        function_that_raises()

# Issue: Complex conditional logic not covered
# Solution: Test all branch combinations
@pytest.mark.parametrize("condition,expected", [
    (True, "success"),
    (False, "failure")
])
def test_conditional_logic(condition, expected):
    result = complex_function(condition)
    assert result == expected

# Issue: React component props not covered
# Solution: Test all prop variations
test('Component with different props', () => {
    render(<Component variant="primary" />)
    render(<Component variant="secondary" />)
    render(<Component disabled={true} />)
})
```

## Coverage Enforcement Scripts

### Backend Coverage Enforcement
```bash
# scripts/enforce-coverage-thresholds.sh
#!/bin/bash
set -e

echo "Enforcing 100% coverage thresholds..."

# Backend coverage check
cd backend
coverage report --fail-under=100 || {
    echo "❌ Backend coverage below 100%"
    exit 1
}

# Frontend coverage check
cd ../frontend
npm run coverage:check || {
    echo "❌ Frontend coverage below 100%"
    exit 1
}

# E2E coverage check
cd ../tests
./check-e2e-coverage.sh || {
    echo "❌ E2E coverage below 100%"
    exit 1
}

echo "✅ All modules meet 100% coverage requirement"
```

### Frontend Coverage Check Script
```javascript
// frontend/scripts/check-coverage.js
const fs = require('fs');
const path = require('path');

const coverageFile = path.join(__dirname, '../coverage/coverage-final.json');

if (!fs.existsSync(coverageFile)) {
    console.error('❌ Coverage file not found');
    process.exit(1);
}

const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
const thresholds = {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100
};

let failed = false;

Object.entries(thresholds).forEach(([metric, threshold]) => {
    const total = Object.values(coverage).reduce((acc, file) => {
        return {
            covered: acc.covered + file[metric].covered,
            total: acc.total + file[metric].total
        };
    }, { covered: 0, total: 0 });

    const percentage = (total.covered / total.total) * 100;

    if (percentage < threshold) {
        console.error(`❌ ${metric} coverage: ${percentage.toFixed(2)}% < ${threshold}%`);
        failed = true;
    } else {
        console.log(`✅ ${metric} coverage: ${percentage.toFixed(2)}%`);
    }
});

if (failed) {
    process.exit(1);
}

console.log('✅ All coverage thresholds met');
```

### E2E Coverage Check Script
```bash
# tests/check-e2e-coverage.sh
#!/bin/bash
set -e

COVERAGE_FILE="coverage/coverage-final.json"

if [ ! -f "$COVERAGE_FILE" ]; then
    echo "❌ E2E coverage file not found"
    exit 1
fi

# Extract coverage percentage using jq
COVERAGE_PERCENT=$(jq -r '
    [.[].statements | (.covered / .total * 100)] | add / length
' "$COVERAGE_FILE")

THRESHOLD=100

if (( $(echo "$COVERAGE_PERCENT < $THRESHOLD" | bc -l) )); then
    echo "❌ E2E coverage: ${COVERAGE_PERCENT}% < ${THRESHOLD}%"
    exit 1
fi

echo "✅ E2E coverage: ${COVERAGE_PERCENT}%"
```

## Coverage Badge Generation
```bash
# scripts/generate-coverage-badge.sh
#!/bin/bash
set -e

# Extract backend coverage percentage
BACKEND_COVERAGE=$(cd backend && coverage report | grep TOTAL | awk '{print $4}' | sed 's/%//')

# Extract frontend coverage percentage
FRONTEND_COVERAGE=$(cd frontend && npm run coverage:check 2>/dev/null | grep "statements coverage" | awk '{print $3}' | sed 's/%//')

# Calculate combined coverage
COMBINED_COVERAGE=$(echo "scale=1; ($BACKEND_COVERAGE + $FRONTEND_COVERAGE) / 2" | bc)

# Generate badge color based on coverage
if (( $(echo "$COMBINED_COVERAGE >= 100" | bc -l) )); then
    COLOR="brightgreen"
elif (( $(echo "$COMBINED_COVERAGE >= 90" | bc -l) )); then
    COLOR="green"
elif (( $(echo "$COMBINED_COVERAGE >= 80" | bc -l) )); then
    COLOR="yellow"
else
    COLOR="red"
fi

# Generate badge URL
BADGE_URL="https://img.shields.io/badge/coverage-${COMBINED_COVERAGE}%25-${COLOR}"

# Create badge SVG
curl -s "$BADGE_URL" > coverage/badge.svg

echo "✅ Coverage badge generated: ${COMBINED_COVERAGE}%"
```

## Merge Coverage Reports Script
```bash
# scripts/merge-coverage.sh
#!/bin/bash
set -e

echo "Merging coverage reports from all modules..."

# Create combined coverage directory
mkdir -p coverage/combined

# Backend coverage (convert to LCOV format)
cd backend
coverage lcov -o ../coverage/backend.lcov

# Frontend coverage (already in LCOV format)
cd ../frontend
cp coverage/lcov.info ../coverage/frontend.lcov

# E2E coverage (already in LCOV format)
cd ../tests
cp coverage/lcov.info ../coverage/e2e.lcov

# Merge all LCOV files
cd ../coverage
lcov -a backend.lcov -a frontend.lcov -a e2e.lcov -o combined.lcov

# Generate combined HTML report
genhtml combined.lcov -o combined/

echo "✅ Combined coverage report generated at coverage/combined/index.html"
```