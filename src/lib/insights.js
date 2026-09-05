import { exerciseById } from './exercises'
import { exerciseSetCounts, exerciseHistory, sessionsSince, sessionsInRange } from './selectors'
import { startOfWeek, daysAgo } from './format'

function topSet(sets) {
  return Math.max(0, ...sets.map((s) => s.weight))
}

// Plain-language callouts generated straight from logged numbers — no
// external model call, just arithmetic over exerciseHistory/session data.
export function buildInsights(sessions) {
  const insights = []
  const counts = exerciseSetCounts(sessions)
  const trackedIds = Object.keys(counts).filter((id) => counts[id] >= 4)

  const gains = []
  const stalls = []
  for (const id of trackedIds) {
    const ex = exerciseById(id)
    if (!ex) continue
    const hist = exerciseHistory(sessions, id).filter((h) => h.date >= daysAgo(56).toISOString().slice(0, 10))
    if (hist.length < 3) continue
    const first = topSet(hist[0].sets)
    const last = topSet(hist[hist.length - 1].sets)
    const delta = Math.round((last - first) * 10) / 10
    const weeks = Math.max(1, Math.round((new Date(hist[hist.length - 1].date) - new Date(hist[0].date)) / (7 * 86400000)))

    if (delta >= 2) {
      gains.push({
        exerciseId: id,
        text: `${ex.name}: +${delta}kg over ${weeks} week${weeks === 1 ? '' : 's'}, on pace.`,
      })
    } else {
      const recent = hist.slice(-3)
      const recentTops = recent.map((h) => topSet(h.sets))
      const flat = recent.length >= 3 && recentTops.every((w) => w === recentTops[0])
      if (flat) {
        stalls.push({
          exerciseId: id,
          text: `${ex.name} has been flat at ${recentTops[0]}kg for ${recent.length} sessions.`,
        })
      }
    }
  }

  insights.push(...gains.slice(0, 2))
  insights.push(...stalls.slice(0, 1))

  // Frequency callout: this week vs trailing 4-week average.
  const thisWeek = sessionsSince(sessions, startOfWeek()).length
  const trailing = sessionsInRange(sessions, daysAgo(28), daysAgo(1)).length / 4
  if (trailing > 0) {
    const diffPct = Math.round(((thisWeek - trailing) / trailing) * 100)
    if (Math.abs(diffPct) >= 25) {
      insights.push({
        exerciseId: null,
        text: diffPct > 0
          ? `You've trained ${diffPct}% more this week than your recent average.`
          : `Training frequency is down ${Math.abs(diffPct)}% versus your recent average.`,
      })
    }
  }

  return insights.slice(0, 4)
}
