import type { ThemeCustom, ThemeMode } from '../types'

export const THEME_DEFAULTS: Record<ThemeMode, ThemeCustom> = {
  dark: {
    textPrimary: '#f0f0f0',
    bgPanel: '#111111',
    bgBase: '#0a0a0a',
    borderDefault: '#2a2a2a',
  },
  light: {
    textPrimary: '#111111',
    bgPanel: '#ffffff',
    bgBase: '#f5f5f3',
    borderDefault: '#cccccc',
  },
}

const CSS_VAR_MAP: Record<keyof ThemeCustom, string> = {
  textPrimary: '--text-primary',
  bgPanel: '--bg-panel',
  bgBase: '--bg-base',
  borderDefault: '--border-default',
}

function canUseDom(): boolean {
  return typeof document !== 'undefined'
}

export function applyThemeMode(theme: ThemeMode): void {
  if (!canUseDom()) {
    return
  }

  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function applyThemeCustom(themeCustom: ThemeCustom | null): void {
  if (!canUseDom()) {
    return
  }

  const root = document.documentElement
  ;(Object.entries(CSS_VAR_MAP) as Array<[keyof ThemeCustom, string]>).forEach(([key, cssVar]) => {
    const value = themeCustom?.[key]
    if (value) {
      root.style.setProperty(cssVar, value)
      return
    }

    root.style.removeProperty(cssVar)
  })
}

export function resetThemeCustomization(): void {
  applyThemeCustom(null)
}

// Alias for compatibility
export const applyThemeCustomization = applyThemeCustom
