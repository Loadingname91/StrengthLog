import { heatColor } from '../lib/muscles'

function Figure({ back, intensities, size = 60, onRegionClick }) {
  const c = (region) => heatColor(intensities[region] || 0)
  const click = (region) => (onRegionClick ? () => onRegionClick(region) : undefined)
  const cursor = onRegionClick ? 'pointer' : 'default'
  return (
    <svg width={size} height={size * 2} viewBox="0 0 60 120">
      <ellipse cx="30" cy="12" rx="9" ry="10" fill={c('head')} onClick={click('head')} style={{ cursor }} />
      <rect x="17" y="24" width="26" height="34" rx="8" fill={back ? c('back') : c('chest')} onClick={click(back ? 'back' : 'chest')} style={{ cursor }} />
      <rect x="6" y="26" width="10" height="34" rx="5" fill={c('arms')} onClick={click('arms')} style={{ cursor }} />
      <rect x="44" y="26" width="10" height="34" rx="5" fill={c('arms')} onClick={click('arms')} style={{ cursor }} />
      <rect x="18" y="60" width="24" height="30" rx="6" fill={c('core')} onClick={click('core')} style={{ cursor }} />
      <rect x="16" y="90" width="12" height="28" rx="5" fill={back ? c('glutes') : c('legs')} onClick={click(back ? 'glutes' : 'legs')} style={{ cursor }} />
      <rect x="32" y="90" width="12" height="28" rx="5" fill={back ? c('glutes') : c('legs')} onClick={click(back ? 'glutes' : 'legs')} style={{ cursor }} />
    </svg>
  )
}

export default function BodyHeatmap({ intensities, size = 60, gap = 28, onRegionClick }) {
  return (
    <div className="flex justify-center" style={{ gap }}>
      <Figure intensities={intensities} size={size} onRegionClick={onRegionClick} />
      <Figure back intensities={intensities} size={size} onRegionClick={onRegionClick} />
    </div>
  )
}
