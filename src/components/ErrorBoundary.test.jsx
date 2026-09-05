import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function Bomb({ shouldThrow }) {
  if (shouldThrow) throw new Error('boom')
  return <div>fine</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error to console.error twice (dev double-log);
    // silence it so the test output doesn't look like a failure.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('fine')).toBeInTheDocument()
  })

  it('renders a fallback instead of crashing when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.queryByText('fine')).not.toBeInTheDocument()
  })

  it('calls onReset when "Try again" is clicked', () => {
    const onReset = vi.fn()
    render(
      <ErrorBoundary onReset={onReset}>
        <Bomb shouldThrow />
      </ErrorBoundary>
    )
    fireEvent.click(screen.getByText('Try again'))
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
