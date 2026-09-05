export default function Card({ children, onClick, className = '', style = {}, dashed = false }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[20px] border p-4 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{
        background: dashed ? 'transparent' : 'var(--surface)',
        borderColor: 'var(--border)',
        borderStyle: dashed ? 'dashed' : 'solid',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
