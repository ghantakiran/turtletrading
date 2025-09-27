#!/usr/bin/env node
/**
 * Coverage Threshold Enforcement Script
 * Ensures 100% coverage across all metrics for trading platform
 */

const fs = require('fs')
const path = require('path')

// Trading platform coverage requirements
const REQUIRED_THRESHOLDS = {
  branches: 100,
  functions: 100,
  lines: 100,
  statements: 100
}

// Critical modules that must have 100% coverage
const CRITICAL_MODULES = [
  'src/lib/trading/',
  'src/lib/performance/',
  'src/lib/accessibility/',
  'src/components/',
  'src/stores/',
  'src/utils/'
]

class CoverageValidator {
  constructor() {
    this.coverageDir = path.join(process.cwd(), 'coverage')
    this.summaryFile = path.join(this.coverageDir, 'coverage-summary.json')
    this.errors = []
    this.warnings = []
  }

  async validateCoverage() {
    console.log('🔍 Validating coverage thresholds for trading platform...')

    // Check if coverage files exist
    if (!this.checkCoverageFiles()) {
      return this.fail('Coverage files not found. Run tests with coverage first.')
    }

    // Load coverage summary
    const coverage = this.loadCoverageSummary()
    if (!coverage) {
      return this.fail('Could not load coverage summary')
    }

    // Validate global coverage
    this.validateGlobalCoverage(coverage.total)

    // Validate module-specific coverage
    this.validateModuleCoverage(coverage)

    // Generate report
    this.generateReport(coverage)

    // Determine result
    if (this.errors.length > 0) {
      return this.fail(`Coverage validation failed with ${this.errors.length} errors`)
    }

    if (this.warnings.length > 0) {
      console.log(`⚠️  Coverage validation passed with ${this.warnings.length} warnings`)
      this.warnings.forEach(warning => console.log(`   ${warning}`))
    }

    console.log('✅ All coverage thresholds met - Trading platform ready for production!')
    return true
  }

  checkCoverageFiles() {
    const requiredFiles = [
      this.summaryFile,
      path.join(this.coverageDir, 'lcov.info'),
      path.join(this.coverageDir, 'lcov-report', 'index.html')
    ]

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        this.errors.push(`Missing coverage file: ${file}`)
        return false
      }
    }

    return true
  }

  loadCoverageSummary() {
    try {
      const data = fs.readFileSync(this.summaryFile, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      this.errors.push(`Failed to load coverage summary: ${error.message}`)
      return null
    }
  }

  validateGlobalCoverage(totalCoverage) {
    console.log('\n📊 Global Coverage Analysis:')

    const metrics = ['lines', 'statements', 'functions', 'branches']
    let allPassed = true

    for (const metric of metrics) {
      const coverage = totalCoverage[metric]
      const pct = coverage.pct
      const required = REQUIRED_THRESHOLDS[metric]

      const status = pct >= required ? '✅' : '❌'
      console.log(`   ${status} ${metric}: ${pct}% (required: ${required}%)`)

      if (pct < required) {
        allPassed = false
        this.errors.push(
          `Global ${metric} coverage ${pct}% below required ${required}%`
        )

        // Calculate missing coverage
        const missing = Math.ceil((required - pct) / 100 * coverage.total)
        console.log(`      Missing: ${missing} ${metric === 'lines' ? 'lines' : metric}`)
      }
    }

    if (allPassed) {
      console.log('   🎯 All global thresholds met!')
    }
  }

  validateModuleCoverage(coverage) {
    console.log('\n🏗️  Module-Specific Coverage Analysis:')

    for (const module of CRITICAL_MODULES) {
      const moduleFiles = this.getModuleFiles(coverage, module)

      if (moduleFiles.length === 0) {
        this.warnings.push(`No files found for critical module: ${module}`)
        continue
      }

      const moduleCoverage = this.calculateModuleCoverage(moduleFiles)
      const passed = this.validateModuleThresholds(module, moduleCoverage)

      const status = passed ? '✅' : '❌'
      console.log(`   ${status} ${module}:`)
      console.log(`      Lines: ${moduleCoverage.lines.pct}%`)
      console.log(`      Functions: ${moduleCoverage.functions.pct}%`)
      console.log(`      Branches: ${moduleCoverage.branches.pct}%`)
      console.log(`      Statements: ${moduleCoverage.statements.pct}%`)
    }
  }

  getModuleFiles(coverage, module) {
    const files = []

    for (const [filePath, fileCoverage] of Object.entries(coverage)) {
      if (filePath === 'total') continue

      if (filePath.includes(module)) {
        files.push({ path: filePath, coverage: fileCoverage })
      }
    }

    return files
  }

  calculateModuleCoverage(moduleFiles) {
    const totals = {
      lines: { covered: 0, total: 0 },
      statements: { covered: 0, total: 0 },
      functions: { covered: 0, total: 0 },
      branches: { covered: 0, total: 0 }
    }

    for (const file of moduleFiles) {
      const coverage = file.coverage

      totals.lines.covered += coverage.lines.covered
      totals.lines.total += coverage.lines.total

      totals.statements.covered += coverage.statements.covered
      totals.statements.total += coverage.statements.total

      totals.functions.covered += coverage.functions.covered
      totals.functions.total += coverage.functions.total

      totals.branches.covered += coverage.branches.covered
      totals.branches.total += coverage.branches.total
    }

    // Calculate percentages
    const result = {}
    for (const metric of Object.keys(totals)) {
      const { covered, total } = totals[metric]
      result[metric] = {
        covered,
        total,
        pct: total > 0 ? Math.round((covered / total) * 100 * 100) / 100 : 100
      }
    }

    return result
  }

  validateModuleThresholds(module, coverage) {
    let passed = true

    for (const [metric, data] of Object.entries(coverage)) {
      const required = REQUIRED_THRESHOLDS[metric]

      if (data.pct < required) {
        passed = false
        this.errors.push(
          `Module ${module} ${metric} coverage ${data.pct}% below required ${required}%`
        )
      }
    }

    return passed
  }

  generateReport(coverage) {
    const report = {
      timestamp: new Date().toISOString(),
      status: this.errors.length === 0 ? 'PASSED' : 'FAILED',
      errors: this.errors,
      warnings: this.warnings,
      global: coverage.total,
      criticalModules: {}
    }

    // Generate module coverage summary
    for (const module of CRITICAL_MODULES) {
      const moduleFiles = this.getModuleFiles(coverage, module)
      if (moduleFiles.length > 0) {
        report.criticalModules[module] = this.calculateModuleCoverage(moduleFiles)
      }
    }

    // Write report file
    const reportPath = path.join(this.coverageDir, 'coverage-validation.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

    console.log(`\n📋 Coverage validation report: ${reportPath}`)

    // Generate badge
    this.generateBadge(coverage.total)
  }

  generateBadge(totalCoverage) {
    const badgeData = {
      schemaVersion: 1,
      label: 'coverage',
      message: `${totalCoverage.lines.pct}%`,
      color: totalCoverage.lines.pct >= 100 ? 'brightgreen' :
             totalCoverage.lines.pct >= 90 ? 'green' :
             totalCoverage.lines.pct >= 80 ? 'yellow' : 'red'
    }

    const badgePath = path.join(this.coverageDir, 'coverage-badge.json')
    fs.writeFileSync(badgePath, JSON.stringify(badgeData, null, 2))
  }

  fail(message) {
    console.error(`❌ ${message}`)
    if (this.errors.length > 0) {
      console.error('\nErrors:')
      this.errors.forEach(error => console.error(`   • ${error}`))
    }
    process.exit(1)
  }
}

// Main execution
async function main() {
  const validator = new CoverageValidator()

  try {
    await validator.validateCoverage()
  } catch (error) {
    console.error('❌ Coverage validation failed:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = CoverageValidator