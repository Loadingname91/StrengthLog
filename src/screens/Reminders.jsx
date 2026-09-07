import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import Card from '../components/Card'
import SegmentedControl from '../components/SegmentedControl'
import ConfirmSheet from '../components/ConfirmSheet'
import WeekdayPicker from '../components/WeekdayPicker'
import { BackIcon, TrashIcon, ChevronRightIcon } from '../components/Icons'
import { weekdayName, dueInfo } from '../lib/schedule'
import { MAX_REMINDERS } from '../lib/reminderPlan'
import { pushModal, popModal } from '../lib/modalStack'

function daysSummary(days) {
  if (days.length === 7) return 'Every day'
  if (days.length === 0) return 'No days selected'
  return [...days].sort((a, b) => a - b).map((d) => weekdayName(d, true)).join(' · ')
}

function autoSummary(state) {
  if (state.routineMode === 'weekday') {
    const assigned = Object.entries(state.weekdayAssignments || {})
    if (!assigned.length) return 'No routines assigned to a day yet'
    return assigned
      .map(([routineId, weekday]) => {
        const routine = state.routines.find((r) => r.id === routineId)
        return routine ? `${routine.name} · ${weekdayName(weekday, true)}` : null
      })
      .filter(Boolean)
      .join(', ')
  }
  const nextRoutineId = state.routineOrder[state.sequenceIndex] || state.routineOrder[0]
  const nextRoutine = state.routines.find((r) => r.id === nextRoutineId)
  if (!nextRoutine) return 'No routines yet'
  const due = dueInfo(nextRoutine.id, state.weekdayAssignments, state.sessions, state.scheduleRestartAt, state.createdAt)
  return due.isOverdue ? `${nextRoutine.name} is overdue` : `Reminds you about ${nextRoutine.name}, your next workout`
}

export default function Reminders() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(null) // reminder object, or {} for a new one
  const [deleteTarget, setDeleteTarget] = useState(null)

  const sorted = [...state.reminders].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="pb-8">
      <div className="p-3.5"><button onClick={() => navigate('/settings')} className="p-1.5"><BackIcon /></button></div>
      <div className="font-serif px-5 text-[22px] font-semibold">Reminders</div>
      <div className="px-5 pt-1 text-xs" style={{ color: 'var(--muted)' }}>
        Follow your workout schedule automatically, or set alarm-style reminders on your own days.
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-4">
        {sorted.length === 0 && (
          <Card dashed className="text-center text-[13px]" style={{ color: 'var(--muted)' }}>
            No reminders yet. Add one to get notified when it's time to train.
          </Card>
        )}

        {sorted.map((reminder) => (
          <Card key={reminder.id} onClick={() => setEditing(reminder)} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-semibold">{reminder.time}</span>
                {!reminder.enabled && <span className="text-[11px]" style={{ color: 'var(--muted)' }}>Off</span>}
              </div>
              <div className="mt-0.5 truncate text-xs" style={{ color: 'var(--muted)' }}>
                {reminder.mode === 'auto' ? autoSummary(state) : (reminder.label || daysSummary(reminder.days))}
              </div>
            </div>
            <input
              type="checkbox"
              checked={reminder.enabled}
              onChange={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_REMINDER', payload: { id: reminder.id, patch: { enabled: e.target.checked } } }) }}
              onClick={(e) => e.stopPropagation()}
              className="h-5 w-5 shrink-0"
            />
            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(reminder.id) }} style={{ color: 'var(--muted)' }} className="shrink-0">
              <TrashIcon size={15} />
            </button>
            <ChevronRightIcon size={16} style={{ color: 'var(--muted)' }} className="shrink-0" />
          </Card>
        ))}

        <button
          disabled={state.reminders.length >= MAX_REMINDERS}
          onClick={() => setEditing({})}
          className="rounded-2xl border border-dashed p-3.5 text-[13px] font-semibold disabled:opacity-40"
          style={{ borderColor: 'var(--border)', color: 'var(--accent-dark)' }}
        >
          + Add reminder
        </button>
        {state.reminders.length >= MAX_REMINDERS && (
          <div className="text-center text-[11px]" style={{ color: 'var(--muted)' }}>Maximum of {MAX_REMINDERS} reminders reached.</div>
        )}
      </div>

      <ConfirmSheet
        open={!!deleteTarget}
        title="Delete this reminder?"
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { dispatch({ type: 'DELETE_REMINDER', payload: deleteTarget }); setDeleteTarget(null) }}
      />

      {editing && (
        <ReminderEditSheet
          reminder={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ReminderEditSheet({ reminder, onClose }) {
  const { state, dispatch } = useStore()
  const isNew = !reminder.id
  const [mode, setMode] = useState(reminder.mode || 'auto')
  const [time, setTime] = useState(reminder.time || '18:00')
  const [days, setDays] = useState(reminder.days || [])
  const [label, setLabel] = useState(reminder.label || '')

  useEffect(() => {
    const handle = pushModal(onClose)
    return () => popModal(handle)
  }, [onClose])

  const canSave = mode === 'auto' || days.length > 0

  function save() {
    if (!canSave) return
    const patch = { mode, time, days: mode === 'custom' ? days : [], label: mode === 'custom' ? label : '' }
    if (isNew) dispatch({ type: 'ADD_REMINDER', payload: patch })
    else dispatch({ type: 'UPDATE_REMINDER', payload: { id: reminder.id, patch } })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="fade-in mx-auto w-full max-w-[480px] rounded-t-[24px] p-5 pb-[max(20px,env(safe-area-inset-bottom))]"
        style={{ background: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-serif text-lg font-semibold">{isNew ? 'Add reminder' : 'Edit reminder'}</div>

        <div className="mt-4">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[{ value: 'auto', label: 'Follow schedule' }, { value: 'custom', label: 'Custom days' }]}
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-semibold">Time</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg border p-1.5 text-sm"
            style={{ borderColor: 'var(--border)' }}
          />
        </div>

        {mode === 'custom' ? (
          <>
            <div className="mt-4">
              <span className="text-sm font-semibold">Days</span>
              <div className="mt-2"><WeekdayPicker value={days} onChange={setDays} /></div>
              {days.length === 0 && <div className="mt-1.5 text-[11px]" style={{ color: 'var(--danger)' }}>Pick at least one day.</div>}
            </div>
            <div className="mt-4">
              <span className="text-sm font-semibold">Label (optional)</span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Workout reminder"
                className="mt-2 w-full rounded-lg border p-2 text-sm"
                style={{ borderColor: 'var(--border)' }}
              />
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-xl border p-3 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            {autoSummary(state)}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-2xl border py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)' }}>
            Cancel
          </button>
          <button
            disabled={!canSave}
            onClick={save}
            className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
