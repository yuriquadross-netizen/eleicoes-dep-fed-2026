// Exportação CSV no formato do Excel em português: separador ";", vírgula decimal, UTF-8 com BOM.
export type Celula = string | number | null | undefined

function celula(v: Celula): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'number' ? String(v).replace('.', ',') : v
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** % como número com 2 casas (ex.: 35,52), pronto para somar no Excel. */
export const pctCsv = (x: number) => Math.round(x * 10000) / 100

export function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: Celula[][]) {
  const texto = [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.replace(/[^\w.-]+/g, '_')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
