// Gera os ícones do app (Dock / manifest) a partir de um SVG. Uso: node scripts/icones.cjs
const { chromium } = require('playwright')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1c2a3a"/>
  <g fill="#d2b06a">
    <rect x="112" y="300" width="56" height="112" rx="6"/>
    <rect x="196" y="236" width="56" height="176" rx="6"/>
    <rect x="280" y="164" width="56" height="248" rx="6"/>
    <rect x="364" y="100" width="56" height="312" rx="6" opacity=".55"/>
  </g>
  <rect x="96" y="424" width="340" height="10" rx="5" fill="#f7f5f0"/>
</svg>`
;(async () => {
const b = await chromium.launch()
const p = await b.newPage()
for (const [nome, t] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
  await p.setViewportSize({ width: t, height: t })
  await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${t}" height="${t}" `)}</body></html>`)
  await p.screenshot({ path: `public/${nome}` })
}
await b.close()
console.log('ícones gerados em public/')
})()
