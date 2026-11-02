import { Fragment, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, nomeLocal, NOME_TIPO, NOME_UF, type DadosUF, type LinhaLocal, type Perfil, type Tipo } from '../dados'
import { num, pct, useCarregar, useTitulo } from '../formato'

type Ordem = 'votos' | 'pct_local' | 'pct_base'
const COL: Record<Ordem, number> = { votos: 1, pct_local: 3, pct_base: 4 }

export default function Candidato() {
  const { sq = '' } = useParams()
  const [dados, erro] = useCarregar(
    () => api.perfil(sq).then(async (p) => ({ p, uf: await api.uf(p.uf) })),
    [sq],
  )
  useTitulo(dados?.p.urna ?? '')

  if (erro) return <p className="aviso">Candidato não encontrado ({erro}).</p>
  if (!dados) return <p className="aviso">Carregando…</p>
  return <Conteudo p={dados.p} uf={dados.uf} />
}

function Conteudo({ p, uf }: { p: Perfil; uf: DadosUF }) {
  const [tipo, setTipo] = useState<Tipo>('micro')
  const nMun = p.mun.length
  const totalMun = Object.keys(uf.municipios).length
  const forte = p.micro[0]
  const ate50 = useMemo(() => {
    let acc = 0
    const ord = [...p.micro].sort((a, b) => b[1] - a[1])
    for (let i = 0; i < ord.length; i++) {
      acc += ord[i][4]
      if (acc >= 0.5) return i + 1
    }
    return ord.length
  }, [p.micro])

  return (
    <article>
      <p className="trilha">
        <Link to="/">Buscar</Link> › {NOME_UF[p.uf]} › {p.urna}
      </p>
      <header className="perfil-cab">
        <div>
          <h1>{p.urna}</h1>
          <p className="sub">
            {p.nome} · {p.partido}
            {p.federacao ? ` (${p.federacao})` : ''} · nº {p.nr} · {NOME_UF[p.uf]}
          </p>
        </div>
        <span className={`sit sit-${p.situacao[0]} grande`}>{p.situacao_tse.toLowerCase()}</span>
      </header>

      <div className="cartoes">
        <Cartao rotulo="Votos válidos" valor={num(p.votos)} nota={`${pct(p.votos / uf.validos, 2)} dos válidos da UF`} />
        <Cartao rotulo={`Posição em ${p.uf}`} valor={`${p.pos_uf}º`} nota={`de ${num(uf.n_candidatos)} candidatos com voto`} />
        <Cartao rotulo="Municípios com voto" valor={num(nMun)} nota={`de ${num(totalMun)} em ${p.uf}`} />
        {forte && (
          <Cartao
            rotulo="Microrregião mais forte"
            valor={nomeLocal(uf, 'micro', forte[0])}
            nota={`${pct(forte[4])} da votação dele`}
          />
        )}
        <Cartao rotulo="Concentração" valor={`${ate50} micro${ate50 > 1 ? 's' : ''}`} nota="somam metade dos votos dele" />
      </div>

      <div className="abas" role="tablist">
        {(['micro', 'meso', 'rgi', 'rgint'] as Tipo[]).map((t) => (
          <button key={t} role="tab" aria-selected={tipo === t} onClick={() => setTipo(t)}>
            {NOME_TIPO[t].plural}
          </button>
        ))}
      </div>
      <TabelaLocais p={p} uf={uf} tipo={tipo} />
    </article>
  )
}

function Cartao({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="cartao">
      <span className="rotulo">{rotulo}</span>
      <strong>{valor}</strong>
      {nota && <span className="nota">{nota}</span>}
    </div>
  )
}

const idxTipo: Record<Tipo, number> = { micro: 1, meso: 2, rgi: 3, rgint: 4 }

function TabelaLocais({ p, uf, tipo }: { p: Perfil; uf: DadosUF; tipo: Tipo }) {
  const [ordem, setOrdem] = useState<Ordem>('votos')
  const [aberto, setAberto] = useState<number | null>(null)
  const linhas = useMemo(() => [...p[tipo]].sort((a, b) => b[COL[ordem]] - a[COL[ordem]]), [p, tipo, ordem])
  const munPorRegiao = useMemo(() => {
    const m = new Map<number, LinhaLocal[]>()
    for (const l of p.mun) {
      const reg = uf.municipios[l[0]]?.[idxTipo[tipo]] as number
      if (!m.has(reg)) m.set(reg, [])
      m.get(reg)!.push(l)
    }
    for (const v of m.values()) v.sort((a, b) => b[COL[ordem]] - a[COL[ordem]])
    return m
  }, [p.mun, uf, tipo, ordem])

  const Th = ({ k, children }: { k: Ordem; children: React.ReactNode }) => (
    <th className="n">
      <button className={ordem === k ? 'ativo' : ''} onClick={() => setOrdem(k)}>
        {children}
        {ordem === k ? ' ↓' : ''}
      </button>
    </th>
  )

  return (
    <>
      <p className="legenda-tab">
        <b>% do local</b>: fatia dos votos válidos do local que foi para {p.urna}. <b>% da base</b>: fatia da
        votação total dele que veio do local. Clique numa linha para ver os municípios.
      </p>
      <table className="tabela">
        <thead>
          <tr>
            <th>{NOME_TIPO[tipo].singular}</th>
            <Th k="votos">Votos</Th>
            <Th k="pct_local">% do local</Th>
            <Th k="pct_base">% da base</Th>
            <th className="n">Posição</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <Fragment key={l[0]}>
              <tr className="clicavel" onClick={() => setAberto(aberto === l[0] ? null : l[0])}>
                <td>
                  <span className="seta">{aberto === l[0] ? '▾' : '▸'}</span> {nomeLocal(uf, tipo, l[0])}
                </td>
                <td className="n">{num(l[1])}</td>
                <td className="n">{pct(l[3])}</td>
                <td className="n">{pct(l[4])}</td>
                <td className="n">{l[5]}º</td>
              </tr>
              {aberto === l[0] &&
                (munPorRegiao.get(l[0]) ?? []).map((m) => (
                  <tr key={m[0]} className="filho">
                    <td>{nomeLocal(uf, 'mun', m[0])}</td>
                    <td className="n">{num(m[1])}</td>
                    <td className="n">{pct(m[3])}</td>
                    <td className="n">{pct(m[4])}</td>
                    <td className="n">{m[5]}º</td>
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </>
  )
}
