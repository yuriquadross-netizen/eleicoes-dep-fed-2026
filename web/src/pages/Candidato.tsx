import { Fragment, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Topology } from 'topojson-specification'
import BaseTipologia from '../components/BaseTipologia'
import EditarPosicao from '../components/EditarPosicao'
import Foto from '../components/Foto'
import { baixarCsv, pctCsv } from '../csv'
import { useCargo } from '../cargo'
import LinkC from '../components/LinkC'
import MapaUF, { type ItemMapa } from '../components/MapaUF'
import {
  apiDe, geo, nomeLocal, NOME_TIPO, NOME_UF, RAMPA_CLASSE, type DadosUF, type LinhaLocal, type Nivel, type Perfil, type Tipo,
} from '../dados'
import { TIPOS_DIVISAO, useDivisao } from '../divisao'
import { num, pct, useCarregar, useTitulo } from '../formato'

type Ordem = 'votos' | 'pct_local' | 'pct_base'
const COL: Record<Ordem, number> = { votos: 1, pct_local: 3, pct_base: 4 }
const IDX_TIPO: Record<Tipo, number> = { micro: 1, meso: 2, rgi: 3, rgint: 4 }

export default function Candidato() {
  const cargo = useCargo()
  const { sq = '' } = useParams()
  const [dados, erro] = useCarregar(
    () => apiDe(cargo).perfil(sq).then(async (p) => ({ p, uf: await apiDe(cargo).uf(p.uf), topo: await geo(p.uf) })),
    [sq, cargo],
  )
  useTitulo(dados?.p.urna ?? '')

  if (erro) return <p className="aviso">Candidato não encontrado entre os {cargo === 'estadual' ? 'deputados estaduais' : 'deputados federais'} ({erro}).</p>
  if (!dados) return <p className="aviso">Carregando…</p>
  return <Conteudo key={sq} {...dados} />
}

function Conteudo({ p, uf, topo }: { p: Perfil; uf: DadosUF; topo: Topology }) {
  const [divisao] = useDivisao()
  const [tipo, setTipo] = useState<Tipo>(TIPOS_DIVISAO[divisao].menor)
  const [aberto, setAberto] = useState<number | null>(null)
  const [metrica, setMetrica] = useState<'votos' | 'pct_local'>('votos')
  const [verMun, setVerMun] = useState(false)

  const nMun = p.mun.length
  const totalMun = Object.keys(uf.municipios).length
  const forte = p.micro[0]
  const ate50 = useMemo(() => {
    let acc = 0
    for (let i = 0; i < p.micro.length; i++) {
      acc += p.micro[i][4]
      if (acc >= 0.5) return i + 1
    }
    return p.micro.length
  }, [p.micro])

  const camada: Nivel = verMun ? 'mun' : tipo
  const itens = useMemo(() => {
    const m = new Map<number, ItemMapa>()
    for (const l of p[camada]) {
      m.set(l[0], {
        nome: nomeLocal(uf, camada, l[0]),
        valor: metrica === 'votos' ? l[1] : l[3],
        detalhes: [
          ['Votos', num(l[1])],
          ['% do local', pct(l[3])],
          ['% da base dele', pct(l[4])],
          ['Posição no local', `${l[5]}º`],
        ],
      })
    }
    return m
  }, [p, uf, camada, metrica])

  const selecionar = (id: number) => {
    const regiao = camada === 'mun' ? (uf.municipios[id]?.[IDX_TIPO[tipo]] as number) : id
    setAberto(regiao)
    requestAnimationFrame(() =>
      document.getElementById(`linha-${regiao}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
  }

  return (
    <article>
      <p className="trilha">
        <LinkC to="/buscar">Buscar</LinkC> › <LinkC to={`/uf/${p.uf}`}>{NOME_UF[p.uf]}</LinkC> › {p.urna}
      </p>
      <header className="perfil-cab">
        <div>
          {p.situacao === 'Eleito' && <Foto sq={p.sq} nome={p.urna} tamanho="g" />}
          <div>
            <h1>{p.urna}</h1>
            <p className="sub">
              {p.nome} · <LinkC to={`/buscar?partido=${encodeURIComponent(p.partido)}&uf=${p.uf}&todos=1`}>{p.partido}</LinkC>
              {p.federacao ? ` (${p.federacao})` : ''} · nº {p.nr} · {NOME_UF[p.uf]}
            </p>
            {p.classe && (
              <p className="campo">
                <i className={`ideo-${['Direita', 'Centro', 'Esquerda'].indexOf(p.classe)}`} /> {p.classe}
                {typeof p.posicao_propria === 'string' ? (
                  <span className="propria" title={p.posicao_propria || undefined}>
                    {' '}· posicionamento próprio (partido: {p.classe_partido})
                    {p.posicao_propria ? ` — ${p.posicao_propria}` : ''}
                  </span>
                ) : (
                  <span className="nota"> · campo do partido</span>
                )}
              </p>
            )}
          </div>
        </div>
        <span className={`sit sit-${p.situacao[0]} grande`}>{p.situacao_tse.toLowerCase()}</span>
      </header>
      <EditarPosicao p={p} />

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
        <Cartao rotulo="Metade dos votos" valor={`${ate50} micro${ate50 > 1 ? 's' : ''}`} nota="concentram metade da votação dele" />
      </div>
      {p.tipologia && <BaseTipologia t={p.tipologia} uf={p.uf} />}

      <div className="abas" role="tablist">
        {(['micro', 'meso', 'rgi', 'rgint'] as Tipo[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tipo === t}
            onClick={() => {
              setTipo(t)
              setAberto(null)
            }}
          >
            {NOME_TIPO[t].plural}
          </button>
        ))}
      </div>

      <div className="mapa-controles">
        <div className="segmentado" role="group" aria-label="Métrica do mapa">
          <button aria-pressed={metrica === 'votos'} onClick={() => setMetrica('votos')}>
            Votos
          </button>
          <button aria-pressed={metrica === 'pct_local'} onClick={() => setMetrica('pct_local')}>
            % do local
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={verMun} onChange={(e) => setVerMun(e.target.checked)} />
          Detalhar por município
        </label>
      </div>
      <MapaUF
        topo={topo}
        camada={camada}
        itens={itens}
        formatar={metrica === 'votos' ? num : (v) => pct(v)}
        tituloLegenda={`${metrica === 'votos' ? 'Votos' : '% dos votos válidos do local'} de ${p.urna} por ${NOME_TIPO[camada].singular.toLowerCase()}${p.classe ? ` · cor do campo do partido (${p.classe})` : ''}`}
        rampa={p.classe ? RAMPA_CLASSE[p.classe] : undefined}
        selecionado={camada === 'mun' ? null : aberto}
        aoSelecionar={selecionar}
      />

      <TabelaLocais p={p} uf={uf} tipo={tipo} aberto={aberto} setAberto={setAberto} />
    </article>
  )
}

function exportarMunicipios(p: Perfil, uf: DadosUF) {
  baixarCsv(
    `${p.urna} ${p.partido}-${p.uf} votos por municipio 2026.csv`,
    ['Município', 'Microrregião', 'Mesorregião', 'Região imediata', 'Região intermediária', 'Votos',
      'Votos válidos do município', '% do local', '% da base', 'Posição no município'],
    p.mun.map((l) => {
      const m = uf.municipios[l[0]]
      return [m[0], nomeLocal(uf, 'micro', m[1]), nomeLocal(uf, 'meso', m[2]), nomeLocal(uf, 'rgi', m[3]),
        nomeLocal(uf, 'rgint', m[4]), l[1], l[2], pctCsv(l[3]), pctCsv(l[4]), l[5]]
    }),
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

function TabelaLocais({
  p, uf, tipo, aberto, setAberto,
}: {
  p: Perfil
  uf: DadosUF
  tipo: Tipo
  aberto: number | null
  setAberto: (id: number | null) => void
}) {
  const [ordem, setOrdem] = useState<Ordem>('votos')
  const linhas = useMemo(() => [...p[tipo]].sort((a, b) => b[COL[ordem]] - a[COL[ordem]]), [p, tipo, ordem])
  const munPorRegiao = useMemo(() => {
    const m = new Map<number, LinhaLocal[]>()
    for (const l of p.mun) {
      const reg = uf.municipios[l[0]]?.[IDX_TIPO[tipo]] as number
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
      <div className="titulo-com-acao">
        <p className="legenda-tab">
          <b>% do local</b>: fatia dos votos válidos do local que foi para {p.urna}. <b>% da base</b>: fatia da
          votação total dele que veio do local. Clique numa linha (ou no mapa) para ver os municípios.
        </p>
        <button className="botao" onClick={() => exportarMunicipios(p, uf)} title="Uma linha por município, com micro, meso e regiões do IBGE">
          Baixar CSV por município
        </button>
      </div>
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
              <tr
                id={`linha-${l[0]}`}
                className={`clicavel${aberto === l[0] ? ' destacado' : ''}`}
                onClick={() => setAberto(aberto === l[0] ? null : l[0])}
              >
                <td>
                  <span className="seta">{aberto === l[0] ? '▾' : '▸'}</span>{' '}
                  <LinkC className="sutil" to={`/r/${tipo}/${l[0]}`} onClick={(e) => e.stopPropagation()} title="Ver o top 10 desta região">
                    {nomeLocal(uf, tipo, l[0])}
                  </LinkC>
                </td>
                <td className="n">{num(l[1])}</td>
                <td className="n">{pct(l[3])}</td>
                <td className="n">{pct(l[4])}</td>
                <td className="n">{l[5]}º</td>
              </tr>
              {aberto === l[0] &&
                (munPorRegiao.get(l[0]) ?? []).map((m) => (
                  <tr key={m[0]} className="filho">
                    <td>
                      <LinkC className="sutil" to={`/r/mun/${m[0]}`} title="Ver o top 10 do município">
                        {nomeLocal(uf, 'mun', m[0])}
                      </LinkC>
                    </td>
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
