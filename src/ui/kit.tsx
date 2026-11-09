import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/cn'

/* ---------------- Button ---------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger'
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export function Button({ variant = 'ghost', size = 'md', icon, className, children, ...rest }: ButtonProps) {
  const v =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'quiet'
        ? 'border-transparent bg-transparent text-ink-2 hover:bg-head hover:text-ink'
        : variant === 'danger'
          ? 'border-line bg-transparent text-danger hover:border-danger hover:bg-surface'
          : 'btn-ghost'
  return (
    <button
      type="button"
      className={cn('btn', v, size === 'sm' && 'h-[22px] px-1.5 text-[11px]', className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

/* ---------------- Chip ---------------- */

export function Chip({
  children,
  tone = 'default',
  className,
  ...rest
}: {
  children: ReactNode
  tone?: 'default' | 'accent' | 'warn' | 'ok' | 'danger'
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const toneCls =
    tone === 'accent'
      ? 'border-accent bg-accent-soft text-accent'
      : tone === 'warn'
        ? 'border-warn text-warn'
        : tone === 'ok'
          ? 'border-ok text-ok'
          : tone === 'danger'
            ? 'border-danger text-danger'
            : 'border-line text-ink-2'
  return (
    <button type="button" className={cn('chip', toneCls, className)} {...rest}>
      {children}
    </button>
  )
}

/* ---------------- Dot ---------------- */

export function Dot({ tone = 'neutral', className }: { tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'; className?: string }) {
  const color =
    tone === 'ok'
      ? 'bg-ok'
      : tone === 'warn'
        ? 'bg-warn'
        : tone === 'danger'
          ? 'bg-danger'
          : tone === 'accent'
            ? 'bg-accent'
            : 'bg-ink-3'
  return <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', color, className)} />
}

/* ---------------- Field ---------------- */

export function Field({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-6 w-full rounded-[3px] border border-line-strong bg-surface px-1.5 text-[12px] text-ink placeholder:text-ink-3',
        'focus:border-accent focus:outline-none focus:shadow-[0_0_0_2px_rgba(10,99,201,0.18)]',
        className,
      )}
      {...rest}
    />
  )
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full resize-none rounded-[3px] border border-line-strong bg-surface px-2 py-1.5 text-[12.5px] leading-[1.6] text-ink',
        'placeholder:text-ink-3 focus:border-accent focus:outline-none focus:shadow-[0_0_0_2px_rgba(10,99,201,0.18)]',
        className,
      )}
      {...rest}
    />
  )
}

/* ---------------- Empty ---------------- */

export function Empty({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      <div className="text-[13px] text-ink-2">{title}</div>
      {hint && <p className="max-w-[320px] text-[11px] leading-[1.7] text-ink-3">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

/* ---------------- Skeleton ---------------- */

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={cn('sk block animate-sk', className)} style={style} />
}

/* ---------------- Inline note ---------------- */

export function Note({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'danger' | 'ok'
  children: ReactNode
}) {
  const cls =
    tone === 'danger'
      ? 'border-danger text-danger'
      : tone === 'warn'
        ? 'border-warn text-warn'
        : tone === 'ok'
          ? 'border-ok text-ok'
          : 'border-line text-ink-2'
  return (
    <div className={cn('rounded-btn border bg-surface px-2 py-1.5 text-[11px] leading-[1.6]', cls)}>
      {children}
    </div>
  )
}

/* ---------------- Floating popover ---------------- */

export function Floating({
  anchor,
  open,
  onClose,
  children,
  width = 260,
  align = 'right',
}: {
  anchor: HTMLElement | null
  open: boolean
  onClose: () => void
  children: ReactNode
  width?: number
  align?: 'left' | 'right'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !anchor) return
    const r = anchor.getBoundingClientRect()
    const h = ref.current?.offsetHeight ?? 200
    const top = Math.min(Math.max(8, r.bottom + 6), window.innerHeight - h - 8)
    const left = align === 'right' ? Math.max(8, r.right - width) : r.left
    setPos({ top, left })
  }, [open, anchor, width, align, children])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      style={{ top: pos.top, left: pos.left, width }}
      className="fixed z-50 rounded-[6px] border border-line-strong bg-surface p-2 shadow-[var(--shadow-float)] animate-fadein"
    >
      {children}
    </div>,
    document.body,
  )
}

/* ---------------- Section title ---------------- */

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-[11px] font-medium text-ink-3', className)}>{children}</div>
  )
}

export function Hairline({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line', className)} />
}
