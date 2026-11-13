// Controle segmentado: a pílula desliza até a opção escolhida com mola (interrompível).
// O realce do toque é imediato (:active no CSS); a escolha vale na soltura, como nos controles da Apple.
import { useIndicador } from '../movimento'

export interface Opcao<K extends string | number> {
  k: K
  rotulo: string
}

export default function Segmentado<K extends string | number>({
  rotulo, opcoes, valor, aoMudar, className = '',
}: {
  rotulo: string
  opcoes: readonly Opcao<K>[]
  valor: K
  aoMudar: (k: K) => void
  className?: string
}) {
  const { grupo, indicador } = useIndicador<HTMLDivElement, HTMLSpanElement>(`${valor}|${opcoes.map((o) => o.rotulo).join('|')}`)
  return (
    <div ref={grupo} className={`segmentado ${className}`} role="group" aria-label={rotulo}>
      <span ref={indicador} className="segmentado-pilula" aria-hidden="true" />
      {opcoes.map((o) => (
        <button key={o.k} type="button" aria-pressed={valor === o.k} onClick={() => valor !== o.k && aoMudar(o.k)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}
