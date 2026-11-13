import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { Topology } from 'topojson-specification'
import BarraIdeo from '../components/BarraIdeo'
import DispersaoTipologia from '../components/DispersaoTipologia'
import Foto from '../components/Foto'
import { baixarCsv, pctCsv } from '../csv'
import MapaUF, { type ItemMapa } from '../components/MapaUF'
import { apiDe, geo, NOME_TIPO, NOME_UF, TIPO_BASE, type DadosUF, type Meta, type Tipo, type TipoBase } from '../dados'
import { TIPOS_DIVISAO, useDivisao } from '../divisao'
import { num, pct, useCarregar, useTitulo } from '../formato'
import { useCargo } from '../cargo'
import LinkC, { useNavegarC } from '../components/LinkC'
import Abas from '../components/Abas'
import Esqueleto from '../components/Esqueleto'
import Segmentado from '../components/Segmentado'

const METRICAS = [
  { k: -1, rotulo: 'Campo predominante' },
  { k: 0, rotulo: '% Direita' },
  { k: 1, rotulo: '% Centro' },
  { k: 2, rotulo: '% Esquerda' },
] as const
type Metrica = (typeof METRICAS)[number]['k']

const CAMPOS = ['Direita', 'Centro', 'Esquerda'] as const
const RAMPAS = ['verde', 'amarelo', 'vermelho'] as const
/** Faixas da fatia do campo vencedor → tons 1..6 da rampa (o tom 0, quase branco, fica de fora). */
const FAIXAS = [0.4, 0.45, 0.5, 0.55, 0.65]
const ROTULOS_FAIXAS = ['<40%', '40–45%', '45–50%', '50–55%', '55–65%', '≥65%']

function faixa(fatia: number): number {
  let k = 0
  while (k < FAIXAS.length && fatia >= FAIXAS[k]) k++
  return k + 1
}

/** Campo vencedor e sua fatia dos válidos. */
function predominante(ideo: [number, number, number]): { campo: 0 | 1 | 2; fatia: number } {
  const campo = ideo.indexOf(Math.max(...ideo)) as 0 | 1 | 2
  return { campo, fatia: ideo[campo] }
}

function LegendaPredominante() {
  return (
    <figcaption className="legenda-mapa legenda-pred">
      <span className="legenda-titulo">Cor = campo com mais votos na região; quanto mais escuro, maior a fatia dos válidos desse campo</span>
      {CAMPOS.map((c, i) => (
        <span key={c} className="pred-linha">
          <span className="pred-nome">{c}</span>
          <span className="rampa rampa-6">
            {ROTULOS_FAIXAS.map((r, k) => (
              <i key={r} style={{ background: `var(--seq-${RAMPAS[i]}-${k + 1})` }} title={`${c} com ${r} dos válidos`} />
            ))}
          </span>
        </span>
      ))}
      <span className="pred-linha">
        <span className="pred-nome" />
        <span className="rampa-rotulos">
          {ROTULOS_FAIXAS.map((r) => (
            <span key={r}>{r}</span>
          ))}
        </span>
      </span>
    </figcaption>
  )
}

export default function UF() {
  const cargo = useCargo()
  const { uf = '' } = useParams()
  const sigla = uf.toUpperCase()
  useTitulo(NOME_UF[sigla] ?? sigla)
  const [d, erro] = useCarregar(
    () => Promise.all([apiDe(cargo).uf(sigla), geo(sigla), apiDe(cargo).meta()]).then(([u, t, m]) => ({ u, t, m })),
    [sigla, cargo],
  )
  if (erro) return <p className="aviso">{cargo === 'estadual' ? `Ainda não há dados de deputados estaduais para ${NOME_UF[sigla] ?? sigla}.` : `UF não encontrada (${erro}).`}</p>
  if (!d) return <Esqueleto />
  return <Conteudo u={d.u} topo={d.t} meta={d.m} />
}

function Conteudo({ u, topo, meta }: { u: DadosUF; topo: Topology; meta: Meta }) {
  const [divisao, setDivisao] = useDivisao()
  const [nivel, setNivel] = useState<'maior' | 'menor'>('menor')
  const [metrica, setMetrica] = useState<Metrica>(-1)
  const navegar = useNavegarC()
  const tipo: Tipo = TIPOS_DIVISAO[divisao][nivel]
  const regioes = u.regioes[tipo]

  const itens = useMemo(() => {
    const m = new Map<number, ItemMapa>()
    for (const [id, r] of Object.entries(regioes)) {
      const pred = r.ideo ? predominante(r.ideo) : null
      m.set(Number(id), {
        nome: r.nome,
        valor: metrica === -1 ? (pred?.fatia ?? 0) : (r.ideo?.[metrica] ?? 0),
        cor: metrica === -1 && pred ? `var(--seq-${RAMPAS[pred.campo]}-${faixa(pred.fatia)})` : undefined,
        detalhes: [
          ...(pred ? ([['Predomina', `${CAMPOS[pred.campo]} (${pct(pred.fatia)})`]] as [string, string][]) : []),
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
        <LinkC to="/brasil">Brasil</LinkC> › {nomeRegiao} › {NOME_UF[u.uf]}
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
        <Segmentado
          rotulo="Divisão regional"
          opcoes={(['antiga', 'atual'] as const).map((k) => ({ k, rotulo: TIPOS_DIVISAO[k].rotulo }))}
          valor={divisao}
          aoMudar={setDivisao}
        />
      </div>
      <Abas
        rotulo="Nível regional"
        opcoes={(['menor', 'maior'] as const).map((n) => ({ k: n, rotulo: NOME_TIPO[TIPOS_DIVISAO[divisao][n]].plural }))}
        valor={nivel}
        aoMudar={setNivel}
      />

      <div className="mapa-controles">
        <Segmentado rotulo="Colorir mapa por" opcoes={METRICAS} valor={metrica} aoMudar={setMetrica} />
        <span className="legenda-tab" style={{ margin: 0 }}>
          Clique numa região para ver o top 10.
        </span>
      </div>
      <MapaUF
        topo={topo}
        camada={tipo}
        itens={itens}
        formatar={(v) => pct(v)}
        tituloLegenda={
          metrica === -1
            ? `Campo predominante por ${NOME_TIPO[tipo].singular.toLowerCase()}`
            : `${METRICAS[metrica + 1].rotulo} dos votos válidos por ${NOME_TIPO[tipo].singular.toLowerCase()}`
        }
        aoSelecionar={(id) => navegar(`/r/${tipo}/${id}`)}
        rampa={metrica === -1 ? undefined : RAMPAS[metrica]}
        legenda={metrica === -1 ? <LegendaPredominante /> : undefined}
      />

      {u.tipologia && <SecaoTipologia u={u} />}

      <div className="duas-colunas">
        <div>
          <div className="titulo-com-acao">
            <h2>{NOME_TIPO[tipo].plural}</h2>
            <button
              className="botao"
              onClick={() =>
                baixarCsv(
                  `${u.uf} ${NOME_TIPO[tipo].plural} 2026.csv`,
                  [NOME_TIPO[tipo].singular, 'Votos válidos', '% Direita', '% Centro', '% Esquerda', 'Campo predominante',
                    'Mais votado', 'Partido', '% do local (mais votado)'],
                  linhas.map(([, r]) => [
                    r.nome, r.validos, ...(r.ideo ? r.ideo.map(pctCsv) : ['', '', '']),
                    r.ideo ? CAMPOS[predominante(r.ideo).campo] : '',
                    r.lider?.[1], r.lider?.[2], r.lider ? pctCsv(r.lider[4]) : '',
                  ]),
                )
              }
            >
              Baixar CSV
            </button>
          </div>
          <div className="rolagem"><table className="tabela">
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
                    <LinkC to={`/r/${tipo}/${id}`}>{r.nome}</LinkC>
                  </td>
                  <td className="n">{num(r.validos)}</td>
                  <td>
                    <BarraIdeo ideo={r.ideo} compacta />
                  </td>
                  <td>
                    {r.lider && (
                      <>
                        <LinkC className="sutil" to={`/candidato/${r.lider[0]}`}>
                          {r.lider[1]}
                        </LinkC>
                        <small>
                          {r.lider[2]} · {pct(r.lider[4])}
                        </small>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
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
          <div className="rolagem"><table className="tabela">
            <tbody>
              {u.eleitos.map((e, i) => (
                <tr key={e[0]}>
                  <td className="pos">{i + 1}</td>
                  <td className="com-foto">
                    <Foto sq={e[0]} nome={e[1]} />
                    <span>
                      <LinkC to={`/candidato/${e[0]}`}>{e[1]}</LinkC>
                      <small>{e[2]}</small>
                    </span>
                  </td>
                  <td className="n">{num(e[3])}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>
    </article>
  )
}

function SecaoTipologia({ u }: { u: DadosUF }) {
  const tip = u.tipologia!
  const grupos = (Object.keys(TIPO_BASE) as TipoBase[]).map((t) => ({
    t,
    lista: tip.eleitos.filter((e) => e[6] === t).sort((a, b) => a[1].localeCompare(b[1])),
  }))
  return (
    <section>
      <div className="titulo-com-acao">
        <h2>Tipo de base dos eleitos</h2>
        <LinkC to="/metodo" className="legenda-tab">
          como é calculado
        </LinkC>
      </div>
      {tip.confiabilidade === 'baixa' && (
        <p className="legenda-tab">{NOME_UF[u.uf]} tem poucos municípios: leia a tipologia com cautela.</p>
      )}
      <DispersaoTipologia tip={tip} />
      <div className="grade-tipos">
        {grupos.map(({ t, lista }) => (
          <div key={t} className="bloco">
            <h3>
              {TIPO_BASE[t].nome} · {lista.length}
            </h3>
            <p className="legenda-tab">{TIPO_BASE[t].descricao}</p>
            <p className="nomes">
              {lista.map((e, i) => (
                <span key={e[0]}>
                  <LinkC to={`/candidato/${e[0]}`}>{e[1]}</LinkC> <small>{e[2]}</small>
                  {i < lista.length - 1 ? ' · ' : ''}
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
