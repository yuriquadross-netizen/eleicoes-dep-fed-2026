import { useMemo } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Hemiciclo, { type Assento } from '../components/Hemiciclo'
import { api, type Classe } from '../dados'
import { num, useCarregar, useTitulo } from '../formato'

const ORDEM: Classe[] = ['Direita', 'Centro', 'Esquerda']
const pct1 = (x: number) => `${(x * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

export default function Home() {
  useTitulo('')
  const loc = useLocation()
  const [meta, erro] = useCarregar(() => api.meta(), [])

  const assentos: Assento[] = useMemo(
    () => (meta?.camara ?? []).map(([sq, nome, partido, uf, classe]) => ({ sq, nome, partido, uf, classe })),
    [meta],
  )
  const bancadas = useMemo(() => {
    const m = new Map<string, { partido: string; federacao: string | null; classe: Classe | null; n: number }>()
    for (const [, , partido, , classe, federacao] of meta?.camara ?? []) {
      const b = m.get(partido) ?? { partido, federacao, classe: null, n: 0 }
      b.n++
      // campo do partido = o da maioria da bancada (marcações individuais não mudam o partido)
      b.classe = b.classe ?? classe
      m.set(partido, b)
    }
    return [...m.values()].sort((a, b) => b.n - a.n || a.partido.localeCompare(b.partido))
  }, [meta])

  // links antigos da busca (#/?q=…) continuam funcionando
  if (/[?&](q|uf|partido|todos)=/.test(loc.search)) return <Navigate to={`/buscar${loc.search}`} replace />
  if (erro) return <p className="aviso">Não foi possível carregar os dados ({erro}).</p>
  if (!meta) return <p className="aviso">Carregando…</p>

  const total = assentos.length
  return (
    <article className="home">
      <header className="home-cab">
        <p className="sobretitulo">Eleições 2026 · posse em 1º de fevereiro de 2027</p>
        <h1>O Congresso que vem</h1>
        <p className="sub">
          Composição eleita da Câmara dos Deputados, por campo ideológico. Mudanças de partido, licenças e
          substituições posteriores à eleição não estão refletidas.
        </p>
      </header>

      <section>
        <div className="titulo-com-acao">
          <h2>Câmara dos Deputados · {total} cadeiras</h2>
          <span className="legenda-tab">
            <Link to="/brasil">Ver por estado</Link> · <Link to="/buscar">Buscar deputado</Link>
          </span>
        </div>
        <div className="hemiciclo-centro">
          <Hemiciclo assentos={assentos} rotulo={`Câmara dos Deputados eleita para 2027: ${total} cadeiras por campo ideológico`} />
        </div>
        <div className="bancadas-campos">
          {(['Esquerda', 'Centro', 'Direita'] as Classe[]).map((campo) => {
            const lista = bancadas.filter((b) => b.classe === campo)
            // conta cada deputado pelo próprio campo (inclui marcações individuais), como no hemiciclo
            const n = assentos.filter((x) => x.classe === campo).length
            return (
              <div key={campo} className="bloco">
                <h3>
                  <span className="campo-chip">
                    <i className={`ideo-${ORDEM.indexOf(campo)}`} />
                  </span>{' '}
                  {campo} · {n} cadeiras ({pct1(n / total)})
                </h3>
                <table className="tabela compacta sem-borda">
                  <tbody>
                    {lista.map((b) => (
                      <tr key={b.partido}>
                        <td>
                          <Link className="sutil" to={`/buscar?partido=${encodeURIComponent(b.partido)}`}>
                            {b.partido}
                          </Link>
                          {b.federacao && <small>{b.federacao}</small>}
                        </td>
                        <td className="n">{num(b.n)}</td>
                        <td className="n">{pct1(b.n / total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      </section>
    </article>
  )
}
