// Barra empilhada Direita / Centro / Esquerda (escala divergente: azul ↔ cinza neutro ↔ vermelho).
import type { Ideo } from '../dados'
import { pct } from '../formato'

const ROTULOS = ['Direita', 'Centro', 'Esquerda'] as const

export default function BarraIdeo({ ideo, compacta = false }: { ideo: Ideo | null | undefined; compacta?: boolean }) {
  if (!ideo) return null
  const titulo = ROTULOS.map((r, i) => `${r} ${pct(ideo[i])}`).join(' · ')
  return (
    <div className={`ideo${compacta ? ' compacta' : ''}`} title={titulo}>
      <div className="ideo-barra" role="img" aria-label={titulo}>
        {ideo.map((v, i) => (
          <span key={i} className={`ideo-${i}`} style={{ flexGrow: v }} />
        ))}
      </div>
      {!compacta && (
        <div className="ideo-rotulos">
          {ROTULOS.map((r, i) => (
            <span key={r}>
              <i className={`ideo-${i}`} /> {r} <b>{pct(ideo[i])}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
