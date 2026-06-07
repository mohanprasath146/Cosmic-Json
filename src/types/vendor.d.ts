declare module 'jsondiffpatch/lib/formatters/jsonpatch.js' {
  export function format(delta: unknown): Array<Record<string, unknown>>
}
