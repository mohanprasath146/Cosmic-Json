import { diff as createDiff } from 'jsondiffpatch'
import type { DiffBlock, DiffBundle, DiffLine, DiffLineType, JsonValue } from '../../types'

type Side = 'left' | 'right'

interface RenderState {
  lines: DiffLine[]
  ranges: Map<string, { start: number; end: number }>
}

function escapeJsonPointerToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1')
}

function pointerToPath(pointer: string): string {
  if (!pointer || pointer === '/') {
    return '$'
  }

  return pointer
    .split('/')
    .slice(1)
    .map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((path, token) => {
      if (/^\d+$/.test(token)) {
        return `${path}[${token}]`
      }
      return `${path}.${token}`
    }, '$')
}

function pathToPointer(path: string): string {
  if (path === '$') {
    return ''
  }

  const tokens = path
    .replace(/^\$\./, '')
    .replace(/^\$/, '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)

  return `/${tokens.map(escapeJsonPointerToken).join('/')}`
}

function formatPrimitive(value: JsonValue): string {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  return String(value)
}

function deepEqual(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isObjectValue(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function buildJsonPatch(left: JsonValue | undefined, right: JsonValue | undefined, path = ''): Array<Record<string, unknown>> {
  if (deepEqual(left, right)) {
    return []
  }

  if (left === undefined) {
    return [{ op: 'add', path: path || '/', value: right }]
  }

  if (right === undefined) {
    return [{ op: 'remove', path: path || '/' }]
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    const operations: Array<Record<string, unknown>> = []
    const maxLength = Math.max(left.length, right.length)

    for (let index = 0; index < maxLength; index += 1) {
      const childPath = `${path}/${index}`
      if (index >= left.length) {
        operations.push({ op: 'add', path: childPath, value: right[index] })
      } else if (index >= right.length) {
        operations.push({ op: 'remove', path: childPath })
      } else {
        operations.push(...buildJsonPatch(left[index], right[index], childPath))
      }
    }

    return operations
  }

  if (isObjectValue(left) && isObjectValue(right)) {
    const operations: Array<Record<string, unknown>> = []
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    keys.forEach((key) => {
      const childPath = `${path}/${escapeJsonPointerToken(key)}`
      if (!(key in left)) {
        operations.push({ op: 'add', path: childPath, value: right[key] })
      } else if (!(key in right)) {
        operations.push({ op: 'remove', path: childPath })
      } else {
        operations.push(...buildJsonPatch(left[key], right[key], childPath))
      }
    })
    return operations
  }

  return [{ op: 'replace', path: path || '/', value: right }]
}

function includesPath(paths: Set<string>, path: string): boolean {
  return Array.from(paths).some((entry) => entry === path || entry.startsWith(`${path}.`) || entry.startsWith(`${path}[`))
}

function makeStatusResolver(
  side: Side,
  addedPaths: Set<string>,
  removedPaths: Set<string>,
  changedPaths: Set<string>,
) {
  return (path: string): DiffLineType => {
    if (side === 'left' && includesPath(removedPaths, path)) {
      return 'removed'
    }
    if (side === 'right' && includesPath(addedPaths, path)) {
      return 'added'
    }
    if (includesPath(changedPaths, path)) {
      return 'changed'
    }
    return 'unchanged'
  }
}

function pushLine(state: RenderState, path: string, text: string, type: DiffLineType): void {
  state.lines.push({
    lineNumber: state.lines.length + 1,
    path,
    text,
    type,
  })
}

function renderValue(
  state: RenderState,
  value: JsonValue,
  path: string,
  indent = 0,
  label?: string,
  isLast = true,
  resolveType?: (path: string) => DiffLineType,
): void {
  const start = state.lines.length + 1
  const padding = '  '.repeat(indent)
  const prefix = label ? `${JSON.stringify(label)}: ` : ''
  const lineType = resolveType?.(path) ?? 'unchanged'

  if (Array.isArray(value)) {
    if (value.length === 0) {
      pushLine(state, path, `${padding}${prefix}[]${isLast ? '' : ','}`, lineType)
      state.ranges.set(path, { start, end: state.lines.length })
      return
    }

    pushLine(state, path, `${padding}${prefix}[`, lineType)
    value.forEach((entry, index) => {
      renderValue(
        state,
        entry,
        `${path}[${index}]`,
        indent + 1,
        undefined,
        index === value.length - 1,
        resolveType,
      )
    })
    pushLine(state, path, `${padding}]${isLast ? '' : ','}`, lineType)
    state.ranges.set(path, { start, end: state.lines.length })
    return
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      pushLine(state, path, `${padding}${prefix}{}${isLast ? '' : ','}`, lineType)
      state.ranges.set(path, { start, end: state.lines.length })
      return
    }

    pushLine(state, path, `${padding}${prefix}{`, lineType)
    entries.forEach(([key, entry], index) => {
      renderValue(
        state,
        entry,
        `${path}.${key}`,
        indent + 1,
        key,
        index === entries.length - 1,
        resolveType,
      )
    })
    pushLine(state, path, `${padding}}${isLast ? '' : ','}`, lineType)
    state.ranges.set(path, { start, end: state.lines.length })
    return
  }

  pushLine(state, path, `${padding}${prefix}${formatPrimitive(value)}${isLast ? '' : ','}`, lineType)
  state.ranges.set(path, { start, end: state.lines.length })
}

function renderDocument(value: JsonValue, resolveType: (path: string) => DiffLineType): RenderState {
  const state: RenderState = {
    lines: [],
    ranges: new Map<string, { start: number; end: number }>(),
  }
  renderValue(state, value, '$', 0, undefined, true, resolveType)
  return state
}

function buildMarkdownReport(summary: { added: number; removed: number; changed: number }, jsonPatch: Array<Record<string, unknown>>) {
  const lines = ['# JSON Diff Report', '', `+ ${summary.added} added`, `- ${summary.removed} removed`, `~ ${summary.changed} changed`, '', '## Operations', '']
  if (jsonPatch.length === 0) {
    lines.push('- No differences')
  } else {
    jsonPatch.forEach((operation) => {
      lines.push(`- \`${String(operation.op)} ${String(operation.path)}\``)
    })
  }
  return lines.join('\n')
}

export function buildDiffBundle(left: JsonValue, right: JsonValue): DiffBundle {
  const delta = createDiff(left, right)
  const jsonPatch = delta ? buildJsonPatch(left, right) : []

  const addedPaths = new Set<string>()
  const removedPaths = new Set<string>()
  const changedPaths = new Set<string>()

  jsonPatch.forEach((operation) => {
    const op = String(operation.op)
    const path = pointerToPath(String(operation.path ?? '/'))
    if (op === 'add') {
      addedPaths.add(path)
    } else if (op === 'remove') {
      removedPaths.add(path)
    } else {
      changedPaths.add(path)
    }
  })

  if (!deepEqual(left, right) && jsonPatch.length === 0) {
    changedPaths.add('$')
  }

  const leftState = renderDocument(left, makeStatusResolver('left', addedPaths, removedPaths, changedPaths))
  const rightState = renderDocument(right, makeStatusResolver('right', addedPaths, removedPaths, changedPaths))

  const markerPaths = new Set<string>([...addedPaths, ...removedPaths, ...changedPaths])
  const gutterMarkers: DiffBlock[] = Array.from(markerPaths).map((path, index) => {
    const leftRange = leftState.ranges.get(path)
    const rightRange = rightState.ranges.get(path)
    const type = addedPaths.has(path) ? 'added' : removedPaths.has(path) ? 'removed' : 'changed'

    return {
      id: `diff-${index}`,
      path,
      type,
      leftStart: leftRange?.start ?? leftState.ranges.get('$')?.start ?? 1,
      leftEnd: leftRange?.end ?? leftState.ranges.get('$')?.end ?? leftState.lines.length,
      rightStart: rightRange?.start ?? rightState.ranges.get('$')?.start ?? 1,
      rightEnd: rightRange?.end ?? rightState.ranges.get('$')?.end ?? rightState.lines.length,
    }
  })

  const summary = {
    added: jsonPatch.filter((entry) => entry.op === 'add').length,
    removed: jsonPatch.filter((entry) => entry.op === 'remove').length,
    changed: jsonPatch.filter((entry) => entry.op === 'replace' || entry.op === 'move').length,
  }

  return {
    left: leftState.lines,
    right: rightState.lines,
    gutterMarkers,
    summary,
    jsonPatch: jsonPatch.map((entry) => ({
      ...entry,
      path: entry.path ?? pathToPointer('$'),
    })),
    markdownReport: buildMarkdownReport(summary, jsonPatch),
  }
}
