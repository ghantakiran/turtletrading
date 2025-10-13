/**
 * GET /api/health/status
 * Returns system health status and service availability
 */

import { NextResponse } from 'next/server'
import { HealthStatus } from '@/types/testing'

export async function GET() {
  try {
    const healthStatus = await checkSystemHealth()

    return NextResponse.json(healthStatus)
  } catch (error) {
    console.error('Error checking system health:', error)
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    )
  }
}

/**
 * Check system health and service availability
 */
async function checkSystemHealth(): Promise<HealthStatus> {
  const timestamp = new Date().toISOString()

  // Check individual services
  const services = {
    database: await checkService('database'),
    cache: await checkService('cache'),
    api: await checkService('api'),
  }

  // Get system metrics
  const system = getSystemMetrics()

  // Determine overall health status
  const status = determineHealthStatus(services)

  return {
    status,
    timestamp,
    services,
    system,
  }
}

/**
 * Check individual service health
 */
async function checkService(serviceName: string) {
  const startTime = Date.now()

  try {
    // In a real implementation, this would ping actual services
    // For now, simulate service checks
    const isUp = Math.random() > 0.1 // 90% uptime simulation

    const latency = Date.now() - startTime

    return {
      status: isUp ? 'up' as const : 'down' as const,
      latency,
      lastCheck: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'down' as const,
      latency: 0,
      lastCheck: new Date().toISOString(),
    }
  }
}

/**
 * Get system metrics
 */
function getSystemMetrics() {
  // In Node.js environment, we can get actual process metrics
  const memoryUsage = process.memoryUsage()
  const uptime = process.uptime()

  const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
  const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024)
  const memoryPercentage = (memoryUsedMB / memoryTotalMB) * 100

  // CPU usage - simplified (would need additional library for accurate measurement)
  const cpuUsage = Math.random() * 100 // Placeholder

  return {
    uptime: Math.round(uptime),
    memory: {
      used: memoryUsedMB,
      total: memoryTotalMB,
      percentage: Math.round(memoryPercentage * 10) / 10,
    },
    cpu: Math.round(cpuUsage * 10) / 10,
  }
}

/**
 * Determine overall health status based on services
 */
function determineHealthStatus(services: Record<string, any>): 'healthy' | 'degraded' | 'unhealthy' {
  const serviceStatuses = Object.values(services)
  const downCount = serviceStatuses.filter((s: any) => s.status === 'down').length
  const totalCount = serviceStatuses.length

  if (downCount === 0) {
    return 'healthy'
  } else if (downCount < totalCount) {
    return 'degraded'
  } else {
    return 'unhealthy'
  }
}
