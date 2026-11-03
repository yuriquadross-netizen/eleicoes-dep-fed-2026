import type { Topology } from 'topojson-specification'

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
  /** campo ideológico do parlamentar: o próprio, se marcado, senão o do partido */
  classe?: Classe | null
  /** campo do partido (config/partidos_ideologia.csv) */
  classe_partido?: Classe | null
  /** presente quando o parlamentar foi marcado com campo próprio (config/candidatos_ideologia.csv); texto = observação */
  posicao_propria?: string | null
  mun: LinhaLocal[]
  micro: LinhaLocal[]
  meso: LinhaLocal[]
  rgi: LinhaLocal[]
  rgint: LinhaLocal[]
}

/** [direita, centro, esquerda] como fração dos votos válidos */
export type Ideo = [number, number, number]

export interface Regiao {
  nome: string
  validos: number
  pai?: number
  ideo: Ideo | null
  /** candidato mais votado: [sq, urna, partido, votos, % do local] */
  lider?: [number, string, string, number, number]
}

export interface DadosUF {
  uf: string
  regiao: string
  validos: number
  ideo: Ideo
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
  ufs_info: Record<string, { eleitos: number; validos: number; ideo: Ideo }>
  /** [sq, urna, partido, uf, campo marcado, campo do partido, observação] */
  posicoes_proprias?: [number, string, string, string, string, string, string][]
  classes: string[]
  ideologia: string
  fonte: string
}

/** [sq, urna, partido, sit, votos, % do local, % da base] */
export type LinhaTop = [number, string, string, SitCod, number, number, number]
export interface TopRegiao {
  tipo: Nivel
  id: number
  uf: string
  validos: number
  ideo: Ideo | null
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

/** Perfis agrupados em arquivos por sq % GRUPOS (mesmo número de pipeline/exportar_web.py). */
const GRUPOS_CANDIDATO = 256
export function grupoCandidato(sq: number | string): number {
  // sq tem 12 dígitos: cabe com folga num número de ponto flutuante
  return Number(sq) % GRUPOS_CANDIDATO
}
function existe<T>(x: T | undefined, oque: string): T {
  if (x === undefined) throw new Error(`${oque} ausente dos dados de ${ANO}`)
  return x
}

export const api = {
  meta: () => get<Meta>(`data/${ANO}/meta.json`),
  busca: () =>
    get<{ campos: string[]; linhas: LinhaBusca[] }>(`data/${ANO}/busca.json`).then((b) => b.linhas),
  perfil: (sq: number | string) =>
    get<Record<string, Perfil>>(`data/${ANO}/candidato/${grupoCandidato(sq)}.json`).then((g) => existe(g[String(sq)], 'Candidato')),
  uf: (uf: string) => get<DadosUF>(`data/${ANO}/uf/${uf}.json`),
  top: (tipo: Nivel, id: number | string) =>
    get<Record<string, TopRegiao>>(`data/${ANO}/regiao/${tipo}/${String(id).slice(0, 2)}.json`).then((g) =>
      existe(g[String(id)], 'Região'),
    ),
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

const geoCache = new Map<string, Promise<Topology>>()
/** TopoJSON da UF com as camadas mun, micro, meso, rgi, rgint (gerado por pipeline/geometrias.py). */
export function geo(uf: string): Promise<Topology> {
  if (!geoCache.has(uf)) {
    const p = fetch(`./geo/${uf}.json`).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ao carregar mapa de ${uf}`)
      return r.json() as Promise<Topology>
    })
    p.catch(() => geoCache.delete(uf))
    geoCache.set(uf, p)
  }
  return geoCache.get(uf)!
}

/** Tipo pai de cada recorte (micro → meso, rgi → rgint). */
export const PAI: Partial<Record<Nivel, Tipo>> = { micro: 'meso', rgi: 'rgint' }
/** Filhos de cada recorte. */
export const FILHO: Record<Tipo, Nivel> = { meso: 'micro', rgint: 'rgi', micro: 'mun', rgi: 'mun' }
/** Posição do recorte no array de municípios [nome, micro, meso, rgi, rgint, válidos]. */
export const IDX_TIPO: Record<Tipo, number> = { micro: 1, meso: 2, rgi: 3, rgint: 4 }

export type Classe = 'Direita' | 'Centro' | 'Esquerda'
/** Escala de cor de cada campo: Direita = verde, Centro = amarelo, Esquerda = vermelho. */
export const RAMPA_CLASSE: Record<Classe, 'verde' | 'amarelo' | 'vermelho'> = {
  Direita: 'verde',
  Centro: 'amarelo',
  Esquerda: 'vermelho',
}
