import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { loader } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { List } from 'react-window'
const RichMarkdownViewer = lazy(() => import('./components/RichMarkdownViewer'))
const MindmapInteractive = lazy(() => import('./components/MindmapInteractive'))
import { SAMPLE_JSON, SAMPLE_MARKDOWN } from './data/examples'
import { useSyncScroll } from './hooks/useSyncScroll'
import type {
  AppTab,
  DiffBlock,
  DiffBundle,
  EditorSettings,
  JsonValue,
  ParsedJsonDocument,
  PersistedSnapshot,
  SearchMode,
  SearchResult,
  ThemeMode,
  ThemeCustom,
} from './types'
import { downloadText } from './utils/download'
import { buildDiffBundle } from './utils/diff/DiffEngine'
import { ingestFile } from './utils/ingest'
import { parseJsonDocument } from './utils/jsonParser'
import { runFilter, runJsonPath, runSearch } from './utils/search'
import {
  loadSnapshot,
  saveSnapshot,
  saveActiveTab,
  loadActiveTab,
  saveTheme,
  loadTheme,
  saveThemeCustom,
  loadThemeCustom,
  saveSidebarOpen,
  loadSidebarOpen,
  saveLastJsonInput,
  loadLastJsonInput,
} from './utils/storage'
import { convertJson } from './utils/converters'
import { applyThemeCustomization, resetThemeCustomization } from './utils/theme'
import { Toaster, toast } from 'react-hot-toast'

const lastToastTime: Record<string, number> = {}
function debouncedToast(msg: string, type: 'success' | 'error' = 'success') {
  const now = Date.now()
  if (now - (lastToastTime[msg] || 0) < 1000) {
    return
  }
  lastToastTime[msg] = now
  if (type === 'success') toast.success(msg)
  else toast.error(msg)
}

function TooltipText({
  label,
  shortcut,
  settings,
}: {
  label: string
  shortcut?: string
  settings: TooltipSettings
}) {
  if (!settings.showNames && (!shortcut || !settings.showShortcuts)) {
    return null
  }

  return (
    <span className="tooltip-line">
      {settings.showNames ? <span>{label}</span> : null}
      {shortcut && settings.showShortcuts ? <kbd>{shortcut}</kbd> : null}
    </span>
  )
}

function SplitPaneToggle({
  side,
  activeSide,
  onToggle,
  label,
  settings,
}: {
  side: SplitPaneSide
  activeSide: SplitPaneSide | null
  onToggle: (side: SplitPaneSide) => void
  label: string
  settings: TooltipSettings
}) {
  const isExpanded = activeSide === side
  const title = isExpanded ? `Restore ${label}` : `Expand ${label}`

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <IconButton
          icon={isExpanded ? Minimize2 : Maximize2}
          size={14}
          onClick={() => onToggle(side)}
          active={isExpanded}
          title={title}
        />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip-content" side="bottom">
          <TooltipText label={title} settings={settings} />
          <Tooltip.Arrow className="tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

import {
  Network,
  Code2,
  Table2,
  Diff as GitDiff,
  FileText,
  Clipboard,
  AlignLeft,
  Minimize2,
  Minimize2 as Minify2,
  Copy,
  Download,
  Maximize2,
  Upload,
  Layers,
  Layers as LayersOff,
  Settings,
  Sun,
  Moon,
  X,
  RefreshCw,
  ChevronRight,
  Loader2,
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  Search,
  PenLine,
  Eye,
  ZoomIn,
  ZoomOut,
  Menu,
  PlusCircle,
  MinusCircle,
  Check,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { IconButton } from './components/IconButton'
import { TreeNode } from './components/TreeNode'

const MonacoEditor = lazy(() => import('./components/LazyMonacoEditor'))
const NotesTab = lazy(() => import('./components/NotesTab'))

const TABS: Array<{ id: AppTab; label: string; icon: React.ElementType }> = [
  { id: 'tree', label: 'Tree', icon: Network },
  { id: 'raw', label: 'Raw', icon: Code2 },
  { id: 'table', label: 'Table', icon: Table2 },
  { id: 'mindmap', label: 'Mindmap', icon: Network },
  { id: 'notes', label: 'Notes', icon: Clipboard },
  { id: 'diff', label: 'Diff', icon: GitDiff },
  { id: 'markdown', label: 'Markdown', icon: FileText },
]

const SEARCH_MODES: Array<{ id: SearchMode; label: string; icon: string }> = [
  { id: 'text', label: 'Text', icon: 'Aa' },
  { id: 'regex', label: 'Regex', icon: '.*' },
  { id: 'filter', label: 'Filter', icon: 'fx' },
  { id: 'jsonpath', label: 'JSONPath', icon: '$' },
]

const DIFF_RIGHT_SAMPLE = `{
  "product": "Nothing Phone (Viewer Edition)",
  "version": 4,
  "active": true,
  "updatedAt": "2026-06-08T12:00:00.000Z",
  "website": "https://nothing.tech",
  "heroImage": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=300&q=80",
  "palette": {
    "primary": "#ffffff",
    "secondary": "#0a0a0a",
    "accent": "#8cff00"
  },
  "team": [
    {
      "id": 1,
      "name": "Akira",
      "country": "India",
      "age": 29,
      "email": "akira@example.com",
      "token": "secret-demo-token"
    },
    {
      "id": 2,
      "name": "Lina",
      "country": "Japan",
      "age": 35,
      "email": "lina@example.com",
      "website": "https://example.com/profile/lina"
    },
    {
      "id": 4,
      "name": "Mia",
      "country": "United Kingdom",
      "age": 26,
      "email": "mia@example.com"
    }
  ],
  "metrics": {
    "latencyMs": 25.1,
    "errors": 1,
    "regions": ["eu-west", "ap-south", "us-east", "me-central"]
  }
}`

type MonacoEditorInstance = editor.IStandaloneCodeEditor
type SplitPaneSide = 'left' | 'right'
type TooltipSettings = {
  showNames: boolean
  showShortcuts: boolean
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [delay, value])

  return debounced
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getTypeLabel(value: JsonValue): string {
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return 'array'
  }
  return typeof value
}

function copyText(text: string, toastMessage?: string): void {
  void navigator.clipboard.writeText(text).then(() => {
    if (toastMessage) debouncedToast(toastMessage)
  })
}

function collectExpandablePaths(value: JsonValue, path = '$', depth = 0, maxDepth = Number.POSITIVE_INFINITY, acc = new Set<string>()) {
  if (depth <= maxDepth && value && typeof value === 'object') {
    acc.add(path)
  }
  if (depth >= maxDepth) {
    return acc
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectExpandablePaths(entry, `${path}[${index}]`, depth + 1, maxDepth, acc))
    return acc
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => collectExpandablePaths(entry, `${path}.${key}`, depth + 1, maxDepth, acc))
  }
  return acc
}

function buildTreeRows(data: JsonValue | null, expandedPaths: Set<string>) {
  if (!data) {
    return []
  }

  const rows: Array<{
    path: string
    keyLabel: string
    depth: number
    value: JsonValue
    expanded: boolean
    expandable: boolean
    childCount: number
    typeLabel: string
    lineNumber: number
  }> = []

  let lineNumber = 1
  const walk = (value: JsonValue, path: string, keyLabel: string, depth: number) => {
    const expandable = !!value && typeof value === 'object'
    const childCount = Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 0
    const expanded = expandedPaths.has(path)

    rows.push({
      path,
      keyLabel,
      depth,
      value,
      expanded,
      expandable,
      childCount,
      typeLabel: getTypeLabel(value),
      lineNumber,
    })
    lineNumber++

    if (!expandable || !expanded) {
      return
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${path}[${index}]`, `[${index}]`, depth + 1))
      return
    }

    Object.entries(value).forEach(([key, entry]) => walk(entry, `${path}.${key}`, key, depth + 1))
  }

  walk(data, '$', 'root', 0)
  return rows
}

function buildMatchedPathSet(results: SearchResult[]): Set<string> {
  return new Set(results.flatMap((entry) => [entry.path, entry.path.split('.').slice(0, -1).join('.') || '$']))
}

function getAncestorPaths(path: string): string[] {
  const parts: string[] = []
  let current = ''
  const regex = /(\$|[^.\[\]]+|\[\d+\])/g
  const tokens = path.match(regex) || []
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (tok === '$') {
      current = '$'
    } else if (tok.startsWith('[')) {
      current += tok
    } else {
      current += (current ? '.' : '') + tok
    }
    parts.push(current)
  }
  return parts
}

function SearchBar({
  mode,
  onModeChange,
  query,
  onQueryChange,
  resultIndex,
  resultCount,
  onStep,
  error,
  onCopyMatches,
}: {
  mode: SearchMode
  onModeChange: (mode: SearchMode) => void
  query: string
  onQueryChange: (value: string) => void
  resultIndex: number
  resultCount: number
  onStep: (delta: number) => void
  error: string | null
  onCopyMatches?: () => void
}) {
  return (
    <section className="search-bar panel">
      <div className="search-mode-group" role="group" aria-label="Search mode">
        {SEARCH_MODES.map((item) => (
          <Tooltip.Root key={item.id}>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                className={clsx('search-mode-button', mode === item.id && 'is-active')}
                onClick={() => onModeChange(item.id)}
                aria-label={item.label}
                aria-pressed={mode === item.id}
              >
                <span className="search-mode-icon">{item.icon}</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip-content" side="bottom">
                {item.label}
                <Tooltip.Arrow className="tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </div>
      <div className="search-input-wrap">
        <Search className="search-input-icon" size={16} />
        <input
          className="app-input search-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onStep(event.shiftKey ? -1 : 1)
            }
          }}
          placeholder={
            mode === 'filter'
              ? 'age > 25'
              : mode === 'jsonpath'
                ? '$.team[*].name'
                : mode === 'regex'
                  ? 'latency|errors'
                  : 'Find values, keys, and paths'
          }
        />
        <div className="search-meta">
          <span className="search-count">{resultCount === 0 ? '0/0' : `${resultIndex + 1}/${resultCount}`}</span>
          {error ? <span className="search-error">{error}</span> : null}
          <div className="search-nav" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconButton
              icon={ArrowUp}
              size={16}
              onClick={() => onStep(-1)}
              disabled={resultIndex === 0}
              title="Previous match"
            />
            <IconButton
              icon={ArrowDown}
              size={16}
              onClick={() => onStep(1)}
              disabled={resultIndex >= resultCount - 1}
              title="Next match"
            />
            {query.trim() && onCopyMatches && (
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <IconButton
                    icon={Copy}
                    size={16}
                    onClick={onCopyMatches}
                    title="Copy matches only"
                  />
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content className="tooltip-content" side="bottom">
                    Copy matches only
                    <Tooltip.Arrow className="tooltip-arrow" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function TreeTab({
  document: parsedDoc,
  rows,
  expandedPaths,
  onToggle,
  matchedPaths,
  currentResult,
  searchResults = [],
  currentSearchIndex = 0,
  onSelectResultIndex,
  searchQuery = '',
  showTypeBadges = true,
}: {
  document: ParsedJsonDocument
  rows: ReturnType<typeof buildTreeRows>
  expandedPaths: Set<string>
  onToggle: (path: string) => void
  matchedPaths: Set<string>
  currentResult?: { path: string } | null
  searchResults?: SearchResult[]
  currentSearchIndex?: number
  onSelectResultIndex?: (index: number) => void
  searchQuery?: string
  showTypeBadges?: boolean
}) {
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<any>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hideUnmatched, setHideUnmatched] = useState(false)

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return
    if (!window.document.fullscreenElement) {
      void containerRef.current.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      void window.document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!window.document.fullscreenElement)
    }
    window.document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => window.document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const visibleRows = useMemo(() => {
    if (!hideUnmatched || !searchQuery.trim() || searchResults.length === 0) {
      return rows
    }
    return rows.filter((row) => matchedPaths.has(row.path))
  }, [rows, hideUnmatched, searchQuery, searchResults, matchedPaths])

  useEffect(() => {
    if (currentResult && listRef.current) {
      const index = visibleRows.findIndex((row) => row.path === currentResult.path)
      if (index !== -1) {
        const timer = setTimeout(() => {
          listRef.current?.scrollToItem(index, 'center')
        }, 50)
        return () => clearTimeout(timer)
      }
    }
  }, [currentResult, visibleRows])

  return (
    <section ref={containerRef} className="content-panel panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <div className="panel-actions">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <IconButton
                icon={isFullscreen ? Minimize2 : Maximize2}
                onClick={handleToggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip-content" side="bottom">
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                <Tooltip.Arrow className="tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0, height: 'calc(100% - 40px)', width: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
          {parsedDoc.data ? (
            // @ts-ignore - react-window List typing mismatch with our row props
            <List
              // @ts-ignore - allow passing ref for imperative API
              ref={listRef}
              className="virtual-list"
              defaultHeight={520}
              rowCount={visibleRows.length}
              rowHeight={36}
              rowProps={{
                rows: visibleRows,
                expandedPaths,
                revealedSecrets,
                matchedPaths,
                currentResult,
                onToggle,
                onRevealSecret: (path: string) =>
                  setRevealedSecrets((current) => {
                    const next = new Set(current)
                    next.add(path)
                    return next
                  }),
              }}
              rowComponent={({ index, style, rows: items, revealedSecrets: secrets, matchedPaths: matches, currentResult: current, onToggle: toggle, onRevealSecret }) => {
                if (!items || !items[index]) return null
                const row = items[index] as (typeof items)[0]
                return (
                  <TreeNode
                    style={style}
                    row={{ ...row, lineNumber: row.lineNumber, expanded: expandedPaths.has(row.path) }}
                    showLineNumber={false}
                    revealedSecrets={secrets as Set<string>}
                    onRevealSecret={onRevealSecret as (path: string) => void}
                    onToggle={toggle}
                    isMatched={matches.has(row.path)}
                    isCurrent={!!current && current.path === row.path}
                    hasActiveSearch={searchQuery.trim().length > 0}
                    showTypeBadges={showTypeBadges}
                  />
                )
              }}
              style={{ height: '100%' }}
            />
          ) : (
            <div className="empty-state">Upload or paste JSON to start exploring.</div>
          )}
        </div>

        {searchQuery.trim() && searchResults.length > 0 && (
          <div
            className="search-results-sidebar"
            style={{
              width: 320,
              borderLeft: '1px solid var(--border-default)',
              background: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              flexShrink: 0
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                Matches ({searchResults.length})
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      className={clsx('chip-button', hideUnmatched && 'is-active')}
                      onClick={() => setHideUnmatched(!hideUnmatched)}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      {hideUnmatched ? 'Show All' : 'Hide Others'}
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="tooltip-content" side="bottom">
                      Hide all unmatched tree nodes
                      <Tooltip.Arrow className="tooltip-arrow" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {searchResults.map((res, index) => {
                const isSelected = index === currentSearchIndex
                return (
                  <div
                    key={`${res.path}-${index}`}
                    onClick={() => {
                      if (onSelectResultIndex) {
                        onSelectResultIndex(index)
                      }
                    }}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      background: isSelected ? 'var(--bg-hover)' : 'transparent',
                      border: isSelected ? '1px solid var(--border-focus)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}
                      title={res.path}
                    >
                      {res.path}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        marginTop: 4,
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {res.preview}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function RawTab({
  value,
  onChange,
  editable,
  theme: _theme,
  error,
  onMount,
  editorSettings,
}: {
  value: string
  onChange: (value: string) => void
  editable: boolean
  theme: ThemeMode
  error: ParsedJsonDocument['error']
  editorSettings: EditorSettings
  onMount: (editorInstance: MonacoEditorInstance, monacoInstance: typeof import('monaco-editor')) => void
}) {

  const editorRef = useRef<MonacoEditorInstance | null>(null)
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return
    if (!window.document.fullscreenElement) {
      void containerRef.current.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      void window.document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!window.document.fullscreenElement)
    }
    window.document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => window.document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) {
      return
    }
    const model = editorRef.current.getModel()
    if (!model) {
      return
    }
    if (!error) {
      monacoRef.current.editor.setModelMarkers(model, 'json-viewer', [])
      return
    }
    monacoRef.current.editor.setModelMarkers(model, 'json-viewer', [
      {
        startLineNumber: error.line,
        startColumn: error.column,
        endLineNumber: error.line,
        endColumn: error.column + 1,
        severity: monacoRef.current.MarkerSeverity.Error,
        message: error.message,
      },
    ])
  }, [error])

  // Synchronize value from props only if it differs from editor content (preventing typing jitter/jumps)
  useEffect(() => {
    if (editorRef.current) {
      const currentValue = editorRef.current.getValue() ?? ''
      const normalizedProp = (value || '').replace(/\r\n/g, '\n')
      const normalizedCurrent = currentValue.replace(/\r\n/g, '\n')
      if (normalizedProp !== normalizedCurrent) {
        const selection = editorRef.current.getSelection()
        const scrollPosition = editorRef.current.getScrollTop()
        editorRef.current.setValue(value)
        if (selection) {
          editorRef.current.setSelection(selection)
        }
        editorRef.current.setScrollTop(scrollPosition)
      }
    }
  }, [value])

  return (
    <section ref={containerRef} className="content-panel panel">
      <div className="panel-header">
        <div className="panel-actions">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <IconButton
                icon={isFullscreen ? Minimize2 : Maximize2}
                onClick={handleToggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip-content" side="bottom">
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                <Tooltip.Arrow className="tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </div>
      <Suspense fallback={<div className="empty-state flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
        {editable ? (
          <MonacoEditor
            height="100%"
            defaultValue={value}
            language="json"
            theme="jv-theme"

            onChange={(next) => onChange(next ?? '')}
            onMount={(editorInstance, monacoInstance) => {
              editorRef.current = editorInstance
              monacoRef.current = monacoInstance
              onMount(editorInstance, monacoInstance)
            }}
            options={{
              readOnly: false,
              lineNumbers: 'on',
              minimap: { enabled: true },
              folding: true,
              scrollBeyondLastLine: false,
              fontFamily: 'DM Mono, monospace',
              fontSize: editorSettings.fontSize,
              lineHeight: 22,
              smoothScrolling: true,
              wordWrap: editorSettings.wordWrapEnabled ? 'on' : 'off',
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
              },
              // when wrap is enabled, vertical scrolling is disabled by hiding the vertical scrollbar
            }}



          />
        ) : (
          <div className="raw-preview" style={{ height: '100%', overflow: 'auto', padding: 12 }}>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{(() => {
              try {
                return JSON.stringify(JSON.parse(value), null, 2)
              } catch {
                return value
              }
            })()}</pre>
          </div>
        )}
      </Suspense>
    </section>
  )
}

function TableCellFormatter({ value }: { value: JsonValue }) {
  if (value === null || value === undefined) {
    return <span className="type-muted">—</span>
  }

  if (typeof value === 'boolean') {
    return (
      <span className={clsx('status-pill', value ? 'is-valid' : 'is-error')} style={{ fontSize: '11px', padding: '2px 8px' }}>
        {value ? '✓ True' : '✗ False'}
      </span>
    )
  }

  if (typeof value === 'number') {
    return <span className="type-number font-mono">{value}</span>
  }

  if (Array.isArray(value)) {
    if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {value.map((v, idx) => (
            <span key={idx} className="status-pill" style={{ fontSize: '11px', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
              {String(v)}
            </span>
          ))}
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {value.map((item, idx) => (
          <div key={idx} className="nested-table-object" style={{ padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '0.5px solid var(--border-default)', fontSize: '11px' }}>
            {typeof item === 'object' && item !== null ? (
              Object.entries(item).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: '6px', overflowWrap: 'anywhere' }}>
                  <span className="type-muted" style={{ fontWeight: '500' }}>{k}:</span>
                  <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                </div>
              ))
            ) : (
              String(item)
            )}
          </div>
        ))}
      </div>
    )
  }

  if (typeof value === 'object') {
    return (
      <div className="nested-table-object" style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '0.5px solid var(--border-default)', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {Object.entries(value).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: '6px', overflowWrap: 'anywhere' }}>
            <span className="type-muted" style={{ fontWeight: '600' }}>{k}:</span>
            <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
          </div>
        ))}
      </div>
    )
  }

  const str = String(value)
  if (str.startsWith('http://') || str.startsWith('https://')) {
    return (
      <a href={str} target="_blank" rel="noreferrer" className="inline-link" style={{ color: 'var(--text-secondary)', textDecoration: 'underline', margin: 0 }}>
        {str}
      </a>
    )
  }

  return <span>{str}</span>
}

function TableTab({
  data,
  filterIndexes,
}: {
  data: JsonValue | null
  filterIndexes: number[]
}) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [activeCell, setActiveCell] = useState<{ rowIdx: number; column: string; value: any } | null>(null)

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return
    if (!window.document.fullscreenElement) {
      void containerRef.current.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      void window.document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!window.document.fullscreenElement)
    }
    window.document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => window.document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const source = useMemo(() => {
    if (!Array.isArray(data) || data.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      return null
    }
    const visible = filterIndexes.length > 0 ? filterIndexes.map((index) => data[index]) : data
    return visible as Array<Record<string, JsonValue>>
  }, [data, filterIndexes])

  const columns = useMemo(() => {
    if (!source) {
      return []
    }
    return Array.from(
      new Set(source.slice(0, 20).flatMap((item) => Object.keys(item))),
    )
  }, [source])

  const rows = useMemo(() => {
    if (!source) {
      return []
    }
    if (!sortKey || !sortDirection) {
      return source
    }
    return [...source].sort((left, right) => {
      const a = left[sortKey]
      const b = right[sortKey]
      if (a === b) {
        return 0
      }
      return (a ?? '') > (b ?? '') ? (sortDirection === 'asc' ? 1 : -1) : sortDirection === 'asc' ? -1 : 1
    })
  }, [source, sortDirection, sortKey])

  return (
    <section ref={containerRef} className="content-panel panel table-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <div className="panel-actions">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <IconButton
                icon={isFullscreen ? Minimize2 : Maximize2}
                onClick={handleToggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip-content" side="bottom">
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                <Tooltip.Arrow className="tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </div>
      <div style={{ height: '100%', display: 'flex', minHeight: 0, overflow: 'hidden', flex: 1 }}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, overflowX: 'auto', overflowY: 'hidden', flex: 1 }}>
          {!source ? (
            <div className="empty-state">Table view works with array-of-object JSON only.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, width: 'max-content' }}>
              <div
                className="table-header"
                style={{
                  display: 'grid',
                  gridTemplateColumns: columns.map(col => `${columnWidths[col] || 140}px`).join(' '),
                  flexShrink: 0
                }}
              >
                {columns.map((column) => (
                  <div key={column} style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
                    <button
                      key={column}
                      type="button"
                      className="table-header-cell"
                      onClick={() => {
                        if (sortKey !== column) {
                          setSortKey(column)
                          setSortDirection('asc')
                          return
                        }
                        if (sortDirection === 'asc') {
                          setSortDirection('desc')
                          return
                        }
                        setSortKey(null)
                        setSortDirection(null)
                      }}
                      style={{ width: '100%', textAlign: 'left', display: 'block', paddingRight: 16 }}
                    >
                      {column}
                      {sortKey === column ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}
                    </button>
                    <div
                      className="column-resize-handle"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const startX = e.clientX
                        const startWidth = columnWidths[column] || 140
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const nextWidth = Math.max(80, startWidth + (moveEvent.clientX - startX))
                          setColumnWidths((prev) => ({ ...prev, [column]: nextWidth }))
                        }
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove)
                          document.removeEventListener('mouseup', handleMouseUp)
                        }
                        document.addEventListener('mousemove', handleMouseMove)
                        document.addEventListener('mouseup', handleMouseUp)
                      }}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '6px',
                        cursor: 'col-resize',
                        zIndex: 10,
                        background: 'transparent',
                        borderRight: '1.5px solid var(--border-default)',
                        transition: 'border-color 150ms ease',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderRightColor = 'var(--border-focus)'
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderRightColor = 'var(--border-default)'
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="table-body" style={{ overflowY: 'auto', overflowX: 'hidden', flex: 1, minHeight: 0 }}>
                {rows.map((row, rIndex) => (
                  <div key={rIndex} className="table-row" style={{ display: 'block' }}>
                    <div
                      className="table-grid"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: columns.map(col => `${columnWidths[col] || 140}px`).join(' ')
                      }}
                    >
                      {columns.map((column) => {
                        const value = (row as Record<string, JsonValue>)[column]
                        const raw = value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value)
                        const isCurrentActive = activeCell?.rowIdx === rIndex && activeCell?.column === column
                        return (
                          <div
                            key={`${rIndex}-${column}`}
                            className={clsx('table-cell', typeof value === 'number' && 'is-number')}
                            onClick={() => setActiveCell({ rowIdx: rIndex, column, value })}
                            title={raw}
                            style={{
                              whiteSpace: 'normal',
                              overflowWrap: 'anywhere',
                              cursor: 'pointer',
                              border: isCurrentActive ? '1px solid var(--border-focus)' : 'none',
                              background: isCurrentActive ? 'rgba(255,255,255,0.06)' : undefined
                            }}
                          >
                            <TableCellFormatter value={value} />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {activeCell && (
          <div
            className="table-detail-sidebar"
            style={{
              width: 320,
              borderLeft: '1px solid var(--border-default)',
              background: 'var(--bg-card)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              height: '100%',
              overflowY: 'auto',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>CELL VIEW DETAILS</span>
              <IconButton icon={X} onClick={() => setActiveCell(null)} title="Close panel" />
            </div>

            <div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Column Key</span>
              <span className="font-mono" style={{ fontSize: 13, fontWeight: 600 }}>{activeCell.column}</span>
            </div>

            <div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Row Number</span>
              <span style={{ fontSize: 13 }}>Row #{activeCell.rowIdx + 1}</span>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Cell Value</span>
                <button
                  type="button"
                  className="chip-button"
                  onClick={() => {
                    const text = typeof activeCell.value === 'object' && activeCell.value !== null
                      ? JSON.stringify(activeCell.value, null, 2)
                      : String(activeCell.value)
                    copyText(text, 'Copied cell value')
                  }}
                  style={{ padding: '2px 8px', fontSize: 11 }}
                >
                  Copy Value
                </button>
              </div>
              <pre style={{ flex: 1, margin: 0, background: 'rgba(0,0,0,0.18)', padding: 10, borderRadius: 8, overflow: 'auto', border: '1px solid var(--border-default)', fontSize: 12, fontFamily: 'DM Mono, monospace', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {typeof activeCell.value === 'object' && activeCell.value !== null
                  ? JSON.stringify(activeCell.value, null, 2)
                  : String(activeCell.value)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function DiffConnections({
  blocks,
  activeId,
  scrollTop,
  onJump,
}: {
  blocks: DiffBlock[]
  activeId: string | null
  scrollTop: number
  onJump: (block: DiffBlock) => void
}) {
  const svgHeight = Math.max(1000, blocks.length * 22 + 200)
  return (
    <svg className="diff-gutter-svg" viewBox={`0 0 40 ${svgHeight}`} preserveAspectRatio="none">
      {blocks.map((block) => {
        const leftY = block.leftStart * 22 - scrollTop
        const rightY = block.rightStart * 22 - scrollTop
        const pathData = `M2,${leftY} C14,${leftY} 26,${rightY} 38,${rightY}`
        return (
          <g key={block.id} onClick={() => onJump(block)} className={clsx('diff-connector-group', activeId === block.id && 'is-active')}>
            <path d={pathData ?? undefined} className={`diff-connector is-${block.type}`} />
            <circle cx="20" cy={(leftY + rightY) / 2} r="3" className={`diff-dot is-${block.type}`} />
          </g>
        )
      })}
    </svg>
  )
}

function DiffTreeMode({
  bundle,
}: {
  bundle: DiffBundle
}) {
  return (
    <div className="diff-tree-mode">
      <div className="diff-tree-pane">
        {bundle.left.map((line) => (
          <div key={`left-${line.lineNumber}`} className={`diff-tree-line is-${line.type}`}>
            <span className="diff-tree-number">{line.lineNumber}</span>
            <span>{line.text}</span>
          </div>
        ))}
      </div>
      <div className="diff-tree-pane">
        {bundle.right.map((line) => (
          <div key={`right-${line.lineNumber}`} className={`diff-tree-line is-${line.type}`}>
            <span className="diff-tree-number">{line.lineNumber}</span>
            <span>{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MarkdownTab({
  theme,
  markdownText,
  onChange,
  tooltipSettings,
  editorSettings,
}: {
  theme: ThemeMode
  markdownText: string
  onChange: (value: string) => void
  tooltipSettings: TooltipSettings
  editorSettings: EditorSettings
}) {

  const editorRef = useRef<MonacoEditorInstance | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [expandedPane, setExpandedPane] = useState<SplitPaneSide | null>(null)
  const handleTogglePane = (side: SplitPaneSide) => {
    setExpandedPane((current) => (current === side ? null : side))
  }

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return
    if (!window.document.fullscreenElement) {
      void containerRef.current.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      void window.document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!window.document.fullscreenElement)
    }
    window.document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => window.document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  return (
    <section ref={containerRef} className="content-panel panel markdown-grid">
      <div className="panel-header">
        <div className="panel-actions">
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <IconButton
                icon={isFullscreen ? Minimize2 : Maximize2}
                onClick={handleToggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip-content" side="bottom">
                <TooltipText
                  label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  shortcut="F"
                  settings={tooltipSettings}
                />
                <Tooltip.Arrow className="tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </div>
      <div className={clsx('split-panes', expandedPane && `is-${expandedPane}-expanded`)} style={{ height: '100%' }}>
        <div
          className={clsx('pane split-pane', expandedPane === 'right' && 'is-hidden')}
        >
          <div className="split-pane-toolbar">
            <span>Editor</span>
            <SplitPaneToggle
              side="left"
              activeSide={expandedPane}
              onToggle={handleTogglePane}
              label="editor"
              settings={tooltipSettings}
            />
          </div>
          <Suspense fallback={<div className="empty-state flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <MonacoEditor
              height="100%"
              language="markdown"
              value={markdownText}
              theme="jv-theme"

              onChange={(next) => onChange(next ?? '')}
              onMount={(editorInstance) => {
                editorRef.current = editorInstance
              }}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontFamily: 'DM Mono, monospace',
                fontSize: editorSettings.fontSize,
                lineHeight: 22,
                smoothScrolling: true,
                wordWrap: editorSettings.wordWrapEnabled ? 'on' : 'off',
                scrollbar: {
                  vertical: editorSettings.wordWrapEnabled ? 'hidden' : 'auto',
                  horizontal: 'auto',
                },
              }}
            />
          </Suspense>

        </div>
        <div
          className={clsx('pane split-pane', expandedPane === 'left' && 'is-hidden')}
          style={{ height: '100%', overflow: 'hidden', minHeight: 0 }}
        >
          <div className="split-pane-toolbar">
            <span>Preview</span>
            <SplitPaneToggle
              side="right"
              activeSide={expandedPane}
              onToggle={handleTogglePane}
              label="preview"
              settings={tooltipSettings}
            />
          </div>
          <Suspense fallback={<div className="empty-state flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <RichMarkdownViewer markdown={markdownText} theme={theme} />
          </Suspense>
        </div>
      </div>
    </section>
  )
}

function SettingsDialog({
  themeCustom,
  setThemeCustom,
  tooltipSettings,
  setTooltipSettings,
  appName,
  setAppName,
  appLogo,
  setAppLogo,
  editorSettings,
  setEditorSettings,
  treeMatchKeyColor,
  setTreeMatchKeyColor,
  enabledTabs,
  setEnabledTabs,
}: {
  themeCustom: ThemeCustom
  setThemeCustom: (custom: ThemeCustom) => void
  tooltipSettings: TooltipSettings
  setTooltipSettings: (settings: TooltipSettings) => void
  appName: string
  setAppName: (s: string) => void
  appLogo: string
  setAppLogo: (s: string) => void
  editorSettings: EditorSettings
  setEditorSettings: (next: EditorSettings) => void
  treeMatchKeyColor: string
  setTreeMatchKeyColor: (color: string) => void
  enabledTabs: Record<AppTab, boolean>
  setEnabledTabs: (next: Record<AppTab, boolean>) => void
}) {
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'theme' | 'editor' | 'modules'>('general')
  const [localTheme, setLocalTheme] = useState(themeCustom)
  const [font, setFont] = useState(() => localStorage.getItem('jv-font') ?? "'Syne', system-ui, sans-serif")
  const [localAppName, setLocalAppName] = useState(appName)
  const [localAppLogo, setLocalAppLogo] = useState(appLogo)
  const [localTreeKeyColor, setLocalTreeKeyColor] = useState(treeMatchKeyColor)
  const [localEnabledTabs, setLocalEnabledTabs] = useState(enabledTabs)

  useEffect(() => {
    setLocalTheme(themeCustom)
    setLocalAppName(appName)
    setLocalAppLogo(appLogo)
    setLocalTreeKeyColor(treeMatchKeyColor)
    setLocalEnabledTabs(enabledTabs)
  }, [themeCustom, appName, appLogo, treeMatchKeyColor, enabledTabs])

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font', font)
  }, [font])

  const handleSave = () => {
    setThemeCustom(localTheme)
    saveThemeCustom(localTheme)
    applyThemeCustomization(localTheme)
    localStorage.setItem('jv-font', font)
    setAppName(localAppName)
    setAppLogo(localAppLogo)
    localStorage.setItem('jv-app-name', localAppName)
    localStorage.setItem('jv-app-logo', localAppLogo)

    setTreeMatchKeyColor(localTreeKeyColor)
    setEnabledTabs(localEnabledTabs)

    debouncedToast('Settings saved')
  }

  const handleReset = () => {
    const defaults = {
      textPrimary: '',
      bgPanel: '',
      bgBase: '',
      borderDefault: '',
    }
    setLocalTheme(defaults)
    setThemeCustom(defaults)
    saveThemeCustom(defaults)
    resetThemeCustomization()

    setLocalTreeKeyColor('#6abf6a')
    setTreeMatchKeyColor('#6abf6a')

    const defaultTabs = {
      tree: true,
      raw: true,
      table: true,
      mindmap: true,
      notes: true,
      diff: true,
      markdown: true,
      viewer: true
    } as Record<AppTab, boolean>
    setLocalEnabledTabs(defaultTabs)
    setEnabledTabs(defaultTabs)

    debouncedToast('Settings reset')
  }

  const toggleTab = (tabId: AppTab) => {
    const count = Object.values(localEnabledTabs).filter(Boolean).length
    if (localEnabledTabs[tabId] && count <= 1) {
      debouncedToast('At least one tab must remain enabled', 'error')
      return
    }
    setLocalEnabledTabs({
      ...localEnabledTabs,
      [tabId]: !localEnabledTabs[tabId],
    })
  }

  return (
    <Dialog.Portal>
      <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 40 }} />
      <Dialog.Content
        className="settings-modal"
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 50,
          background: 'var(--bg-panel)',
          border: '0.5px solid var(--border-default)',
          borderRadius: 16,
          padding: 0,
          width: '90vw',
          maxWidth: 760,
          height: '75vh',
          maxHeight: 680,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          color: 'var(--text-primary)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Dialog.Title style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Preferences</Dialog.Title>
          <Dialog.Close asChild>
            <IconButton icon={X} title="Close" />
          </Dialog.Close>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ width: 220, borderRight: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.12)', padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              type="button"
              className={clsx('settings-nav-button', activeSettingsTab === 'general' && 'is-active')}
              onClick={() => setActiveSettingsTab('general')}
            >
              General
            </button>
            <button
              type="button"
              className={clsx('settings-nav-button', activeSettingsTab === 'theme' && 'is-active')}
              onClick={() => setActiveSettingsTab('theme')}
            >
              Theme Customization
            </button>
            <button
              type="button"
              className={clsx('settings-nav-button', activeSettingsTab === 'editor' && 'is-active')}
              onClick={() => setActiveSettingsTab('editor')}
            >
              Editor Configuration
            </button>
            <button
              type="button"
              className={clsx('settings-nav-button', activeSettingsTab === 'modules' && 'is-active')}
              onClick={() => setActiveSettingsTab('modules')}
            >
              Available Modules
            </button>
          </div>

          <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {activeSettingsTab === 'general' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>App Branding Title</label>
                  <input className="app-input" value={localAppName} onChange={(e) => setLocalAppName(e.target.value)} style={{ width: '100%' }} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Logo Image URL</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input className="app-input" value={localAppLogo} onChange={(e) => setLocalAppLogo(e.target.value)} placeholder="https://..." style={{ flex: 1 }} />
                    <input type="file" accept="image/*" id="logoUpload" style={{ display: 'none' }} onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = () => {
                        const result = reader.result as string
                        setLocalAppLogo(result)
                      }
                      reader.readAsDataURL(file)
                    }} />
                    <button type="button" className="chip-button" onClick={() => document.getElementById('logoUpload')?.click()}>Upload</button>
                    <div style={{ width: 44, height: 36, borderRadius: 6, overflow: 'hidden', border: '0.5px solid var(--border-default)', background: 'var(--bg-card)', flexShrink: 0 }}>
                      {localAppLogo ? <img src={localAppLogo} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 10 }}>No</div>}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>System Interface Font</label>
                  <select className="app-input" value={font} onChange={(e) => setFont(e.target.value)} style={{ width: '100%' }}>
                    <option value="'Syne', system-ui, sans-serif">Syne (UI Default)</option>
                    <option value="'Inter', system-ui, sans-serif">Inter</option>
                    <option value="'Outfit', system-ui, sans-serif">Outfit</option>
                    <option value="'Poppins', system-ui, sans-serif">Poppins</option>
                    <option value="'Space Grotesk', system-ui, sans-serif">Space Grotesk</option>
                    <option value="'Roboto', system-ui, sans-serif">Roboto</option>
                    <option value="'Playfair Display', serif">Playfair Display (Serif)</option>
                    <option value="'DM Mono', monospace">DM Mono (Mono)</option>
                    <option value="'Fira Code', monospace">Fira Code (Mono)</option>
                    <option value="'JetBrains Mono', monospace">JetBrains Mono (Mono)</option>
                    <option value="'Source Code Pro', monospace">Source Code Pro (Mono)</option>
                  </select>
                </div>

                <div className="settings-section">
                  <div className="settings-section-title" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Tooltips Visuals</div>
                  <label className="settings-toggle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <span>Show name labels</span>
                    <input
                      type="checkbox"
                      checked={tooltipSettings.showNames}
                      onChange={(event) => setTooltipSettings({ ...tooltipSettings, showNames: event.target.checked })}
                    />
                  </label>
                  <label className="settings-toggle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <span>Show key shortcut hints</span>
                    <input
                      type="checkbox"
                      checked={tooltipSettings.showShortcuts}
                      onChange={(event) => setTooltipSettings({ ...tooltipSettings, showShortcuts: event.target.checked })}
                    />
                  </label>
                </div>
              </>
            )}

            {activeSettingsTab === 'theme' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Primary Text Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="color"
                      value={localTheme.textPrimary || '#000000'}
                      onChange={(e) => setLocalTheme({ ...localTheme, textPrimary: e.target.value })}
                      style={{ width: 44, height: 38, borderRadius: 6, cursor: 'pointer', border: 'none' }}
                    />
                    <input
                      type="text"
                      value={localTheme.textPrimary}
                      onChange={(e) => setLocalTheme({ ...localTheme, textPrimary: e.target.value })}
                      placeholder="Default CSS Variable Accent"
                      className="app-input"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Panel Container Background</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="color"
                      value={localTheme.bgPanel || '#000000'}
                      onChange={(e) => setLocalTheme({ ...localTheme, bgPanel: e.target.value })}
                      style={{ width: 44, height: 38, borderRadius: 6, cursor: 'pointer', border: 'none' }}
                    />
                    <input
                      type="text"
                      value={localTheme.bgPanel}
                      onChange={(e) => setLocalTheme({ ...localTheme, bgPanel: e.target.value })}
                      placeholder="Default dark tint"
                      className="app-input"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Outer Base Background</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="color"
                      value={localTheme.bgBase || '#000000'}
                      onChange={(e) => setLocalTheme({ ...localTheme, bgBase: e.target.value })}
                      style={{ width: 44, height: 38, borderRadius: 6, cursor: 'pointer', border: 'none' }}
                    />
                    <input
                      type="text"
                      value={localTheme.bgBase}
                      onChange={(e) => setLocalTheme({ ...localTheme, bgBase: e.target.value })}
                      placeholder="Default base background"
                      className="app-input"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Default Borders & Dividers</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="color"
                      value={localTheme.borderDefault || '#000000'}
                      onChange={(e) => setLocalTheme({ ...localTheme, borderDefault: e.target.value })}
                      style={{ width: 44, height: 38, borderRadius: 6, cursor: 'pointer', border: 'none' }}
                    />
                    <input
                      type="text"
                      value={localTheme.borderDefault}
                      onChange={(e) => setLocalTheme({ ...localTheme, borderDefault: e.target.value })}
                      placeholder="Default borders"
                      className="app-input"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Tree Mode Key Highlight Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="color"
                      value={localTreeKeyColor}
                      onChange={(e) => setLocalTreeKeyColor(e.target.value)}
                      style={{ width: 44, height: 38, borderRadius: 6, cursor: 'pointer', border: 'none' }}
                    />
                    <input
                      type="text"
                      value={localTreeKeyColor}
                      onChange={(e) => setLocalTreeKeyColor(e.target.value)}
                      placeholder="#6abf6a"
                      className="app-input"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              </>
            )}

            {activeSettingsTab === 'editor' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Monaco Editor Font Size</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      className="app-input"
                      type="number"
                      min={8}
                      max={40}
                      step={1}
                      value={editorSettings.fontSize}
                      onChange={(e) => {
                        const next = Number(e.target.value)
                        setEditorSettings({
                          ...editorSettings,
                          fontSize: Number.isFinite(next) && next > 0 ? next : editorSettings.fontSize,
                        })
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>px</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Monaco Editor Word Wrapping</label>
                  <label className="settings-toggle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <span>Enable line wrapping</span>
                    <input
                      type="checkbox"
                      checked={editorSettings.wordWrapEnabled}
                      onChange={(e) => {
                        setEditorSettings({
                          ...editorSettings,
                          wordWrapEnabled: e.target.checked,
                          wordWrapMode: e.target.checked ? 'wordWrapColumn' : 'off',
                        })
                      }}
                    />
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Tree View Type Badges</label>
                  <label className="settings-toggle-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <span>Show type labels (string, array, number…)</span>
                    <input
                      type="checkbox"
                      checked={editorSettings.showTypeBadges}
                      onChange={(e) => {
                        setEditorSettings({
                          ...editorSettings,
                          showTypeBadges: e.target.checked,
                        })
                      }}
                    />
                  </label>
                </div>
              </>
            )}

            {activeSettingsTab === 'modules' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Toggle individual views on/off in the header workspace selector:</div>

                  {TABS.map((tab) => (
                    <div
                      key={tab.id}
                      className="settings-module-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--border-default)',
                        background: 'rgba(255,255,255,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <tab.icon size={16} style={{ color: 'var(--tree-match-key-color)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{tab.label} View</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={!!localEnabledTabs[tab.id]}
                        onChange={() => toggleTab(tab.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.1)' }}>
          <button
            type="button"
            className="chip-button"
            onClick={handleReset}
            style={{ minWidth: 100 }}
          >
            Reset
          </button>
          <button
            type="button"
            className="chip-button is-active"
            onClick={handleSave}
            style={{ minWidth: 100 }}
          >
            Save Options
          </button>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  )
}

function App() {
  // --- Initialize state from localStorage ---
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme('dark'))
  const [activeTab, setActiveTab] = useState<AppTab>(() => loadActiveTab('tree'))
  const [sourceText, setSourceText] = useState<string>(() => loadLastJsonInput(SAMPLE_JSON))
  const [rawDraft, setRawDraft] = useState<string>(() => loadLastJsonInput(SAMPLE_JSON))
  const [sidebarOpen] = useState<boolean>(() => loadSidebarOpen(true))
  const [themeCustom, setThemeCustom] = useState<ThemeCustom>(() => loadThemeCustom() ?? {
    textPrimary: '',
    bgPanel: '',
    bgBase: '',
    borderDefault: '',
  })

  // --- Editor settings (font size + word wrap) ---
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(() => {
    const fontSizeRaw = localStorage.getItem('jv-font-size')
    const fontSize = fontSizeRaw ? Number(fontSizeRaw) : 13
    const wordWrapEnabledRaw = localStorage.getItem('jv-word-wrap-enabled')
    const wordWrapEnabled = wordWrapEnabledRaw ? wordWrapEnabledRaw === 'true' : false
    const wordWrapModeRaw = localStorage.getItem('jv-word-wrap-mode')
    const wordWrapMode = (wordWrapModeRaw === 'wordWrapColumn' ? 'wordWrapColumn' : 'off') as EditorSettings['wordWrapMode']
    const showTypeBadgesRaw = localStorage.getItem('jv-show-type-badges')
    const showTypeBadges = showTypeBadgesRaw ? showTypeBadgesRaw === 'true' : true

    return {
      fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 13,
      wordWrapEnabled,
      wordWrapMode,
      showTypeBadges,
    }
  })

  useEffect(() => {
    localStorage.setItem('jv-font-size', String(editorSettings.fontSize))
    localStorage.setItem('jv-word-wrap-enabled', String(editorSettings.wordWrapEnabled))
    localStorage.setItem('jv-word-wrap-mode', String(editorSettings.wordWrapMode))
    localStorage.setItem('jv-show-type-badges', String(editorSettings.showTypeBadges))
  }, [editorSettings])

  // --- State ---
  const [rawMode, setRawMode] = useState<'edit' | 'preview'>('edit')

  const rawMonacoRef = useRef<typeof import('monaco-editor') | null>(null)
  const [diffLeftEditor, setDiffLeftEditor] = useState<MonacoEditorInstance | null>(null)
  const [diffRightEditor, setDiffRightEditor] = useState<MonacoEditorInstance | null>(null)
  const [rawEditor, setRawEditor] = useState<MonacoEditorInstance | null>(null)
  const [searchMode, setSearchMode] = useState<SearchMode>('text')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIndex, setSearchIndex] = useState(0)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['$']))
  const [expandDepth, setExpandDepth] = useState(3)
  const [markdownText, setMarkdownText] = useState(SAMPLE_MARKDOWN)
  const [diffLeftText, setDiffLeftText] = useState(SAMPLE_JSON)
  const [diffRightText, setDiffRightText] = useState(DIFF_RIGHT_SAMPLE)
  const [diffLeftLabel, setDiffLeftLabel] = useState('Original')
  const [diffRightLabel, setDiffRightLabel] = useState('Modified')
  const [diffTreeMode, setDiffTreeMode] = useState(false)
  const [activeDiffBlockId, setActiveDiffBlockId] = useState<string | null>(null)
  const [diffScrollTop, setDiffScrollTop] = useState(0)
  const [tooltipSettings, setTooltipSettings] = useState<TooltipSettings>({
    showNames: true,
    showShortcuts: true,
  })

  // --- New state: diff pane resize, settings open ---
  const [expandedDiffPane, setExpandedDiffPane] = useState<SplitPaneSide | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [appName, setAppName] = useState<string>(() => localStorage.getItem('jv-app-name') ?? 'JV')
  const [appLogo, setAppLogo] = useState<string>(() => localStorage.getItem('jv-app-logo') ?? '')

  // --- Tree Mode match key color --
  const [treeMatchKeyColor, setTreeMatchKeyColor] = useState<string>(() => localStorage.getItem('jv-tree-match-key-color') || '#6abf6a')

  useEffect(() => {
    localStorage.setItem('jv-tree-match-key-color', treeMatchKeyColor)
    document.documentElement.style.setProperty('--tree-match-key-color', treeMatchKeyColor)
  }, [treeMatchKeyColor])

  // --- Dynamic Tab management toggles ---
  const [enabledTabs, setEnabledTabs] = useState<Record<AppTab, boolean>>(() => {
    try {
      const stored = localStorage.getItem('jv-enabled-tabs')
      if (stored) return JSON.parse(stored)
    } catch { }
    return {
      tree: true,
      raw: true,
      table: true,
      mindmap: true,
      notes: true,
      diff: true,
      markdown: true,
      viewer: true
    } as Record<AppTab, boolean>
  })

  useEffect(() => {
    localStorage.setItem('jv-enabled-tabs', JSON.stringify(enabledTabs))
    if (!enabledTabs[activeTab]) {
      const firstEnabled = (Object.keys(enabledTabs) as AppTab[]).find((tab) => enabledTabs[tab])
      if (firstEnabled) {
        setActiveTab(firstEnabled)
      }
    }
  }, [enabledTabs, activeTab])

  // --- Document Tabs Slots system ---
  interface DocumentTab {
    id: string
    name: string
    sourceText: string
    rawDraft: string
    activeTab: AppTab
    expandedPaths: string[]
  }

  const [docTabs, setDocTabs] = useState<DocumentTab[]>(() => {
    try {
      const stored = localStorage.getItem('jv-doc-tabs')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch { }
    return [
      {
        id: 'default',
        name: 'Document 1',
        sourceText: loadLastJsonInput(SAMPLE_JSON),
        rawDraft: loadLastJsonInput(SAMPLE_JSON),
        activeTab: 'tree',
        expandedPaths: ['$'],
      }
    ]
  })

  const [activeDocTabId, setActiveDocTabId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('jv-active-doc-tab-id')
      if (stored) return stored
    } catch { }
    return 'default'
  })

  const isSyncingDoc = useRef(false)

  // Save current active document state back to docTabs when it changes
  useEffect(() => {
    if (isSyncingDoc.current) return
    setDocTabs((current) =>
      current.map((t) =>
        t.id === activeDocTabId
          ? {
            ...t,
            sourceText,
            rawDraft,
            activeTab,
            expandedPaths: Array.from(expandedPaths),
          }
          : t
      )
    )
  }, [sourceText, rawDraft, activeTab, expandedPaths, activeDocTabId])

  useEffect(() => {
    localStorage.setItem('jv-doc-tabs', JSON.stringify(docTabs))
    localStorage.setItem('jv-active-doc-tab-id', activeDocTabId)
  }, [docTabs, activeDocTabId])

  const handleSelectDocTab = (tabId: string) => {
    const target = docTabs.find((t) => t.id === tabId)
    if (!target) return
    isSyncingDoc.current = true
    setActiveDocTabId(tabId)
    setSourceText(target.sourceText)
    setRawDraft(target.rawDraft)
    setActiveTab(target.activeTab)
    setExpandedPaths(new Set(target.expandedPaths || ['$']))
    setTimeout(() => {
      isSyncingDoc.current = false
    }, 100)
  }

  const handleCreateDocTab = () => {
    const newId = Math.random().toString(36).substring(2, 9)
    const newTab: DocumentTab = {
      id: newId,
      name: `Document ${docTabs.length + 1}`,
      sourceText: '{}',
      rawDraft: '{}',
      activeTab: 'raw',
      expandedPaths: ['$'],
    }
    isSyncingDoc.current = true
    setDocTabs((current) => [...current, newTab])
    setActiveDocTabId(newId)
    setSourceText('{}')
    setRawDraft('{}')
    setActiveTab('raw')
    setExpandedPaths(new Set(['$']))
    setTimeout(() => {
      isSyncingDoc.current = false
    }, 100)
  }

  const handleCloseDocTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (docTabs.length <= 1) {
      debouncedToast('At least one tab must remain open', 'error')
      return
    }
    const idx = docTabs.findIndex((t) => t.id === tabId)
    const nextTabs = docTabs.filter((t) => t.id !== tabId)
    isSyncingDoc.current = true
    setDocTabs(nextTabs)
    if (activeDocTabId === tabId) {
      const fallbackIdx = Math.max(0, idx - 1)
      const fallback = nextTabs[fallbackIdx]
      setActiveDocTabId(fallback.id)
      setSourceText(fallback.sourceText)
      setRawDraft(fallback.rawDraft)
      setActiveTab(fallback.activeTab)
      setExpandedPaths(new Set(fallback.expandedPaths || ['$']))
    }
    setTimeout(() => {
      isSyncingDoc.current = false
    }, 100)
  }

  const [renamingDocTabId, setRenamingDocTabId] = useState<string | null>(null)
  const [renamingDocTabValue, setRenamingDocTabValue] = useState('')

  const handleRenameDocTab = (tabId: string) => {
    const target = docTabs.find((t) => t.id === tabId)
    if (!target) return
    setRenamingDocTabId(tabId)
    setRenamingDocTabValue(target.name)
  }

  const commitRename = () => {
    if (renamingDocTabId && renamingDocTabValue.trim()) {
      setDocTabs((current) =>
        current.map((t) => (t.id === renamingDocTabId ? { ...t, name: renamingDocTabValue.trim() } : t))
      )
    }
    setRenamingDocTabId(null)
  }

  const cancelRename = () => {
    setRenamingDocTabId(null)
  }

  const [selectedMindNode, setSelectedMindNode] = useState<{ path: string; value: any } | null>(null)
  const [mindmapApi, setMindmapApi] = useState<any>(null)

  const uploadInputRef = useRef<HTMLInputElement>(null)
  const diffLeftUploadRef = useRef<HTMLInputElement>(null)
  const diffRightUploadRef = useRef<HTMLInputElement>(null)
  const rawEditorRef = useRef<MonacoEditorInstance | null>(null)
  const diffLeftEditorRef = useRef<MonacoEditorInstance | null>(null)
  const diffRightEditorRef = useRef<MonacoEditorInstance | null>(null)
  const diffMonacoRef = useRef<typeof import('monaco-editor') | null>(null)
  const diffLeftDecorations = useRef<string[]>([])
  const diffRightDecorations = useRef<string[]>([])
  const diffLeftInlineDecorations = useRef<string[]>([])
  const diffRightInlineDecorations = useRef<string[]>([])
  const diffContainerRef = useRef<HTMLDivElement>(null)
  const [isDiffFullscreen, setIsDiffFullscreen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const handleToggleDiffPane = (side: SplitPaneSide) => {
    setExpandedDiffPane((current) => (current === side ? null : side))
  }

  // --- Apply theme customization ---
  useEffect(() => {
    applyThemeCustomization(themeCustom)
  }, [themeCustom])

  // Apply saved font on startup
  useEffect(() => {
    const f = localStorage.getItem('jv-font')
    if (f) document.documentElement.style.setProperty('--app-font', f)
  }, [])

  // Apply saved editor settings (font size + word wrap)
  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font-size', `${editorSettings.fontSize}px`)
    document.documentElement.dataset.wordWrap = editorSettings.wordWrapEnabled ? 'on' : 'off'
  }, [editorSettings.fontSize, editorSettings.wordWrapEnabled])


  // Apply app meta (title and favicon) when settings change
  useEffect(() => {
    try {
      document.title = appName || 'JV'
    } catch { }
    try {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      if (appLogo) {
        link.href = appLogo
      } else {
        link.href = ''
      }
    } catch { }
  }, [appName, appLogo])

  // Update Monaco editor theme to respect app theme / custom colors
  useEffect(() => {
    loader.init().then((monaco) => {
      try {
        const styles = getComputedStyle(document.documentElement)
        const rawBg = String(styles.getPropertyValue('--bg-panel') || (theme === 'dark' ? '#111' : '#ffffff')).trim()
        const rawFg = String(styles.getPropertyValue('--text-primary') || (theme === 'dark' ? '#f0f0f0' : '#111111')).trim()

        const normalizeColor = (val: string, fallback: string) => {
          if (!val) return fallback
          const v = val.trim()
          // Expand 3-digit hex to 6-digit
          const shortHex = /^#([0-9a-fA-F]{3})$/
          const longHex = /^#([0-9a-fA-F]{6})$/
          const rgb = /^rgb\(/i
          const rgba = /^rgba\(/i
          const hsl = /^hsl\(/i
          if (shortHex.test(v)) {
            const m = v.match(shortHex)![1]
            return `#${m[0]}${m[0]}${m[1]}${m[1]}${m[2]}${m[2]}`
          }
          if (longHex.test(v) || rgb.test(v) || rgba.test(v) || hsl.test(v)) {
            return v
          }
          // If value is a CSS variable reference like var(--foo), try to resolve
          if (v.startsWith('var(')) {
            try {
              const name = v.replace(/var\(|\)/g, '').trim()
              const resolved = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
              return normalizeColor(resolved || fallback, fallback)
            } catch {
              return fallback
            }
          }
          return fallback
        }

        const bg = normalizeColor(rawBg, theme === 'dark' ? '#111111' : '#ffffff')
        const fg = normalizeColor(rawFg, theme === 'dark' ? '#f0f0f0' : '#111111')

        monaco.editor.defineTheme('jv-theme', {
          base: theme === 'dark' ? 'vs-dark' : 'vs',
          inherit: true,
          rules: [
            { token: '', foreground: fg.replace('#', '') }
          ],
          colors: {
            'editor.background': bg,
            'editor.foreground': fg,
            'editor.lineHighlightBackground': theme === 'dark' ? '#1c1c1c' : '#f5f5f3',
            'editorCursor.foreground': fg,
            'editor.selectionBackground': theme === 'dark' ? '#3d3d3d' : '#add6ff',
          },
        })
        monaco.editor.setTheme('jv-theme')
      } catch (err) {
        console.error('Monaco theme error:', err)
      }
    }).catch(console.error)
  }, [theme, themeCustom])

  // --- Persist to localStorage ---
  useEffect(() => {
    saveTheme(theme)
    saveActiveTab(activeTab)
    saveSidebarOpen(sidebarOpen)
    saveLastJsonInput(sourceText)
  }, [theme, activeTab, sidebarOpen, sourceText])

  // --- Load from IndexedDB snapshot (for diff/markdown) ---
  useEffect(() => {
    void loadSnapshot().then((snapshot: PersistedSnapshot | null) => {
      if (!snapshot) {
        return
      }
      setMarkdownText(snapshot.markdownText)
      setDiffLeftText(snapshot.diffLeftText)
      setDiffRightText(snapshot.diffRightText)
      setDiffLeftLabel(snapshot.diffLeftLabel)
      setDiffRightLabel(snapshot.diffRightLabel)
    })
  }, [])

  useEffect(() => {
    const snapshot: PersistedSnapshot = {
      theme,
      sourceText,
      markdownText,
      diffLeftText,
      diffRightText,
      diffLeftLabel,
      diffRightLabel,
    }
    void saveSnapshot(snapshot)
  }, [diffLeftLabel, diffLeftText, diffRightLabel, diffRightText, markdownText, sourceText, theme])

  // Ensure raw text is applied to tree on init
  useEffect(() => {
    setSourceText(rawDraft)
  }, [])

  // --- Update document.documentElement.dataset.theme ---
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // --- Sync sourceText and rawDraft ---
  useEffect(() => {
    setRawDraft(sourceText)
  }, [sourceText])

  // --- Debounced values ---
  const debouncedRawDraft = useDebouncedValue(rawDraft, rawMode === 'edit' ? 200 : 0)
  const debouncedDiffLeft = useDebouncedValue(diffLeftText, 300)
  const debouncedDiffRight = useDebouncedValue(diffRightText, 300)

  useEffect(() => {
    if (rawMode === 'edit') {
      setSourceText(debouncedRawDraft)
    }
  }, [debouncedRawDraft, rawMode])

  // --- Parsed docs ---
  const parsedDocument = useMemo(() => parseJsonDocument(sourceText), [sourceText])
  const diffLeftDocument = useMemo(() => parseJsonDocument(debouncedDiffLeft), [debouncedDiffLeft])
  const diffRightDocument = useMemo(() => parseJsonDocument(debouncedDiffRight), [debouncedDiffRight])

  // --- Show parse error toast ---
  useEffect(() => {
    if (parsedDocument.error) {
      debouncedToast(`Invalid JSON · line ${parsedDocument.error.line}`, 'error')
    }
  }, [parsedDocument.error?.line])

  // --- Show repair toast ---
  useEffect(() => {
    if (parsedDocument.repair.repaired) {
      debouncedToast(`Repaired · ${parsedDocument.repair.fixes} fixes`, 'success')
    }
  }, [parsedDocument.repair.repaired, parsedDocument.repair.fixes])

  const treeRows = useMemo(() => buildTreeRows(parsedDocument.data, expandedPaths), [expandedPaths, parsedDocument.data])

  // Highlight search matches in raw editor
  useEffect(() => {
    const editor = rawEditor
    const monaco = rawMonacoRef.current
    if (!editor || !monaco) return

    // clear previous decorations stored on editor
    let decorations: string[] = []
    try {
      if (!searchQuery.trim() || searchMode === 'filter' || searchMode === 'jsonpath') {
        decorations = editor.deltaDecorations([], [])
        return
      }

      const model = editor.getModel()
      if (!model) return

      const isRegex = searchMode === 'regex'
      const matches = model.findMatches(searchQuery, true, isRegex, false, null, true)
      const newDecorations = matches.map((m) => ({
        range: m.range,
        options: { className: 'monaco-search-highlight', isWholeLine: false },
      }))
      decorations = editor.deltaDecorations([], newDecorations)

      // reveal current search index
      if (matches.length > 0 && searchIndex >= 0 && searchIndex < matches.length) {
        editor.revealRangeInCenter(matches[searchIndex].range)
      }
    } catch {
      // ignore
    }

    return () => {
      try {
        editor.deltaDecorations(decorations, [])
      } catch { }
    }
  }, [searchQuery, searchMode, rawEditor, rawMonacoRef.current, searchIndex])

  const searchState = useMemo<{
    results: SearchResult[]
    error: string | null
    filter: ReturnType<typeof runFilter>['result']
  }>(() => {
    if (searchMode === 'text' || searchMode === 'regex') {
      const result = runSearch(parsedDocument.data, searchQuery, searchMode)
      return { ...result, filter: null }
    }
    if (searchMode === 'filter') {
      const result = runFilter(parsedDocument.data, searchQuery)
      return {
        results: result.result
          ? result.result.items.map((item, index) => ({
            id: `filter-${index}`,
            path: `$[${result.result?.indexes[index] ?? index}]`,
            label: `Item ${result.result?.indexes[index] ?? index}`,
            preview: JSON.stringify(item).slice(0, 160),
            type: 'item' as const,
            value: item,
          }))
          : [],
        error: result.error,
        filter: result.result,
      }
    }
    const jsonPath = runJsonPath(parsedDocument.data, searchQuery)
    return { ...jsonPath, filter: null }
  }, [parsedDocument.data, searchMode, searchQuery])

  // --- Show "no matches" toast when query changes and no results ---
  useEffect(() => {
    // No toasts for no matches — just keep state for nav
    if (!searchQuery.trim()) return
  }, [searchQuery, searchState.results.length, searchState.error])

  useEffect(() => {
    setSearchIndex(0)
  }, [searchMode, searchQuery])

  // Auto-expand search matching paths when search results change or active index updates
  useEffect(() => {
    if (searchQuery.trim() && searchState.results.length > 0) {
      setExpandedPaths((prev) => {
        const next = new Set(prev)
        searchState.results.forEach((res) => {
          getAncestorPaths(res.path).forEach((p) => next.add(p))
        })
        const currentResult = searchState.results[searchIndex]
        if (currentResult) {
          getAncestorPaths(currentResult.path).forEach((p) => next.add(p))
        }
        return next
      })
    }
  }, [searchState.results, searchQuery, searchIndex])

  const copyFilteredMatches = () => {
    if (!searchQuery.trim() || searchState.results.length === 0) {
      debouncedToast('No matches to copy', 'error')
      return
    }

    let payload: any = []
    if (searchMode === 'filter' && searchState.filter) {
      payload = searchState.filter.items
    } else {
      payload = searchState.results.map((r) => {
        return r.value !== undefined ? r.value : r.preview
      })
    }

    try {
      const text = JSON.stringify(payload, null, 2)
      void navigator.clipboard.writeText(text).then(() => {
        debouncedToast('Copied matching/filtered items')
      })
    } catch {
      debouncedToast('Failed to copy', 'error')
    }
  }

  const matchedPaths = useMemo(() => buildMatchedPathSet(searchState.results), [searchState.results])

  // Global keyboard shortcuts (moved from MarkdownTab to App to access app state)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      // Ctrl+E toggle raw edit/preview
      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setRawMode((cur) => (cur === 'edit' ? 'preview' : 'edit'))
        setActiveTab('raw')
        return
      }
      // Ctrl+F format
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        try {
          const formatted = JSON.stringify(JSON.parse(rawDraft), null, 2)
          setSourceText(formatted)
          setRawDraft(formatted)
          debouncedToast('Formatted')
        } catch {
          debouncedToast('Invalid JSON', 'error')
        }
        return
      }
      // Ctrl+L load sample
      if (mod && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setSourceText(SAMPLE_JSON)
        setRawDraft(SAMPLE_JSON)
        setExpandedPaths(new Set(['$']))
        setActiveTab('raw')
        return
      }
      // F3 / Shift+F3 search nav
      if (e.key === 'F3') {
        e.preventDefault()
        if (searchState.results.length === 0) return
        const delta = e.shiftKey ? -1 : 1
        setSearchIndex((current) => (current + delta + searchState.results.length) % searchState.results.length)
      }
      // Ctrl+T toggle theme
      if (mod && e.key.toLowerCase() === 't') {
        e.preventDefault()
        setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
      }
      // Ctrl+P open paste dialog
      if (mod && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPasteOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [rawDraft, searchState.results.length, searchState.results, debouncedRawDraft])

  const diffBundle = useMemo(
    () =>
      diffLeftDocument.data && diffRightDocument.data
        ? buildDiffBundle(diffLeftDocument.data, diffRightDocument.data)
        : null,
    [diffLeftDocument.data, diffRightDocument.data],
  )

  // Fixed: Pass the current editor instances, not the refs
  useSyncScroll(diffLeftEditor, diffRightEditor)

  useEffect(() => {
    const leftEditor = diffLeftEditorRef.current
    const rightEditor = diffRightEditorRef.current
    if (!leftEditor || !rightEditor) {
      return
    }

    const disposables = [
      leftEditor.onDidScrollChange(() => setDiffScrollTop(leftEditor.getScrollTop())),
      rightEditor.onDidScrollChange(() => setDiffScrollTop(rightEditor.getScrollTop())),
    ]

    return () => {
      disposables.forEach((entry) => entry.dispose())
    }
  }, [diffLeftEditorRef.current, diffRightEditorRef.current])

  // intraline highlights for changed lines (simple prefix/suffix diff)
  useEffect(() => {
    if (!diffBundle) return
    const leftEditor = diffLeftEditorRef.current
    const rightEditor = diffRightEditorRef.current
    const monaco = diffMonacoRef.current
    if (!leftEditor || !rightEditor || !monaco) return

    try {
      // clear previous inline decorations
      diffLeftInlineDecorations.current = leftEditor.deltaDecorations(diffLeftInlineDecorations.current, [])
      diffRightInlineDecorations.current = rightEditor.deltaDecorations(diffRightInlineDecorations.current, [])

      const leftLinesByNumber = new Map<number, string>()
      diffBundle.left.forEach((line) => leftLinesByNumber.set(line.lineNumber, line.text))
      const rightLinesByNumber = new Map<number, string>()
      diffBundle.right.forEach((line) => rightLinesByNumber.set(line.lineNumber, line.text))

      const leftInlineDecs: any[] = []
      const rightInlineDecs: any[] = []

      diffBundle.gutterMarkers.forEach((block) => {
        if (block.type !== 'changed') return
        const lStart = block.leftStart
        const rStart = block.rightStart
        const lText = leftLinesByNumber.get(lStart) ?? ''
        const rText = rightLinesByNumber.get(rStart) ?? ''
        // compute common prefix/suffix
        let prefix = 0
        const minLen = Math.min(lText.length, rText.length)
        while (prefix < minLen && lText[prefix] === rText[prefix]) prefix++
        let suffix = 0
        while (suffix < minLen - prefix && lText[lText.length - 1 - suffix] === rText[rText.length - 1 - suffix]) suffix++

        const lDiffStart = Math.max(0, prefix)
        const lDiffEnd = Math.max(prefix, lText.length - suffix)
        const rDiffStart = Math.max(0, prefix)
        const rDiffEnd = Math.max(prefix, rText.length - suffix)

        if (lDiffEnd > lDiffStart) {
          leftInlineDecs.push({
            range: new monaco.Range(lStart, lDiffStart + 1, lStart, lDiffEnd + 1),
            options: { inlineClassName: 'monaco-inline-changed-left' },
          })
        }
        if (rDiffEnd > rDiffStart) {
          rightInlineDecs.push({
            range: new monaco.Range(rStart, rDiffStart + 1, rStart, rDiffEnd + 1),
            options: { inlineClassName: 'monaco-inline-changed-right' },
          })
        }
      })

      diffLeftInlineDecorations.current = leftEditor.deltaDecorations(diffLeftInlineDecorations.current, leftInlineDecs)
      diffRightInlineDecorations.current = rightEditor.deltaDecorations(diffRightInlineDecorations.current, rightInlineDecs)
    } catch (e) {
      // ignore
    }
  }, [diffBundle])

  useEffect(() => {
    const leftEditor = diffLeftEditorRef.current
    const rightEditor = diffRightEditorRef.current
    if (!leftEditor || !rightEditor || !diffBundle) {
      return
    }

    const monaco = diffMonacoRef.current
    if (!monaco) {
      return
    }

    diffLeftDecorations.current = leftEditor.deltaDecorations(
      diffLeftDecorations.current,
      diffBundle.left
        .filter((line) => line.type !== 'unchanged' && line.type !== 'empty')
        .map((line) => ({
          range: new monaco.Range(line.lineNumber, 1, line.lineNumber, 1),
          options: {
            isWholeLine: true,
            className: `monaco-line-${line.type}`,
            linesDecorationsClassName: `monaco-gutter-${line.type}`,
          },
        })),
    )

    diffRightDecorations.current = rightEditor.deltaDecorations(
      diffRightDecorations.current,
      diffBundle.right
        .filter((line) => line.type !== 'unchanged' && line.type !== 'empty')
        .map((line) => ({
          range: new monaco.Range(line.lineNumber, 1, line.lineNumber, 1),
          options: {
            isWholeLine: true,
            className: `monaco-line-${line.type}`,
            linesDecorationsClassName: `monaco-gutter-${line.type}`,
          },
        })),
    )
  }, [diffBundle, diffLeftText, diffRightText])

  // --- Handle paste ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text')
      if (text && (text.includes('{') || text.includes('['))) {
        try {
          JSON.parse(text)
          setSourceText(text)
          setRawDraft(text)
          toast.success('JSON pasted')
        } catch {
          // do nothing
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  // --- Diff fullscreen ---
  const handleToggleDiffFullscreen = () => {
    if (!diffContainerRef.current) return
    if (!window.document.fullscreenElement) {
      void diffContainerRef.current.requestFullscreen().then(() => setIsDiffFullscreen(true))
    } else {
      void window.document.exitFullscreen().then(() => setIsDiffFullscreen(false))
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsDiffFullscreen(!!window.document.fullscreenElement)
    }
    window.document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => window.document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // --- Handlers ---
  const handleUpload = async (file: File) => {
    const text = await ingestFile(file)
    setSourceText(text)
    setRawDraft(text)
    setExpandedPaths(new Set(['$']))
    debouncedToast(`Loaded ${file.name}`)
  }

  const handleDiffUpload = async (side: 'left' | 'right', file: File) => {
    const text = await ingestFile(file)
    if (side === 'left') {
      setDiffLeftText(text)
    } else {
      setDiffRightText(text)
    }
    debouncedToast(`Loaded ${file.name}`)
  }

  return (
    <Tooltip.Provider delayDuration={400}>
      <div className="app-shell">
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '0.5px solid var(--border-default)',
              borderRadius: '8px',
              padding: '12px',
            },
            duration: 3000,
          }}
        />
        <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
          <input
            ref={uploadInputRef}
            type="file"
            hidden
            accept=".json,.txt,.yaml,.yml,.xml,.csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleUpload(file)
              }
              event.currentTarget.value = ''
            }}
          />
          <input
            ref={diffLeftUploadRef}
            type="file"
            hidden
            accept=".json,.txt,.yaml,.yml,.xml,.csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleDiffUpload('left', file)
              }
              event.currentTarget.value = ''
            }}
          />
          <input
            ref={diffRightUploadRef}
            type="file"
            hidden
            accept=".json,.txt,.yaml,.yml,.xml,.csv"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleDiffUpload('right', file)
              }
              event.currentTarget.value = ''
            }}
          />

          <header className="topbar panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
              {/* Logo and App Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                {appLogo ? (
                  <img src={appLogo} alt="logo" style={{ width: 36, height: 28, borderRadius: 8, objectFit: 'cover', border: '0.5px solid var(--border-default)' }} />
                ) : (
                  <div style={{ width: 36, height: 28, borderRadius: 8, background: 'linear-gradient(90deg,var(--added-text),var(--changed-text))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--bg-panel)' }}>{(appName || 'JV').slice(0, 2).toUpperCase()}</div>
                )}
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{appName}</div>
              </div>

              <div style={{ width: '1px', height: '20px', background: 'var(--border-default)' }} />

              {/* Tab Group */}
              <div className="tab-group">
                {TABS.filter((tab) => enabledTabs[tab.id]).map((tab) => (
                  <Tooltip.Root key={tab.id}>
                    <Tooltip.Trigger asChild>
                      <button
                        type="button"
                        className={clsx('tab-button', activeTab === tab.id && 'is-active')}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <tab.icon size={18} />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content className="tooltip-content" side="bottom">
                        {tab.label}
                        <Tooltip.Arrow className="tooltip-arrow" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {false && ['tree', 'raw', 'diff'].includes(activeTab) && (
                <>
                  <div className="actionbar-controls">
                    {activeTab === 'tree' && (
                      <>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <IconButton
                              icon={expandedPaths.size > 1 ? LayersOff : Layers}
                              onClick={() => {
                                if (expandedPaths.size > 1) {
                                  setExpandedPaths(new Set(['$']))
                                } else if (parsedDocument.data) {
                                  setExpandedPaths(collectExpandablePaths(parsedDocument.data))
                                }
                              }}
                              title={expandedPaths.size > 1 ? 'Collapse all' : 'Expand all'}
                            />
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="tooltip-content" side="bottom">
                              <TooltipText label={expandedPaths.size > 1 ? 'Collapse All' : 'Expand All'} settings={tooltipSettings} />
                              <Tooltip.Arrow className="tooltip-arrow" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>

                        <label className="slider-control">
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            {Array.from({ length: 8 }).map((_, i) => (
                              <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i < expandDepth ? 'var(--border-focus)' : 'transparent', border: '1px solid var(--border-default)' }} />
                            ))}
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={8}
                            value={expandDepth}
                            onChange={(event) => {
                              const depth = Number(event.target.value)
                              setExpandDepth(depth)
                              if (parsedDocument.data) {
                                setExpandedPaths(collectExpandablePaths(parsedDocument.data, '$', 0, depth))
                              }
                            }}
                          />
                        </label>
                      </>
                    )}

                    {activeTab === 'raw' && (
                      <>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <IconButton
                              icon={AlignLeft}
                              onClick={() => {
                                try {
                                  const formatted = JSON.stringify(JSON.parse(rawDraft), null, 2)
                                  setSourceText(formatted)
                                  setRawDraft(formatted)
                                  debouncedToast('Formatted')
                                } catch {
                                  setSourceText(parsedDocument.prettyText)
                                  setRawDraft(parsedDocument.prettyText)
                                  debouncedToast('Formatted')
                                }
                              }}
                              title="Format"
                            />
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="tooltip-content" side="bottom">
                              <TooltipText label="Format" shortcut="Ctrl+F" settings={tooltipSettings} />
                              <Tooltip.Arrow className="tooltip-arrow" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>

                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <IconButton
                              icon={Minify2}
                              onClick={() => {
                                const minified = JSON.stringify(parsedDocument.data)
                                setSourceText(minified)
                                setRawDraft(minified)
                                debouncedToast('Minified')
                              }}
                              title="Minify"
                            />
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="tooltip-content" side="bottom">
                              Minify
                              <Tooltip.Arrow className="tooltip-arrow" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>

                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <IconButton
                              icon={Copy}
                              onClick={() => copyText(rawDraft, 'JSON copied')}
                              title="Copy JSON"
                            />
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="tooltip-content" side="bottom">
                              Copy JSON
                              <Tooltip.Arrow className="tooltip-arrow" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>



                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <IconButton
                              icon={rawMode === 'edit' ? Eye : PenLine}
                              onClick={() => setRawMode((current) => (current === 'edit' ? 'preview' : 'edit'))}
                              active={rawMode === 'edit'}
                              title={rawMode === 'edit' ? 'Switch to preview' : 'Switch to edit'}
                            />
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="tooltip-content" side="bottom">
                              {rawMode === 'edit' ? 'Preview' : 'Edit'}
                              <Tooltip.Arrow className="tooltip-arrow" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>

                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <IconButton icon={Clipboard} onClick={() => setPasteOpen(true)} title="Paste JSON" />
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="tooltip-content" side="bottom">
                              Paste (Ctrl+P)
                              <Tooltip.Arrow className="tooltip-arrow" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </>
                    )}

                    {activeTab === 'diff' && (
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <IconButton
                            icon={FileText}
                            onClick={() => setDiffTreeMode((current) => !current)}
                            active={diffTreeMode}
                            title="Tree Diff Mode"
                          />
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content className="tooltip-content" side="bottom">
                            Tree Diff Mode
                            <Tooltip.Arrow className="tooltip-arrow" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    )}
                  </div>
                  <div style={{ width: '1px', height: '20px', background: 'var(--border-default)' }} />
                </>
              )}

              <div className="topbar-actions">
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <IconButton
                      icon={theme === 'dark' ? Sun : Moon}
                      onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    />
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content className="tooltip-content" side="bottom">
                      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                      <Tooltip.Arrow className="tooltip-arrow" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>

                {(() => {
                  const currentTab = docTabs.find((t) => t.id === activeDocTabId)
                  const tabName = currentTab ? currentTab.name : "document"
                  const baseName = tabName.replace(/\.[^/.]+$/, "")

                  const match = tabName.match(/\.([^.]+)$/)
                  const ext = match ? match[1].toLowerCase() : ""
                  const isRecognized = ['json', 'yaml', 'yml', 'xml', 'csv', 'sql', 'md', 'ts', 'py', 'go', 'txt'].includes(ext)

                  const handleDownloadTabFile = (fileName: string, text: string) => {
                    const fileMatch = fileName.match(/\.([^.]+)$/)
                    const fileExt = fileMatch ? fileMatch[1].toLowerCase() : ""

                    let mimeType = 'text/plain;charset=utf-8'
                    let downloadContent = text

                    try {
                      const parsed = JSON.parse(text)
                      let target = ''
                      if (fileExt === 'yaml' || fileExt === 'yml') target = 'yaml'
                      else if (fileExt === 'xml') target = 'xml'
                      else if (fileExt === 'csv') target = 'csv'
                      else if (fileExt === 'sql') target = 'sql'
                      else if (fileExt === 'md') target = 'markdown-table'
                      else if (fileExt === 'ts') target = 'ts'
                      else if (fileExt === 'py') target = 'python'
                      else if (fileExt === 'go') target = 'go'
                      else if (fileExt === 'json') target = 'json'

                      if (target) {
                        const conversion = convertJson(parsed, target)
                        downloadContent = conversion.output
                        mimeType = conversion.mimeType || 'text/plain;charset=utf-8'
                      }
                    } catch (e) {
                      // parsing failed, use original text as fallback
                    }
                    downloadText(fileName, downloadContent, mimeType)
                  }

                  return (
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button type="button" className="icon-button" title="Options" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', border: '0.5px solid var(--border-default)', borderRadius: '8px', width: '38px', height: '38px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                          <Menu size={18} />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content className="dropdown-content" sideOffset={5} align="end">
                          <DropdownMenu.Item className="dropdown-item" onSelect={() => uploadInputRef.current?.click()}>
                            <Upload size={14} style={{ marginRight: 8 }} />
                            Upload JSON
                          </DropdownMenu.Item>

                          {activeTab === 'markdown' ? (
                            <DropdownMenu.Item className="dropdown-item" onSelect={() => {
                              downloadText(`${baseName}.md`, markdownText, 'text/markdown;charset=utf-8')
                              debouncedToast('Markdown downloaded')
                            }}>
                              <Download size={14} style={{ marginRight: 8 }} />
                              Download Markdown (.md)
                            </DropdownMenu.Item>
                          ) : (
                            <>
                              {isRecognized && ext !== 'json' && ext !== 'txt' && (
                                <DropdownMenu.Item className="dropdown-item" onSelect={() => {
                                  handleDownloadTabFile(tabName, sourceText)
                                  debouncedToast(`${ext.toUpperCase()} downloaded`)
                                }}>
                                  <Download size={14} style={{ marginRight: 8 }} />
                                  Download {tabName}
                                </DropdownMenu.Item>
                              )}
                              <DropdownMenu.Item className="dropdown-item" onSelect={() => {
                                handleDownloadTabFile(`${baseName}.json`, sourceText)
                                debouncedToast('JSON downloaded')
                              }}>
                                <Download size={14} style={{ marginRight: 8 }} />
                                Download JSON (.json)
                              </DropdownMenu.Item>
                              <DropdownMenu.Item className="dropdown-item" onSelect={() => {
                                handleDownloadTabFile(`${baseName}.txt`, sourceText)
                                debouncedToast('Text downloaded')
                              }}>
                                <Download size={14} style={{ marginRight: 8 }} />
                                Download Text (.txt)
                              </DropdownMenu.Item>
                            </>
                          )}

                          <DropdownMenu.Item className="dropdown-item" onSelect={() => {
                            setSourceText(SAMPLE_JSON)
                            setRawDraft(SAMPLE_JSON)
                            setExpandedPaths(new Set(['$']))
                            setActiveTab('raw')
                            setRawMode('edit')
                            debouncedToast('Sample loaded')
                          }}>
                            <RefreshCw size={14} style={{ marginRight: 8 }} />
                            Load Sample
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator className="dropdown-separator" />
                          <DropdownMenu.CheckboxItem
                            className="dropdown-item"
                            checked={editorSettings.wordWrapEnabled}
                            onCheckedChange={(checked) => {
                              setEditorSettings((s) => ({
                                ...s,
                                wordWrapEnabled: checked,
                              }))
                            }}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <AlignLeft size={14} style={{ marginRight: 8 }} />
                              Word Wrap
                            </div>
                            <DropdownMenu.ItemIndicator style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={14} />
                            </DropdownMenu.ItemIndicator>
                          </DropdownMenu.CheckboxItem>
                          <DropdownMenu.Separator className="dropdown-separator" />
                          <DropdownMenu.Item className="dropdown-item" onSelect={() => setSettingsOpen(true)}>
                            <Settings size={14} style={{ marginRight: 8 }} />
                            Settings
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  )
                })()}
              </div>
            </div>
          </header>

          {/* New Document Workspace Tabs Strip */}
          {!['notes', 'diff', 'markdown'].includes(activeTab) && (
            <div className="document-bar" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(0,0,0,0.12)', borderBottom: '1.0px solid var(--border-default)', overflowX: 'auto', flexShrink: 0 }}>
              {docTabs.map((dt) => (
                <div
                  key={dt.id}
                  className={clsx('document-tab', activeDocTabId === dt.id && 'is-active')}
                  onClick={() => handleSelectDocTab(dt.id)}
                  onDoubleClick={() => handleRenameDocTab(dt.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: '12px',
                    background: activeDocTabId === dt.id ? 'var(--bg-panel)' : 'rgba(255,255,255,0.02)',
                    border: activeDocTabId === dt.id ? '1px solid var(--border-focus)' : '1px solid var(--border-default)',
                    cursor: 'pointer',
                    color: activeDocTabId === dt.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: activeDocTabId === dt.id ? 600 : 400,
                    transition: 'all 150ms ease',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {renamingDocTabId === dt.id ? (
                    <input
                      autoFocus
                      value={renamingDocTabValue}
                      onChange={(e) => setRenamingDocTabValue(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                        if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      style={{
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-focus)',
                        borderRadius: 4,
                        color: 'var(--text-primary)',
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '2px 6px',
                        width: 120,
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <span>{dt.name}</span>
                  )}
                  <button
                    type="button"
                    className="document-tab-close"
                    onClick={(e) => handleCloseDocTab(dt.id, e)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      transition: 'color 100ms ease',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = 'var(--error)')}
                    onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    title="Close slot"
                  >
                    <X size={10} style={{ pointerEvents: 'none' }} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="document-tab-add"
                onClick={handleCreateDocTab}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px dashed var(--border-default)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'all 150ms ease',
                }}
                title="Add document slot"
              >
                + Add Document
              </button>
            </div>
          )}

          <SettingsDialog
            themeCustom={themeCustom}
            setThemeCustom={setThemeCustom}
            tooltipSettings={tooltipSettings}
            setTooltipSettings={setTooltipSettings}
            appName={appName}
            setAppName={setAppName}
            appLogo={appLogo}
            setAppLogo={setAppLogo}
            editorSettings={editorSettings}
            setEditorSettings={setEditorSettings}
            treeMatchKeyColor={treeMatchKeyColor}
            setTreeMatchKeyColor={setTreeMatchKeyColor}
            enabledTabs={enabledTabs}
            setEnabledTabs={setEnabledTabs}
          />

          <Dialog.Root open={pasteOpen} onOpenChange={setPasteOpen}>
            <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
            <Dialog.Content style={{ position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 50, background: 'var(--bg-panel)', border: '0.5px solid var(--border-default)', borderRadius: 12, padding: 12, width: '90%', maxWidth: 720 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>Paste JSON</div>
                <Dialog.Close asChild>
                  <IconButton icon={X} title="Close" />
                </Dialog.Close>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste JSON here"
                style={{ width: '100%', height: 240, padding: 8, borderRadius: 8, border: '0.5px solid var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="chip-button is-active"
                  onClick={() => {
                    if (!pasteText) return
                    setSourceText(pasteText)
                    setRawDraft(pasteText)
                    setExpandedPaths(new Set(['$']))
                    setActiveTab('tree')
                    setPasteOpen(false)
                  }}
                >
                  Load to Tree
                </button>
                <button
                  type="button"
                  className="chip-button"
                  onClick={() => {
                    if (!pasteText) return
                    setSourceText(pasteText)
                    setRawDraft(pasteText)
                    setExpandedPaths(new Set(['$']))
                    setActiveTab('table')
                    setPasteOpen(false)
                  }}
                >
                  Load to Table
                </button>
                <div style={{ flex: 1 }} />
                <button type="button" className="chip-button" onClick={() => setPasteOpen(false)}>Cancel</button>
              </div>
            </Dialog.Content>
          </Dialog.Root>



          {(activeTab === 'tree' || activeTab === 'raw') ? (
            <SearchBar
              mode={searchMode}
              onModeChange={setSearchMode}
              query={searchQuery}
              onQueryChange={setSearchQuery}
              resultIndex={searchIndex}
              resultCount={searchState.results.length}
              onStep={(delta) => {
                if (searchState.results.length === 0) {
                  return
                }
                setSearchIndex((current) => (current + delta + searchState.results.length) % searchState.results.length)
              }}
              error={searchState.error}
              onCopyMatches={copyFilteredMatches}
            />
          ) : null}

          <footer className="statusbar panel app-footer">
            <div className="status-left">
              <span
                className={clsx('status-dot', parsedDocument.error ? 'is-error' : 'is-valid')}
                aria-hidden="true"
              />
              {parsedDocument.error ? (
                <span className="status-pill is-error">error line {parsedDocument.error.line}</span>
              ) : (
                <div className="status-metrics" aria-label="Document stats">
                  <span>{getTypeLabel(parsedDocument.data)}</span>
                  <span>{parsedDocument.stats.nodeCount} nodes</span>
                  <span>depth {parsedDocument.stats.depth}</span>
                  <span>{formatBytes(parsedDocument.stats.bytes)}</span>
                </div>
              )}
              {parsedDocument.repair.repaired ? (
                <span className="status-pill is-warn">repaired {parsedDocument.repair.fixes} fixes</span>
              ) : null}
            </div>
            <div className="status-right">
              {searchState.results.length > 0 ? (
                <span className="status-path">{searchState.results[searchIndex]?.path}</span>
              ) : (
                <span className="status-path is-empty">No active match</span>
              )}
            </div>
          </footer>

          <main className="workspace" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {activeTab === 'tree' && (
              <TreeTab
                document={parsedDocument}
                rows={treeRows}
                expandedPaths={expandedPaths}
                matchedPaths={matchedPaths}
                onToggle={(path) =>
                  setExpandedPaths((current) => {
                    const next = new Set(current)
                    if (next.has(path)) {
                      next.delete(path)
                    } else {
                      next.add(path)
                    }
                    return next
                  })
                }
                currentResult={searchState.results[searchIndex]}
                searchResults={searchState.results}
                currentSearchIndex={searchIndex}
                onSelectResultIndex={setSearchIndex}
                searchQuery={searchQuery}
                showTypeBadges={editorSettings.showTypeBadges}
              />
            )}

            {activeTab === 'raw' && (
              <RawTab
                value={rawDraft}
                onChange={setRawDraft}
                editable={rawMode === 'edit'}
                theme={theme}
                error={parsedDocument.error}
                editorSettings={editorSettings}
                onMount={(editorInstance, monacoInstance) => {
                  rawEditorRef.current = editorInstance
                  rawMonacoRef.current = monacoInstance
                  setRawEditor(editorInstance)
                }}
              />
            )}


            {activeTab === 'table' && (
              <TableTab
                data={parsedDocument.data}
                filterIndexes={searchState.filter?.indexes ?? []}
              />
            )}

            {activeTab === 'diff' && (
              <section ref={diffContainerRef} className="content-panel panel diff-panel">
                <div className="diff-summary">
                  <div className="diff-summary-left">
                    {diffBundle ? (
                      <>
                        <span style={{ color: 'var(--added-text)' }}>+{diffBundle.summary.added} added</span>
                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                        <span style={{ color: 'var(--removed-text)' }}>−{diffBundle.summary.removed} removed</span>
                        <span style={{ color: 'var(--text-muted)' }}>·</span>
                        <span style={{ color: 'var(--changed-text)' }}>~{diffBundle.summary.changed} changed</span>
                      </>
                    ) : (
                      <span>No diff data</span>
                    )}
                    {diffBundle && (diffBundle.summary.added === 0 && diffBundle.summary.removed === 0 && diffBundle.summary.changed === 0) && (
                      <span style={{ color: 'var(--valid)' }}>✓ Same data</span>
                    )}
                  </div>
                  <div className="diff-summary-right">
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <IconButton
                          icon={isDiffFullscreen ? Minimize2 : Maximize2}
                          onClick={handleToggleDiffFullscreen}
                          title={isDiffFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="tooltip-content" side="bottom">
                          {isDiffFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                          <Tooltip.Arrow className="tooltip-arrow" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <IconButton
                          icon={ChevronLeft}
                          onClick={() => {
                            if (!diffBundle || diffBundle.gutterMarkers.length === 0) return
                            const index = Math.max(0, diffBundle.gutterMarkers.findIndex((entry) => entry.id === activeDiffBlockId) - 1)
                            const block = diffBundle.gutterMarkers[index]
                            setActiveDiffBlockId(block.id)
                            diffLeftEditorRef.current?.revealLineInCenter(block.leftStart)
                            diffRightEditorRef.current?.revealLineInCenter(block.rightStart)
                          }}
                          title="Previous change"
                        />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="tooltip-content" side="bottom">
                          Previous change
                          <Tooltip.Arrow className="tooltip-arrow" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <IconButton
                          icon={ChevronRight}
                          onClick={() => {
                            if (!diffBundle || diffBundle.gutterMarkers.length === 0) return
                            const currentIndex = diffBundle.gutterMarkers.findIndex((entry) => entry.id === activeDiffBlockId)
                            const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % diffBundle.gutterMarkers.length
                            const block = diffBundle.gutterMarkers[nextIndex]
                            setActiveDiffBlockId(block.id)
                            diffLeftEditorRef.current?.revealLineInCenter(block.leftStart)
                            diffRightEditorRef.current?.revealLineInCenter(block.rightStart)
                          }}
                          title="Next change"
                        />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="tooltip-content" side="bottom">
                          Next change
                          <Tooltip.Arrow className="tooltip-arrow" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <IconButton
                          icon={Download}
                          onClick={() => diffBundle && downloadText('diff.patch.json', JSON.stringify(diffBundle.jsonPatch, null, 2), 'application/json;charset=utf-8')}
                          title="Export JSON Patch"
                        />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="tooltip-content" side="bottom">
                          Export JSON Patch
                          <Tooltip.Arrow className="tooltip-arrow" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <IconButton
                          icon={FileText}
                          onClick={() => diffBundle && downloadText('diff-report.md', diffBundle.markdownReport, 'text/markdown;charset=utf-8')}
                          title="Export Markdown Report"
                        />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="tooltip-content" side="bottom">
                          Export Markdown Report
                          <Tooltip.Arrow className="tooltip-arrow" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </div>
                </div>

                {diffTreeMode && diffBundle ? (
                  <DiffTreeMode bundle={diffBundle} />
                ) : (
                  <div className={clsx('diff-editors', expandedDiffPane && `is-${expandedDiffPane}-expanded`)}>
                    {/* Left pane */}
                    <div
                      className={clsx(
                        'diff-pane-wrapper',
                        expandedDiffPane === 'right' && 'hidden',
                      )}
                    >
                      <div className="diff-pane">
                        <div className="diff-pane-topbar">
                          <input className="app-input" value={diffLeftLabel} onChange={(event) => setDiffLeftLabel(event.target.value)} />
                          <div className="pane-actions">
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <IconButton
                                  icon={Upload}
                                  size={14}
                                  onClick={() => diffLeftUploadRef.current?.click()}
                                  title="Upload"
                                />
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content className="tooltip-content" side="bottom">
                                  Upload
                                  <Tooltip.Arrow className="tooltip-arrow" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>

                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <IconButton
                                  icon={Copy}
                                  size={14}
                                  onClick={() => copyText(diffLeftText, 'JSON copied')}
                                  title="Copy"
                                />
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content className="tooltip-content" side="bottom">
                                  Copy
                                  <Tooltip.Arrow className="tooltip-arrow" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>

                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <IconButton
                                  icon={AlignLeft}
                                  size={14}
                                  onClick={() => {
                                    setDiffLeftText(diffLeftDocument.prettyText)
                                    debouncedToast('Formatted', 'success')
                                  }}
                                  title="Format"
                                />
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content className="tooltip-content" side="bottom">
                                  Format
                                  <Tooltip.Arrow className="tooltip-arrow" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>

                            <SplitPaneToggle
                              side="left"
                              activeSide={expandedDiffPane}
                              onToggle={handleToggleDiffPane}
                              label="left pane"
                              settings={tooltipSettings}
                            />
                          </div>
                        </div>
                        <div className="diff-pane-status">
                          {diffLeftDocument.error
                            ? <span style={{ color: 'var(--error)' }}>error {diffLeftDocument.error.line}:{diffLeftDocument.error.column}</span>
                            : diffLeftDocument.repair.repaired
                              ? <span style={{ color: 'var(--warn)' }}>repaired · {diffLeftDocument.repair.fixes} fixes</span>
                              : <span style={{ color: 'var(--valid)' }}>valid</span>
                          }
                        </div>
                        <div className="diff-editor-slot">
                          <Suspense fallback={<div className="empty-state flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
                            <MonacoEditor
                              height="100%"
                              language="json"
                              value={diffLeftText}
                              theme="jv-theme"
                              onChange={(next) => setDiffLeftText(next ?? '')}
                              onMount={(editorInstance, monacoInstance) => {
                                diffLeftEditorRef.current = editorInstance
                                diffMonacoRef.current = monacoInstance
                                setDiffLeftEditor(editorInstance)
                                const layoutEditor = () => setTimeout(() => editorInstance.layout(), 0)
                                layoutEditor()
                                window.addEventListener('resize', layoutEditor)
                                editorInstance.onDidDispose(() => window.removeEventListener('resize', layoutEditor))
                              }}
                              options={{
                                readOnly: false,
                                lineNumbers: 'on',
                                minimap: { enabled: false },
                                folding: true,
                                scrollBeyondLastLine: false,
                                fontFamily: 'DM Mono, monospace',
                                fontSize: editorSettings.fontSize,
                                lineHeight: 22,
                                automaticLayout: true,
                                wordWrap: editorSettings.wordWrapEnabled ? 'on' : 'off',
                                scrollbar: {
                                  vertical: 'auto',
                                  horizontal: 'auto',
                                },
                              }}
                            />
                          </Suspense>
                        </div>

                      </div>
                    </div>

                    <div className={clsx('diff-gutter', expandedDiffPane && 'hidden')}>
                      {diffBundle ? (
                        <DiffConnections
                          blocks={diffBundle.gutterMarkers}
                          activeId={activeDiffBlockId}
                          scrollTop={diffScrollTop}
                          onJump={(block) => {
                            setActiveDiffBlockId(block.id)
                            diffLeftEditorRef.current?.revealLineInCenter(block.leftStart)
                            diffRightEditorRef.current?.revealLineInCenter(block.rightStart)
                          }}
                        />
                      ) : null}
                    </div>

                    {/* Right pane */}
                    <div
                      className={clsx(
                        'diff-pane-wrapper',
                        expandedDiffPane === 'left' && 'hidden',
                      )}
                    >
                      <div className="diff-pane">
                        <div className="diff-pane-topbar">
                          <input className="app-input" value={diffRightLabel} onChange={(event) => setDiffRightLabel(event.target.value)} />
                          <div className="pane-actions">
                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <IconButton
                                  icon={Upload}
                                  size={14}
                                  onClick={() => diffRightUploadRef.current?.click()}
                                  title="Upload"
                                />
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content className="tooltip-content" side="bottom">
                                  Upload
                                  <Tooltip.Arrow className="tooltip-arrow" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>

                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <IconButton
                                  icon={Copy}
                                  size={14}
                                  onClick={() => copyText(diffRightText, 'JSON copied')}
                                  title="Copy"
                                />
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content className="tooltip-content" side="bottom">
                                  Copy
                                  <Tooltip.Arrow className="tooltip-arrow" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>

                            <Tooltip.Root>
                              <Tooltip.Trigger asChild>
                                <IconButton
                                  icon={AlignLeft}
                                  size={14}
                                  onClick={() => {
                                    setDiffRightText(diffRightDocument.prettyText)
                                    debouncedToast('Formatted', 'success')
                                  }}
                                  title="Format"
                                />
                              </Tooltip.Trigger>
                              <Tooltip.Portal>
                                <Tooltip.Content className="tooltip-content" side="bottom">
                                  Format
                                  <Tooltip.Arrow className="tooltip-arrow" />
                                </Tooltip.Content>
                              </Tooltip.Portal>
                            </Tooltip.Root>

                            <SplitPaneToggle
                              side="right"
                              activeSide={expandedDiffPane}
                              onToggle={handleToggleDiffPane}
                              label="right pane"
                              settings={tooltipSettings}
                            />
                          </div>
                        </div>
                        <div className="diff-pane-status">
                          {diffRightDocument.error
                            ? <span style={{ color: 'var(--error)' }}>error {diffRightDocument.error.line}:{diffRightDocument.error.column}</span>
                            : diffRightDocument.repair.repaired
                              ? <span style={{ color: 'var(--warn)' }}>repaired · {diffRightDocument.repair.fixes} fixes</span>
                              : <span style={{ color: 'var(--valid)' }}>valid</span>
                          }
                        </div>
                        <div className="diff-editor-slot" style={{ width: '100%', height: '100%', minHeight: 0 }}>
                          <Suspense fallback={<div className="empty-state flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
                            <MonacoEditor
                              height="100%"
                              width="100%"
                              language="json"
                              value={diffRightText}
                              theme="jv-theme"
                              onChange={(next) => setDiffRightText(next ?? '')}
                              onMount={(editorInstance, monacoInstance) => {
                                diffRightEditorRef.current = editorInstance
                                diffMonacoRef.current = monacoInstance
                                setDiffRightEditor(editorInstance)
                                const layoutEditor = () => setTimeout(() => editorInstance.layout(), 0)
                                layoutEditor()
                                window.addEventListener('resize', layoutEditor)
                                editorInstance.onDidDispose(() => window.removeEventListener('resize', layoutEditor))
                              }}
                              options={{
                                readOnly: false,
                                lineNumbers: 'on',
                                minimap: { enabled: false },
                                folding: true,
                                scrollBeyondLastLine: false,
                                fontFamily: 'DM Mono, monospace',
                                fontSize: editorSettings.fontSize,
                                lineHeight: 22,
                                automaticLayout: true,
                                wordWrap: editorSettings.wordWrapEnabled ? 'on' : 'off',
                                scrollbar: {
                                  vertical: 'auto',
                                  horizontal: 'auto',
                                },
                              }}
                            />

                          </Suspense>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'notes' && (
              <Suspense fallback={<div className="empty-state">Loading notes…</div>}>
                <NotesTab />
              </Suspense>
            )}
            {activeTab === 'mindmap' && (
              <section className="content-panel panel" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 8 }}>
                <div style={{ padding: 8, height: '100%', minHeight: 0 }}>
                  <Suspense fallback={<div className="empty-state">Loading mindmap…</div>}>
                    <MindmapInteractive
                      data={parsedDocument.data}
                      theme={theme}
                      fontSize={editorSettings.fontSize}
                      onNodeSelect={(info) => setSelectedMindNode(info)}
                      onApiReady={(api) => setMindmapApi(api)}
                    />
                  </Suspense>


                  <div style={{ position: 'absolute', right: 28, top: 88, display: 'flex', gap: 8 }}>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <IconButton variant="chip" icon={ZoomIn} onClick={() => mindmapApi?.zoomIn()} title="Zoom In" />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="tooltip-content" side="bottom">
                          Zoom In
                          <Tooltip.Arrow className="tooltip-arrow" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>

                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <IconButton variant="chip" icon={ZoomOut} onClick={() => mindmapApi?.zoomOut()} title="Zoom Out" />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="tooltip-content" side="bottom">
                          Zoom Out
                          <Tooltip.Arrow className="tooltip-arrow" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>

                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <IconButton variant="chip" icon={PlusCircle} onClick={() => mindmapApi?.expandAll()} title="Expand All" />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="tooltip-content" side="bottom">
                          Expand All
                          <Tooltip.Arrow className="tooltip-arrow" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>

                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <IconButton variant="chip" icon={MinusCircle} onClick={() => mindmapApi?.collapseAll()} title="Collapse All" />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="tooltip-content" side="bottom">
                          Collapse All
                          <Tooltip.Arrow className="tooltip-arrow" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>

                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <IconButton variant="chip" icon={RefreshCw} onClick={() => mindmapApi?.reset()} title="Reset" />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="tooltip-content" side="bottom">
                          Reset
                          <Tooltip.Arrow className="tooltip-arrow" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </div>
                </div>
                <div style={{ padding: 12, borderLeft: '0.5px solid var(--border-default)', overflow: 'auto' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Node details</div>
                  {selectedMindNode ? (
                    <>
                      <div style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>{selectedMindNode.path}</div>
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'var(--bg-card)', padding: 8, borderRadius: 8 }}>{JSON.stringify(selectedMindNode.value, null, 2)}</pre>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="chip-button" onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedMindNode.value))}>Copy JSON</button>
                        <button className="chip-button" onClick={() => setSelectedMindNode(null)}>Clear</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)' }}>Click a node to view details</div>
                  )}
                </div>
              </section>
            )}
            {activeTab === 'markdown' && (
              <MarkdownTab
                theme={theme}
                markdownText={markdownText}
                onChange={setMarkdownText}
                tooltipSettings={tooltipSettings}
                editorSettings={editorSettings}
              />
            )}

          </main>
        </Dialog.Root>
      </div>
    </Tooltip.Provider>
  )
}

export default App
