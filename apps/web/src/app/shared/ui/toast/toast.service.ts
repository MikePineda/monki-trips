import { Injectable, signal } from '@angular/core'

export interface ToastAction {
  /** Button label; omit for the translated "Undo". */
  label?: string
  run: () => void
}

export interface ToastOptions {
  message: string
  action?: ToastAction
  /** Stays until dismissed or acted on (the "new version" toast). */
  persistent?: boolean
  /** Auto-dismiss delay; default 5 s, 8 s with an action. */
  durationMs?: number
}

export interface Toast {
  id: number
  message: string
  action?: ToastAction
  persistent: boolean
}

export interface ToastHandle {
  id: number
  dismiss: () => void
}

export const TOAST_DURATION_MS = 5000
export const TOAST_WITH_ACTION_DURATION_MS = 8000

/**
 * The toast queue; <mk-toast-host> (once, in the root component) renders
 * it. Messages arrive already translated. A toast with an action (undo)
 * stays longer; a persistent one stays until dismissed.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly queue = signal<Toast[]>([])
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>()
  private nextId = 1

  readonly toasts = this.queue.asReadonly()

  show(options: ToastOptions): ToastHandle {
    const id = this.nextId++
    const toast: Toast = {
      id,
      message: options.message,
      action: options.action,
      persistent: options.persistent ?? false,
    }
    this.queue.update((toasts) => [...toasts, toast])
    if (!toast.persistent) {
      const delay =
        options.durationMs ?? (options.action ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS)
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), delay)
      )
    }
    return { id, dismiss: () => this.dismiss(id) }
  }

  /** A saved-with-undo toast: the label is the translated "Undo". */
  showUndo(message: string, undo: () => void): ToastHandle {
    return this.show({ message, action: { run: undo } })
  }

  /** Runs the toast's action once and removes the toast. */
  act(id: number): void {
    const toast = this.queue().find((candidate) => candidate.id === id)
    if (!toast) {
      return
    }
    this.dismiss(id)
    toast.action?.run()
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(id)
    }
    this.queue.update((toasts) => toasts.filter((toast) => toast.id !== id))
  }
}
