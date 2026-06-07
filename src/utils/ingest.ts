import { XMLParser } from 'fast-xml-parser'
import Papa from 'papaparse'
import YAML from 'yaml'
import type { JsonValue } from '../types'

function stringify(data: JsonValue): string {
  return JSON.stringify(data, null, 2)
}

export async function ingestFile(file: File): Promise<string> {
  const text = await file.text()
  const lower = file.name.toLowerCase()

  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return stringify(YAML.parse(text) as JsonValue)
  }

  if (lower.endsWith('.xml')) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@',
    })
    return stringify(parser.parse(text) as JsonValue)
  }

  if (lower.endsWith('.csv')) {
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    })
    return stringify(parsed.data as unknown as JsonValue)
  }

  return text
}
