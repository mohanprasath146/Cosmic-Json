import { Copy, Route, PlusCircle, MinusCircle } from 'lucide-react'
import clsx from 'clsx'
import type { CSSProperties } from 'react'
import type { JsonValue } from '../types'
import { toast } from 'react-hot-toast'

const lastToastTime: Record<string, number> = {}

function debouncedToast(message: string, type: 'success' | 'error' = 'success') {
  const now = Date.now()
  if (now - (lastToastTime[message] || 0) < 1000) {
    return
  }
  lastToastTime[message] = now
  toast[type](message)
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text).then(() => {
    debouncedToast('Value copied')
  })
}

interface TreeNodeRow {
  path: string
  keyLabel: string
  depth: number
  lineNumber: number
  value: JsonValue
  expandable: boolean
  childCount: number
  typeLabel: string
  expanded: boolean
}

interface TreeNodeProps {
  style: CSSProperties
  row: TreeNodeRow
  isMatched: boolean
  isCurrent?: boolean
  revealedSecrets: Set<string>
  onToggle: (path: string) => void
  onRevealSecret: (path: string) => void
  showLineNumber?: boolean
  hasActiveSearch?: boolean
  showTypeBadges?: boolean
}

function isSecretKey(key: string): boolean {
  return /password|token|secret|api.?key|auth/i.test(key)
}

function isImageUrl(value: string): boolean {
  return /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(value) || value.includes('images.unsplash.com')
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}T/.test(value)
}

function isHexColor(value: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)
}

function ValueInspector({
  row,
  revealedSecrets,
  onRevealSecret,
}: {
  row: TreeNodeRow
  revealedSecrets: Set<string>
  onRevealSecret: (path: string) => void
}) {
  const value = row.value
  const key = row.keyLabel

  if (row.expandable) {
    const bracket = Array.isArray(value) ? '[' : '{'
    const closing = Array.isArray(value) ? ']' : '}'
    return (
      <span className="tree-value type-muted">
        {bracket}
        {closing}
      </span>
    )
  }

  if (value === null || typeof value === 'boolean') {
    return <span className="tree-value type-muted">{String(value)}</span>
  }

  if (typeof value === 'number') {
    return <span className="tree-value type-number">{value}</span>
  }

  if (typeof value === 'string') {
    if (isSecretKey(key) && !revealedSecrets.has(row.path)) {
      return (
        <button type="button" className="secret-button" onClick={(e) => { e.stopPropagation(); onRevealSecret(row.path) }}>
          ••••••
        </button>
      )
    }

    return (
      <span className="tree-value type-string">
        "{value}"
        {isUrl(value) ? (
          <a href={value} target="_blank" rel="noreferrer" className="inline-link" onClick={(e) => e.stopPropagation()}>
            ↗
          </a>
        ) : null}
        {isImageUrl(value) ? (
          <span className="image-thumb">
            <img src={value} alt="" />
            <span className="image-preview">
              <img src={value} alt="" />
            </span>
          </span>
        ) : null}
        {isEmail(value) ? (
          <a href={`mailto:${value}`} className="inline-link" onClick={(e) => e.stopPropagation()}>
            mailto
          </a>
        ) : null}
        {isIsoDate(value) ? (
          <span className="inline-meta">
            {new Date(value).toLocaleString()}
          </span>
        ) : null}
        {isHexColor(value) ? <span className="color-dot" style={{ backgroundColor: value }} /> : null}
      </span>
    )
  }

  return <span className="tree-value">{String(value)}</span>
}

export function TreeNode({
  style,
  row,
  isMatched,
  isCurrent = false,
  revealedSecrets,
  onToggle,
  onRevealSecret,
  showLineNumber = false,
  hasActiveSearch = false,
  showTypeBadges = true,
}: TreeNodeProps) {
  return (
    <div style={style} className="tree-row-wrapper">
      <div
        className={clsx(
          'tree-row',
          hasActiveSearch && !isMatched && 'is-dimmed',
          hasActiveSearch && isCurrent && 'is-current-match',
          hasActiveSearch && isMatched && !isCurrent && 'is-match'
        )}
        onClick={() => row.expandable && onToggle(row.path)}
      >
        {showLineNumber ? <div className="tree-line-number">{row.lineNumber}</div> : null}
        <div className="tree-row-content" style={{ paddingLeft: row.depth * 16 }}>
          {Array.from({ length: row.depth }).map((_, guideIndex) => (
            <span key={`${row.path}-${guideIndex}`} className="indent-guide" style={{ left: guideIndex * 16 + 8 }} />
          ))}
          <div className="tree-main">
            <span className="tree-chevron">
              {row.expandable ? (
                row.expanded ? <MinusCircle size={14} /> : <PlusCircle size={14} />
              ) : (
                <span className="tree-chevron-placeholder" style={{ width: 14 }} />
              )}
            </span>
            <span className="tree-key">{row.keyLabel}</span>
            <ValueInspector
              row={row}
              revealedSecrets={revealedSecrets}
              onRevealSecret={onRevealSecret}
            />
            {!row.expanded && row.expandable ? (
              <span className="collapsed-badge">{Array.isArray(row.value) ? `[ ${row.childCount} ]` : `{ ${row.childCount} }`}</span>
            ) : null}
            {showTypeBadges ? <span className="type-badge">{row.typeLabel}</span> : null}
            <div className="tree-actions" style={{ display: 'flex', flexShrink: 0 }}>
              <button
                type="button"
                className="ghost-button"
                onClick={(event) => {
                  event.stopPropagation()
                  copyText(JSON.stringify(row.value, null, 2))
                }}
                title="Copy value"
                aria-label="Copy value"
              >
                <Copy size={11} />
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={(event) => {
                  event.stopPropagation()
                  copyText(row.path)
                  debouncedToast('Path copied')
                }}
                title="Copy path"
                aria-label="Copy path"
              >
                <Route size={11} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
