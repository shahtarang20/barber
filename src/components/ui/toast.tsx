"use client"

import * as React from "react"
import { translate } from "@/lib/i18n"

/**
 * Small, dependency-free toast messages. (The earlier version pulled a 70 KB toast library into every page,
 * including the home page, just to show an occasional "Saved" message.)
 *
 *   toast.add({ title, description, type: "success" | "error" | "info" | "warning", timeout? })
 *
 * Messages appear at the top of the screen (a bottom one would cover the Save buttons and the bottom menu),
 * go away by themselves after 5 seconds, and can be dismissed with the ✕ or by swiping them up or sideways.
 */

type ToastType = "success" | "error" | "info" | "warning" | "loading" | undefined

interface ToastOptions {
  title?: React.ReactNode
  description?: React.ReactNode
  type?: ToastType | string
  /** Milliseconds before it goes away by itself (default 5000, 0 = stays until closed). */
  timeout?: number
}

interface ToastItem extends ToastOptions {
  id: number
}

const MAX_VISIBLE = 3
let nextId = 1
let items: ToastItem[] = []
const subscribers = new Set<() => void>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function emit() {
  subscribers.forEach((fn) => fn())
}

function close(id: number) {
  const t = timers.get(id)
  if (t) clearTimeout(t)
  timers.delete(id)
  items = items.filter((i) => i.id !== id)
  emit()
}

function add(options: ToastOptions): number {
  // While the phone has no internet, any error toast says so plainly instead of a vague "something went wrong".
  const offline = typeof navigator !== "undefined" && navigator.onLine === false
  const opts = offline && options.type === "error" ? { ...options, description: translate("noInternet") } : options
  const id = nextId++
  items = [{ ...opts, id }, ...items].slice(0, MAX_VISIBLE + 2)
  const timeout = opts.timeout ?? 5000
  if (timeout > 0) timers.set(id, setTimeout(() => close(id), timeout))
  emit()
  return id
}

const toast = { add, close }

const subscribe = (fn: () => void) => {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}
const getSnapshot = () => items
const EMPTY_TOASTS: ToastItem[] = []
const getServerSnapshot = () => EMPTY_TOASTS

const ICONS: Record<string, { path: string; className?: string }> = {
  success: { path: "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3" },
  error: { path: "M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86zM15 9l-6 6M9 9l6 6", className: "text-destructive" },
  info: { path: "M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" },
  warning: { path: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01" },
}

function ToastCard({ item }: { item: ToastItem }) {
  const start = React.useRef<{ x: number; y: number } | null>(null)
  const [drag, setDrag] = React.useState({ x: 0, y: 0 })
  const icon = item.type ? ICONS[item.type] : undefined

  return (
    <div
      role={item.type === "error" ? "alert" : "status"}
      data-slot="toast"
      className="pointer-events-auto flex w-full touch-pan-y items-start gap-3 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-lg select-none"
      style={{ transform: drag.x || drag.y ? `translate(${drag.x}px, ${Math.min(0, drag.y)}px)` : undefined, opacity: drag.x || drag.y ? Math.max(0.3, 1 - Math.hypot(drag.x, drag.y) / 200) : 1 }}
      onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY } }}
      onPointerMove={(e) => { if (start.current) setDrag({ x: Math.max(0, e.clientX - start.current.x), y: e.clientY - start.current.y }) }}
      onPointerUp={() => {
        const moved = drag
        start.current = null
        if (moved.x > 70 || moved.y < -40) close(item.id)
        else setDrag({ x: 0, y: 0 })
      }}
      onPointerCancel={() => { start.current = null; setDrag({ x: 0, y: 0 }) }}
    >
      {icon && (
        <svg data-slot="toast-icon" className={`mt-0.5 size-4 shrink-0 ${icon.className ?? ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={icon.path} />
        </svg>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {item.title && <div data-slot="toast-title" className="text-sm font-medium">{item.title}</div>}
        {item.description && <div data-slot="toast-description" className="text-sm text-muted-foreground break-words">{item.description}</div>}
      </div>
      <button
        type="button"
        aria-label="Close toast"
        onClick={() => close(item.id)}
        className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
  )
}

function Toaster() {
  const list = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (list.length === 0) return null
  return (
    <div
      data-slot="toast-viewport"
      className="pointer-events-none fixed inset-x-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-[100] mx-auto flex w-auto max-w-sm flex-col gap-2 sm:right-4 sm:left-auto sm:mx-0 sm:w-full"
    >
      {list.slice(0, MAX_VISIBLE).map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  )
}

export { Toaster, toast }
