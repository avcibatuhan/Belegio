type IconProps = {
  name: string
  className?: string
  filled?: boolean
}

/** Material Symbols Outlined glyph. `name` is the ligature, e.g. "receipt_long". */
export function Icon({ name, className = 'text-[20px]', filled = false }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}
