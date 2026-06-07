import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export default function MindmapInteractive({ data, onNodeSelect, onApiReady }: { data: any; onNodeSelect?: (info: { path: string; value: any }) => void; onApiReady?: (api: any) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // ensure internal counter exists
    if (!(MindmapInteractive as any)._id) (MindmapInteractive as any)._id = 0
    const container = containerRef.current
    if (!container) return
    // remove only any prior svg we added (avoid clobbering React-managed nodes)
    try { d3.select(container).select('svg').remove() } catch {}

    let vw = container.clientWidth || 800
    let vh = container.clientHeight || 600

    const svg = d3.select(container).append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${vw} ${vh}`)
      .style('font-family', "'DM Mono', monospace")

    const g = svg.append('g')

    // convert JSON to hierarchy with path tracking
    function toNode(val: any, name = 'root', path = '$'): any {
      if (val === null || typeof val !== 'object') {
        return { name: `${name}: ${String(val)}`, path, value: val }
      }
      if (Array.isArray(val)) {
        return { name, path, value: val, children: val.map((v, i) => toNode(v, `[${i}]`, `${path}[${i}]`)) }
      }
      return { name, path, value: val, children: Object.entries(val).map(([k, v]) => toNode(v, k, `${path}.${k}`)) }
    }

    const rootData = toNode(data, 'root', '$')
    const root = d3.hierarchy(rootData)

    const tree = d3.tree().nodeSize([24, 160])
    tree(root)

    // create groups for links/nodes so we can update via joins
    const linkGroup = g.append('g').attr('class', 'links')
    const nodeGroup = g.append('g').attr('class', 'nodes')

    const TRANSITION_THRESHOLD = 600 // if too many nodes, skip transitions

    function keyForNode(d: any) {
      return (d && d.data && d.data.path) || JSON.stringify(d && d.data)
    }

    function updateView(animate = true) {
      tree(root)
      const links = root.links()
      const nodes = root.descendants()

      const useTransition = animate && nodes.length <= TRANSITION_THRESHOLD

      // LINKS: join by target path
      const linkSel = linkGroup.selectAll('path.link').data(links, (d: any) => keyForNode(d.target))
      linkSel.exit().remove()
      const linkEnter = linkSel.enter().append('path').attr('class', 'link').attr('fill', 'none')
        .attr('stroke', 'rgba(200,200,200,0.18)').attr('stroke-width', 1.0)
      const linkMerged = linkEnter.merge(linkSel as any)
      if (useTransition) linkMerged.transition().duration( animate ? 300 : 0 ).attr('d', d3.linkHorizontal().x((d: any) => d.y).y((d: any) => d.x) as any)
      else linkMerged.attr('d', d3.linkHorizontal().x((d: any) => d.y).y((d: any) => d.x) as any)

      // NODES: join by node path
      const nodeSel = nodeGroup.selectAll('g.node').data(nodes, (d: any) => keyForNode(d))
      nodeSel.exit().remove()

      const nodeEnter = nodeSel.enter().append('g').attr('class', (d: any) => `node depth-${d.depth}`)
      nodeEnter.append('circle').attr('r', 6).attr('fill', '#222').attr('stroke', 'var(--border-default)')
      nodeEnter.append('text')
        .attr('dy', '0.31em')
        .attr('x', (d: any) => d.children ? -10 : 10)
        .attr('text-anchor', (d: any) => d.children ? 'end' : 'start')
        .style('font-size', 12)
        .style('fill', 'var(--text-primary)')
        .text((d: any) => String(d.data.name))

      const nodeMerged = nodeEnter.merge(nodeSel as any)
      if (useTransition) nodeMerged.transition().duration( animate ? 300 : 0 ).attr('transform', (d: any) => `translate(${d.y}, ${d.x})`)
      else nodeMerged.attr('transform', (d: any) => `translate(${d.y}, ${d.x})`)

      // reattach click handler for enters
      nodeGroup.selectAll('g.node').on('click', function (event: any, d: any) {
        void event
        if (d.children) {
          d._children = d.children
          d.children = null
        } else if (d._children) {
          d.children = d._children
          d._children = null
        }
        updateView(nodes.length <= TRANSITION_THRESHOLD)
        try { if (onNodeSelect) onNodeSelect({ path: d.data.path, value: d.data.value }) } catch {}
      })
    }

    // center on root (will update on resize)
    let initialX = (vh / 4)
    let initialY = 40
    g.attr('transform', `translate(${initialY}, ${initialX})`)

    // zoom/pan
    const zoom = d3.zoom().on('zoom', (event: any) => {
      g.attr('transform', event.transform)
    })
    svg.call(zoom as any)

    // expose controls
    const api = {
      zoomIn: () => {
        svg.transition().call(zoom.scaleBy as any, 1.2)
      },
      zoomOut: () => {
        svg.transition().call(zoom.scaleBy as any, 0.8)
      },
      reset: () => {
        svg.transition().duration(400).call(zoom.transform as any, d3.zoomIdentity.translate(initialY, initialX).scale(1))
      },
    }

    ;(MindmapInteractive as any)._api = api
    try {
      if (onApiReady) onApiReady(api)
    } catch {}

    // initial render
    updateView(false)

    // resize handling: update viewBox and recenter
    const ro = new ResizeObserver(() => {
      try {
        vw = container.clientWidth || 800
        vh = container.clientHeight || 600
        svg.attr('viewBox', `0 0 ${vw} ${vh}`)
        initialX = (vh / 4)
        // reposition base group; preserve current zoom transform if present
        const t = d3.zoomTransform(svg.node() as any)
        g.attr('transform', t.toString())
      } catch (e) {
        // ignore
      }
    })
    try { ro.observe(container) } catch {}

    return () => {
      try { ro.disconnect() } catch {}
      try { svg.remove() } catch {}
    }
  }, [data])

  return (
    <div style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 0 }} />
    </div>
  )
}
