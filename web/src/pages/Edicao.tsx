import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, NOME_UF } from '../dados'
import { useCarregar, useTitulo } from '../formato'
import { lerToken, REPO, salvarToken, testarToken } from '../github'

export default function Edicao() {
  useTitulo('Edição')
  const [token, setToken] = useState(lerToken())
  const [texto, setTexto] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [testando, setTestando] = useState(false)
  const [meta] = useCarregar(() => api.meta(), [])
  const marcacoes = meta?.posicoes_proprias ?? []

  const salvar = async () => {
    setTestando(true)
    setMsg(null)
    try {
      const repo = await testarToken(texto.trim())
      salvarToken(texto.trim())
      setToken(texto.trim())
      setTexto('')
      setMsg({ ok: true, texto: `Chave válida, com escrita em ${repo}. A edição está ativa neste Mac.` })
    } catch (e) {
      setMsg({ ok: false, texto: `Chave recusada: ${(e as Error).message}.` })
    } finally {
      setTestando(false)
    }
  }

  return (
    <section className="pagina-edicao">
      <h1>Edição do posicionamento</h1>
      <p className="sub" style={{ marginTop: '-0.5rem' }}>
        Marque um parlamentar com campo ideológico diferente do partido. A marcação vale para todos os que usam o
        app e recalcula mapas e barras regionais. O site se atualiza sozinho em cerca de 3 minutos.
      </p>

      <div className="bloco">
        <h3>Chave de acesso deste Mac</h3>
        {token ? (
          <>
            <p>
              Edição <b>ativa</b>. Abra o perfil de qualquer parlamentar e use <b>Editar posicionamento</b>.
            </p>
            <button
              className="botao"
              onClick={() => {
                salvarToken(null)
                setToken(null)
                setMsg(null)
              }}
            >
              Remover a chave deste Mac
            </button>
          </>
        ) : (
          <>
            <ol className="passos">
              <li>
                Abra{' '}
                <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                  github.com › Settings › Fine-grained tokens › Generate new token
                </a>
                .
              </li>
              <li>
                <b>Token name:</b> “Base de Votos — edição”. <b>Expiration:</b> a validade que preferir (ex.: 1 ano).
              </li>
              <li>
                <b>Repository access:</b> “Only select repositories” › <code>{REPO.split('/')[1]}</code>.
              </li>
              <li>
                <b>Permissions › Repository permissions › Contents:</b> “Read and write”. Nada mais.
              </li>
              <li>
                Clique em <b>Generate token</b>, copie o código (começa com <code>github_pat_</code>) e cole abaixo.
              </li>
            </ol>
            <div className="filtros">
              <input
                type="password"
                placeholder="github_pat_…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                autoComplete="off"
              />
              <button className="botao primario" onClick={salvar} disabled={!texto.trim() || testando}>
                {testando ? 'Testando…' : 'Testar e salvar'}
              </button>
            </div>
            <p className="edicao-dica">
              A chave fica guardada só neste navegador e só dá acesso a este repositório. Não a compartilhe.
            </p>
          </>
        )}
        {msg && <p className={msg.ok ? 'edicao-ok' : 'edicao-erro'}>{msg.texto}</p>}
      </div>

      <h2>Parlamentares com posicionamento próprio</h2>
      {marcacoes.length === 0 ? (
        <p className="aviso" style={{ padding: 0 }}>
          Nenhum por enquanto. Todos seguem o campo do partido.
        </p>
      ) : (
        <div className="rolagem"><table className="tabela">
          <thead>
            <tr>
              <th>Parlamentar</th>
              <th>Campo marcado</th>
              <th>Campo do partido</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            {marcacoes.map(([sq, urna, partido, uf, classe, classePartido, obs]) => (
              <tr key={sq}>
                <td>
                  <Link to={`/candidato/${sq}`}>{urna}</Link>
                  <small>
                    {partido} · {NOME_UF[uf]}
                  </small>
                </td>
                <td>{classe}</td>
                <td>{classePartido}</td>
                <td>{obs}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </section>
  )
}
