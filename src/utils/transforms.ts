import type { JsonValue } from '../types'

function sortRecursively(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortRecursively)
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, JsonValue>>((acc, key) => {
        acc[key] = sortRecursively(value[key])
        return acc
      }, {})
  }
  return value
}

function stripNullsRecursively(value: JsonValue): JsonValue | undefined {
  if (value === null) {
    return undefined
  }
  if (Array.isArray(value)) {
    return value
      .map(stripNullsRecursively)
      .filter((entry): entry is JsonValue => entry !== undefined)
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, JsonValue>>((acc, [key, entry]) => {
      const next = stripNullsRecursively(entry)
      if (next !== undefined) {
        acc[key] = next
      }
      return acc
    }, {})
  }
  return value
}

function stripEmptiesRecursively(value: JsonValue): JsonValue | undefined {
  if (Array.isArray(value)) {
    const items = value
      .map(stripEmptiesRecursively)
      .filter((entry): entry is JsonValue => entry !== undefined)
    return items.length > 0 ? items : undefined
  }
  if (value && typeof value === 'object') {
    const next = Object.entries(value).reduce<Record<string, JsonValue>>((acc, [key, entry]) => {
      const normalized = stripEmptiesRecursively(entry)
      if (normalized !== undefined) {
        acc[key] = normalized
      }
      return acc
    }, {})
    return Object.keys(next).length > 0 ? next : undefined
  }
  if (value === '' || value === null) {
    return undefined
  }
  return value
}

function flattenValue(value: JsonValue, path = '$', acc: Record<string, JsonValue> = {}): Record<string, JsonValue> {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      acc[path] = []
      return acc
    }
    value.forEach((entry, index) => flattenValue(entry, `${path}[${index}]`, acc))
    return acc
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) {
      acc[path] = {}
      return acc
    }
    entries.forEach(([key, entry]) => flattenValue(entry, `${path}.${key}`, acc))
    return acc
  }

  acc[path] = value
  return acc
}

function assignPath(root: Record<string, JsonValue>, path: string, value: JsonValue): void {
  const normalized = path.replace(/^\$\./, '').replace(/^\$/, '')
  const segments = normalized.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean)

  if (segments.length === 0) {
    return
  }

  let current: Record<string, JsonValue> | JsonValue[] = root

  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1
    const nextSegment = segments[index + 1]
    const isIndex = /^\d+$/.test(segment)
    const nextIsIndex = /^\d+$/.test(nextSegment ?? '')

    if (Array.isArray(current)) {
      const numericIndex = Number(segment)
      if (isLast) {
        current[numericIndex] = value
        return
      }

      if (current[numericIndex] === undefined) {
        current[numericIndex] = nextIsIndex ? [] : {}
      }
      current = current[numericIndex] as Record<string, JsonValue> | JsonValue[]
      return
    }

    if (isLast) {
      current[segment] = value
      return
    }

    if (current[segment] === undefined) {
      current[segment] = (nextIsIndex ? [] : {}) as JsonValue
    }

    current = current[segment] as Record<string, JsonValue> | JsonValue[]

    if (isIndex) {
      current = current as JsonValue[]
    }
  })
}

export function formatJson(value: JsonValue): string {
  return JSON.stringify(value, null, 2)
}

export function minifyJson(value: JsonValue): string {
  return JSON.stringify(value)
}

export function sortKeys(value: JsonValue): string {
  return JSON.stringify(sortRecursively(value), null, 2)
}

export function stripNulls(value: JsonValue): string {
  return JSON.stringify(stripNullsRecursively(value) ?? null, null, 2)
}

export function stripEmpties(value: JsonValue): string {
  return JSON.stringify(stripEmptiesRecursively(value) ?? null, null, 2)
}

export function flattenJson(value: JsonValue): string {
  return JSON.stringify(flattenValue(value), null, 2)
}

export function unflattenJson(value: JsonValue): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return JSON.stringify(value, null, 2)
  }

  const root: Record<string, JsonValue> = {}
  Object.entries(value).forEach(([path, entry]) => assignPath(root, path, entry))
  return JSON.stringify(root, null, 2)
}
