/**
 * Unit tests for HealthStatusPanel Component
 * TDD approach - tests written first
 */

import { render, screen } from '@testing-library/react'
import HealthStatusPanel from '@/components/testing/HealthStatusPanel'
import { HealthStatus } from '@/types/testing'

describe('HealthStatusPanel Component', () => {
  const mockHealthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: '2025-10-13T12:00:00.000Z',
    services: {
      database: { status: 'up', latency: 15, lastCheck: '2025-10-13T12:00:00.000Z' },
      cache: { status: 'up', latency: 5, lastCheck: '2025-10-13T12:00:00.000Z' },
      api: { status: 'up', latency: 50, lastCheck: '2025-10-13T12:00:00.000Z' },
    },
    system: {
      uptime: 86400,
      memory: { used: 256, total: 512, percentage: 50 },
      cpu: 45.2,
    },
  }

  test('should render component', () => {
    render(<HealthStatusPanel healthStatus={mockHealthStatus} />)
    expect(screen.getByText(/System Health/i)).toBeInTheDocument()
  })

  test('should display overall health status', () => {
    render(<HealthStatusPanel healthStatus={mockHealthStatus} />)
    expect(screen.getByText(/healthy/i)).toBeInTheDocument()
  })

  test('should display database service status', () => {
    render(<HealthStatusPanel healthStatus={mockHealthStatus} />)
    expect(screen.getByText(/Database/i)).toBeInTheDocument()
    expect(screen.getByText(/15ms/)).toBeInTheDocument()
  })

  test('should display cache service status', () => {
    render(<HealthStatusPanel healthStatus={mockHealthStatus} />)
    expect(screen.getByText(/Cache/i)).toBeInTheDocument()
    const latencyElements = screen.getAllByText(/5ms/)
    expect(latencyElements.length).toBeGreaterThan(0)
  })

  test('should display API service status', () => {
    render(<HealthStatusPanel healthStatus={mockHealthStatus} />)
    expect(screen.getByText(/API/i)).toBeInTheDocument()
    expect(screen.getByText(/50ms/)).toBeInTheDocument()
  })

  test('should show success indicator for healthy status', () => {
    render(<HealthStatusPanel healthStatus={mockHealthStatus} />)
    const successIndicators = screen.getAllByText(/✅|up/i)
    expect(successIndicators.length).toBeGreaterThan(0)
  })

  test('should show degraded status', () => {
    const degradedHealth: HealthStatus = {
      ...mockHealthStatus,
      status: 'degraded',
      services: {
        ...mockHealthStatus.services,
        cache: { status: 'down', latency: 0, lastCheck: '2025-10-13T12:00:00.000Z' },
      },
    }

    render(<HealthStatusPanel healthStatus={degradedHealth} />)
    expect(screen.getByText(/degraded/i)).toBeInTheDocument()
  })

  test('should show unhealthy status', () => {
    const unhealthyHealth: HealthStatus = {
      ...mockHealthStatus,
      status: 'unhealthy',
    }

    render(<HealthStatusPanel healthStatus={unhealthyHealth} />)
    expect(screen.getByText(/unhealthy/i)).toBeInTheDocument()
  })

  test('should have proper card layout', () => {
    const { container } = render(<HealthStatusPanel healthStatus={mockHealthStatus} />)
    const card = container.querySelector('.bg-white, .bg-gray-800')
    expect(card).toBeInTheDocument()
  })
})
