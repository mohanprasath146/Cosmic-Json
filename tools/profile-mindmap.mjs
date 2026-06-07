import * as d3 from 'd3'

function makeSampleOrder(i) {
  return {
    order_id: `ORD-${1000 + i}`,
    customer: {
      id: `CUST-${String(i).padStart(4, '0')}`,
      name: `Customer ${i}`,
      email: `customer${i}@example.com`,
      address: {
        street: `${i} Example St`,
        city: `City${i % 100}`,
        zipcode: String(10000 + (i % 90000)),
        country: i % 2 === 0 ? 'USA' : 'UK'
      }
    },
    items: Array.from({ length: 3 }, (_, idx) => ({
      sku: `SKU-${i}-${idx}`,
      name: `Product ${idx}`,
      quantity: (idx % 5) + 1,
      unit_price: (Math.random() * 200).toFixed(2),
      details: { weight_kg: (Math.random() * 5).toFixed(2), color: ['Black','White','Blue'][idx%3] }
    })),
    order_date: new Date().toISOString(),
    status: ['processing','shipped','delivered'][i % 3],
    payment: { method: i % 2 === 0 ? 'card' : 'paypal', total_paid: (Math.random() * 2000).toFixed(2) },
    tags: i % 2 === 0 ? ['bulk'] : ['single']
  }
}

function toNode(val, name = 'root', path = '$') {
  if (val === null || typeof val !== 'object') {
    return { name: `${name}: ${String(val)}`, path, value: val }
  }
  if (Array.isArray(val)) {
    return { name, path, value: val, children: val.map((v, i) => toNode(v, `[${i}]`, `${path}[${i}]`)) }
  }
  return { name, path, value: val, children: Object.entries(val).map(([k, v]) => toNode(v, k, `${path}.${k}`)) }
}

async function profile(count = 1000) {
  console.log(`Generating sample with ${count} orders...`)
  const data = Array.from({ length: count }, (_, i) => makeSampleOrder(i))

  console.time('toNode')
  const rootData = toNode(data, 'root', '$')
  console.timeEnd('toNode')

  console.time('d3.hierarchy')
  const root = d3.hierarchy(rootData)
  console.timeEnd('d3.hierarchy')

  console.time('d3.tree')
  const tree = d3.tree().nodeSize([24, 160])
  tree(root)
  console.timeEnd('d3.tree')

  const nodes = root.descendants().length
  const links = root.links().length
  console.log(`Resulting nodes: ${nodes}, links: ${links}`)

  console.log('Memory usage (MB):', Object.fromEntries(Object.entries(process.memoryUsage()).map(([k,v])=>[k,Math.round(v/1024/1024)])))
}

const arg = parseInt(process.argv[2] || '1000', 10)
profile(isNaN(arg) ? 1000 : arg).catch(err => { console.error(err); process.exit(1) })
