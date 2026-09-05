import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/StoreContext'
import Card from '../components/Card'
import SegmentedControl from '../components/SegmentedControl'
import ConfirmSheet from '../components/ConfirmSheet'
import { ChevronRightIcon, TrashIcon } from '../components/Icons'
import { goalProgress } from '../lib/selectors'

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  )
}

export default function Settings() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteGoalTarget, setDeleteGoalTarget] = useState(null)

  function set(patch) {
    dispatch({ type: 'SET_SETTINGS', payload: patch })
  }

  return (
    <div className="pb-6">
      <div className="font-serif px-5 pb-2 pt-5 text-[22px] font-semibold">Settings</div>

      <div className="px-5 pt-2">
        <Card>
          <Row label="Units">
            <SegmentedControl value={state.settings.units} onChange={(v) => set({ units: v })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
          </Row>
          <div className="h-px" style={{ background: 'var(--border)' }} />
          <Row label="Theme">
            <SegmentedControl value={state.settings.theme} onChange={(v) => set({ theme: v })} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} />
          </Row>
          <div className="h-px" style={{ background: 'var(--border)' }} />
          <Row label="Show RIR chips">
            <input type="checkbox" checked={state.settings.showRIR} onChange={(e) => set({ showRIR: e.target.checked })} className="h-5 w-5" />
          </Row>
          <div className="h-px" style={{ background: 'var(--border)' }} />
          <Row label="Default rest (sec)">
            <input
              type="number"
              value={state.settings.restDefault}
              onChange={(e) => set({ restDefault: Number(e.target.value) })}
              className="w-20 rounded-lg border p-1.5 text-right text-sm"
              style={{ borderColor: 'var(--border)' }}
            />
          </Row>
        </Card>
      </div>

      <div className="px-5 pt-5">
        <div className="mb-2 text-[13px] font-semibold">Goals</div>
        <Card>
          {state.goals.map((g) => {
            const p = goalProgress(g, state.sessions)
            return (
              <div key={g.id} className="flex items-center justify-between py-2 text-sm">
                <span>{p.label}</span>
                <button onClick={() => setDeleteGoalTarget(g.id)} style={{ color: 'var(--muted)' }}><TrashIcon size={15} /></button>
              </div>
            )
          })}
          {!state.goals.length && <div className="py-2 text-sm" style={{ color: 'var(--muted)' }}>No goals yet — add one from Home.</div>}
        </Card>
      </div>

      <div className="px-5 pt-5">
        <div className="mb-2 text-[13px] font-semibold">Data</div>
        <Card className="!p-0">
          <NavRow label="Import from CSV" onClick={() => navigate('/csv-import')} />
          <div className="h-px" style={{ background: 'var(--border)' }} />
          <NavRow label="Export & Insights" onClick={() => navigate('/export')} />
          <div className="h-px" style={{ background: 'var(--border)' }} />
          <button onClick={() => setConfirmDelete(true)} className="flex w-full items-center justify-between p-3.5 text-sm" style={{ color: 'var(--danger)' }}>
            Delete all data
          </button>
        </Card>
      </div>

      <div className="px-5 pt-5 text-center text-xs" style={{ color: 'var(--muted)' }}>
        Local only — your data stays on this device.
      </div>

      <ConfirmSheet
        open={confirmDelete}
        title="Delete all data?"
        body="This permanently removes every workout, measurement, and goal on this device. Routines and the exercise library are kept."
        confirmLabel="Delete everything"
        danger
        holdToConfirm
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { dispatch({ type: 'DELETE_ALL_DATA' }); setConfirmDelete(false) }}
      />

      <ConfirmSheet
        open={!!deleteGoalTarget}
        title="Delete this goal?"
        body="This goal will be permanently removed. Your logged workout history is unaffected."
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteGoalTarget(null)}
        onConfirm={() => { dispatch({ type: 'DELETE_GOAL', payload: deleteGoalTarget }); setDeleteGoalTarget(null) }}
      />
    </div>
  )
}

function NavRow({ label, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between p-3.5 text-sm">
      <span>{label}</span>
      <ChevronRightIcon size={16} style={{ color: 'var(--muted)' }} />
    </button>
  )
}
