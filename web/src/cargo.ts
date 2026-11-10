// Cargo em exibição (Fase 2): derivado do endereço. Federal mantém os endereços de sempre;
// estadual usa o prefixo #/estadual/... e lê os dados de data/2026e/.
import { useLocation } from 'react-router-dom'

export type Cargo = 'federal' | 'estadual'
export const PREFIXO_ESTADUAL = '/estadual'

export const NOME_CARGO: Record<Cargo, { curto: string; plural: string; casa: string; casaUF: (uf: string) => string }> = {
  federal: {
    curto: 'Federal',
    plural: 'Deputados Federais',
    casa: 'Câmara dos Deputados',
    casaUF: () => 'Bancada na Câmara dos Deputados',
  },
  estadual: {
    curto: 'Estadual',
    plural: 'Deputados Estaduais',
    casa: 'Assembleias Legislativas',
    casaUF: (uf) => (uf === 'DF' ? 'Câmara Legislativa do DF' : 'Assembleia Legislativa'),
  },
}

/** "deputado federal", "deputado estadual" ou, no DF, "deputado distrital". */
export function nomeDoCargo(cargo: Cargo, uf?: string): string {
  if (cargo === 'federal') return 'deputado federal'
  return uf === 'DF' ? 'deputado distrital' : 'deputado estadual'
}

export function cargoDoCaminho(caminho: string): Cargo {
  return caminho === PREFIXO_ESTADUAL || caminho.startsWith(`${PREFIXO_ESTADUAL}/`) ? 'estadual' : 'federal'
}

export function useCargo(): Cargo {
  return cargoDoCaminho(useLocation().pathname)
}

/** Monta o endereço de uma página no cargo dado (ex.: rota('estadual', '/uf/MG') → '/estadual/uf/MG'). */
export function rota(cargo: Cargo, caminho: string): string {
  return cargo === 'estadual' ? `${PREFIXO_ESTADUAL}${caminho === '/' ? '' : caminho}` : caminho
}

/** Atalho para páginas: const r = useRota(); <Link to={r('/uf/MG')}> */
export function useRota(): (caminho: string) => string {
  const cargo = useCargo()
  return (caminho: string) => rota(cargo, caminho)
}

/** Ao trocar de cargo, abre a página equivalente; o perfil (pessoa diferente) volta para a busca. */
export function equivalente(caminho: string, busca: string, destino: Cargo): string {
  const semPrefixo = cargoDoCaminho(caminho) === 'estadual' ? caminho.slice(PREFIXO_ESTADUAL.length) || '/' : caminho
  let alvo = semPrefixo
  if (semPrefixo.startsWith('/candidato/')) alvo = '/buscar'
  if (semPrefixo === '/' && destino === 'estadual') alvo = '/buscar' // a home é da Câmara
  if (['/edicao', '/metodo'].includes(semPrefixo)) alvo = semPrefixo
  return rota(destino, alvo) + (alvo === semPrefixo ? busca : '')
}
