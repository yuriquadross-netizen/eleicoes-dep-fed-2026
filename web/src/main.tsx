import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import './estilo.css'
import Brasil from './pages/Brasil'
import SalvarOffline from './components/SalvarOffline'
import Busca from './pages/Busca'
import Candidato from './pages/Candidato'
import Regiao from './pages/Regiao'
import UF from './pages/UF'

function App() {
  return (
    <HashRouter>
      <header className="topo">
        <Link to="/" className="marca">
          Base de Votos <span>Deputados Federais · 2026</span>
        </Link>
        <nav>
          <Link to="/">Buscar</Link>
          <Link to="/brasil">Estados e regiões</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Busca />} />
          <Route path="/candidato/:sq" element={<Candidato />} />
          <Route path="/brasil" element={<Brasil />} />
          <Route path="/uf/:uf" element={<UF />} />
          <Route path="/r/:tipo/:id" element={<Regiao />} />
          <Route path="*" element={<p className="aviso">Página não encontrada.</p>} />
        </Routes>
      </main>
      <footer className="rodape">
        <span>Fonte: TSE, dados abertos (1º turno). Divisões regionais: IBGE, via geobr/Ipea.</span>
        <SalvarOffline />
      </footer>
    </HashRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
