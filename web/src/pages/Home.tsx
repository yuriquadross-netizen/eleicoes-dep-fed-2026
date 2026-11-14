import { useMemo } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Esqueleto from '../components/Esqueleto'
import Hemiciclo, { type Assento } from '../components/Hemiciclo'
import { api, senado, type CadeiraSenado, type Classe } from '../dados'
import { num, useCarregar, useTitulo } from '../formato'

const ORDEM: Classe[] = ['Direita', 'Centro', 'Esquerda']
const pct1 = (x: number) => `${(x * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const SEM_PARTIDO = 'S/PARTIDO'
const nomePartido = (p: string) => (p === SEM_PARTIDO ? 'Sem partido' : p)

interface Bancada {
  partido: string
  federacao: string | null
  classe: Classe | null
  n: number
}

/** Bancadas por partido; o campo do partido é o do primeiro parlamentar (marcações individuais não mudam o partido). */
function bancadasDe(itens: { partido: string; classe: Classe | null; federacao?: string | null }[]): Bancada[] {
  const m = new Map<string, Bancada>()
  for (const { partido, classe, federacao } of itens) {
    const b = m.get(partido) ?? { partido, federacao: federacao ?? null, classe: null, n: 0 }
    b.n++
    b.classe = b.classe ?? classe
    m.set(partido, b)
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.partido.localeCompare(b.partido))
}

/** Três colunas (Esquerda, Centro, Direita) com as bancadas de cada campo. */
function BancadasPorCampo({ assentos, bancadas, linkPartido }: { assentos: Assento[]; bancadas: Bancada[]; linkPartido?: boolean }) {
  const total = assentos.length
  return (
    <div className="bancadas-campos">
      {(['Esquerda', 'Centro', 'Direita'] as Classe[]).map((campo) => {
        const lista = bancadas.filter((b) => b.classe === campo)
        // conta cada parlamentar pelo próprio campo (inclui marcações individuais), como no hemiciclo
        const n = assentos.filter((x) => x.classe === campo).length
        return (
          <div key={campo} className="bloco">
            <h3>
              <span className="campo-chip">
                <i className={`ideo-${ORDEM.indexOf(campo)}`} />
              </span>{' '}
              {campo} · {n} cadeiras ({pct1(n / total)})
            </h3>
            <div className="rolagem"><table className="tabela compacta sem-borda">
              <tbody>
                {lista.map((b) => (
                  <tr key={b.partido}>
                    <td>
                      {linkPartido ? (
                        <Link className="sutil" to={`/buscar?partido=${encodeURIComponent(b.partido)}`}>
                          {b.partido}
                        </Link>
                      ) : (
                        nomePartido(b.partido)
                      )}
                      {b.federacao && <small>{b.federacao}</small>}
                    </td>
                    <td className="n">{num(b.n)}</td>
                    <td className="n">{pct1(b.n / total)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )
      })}
    </div>
  )
}

const ehSuplente = (c: CadeiraSenado) => c.participacao !== 'Titular'
const textoSuplente = (c: CadeiraSenado) =>
  `${c.participacao} de ${c.titular}${c.motivo ? ` (${c.motivo.charAt(0).toLowerCase()}${c.motivo.slice(1)})` : ''}`

export default function Home() {
  useTitulo('')
  const loc = useLocation()
  const navegar = useNavigate()
  const [meta, erro] = useCarregar(() => api.meta(), [])
  // o Senado é opcional: se o arquivo ainda não existir, a home mostra só a Câmara
  const [sen] = useCarregar(() => senado().catch(() => null), [])

  const assentos: Assento[] = useMemo(
    () => (meta?.camara ?? []).map(([sq, nome, partido, uf, classe]) => ({ sq, nome, partido, uf, classe })),
    [meta],
  )
  const bancadas = useMemo(
    () => bancadasDe((meta?.camara ?? []).map(([, , partido, , classe, federacao]) => ({ partido, classe, federacao }))),
    [meta],
  )
  const cadeiras = useMemo(() => sen?.cadeiras ?? [], [sen])
  const assentosSenado: Assento[] = useMemo(
    () =>
      cadeiras.map((c) => ({
        sq: c.sq,
        nome: c.nome,
        partido: nomePartido(c.partido),
        uf: c.uf,
        classe: c.classe,
        detalhes: [c.turma === 2026 ? 'Eleito em 2026 · mandato até 2035' : 'Turma de 2022 · mandato até 2031'],
        destaque: ehSuplente(c) ? `${c.previsto ? 'Previsto: ' : ''}${textoSuplente(c)}` : undefined,
      })),
    [cadeiras],
  )
  const bancadasSenado = useMemo(() => bancadasDe(cadeiras), [cadeiras])
  const suplentes = cadeiras.filter(ehSuplente)

  // links antigos da busca (#/?q=…) continuam funcionando
  if (/[?&](q|uf|partido|todos)=/.test(loc.search)) return <Navigate to={`/buscar${loc.search}`} replace />
  if (erro) return <p className="aviso">Não foi possível carregar os dados ({erro}).</p>
  if (!meta) return <Esqueleto tipo="home" />

  const total = assentos.length
  const semCampo = cadeiras.filter((c) => !c.classe)
  return (
    <article className="home">
      <header className="home-cab">
        <p className="sobretitulo">Eleições 2026 · posse em 1º de fevereiro de 2027</p>
        <h1>O Congresso que vem</h1>
        <p className="sub">
          Composição da Câmara dos Deputados e do Senado Federal para 2027, por campo ideológico. Na Câmara, mudanças
          de partido, licenças e substituições posteriores à eleição não estão refletidas.
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
          <Hemiciclo
            assentos={assentos}
            rotulo={`Câmara dos Deputados eleita para 2027: ${total} cadeiras por campo ideológico`}
            aoAbrir={(a) => navegar(`/candidato/${a.sq}`)}
          />
        </div>
        <BancadasPorCampo assentos={assentos} bancadas={bancadas} linkPartido />
      </section>

      {cadeiras.length > 0 && (
        <section>
          <h2>Senado Federal · {cadeiras.length} cadeiras</h2>
          <p className="legenda-tab">
            {cadeiras.filter((c) => c.turma === 2026).length} eleitos em 2026 (mandato até 2035) e{' '}
            {cadeiras.filter((c) => c.turma === 2022).length} da turma eleita em 2022 (mandato até 2031), estes com o
            ocupante e o partido atuais, segundo o Senado.
          </p>
          <div className="hemiciclo-centro">
            <Hemiciclo
              assentos={assentosSenado}
              rotulo={`Senado Federal em 2027: ${cadeiras.length} cadeiras por campo ideológico`}
              legendaExtra={
                <span className="ideo-rotulos">
                  <span>
                    <i className="marca-suplente" /> Suplente no lugar do titular <b>{suplentes.length}</b>
                  </span>
                  {semCampo.length > 0 && (
                    <span>
                      <i style={{ background: 'var(--tinta-3)' }} /> Sem partido <b>{semCampo.length}</b>
                    </span>
                  )}
                </span>
              }
            />
          </div>
          <BancadasPorCampo assentos={assentosSenado} bancadas={bancadasSenado} />
          {suplentes.length > 0 && (
            <div className="bloco">
              <h3>Suplentes no lugar do titular · {suplentes.length}</h3>
              <div className="rolagem"><table className="tabela compacta sem-borda">
                <tbody>
                  {suplentes.map((c) => (
                    <tr key={c.sq}>
                      <td>
                        {c.nome}
                        <small>
                          {nomePartido(c.partido)} · {c.uf}
                        </small>
                      </td>
                      <td>
                        {textoSuplente(c)}
                        <small>
                          {c.previsto
                            ? 'Previsão: deve assumir em 2027, quando o titular tomar posse no novo cargo.'
                            : `Em exercício desde ${c.desde.split('-').reverse().join('/')}.`}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
          <p className="legenda-tab">Fonte: {sen?.fonte}</p>
        </section>
      )}
    </article>
  )
}
