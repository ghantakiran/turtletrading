/**
 * E2E Tests for Testing & Health Monitoring APIs
 * Tests API endpoints in production environment
 */

import { test, expect } from '@playwright/test'

const BASE_URL = 'https://turtletrading.vercel.app'

test.describe('Testing Results API', () => {
  test('GET /api/testing/results should return test results', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/testing/results`)

    expect(response.status()).toBe(200)
    const data = await response.json()

    // Validate structure
    expect(data).toHaveProperty('unit')
    expect(data).toHaveProperty('e2e')
    expect(data).toHaveProperty('integration')
    expect(data).toHaveProperty('coverage')
    expect(data).toHaveProperty('lastRun')

    // Validate unit tests
    expect(data.unit).toHaveProperty('total')
    expect(data.unit).toHaveProperty('passing')
    expect(data.unit).toHaveProperty('failing')
    expect(data.unit).toHaveProperty('skipped')

    // Validate coverage
    expect(data.coverage).toHaveProperty('statements')
    expect(data.coverage).toHaveProperty('branches')
    expect(data.coverage).toHaveProperty('functions')
    expect(data.coverage).toHaveProperty('lines')
  })

  test('Test results should have valid counts', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/testing/results`)
    const data = await response.json()

    // All counts should be non-negative
    expect(data.unit.total).toBeGreaterThanOrEqual(0)
    expect(data.unit.passing).toBeGreaterThanOrEqual(0)
    expect(data.unit.failing).toBeGreaterThanOrEqual(0)
    expect(data.e2e.total).toBeGreaterThanOrEqual(0)
    expect(data.integration.total).toBeGreaterThanOrEqual(0)

    // Passing + failing + skipped should equal total
    const unitSum = data.unit.passing + data.unit.failing + data.unit.skipped
    expect(unitSum).toBe(data.unit.total)
  })

  test('Coverage percentages should be in valid range', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/testing/results`)
    const data = await response.json()

    expect(data.coverage.statements).toBeGreaterThanOrEqual(0)
    expect(data.coverage.statements).toBeLessThanOrEqual(100)
    expect(data.coverage.branches).toBeGreaterThanOrEqual(0)
    expect(data.coverage.branches).toBeLessThanOrEqual(100)
    expect(data.coverage.functions).toBeGreaterThanOrEqual(0)
    expect(data.coverage.functions).toBeLessThanOrEqual(100)
    expect(data.coverage.lines).toBeGreaterThanOrEqual(0)
    expect(data.coverage.lines).toBeLessThanOrEqual(100)
  })

  test('lastRun should be a valid ISO timestamp', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/testing/results`)
    const data = await response.json()

    expect(data.lastRun).toBeDefined()
    expect(typeof data.lastRun).toBe('string')

    // Should be parseable as date
    const date = new Date(data.lastRun)
    expect(date.toISOString()).toContain('T')
    expect(date.toISOString()).toContain('Z')
  })
})

test.describe('Health Check API', () => {
  test('GET /api/health/status should return health status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/status`)

    expect(response.status()).toBe(200)
    const data = await response.json()

    // Validate structure
    expect(data).toHaveProperty('status')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('services')
    expect(data).toHaveProperty('system')

    // Validate status is one of expected values
    expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status)
  })

  test('Health status should include all services', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/status`)
    const data = await response.json()

    // Check for expected services
    expect(data.services).toHaveProperty('database')
    expect(data.services).toHaveProperty('cache')
    expect(data.services).toHaveProperty('api')

    // Each service should have status and latency
    Object.values(data.services).forEach((service: any) => {
      expect(service).toHaveProperty('status')
      expect(service).toHaveProperty('latency')
      expect(service).toHaveProperty('lastCheck')
      expect(['up', 'down', 'degraded']).toContain(service.status)
      expect(service.latency).toBeGreaterThanOrEqual(0)
    })
  })

  test('System metrics should be valid', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/status`)
    const data = await response.json()

    // Validate system metrics
    expect(data.system).toHaveProperty('uptime')
    expect(data.system).toHaveProperty('memory')
    expect(data.system).toHaveProperty('cpu')

    // Uptime should be positive
    expect(data.system.uptime).toBeGreaterThanOrEqual(0)

    // Memory metrics
    expect(data.system.memory.used).toBeGreaterThan(0)
    expect(data.system.memory.total).toBeGreaterThan(0)
    expect(data.system.memory.percentage).toBeGreaterThanOrEqual(0)
    expect(data.system.memory.percentage).toBeLessThanOrEqual(100)

    // CPU should be in range
    expect(data.system.cpu).toBeGreaterThanOrEqual(0)
    expect(data.system.cpu).toBeLessThanOrEqual(100)
  })

  test('Health timestamp should be recent', async ({ request }) => {
    const beforeRequest = Date.now()
    const response = await request.get(`${BASE_URL}/api/health/status`)
    const afterRequest = Date.now()
    const data = await response.json()

    const timestamp = new Date(data.timestamp).getTime()

    // Timestamp should be within the request window (with 5 second buffer)
    expect(timestamp).toBeGreaterThanOrEqual(beforeRequest - 5000)
    expect(timestamp).toBeLessThanOrEqual(afterRequest + 5000)
  })
})

test.describe('API Error Handling', () => {
  test('APIs should handle malformed requests', async ({ request }) => {
    // These endpoints are GET only, so POST should fail or be ignored
    const testingResponse = await request.post(`${BASE_URL}/api/testing/results`, {
      data: { invalid: 'data' },
    })

    const healthResponse = await request.post(`${BASE_URL}/api/health/status`, {
      data: { invalid: 'data' },
    })

    // Should either return 405 (Method Not Allowed) or handle gracefully
    expect([200, 405]).toContain(testingResponse.status())
    expect([200, 405]).toContain(healthResponse.status())
  })
})

test.describe('API Performance', () => {
  test('Testing results API should respond quickly', async ({ request }) => {
    const startTime = Date.now()
    const response = await request.get(`${BASE_URL}/api/testing/results`)
    const endTime = Date.now()

    expect(response.status()).toBe(200)

    const responseTime = endTime - startTime
    // Should respond within 2 seconds
    expect(responseTime).toBeLessThan(2000)
  })

  test('Health check API should respond quickly', async ({ request }) => {
    const startTime = Date.now()
    const response = await request.get(`${BASE_URL}/api/health/status`)
    const endTime = Date.now()

    expect(response.status()).toBe(200)

    const responseTime = endTime - startTime
    // Health checks should be fast (within 1 second)
    expect(responseTime).toBeLessThan(1000)
  })
})
