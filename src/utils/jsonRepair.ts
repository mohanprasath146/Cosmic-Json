import type { ParseErrorInfo, RepairReport, RepairStep } from '../types'

interface RepairResult {
  text: string
  report: RepairReport
}

function replaceWithCount(
  text: string,
  label: string,
  pattern: RegExp,
  replacer: string | ((substring: string, ...args: string[]) => string),
): { text: string; step: RepairStep } {
  let count = 0
  const next = text.replace(pattern, (...args) => {
    count += 1
    return typeof replacer === 'string' ? replacer : replacer(args[0], ...(args.slice(1, -2) as string[]))
  })

  return { text: next, step: { label, count } }
}

function stripJsComments(input: string): { text: string; count: number } {
  let output = ''
  let count = 0
  let inString = false
  let quote = ''

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const next = input[index + 1]
    const prev = input[index - 1]

    if (inString) {
      output += char
      if (char === quote && prev !== '\\') {
        inString = false
      }
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      quote = char
      output += char
      continue
    }

    if (char === '/' && next === '/') {
      count += 1
      while (index < input.length && input[index] !== '\n') {
        index += 1
      }
      output += '\n'
      continue
    }

    if (char === '/' && next === '*') {
      count += 1
      index += 2
      while (index < input.length && !(input[index] === '*' && input[index + 1] === '/')) {
        index += 1
      }
      index += 1
      continue
    }

    output += char
  }

  return { text: output, count }
}

function closeMissingBrackets(input: string): { text: string; count: number } {
  const stack: string[] = []
  let inString = false
  let quote = ''

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const prev = input[index - 1]

    if (inString) {
      if (char === quote && prev !== '\\') {
        inString = false
      }
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      quote = char
      continue
    }

    if (char === '{') {
      stack.push('}')
    } else if (char === '[') {
      stack.push(']')
    } else if ((char === '}' || char === ']') && stack[stack.length - 1] === char) {
      stack.pop()
    }
  }

  return { text: input + stack.reverse().join(''), count: stack.length }
}

function replaceSingleQuotedStrings(input: string): { text: string; count: number } {
  let count = 0
  const next = input.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value: string) => {
    count += 1
    return JSON.stringify(value.replace(/\\'/g, "'"))
  })
  return { text: next, count }
}

export function repairJsonText(input: string): RepairResult {
  const steps: RepairStep[] = []
  let current = input

  const trailingCommas = replaceWithCount(
    current,
    'trailing commas',
    /,\s*([}\]])/g,
    '$1',
  )
  current = trailingCommas.text
  steps.push(trailingCommas.step)

  const unquotedKeys = replaceWithCount(
    current,
    'unquoted keys',
    /([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g,
    '$1"$2"$3',
  )
  current = unquotedKeys.text
  steps.push(unquotedKeys.step)

  const singleQuoted = replaceSingleQuotedStrings(current)
  current = singleQuoted.text
  steps.push({ label: 'single quotes', count: singleQuoted.count })

  const undefinedValues = replaceWithCount(current, 'undefined to null', /\bundefined\b/g, 'null')
  current = undefinedValues.text
  steps.push(undefinedValues.step)

  const pythonishValues = replaceWithCount(
    current,
    'True/False/None',
    /\bTrue\b|\bFalse\b|\bNone\b/g,
    (match) => {
      if (match === 'True') {
        return 'true'
      }
      if (match === 'False') {
        return 'false'
      }
      return 'null'
    },
  )
  current = pythonishValues.text
  steps.push(pythonishValues.step)

  const comments = stripJsComments(current)
  current = comments.text
  steps.push({ label: 'JS comments', count: comments.count })

  const unclosed = closeMissingBrackets(current)
  current = unclosed.text
  steps.push({ label: 'unclosed brackets', count: unclosed.count })

  const fixes = steps.reduce((sum, step) => sum + step.count, 0)
  return {
    text: current,
    report: {
      repaired: fixes > 0 && current !== input,
      fixes,
      steps: steps.filter((step) => step.count > 0),
    },
  }
}

function positionToLineColumn(text: string, position: number): { line: number; column: number } {
  const safePosition = Math.max(0, Math.min(position, text.length))
  const upto = text.slice(0, safePosition)
  const parts = upto.split('\n')
  return {
    line: parts.length,
    column: parts[parts.length - 1].length + 1,
  }
}

export function extractParseError(text: string, error: unknown): ParseErrorInfo {
  const message = error instanceof Error ? error.message : 'Unable to parse JSON'
  const positionMatch = message.match(/position\s+(\d+)/i)
  if (positionMatch) {
    const position = Number(positionMatch[1])
    const location = positionToLineColumn(text, position)
    return { message, position, ...location }
  }

  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i)
  if (lineColumnMatch) {
    const line = Number(lineColumnMatch[1])
    const column = Number(lineColumnMatch[2])
    const lines = text.split('\n')
    const position =
      lines.slice(0, Math.max(line - 1, 0)).reduce((sum, entry) => sum + entry.length + 1, 0) + column - 1
    return { message, line, column, position }
  }

  return {
    message,
    line: 1,
    column: 1,
    position: 0,
  }
}
