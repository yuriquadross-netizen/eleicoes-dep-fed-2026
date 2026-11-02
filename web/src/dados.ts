// Camada de dados: tipos dos JSON gerados por pipeline/exportar_web.py e leitura com cache.

export type Tipo = 'micro' | 'meso' | 'rgi' | 'rgint'
export type Nivel = Tipo | 'mun'
export type SitCod = 'E' | 'S' | 'N' | 'O'

/** [id, votos, válidos do local, % do local, % da base, posição no local] */
export type LinhaLocal = [number, number, number, number, number, number]

export interface Perfil {
  sq: number
  nr: string
  nome: string
  urna: string
  partido: string
  federacao: string | null
  uf: string
  situacao: string
  situacao_tse: string
  votos: number
  pos_uf: number
  mun: LinhaLocal[]
  micro: LinhaLocal[]
  meso: LinhaLocal[]
  rgi: LinhaLocal[]
  rgint: LinhaLocal[]
}

export interface Regiao {
  nome: string
  validos: number
  pai?: number
}

export interface DadosUF {
  uf: string
  regiao: string
  validos: number
  /** cd_ibge → [nome, micro, meso, rgi, rgint, válidos] */
  municipios: Record<string, [string, number, number, number, number, number]>
  regioes: Record<Tipo, Record<string, Regiao>>
  /** [sq, urna, partido, votos] */
  eleitos: [number, string, string, number][]
  bancada: Record<string, number>
  n_candidatos: number
}

/** [sq, urna, nome, partido, uf, sit, votos] */
export type LinhaBusca = [number, string, string, string, string, SitCod, number]

export interface Meta {
  ano: number
  gerado_em: string
  ufs: string[]
  regioes: Record<string, { nome: string; ufs: string[] }>
  fonte: string
}

/** [sq, urna, partido, sit, votos, % do local, % da base] */
export type LinhaTop = [number, string, string, SitCod, number, number, number]
export interface TopRegiao {
  tipo: Nivel
  id: number
  uf: string
  validos: number
  top: LinhaTop[]
}

const cache = new Map<string, Promise<unknown>>()

function get<T>(caminho: string): Promise<T> {
  if (!cache.has(caminho)) {
    const p = fetch(`./${caminho}`).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ao carregar ${caminho}`)
      return r.json()
    })
    p.catch(() => cache.delete(caminho))
    cache.set(caminho, p)
  }
  return cache.get(caminho) as Promise<T>
}

export const ANO = 2026

export const api = {
  meta: () => get<Meta>(`data/${ANO}/meta.json`),
  busca: () =>
    get<{ campos: string[]; linhas: LinhaBusca[] }>(`data/${ANO}/busca.json`).then((b) => b.linhas),
  perfil: (sq: number | string) => get<Perfil>(`data/${ANO}/candidato/${sq}.json`),
  uf: (uf: string) => get<DadosUF>(`data/${ANO}/uf/${uf}.json`),
  top: (tipo: Nivel, id: number | string) => get<TopRegiao>(`data/${ANO}/regiao/${tipo}/${id}.json`),
}

export const NOME_TIPO: Record<Nivel, { singular: string; plural: string }> = {
  micro: { singular: 'Microrregião', plural: 'Microrregiões' },
  meso: { singular: 'Mesorregião', plural: 'Mesorregiões' },
  rgi: { singular: 'Região imediata', plural: 'Regiões imediatas' },
  rgint: { singular: 'Região intermediária', plural: 'Regiões intermediárias' },
  mun: { singular: 'Município', plural: 'Municípios' },
}

export const NOME_SIT: Record<SitCod, string> = { E: 'Eleito', S: 'Suplente', N: 'Não eleito', O: '—' }

export const NOME_UF: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais',
  MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco',
  PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia',
  RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo',
  TO: 'Tocantins',
}

/** Nome de um local (região ou município) a partir dos dados da UF. */
export function nomeLocal(uf: DadosUF, nivel: Nivel, id: number): string {
  if (nivel === 'mun') return uf.municipios[id]?.[0] ?? String(id)
  return uf.regioes[nivel][id]?.nome ?? String(id)
}

/** Normaliza texto para busca: minúsculas, sem acentos. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
