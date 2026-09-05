// Muscle taxonomy used across the Exercise Library, Stats "Muscles" tab and
// the front/back body heatmap. The heatmap only draws 7 broad regions, so
// each fine-grained muscle used for filtering/search maps onto one or two
// of those regions.
export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core']

export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight']

export const REGIONS = ['head', 'chest', 'back', 'arms', 'core', 'legs', 'glutes']

// muscle -> heatmap region(s)
const REGION_MAP = {
  Chest: ['chest'],
  Back: ['back'],
  Shoulders: ['chest', 'back'],
  Biceps: ['arms'],
  Triceps: ['arms'],
  Legs: ['legs'],
  Glutes: ['glutes'],
  Core: ['core'],
}

export function regionsFor(muscle) {
  return REGION_MAP[muscle] || []
}

export function musclesForRegion(region) {
  return Object.keys(REGION_MAP).filter((m) => REGION_MAP[m].includes(region))
}

// warm sequential scale: pale sand -> terracotta -> deep rust
const HEAT_STOPS = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)']

export function heatColor(intensity /* 0..1 */) {
  const idx = Math.round(Math.max(0, Math.min(1, intensity)) * (HEAT_STOPS.length - 1))
  return HEAT_STOPS[idx]
}

// Given a list of {muscle, sets} tallies, return a 0..1 intensity per region
// normalized against the busiest region so the gradient is always legible.
export function regionIntensities(muscleSetCounts) {
  const totals = Object.fromEntries(REGIONS.map((r) => [r, 0]))
  for (const [muscle, sets] of Object.entries(muscleSetCounts)) {
    for (const region of regionsFor(muscle)) totals[region] += sets
  }
  const max = Math.max(1, ...Object.values(totals))
  return Object.fromEntries(REGIONS.map((r) => [r, totals[r] / max]))
}
