// Abas com traço deslizante (mesma mola do controle segmentado). Setas ← → trocam de aba no teclado.
import { useIndicador } from '../movimento'
import type { Opcao } from './Segmentado'

export default function Abas<K extends string | number>({
  rotulo, opcoes, valor, aoMudar,
}: {
  rotulo: string
  opcoes: readonly Opcao<K>[]
  valor: K
  aoMudar: (k: K) => void
}) {
  const { grupo, indicador } = useIndicador<HTMLDivElement, HTMLSpanElement>(`${valor}|${opcoes.map((o) => o.rotulo).join('|')}`)
  const mover = (delta: number) => {
    const i = opcoes.findIndex((o) => o.k === valor)
    aoMudar(opcoes[(i + delta + opcoes.length) % opcoes.length].k)
    // o foco acompanha a aba escolhida
    requestAnimationFrame(() => grupo.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus())
  }
  return (
    <div
      ref={grupo}
      className="abas"
      role="tablist"
      aria-label={rotulo}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') mover(1)
        else if (e.key === 'ArrowLeft') mover(-1)
      }}
    >
      <span ref={indicador} className="abas-traco" aria-hidden="true" />
      {opcoes.map((o) => (
        <button
          key={o.k}
          type="button"
          role="tab"
          aria-selected={valor === o.k}
          tabIndex={valor === o.k ? 0 : -1}
          onClick={() => valor !== o.k && aoMudar(o.k)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}
