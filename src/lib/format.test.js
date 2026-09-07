import { describe, it, expect } from 'vitest'
import { workoutCtaLabel } from './format'

describe('workoutCtaLabel', () => {
  it('offers to start when no workout is in progress', () => {
    expect(workoutCtaLabel(null, 'r1')).toBe('Start Workout')
    expect(workoutCtaLabel(undefined, 'r1')).toBe('Start Workout')
  })

  it('offers to resume when the in-progress workout is this routine', () => {
    const aw = { routineId: 'r1', routineName: 'Upset A' }
    expect(workoutCtaLabel(aw, 'r1')).toBe('Resume Workout')
  })

  it('names the routine when the in-progress workout is a different one', () => {
    // The button navigates to the active session regardless of which routine's
    // page it sits on, so the label has to say where the tap actually goes.
    const aw = { routineId: 'r2', routineName: 'Upset B' }
    expect(workoutCtaLabel(aw, 'r1')).toBe('Resume Upset B')
  })
})
