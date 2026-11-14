// Esqueleto de carregamento: ocupa o lugar do conteúdo com a forma dele, em vez de "Carregando…".
// Só aparece se a espera passar de ~120 ms, para não piscar quando os dados já estão em cache.
import { useEffect, useState } from 'react'

type Tipo = 'pagina' | 'tabela' | 'home'

const Linhas = ({ n }: { n: number }) => (
  <div className="esq-tabela">
    {Array.from({ length: n }, (_, i) => (
      <i key={i} className="esq" style={{ width: `${88 - ((i * 13) % 30)}%` }} />
    ))}
  </div>
)

export default function Esqueleto({ tipo = 'pagina' }: { tipo?: Tipo }) {
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisivel(true), 120)
    return () => clearTimeout(t)
  }, [])
  if (!visivel) return <div className="esq-espaco" aria-busy="true" />
  return (
    <div className="esqueleto" role="status" aria-busy="true" aria-label="Carregando">
      {tipo !== 'tabela' && (
        <>
          <i className="esq esq-rotulo" />
          <i className="esq esq-titulo" />
          <i className="esq esq-sub" />
        </>
      )}
      {tipo === 'home' && <i className="esq esq-figura" />}
      {tipo === 'pagina' && (
        <div className="cartoes">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className="esq esq-cartao" />
          ))}
        </div>
      )}
      <Linhas n={tipo === 'home' ? 4 : 8} />
    </div>
  )
}
