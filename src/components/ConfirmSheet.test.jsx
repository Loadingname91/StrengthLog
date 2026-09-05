import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import ConfirmSheet from './ConfirmSheet'

describe('ConfirmSheet holdToConfirm', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onConfirm after the full 1500ms hold', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmSheet
        open
        title="Delete all data?"
        confirmLabel="Delete everything"
        holdToConfirm
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    const button = screen.getByText('Delete everything')
    fireEvent.pointerDown(button)
    vi.advanceTimersByTime(1500)

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancels silently when released before the hold completes', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmSheet
        open
        title="Delete all data?"
        confirmLabel="Delete everything"
        holdToConfirm
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )

    const button = screen.getByText('Delete everything')
    fireEvent.pointerDown(button)
    vi.advanceTimersByTime(500)
    fireEvent.pointerUp(button)
    vi.advanceTimersByTime(1000)

    expect(onConfirm).not.toHaveBeenCalled()
  })
})
