// Hemiciclo: um ponto por cadeira, em fileiras concêntricas, preenchido da esquerda para a direita.
// Grupos na ordem Esquerda → Centro → Direita; cor = campo (D18). Passar o mouse num assento
// destaca o partido inteiro e mostra o parlamentar.
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Classe } from '../dados'

export interface Assento {
  sq: number
  nome: string
  partido: string
  uf: string
  classe: Classe | null
  /** marca visual extra (ex.: suplente em exercício no Senado) */
  destaque?: string
}

const ORDEM_CAMPO: (Classe | null)[] = ['Esquerda', 'Centro', 'Direita', null]
const COR: Record<string, string> = { Direita: 'var(--direita)', Centro: 'var(--centro)', Esquerda: 'var(--esquerda)' }
const L = 640
const R_MIN = 0.4 // raio da fileira interna, em fração do raio externo

/** Posições (x, y em unidades do raio externo) de n assentos, já em ordem da esquerda para a direita. */
function posicoes(n: number): { pts: { x: number; y: number }[]; raio: number } {
  // n ≈ π·Σr/d com d = (1−R_MIN)/(fileiras−1) e Σr = fileiras·(1+R_MIN)/2  ⇒  f(f−1) ≈ n·(1−R_MIN)/(π·(1+R_MIN)/2)
  const alvo = (n * (1 - R_MIN)) / ((Math.PI * (1 + R_MIN)) / 2)
  const fileiras = Math.max(2, Math.round((1 + Math.sqrt(1 + 4 * alvo)) / 2))
  const raios = Array.from({ length: fileiras }, (_, i) => R_MIN + ((1 - R_MIN) * i) / (fileiras - 1))
  const soma = raios.reduce((a, b) => a + b, 0)
  const porFileira = raios.map((r) => Math.floor((n * r) / soma))
  // distribui a sobra pelas fileiras externas (mais compridas)
  for (let i = fileiras - 1, falta = n - porFileira.reduce((a, b) => a + b, 0); falta > 0; i = (i - 1 + fileiras) % fileiras, falta--) {
    porFileira[i]++
  }
  const todos: { x: number; y: number; ang: number; r: number }[] = []
  raios.forEach((r, i) => {
    const k = porFileira[i]
    for (let j = 0; j < k; j++) {
      const ang = k === 1 ? Math.PI / 2 : Math.PI * (1 - j / (k - 1))
      todos.push({ x: r * Math.cos(ang), y: r * Math.sin(ang), ang, r })
    }
  })
  // da esquerda (ângulo π) para a direita (0); no mesmo ângulo, de dentro para fora
  todos.sort((a, b) => b.ang - a.ang || a.r - b.r)
  // raio do assento: 45% do menor espaçamento (entre fileiras ou entre vizinhos numa fileira)
  const entreFileiras = (1 - R_MIN) / (fileiras - 1)
  const naFileira = Math.min(...raios.map((r, i) => (porFileira[i] > 1 ? (Math.PI * r) / (porFileira[i] - 1) : 1)))
  return { pts: todos, raio: 0.45 * Math.min(entreFileiras, naFileira) }
}

/** Ordena os assentos: campo (E → C → D), partido (o maior fica na ponta externa do campo), UF, nome. */
function ordenar(assentos: Assento[]): Assento[] {
  const tamanho = new Map<string, number>()
  for (const a of assentos) tamanho.set(`${a.classe}|${a.partido}`, (tamanho.get(`${a.classe}|${a.partido}`) ?? 0) + 1)
  return [...assentos].sort((a, b) => {
    const ca = ORDEM_CAMPO.indexOf(a.classe)
    const cb = ORDEM_CAMPO.indexOf(b.classe)
    if (ca !== cb) return ca - cb
    if (a.partido !== b.partido) {
      const ta = tamanho.get(`${a.classe}|${a.partido}`)!
      const tb = tamanho.get(`${b.classe}|${b.partido}`)!
      // Esquerda: maior primeiro (na ponta esquerda); Direita: maior por último (na ponta direita)
      const sinal = a.classe === 'Direita' ? 1 : -1
      return ta !== tb ? sinal * (ta - tb) : a.partido.localeCompare(b.partido)
    }
    return a.uf.localeCompare(b.uf) || a.nome.localeCompare(b.nome)
  })
}

export default function Hemiciclo({ assentos, rotulo }: { assentos: Assento[]; rotulo: string }) {
  const navegar = useNavigate()
  const caixa = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const ordenados = useMemo(() => ordenar(assentos), [assentos])
  const { pts, raio } = useMemo(() => posicoes(assentos.length), [assentos.length])
  const escala = L / 2 - 8
  const margem = raio * escala + 3 // espaço para o assento inteiro da fileira de baixo
  const A = escala + 2 * margem
  const cx = L / 2
  const h = hover ? ordenados[hover.i] : null
  const contagem = ORDEM_CAMPO.filter(Boolean).map((c) => ({
    c: c as Classe,
    n: assentos.filter((a) => a.classe === c).length,
  }))

  return (
    <figure className="mapa hemiciclo">
      <div className="mapa-caixa" ref={caixa} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={rotulo}>
          {pts.map((p, i) => {
            const a = ordenados[i]
            const apagado = h && h.partido !== a.partido
            return (
              <circle
                key={a.sq}
                cx={cx + p.x * escala}
                cy={A - margem - p.y * escala}
                r={raio * escala}
                fill={a.classe ? COR[a.classe] : 'var(--tinta-3)'}
                className={`assento${apagado ? ' apagado' : ''}${a.destaque ? ' marcado' : ''}`}
                onMouseMove={(e) => {
                  const r = caixa.current!.getBoundingClientRect()
                  setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top })
                }}
                onClick={() => navegar(`/candidato/${a.sq}`)}
              />
            )
          })}
          <text x={cx} y={A - margem - 4} textAnchor="middle" className="hemiciclo-total">
            {assentos.length}
          </text>
        </svg>
        {h && hover && (
          <div className="tooltip" style={{ left: Math.min(hover.x + 14, (caixa.current?.clientWidth ?? 600) - 230), top: hover.y + 14 }}>
            <strong>{h.nome}</strong>
            <span>
              {h.partido} · {h.uf} <b>{h.classe ?? '—'}</b>
            </span>
            <span>
              Bancada do {h.partido} <b>{ordenados.filter((x) => x.partido === h.partido).length}</b>
            </span>
            {h.destaque && <span>{h.destaque}</span>}
          </div>
        )}
      </div>
      <figcaption className="legenda-mapa hemiciclo-legenda">
        <span className="ideo-rotulos">
          {contagem.map(({ c, n }) => (
            <span key={c}>
              <i style={{ background: COR[c] }} /> {c} <b>{n}</b> ({Math.round((n / assentos.length) * 100)}%)
            </span>
          ))}
        </span>
        <span className="legenda-titulo">Passe o mouse para ver o parlamentar e destacar o partido; clique para abrir o perfil.</span>
      </figcaption>
    </figure>
  )
}
