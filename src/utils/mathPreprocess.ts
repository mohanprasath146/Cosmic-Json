import katex from 'katex'

function renderDisplay(math: string) {
  try {
    return katex.renderToString(math, { displayMode: true })
  } catch (e) {
    return `<pre class="katex-error">${String(math).replace(/</g, '&lt;')}</pre>`
  }
}

function renderInline(math: string) {
  try {
    return katex.renderToString(math, { displayMode: false })
  } catch (e) {
    return `<code class="katex-error">${String(math).replace(/</g, '&lt;')}</code>`
  }
}

export function preprocessMath(markdown: string) {
  if (!markdown) return markdown

  // render display math first ($$...$$)
  let out = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
    return `\n\n${renderDisplay(expr)}\n\n`
  })

  // render inline math $...$ (avoid $$ which are already handled)
  out = out.replace(/(^|[^$])\$([^\n$]+?)\$(?!\$)/g, (m, p1, expr) => {
    return `${p1}${renderInline(expr)}`
  })

  return out
}

export default preprocessMath
