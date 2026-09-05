import { mulberry32 } from './rng'
import { todayISO, localISODate } from './format'
import { defaultWeekdayAssignments } from './schedule'

// ---- Routines -------------------------------------------------------

const RAW_ROUTINES = [
  {
    id: 'r-upper-a',
    name: 'Upper A',
    blocks: [
      { exerciseIds: ['bench-press'], sets: 4, repMin: 6, repMax: 8, rest: 120, rir: 2 },
      { exerciseIds: ['barbell-row'], sets: 4, repMin: 6, repMax: 8, rest: 120, rir: 2 },
      { exerciseIds: ['overhead-press'], sets: 3, repMin: 8, repMax: 10, rest: 90, rir: 2 },
      { exerciseIds: ['lat-pulldown'], sets: 3, repMin: 8, repMax: 10, rest: 90, rir: 2 },
      { exerciseIds: ['barbell-curl', 'triceps-pushdown'], sets: 3, repMin: 10, repMax: 12, rest: 60, rir: 1 },
    ],
  },
  {
    id: 'r-lower-a',
    name: 'Lower A',
    blocks: [
      { exerciseIds: ['back-squat'], sets: 4, repMin: 5, repMax: 8, rest: 150, rir: 2 },
      { exerciseIds: ['romanian-deadlift'], sets: 3, repMin: 8, repMax: 10, rest: 120, rir: 2 },
      { exerciseIds: ['leg-press'], sets: 3, repMin: 10, repMax: 12, rest: 90, rir: 1 },
      { exerciseIds: ['leg-curl'], sets: 3, repMin: 10, repMax: 12, rest: 60, rir: 1 },
      { exerciseIds: ['plank'], sets: 3, repMin: 30, repMax: 45, rest: 45, rir: null },
    ],
  },
  {
    id: 'r-upper-b',
    name: 'Upper B',
    blocks: [
      { exerciseIds: ['incline-db-press'], sets: 4, repMin: 8, repMax: 10, rest: 120, rir: 2 },
      { exerciseIds: ['pull-up'], sets: 4, repMin: 6, repMax: 10, rest: 120, rir: 2 },
      { exerciseIds: ['lateral-raise'], sets: 3, repMin: 12, repMax: 15, rest: 60, rir: 1 },
      { exerciseIds: ['seated-cable-row'], sets: 3, repMin: 8, repMax: 10, rest: 90, rir: 2 },
      { exerciseIds: ['hammer-curl', 'skull-crusher'], sets: 3, repMin: 10, repMax: 12, rest: 60, rir: 1 },
    ],
  },
  {
    id: 'r-lower-b',
    name: 'Lower B',
    blocks: [
      { exerciseIds: ['deadlift'], sets: 4, repMin: 4, repMax: 6, rest: 180, rir: 2 },
      { exerciseIds: ['walking-lunge'], sets: 3, repMin: 10, repMax: 12, rest: 90, rir: 1 },
      { exerciseIds: ['leg-extension'], sets: 3, repMin: 12, repMax: 15, rest: 60, rir: 1 },
      { exerciseIds: ['hip-thrust'], sets: 3, repMin: 8, repMax: 10, rest: 90, rir: 2 },
      { exerciseIds: ['hanging-leg-raise'], sets: 3, repMin: 10, repMax: 15, rest: 60, rir: null },
    ],
  },
  {
    id: 'r-full-c',
    name: 'Full Body C',
    blocks: [
      { exerciseIds: ['push-up'], sets: 3, repMin: 12, repMax: 15, rest: 60, rir: 1 },
      { exerciseIds: ['barbell-row'], sets: 3, repMin: 8, repMax: 10, rest: 90, rir: 2 },
      { exerciseIds: ['back-squat'], sets: 3, repMin: 6, repMax: 8, rest: 120, rir: 2 },
      { exerciseIds: ['face-pull'], sets: 3, repMin: 12, repMax: 15, rest: 60, rir: 1 },
      { exerciseIds: ['cable-crunch'], sets: 3, repMin: 15, repMax: 20, rest: 45, rir: null },
    ],
  },
]

let uid = 1
function nextId(prefix) {
  return `${prefix}-${uid++}`
}

export function buildRoutines() {
  const total = RAW_ROUTINES.length
  return RAW_ROUTINES.map((r, i) => ({
    id: r.id,
    name: r.name,
    position: `Session ${i + 1} of ${total}`,
    blocks: r.blocks.map((b) => ({
      id: nextId('block'),
      type: b.exerciseIds.length > 1 ? 'superset' : 'single',
      exerciseIds: b.exerciseIds,
      sets: b.sets,
      repMin: b.repMin,
      repMax: b.repMax,
      rest: b.rest,
      rir: b.rir,
    })),
  }))
}

// ---- Baseline working weights (kg) used to generate history ---------

const BASELINE = {
  'bench-press': 60, 'incline-db-press': 22, 'push-up': 0, 'cable-fly': 15,
  'overhead-press': 40, 'lateral-raise': 8, 'face-pull': 20, 'pull-up': 0,
  'barbell-row': 50, 'lat-pulldown': 45, 'seated-cable-row': 50, 'deadlift': 90,
  'barbell-curl': 30, 'hammer-curl': 12, 'triceps-pushdown': 25, 'skull-crusher': 25,
  'back-squat': 70, 'leg-press': 90, 'romanian-deadlift': 60, 'walking-lunge': 14,
  'leg-curl': 30, 'leg-extension': 35, 'hip-thrust': 60, 'plank': 0,
  'hanging-leg-raise': 0, 'cable-crunch': 25,
}
// Exercises whose working weight is deliberately kept flat for the most
// recent stretch of history, so Export & Insights has a real "stalled"
// callout to surface rather than a hardcoded one.
const PLATEAU_RECENT = new Set(['leg-curl', 'leg-extension'])

export function buildSessions(routines) {
  const rand = mulberry32(20240517)
  const weight = { ...BASELINE }
  const occurrences = {}
  const sessions = []
  const totalDays = 63
  let seqIndex = 0
  for (const key of Object.keys(histBest)) delete histBest[key]

  // Workout on Mon/Tue/Thu/Fri (roughly 4x/week), skipping the most recent 2 days.
  for (let daysBack = totalDays; daysBack >= 2; daysBack--) {
    const date = new Date()
    date.setDate(date.getDate() - daysBack)
    const weekday = date.getDay() // 0 Sun .. 6 Sat
    const isTrainingDay = [1, 2, 4, 5].includes(weekday)
    if (!isTrainingDay) continue
    // small chance of a missed/rest day even on a training day
    if (rand() < 0.12) continue

    const routine = routines[seqIndex % routines.length]
    seqIndex++

    const entries = []
    let volume = 0
    let prCount = 0

    for (const block of routine.blocks) {
      for (const exerciseId of block.exerciseIds) {
        occurrences[exerciseId] = (occurrences[exerciseId] || 0) + 1
        const n = occurrences[exerciseId]
        const plateauPhase = PLATEAU_RECENT.has(exerciseId) && daysBack <= 24

        if (!plateauPhase) {
          if (rand() < 0.55) {
            weight[exerciseId] += weight[exerciseId] < 20 ? 0.5 + rand() * 1 : 1 + rand() * 1.5
          }
        }
        const w = Math.round(weight[exerciseId] * 2) / 2

        const sets = []
        let bestProduct = 0
        for (let s = 0; s < block.sets; s++) {
          const repSpread = block.repMax - block.repMin
          const reps = Math.max(1, Math.round(block.repMin + rand() * repSpread - s * 0.3))
          const rir = block.rir == null ? null : Math.max(0, Math.round(rand() * 3))
          const product = w * reps
          if (product > bestProduct) bestProduct = product
          sets.push({ weight: w, reps, rir, isPR: false })
        }
        // Mark the best set of the session as a PR only if it beats every
        // earlier session's best product for this exercise.
        if (bestProduct > (histBest[exerciseId] || 0)) {
          const idx = sets.findIndex((s) => s.weight * s.reps === bestProduct)
          if (idx >= 0) {
            sets[idx].isPR = true
            prCount++
          }
          histBest[exerciseId] = bestProduct
        }
        volume += sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
        entries.push({ exerciseId, blockId: block.id, sets })
      }
    }

    const startedAt = new Date(date)
    startedAt.setHours(7 + Math.floor(rand() * 12), Math.floor(rand() * 60), 0, 0)
    const durationSec = Math.round((35 + rand() * 25) * 60)
    const finishedAt = new Date(startedAt.getTime() + durationSec * 1000)

    sessions.push({
      id: nextId('session'),
      routineId: routine.id,
      routineName: routine.name,
      date: localISODate(startedAt),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationSec,
      note: '',
      entries,
      volume: Math.round(volume),
      prCount,
    })
  }

  return { sessions, nextSeqIndex: seqIndex % routines.length }
}

// module-level running best-product tracker used only during seed generation
const histBest = {}

export function buildMeasurements() {
  const rand = mulberry32(4242)
  const out = []
  for (let w = 8; w >= 0; w--) {
    const date = new Date()
    date.setDate(date.getDate() - w * 7)
    out.push({
      id: nextId('measure'),
      date: localISODate(date),
      bodyweight: Math.round((82 - w * 0.15 + range(rand, -0.4, 0.4)) * 10) / 10,
      waist: Math.round((91 - w * 0.2 + range(rand, -0.3, 0.3)) * 10) / 10,
      chest: Math.round((104 + w * 0.05 + range(rand, -0.3, 0.3)) * 10) / 10,
      biceps: Math.round((36 + (8 - w) * 0.08 + range(rand, -0.2, 0.2)) * 10) / 10,
      neck: Math.round((39 + range(rand, -0.2, 0.2)) * 10) / 10,
      notes: '',
    })
  }
  return out
}

function range(rand, min, max) {
  return min + rand() * (max - min)
}

export function buildGoals() {
  return [
    { id: nextId('goal'), type: 'muscleSets', muscle: 'Chest', period: 'week', target: 12 },
    { id: nextId('goal'), type: 'workoutCount', period: 'month', target: 14 },
  ]
}

export function buildSeed() {
  const routines = buildRoutines()
  const routineOrder = routines.map((r) => r.id)
  const { sessions, nextSeqIndex } = buildSessions(routines)
  return {
    routines,
    routineOrder,
    sequenceIndex: nextSeqIndex,
    routineMode: 'sequence',
    weekdayAssignments: defaultWeekdayAssignments(routineOrder),
    scheduleRestartAt: null,
    sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)),
    measurements: buildMeasurements(),
    goals: buildGoals(),
    activeWorkout: null,
    lastImportedAt: null,
    createdAt: todayISO(),
  }
}
