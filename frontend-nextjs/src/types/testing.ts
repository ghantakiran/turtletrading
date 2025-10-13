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
