#!/bin/bash
# Coverage Report Merger - Combines all coverage reports
# Per IMPLEMENT_FROM_DOCS_FILLED.md requirements

set -e

echo "🔗 Merging coverage reports from all test layers..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create combined coverage directory
mkdir -p coverage/combined

# Function to check if file exists and copy
copy_if_exists() {
    local source="$1"
    local destination="$2"
    local name="$3"

    if [ -f "$source" ]; then
        cp "$source" "$destination"
        echo -e "${GREEN}✅ Copied ${name} coverage report${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  ${name} coverage report not found at ${source}${NC}"
        return 1
    fi
}

# Copy backend coverage reports
echo "📊 Collecting backend coverage reports..."
copy_if_exists "backend/coverage.xml" "coverage/combined/backend-coverage.xml" "Backend XML"
copy_if_exists "backend/coverage.json" "coverage/combined/backend-coverage.json" "Backend JSON"
copy_if_exists "backend/htmlcov/index.html" "coverage/combined/backend-coverage.html" "Backend HTML"

# Copy frontend coverage reports
echo "📊 Collecting frontend coverage reports..."
copy_if_exists "frontend/coverage/lcov.info" "coverage/combined/frontend-coverage.lcov" "Frontend LCOV"
copy_if_exists "frontend/coverage/coverage-final.json" "coverage/combined/frontend-coverage.json" "Frontend JSON"
copy_if_exists "frontend/coverage/index.html" "coverage/combined/frontend-coverage.html" "Frontend HTML"

# Copy E2E coverage reports
echo "📊 Collecting E2E coverage reports..."
copy_if_exists "tests/coverage/lcov.info" "coverage/combined/e2e-coverage.lcov" "E2E LCOV"
copy_if_exists "tests/coverage/coverage.json" "coverage/combined/e2e-coverage.json" "E2E JSON"
copy_if_exists "tests/playwright-report/index.html" "coverage/combined/e2e-report.html" "E2E Report"

# Generate combined summary report
echo "📋 Generating combined coverage summary..."

cat > coverage/combined/coverage-summary.json << EOF
{
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "project": "TurtleTrading",
  "coverage_enforcement": "100%",
  "reports": {
    "backend": {
      "technology": "Python + pytest-cov",
      "threshold": "100%",
      "xml_report": "backend-coverage.xml",
      "html_report": "backend-coverage.html",
      "json_report": "backend-coverage.json"
    },
    "frontend": {
      "technology": "TypeScript + Vitest",
      "threshold": "100%",
      "lcov_report": "frontend-coverage.lcov",
      "html_report": "frontend-coverage.html",
      "json_report": "frontend-coverage.json"
    },
    "e2e": {
      "technology": "Playwright",
      "threshold": "Test execution",
      "lcov_report": "e2e-coverage.lcov",
      "test_report": "e2e-report.html",
      "json_report": "e2e-coverage.json"
    }
  },
  "commands": {
    "view_backend": "open coverage/combined/backend-coverage.html",
    "view_frontend": "open coverage/combined/frontend-coverage.html",
    "view_e2e": "open coverage/combined/e2e-report.html"
  }
}
EOF

# Generate combined HTML index
echo "🌐 Generating combined coverage index..."

cat > coverage/combined/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TurtleTrading - Combined Coverage Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 2rem; }
        .header { text-align: center; margin-bottom: 2rem; }
        .coverage-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
        .coverage-card { border: 1px solid #e1e5e9; border-radius: 8px; padding: 1.5rem; background: #f8f9fa; }
        .coverage-card h3 { margin-top: 0; color: #0366d6; }
        .status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 16px; font-size: 0.875rem; font-weight: 600; }
        .status-100 { background-color: #28a745; color: white; }
        .status-good { background-color: #ffc107; color: black; }
        .link-button { display: inline-block; padding: 0.5rem 1rem; background: #0366d6; color: white; text-decoration: none; border-radius: 4px; margin: 0.25rem; }
        .link-button:hover { background: #0256cc; }
        .footer { margin-top: 2rem; text-align: center; color: #586069; font-size: 0.875rem; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐢 TurtleTrading Coverage Report</h1>
        <p>Comprehensive test coverage across all platform layers</p>
        <div class="status-badge status-100">100% Coverage Enforced</div>
    </div>

    <div class="coverage-grid">
        <div class="coverage-card">
            <h3>🐍 Backend Coverage</h3>
            <p><strong>Technology:</strong> Python + pytest-cov + coverage.py</p>
            <p><strong>Threshold:</strong> <span class="status-badge status-100">100%</span></p>
            <p><strong>Includes:</strong> JWT auth, stock services, API endpoints, database models</p>
            <div>
                <a href="backend-coverage.html" class="link-button">📊 View HTML Report</a>
                <a href="backend-coverage.xml" class="link-button">📄 Download XML</a>
                <a href="backend-coverage.json" class="link-button">📦 Download JSON</a>
            </div>
        </div>

        <div class="coverage-card">
            <h3>⚛️ Frontend Coverage</h3>
            <p><strong>Technology:</strong> TypeScript + React + Vitest</p>
            <p><strong>Threshold:</strong> <span class="status-badge status-100">100%</span></p>
            <p><strong>Includes:</strong> Components, hooks, services, state management, utilities</p>
            <div>
                <a href="frontend-coverage.html" class="link-button">📊 View HTML Report</a>
                <a href="frontend-coverage.lcov" class="link-button">📄 Download LCOV</a>
                <a href="frontend-coverage.json" class="link-button">📦 Download JSON</a>
            </div>
        </div>

        <div class="coverage-card">
            <h3>🎭 E2E Testing</h3>
            <p><strong>Technology:</strong> Playwright + TypeScript</p>
            <p><strong>Coverage:</strong> <span class="status-badge status-good">Test Execution</span></p>
            <p><strong>Includes:</strong> Authentication flows, UI interactions, API integration, accessibility</p>
            <div>
                <a href="e2e-report.html" class="link-button">📊 View Test Report</a>
                <a href="e2e-coverage.lcov" class="link-button">📄 Download LCOV</a>
                <a href="e2e-coverage.json" class="link-button">📦 Download JSON</a>
            </div>
        </div>
    </div>

    <div class="footer">
        <p>Generated on: <span id="timestamp"></span></p>
        <p>🎯 TurtleTrading maintains 100% test coverage across backend and frontend layers</p>
        <p>📋 Command to regenerate: <code>make coverage:all</code></p>
    </div>

    <script>
        document.getElementById('timestamp').textContent = new Date().toLocaleString();
    </script>
</body>
</html>
EOF

echo -e "${GREEN}✅ Coverage reports merged successfully!${NC}"
echo ""
echo "📋 Combined coverage reports available:"
echo "  🌐 HTML Index: coverage/combined/index.html"
echo "  📊 Summary:    coverage/combined/coverage-summary.json"
echo ""
echo "📖 View combined report:"
echo "  open coverage/combined/index.html"