import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import './estilo.css'
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

function App() {
  return (
    <HashRouter>
      <Cabecalho />
      <main>
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
          <Route path="*" element={<p className="aviso">Página não encontrada.</p>} />
        </Routes>
      </main>
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
