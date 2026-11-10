// Bloco do perfil com a tipologia da base eleitoral (Ames): tipo, os dois índices e o percentil na UF.
import { Link } from 'react-router-dom'
import { TIPO_BASE, type Tipologia } from '../dados'
import { pct } from '../formato'

function Medidor({ rotulo, valor, percentil, ajuda }: { rotulo: string; valor: string; percentil: number; ajuda: string }) {
  const p = Math.round(percentil * 100)
  return (
    <div className="medidor" title={ajuda}>
      <div className="medidor-topo">
        <span>{rotulo}</span>
        <b>{valor}</b>
      </div>
      <div className="medidor-trilho" aria-hidden>
        <span className="medidor-mediana" />
        <span className="medidor-ponto" style={{ left: `${p}%` }} />
      </div>
      <div className="medidor-nota">
        maior que {p}% dos eleitos da UF
      </div>
    </div>
  )
}

export default function BaseTipologia({ t, uf }: { t: Tipologia; uf: string }) {
  const info = TIPO_BASE[t.tipo]
  return (
    <section className="bloco tipologia">
      <h3>
        Tipo de base eleitoral · <Link to="/metodo">como é calculado</Link>
      </h3>
      <p className="tipo-nome">{info.nome}</p>
      <p className="tipo-desc">{info.descricao}</p>
      <div className="medidores">
        <Medidor
          rotulo="Concentração"
          valor={pct(t.concentracao, 0)}
          percentil={t.pct_concentracao}
          ajuda="Quanto a votação dele se afasta da distribuição do eleitorado da UF (índice G)"
        />
        <Medidor
          rotulo="Dominância"
          valor={pct(t.dominancia, 1)}
          percentil={t.pct_dominancia}
          ajuda="Fatia média dele nos votos válidos dos municípios onde tem voto, ponderada pelo peso de cada um na votação dele"
        />
      </div>
      <p className="tipo-notas">
        {t.contigua
          ? 'A área forte forma uma mancha contínua no mapa.'
          : 'A área forte aparece em retalhos, sem continuidade no mapa.'}
        {t.perto_do_limite && ' Está perto da fronteira entre dois tipos: leia o rótulo com cautela.'}
        {t.confiabilidade === 'baixa' && ` ${uf} tem poucos municípios, o que torna a tipologia menos confiável.`}
        {' '}A linha vertical marca a mediana dos eleitos de {uf}, que separa os tipos.
      </p>
    </section>
  )
}
