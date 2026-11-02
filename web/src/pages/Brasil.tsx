import { Link } from 'react-router-dom'
import BarraIdeo from '../components/BarraIdeo'
import { api, NOME_UF } from '../dados'
import { num, useCarregar, useTitulo } from '../formato'

export default function Brasil() {
  useTitulo('Estados')
  const [meta, erro] = useCarregar(() => api.meta(), [])
  if (erro) return <p className="aviso">Não foi possível carregar os dados ({erro}).</p>
  if (!meta) return <p className="aviso">Carregando…</p>

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
          {num(total.eleitos)} cadeiras · {num(total.validos)} votos válidos para deputado federal
        </h3>
        <BarraIdeo ideo={[total.d / total.validos, total.c / total.validos, total.e / total.validos]} />
      </div>
      {Object.entries(meta.regioes).map(([sigla, r]) => (
        <div key={sigla}>
          <h2>{r.nome}</h2>
          <div className="grade-ufs">
            {r.ufs.map((uf) => {
              const i = meta.ufs_info[uf]
              return (
                <Link key={uf} to={`/uf/${uf}`} className="card-uf">
                  <strong>{NOME_UF[uf]}</strong>
                  <small>
                    {i.eleitos} cadeiras · {num(i.validos)} válidos
                  </small>
                  <BarraIdeo ideo={i.ideo} compacta />
                </Link>
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
