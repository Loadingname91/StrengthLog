// Starter exercise library. `custom: true` marks exercises created in-app
// via "Create custom exercise" so they can be told apart if ever needed.
export const EXERCISES = [
  { id: 'bench-press', name: 'Bench Press', aliases: ['bb bench'], primary: 'Chest', secondary: 'Triceps', equipment: 'Barbell' },
  { id: 'incline-db-press', name: 'Incline Dumbbell Press', aliases: ['incline db press'], primary: 'Chest', secondary: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'push-up', name: 'Push-Up', aliases: ['pushup'], primary: 'Chest', secondary: 'Triceps', equipment: 'Bodyweight' },
  { id: 'cable-fly', name: 'Cable Fly', aliases: [], primary: 'Chest', secondary: null, equipment: 'Cable' },
  { id: 'overhead-press', name: 'Overhead Press', aliases: ['ohp', 'military press'], primary: 'Shoulders', secondary: 'Triceps', equipment: 'Barbell' },
  { id: 'lateral-raise', name: 'Lateral Raise', aliases: ['side raise'], primary: 'Shoulders', secondary: null, equipment: 'Dumbbell' },
  { id: 'face-pull', name: 'Face Pull', aliases: [], primary: 'Shoulders', secondary: 'Back', equipment: 'Cable' },
  { id: 'pull-up', name: 'Pull-Up', aliases: ['pullup', 'chin-up'], primary: 'Back', secondary: 'Biceps', equipment: 'Bodyweight' },
  { id: 'barbell-row', name: 'Barbell Row', aliases: ['bent over row'], primary: 'Back', secondary: 'Biceps', equipment: 'Barbell' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', aliases: [], primary: 'Back', secondary: 'Biceps', equipment: 'Cable' },
  { id: 'seated-cable-row', name: 'Seated Cable Row', aliases: [], primary: 'Back', secondary: null, equipment: 'Cable' },
  { id: 'deadlift', name: 'Deadlift', aliases: ['conventional deadlift'], primary: 'Back', secondary: 'Legs', equipment: 'Barbell' },
  { id: 'barbell-curl', name: 'Barbell Curl', aliases: [], primary: 'Biceps', secondary: null, equipment: 'Barbell' },
  { id: 'hammer-curl', name: 'Hammer Curl', aliases: [], primary: 'Biceps', secondary: null, equipment: 'Dumbbell' },
  { id: 'triceps-pushdown', name: 'Triceps Pushdown', aliases: [], primary: 'Triceps', secondary: null, equipment: 'Cable' },
  { id: 'skull-crusher', name: 'Skull Crusher', aliases: ['lying triceps extension'], primary: 'Triceps', secondary: null, equipment: 'Barbell' },
  { id: 'back-squat', name: 'Back Squat', aliases: ['squat'], primary: 'Legs', secondary: 'Glutes', equipment: 'Barbell' },
  { id: 'leg-press', name: 'Leg Press', aliases: [], primary: 'Legs', secondary: 'Glutes', equipment: 'Machine' },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', aliases: ['rdl'], primary: 'Legs', secondary: 'Glutes', equipment: 'Barbell' },
  { id: 'walking-lunge', name: 'Walking Lunge', aliases: [], primary: 'Legs', secondary: 'Glutes', equipment: 'Dumbbell' },
  { id: 'leg-curl', name: 'Leg Curl', aliases: [], primary: 'Legs', secondary: null, equipment: 'Machine' },
  { id: 'leg-extension', name: 'Leg Extension', aliases: [], primary: 'Legs', secondary: null, equipment: 'Machine' },
  { id: 'hip-thrust', name: 'Hip Thrust', aliases: [], primary: 'Glutes', secondary: null, equipment: 'Barbell' },
  { id: 'plank', name: 'Plank', aliases: [], primary: 'Core', secondary: null, equipment: 'Bodyweight' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', aliases: [], primary: 'Core', secondary: null, equipment: 'Bodyweight' },
  { id: 'cable-crunch', name: 'Cable Crunch', aliases: [], primary: 'Core', secondary: null, equipment: 'Cable' },
]

export function exerciseById(id, list = EXERCISES) {
  return list.find((e) => e.id === id)
}

export function searchExercises(list, query, muscle, equipment) {
  const q = query.trim().toLowerCase()
  return list.filter((e) => {
    if (muscle && e.primary !== muscle && e.secondary !== muscle) return false
    if (equipment && e.equipment !== equipment) return false
    if (!q) return true
    return e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q))
  })
}
