import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Topology } from 'topojson-specification'
import BarraIdeo from '../components/BarraIdeo'
import MapaUF, { type ItemMapa } from '../components/MapaUF'
import {
  api, FILHO, geo, IDX_TIPO, NOME_SIT, NOME_TIPO, NOME_UF, nomeLocal, PAI,
  type DadosUF, type Meta, type Nivel, type TopRegiao,
} from '../dados'
import { num, pct, useCarregar, useTitulo } from '../formato'

const TIPOS_VALIDOS: Nivel[] = ['micro', 'meso', 'rgi', 'rgint', 'mun']

export default function Regiao() {
  const { tipo = '', id = '' } = useParams()
  const nivel = tipo as Nivel
  const [d, erro] = useCarregar(
    () =>
      api.top(nivel, id).then(async (r) => {
        const [u, t, m] = await Promise.all([api.uf(r.uf), geo(r.uf), api.meta()])
        return { r, u, t, m }
      }),
    [nivel, id],
  )
  const titulo = d ? nomeLocal(d.u, nivel, Number(id)) : ''
  useTitulo(titulo)
  if (!TIPOS_VALIDOS.includes(nivel)) return <p className="aviso">Recorte desconhecido.</p>
  if (erro) return <p className="aviso">Região não encontrada ({erro}).</p>
  if (!d) return <p className="aviso">Carregando…</p>
  return <Conteudo r={d.r} u={d.u} topo={d.t} meta={d.m} />
}

function Conteudo({ r, u, topo, meta }: { r: TopRegiao; u: DadosUF; topo: Topology; meta: Meta }) {
  const navegar = useNavigate()
  const nivel = r.tipo
  const nome = nomeLocal(u, nivel, r.id)

  // trilha: Brasil › Região › UF › [pai] › [micro do município] › local
  const trilha: { to: string; nome: string }[] = [
    { to: '/brasil', nome: 'Brasil' },
    { to: `/uf/${u.uf}`, nome: NOME_UF[u.uf] },
  ]
  if (nivel === 'mun') {
    const m = u.municipios[r.id]
    trilha.push({ to: `/r/meso/${m[2]}`, nome: nomeLocal(u, 'meso', m[2]) })
    trilha.push({ to: `/r/micro/${m[1]}`, nome: nomeLocal(u, 'micro', m[1]) })
  } else if (PAI[nivel]) {
    const pai = u.regioes[nivel][r.id]?.pai
    if (pai) trilha.push({ to: `/r/${PAI[nivel]}/${pai}`, nome: nomeLocal(u, PAI[nivel]!, pai) })
  }

  // mapa de localização: mesma camada, região destacada
  const itens = useMemo(() => {
    const m = new Map<number, ItemMapa>()
    if (nivel === 'mun') {
      for (const [cd, mu] of Object.entries(u.municipios)) m.set(Number(cd), { nome: mu[0], valor: 0, detalhes: [] })
    } else {
      for (const [k, reg] of Object.entries(u.regioes[nivel])) m.set(Number(k), { nome: reg.nome, valor: 0, detalhes: [] })
    }
    return m
  }, [u, nivel])

  // filhos: meso → micros, rgint → imediatas, micro/rgi → municípios
  const filhos = useMemo(() => {
    if (nivel === 'mun') return []
    const f = FILHO[nivel]
    if (f === 'mun') {
      return Object.entries(u.municipios)
        .filter(([, m]) => m[IDX_TIPO[nivel]] === r.id)
        .map(([cd, m]) => ({ id: Number(cd), nome: m[0], validos: m[5], lider: undefined }))
        .sort((a, b) => b.validos - a.validos)
    }
    return Object.entries(u.regioes[f])
      .filter(([, reg]) => reg.pai === r.id)
      .map(([k, reg]) => ({ id: Number(k), nome: reg.nome, validos: reg.validos, lider: reg.lider }))
      .sort((a, b) => b.validos - a.validos)
  }, [u, nivel, r.id])
  const tipoFilho = nivel === 'mun' ? null : FILHO[nivel]

  return (
    <article>
      <p className="trilha">
        {trilha.map((t) => (
          <span key={t.to}>
            <Link to={t.to}>{t.nome}</Link> ›{' '}
          </span>
        ))}
        {nome}
      </p>
      <h1>{nome}</h1>
      <p className="sub" style={{ marginTop: '-0.6rem', marginBottom: '1rem' }}>
        {NOME_TIPO[nivel].singular} · {NOME_UF[u.uf]} · {meta.regioes[u.regiao]?.nome}
      </p>

      <div className="duas-colunas">
        <div>
          <div className="bloco">
            <h3>{num(r.validos)} votos válidos para deputado federal</h3>
            <BarraIdeo ideo={r.ideo} />
          </div>
          <h2 style={{ marginTop: 0 }}>Os 10 mais votados</h2>
          <table className="tabela">
            <thead>
              <tr>
                <th></th>
                <th>Candidato</th>
                <th className="n">Votos</th>
                <th className="n" title="Fatia dos votos válidos do local">% do local</th>
                <th className="n" title="Fatia da votação total do candidato que veio daqui">% da base</th>
              </tr>
            </thead>
            <tbody>
              {r.top.map((t, i) => (
                <tr key={t[0]}>
                  <td className="pos">{i + 1}</td>
                  <td>
                    <Link to={`/candidato/${t[0]}`}>{t[1]}</Link>
                    <small>
                      {t[2]} · <span className={`sit sit-${t[3]}`}>{NOME_SIT[t[3]]}</span>
                    </small>
                  </td>
                  <td className="n">{num(t[4])}</td>
                  <td className="n">{pct(t[5])}</td>
                  <td className="n">{pct(t[6])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="legenda-tab" style={{ marginTop: '0.5rem' }}>
            <b>% do local</b>: fatia dos votos válidos daqui que foi para o candidato. <b>% da base</b>: fatia da
            votação total do candidato que veio daqui.
          </p>
        </div>
        <div>
          <MapaUF
            topo={topo}
            camada={nivel}
            itens={itens}
            formatar={num}
            tituloLegenda={`Localização de ${nome}`}
            destaque={r.id}
            altura={420}
            semLegenda
            aoSelecionar={(id) => navegar(`/r/${nivel}/${id}`)}
          />
          {tipoFilho && filhos.length > 0 && (
            <>
              <h2 style={{ marginTop: 0 }}>{NOME_TIPO[tipoFilho].plural}</h2>
              <table className="tabela">
                <tbody>
                  {filhos.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <Link to={`/r/${tipoFilho}/${f.id}`}>{f.nome}</Link>
                        {f.lider && (
                          <small>
                            1º {f.lider[1]} ({f.lider[2]}) · {pct(f.lider[4])}
                          </small>
                        )}
                      </td>
                      <td className="n">{num(f.validos)} válidos</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
