/**
 * Whether this browser can receive push, from facts the caller reads. Pure.
 */

export type NotificationPermissionState = 'default' | 'granted' | 'denied'

export type PushAvailability =
  /** No Push API, no service worker or no Notification API. */
  | 'unsupported'
  /** iOS Safari in a tab: push exists only in the installed app (iOS 16.4+). */
  | 'ios-install'
  /** The person refused notifications; only the browser settings can undo that. */
  | 'blocked'
  /** Push can be enabled (or already is). */
  | 'available'

export function pushAvailability(input: {
  supported: boolean
  ios: boolean
  standalone: boolean
  permission: NotificationPermissionState
}): PushAvailability {
  if (input.ios && !input.standalone) {
    return 'ios-install'
  }
  if (!input.supported) {
    return 'unsupported'
  }
  if (input.permission === 'denied') {
    return 'blocked'
  }
  return 'available'
}

/** A VAPID public key (URL-safe base64, 65 raw bytes) as `applicationServerKey`. */
export function applicationServerKey(base64url: string): Uint8Array {
  const padded = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=')
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}
