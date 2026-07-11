import { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import preprocessMath from '../utils/mathPreprocess'
import mermaid from 'mermaid'

/**
 * Mermaid v11 requires that the SVG element it creates has REAL layout in the DOM.
 * `display: none`, `visibility: hidden`, and even `opacity: 0` can all cause
 * `getBBox is not a function` or null-reference errors in D3's SVG calculations.
 *
 * Strategy: render into a truly-visible container that's placed off-screen, then
 * grab the SVG string and display it in our own container.
 */
function initMermaid(theme: 'light' | 'dark') {
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
    securityLevel: 'loose',
    themeVariables: { fontFamily: 'Inter, system-ui, sans-serif' },
  })
}

function MermaidDiagram({ chart, theme }: { chart: string; theme: 'light' | 'dark' }) {
  const [svgHtml, setSvgHtml] = useState<string>('')
  const [hasError, setHasError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const render = useCallback(async () => {
    const text = chart.replace(/\r\n/g, '\n').trim()
    if (!text) return

    initMermaid(theme)

    // Unique IDs for each render attempt
    const renderId = `mm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // We MUST have a container element that is:
    //  1. In the DOM
    //  2. Fully visible (not display:none, not visibility:hidden)
    //  3. Has real dimensions so getBBox works
    //
    // We create a wrapper positioned far off-screen but fully "rendered" by the browser.
    const wrapper = document.createElement('div')
    wrapper.style.cssText = 'position:fixed;left:-20000px;top:-20000px;width:1200px;height:800px;'
    document.body.appendChild(wrapper)

    try {
      // Let mermaid render into our off-screen wrapper.
      // Pass the wrapper as container so mermaid's SVG gets real layout dimensions.
      const { svg } = await mermaid.render(renderId, text, wrapper)
      setSvgHtml(svg)
      setHasError(false)
    } catch (err) {
      console.warn('Mermaid render error:', err)
      setHasError(true)
    } finally {
      // Clean up: remove the off-screen wrapper and any mermaid artifacts
      wrapper.remove()
      // Mermaid sometimes leaves behind elements with id "d" + renderId
      document.getElementById(renderId)?.remove()
      document.getElementById(`d${renderId}`)?.remove()
    }
  }, [chart, theme])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        await render()
      } catch {
        if (!cancelled) setHasError(true)
      }
    }

    // Small delay to ensure the React tree has settled and we're not in a render cycle
    const timer = setTimeout(() => {
      if (!cancelled) void run()
    }, 50)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [render])

  if (hasError) {
    return (
      <div style={{ border: '1px solid var(--border-default)', padding: 12, borderRadius: 8, background: 'rgba(255,0,0,0.05)', marginTop: 8 }}>
        <div style={{ color: 'var(--error)', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Diagram parsing error</div>
        <pre style={{ margin: 0, overflow: 'auto' }}><code>{chart}</code></pre>
      </div>
    )
  }

  if (!svgHtml) {
    return <div style={{ opacity: 0.5, fontSize: 12, padding: 8 }}>Rendering diagram…</div>
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-rendered-container"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        padding: 16,
        borderRadius: 8,
        margin: '12px 0',
        display: 'flex',
        justifyContent: 'center',
        overflowX: 'auto',
      }}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  )
}

const rehypeIgnoreMermaid = () => (tree: any) => {
  const visit = (node: any) => {
    if (node.type === 'element' && node.tagName === 'code') {
      const classes = node.properties?.className
      if (Array.isArray(classes) && classes.includes('language-mermaid')) {
        node.properties.className = [...classes, 'nohighlight', 'no-highlight']
      }
    }
    if (node.children) node.children.forEach(visit)
  }
  visit(tree)
}

export default function RichMarkdownViewer({ markdown, theme }: { markdown: string; theme: 'light' | 'dark' }) {
  return (
    <div className="markdown-preview" style={{ height: '100%', padding: 12, overflow: 'auto', flex: 1 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeIgnoreMermaid, rehypeHighlight as any, rehypeRaw as any]}
        components={{
          img({ node, ...props }) {
            return <img src={String(props.src)} alt={String(props.alt)} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }} />
          },
          // Override <pre> to handle fenced code blocks (including mermaid).
          // react-markdown v10 already wraps block code in <pre><code>, so we
          // intercept at the <pre> level to avoid nesting <pre> inside <pre>.
          pre({ node, children, ...props }: any) {
            // Find the child <code> element to check for mermaid
            const codeChild = node?.children?.find((c: any) => c.tagName === 'code')
            if (codeChild) {
              const classes = (codeChild.properties?.className || []) as string[]
              if (classes.includes('language-mermaid')) {
                // Extract text content from the code node
                const extractText = (n: any): string => {
                  if (n.type === 'text') return n.value || ''
                  if (n.children) return n.children.map(extractText).join('')
                  return ''
                }
                const chartText = extractText(codeChild)
                return <MermaidDiagram chart={chartText} theme={theme} />
              }
            }
            return <pre {...props}>{children}</pre>
          },
          // <code> renders as-is — no <pre> wrapper (the parent <pre> handles that)
          code({ className, children, ...props }: any) {
            return <code className={className} {...props}>{children}</code>
          },
        }}
      >
        {preprocessMath(markdown)}
      </ReactMarkdown>
    </div>
  )
}
