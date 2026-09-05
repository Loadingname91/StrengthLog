import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import Card from '../components/Card'
import ProgressBar from '../components/ProgressBar'
import SegmentedControl from '../components/SegmentedControl'
import LineChart from '../components/LineChart'
import BodyHeatmap from '../components/BodyHeatmap'
import { CalendarIcon } from '../components/Icons'
import { goalProgress, chartSeries, muscleSetCounts, sessionsSince, exerciseSetCounts } from '../lib/selectors'
import { regionIntensities } from '../lib/muscles'
import { daysAgo } from '../lib/format'
import { exerciseById } from '../lib/exercises'

export default function Home() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [metric, setMetric] = useState('workouts')
  const [rangeDays, setRangeDays] = useState(30)
  const [addingGoal, setAddingGoal] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState(null)

  const nextRoutineId = state.routineOrder[state.sequenceIndex] || state.routineOrder[0]
  const nextRoutine = state.routines.find((r) => r.id === nextRoutineId)
  const preview = nextRoutine
    ? nextRoutine.blocks.flatMap((b) => b.exerciseIds).slice(0, 3).map((id) => exerciseById(id)?.name).filter(Boolean).join(', ')
    : ''

  const topExercises = useMemo(() => {
    const counts = exerciseSetCounts(state.sessions)
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 5)
  }, [state.sessions])
  const activeExerciseId = selectedExercise || topExercises[0] || null
  const series = useMemo(() => chartSeries(state.sessions, metric, rangeDays, activeExerciseId), [state.sessions, metric, rangeDays, activeExerciseId])
  const weekCounts = useMemo(() => muscleSetCounts(sessionsSince(state.sessions, daysAgo(6))), [state.sessions])
  const intensities = useMemo(() => regionIntensities(weekCounts), [weekCounts])

  const hasHistory = state.sessions.length > 0

  function startWorkout(routineId) {
    dispatch({ type: 'START_WORKOUT', payload: { routineId } })
    navigate('/workout')
  }

  return (
    <div className="pb-4">
      <div className="flex items-center justify-between px-5 pb-1 pt-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white" style={{ background: 'var(--accent)' }}>
            {state.user.name[0]}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] whitespace-nowrap" style={{ color: 'var(--muted)' }}>Welcome back</div>
            <div className="font-serif text-[19px] font-semibold whitespace-nowrap">{state.user.name}</div>
          </div>
        </div>
        <button
          onClick={() => navigate('/stats/log')}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full border"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <CalendarIcon size={18} />
        </button>
      </div>

      {nextRoutine && (
        <div className="px-5 pt-4">
          <Card onClick={() => navigate(`/routines/${nextRoutine.id}`)}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
              Next up · {nextRoutine.position}
            </div>
            <div className="font-serif mt-1 text-[22px] font-semibold">{nextRoutine.name}</div>
            <div className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>{preview}</div>
            <button
              onClick={(e) => { e.stopPropagation(); startWorkout(nextRoutine.id) }}
              className="mt-3.5 w-full rounded-2xl py-3.5 text-base font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              Start Workout
            </button>
          </Card>
        </div>
      )}

      <div className="px-5 pt-5">
        <div className="font-serif mb-2.5 text-base font-semibold">Goals</div>
        <div className="flex flex-col gap-2.5">
          {state.goals.map((goal) => {
            const p = goalProgress(goal, state.sessions)
            return (
              <Card key={goal.id} onClick={() => navigate('/stats/log')}>
                <div className="mb-2 flex justify-between gap-2.5 text-[13px]">
                  <span className="leading-tight">{p.label}</span>
                  <span className="tabular-nums shrink-0" style={{ color: 'var(--muted)' }}>{p.current}/{p.target}</span>
                </div>
                <ProgressBar pct={p.pct} />
              </Card>
            )
          })}
          <button
            onClick={() => setAddingGoal(true)}
            className="rounded-2xl border border-dashed p-3 text-[13px]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            + Add goal
          </button>
        </div>
      </div>

      {addingGoal && <AddGoalSheet onClose={() => setAddingGoal(false)} />}

      {!hasHistory ? (
        <div className="px-5 pt-8 text-center">
          <div className="text-4xl">🏋️</div>
          <div className="font-serif mt-3 text-lg font-semibold">Log your first workout</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Start today's routine and your stats will show up here.
          </div>
          {nextRoutine && (
            <button
              onClick={() => startWorkout(nextRoutine.id)}
              className="mt-4 rounded-2xl px-6 py-3 text-sm font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              Start Workout
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="px-5 pt-6">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="font-serif text-base font-semibold">Overview</div>
              <SegmentedControl
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'workouts', label: 'Workouts' },
                  { value: 'volume', label: 'Volume' },
                  { value: 'exercise', label: 'Top lift' },
                ]}
              />
            </div>
            {metric === 'exercise' && (
              <select
                className="mb-2 w-full rounded-xl border p-2 text-xs"
                style={{ borderColor: 'var(--border)' }}
                value={selectedExercise || topExercises[0] || ''}
                onChange={(e) => setSelectedExercise(e.target.value)}
              >
                {topExercises.map((id) => (
                  <option key={id} value={id}>{exerciseById(id)?.name}</option>
                ))}
              </select>
            )}
            <Card>
              <LineChart series={series} />
              <div className="mt-1 flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
                <span>{rangeDays} days ago</span><span>Today</span>
              </div>
              <div className="mt-2 flex justify-center">
                <SegmentedControl
                  value={rangeDays}
                  onChange={setRangeDays}
                  options={[{ value: 7, label: '7d' }, { value: 30, label: '30d' }, { value: 90, label: '90d' }]}
                />
              </div>
            </Card>
          </div>

          <div className="px-5 pt-6">
            <Card onClick={() => navigate('/stats/muscles')}>
              <div className="mb-2.5 flex items-center justify-between">
                <div className="font-serif text-base font-semibold">Muscles worked</div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Last 7 days ›</span>
              </div>
              <BodyHeatmap intensities={intensities} />
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function AddGoalSheet({ onClose }) {
  const { dispatch } = useStore()
  const [type, setType] = useState('muscleSets')
  const [muscle, setMuscle] = useState('Chest')
  const [period, setPeriod] = useState('week')
  const [target, setTarget] = useState(12)

  function save() {
    dispatch({ type: 'ADD_GOAL', payload: { type, muscle: type === 'muscleSets' ? muscle : undefined, period, target: Number(target) } })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="fade-in mx-auto w-full max-w-[480px] rounded-t-[24px] p-5" style={{ background: 'var(--surface)' }} onClick={(e) => e.stopPropagation()}>
        <div className="font-serif text-lg font-semibold">New goal</div>
        <div className="mt-3 flex flex-col gap-3">
          <SegmentedControl
            size="lg"
            value={type}
            onChange={setType}
            options={[{ value: 'muscleSets', label: 'Muscle sets' }, { value: 'workoutCount', label: 'Workout count' }]}
          />
          {type === 'muscleSets' && (
            <select className="rounded-xl border p-2 text-sm" style={{ borderColor: 'var(--border)' }} value={muscle} onChange={(e) => setMuscle(e.target.value)}>
              {['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core'].map((m) => <option key={m}>{m}</option>)}
            </select>
          )}
          <SegmentedControl size="lg" value={period} onChange={setPeriod} options={[{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-xl border p-2 text-sm"
            style={{ borderColor: 'var(--border)' }}
            placeholder="Target"
          />
        </div>
        <button onClick={save} className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold text-white" style={{ background: 'var(--accent)' }}>
          Add goal
        </button>
      </div>
    </div>
  )
}
