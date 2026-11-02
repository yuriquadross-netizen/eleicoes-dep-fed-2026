// Mapa coroplético de uma UF (SVG + d3-geo). Não busca dados: recebe tudo por props.
import { geoMercator, geoPath } from 'd3-geo'
import { scaleQuantile } from 'd3-scale'
import { useMemo, useRef, useState } from 'react'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { Nivel } from '../dados'

export const N_CLASSES = 7

export interface ItemMapa {
  nome: string
  valor: number
  /** linhas extras do tooltip: [rótulo, valor formatado] */
  detalhes: [string, string][]
}

interface Props {
  topo: Topology
  camada: Nivel
  itens: Map<number, ItemMapa>
  formatar: (v: number) => string
  tituloLegenda: string
  selecionado?: number | null
  aoSelecionar?: (id: number) => void
  /** id da região a destacar com contorno (ex.: mini-mapa de uma micro) */
  destaque?: number
  altura?: number
  /** esconde a legenda (mapa só de localização) */
  semLegenda?: boolean
  /** escala de cor: azul (padrão, votos) ou verde/amarelo/vermelho (Direita/Centro/Esquerda) */
  rampa?: 'verde' | 'amarelo' | 'vermelho'
}

const LARGURA = 640

export default function MapaUF({
  topo, camada, itens, formatar, tituloLegenda, selecionado, aoSelecionar, destaque, altura = 520, semLegenda, rampa,
}: Props) {
  const cor = (k: number) => (rampa ? `var(--seq-${rampa}-${k})` : `var(--seq-${k})`)
  const [hover, setHover] = useState<{ id: number; x: number; y: number } | null>(null)
  const caixa = useRef<HTMLDivElement>(null)

  const formas = useMemo(() => {
    const obj = topo.objects[camada] as GeometryCollection
    const fc = feature(topo, obj)
    const proj = geoMercator().fitSize([LARGURA, altura], fc)
    const caminho = geoPath(proj)
    const idCampo = camada === 'mun' ? 'cd_ibge' : `${camada}_id`
    return fc.features.map((f) => ({
      id: Number((f.properties as Record<string, unknown>)[idCampo]),
      d: caminho(f) ?? '',
    }))
  }, [topo, camada, altura])

  const escala = useMemo(() => {
    const vals = [...itens.values()].map((i) => i.valor).filter((v) => v > 0)
    return scaleQuantile<number>().domain(vals).range([...Array(N_CLASSES).keys()])
  }, [itens])
  const limites = escala.quantiles()
  const dom = escala.domain()
  const minimo = dom.length ? Math.min(...dom) : 0
  const maximo = dom.length ? Math.max(...dom) : 0

  const classe = (id: number) => {
    const v = itens.get(id)?.valor ?? 0
    return v > 0 ? cor(escala(v)) : 'var(--sem-voto)'
  }

  const itemHover = hover ? itens.get(hover.id) : undefined

  return (
    <figure className="mapa">
      <div className="mapa-caixa" ref={caixa} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${LARGURA} ${altura}`} role="img" aria-label={tituloLegenda}>
          <g>
            {formas.map((f) => (
              <path
                key={f.id}
                d={f.d}
                fill={classe(f.id)}
                className={`forma${aoSelecionar ? ' clicavel' : ''}`}
                onMouseMove={(e) => {
                  const r = caixa.current!.getBoundingClientRect()
                  setHover({ id: f.id, x: e.clientX - r.left, y: e.clientY - r.top })
                }}
                onClick={() => aoSelecionar?.(f.id)}
              />
            ))}
          </g>
          {/* contornos por cima: destaque, seleção e hover */}
          {formas
            .filter((f) => f.id === destaque || f.id === selecionado || f.id === hover?.id)
            .map((f) => (
              <path
                key={`c${f.id}`}
                d={f.d}
                className={f.id === hover?.id ? 'contorno hover' : 'contorno'}
                pointerEvents="none"
              />
            ))}
        </svg>
        {hover && (
          <div
            className="tooltip"
            style={{
              left: Math.min(hover.x + 14, (caixa.current?.clientWidth ?? 600) - 230),
              top: hover.y + 14,
            }}
          >
            <strong>{itemHover?.nome ?? '—'}</strong>
            {itemHover?.detalhes.length === 0 ? null : itemHover ? (
              itemHover.detalhes.map(([k, v]) => (
                <span key={k}>
                  {k} <b>{v}</b>
                </span>
              ))
            ) : (
              <span>Sem votos</span>
            )}
          </div>
        )}
      </div>
      {!semLegenda && (
      <figcaption className="legenda-mapa">
        <span className="legenda-titulo">{tituloLegenda}</span>
        <span className="rampa">
          <i style={{ background: 'var(--sem-voto)' }} title="sem votos" />
          {[...Array(N_CLASSES).keys()].map((k) => (
            <i
              key={k}
              style={{ background: cor(k) }}
              title={`${formatar(k === 0 ? minimo : limites[k - 1])} – ${formatar(k === N_CLASSES - 1 ? maximo : limites[k])}`}
            />
          ))}
        </span>
        <span className="legenda-extremos">
          <span>0</span>
          <span>{formatar(minimo)}</span>
          <span>{formatar(maximo)}</span>
        </span>
      </figcaption>
      )}
    </figure>
  )
}
