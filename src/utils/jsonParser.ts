import type { DocumentStats, JsonValue, ParsedJsonDocument } from '../types'
import { extractParseError, repairJsonText } from './jsonRepair'

function isJsonContainer(value: JsonValue): value is JsonValue[] | Record<string, JsonValue> {
  return typeof value === 'object' && value !== null
}

function computeDepth(value: JsonValue, depth = 1): number {
  if (!isJsonContainer(value)) {
    return depth
  }

  const entries = Array.isArray(value) ? value : Object.values(value)
  if (entries.length === 0) {
    return depth
  }

  return Math.max(...entries.map((entry) => computeDepth(entry, depth + 1)))
}

function countNodes(value: JsonValue): number {
  if (!isJsonContainer(value)) {
    return 1
  }

  const entries: JsonValue[] = Array.isArray(value) ? value : (Object.values(value) as JsonValue[])
  return 1 + entries.reduce<number>((sum, entry) => sum + countNodes(entry), 0)
}

function makeStats(text: string, data: JsonValue | null): DocumentStats {
  if (!data) {
    return {
      bytes: new TextEncoder().encode(text).length,
      nodeCount: 0,
      depth: 0,
    }
  }

  return {
    bytes: new TextEncoder().encode(text).length,
    nodeCount: countNodes(data),
    depth: computeDepth(data),
  }
}

function parseStrict(text: string): JsonValue {
  return JSON.parse(text) as JsonValue
}

export function parseJsonDocument(text: string): ParsedJsonDocument {
  if (!text.trim()) {
    return {
      text,
      prettyText: '',
      data: null,
      error: null,
      repair: {
        repaired: false,
        fixes: 0,
        steps: [],
      },
      stats: makeStats(text, null),
    }
  }

  try {
    const data = parseStrict(text)
    return {
      text,
      prettyText: JSON.stringify(data, null, 2),
      data,
      error: null,
      repair: {
        repaired: false,
        fixes: 0,
        steps: [],
      },
      stats: makeStats(text, data),
    }
  } catch (error) {
    const repaired = repairJsonText(text)

    try {
      const data = parseStrict(repaired.text)
      return {
        text,
        prettyText: JSON.stringify(data, null, 2),
        data,
        error: null,
        repair: repaired.report,
        stats: makeStats(text, data),
      }
    } catch (repairError) {
      return {
        text,
        prettyText: text,
        data: null,
        error: extractParseError(repaired.text, repairError ?? error),
        repair: repaired.report,
        stats: makeStats(text, null),
      }
    }
  }
}
