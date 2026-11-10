// Cabeçalho com o seletor de cargo (Federal | Estadual) e o aviso de cobertura dos estaduais.
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { equivalente, NOME_CARGO, rota, useCargo, type Cargo } from '../cargo'
import { apiDe, NOME_UF } from '../dados'
import { useCarregar } from '../formato'

export default function Cabecalho() {
  const cargo = useCargo()
  const loc = useLocation()
  const navegar = useNavigate()
  const [metaEst] = useCarregar(() => apiDe('estadual').meta().catch(() => null), [])
  const ufsEst = metaEst?.ufs ?? []

  const trocar = (c: Cargo) => c !== cargo && navegar(equivalente(loc.pathname, loc.search, c))

  return (
    <>
      <header className="topo">
        <Link to={rota(cargo, cargo === 'federal' ? '/' : '/buscar')} className="marca">
          Base de Votos <span>{NOME_CARGO[cargo].plural} · 2026</span>
        </Link>
        <div className="segmentado seletor-cargo" role="group" aria-label="Cargo">
          {(['federal', 'estadual'] as Cargo[]).map((c) => (
            <button key={c} aria-pressed={cargo === c} onClick={() => trocar(c)}>
              {NOME_CARGO[c].curto}
            </button>
          ))}
        </div>
        <nav>
          {cargo === 'federal' && <Link to="/">Início</Link>}
          <Link to={rota(cargo, '/buscar')}>Buscar</Link>
          <Link to={rota(cargo, '/brasil')}>Estados e regiões</Link>
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
