export type AppTab = 'tree' | 'raw' | 'table' | 'diff' | 'markdown' | 'notes' | 'mindmap' | 'viewer'

export interface Note {
  id: string
  title: string
  content: string
  color: string
  createdAt: number
  updatedAt: number
}
export type ThemeMode = 'dark' | 'light'
export type SearchMode = 'text' | 'regex' | 'filter' | 'jsonpath'
export type DiffLineType = 'unchanged' | 'added' | 'removed' | 'changed' | 'empty'

export interface ThemeCustom {
  textPrimary: string
  bgPanel: string
  bgBase: string
  borderDefault: string
}

export type EditorWordWrapMode = 'off' | 'wordWrapColumn'

export interface EditorSettings {
  fontSize: number
  wordWrapEnabled: boolean
  wordWrapMode: EditorWordWrapMode
  showTypeBadges: boolean
}


export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export interface RepairStep {
  label: string
  count: number
}

export interface RepairReport {
  repaired: boolean
  fixes: number
  steps: RepairStep[]
}

export interface ParseErrorInfo {
  message: string
  line: number
  column: number
  position: number
}

export interface DocumentStats {
  bytes: number
  nodeCount: number
  depth: number
}

export interface ParsedJsonDocument {
  text: string
  prettyText: string
  data: JsonValue | null
  error: ParseErrorInfo | null
  repair: RepairReport
  stats: DocumentStats
}

export interface SearchResult {
  id: string
  path: string
  label: string
  preview: string
  type: 'key' | 'value' | 'item'
  value?: JsonValue
}

export interface FilterResult {
  items: JsonValue[]
  indexes: number[]
}

export interface DiffLine {
  lineNumber: number
  path: string
  text: string
  type: DiffLineType
}

export interface DiffBlock {
  id: string
  path: string
  type: Exclude<DiffLineType, 'unchanged' | 'empty'>
  leftStart: number
  leftEnd: number
  rightStart: number
  rightEnd: number
}

export interface DiffSummary {
  added: number
  removed: number
  changed: number
}

export interface DiffBundle {
  left: DiffLine[]
  right: DiffLine[]
  gutterMarkers: DiffBlock[]
  summary: DiffSummary
  jsonPatch: Array<Record<string, unknown>>
  markdownReport: string
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

export interface HistoryEntry {
  id: string
  timestamp: number
  preview: string
  size: number
  sourceText: string
}

export type TooltipMode = 'shortcuts' | 'name' | 'both'

export interface UserSettings {
  tooltipMode: TooltipMode
  theme: ThemeMode
  sidebarOpen: boolean
}

export interface ActivityEntry {
  id: string
  timestamp: number
  label: string
  detail?: string
}

export interface ConverterResult {
  title: string
  language: string
  mimeType: string
  extension: string
  output: string
}

export interface CommandAction {
  id: string
  label: string
  group: string
  keywords: string[]
  shortcut?: string
  run: () => void
}
