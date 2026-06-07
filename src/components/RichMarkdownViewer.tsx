import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import preprocessMath from '../utils/mathPreprocess'
import mermaid from 'mermaid'

export default function RichMarkdownViewer({ markdown, theme }: { markdown: string; theme: 'light' | 'dark' }) {
  const previewRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: theme === 'dark' ? 'dark' : 'default', securityLevel: 'loose' })
  }, [theme])

  // re-render mermaid diagrams after markdown or HTML updates
  useEffect(() => {
    const container = previewRef.current
    if (!container) return
    const diagrams = container.querySelectorAll('code.language-mermaid')
    diagrams.forEach((block, i) => {
      const code = block.textContent || ''
      const id = `mermaid-${i}-${Math.random().toString(36).slice(2)}`
      const wrapper = document.createElement('div')
      try {
        void mermaid.render(id, code).then((res) => {
          wrapper.innerHTML = res.svg
        }).catch(() => {
          wrapper.textContent = code
        })
      } catch (e) {
        wrapper.textContent = code
      }
      const pre = block.closest('pre')
      if (pre && pre.parentElement) {
        pre.parentElement.replaceChild(wrapper, pre)
      }
    })
  }, [markdown, theme])

  return (
    <div ref={previewRef} className="markdown-preview" style={{ height: '100%', padding: 12, overflow: 'auto', flex: 1 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight as any, rehypeRaw as any]}
        components={{
          img({ node, ...props }) {
            return <img src={String(props.src)} alt={String(props.alt)} style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }} />
          },
          code(props: any) {
            const { inline, className, children } = props
            const language = (className || '').replace('language-', '')
            if (language === 'mermaid') {
              return <pre><code className={className}>{String(children)}</code></pre>
            }
            if (inline) return <code>{children}</code>
            return <pre><code className={className}>{children}</code></pre>
          },
        }}
      >
        {preprocessMath(markdown)}
      </ReactMarkdown>
    </div>
  )
}
