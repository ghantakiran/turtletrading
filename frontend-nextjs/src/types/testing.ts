/**
 * Types for Testing Dashboard & Health Monitoring
 */

export interface TestCategory {
  total: number
  passing: number
  failing: number
  skipped: number
}

export interface CoverageMetrics {
  statements: number
  branches: number
  functions: number
  lines: number
}

export interface TestResults {
  unit: TestCategory
  e2e: TestCategory
  integration: TestCategory
  coverage: CoverageMetrics
  lastRun: string
}

export interface FailedTest {
  id: string
  name: string
  category: 'unit' | 'e2e' | 'integration'
  error: string
  file: string
  duration: number
}

export interface TestHistory {
  timestamp: string
  results: TestResults
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: {
    [key: string]: ServiceHealth
  }
  system: SystemMetrics
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded'
  latency: number
  lastCheck: string
}

export interface SystemMetrics {
  uptime: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  cpu: number
}

export interface APIEndpoint {
  path: string
  method: string
  status: number
  latency: number
  lastCheck: string
}

export interface PerformanceMetrics {
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  requestsPerMinute: number
  errorRate: number
}

/**
 * File-level coverage details
 */
export interface FileCoverage {
  path: string
  statements: CoverageDetail
  branches: CoverageDetail
  functions: CoverageDetail
  lines: CoverageDetail
}

export interface CoverageDetail {
  total: number
  covered: number
  skipped: number
  pct: number
}

/**
 * Extended test results with file-level coverage
 */
export interface DetailedTestResults extends TestResults {
  fileCoverage: FileCoverage[]
  coverageTrends?: CoverageTrend[]
  performance?: TestPerformanceMetrics
}

/**
 * Coverage trends over time
 */
export interface CoverageTrend {
  timestamp: string
  statements: number
  branches: number
  functions: number
  lines: number
}

/**
 * Test execution performance metrics
 */
export interface TestPerformanceMetrics {
  avgDuration: number
  slowestTests: SlowTest[]
  totalDuration: number
  testCount: number
}

export interface SlowTest {
  name: string
  duration: number
  file: string
  category: 'unit' | 'e2e' | 'integration'
}
