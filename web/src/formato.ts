import { useEffect, useState } from 'react'

const nf = new Intl.NumberFormat('pt-BR')

export const num = (n: number) => nf.format(n)

export function pct(x: number, casas = 1): string {
  if (x > 0 && x < 0.0005) return '<0,1%'
  return `${(x * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
}

export function useTitulo(titulo: string) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · Base de Votos` : 'Base de Votos'
  }, [titulo])
}

/** Carrega uma promessa e devolve [dado, erro]. Refaz quando as dependências mudam. */
export function useCarregar<T>(fn: () => Promise<T>, deps: unknown[]): [T | undefined, string | undefined] {
  const [estado, setEstado] = useState<{ dado?: T; erro?: string; chave: string }>({ chave: '' })
  const chave = JSON.stringify(deps)
  useEffect(() => {
    let vivo = true
    fn().then(
      (dado) => vivo && setEstado({ dado, chave }),
      (e: Error) => vivo && setEstado({ erro: e.message, chave }),
    )
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])
  return estado.chave === chave ? [estado.dado, estado.erro] : [undefined, undefined]
}
