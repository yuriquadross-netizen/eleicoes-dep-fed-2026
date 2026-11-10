// Edição do posicionamento ideológico direto pelo app.
// Grava config/candidatos_ideologia.csv no repositório via API do GitHub, com a chave de acesso
// (token) do dono, guardada só neste navegador. O commit em `main` dispara a republicação do site.
import { ANO, type Classe, type Perfil } from './dados'

export const REPO = 'yuriquadross-netizen/eleicoes-dep-fed-2026'
const ARQUIVO = 'config/candidatos_ideologia.csv'
const RAMO = 'main'
const API = 'https://api.github.com'
const CHAVE_TOKEN = 'base-de-votos:github-token'
const CABECALHO = ['ano', 'sq_candidato', 'nome_urna', 'uf', 'partido', 'classe', 'observacao']

// ---------- chave de acesso ----------
export function lerToken(): string | null {
  try {
    return localStorage.getItem(CHAVE_TOKEN)
  } catch {
    return null
  }
}
export function salvarToken(t: string | null) {
  try {
    if (t) localStorage.setItem(CHAVE_TOKEN, t.trim())
    else localStorage.removeItem(CHAVE_TOKEN)
  } catch {
    /* sem armazenamento: a edição não fica disponível */
  }
}

async function api(caminho: string, token: string, init: RequestInit = {}) {
  const r = await fetch(`${API}${caminho}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  })
  if (!r.ok) {
    const corpo = await r.json().catch(() => ({}))
    const erro = new Error(mensagemErro(r.status, corpo.message)) as Error & { status: number }
    erro.status = r.status
    throw erro
  }
  return r.json()
}

function mensagemErro(status: number, msg?: string): string {
  if (status === 401) return 'chave de acesso inválida ou expirada'
  if (status === 403) return 'a chave não tem permissão de escrita neste repositório (Contents: Read and write)'
  if (status === 404) return 'repositório ou arquivo não encontrado para esta chave (confira se ela inclui este repositório)'
  if (status === 409) return 'o arquivo mudou enquanto você salvava; tente de novo'
  return `GitHub respondeu ${status}${msg ? `: ${msg}` : ''}`
}

/** Confere a chave: precisa enxergar o repositório e poder escrever nele. */
export async function testarToken(token: string): Promise<string> {
  const repo = await api(`/repos/${REPO}`, token)
  if (!repo.permissions?.push) throw new Error('a chave enxerga o repositório, mas não tem permissão de escrita')
  return repo.full_name as string
}

// ---------- CSV (aspas quando há vírgula, aspas ou quebra de linha) ----------
export function lerCsv(texto: string): string[][] {
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === ',') {
      linha.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo)
      if (linha.some((x) => x !== '')) linhas.push(linha)
      linha = []
      campo = ''
    } else campo += c
  }
  linha.push(campo)
  if (linha.some((x) => x !== '')) linhas.push(linha)
  return linhas
}

export function escreverCsv(linhas: string[][]): string {
  const cel = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return linhas.map((l) => l.map(cel).join(',')).join('\n') + '\n'
}

const paraBase64 = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin)
}
const deBase64 = (b64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)))

/**
 * Grava (ou remove, se classe = null) o posicionamento próprio de um parlamentar.
 * Devolve o horário do commit, para acompanhar a republicação.
 */
export async function gravarPosicao(
  token: string,
  p: Perfil,
  classe: Classe | null,
  observacao: string,
): Promise<{ commit: string; quando: string }> {
  for (let tentativa = 1; ; tentativa++) {
    const atual = await api(`/repos/${REPO}/contents/${ARQUIVO}?ref=${RAMO}`, token)
    const linhas = lerCsv(deBase64(atual.content))
    const corpo = linhas.slice(1).filter((l) => !(l[0] === String(ANO) && l[1] === String(p.sq)))
    if (classe) {
      corpo.push([String(ANO), String(p.sq), p.urna, p.uf, p.partido, classe, observacao.trim()])
    }
    const texto = escreverCsv([CABECALHO, ...corpo])
    const mensagem = classe
      ? `Posicionamento: ${p.urna} (${p.partido}-${p.uf}) → ${classe}`
      : `Posicionamento: ${p.urna} (${p.partido}-${p.uf}) volta a seguir o partido`
    try {
      const r = await api(`/repos/${REPO}/contents/${ARQUIVO}`, token, {
        method: 'PUT',
        body: JSON.stringify({ message: mensagem, content: paraBase64(texto), sha: atual.sha, branch: RAMO }),
      })
      return { commit: r.commit.sha as string, quando: r.commit.committer?.date ?? new Date().toISOString() }
    } catch (e) {
      // outra edição entrou no meio: relê e tenta mais uma vez
      if ((e as { status?: number }).status === 409 && tentativa < 2) continue
      throw e
    }
  }
}

/** Estado da republicação disparada pelo commit (API pública, sem chave). */
export type EstadoPublicacao = 'aguardando' | 'publicando' | 'publicado' | 'substituida' | 'falhou'

export async function estadoPublicacao(commit: string): Promise<EstadoPublicacao> {
  const r = await fetch(`${API}/repos/${REPO}/actions/runs?branch=${RAMO}&head_sha=${commit}&per_page=5`)
  if (!r.ok) return 'aguardando'
  const runs = ((await r.json()).workflow_runs ?? []).filter((x: { name: string }) => x.name === 'Publicar app')
  if (!runs.length) return 'aguardando'
  const run = runs[0]
  if (run.status !== 'completed') return 'publicando'
  if (run.conclusion === 'success') return 'publicado'
  // uma edição mais nova cancela a publicação anterior (concurrency do deploy.yml)
  return run.conclusion === 'cancelled' ? 'substituida' : 'falhou'
}

/**
 * Depois de publicado, rebaixa só os arquivos afetados para o cache do uso sem internet
 * (sem apagar o resto do que foi salvo), para a página recarregada já vir atualizada.
 */
export async function atualizarArquivosDe(p: Perfil, grupoCandidato: number, codUf: string) {
  const arquivos = [
    `data/${ANO}/meta.json`,
    `data/${ANO}/uf/${p.uf}.json`,
    `data/${ANO}/candidato/${grupoCandidato}.json`,
    ...['micro', 'meso', 'rgi', 'rgint', 'mun'].map((t) => `data/${ANO}/regiao/${t}/${codUf}.json`),
  ]
  const cache = typeof caches !== 'undefined' ? await caches.open('base-de-votos-dados') : null
  await Promise.all(
    arquivos.map(async (a) => {
      const url = new URL(`./${a}`, location.href).href
      const r = await fetch(url, { cache: 'reload' })
      if (r.ok && cache) await cache.put(url, r)
    }),
  )
}
