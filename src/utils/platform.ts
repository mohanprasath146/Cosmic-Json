export function isMacLike(): boolean {
  const platform = navigator.platform ?? ''
  return /mac|iphone|ipad/i.test(platform)
}

export function formatShortcut(shortcut: string): string {
  const mac = isMacLike()
  return shortcut
    .split('+')
    .map((part) => {
      const normalized = part.trim().toLowerCase()
      if (normalized === 'mod') {
        return mac ? '⌘' : 'Ctrl'
      }
      if (normalized === 'shift') {
        return mac ? '⇧' : 'Shift'
      }
      if (normalized === 'alt') {
        return mac ? '⌥' : 'Alt'
      }
      if (normalized === 'enter') {
        return mac ? '↩' : 'Enter'
      }
      if (normalized === 'esc') {
        return 'Esc'
      }
      return part.length === 1 ? part.toUpperCase() : part
    })
    .join(mac ? '' : '+')
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const tokens = shortcut.toLowerCase().split('+')
  const expectsMod = tokens.includes('mod')
  const expectsShift = tokens.includes('shift')
  const expectsAlt = tokens.includes('alt')
  const key = tokens.find((token) => !['mod', 'shift', 'alt'].includes(token))

  const modPressed = isMacLike() ? event.metaKey : event.ctrlKey
  if (expectsMod !== modPressed) {
    return false
  }
  if (expectsShift !== event.shiftKey) {
    return false
  }
  if (expectsAlt !== event.altKey) {
    return false
  }

  if (!key) {
    return false
  }

  const normalizedKey = event.key.toLowerCase()
  return normalizedKey === key.toLowerCase()
}
