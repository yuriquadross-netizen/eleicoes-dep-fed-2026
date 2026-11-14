// Cabeçalho com o seletor de cargo (Federal | Estadual) e o aviso de cobertura dos estaduais.
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Segmentado from './Segmentado'
import { equivalente, NOME_CARGO, rota, useCargo, type Cargo } from '../cargo'
import { apiDe, NOME_UF } from '../dados'
import { useCarregar } from '../formato'

export default function Cabecalho() {
  const cargo = useCargo()
  const loc = useLocation()
  const navegar = useNavigate()
  const [metaEst] = useCarregar(() => apiDe('estadual').meta().catch(() => null), [])
  const ufsEst = metaEst?.ufs ?? []

  const trocar = (c: Cargo) => {
    if (c !== cargo) navegar(equivalente(loc.pathname, loc.search, c))
  }
  // borda de rolagem: a sombra do cabeçalho só aparece quando há conteúdo passando por baixo dele
  const sentinela = useRef<HTMLDivElement>(null)
  const [rolado, setRolado] = useState(false)
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => setRolado(!e.isIntersecting))
    o.observe(sentinela.current!)
    return () => o.disconnect()
  }, [])
  const ativo = (caminho: string) => (loc.pathname === rota(cargo, caminho) ? 'page' : undefined)

  return (
    <>
      <div ref={sentinela} className="topo-sentinela" aria-hidden="true" />
      <header className="topo" data-rolado={rolado || undefined}>
        <Link to={rota(cargo, cargo === 'federal' ? '/' : '/buscar')} className="marca">
          Base de Votos <span>{NOME_CARGO[cargo].plural} · 2026</span>
        </Link>
        <Segmentado
          className="seletor-cargo"
          rotulo="Cargo"
          opcoes={(['federal', 'estadual'] as Cargo[]).map((c) => ({ k: c, rotulo: NOME_CARGO[c].curto }))}
          valor={cargo}
          aoMudar={trocar}
        />
        <nav>
          {cargo === 'federal' && (
            <Link to="/" aria-current={ativo('/')}>
              Início
            </Link>
          )}
          <Link to={rota(cargo, '/buscar')} aria-current={ativo('/buscar')}>
            Buscar
          </Link>
          <Link to={rota(cargo, '/brasil')} aria-current={ativo('/brasil')}>
            Estados e regiões
          </Link>
        </nav>
      </header>
      {cargo === 'estadual' && ufsEst.length > 0 && ufsEst.length < 27 && (
        <p className="aviso-cobertura">
          Deputados estaduais: por enquanto, só {ufsEst.map((u) => NOME_UF[u]).join(', ')}. Os demais estados entram
          em breve.
        </p>
      )}
    </>
  )
}
