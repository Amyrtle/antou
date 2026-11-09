import type { LucideIcon } from 'lucide-react'

/** 统一 1.5px 描边线性图标，只允许 16 / 20 两档 */
export function Icon({
  as: C,
  size = 16,
  className,
}: {
  as: LucideIcon
  size?: number
  className?: string
}) {
  return <C size={size} strokeWidth={1.5} className={className} aria-hidden="true" />
}
