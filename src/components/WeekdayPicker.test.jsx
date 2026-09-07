import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WeekdayPicker from './WeekdayPicker'

describe('WeekdayPicker', () => {
  it('renders Mon-first, one letter per day', () => {
    render(<WeekdayPicker value={[]} onChange={() => {}} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
  })

  it('adds a day when toggled on, and reports a sorted array', () => {
    let value = [1]
    render(<WeekdayPicker value={value} onChange={(v) => { value = v }} />)

    fireEvent.click(screen.getAllByRole('button')[6]) // Sunday, last in Mon-first order

    expect(value).toEqual([0, 1])
  })

  it('removes a day when toggled off', () => {
    let value = [1, 3]
    render(<WeekdayPicker value={value} onChange={(v) => { value = v }} />)

    fireEvent.click(screen.getAllByRole('button')[0]) // Monday

    expect(value).toEqual([3])
  })

  it('does nothing when disabled', () => {
    let value = [1]
    render(<WeekdayPicker value={value} onChange={(v) => { value = v }} disabled />)

    fireEvent.click(screen.getAllByRole('button')[1])

    expect(value).toEqual([1])
  })
})
