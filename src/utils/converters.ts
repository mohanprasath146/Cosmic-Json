import { XMLBuilder } from 'fast-xml-parser'
import Papa from 'papaparse'
import YAML from 'yaml'
import type { ConverterResult, JsonValue } from '../types'

function toPascalCase(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function detectArrayItem(value: JsonValue[]): JsonValue | undefined {
  return value.find((entry) => entry !== null)
}

function tsTypeFor(value: JsonValue, name: string, declarations: string[]): string {
  if (Array.isArray(value)) {
    const item = detectArrayItem(value)
    return `${item ? tsTypeFor(item, `${name}Item`, declarations) : 'unknown'}[]`
  }
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'string') {
    return 'string'
  }
  if (typeof value === 'number') {
    return 'number'
  }
  if (typeof value === 'boolean') {
    return 'boolean'
  }

  const interfaceName = toPascalCase(name || 'Root')
  const lines = Object.entries(value).map(([key, entry]) => `  ${JSON.stringify(key)}: ${tsTypeFor(entry, `${interfaceName}${toPascalCase(key)}`, declarations)};`)
  declarations.push(`export interface ${interfaceName} {\n${lines.join('\n')}\n}`)
  return interfaceName
}

function pythonTypeFor(value: JsonValue, name: string, declarations: string[]): string {
  if (Array.isArray(value)) {
    const item = detectArrayItem(value)
    return `list[${item ? pythonTypeFor(item, `${name}Item`, declarations) : 'Any'}]`
  }
  if (value === null) {
    return 'None'
  }
  if (typeof value === 'string') {
    return 'str'
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'int' : 'float'
  }
  if (typeof value === 'boolean') {
    return 'bool'
  }

  const interfaceName = toPascalCase(name || 'Root')
  const lines = Object.entries(value).map(([key, entry]) => `    ${JSON.stringify(key)}: ${pythonTypeFor(entry, `${interfaceName}${toPascalCase(key)}`, declarations)}`)
  declarations.push(`class ${interfaceName}(TypedDict):\n${lines.join('\n') || '    pass'}`)
  return interfaceName
}

function goTypeFor(value: JsonValue, name: string, declarations: string[]): string {
  if (Array.isArray(value)) {
    const item = detectArrayItem(value)
    return `[]${item ? goTypeFor(item, `${name}Item`, declarations) : 'interface{}'}`
  }
  if (value === null) {
    return 'interface{}'
  }
  if (typeof value === 'string') {
    return 'string'
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'int' : 'float64'
  }
  if (typeof value === 'boolean') {
    return 'bool'
  }

  const structName = toPascalCase(name || 'Root')
  const lines = Object.entries(value).map(
    ([key, entry]) => `  ${toPascalCase(key)} ${goTypeFor(entry, `${structName}${toPascalCase(key)}`, declarations)} \`json:"${key}"\``,
  )
  declarations.push(`type ${structName} struct {\n${lines.join('\n')}\n}`)
  return structName
}

function arrayOfObjects(value: JsonValue): Array<Record<string, JsonValue>> | null {
  if (!Array.isArray(value)) {
    return null
  }
  if (value.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
    return null
  }
  return value as Array<Record<string, JsonValue>>
}

function toSqlLiteral(value: JsonValue): string {
  if (value === null) {
    return 'NULL'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE'
  }
  return `'${String(value).replace(/'/g, "''")}'`
}

export function convertJson(value: JsonValue, target: string): ConverterResult {
  if (target === 'yaml') {
    return {
      title: 'YAML',
      language: 'yaml',
      mimeType: 'text/yaml;charset=utf-8',
      extension: 'yaml',
      output: YAML.stringify(value),
    }
  }

  if (target === 'xml') {
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
    })
    return {
      title: 'XML',
      language: 'xml',
      mimeType: 'application/xml;charset=utf-8',
      extension: 'xml',
      output: builder.build({ root: value }),
    }
  }

  if (target === 'csv') {
    const rows = arrayOfObjects(value)
    return {
      title: 'CSV',
      language: 'plaintext',
      mimeType: 'text/csv;charset=utf-8',
      extension: 'csv',
      output: rows ? Papa.unparse(rows) : 'CSV conversion expects an array of objects.',
    }
  }

  if (target === 'sql') {
    const rows = arrayOfObjects(value)
    if (!rows || rows.length === 0) {
      return {
        title: 'SQL INSERT',
        language: 'sql',
        mimeType: 'text/sql;charset=utf-8',
        extension: 'sql',
        output: '-- SQL conversion expects a non-empty array of objects.',
      }
    }
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
    const values = rows
      .map((row) => `(${columns.map((column) => toSqlLiteral(row[column] ?? null)).join(', ')})`)
      .join(',\n')
    return {
      title: 'SQL INSERT',
      language: 'sql',
      mimeType: 'text/sql;charset=utf-8',
      extension: 'sql',
      output: `INSERT INTO records (${columns.join(', ')})\nVALUES\n${values};`,
    }
  }

  if (target === 'markdown-table') {
    const rows = arrayOfObjects(value)
    if (!rows || rows.length === 0) {
      return {
        title: 'Markdown Table',
        language: 'markdown',
        mimeType: 'text/markdown;charset=utf-8',
        extension: 'md',
        output: 'Markdown table conversion expects a non-empty array of objects.',
      }
    }
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
    const header = `| ${columns.join(' | ')} |`
    const divider = `| ${columns.map(() => '---').join(' | ')} |`
    const body = rows.map((row) => `| ${columns.map((column) => String(row[column] ?? '')).join(' | ')} |`).join('\n')
    return {
      title: 'Markdown Table',
      language: 'markdown',
      mimeType: 'text/markdown;charset=utf-8',
      extension: 'md',
      output: `${header}\n${divider}\n${body}`,
    }
  }

  if (target === 'ts') {
    const declarations: string[] = []
    const root = tsTypeFor(value, 'Root', declarations)
    return {
      title: 'TypeScript Interface',
      language: 'typescript',
      mimeType: 'text/typescript;charset=utf-8',
      extension: 'ts',
      output: [...new Set(declarations.reverse()), `export type RootDocument = ${root}`].join('\n\n'),
    }
  }

  if (target === 'python') {
    const declarations: string[] = []
    const root = pythonTypeFor(value, 'Root', declarations)
    return {
      title: 'Python TypedDict',
      language: 'python',
      mimeType: 'text/x-python;charset=utf-8',
      extension: 'py',
      output: `from typing import Any, TypedDict\n\n${[...new Set(declarations.reverse())].join('\n\n')}\n\nRootDocument = ${root}\n`,
    }
  }

  if (target === 'go') {
    const declarations: string[] = []
    const root = goTypeFor(value, 'Root', declarations)
    return {
      title: 'Go Struct',
      language: 'go',
      mimeType: 'text/x-go;charset=utf-8',
      extension: 'go',
      output: `package main\n\n${[...new Set(declarations.reverse())].join('\n\n')}\n\ntype RootDocument = ${root}\n`,
    }
  }

  return {
    title: 'JSON',
    language: 'json',
    mimeType: 'application/json;charset=utf-8',
    extension: 'json',
    output: JSON.stringify(value, null, 2),
  }
}

export const CONVERTER_OPTIONS = [
  { id: 'yaml', label: 'YAML' },
  { id: 'xml', label: 'XML' },
  { id: 'csv', label: 'CSV' },
  { id: 'sql', label: 'SQL INSERT' },
  { id: 'markdown-table', label: 'Markdown table' },
  { id: 'ts', label: 'TypeScript interface' },
  { id: 'python', label: 'Python TypedDict' },
  { id: 'go', label: 'Go struct' },
] as const
