import { StrictMode, useLayoutEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Link, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import './estilo.css'
import { movimentoReduzido } from './movimento'
import Brasil from './pages/Brasil'
import Cabecalho from './components/Cabecalho'
import SalvarOffline from './components/SalvarOffline'
import Busca from './pages/Busca'
import Candidato from './pages/Candidato'
import Edicao from './pages/Edicao'
import Home from './pages/Home'
import Metodo from './pages/Metodo'
import Regiao from './pages/Regiao'
import UF from './pages/UF'

/** Conteúdo da página, com uma entrada curta a cada troca de endereço (sem atrasar o conteúdo). */
function Paginas() {
  const { pathname } = useLocation()
  const tipo = useNavigationType()
  const caixa = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const reduzido = movimentoReduzido()
    caixa.current?.animate(
      reduzido ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: reduzido ? 160 : 280, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
    )
    // página nova começa no topo; "voltar" mantém a posição que o navegador restaura
    if (tipo === 'PUSH') window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  return (
      <main ref={caixa}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/buscar" element={<Busca />} />
          <Route path="/candidato/:sq" element={<Candidato />} />
          <Route path="/brasil" element={<Brasil />} />
          <Route path="/uf/:uf" element={<UF />} />
          <Route path="/r/:tipo/:id" element={<Regiao />} />
          <Route path="/edicao" element={<Edicao />} />
          <Route path="/metodo" element={<Metodo />} />
          {/* deputados estaduais: mesmas páginas, prefixo /estadual (cargo lido do endereço) */}
          <Route path="/estadual" element={<Busca />} />
          <Route path="/estadual/buscar" element={<Busca />} />
          <Route path="/estadual/candidato/:sq" element={<Candidato />} />
          <Route path="/estadual/brasil" element={<Brasil />} />
          <Route path="/estadual/uf/:uf" element={<UF />} />
          <Route path="/estadual/r/:tipo/:id" element={<Regiao />} />
          <Route path="/estadual/metodo" element={<Metodo />} />
          <Route path="/estadual/edicao" element={<Edicao />} />
          <Route
            path="*"
            element={
              <div className="vazio">
                <h1>Página não encontrada</h1>
                <p>O endereço pode ter mudado.</p>
                <p>
                  <Link to="/">Voltar ao início</Link> · <Link to="/buscar">Buscar um deputado</Link>
                </p>
              </div>
            }
          />
        </Routes>
      </main>
  )
}

function App() {
  return (
    <HashRouter>
      <Cabecalho />
      <Paginas />
      <footer className="rodape">
        <span>Fonte: TSE, dados abertos (1º turno). Divisões regionais: IBGE, via geobr/Ipea.</span>
        <span className="offline">
          <SalvarOffline />
          <Link to="/edicao">Edição</Link>
        </span>
      </footer>
    </HashRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
