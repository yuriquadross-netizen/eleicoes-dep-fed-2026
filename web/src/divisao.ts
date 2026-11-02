// Divisão regional preferida (antiga: meso/micro; atual: intermediária/imediata), lembrada no navegador.
import { useState } from 'react'

export type Divisao = 'antiga' | 'atual'
const CHAVE = 'base-de-votos:divisao'

export function useDivisao(): [Divisao, (d: Divisao) => void] {
  const [d, setD] = useState<Divisao>(() => {
    try {
      return localStorage.getItem(CHAVE) === 'atual' ? 'atual' : 'antiga'
    } catch {
      return 'antiga'
    }
  })
  const set = (novo: Divisao) => {
    setD(novo)
    try {
      localStorage.setItem(CHAVE, novo)
    } catch {
      /* armazenamento indisponível: só não lembra */
    }
  }
  return [d, set]
}

export const TIPOS_DIVISAO = {
  antiga: { maior: 'meso', menor: 'micro', rotulo: 'Meso/Micro (IBGE até 2017)' },
  atual: { maior: 'rgint', menor: 'rgi', rotulo: 'Intermediária/Imediata (IBGE atual)' },
} as const
