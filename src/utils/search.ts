import type { FilterResult, JsonValue, SearchMode, SearchResult } from '../types'

function stringifyValue(value: JsonValue): string {
  if (typeof value === 'string') {
    return value
  }
  return JSON.stringify(value)
}

function collectEntries(
  value: JsonValue,
  path = '$',
  keyLabel = 'root',
  acc: SearchResult[] = [],
): SearchResult[] {
  const preview = stringifyValue(value).slice(0, 160)
  acc.push({
    id: `${path}:${acc.length}`,
    path,
    label: keyLabel,
    preview,
    type: typeof value === 'object' && value !== null ? 'item' : 'value',
    value,
  })

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectEntries(entry, `${path}[${index}]`, `[${index}]`, acc)
    })
    return acc
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => {
      acc.push({
        id: `${path}.${key}:key`,
        path: `${path}.${key}`,
        label: key,
        preview: key,
        type: 'key',
        value: entry,
      })
      collectEntries(entry, `${path}.${key}`, key, acc)
    })
  }

  return acc
}

function resolvePath(target: JsonValue, path: string): JsonValue | undefined {
  const tokens = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)

  let current: unknown = target
  for (const token of tokens) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = (current as Record<string, unknown>)[token]
  }

  return current as JsonValue | undefined
}

function parseLiteral(raw: string): JsonValue {
  const trimmed = raw.trim()
  if (/^".*"$/.test(trimmed) || /^'.*'$/.test(trimmed)) {
    return trimmed.slice(1, -1)
  }
  if (trimmed === 'true') {
    return true
  }
  if (trimmed === 'false') {
    return false
  }
  if (trimmed === 'null') {
    return null
  }
  if (!Number.isNaN(Number(trimmed))) {
    return Number(trimmed)
  }
  return trimmed
}

export function runSearch(
  data: JsonValue | null,
  query: string,
  mode: Extract<SearchMode, 'text' | 'regex'>,
): { results: SearchResult[]; error: string | null } {
  if (!data || !query.trim()) {
    return { results: [], error: null }
  }

  const entries = collectEntries(data)
  try {
    const matcher =
      mode === 'regex' ? new RegExp(query, 'i') : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

    return {
      results: entries.filter((entry) =>
        matcher.test(`${entry.path} ${entry.label} ${entry.preview}`),
      ),
      error: null,
    }
  } catch (error) {
    return {
      results: [],
      error: error instanceof Error ? error.message : 'Invalid regex',
    }
  }
}

export function runFilter(data: JsonValue | null, query: string): { result: FilterResult | null; error: string | null } {
  if (!Array.isArray(data) || !query.trim()) {
    return { result: null, error: null }
  }

  const match = query.match(/^\s*([A-Za-z0-9_.[\]]+)\s*(==|!=|>=|<=|>|<|contains)\s*(.+)\s*$/)
  if (!match) {
    return {
      result: null,
      error: 'Use expressions like age > 25 or country == "India"',
    }
  }

  const [, field, operator, rawValue] = match
  const expected = parseLiteral(rawValue)
  const indexes: number[] = []
  const items = data.filter((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return false
    }

    const actual = resolvePath(item, field)

    let passes = false
    if (operator === 'contains') {
      passes = String(actual ?? '').toLowerCase().includes(String(expected).toLowerCase())
    } else if (operator === '==') {
      passes = actual === expected
    } else if (operator === '!=') {
      passes = actual !== expected
    } else {
      const left = Number(actual)
      const right = Number(expected)
      if (Number.isNaN(left) || Number.isNaN(right)) {
        passes = false
      } else if (operator === '>') {
        passes = left > right
      } else if (operator === '<') {
        passes = left < right
      } else if (operator === '>=') {
        passes = left >= right
      } else if (operator === '<=') {
        passes = left <= right
      }
    }

    if (passes) {
      indexes.push(index)
    }
    return passes
  })

  return {
    result: {
      items,
      indexes,
    },
    error: null,
  }
}

function tokenizeJsonPath(path: string): string[] {
  const tokens: string[] = []
  const pattern = /\.([A-Za-z0-9_$-]+)|\[['"]?([^'"\]]+)['"]?\]|\[(\d+|\*)\]/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(path)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3])
  }
  return tokens
}

export function runJsonPath(data: JsonValue | null, query: string): { results: SearchResult[]; error: string | null } {
  if (!data || !query.trim()) {
    return { results: [], error: null }
  }

  if (!query.startsWith('$')) {
    return { results: [], error: 'JSONPath must start with $' }
  }

  const tokens = tokenizeJsonPath(query)
  let current: Array<{ value: JsonValue; path: string }> = [{ value: data, path: '$' }]

  for (const token of tokens) {
    const next: Array<{ value: JsonValue; path: string }> = []
    current.forEach((entry) => {
      if (token === '*') {
        if (Array.isArray(entry.value)) {
          entry.value.forEach((item, index) => next.push({ value: item, path: `${entry.path}[${index}]` }))
        } else if (entry.value && typeof entry.value === 'object') {
          Object.entries(entry.value).forEach(([key, value]) =>
            next.push({ value, path: `${entry.path}.${key}` }),
          )
        }
        return
      }

      if (Array.isArray(entry.value) && /^\d+$/.test(token)) {
        const index = Number(token)
        const value = entry.value[index]
        if (value !== undefined) {
          next.push({ value, path: `${entry.path}[${index}]` })
        }
        return
      }

      if (entry.value && typeof entry.value === 'object' && !Array.isArray(entry.value) && token in entry.value) {
        next.push({
          value: entry.value[token] as JsonValue,
          path: `${entry.path}.${token}`,
        })
      }
    })
    current = next
  }

  return {
    results: current.map((entry, index) => ({
      id: `${entry.path}:${index}`,
      path: entry.path,
      label: entry.path.split('.').at(-1) ?? '$',
      preview: stringifyValue(entry.value).slice(0, 160),
      type: 'value',
      value: entry.value,
    })),
    error: null,
  }
}
