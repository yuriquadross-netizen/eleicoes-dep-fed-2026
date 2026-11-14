
import BarraIdeo from '../components/BarraIdeo'
import { apiDe, NOME_UF } from '../dados'
import { num, useCarregar, useTitulo } from '../formato'
import { nomeDoCargo, useCargo } from '../cargo'
import LinkC from '../components/LinkC'
import Esqueleto from '../components/Esqueleto'

export default function Brasil() {
  const cargo = useCargo()
  useTitulo('Estados')
  const [meta, erro] = useCarregar(() => apiDe(cargo).meta(), [cargo])
  if (erro) return <p className="aviso">Não foi possível carregar os dados ({erro}).</p>
  if (!meta) return <Esqueleto />

  const total = Object.values(meta.ufs_info).reduce(
    (a, u) => ({ eleitos: a.eleitos + u.eleitos, validos: a.validos + u.validos,
      d: a.d + u.ideo[0] * u.validos, c: a.c + u.ideo[1] * u.validos, e: a.e + u.ideo[2] * u.validos }),
    { eleitos: 0, validos: 0, d: 0, c: 0, e: 0 },
  )

  return (
    <section>
      <h1>Brasil</h1>
      <div className="bloco">
        <h3>
          {num(total.eleitos)} cadeiras · {num(total.validos)} votos válidos para {nomeDoCargo(cargo)}
        </h3>
        <BarraIdeo ideo={[total.d / total.validos, total.c / total.validos, total.e / total.validos]} />
      </div>
      {Object.entries(meta.regioes).map(([sigla, r]) => (
        <div key={sigla}>
          <h2>{r.nome}</h2>
          <div className="grade-ufs">
            {r.ufs.map((uf) => {
              const i = meta.ufs_info[uf]
              if (!i) {
                // UF ainda sem dados neste cargo (estaduais entram por etapas)
                return (
                  <div key={uf} className="card-uf indisponivel">
                    <strong>{NOME_UF[uf]}</strong>
                    <small>em breve</small>
                  </div>
                )
              }
              return (
                <LinkC key={uf} to={`/uf/${uf}`} className="card-uf">
                  <strong>{NOME_UF[uf]}</strong>
                  <small>
                    {i.eleitos} cadeiras · {num(i.validos)} válidos
                  </small>
                  <BarraIdeo ideo={i.ideo} compacta />
                </LinkC>
              )
            })}
          </div>
        </div>
      ))}
      <p className="legenda-tab" style={{ marginTop: '1.5rem' }}>
        Barras: <span className="sit">Direita · Centro · Esquerda</span>. {meta.ideologia}
      </p>
    </section>
  )
}
