import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiDe, NOME_SIT, NOME_UF, normalizar, type LinhaBusca } from '../dados'
import { num, useCarregar, useTitulo } from '../formato'
import { useCargo } from '../cargo'
import LinkC from '../components/LinkC'

const LIMITE = 200

export default function Busca() {
  const cargo = useCargo()
  useTitulo('')
  const [linhas, erro] = useCarregar(() => apiDe(cargo).busca(), [cargo])
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const uf = params.get('uf') ?? ''
  const partido = params.get('partido') ?? ''
  const todos = params.get('todos') === '1'
  const [texto, setTexto] = useState(q)

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }

  const indice = useMemo(
    () => (linhas ?? []).map((l) => ({ l, chave: normalizar(`${l[1]} ${l[2]} ${l[3]}`) })),
    [linhas],
  )
  const partidos = useMemo(() => [...new Set((linhas ?? []).map((l) => l[3]))].sort(), [linhas])

  const resultado = useMemo(() => {
    const termos = normalizar(q).split(/\s+/).filter(Boolean)
    return indice
      .filter(({ l, chave }) => {
        if (!todos && l[5] !== 'E') return false
        if (uf && l[4] !== uf) return false
        if (partido && l[3] !== partido) return false
        return termos.every((t) => chave.includes(t))
      })
      .map((x) => x.l)
  }, [indice, q, uf, partido, todos])

  if (erro) return <p className="aviso">Não foi possível carregar os dados ({erro}).</p>

  return (
    <section>
      <h1>Buscar candidato</h1>
      <div className="filtros">
        <input
          type="search"
          autoFocus
          placeholder="Nome, nome de urna ou partido"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            set('q', e.target.value)
          }}
        />
        <select value={uf} onChange={(e) => set('uf', e.target.value)} aria-label="UF">
          <option value="">Todas as UFs</option>
          {Object.entries(NOME_UF).map(([s, n]) => (
            <option key={s} value={s}>
              {s} · {n}
            </option>
          ))}
        </select>
        <select value={partido} onChange={(e) => set('partido', e.target.value)} aria-label="Partido">
          <option value="">Todos os partidos</option>
          {partidos.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={todos} onChange={(e) => set('todos', e.target.checked ? '1' : '')} />
          Incluir suplentes e não eleitos
        </label>
      </div>

      {!linhas ? (
        <p className="aviso">Carregando…</p>
      ) : (
        <>
          <p className="contagem">
            {num(resultado.length)} {resultado.length === 1 ? 'candidato' : 'candidatos'}
            {resultado.length > LIMITE && ` · mostrando os ${LIMITE} mais votados`}
          </p>
          <table className="tabela">
            <thead>
              <tr>
                <th>Candidato</th>
                <th>Partido</th>
                <th>UF</th>
                <th>Situação</th>
                <th className="n">Votos</th>
              </tr>
            </thead>
            <tbody>
              {resultado.slice(0, LIMITE).map((l: LinhaBusca) => (
                <tr key={l[0]}>
                  <td>
                    <LinkC to={`/candidato/${l[0]}`}>{l[1]}</LinkC>
                    <small>{l[2]}</small>
                  </td>
                  <td>{l[3]}</td>
                  <td>{l[4]}</td>
                  <td>
                    <span className={`sit sit-${l[5]}`}>{NOME_SIT[l[5]]}</span>
                  </td>
                  <td className="n">{num(l[6])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
