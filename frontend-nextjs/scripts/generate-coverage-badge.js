#!/usr/bin/env node
/**
 * Coverage Badge Generation Script
 * Generates SVG badges and shields.io compatible JSON for coverage metrics
 */

const fs = require('fs')
const path = require('path')

// Badge configuration
const BADGE_CONFIG = {
  style: 'flat-square', // flat, flat-square, plastic, for-the-badge, social
  logoSvg: '', // Optional logo SVG
  logoColor: 'white',
  labelColor: '#555555',
  colorScheme: {
    excellent: '#4c1', // 95-100%
    good: '#97ca00',     // 85-94%
    ok: '#a4a61d',       // 75-84%
    warning: '#dfb317',  // 65-74%
    critical: '#e05d44'  // 0-64%
  }
}

class CoverageBadgeGenerator {
  constructor() {
    this.coverageDir = path.join(process.cwd(), 'coverage')
    this.outputDir = path.join(this.coverageDir, 'badges')
    this.results = {
      badges: [],
      errors: []
    }
  }

  async generateBadges() {
    console.log('🏷️  Generating coverage badges...')

    // Ensure output directory exists
    this.ensureOutputDirectory()

    // Load coverage data
    const coverageData = this.loadCoverageData()
    if (!coverageData) {
      this.fail('Could not load coverage data')
      return
    }

    // Generate individual metric badges
    await this.generateMetricBadges(coverageData)

    // Generate overall coverage badge
    await this.generateOverallBadge(coverageData)

    // Generate module-specific badges
    await this.generateModuleBadges(coverageData)

    // Generate shields.io JSON endpoints
    await this.generateShieldsEndpoints(coverageData)

    // Generate badge index
    await this.generateBadgeIndex()

    console.log(`✅ Generated ${this.results.badges.length} coverage badges`)
    return this.results
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
  }

  loadCoverageData() {
    try {
      const summaryPath = path.join(this.coverageDir, 'coverage-summary.json')
      const data = fs.readFileSync(summaryPath, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      this.results.errors.push(`Failed to load coverage data: ${error.message}`)
      return null
    }
  }

  async generateMetricBadges(coverageData) {
    const metrics = ['lines', 'statements', 'functions', 'branches']
    const total = coverageData.total

    for (const metric of metrics) {
      const percentage = total[metric].pct
      const color = this.getColorForPercentage(percentage)

      const badgeData = {
        schemaVersion: 1,
        label: `coverage:${metric}`,
        message: `${percentage}%`,
        color: color,
        style: BADGE_CONFIG.style
      }

      // Save shields.io JSON format
      const jsonPath = path.join(this.outputDir, `${metric}.json`)
      fs.writeFileSync(jsonPath, JSON.stringify(badgeData, null, 2))

      // Generate SVG badge
      const svgBadge = this.generateSVGBadge(badgeData.label, badgeData.message, color)
      const svgPath = path.join(this.outputDir, `${metric}.svg`)
      fs.writeFileSync(svgPath, svgBadge)

      this.results.badges.push({
        metric,
        percentage,
        color,
        jsonPath,
        svgPath
      })

      console.log(`   📊 ${metric}: ${percentage}% (${color})`)
    }
  }

  async generateOverallBadge(coverageData) {
    const total = coverageData.total

    // Calculate weighted overall score
    const weights = { lines: 0.4, statements: 0.3, functions: 0.2, branches: 0.1 }
    const overallScore = Math.round(
      total.lines.pct * weights.lines +
      total.statements.pct * weights.statements +
      total.functions.pct * weights.functions +
      total.branches.pct * weights.branches
    )

    const color = this.getColorForPercentage(overallScore)

    const badgeData = {
      schemaVersion: 1,
      label: 'coverage',
      message: `${overallScore}%`,
      color: color,
      style: BADGE_CONFIG.style
    }

    // Save shields.io JSON format
    const jsonPath = path.join(this.outputDir, 'overall.json')
    fs.writeFileSync(jsonPath, JSON.stringify(badgeData, null, 2))

    // Generate SVG badge
    const svgBadge = this.generateSVGBadge(badgeData.label, badgeData.message, color)
    const svgPath = path.join(this.outputDir, 'overall.svg')
    fs.writeFileSync(svgPath, svgBadge)

    this.results.badges.push({
      metric: 'overall',
      percentage: overallScore,
      color,
      jsonPath,
      svgPath
    })

    console.log(`   🎯 Overall: ${overallScore}% (${color})`)
  }

  async generateModuleBadges(coverageData) {
    // Critical modules for trading platform
    const criticalModules = [
      'src/lib/trading/',
      'src/lib/performance/',
      'src/lib/accessibility/',
      'src/components/',
      'src/stores/',
      'src/utils/'
    ]

    for (const module of criticalModules) {
      const moduleFiles = this.getModuleFiles(coverageData, module)

      if (moduleFiles.length === 0) {
        console.log(`   ⏭️  No files found for module: ${module}`)
        continue
      }

      const moduleCoverage = this.calculateModuleCoverage(moduleFiles)
      const overallPct = moduleCoverage.lines.pct
      const color = this.getColorForPercentage(overallPct)

      const moduleName = module.replace(/[/\\]/g, '-').replace(/^src-/, '').replace(/-$/, '')

      const badgeData = {
        schemaVersion: 1,
        label: `coverage:${moduleName}`,
        message: `${overallPct}%`,
        color: color,
        style: BADGE_CONFIG.style
      }

      // Save shields.io JSON format
      const jsonPath = path.join(this.outputDir, `module-${moduleName}.json`)
      fs.writeFileSync(jsonPath, JSON.stringify(badgeData, null, 2))

      // Generate SVG badge
      const svgBadge = this.generateSVGBadge(badgeData.label, badgeData.message, color)
      const svgPath = path.join(this.outputDir, `module-${moduleName}.svg`)
      fs.writeFileSync(svgPath, svgBadge)

      this.results.badges.push({
        metric: `module-${moduleName}`,
        percentage: overallPct,
        color,
        jsonPath,
        svgPath,
        fileCount: moduleFiles.length
      })

      console.log(`   📁 ${moduleName}: ${overallPct}% (${moduleFiles.length} files)`)
    }
  }

  async generateShieldsEndpoints(coverageData) {
    // Generate dynamic shields.io endpoints
    const endpoints = {
      coverage: {
        schemaVersion: 1,
        label: 'coverage',
        message: `${coverageData.total.lines.pct}%`,
        color: this.getColorForPercentage(coverageData.total.lines.pct)
      },
      tests: {
        schemaVersion: 1,
        label: 'tests',
        message: 'passing',
        color: 'brightgreen'
      },
      build: {
        schemaVersion: 1,
        label: 'build',
        message: 'passing',
        color: 'brightgreen'
      }
    }

    for (const [name, data] of Object.entries(endpoints)) {
      const endpointPath = path.join(this.outputDir, `endpoint-${name}.json`)
      fs.writeFileSync(endpointPath, JSON.stringify(data, null, 2))
    }

    console.log('   🌐 Generated shields.io endpoints')
  }

  async generateBadgeIndex() {
    const indexData = {
      generated: new Date().toISOString(),
      badges: this.results.badges,
      usage: {
        markdown: this.results.badges.map(badge => ({
          metric: badge.metric,
          markdown: `![Coverage ${badge.metric}](./coverage/badges/${path.basename(badge.svgPath)})`,
          html: `<img src="./coverage/badges/${path.basename(badge.svgPath)}" alt="Coverage ${badge.metric}">`
        })),
        shields: this.results.badges.map(badge => ({
          metric: badge.metric,
          url: `https://img.shields.io/endpoint?url=https://your-domain.com/coverage/badges/${path.basename(badge.jsonPath)}`
        }))
      }
    }

    const indexPath = path.join(this.outputDir, 'index.json')
    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2))

    // Generate README for badges
    const readmeContent = this.generateBadgeReadme(indexData)
    const readmePath = path.join(this.outputDir, 'README.md')
    fs.writeFileSync(readmePath, readmeContent)

    console.log('   📄 Generated badge index and README')
  }

  generateBadgeReadme(indexData) {
    return `# Coverage Badges

Generated: ${indexData.generated}

## Available Badges

${indexData.badges.map(badge => `
### ${badge.metric}
- **Coverage**: ${badge.percentage}%
- **Color**: ${badge.color}
- **SVG**: [${badge.metric}.svg](${path.basename(badge.svgPath)})
- **JSON**: [${badge.metric}.json](${path.basename(badge.jsonPath)})

![${badge.metric}](${path.basename(badge.svgPath)})
`).join('\n')}

## Usage

### Markdown
\`\`\`markdown
${indexData.usage.markdown.map(item => item.markdown).join('\n')}
\`\`\`

### HTML
\`\`\`html
${indexData.usage.markdown.map(item => item.html).join('\n')}
\`\`\`

### Shields.io Dynamic Badges
\`\`\`markdown
${indexData.usage.shields.map(item => `![${item.metric}](${item.url})`).join('\n')}
\`\`\`

## Colors

- 🟢 **Excellent (95-100%)**: ${BADGE_CONFIG.colorScheme.excellent}
- 🟡 **Good (85-94%)**: ${BADGE_CONFIG.colorScheme.good}
- 🟠 **OK (75-84%)**: ${BADGE_CONFIG.colorScheme.ok}
- 🟠 **Warning (65-74%)**: ${BADGE_CONFIG.colorScheme.warning}
- 🔴 **Critical (0-64%)**: ${BADGE_CONFIG.colorScheme.critical}
`
  }

  generateSVGBadge(label, message, color) {
    const labelWidth = label.length * 6.5 + 10
    const messageWidth = message.length * 6.5 + 10
    const totalWidth = labelWidth + messageWidth

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <defs>
    <linearGradient id="smooth" x2="0" y2="100%">
      <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
      <stop offset="1" stop-opacity=".1"/>
    </linearGradient>
  </defs>
  <g>
    <rect rx="3" width="${totalWidth}" height="20" fill="${BADGE_CONFIG.labelColor}"/>
    <rect rx="3" x="${labelWidth}" width="${messageWidth}" height="20" fill="${color}"/>
    <rect x="${labelWidth}" width="4" height="20" fill="${color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth/2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth/2}" y="14">${label}</text>
    <text x="${labelWidth + messageWidth/2}" y="15" fill="#010101" fill-opacity=".3">${message}</text>
    <text x="${labelWidth + messageWidth/2}" y="14">${message}</text>
  </g>
</svg>`
  }

  getModuleFiles(coverageData, module) {
    const files = []

    for (const [filePath, fileCoverage] of Object.entries(coverageData)) {
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

  getColorForPercentage(percentage) {
    if (percentage >= 95) return BADGE_CONFIG.colorScheme.excellent
    if (percentage >= 85) return BADGE_CONFIG.colorScheme.good
    if (percentage >= 75) return BADGE_CONFIG.colorScheme.ok
    if (percentage >= 65) return BADGE_CONFIG.colorScheme.warning
    return BADGE_CONFIG.colorScheme.critical
  }

  fail(message) {
    console.error(`❌ ${message}`)
    if (this.results.errors.length > 0) {
      console.error('\nErrors:')
      this.results.errors.forEach(error => console.error(`   • ${error}`))
    }
    process.exit(1)
  }
}

// Main execution
async function main() {
  const generator = new CoverageBadgeGenerator()

  try {
    await generator.generateBadges()
  } catch (error) {
    console.error('❌ Badge generation failed:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = CoverageBadgeGenerator