// Dispersão dos eleitos da UF: concentração (x) × dominância (y), quadrantes pela mediana dos eleitos.
// Cor = campo ideológico (verde/amarelo/vermelho). Pontos de 9 px com anel da cor da superfície.
import { scaleLinear } from 'd3-scale'
import { useRef, useState } from 'react'

import { TIPO_BASE, type DadosUF, type TipoBase } from '../dados'
import { pct } from '../formato'
import { useNavegarC } from './LinkC'

const L = 640
const A = 420
const M = { e: 52, d: 16, t: 28, b: 44 }
const COR: Record<string, string> = { Direita: 'var(--direita)', Centro: 'var(--centro)', Esquerda: 'var(--esquerda)' }
const QUADRANTES: [TipoBase, 'e' | 'd', 't' | 'b'][] = [
  ['dispersa-dominante', 'e', 't'],
  ['concentrada-dominante', 'd', 't'],
  ['dispersa-compartilhada', 'e', 'b'],
  ['concentrada-compartilhada', 'd', 'b'],
]

export default function DispersaoTipologia({ tip }: { tip: NonNullable<DadosUF['tipologia']> }) {
  const navegar = useNavegarC()
  const caixa = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  const pts = tip.eleitos
  const maxD = Math.max(0.05, ...pts.map((p) => p[5])) * 1.08
  const x = scaleLinear().domain([0, 1]).range([M.e, L - M.d])
  const y = scaleLinear().domain([0, maxD]).range([A - M.b, M.t]).nice()
  const mx = x(tip.mediana_concentracao)
  const my = y(tip.mediana_dominancia)
  const h = hover ? pts[hover.i] : null

  return (
    <figure className="mapa dispersao">
      <div className="mapa-caixa" ref={caixa} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Concentração e dominância da base dos eleitos">
          {/* grade e eixos recessivos */}
          {y.ticks(5).map((t) => (
            <g key={t}>
              <line x1={M.e} x2={L - M.d} y1={y(t)} y2={y(t)} className="grade" />
              <text x={M.e - 6} y={y(t)} className="eixo" textAnchor="end" dominantBaseline="middle">
                {pct(t, 0)}
              </text>
            </g>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <text key={t} x={x(t)} y={A - M.b + 16} className="eixo" textAnchor="middle">
              {pct(t, 0)}
            </text>
          ))}
          <text x={(M.e + L - M.d) / 2} y={A - 6} className="eixo-titulo" textAnchor="middle">
            Concentração da votação →
          </text>
          <text x={14} y={(M.t + A - M.b) / 2} className="eixo-titulo" textAnchor="middle"
            transform={`rotate(-90 14 ${(M.t + A - M.b) / 2})`}>
            Dominância →
          </text>
          {/* medianas que separam os tipos */}
          <line x1={mx} x2={mx} y1={M.t} y2={A - M.b} className="mediana" />
          <line x1={M.e} x2={L - M.d} y1={my} y2={my} className="mediana" />
          {QUADRANTES.map(([tipo, lado, alto]) => {
            const xq = lado === 'e' ? M.e + 6 : L - M.d - 6
            const [primeira, ...resto] = TIPO_BASE[tipo].nome.split(' ')
            // em cima cabe numa linha (margem); embaixo, duas linhas logo abaixo da mediana
            return alto === 't' ? (
              <text key={tipo} className="quadrante" x={xq} y={M.t - 10} textAnchor={lado === 'e' ? 'start' : 'end'}>
                {TIPO_BASE[tipo].nome}
              </text>
            ) : (
              <text key={tipo} className="quadrante" x={xq} y={my + 15} textAnchor={lado === 'e' ? 'start' : 'end'}>
                <tspan x={xq}>{primeira}</tspan>
                <tspan x={xq} dy={13}>{resto.join(' ')}</tspan>
              </text>
            )
          })}
          {pts.map((p, i) => (
            <circle key={p[0]} cx={x(p[4])} cy={y(p[5])} r={hover?.i === i ? 7 : 5.5}
              fill={p[3] ? COR[p[3]] : 'var(--tinta-3)'} className="ponto"
              onMouseMove={(e) => {
                const r = caixa.current!.getBoundingClientRect()
                setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top })
              }}
              onClick={() => navegar(`/candidato/${p[0]}`)} />
          ))}
        </svg>
        {h && hover && (
          <div className="tooltip" style={{ left: Math.min(hover.x + 14, (caixa.current?.clientWidth ?? 600) - 230), top: hover.y + 14 }}>
            <strong>{h[1]}</strong>
            <span>Partido <b>{h[2]}</b></span>
            <span>Concentração <b>{pct(h[4], 0)}</b></span>
            <span>Dominância <b>{pct(h[5], 1)}</b></span>
            <span><b>{TIPO_BASE[h[6]].nome}</b></span>
          </div>
        )}
      </div>
      <figcaption className="legenda-mapa">
        <span className="ideo-rotulos">
          {Object.entries(COR).map(([c, cor]) => (
            <span key={c}><i style={{ background: cor }} /> {c}</span>
          ))}
        </span>
        <span className="legenda-titulo">
          Cada ponto é um eleito; clique para abrir o perfil. As linhas tracejadas marcam as medianas dos eleitos da UF.
        </span>
      </figcaption>
    </figure>
  )
}
