/**
 * Unit tests for SystemMetrics Component
 * TDD approach - tests written first
 */

import { render, screen } from '@testing-library/react'
import SystemMetrics from '@/components/testing/SystemMetrics'
import { SystemMetrics as SystemMetricsType } from '@/types/testing'

describe('SystemMetrics Component', () => {
  const mockSystem: SystemMetricsType = {
    uptime: 86400,
    memory: { used: 256, total: 512, percentage: 50 },
    cpu: 45.2,
  }

  test('should render component', () => {
    render(<SystemMetrics system={mockSystem} />)
    expect(screen.getByText(/System Metrics/i)).toBeInTheDocument()
  })

  test('should display uptime', () => {
    render(<SystemMetrics system={mockSystem} />)
    expect(screen.getByText(/Uptime/i)).toBeInTheDocument()
    // 86400 seconds = 1 day
    expect(screen.getByText(/1d/i)).toBeInTheDocument()
  })

  test('should display memory usage', () => {
    render(<SystemMetrics system={mockSystem} />)
    expect(screen.getByText(/Memory/i)).toBeInTheDocument()
    expect(screen.getByText(/256/)).toBeInTheDocument()
    expect(screen.getByText(/512/)).toBeInTheDocument()
  })

  test('should display CPU usage', () => {
    render(<SystemMetrics system={mockSystem} />)
    expect(screen.getByText(/CPU/i)).toBeInTheDocument()
    expect(screen.getByText(/45\.2%/)).toBeInTheDocument()
  })

  test('should have proper card layout', () => {
    const { container} = render(<SystemMetrics system={mockSystem} />)
    const card = container.querySelector('.bg-white, .bg-gray-800')
    expect(card).toBeInTheDocument()
  })

  test('should display memory percentage', () => {
    render(<SystemMetrics system={mockSystem} />)
    expect(screen.getByText(/50%/)).toBeInTheDocument()
  })
})
