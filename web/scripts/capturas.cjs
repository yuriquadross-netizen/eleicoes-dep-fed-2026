// Capturas de tela das rotas principais para verificação visual.
// Uso: npm run build && npx vite preview --port 4173 &  node scripts/capturas.cjs [rota ...]
const { chromium } = require('playwright')
const fs = require('fs')
const base = process.env.BASE_URL || 'http://localhost:4173/'
const rotas = process.argv.slice(2).length ? process.argv.slice(2) : ['#/']
;(async () => {
  fs.mkdirSync('screenshots', { recursive: true })
  const b = await chromium.launch()
  for (const esquema of ['light', 'dark']) {
    const p = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: esquema })
    const erros = []
    p.on('pageerror', (e) => erros.push(e.message))
    p.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
    for (const r of rotas) {
      await p.goto(base + r)
      await p.waitForLoadState('networkidle')
      const nome = `screenshots/${esquema}-${r.replace(/[^a-z0-9]+/gi, '_') || 'home'}.png`
      await p.screenshot({ path: nome, fullPage: true })
      console.log(nome)
    }
    if (erros.length) console.log('ERROS:', erros)
    await p.close()
  }
  await b.close()
})()
