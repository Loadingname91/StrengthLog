import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import Card from '../components/Card'
import SegmentedControl from '../components/SegmentedControl'
import LineChart from '../components/LineChart'
import BodyHeatmap from '../components/BodyHeatmap'
import { ChevronRightIcon } from '../components/Icons'
import { exerciseById } from '../lib/exercises'
import { musclesForRegion, regionIntensities } from '../lib/muscles'
import { daysAgo, fmtDate, round1 } from '../lib/format'
import {
  sessionsSince, muscleSetCounts, exerciseSetCounts, chartSeries,
  totalSets, totalReps, totalVolume,
} from '../lib/selectors'

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'muscles', label: 'Muscles' },
  { value: 'log', label: 'Log' },
  { value: 'measurements', label: 'Measurements' },
]

export default function StatsHub() {
  const { tab } = useParams()
  const navigate = useNavigate()
  const active = tab || 'overview'

  return (
    <div className="pb-4">
      <div className="px-5 pb-2 pt-5">
        <div className="font-serif text-[22px] font-semibold">Stats</div>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-5 pb-3">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => (t.value === 'measurements' ? navigate('/measurements') : navigate(`/stats/${t.value}`))}
            className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold"
            style={{ background: active === t.value ? 'var(--accent)' : 'var(--surface-alt)', color: active === t.value ? '#fff' : 'var(--muted)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'overview' && <OverviewTab />}
      {active === 'muscles' && <MusclesTab />}
      {active === 'log' && <LogTab />}
    </div>
  )
}

function OverviewTab() {
  const { state } = useStore()
  const [rangeDays, setRangeDays] = useState(30)
  const from = daysAgo(rangeDays - 1)
  const inRange = useMemo(() => sessionsSince(state.sessions, from), [state.sessions, rangeDays])
  const series = useMemo(() => chartSeries(state.sessions, 'workouts', rangeDays), [state.sessions, rangeDays])
  const weeks = Math.max(1, rangeDays / 7)

  const perWorkout = useMemo(() => {
    const n = inRange.length || 1
    return {
      exercises: round1(inRange.reduce((s, sess) => s + sess.entries.length, 0) / n),
      sets: round1(inRange.reduce((s, sess) => s + totalSets(sess), 0) / n),
      reps: round1(inRange.reduce((s, sess) => s + totalReps(sess), 0) / n),
      volume: round1(inRange.reduce((s, sess) => s + totalVolume(sess), 0) / n),
      duration: round1(inRange.reduce((s, sess) => s + sess.durationSec, 0) / n / 60),
    }
  }, [inRange])

  const weekly = useMemo(() => ({
    workouts: round1(inRange.length / weeks),
    sets: round1(inRange.reduce((s, sess) => s + totalSets(sess), 0) / weeks),
    volume: round1(inRange.reduce((s, sess) => s + totalVolume(sess), 0) / weeks),
  }), [inRange, weeks])

  return (
    <div className="flex flex-col gap-5 px-5">
      <div className="flex justify-end">
        <SegmentedControl value={rangeDays} onChange={setRangeDays} options={[{ value: 7, label: '7d' }, { value: 30, label: '30d' }, { value: 90, label: '90d' }]} />
      </div>
      <Card>
        <div className="mb-2 text-sm font-semibold">Workout frequency</div>
        <LineChart series={series} mode="bar" />
      </Card>

      <div>
        <div className="font-serif mb-2 text-base font-semibold">Workout average</div>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Exercises" value={perWorkout.exercises} />
          <StatTile label="Sets" value={perWorkout.sets} />
          <StatTile label="Reps" value={perWorkout.reps} />
          <StatTile label="Volume (kg)" value={perWorkout.volume} />
          <StatTile label="Duration (min)" value={perWorkout.duration} />
        </div>
      </div>

      <div>
        <div className="font-serif mb-2 text-base font-semibold">Weekly average</div>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Workouts" value={weekly.workouts} />
          <StatTile label="Sets" value={weekly.sets} />
          <StatTile label="Volume (kg)" value={weekly.volume} />
        </div>
      </div>
    </div>
  )
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-2xl border p-3 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="tabular-nums text-base font-bold">{value}</div>
      <div className="mt-0.5 text-[10.5px]" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}

// The commonly cited effective weekly set range per muscle group for
// hypertrophy. Shown as a band behind each bar so the number has a reference
// to be read against rather than standing alone.
const SETS_TARGET_MIN = 10
const SETS_TARGET_MAX = 20

function MusclesTab() {
  const { state, exercises } = useStore()
  const navigate = useNavigate()
  const [rangeDays, setRangeDays] = useState(30)
  const [filterMuscles, setFilterMuscles] = useState(null)

  const inRange = useMemo(() => sessionsSince(state.sessions, daysAgo(rangeDays - 1)), [state.sessions, rangeDays])
  const muscleCounts = useMemo(() => muscleSetCounts(inRange, exercises), [inRange, exercises])
  const intensities = useMemo(() => regionIntensities(muscleCounts), [muscleCounts])
  const weeks = Math.max(1, rangeDays / 7)

  const muscleRows = useMemo(
    () => Object.entries(muscleCounts).map(([m, sets]) => ({ muscle: m, perWeek: round1(sets / weeks) })).sort((a, b) => b.perWeek - a.perWeek),
    [muscleCounts, weeks]
  )
  // Scaling bars to your own busiest muscle only says which muscle you train
  // most — not whether any of them get enough work. Scaling to a fixed
  // effective-range axis makes "under / in range / over" readable instead.
  const axisMax = Math.max(SETS_TARGET_MAX + 6, ...muscleRows.map((r) => r.perWeek))
  const bandLeft = (SETS_TARGET_MIN / axisMax) * 100
  const bandWidth = ((SETS_TARGET_MAX - SETS_TARGET_MIN) / axisMax) * 100

  const exerciseCounts = useMemo(() => exerciseSetCounts(inRange), [inRange])
  const exerciseRows = useMemo(() => {
    let ids = Object.keys(exerciseCounts)
    if (filterMuscles) ids = ids.filter((id) => { const ex = exerciseById(id, exercises); return ex && (filterMuscles.includes(ex.primary) || filterMuscles.includes(ex.secondary)) })
    return ids.map((id) => ({ id, name: exerciseById(id, exercises)?.name || id, sets: exerciseCounts[id] })).sort((a, b) => b.sets - a.sets)
  }, [exerciseCounts, filterMuscles, exercises])

  return (
    <div className="flex flex-col gap-5 px-5">
      <div className="flex justify-end">
        <SegmentedControl value={rangeDays} onChange={setRangeDays} options={[{ value: 7, label: '7d' }, { value: 30, label: '30d' }, { value: 90, label: '90d' }]} />
      </div>
      <Card>
        <BodyHeatmap intensities={intensities} onRegionClick={(r) => setFilterMuscles(musclesForRegion(r))} />
        <div className="mt-1 text-center text-[11px]" style={{ color: 'var(--muted)' }}>Tap a region to filter exercises below</div>
      </Card>

      <div>
        <div className="font-serif mb-2 text-base font-semibold">Weekly sets per muscle group</div>
        <div className="flex flex-col gap-2">
          {muscleRows.map((r) => {
            const inRange = r.perWeek >= SETS_TARGET_MIN && r.perWeek <= SETS_TARGET_MAX
            return (
              <div key={r.muscle} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0" style={{ color: 'var(--muted)' }}>{r.muscle}</span>
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-alt)' }}>
                  <div
                    className="absolute inset-y-0"
                    style={{ left: `${bandLeft}%`, width: `${bandWidth}%`, background: 'var(--accent-light)' }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${Math.min(100, (r.perWeek / axisMax) * 100)}%`,
                      background: 'var(--accent)',
                      opacity: inRange ? 1 : 0.55,
                    }}
                  />
                </div>
                <span
                  className="tabular-nums w-8 shrink-0 text-right font-semibold"
                  style={{ color: inRange ? 'var(--accent-dark)' : 'var(--muted)' }}
                >
                  {r.perWeek}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>
          Shaded band = {SETS_TARGET_MIN}–{SETS_TARGET_MAX} sets/week, the usual effective range per muscle group.
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="font-serif text-base font-semibold">Most trained exercises</div>
          {filterMuscles && <button onClick={() => setFilterMuscles(null)} className="text-xs font-semibold" style={{ color: 'var(--accent-dark)' }}>Clear filter</button>}
        </div>
        <div className="flex flex-col gap-1 overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          {exerciseRows.map((r) => (
            <div key={r.id} onClick={() => navigate(`/exercise/${r.id}`)} className="flex cursor-pointer justify-between border-b p-3 text-sm last:border-0" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <span>{r.name}</span>
              <span className="tabular-nums font-semibold">{r.sets} sets</span>
            </div>
          ))}
          {!exerciseRows.length && <div className="p-4 text-center text-sm" style={{ color: 'var(--muted)' }}>No sets logged in this range.</div>}
        </div>
      </div>
    </div>
  )
}

function LogTab() {
  const { state, exercises } = useStore()
  const navigate = useNavigate()
  const [routineFilter, setRoutineFilter] = useState('all')
  const [openId, setOpenId] = useState(null)

  const sorted = useMemo(() => [...state.sessions].sort((a, b) => b.date.localeCompare(a.date)), [state.sessions])
  const filtered = routineFilter === 'all' ? sorted : sorted.filter((s) => s.routineId === routineFilter)

  return (
    <div className="flex flex-col gap-3 px-5">
      <select
        value={routineFilter}
        onChange={(e) => setRoutineFilter(e.target.value)}
        className="rounded-xl border p-2 text-sm"
        style={{ borderColor: 'var(--border)' }}
      >
        <option value="all">All routines</option>
        {state.routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>

      <div className="flex flex-col gap-2">
        {filtered.map((session) => {
          const open = openId === session.id
          return (
            <div key={session.id} className="rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div onClick={() => setOpenId(open ? null : session.id)} className="flex cursor-pointer items-center justify-between p-3.5">
                <div>
                  <div className="text-sm font-semibold">{session.routineName}</div>
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>{fmtDate(session.date)} · {totalSets(session)} sets · {session.volume}kg</div>
                </div>
                <ChevronRightIcon size={16} style={{ color: 'var(--muted)', transform: open ? 'rotate(90deg)' : 'none' }} />
              </div>
              {open && (
                <div className="flex flex-col gap-1.5 border-t px-3.5 pb-3.5 pt-2.5" style={{ borderColor: 'var(--border)' }}>
                  {session.entries.map((entry, i) => (
                    <div key={i} onClick={() => navigate(`/exercise/${entry.exerciseId}`)} className="flex cursor-pointer justify-between text-xs">
                      <span>{exerciseById(entry.exerciseId, exercises)?.name || entry.exerciseId}</span>
                      <span className="tabular-nums" style={{ color: 'var(--muted)' }}>{entry.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')}</span>
                    </div>
                  ))}
                  {session.note && <div className="mt-1 text-xs italic" style={{ color: 'var(--muted)' }}>"{session.note}"</div>}
                </div>
              )}
            </div>
          )
        })}
        {!filtered.length && <div className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>No workouts logged yet.</div>}
      </div>
    </div>
  )
}
