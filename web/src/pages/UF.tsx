import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Topology } from 'topojson-specification'
import BarraIdeo from '../components/BarraIdeo'
import MapaUF, { type ItemMapa } from '../components/MapaUF'
import { api, geo, NOME_TIPO, NOME_UF, type DadosUF, type Meta, type Tipo } from '../dados'
import { TIPOS_DIVISAO, useDivisao } from '../divisao'
import { num, pct, useCarregar, useTitulo } from '../formato'

const METRICAS = [
  { k: 0, rotulo: '% Direita' },
  { k: 1, rotulo: '% Centro' },
  { k: 2, rotulo: '% Esquerda' },
] as const

export default function UF() {
  const { uf = '' } = useParams()
  const sigla = uf.toUpperCase()
  useTitulo(NOME_UF[sigla] ?? sigla)
  const [d, erro] = useCarregar(
    () => Promise.all([api.uf(sigla), geo(sigla), api.meta()]).then(([u, t, m]) => ({ u, t, m })),
    [sigla],
  )
  if (erro) return <p className="aviso">UF não encontrada ({erro}).</p>
  if (!d) return <p className="aviso">Carregando…</p>
  return <Conteudo u={d.u} topo={d.t} meta={d.m} />
}

function Conteudo({ u, topo, meta }: { u: DadosUF; topo: Topology; meta: Meta }) {
  const [divisao, setDivisao] = useDivisao()
  const [nivel, setNivel] = useState<'maior' | 'menor'>('menor')
  const [metrica, setMetrica] = useState<0 | 1 | 2>(0)
  const navegar = useNavigate()
  const tipo: Tipo = TIPOS_DIVISAO[divisao][nivel]
  const regioes = u.regioes[tipo]

  const itens = useMemo(() => {
    const m = new Map<number, ItemMapa>()
    for (const [id, r] of Object.entries(regioes)) {
      m.set(Number(id), {
        nome: r.nome,
        valor: r.ideo?.[metrica] ?? 0,
        detalhes: [
          ['Válidos', num(r.validos)],
          ['Direita', pct(r.ideo?.[0] ?? 0)],
          ['Centro', pct(r.ideo?.[1] ?? 0)],
          ['Esquerda', pct(r.ideo?.[2] ?? 0)],
          ...(r.lider ? ([['Mais votado', `${r.lider[1]} (${pct(r.lider[4])})`]] as [string, string][]) : []),
        ],
      })
    }
    return m
  }, [regioes, metrica])

  const linhas = Object.entries(regioes).sort((a, b) => b[1].validos - a[1].validos)
  const nomeRegiao = meta.regioes[u.regiao]?.nome
  const bancada = Object.entries(u.bancada).sort((a, b) => b[1] - a[1])

  return (
    <article>
      <p className="trilha">
        <Link to="/brasil">Brasil</Link> › {nomeRegiao} › {NOME_UF[u.uf]}
      </p>
      <h1>{NOME_UF[u.uf]}</h1>

      <div className="cartoes">
        <div className="cartao">
          <span className="rotulo">Cadeiras</span>
          <strong>{u.eleitos.length}</strong>
        </div>
        <div className="cartao">
          <span className="rotulo">Votos válidos</span>
          <strong>{num(u.validos)}</strong>
        </div>
        <div className="cartao">
          <span className="rotulo">Candidatos com voto</span>
          <strong>{num(u.n_candidatos)}</strong>
        </div>
        <div className="cartao">
          <span className="rotulo">Municípios</span>
          <strong>{num(Object.keys(u.municipios).length)}</strong>
        </div>
      </div>
      <div className="bloco">
        <h3>Votos por campo ideológico</h3>
        <BarraIdeo ideo={u.ideo} />
      </div>

      <div className="linha-ctrl">
        <div className="segmentado" role="group" aria-label="Divisão regional">
          {(['antiga', 'atual'] as const).map((k) => (
            <button key={k} aria-pressed={divisao === k} onClick={() => setDivisao(k)}>
              {TIPOS_DIVISAO[k].rotulo}
            </button>
          ))}
        </div>
      </div>
      <div className="abas" role="tablist">
        {(['menor', 'maior'] as const).map((n) => (
          <button key={n} role="tab" aria-selected={nivel === n} onClick={() => setNivel(n)}>
            {NOME_TIPO[TIPOS_DIVISAO[divisao][n]].plural}
          </button>
        ))}
      </div>

      <div className="mapa-controles">
        <div className="segmentado" role="group" aria-label="Colorir mapa por">
          {METRICAS.map((m) => (
            <button key={m.k} aria-pressed={metrica === m.k} onClick={() => setMetrica(m.k)}>
              {m.rotulo}
            </button>
          ))}
        </div>
        <span className="legenda-tab" style={{ margin: 0 }}>
          Clique numa região para ver o top 10.
        </span>
      </div>
      <MapaUF
        topo={topo}
        camada={tipo}
        itens={itens}
        formatar={(v) => pct(v)}
        tituloLegenda={`${METRICAS[metrica].rotulo} dos votos válidos por ${NOME_TIPO[tipo].singular.toLowerCase()}`}
        aoSelecionar={(id) => navegar(`/r/${tipo}/${id}`)}
      />

      <div className="duas-colunas">
        <div>
          <h2>{NOME_TIPO[tipo].plural}</h2>
          <table className="tabela">
            <thead>
              <tr>
                <th>{NOME_TIPO[tipo].singular}</th>
                <th className="n">Válidos</th>
                <th>Campo</th>
                <th>Mais votado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(([id, r]) => (
                <tr key={id}>
                  <td>
                    <Link to={`/r/${tipo}/${id}`}>{r.nome}</Link>
                  </td>
                  <td className="n">{num(r.validos)}</td>
                  <td>
                    <BarraIdeo ideo={r.ideo} compacta />
                  </td>
                  <td>
                    {r.lider && (
                      <>
                        <Link className="sutil" to={`/candidato/${r.lider[0]}`}>
                          {r.lider[1]}
                        </Link>
                        <small>
                          {r.lider[2]} · {pct(r.lider[4])}
                        </small>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2>Eleitos</h2>
          <div className="chips" style={{ marginBottom: '0.75rem' }}>
            {bancada.map(([p, n]) => (
              <span key={p} className="chip">
                {p} <b>{n}</b>
              </span>
            ))}
          </div>
          <table className="tabela">
            <tbody>
              {u.eleitos.map((e, i) => (
                <tr key={e[0]}>
                  <td className="pos">{i + 1}</td>
                  <td>
                    <Link to={`/candidato/${e[0]}`}>{e[1]}</Link>
                    <small>{e[2]}</small>
                  </td>
                  <td className="n">{num(e[3])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  )
}
