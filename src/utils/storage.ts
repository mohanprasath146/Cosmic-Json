import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { AppTab, ThemeCustom, ThemeMode } from '../types'

export const STORAGE_KEYS = {
  lastInput: 'jv-last-input',
  tab: 'jv-tab',
  sidebar: 'jv-sidebar',
  theme: 'jv-theme',
  themeCustom: 'jv-theme-custom',
  legacyThemeCustom: 'theme-custom',
  markdownText: 'jv-markdown',
  diffLeftText: 'jv-diff-left',
  diffRightText: 'jv-diff-right',
  diffLeftLabel: 'jv-diff-left-label',
  diffRightLabel: 'jv-diff-right-label',
  notes: 'jv-notes',
} as const

export interface StoredAppState {
  sourceText: string
  activeTab: AppTab
  sidebarOpen: boolean
  theme: ThemeMode
  themeCustom: ThemeCustom | null
}

export interface PersistedSnapshot {
  theme: ThemeMode
  sourceText: string
  markdownText: string
  diffLeftText: string
  diffRightText: string
  diffLeftLabel: string
  diffRightLabel: string
}

interface StorageDefaults {
  sourceText: string
  activeTab: AppTab
  sidebarOpen: boolean
  theme: ThemeMode
}

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function parseTab(value: string | null, fallback: AppTab): AppTab {
  return value === 'tree' || value === 'raw' || value === 'table' || value === 'diff' || value === 'markdown' || value === 'notes' ? value : fallback
}

function parseTheme(value: string | null, fallback: ThemeMode): ThemeMode {
  return value === 'light' || value === 'dark' ? value : fallback
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return fallback
}

function parseThemeCustom(value: string | null): ThemeCustom | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as Partial<ThemeCustom>
    if (
      typeof parsed.textPrimary === 'string' &&
      typeof parsed.bgPanel === 'string' &&
      typeof parsed.bgBase === 'string' &&
      typeof parsed.borderDefault === 'string'
    ) {
      return {
        textPrimary: parsed.textPrimary,
        bgPanel: parsed.bgPanel,
        bgBase: parsed.bgBase,
        borderDefault: parsed.borderDefault,
      }
    }
  } catch {
    return null
  }

  return null
}

export function loadStoredAppState(defaults: StorageDefaults): StoredAppState {
  if (!canUseBrowserStorage()) {
    return {
      ...defaults,
      themeCustom: null,
    }
  }

  const url = new URL(window.location.href)
  const sharedPayload = url.searchParams.get('data')
  const sharedInput = sharedPayload ? decompressFromEncodedURIComponent(sharedPayload) ?? defaults.sourceText : null

  return {
    sourceText: sharedInput ?? localStorage.getItem(STORAGE_KEYS.lastInput) ?? defaults.sourceText,
    activeTab: parseTab(url.searchParams.get('tab') ?? localStorage.getItem(STORAGE_KEYS.tab), defaults.activeTab),
    sidebarOpen: parseBoolean(localStorage.getItem(STORAGE_KEYS.sidebar), defaults.sidebarOpen),
    theme: parseTheme(localStorage.getItem(STORAGE_KEYS.theme), defaults.theme),
    themeCustom: parseThemeCustom(localStorage.getItem(STORAGE_KEYS.themeCustom) ?? localStorage.getItem(STORAGE_KEYS.legacyThemeCustom)),
  }
}

export function persistLastInput(value: string): void {
  if (!canUseBrowserStorage()) {
    return
  }
  localStorage.setItem(STORAGE_KEYS.lastInput, value)
}

export function persistActiveTab(value: AppTab): void {
  if (!canUseBrowserStorage()) {
    return
  }
  localStorage.setItem(STORAGE_KEYS.tab, value)
}

export function persistSidebarState(value: boolean): void {
  if (!canUseBrowserStorage()) {
    return
  }
  localStorage.setItem(STORAGE_KEYS.sidebar, String(value))
}

export function persistTheme(value: ThemeMode): void {
  if (!canUseBrowserStorage()) {
    return
  }
  localStorage.setItem(STORAGE_KEYS.theme, value)
}

export function persistThemeCustom(value: ThemeCustom | null): void {
  if (!canUseBrowserStorage()) {
    return
  }

  if (!value) {
    localStorage.removeItem(STORAGE_KEYS.themeCustom)
    localStorage.removeItem(STORAGE_KEYS.legacyThemeCustom)
    return
  }

  const serialized = JSON.stringify(value)
  localStorage.setItem(STORAGE_KEYS.themeCustom, serialized)
  localStorage.setItem(STORAGE_KEYS.legacyThemeCustom, serialized)
}

export function buildShareUrl(sourceText: string, activeTab: AppTab): string {
  if (!canUseBrowserStorage()) {
    return ''
  }

  const url = new URL(window.location.href)
  url.searchParams.set('data', compressToEncodedURIComponent(sourceText))
  url.searchParams.set('tab', activeTab)
  return url.toString()
}

// Aliases for compatibility with App.tsx
export const saveLastJsonInput = persistLastInput
export const loadLastJsonInput = (defaultValue: string): string => {
  if (!canUseBrowserStorage()) return defaultValue
  return localStorage.getItem(STORAGE_KEYS.lastInput) ?? defaultValue
}
export const saveActiveTab = persistActiveTab
export const loadActiveTab = (defaultValue: AppTab): AppTab => {
  if (!canUseBrowserStorage()) return defaultValue
  return parseTab(localStorage.getItem(STORAGE_KEYS.tab), defaultValue)
}
export const saveSidebarOpen = persistSidebarState
export const loadSidebarOpen = (defaultValue: boolean = true): boolean => {
  if (!canUseBrowserStorage()) return defaultValue
  return parseBoolean(localStorage.getItem(STORAGE_KEYS.sidebar), defaultValue)
}
export const saveTheme = persistTheme
export const loadTheme = (defaultValue: ThemeMode): ThemeMode => {
  if (!canUseBrowserStorage()) return defaultValue
  return parseTheme(localStorage.getItem(STORAGE_KEYS.theme), defaultValue)
}
export const saveThemeCustom = persistThemeCustom
export const loadThemeCustom = (): ThemeCustom | null => {
  if (!canUseBrowserStorage()) return null
  return parseThemeCustom(localStorage.getItem(STORAGE_KEYS.themeCustom) ?? localStorage.getItem(STORAGE_KEYS.legacyThemeCustom))
}

export async function loadSnapshot(): Promise<PersistedSnapshot | null> {
  if (!canUseBrowserStorage()) return null
  
  const markdownText = localStorage.getItem(STORAGE_KEYS.markdownText) ?? ''
  const diffLeftText = localStorage.getItem(STORAGE_KEYS.diffLeftText) ?? ''
  const diffRightText = localStorage.getItem(STORAGE_KEYS.diffRightText) ?? ''
  const diffLeftLabel = localStorage.getItem(STORAGE_KEYS.diffLeftLabel) ?? 'Original'
  const diffRightLabel = localStorage.getItem(STORAGE_KEYS.diffRightLabel) ?? 'Modified'
  
  return {
    theme: loadTheme('dark'),
    sourceText: loadLastJsonInput(''),
    markdownText,
    diffLeftText,
    diffRightText,
    diffLeftLabel,
    diffRightLabel,
  }
}

export async function saveSnapshot(snapshot: PersistedSnapshot): Promise<void> {
  if (!canUseBrowserStorage()) return
  
  localStorage.setItem(STORAGE_KEYS.markdownText, snapshot.markdownText)
  localStorage.setItem(STORAGE_KEYS.diffLeftText, snapshot.diffLeftText)
  localStorage.setItem(STORAGE_KEYS.diffRightText, snapshot.diffRightText)
  localStorage.setItem(STORAGE_KEYS.diffLeftLabel, snapshot.diffLeftLabel)
  localStorage.setItem(STORAGE_KEYS.diffRightLabel, snapshot.diffRightLabel)
}

export function loadNotes(): import('../types').Note[] {
  if (!canUseBrowserStorage()) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.notes)
    if (!raw) return []
    const parsed = JSON.parse(raw) as import('../types').Note[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveNotes(notes: import('../types').Note[]): void {
  if (!canUseBrowserStorage()) return
  try {
    localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes))
  } catch {
    // ignore
  }
}
