import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import './estilo.css'
import Busca from './pages/Busca'
import Candidato from './pages/Candidato'

function App() {
  return (
    <HashRouter>
      <header className="topo">
        <Link to="/" className="marca">
          Base de Votos <span>Deputados Federais · 2026</span>
        </Link>
        <nav>
          <Link to="/">Buscar</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Busca />} />
          <Route path="/candidato/:sq" element={<Candidato />} />
          <Route path="*" element={<p className="aviso">Página não encontrada.</p>} />
        </Routes>
      </main>
      <footer className="rodape">Fonte: TSE, dados abertos (1º turno). Divisões regionais: IBGE, via geobr/Ipea.</footer>
    </HashRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
