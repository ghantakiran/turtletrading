#!/usr/bin/env node
/**
 * Frontend Coverage Validation Script
 * Validates that coverage meets 100% thresholds for all metrics
 * Per IMPLEMENT_FROM_DOCS_FILLED.md requirements
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_FILE = path.join(__dirname, '../frontend/coverage/coverage-final.json');
const REQUIRED_THRESHOLD = 100;

function checkCoverage() {
  console.log('🔍 Checking frontend coverage thresholds...');

  if (!fs.existsSync(COVERAGE_FILE)) {
    console.error('❌ Coverage file not found:', COVERAGE_FILE);
    console.error('Run "npm run test:coverage" first to generate coverage data');
    process.exit(1);
  }

  try {
    const coverageData = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
    const totalCoverage = coverageData.total;

    if (!totalCoverage) {
      console.error('❌ Invalid coverage data structure');
      process.exit(1);
    }

    const metrics = {
      statements: totalCoverage.statements,
      branches: totalCoverage.branches,
      functions: totalCoverage.functions,
      lines: totalCoverage.lines
    };

    let allPassed = true;
    const results = [];

    Object.entries(metrics).forEach(([metric, data]) => {
      const percentage = data.pct;
      const covered = data.covered;
      const total = data.total;
      const passed = percentage >= REQUIRED_THRESHOLD;

      results.push({
        metric,
        percentage,
        covered,
        total,
        passed
      });

      if (!passed) {
        allPassed = false;
      }

      const status = passed ? '✅' : '❌';
      console.log(`${status} ${metric.padEnd(12)}: ${percentage.toFixed(2)}% (${covered}/${total})`);
    });

    console.log('\n📊 Coverage Summary:');
    console.log(`Required threshold: ${REQUIRED_THRESHOLD}%`);
    console.log(`Total files analyzed: ${Object.keys(coverageData).length - 1}`); // -1 for 'total' key

    if (allPassed) {
      console.log('\n🎉 All coverage thresholds met!');
      console.log(`✅ Frontend coverage: 100% across all metrics`);
      process.exit(0);
    } else {
      console.log('\n💥 Coverage thresholds not met!');
      console.log('❌ The following metrics are below 100%:');

      results.filter(r => !r.passed).forEach(result => {
        const missing = result.total - result.covered;
        console.log(`   • ${result.metric}: ${result.percentage.toFixed(2)}% (${missing} uncovered)`);
      });

      console.log('\n🔧 To improve coverage:');
      console.log('1. Run "npm run test:coverage -- --reporter=html"');
      console.log('2. Open "frontend/coverage/index.html" to see uncovered lines');
      console.log('3. Add tests for uncovered code paths');
      console.log('4. Ensure all branches, functions, and statements are tested');

      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error reading coverage data:', error.message);
    process.exit(1);
  }
}

// Run coverage check if called directly
if (require.main === module) {
  checkCoverage();
}

module.exports = { checkCoverage };