// Movimento da casa (Fase 4, D23): mola criticamente amortecida, sem salto. A mola parte do valor
// que está na tela (com a velocidade que tiver) e aceita interrupção: clicar de novo no meio do
// caminho só muda o destino. Salto (bounce > 0) fica reservado a gestos com impulso (arrasto, flick).
import { useLayoutEffect, useRef } from 'react'
import { animate } from 'motion'

/** Mola padrão: reposicionamento de indicadores (pílula do seletor, traço da aba). */
export const MOLA = { type: 'spring', bounce: 0, duration: 0.35 } as const

export const movimentoReduzido = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Indicador deslizante: um único elemento que acompanha a opção ativa do grupo (o botão com
 * aria-pressed ou aria-selected "true"). `chave` muda quando a escolha ou os rótulos mudam.
 * Devolve as refs do grupo e do indicador.
 */
export function useIndicador<G extends HTMLElement, I extends HTMLElement>(chave: string) {
  const grupo = useRef<G>(null)
  const indicador = useRef<I>(null)
  const pronto = useRef(false)

  const posicionar = (animado: boolean) => {
    const g = grupo.current
    const i = indicador.current
    const alvo = g?.querySelector<HTMLElement>('[aria-pressed="true"], [aria-selected="true"]')
    if (!i || !alvo) return
    animate(i, { x: alvo.offsetLeft, width: alvo.offsetWidth }, animado && !movimentoReduzido() ? MOLA : { duration: 0 })
    i.style.opacity = '1'
  }

  // a escolha mudou: desliza (na primeira vez, só posiciona)
  useLayoutEffect(() => {
    posicionar(pronto.current)
    pronto.current = true
     
  }, [chave])

  // a largura do grupo mudou (tela girou, fonte carregou): reposiciona sem animar
  useLayoutEffect(() => {
    let largura = grupo.current?.offsetWidth
    const obs = new ResizeObserver(([e]) => {
      const nova = Math.round(e.contentRect.width)
      // o observador dispara uma vez ao ser criado; só interessa mudança real de largura
      if (largura !== undefined && Math.abs(nova - Math.round(largura)) < 1) return
      largura = nova
      posicionar(false)
    })
    if (grupo.current) {
      largura = grupo.current.clientWidth
      obs.observe(grupo.current)
    }
    return () => obs.disconnect()
     
  }, [])

  return { grupo, indicador }
}
