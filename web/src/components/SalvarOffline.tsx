// Botão que baixa todos os dados, mapas e fotos para o app funcionar sem internet.
// Grava direto no Cache Storage com os mesmos nomes de cache do service worker (vite.config.ts).
import { useState } from 'react'
import { ANO } from '../dados'

const CHAVE = 'base-de-votos:offline-em'
const PARALELO = 6

function lerData(): string | null {
  try {
    return localStorage.getItem(CHAVE)
  } catch {
    return null
  }
}

export default function SalvarOffline() {
  const [estado, setEstado] = useState<{ feito: number; total: number } | null>(null)
  const [salvoEm, setSalvoEm] = useState<string | null>(lerData)
  const [erro, setErro] = useState<string | null>(null)

  if (typeof caches === 'undefined') return null

  async function salvar() {
    setErro(null)
    try {
      await navigator.storage?.persist?.()
      const lista = await fetch(`./data/${ANO}/arquivos.json`, { cache: 'no-store' }).then((r) => r.json())
      // os dados são pedidos com ?v=<versão> (dados.ts); salva exatamente esses endereços
      const meta = await fetch(`./data/${ANO}/meta.json`, { cache: 'no-store' }).then((r) => r.json())
      const v = encodeURIComponent(meta.gerado_em ?? '')
      const versionado = (a: string) => a.startsWith('data/') && !/(meta|arquivos)\.json$/.test(a)
      const arquivos: string[] = lista.arquivos
      const dados = await caches.open('base-de-votos-dados')
      const fotos = await caches.open('base-de-votos-fotos')
      let feito = 0
      setEstado({ feito, total: arquivos.length })
      const fila = [...arquivos]
      const trabalhador = async () => {
        for (let a = fila.shift(); a; a = fila.shift()) {
          const url = new URL(`./${a}${versionado(a) ? `?v=${v}` : ''}`, location.href).href
          const resp = await fetch(url, { cache: 'no-cache' })
          if (!resp.ok) throw new Error(`${resp.status} em ${a}`)
          await (a.startsWith('fotos/') ? fotos : dados).put(url, resp)
          feito++
          if (feito % 20 === 0 || feito === arquivos.length) setEstado({ feito, total: arquivos.length })
        }
      }
      await Promise.all(Array.from({ length: PARALELO }, trabalhador))
      const quando = new Date().toLocaleDateString('pt-BR')
      try {
        localStorage.setItem(CHAVE, quando)
      } catch {
        /* sem armazenamento: só não lembra a data */
      }
      setSalvoEm(quando)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setEstado(null)
    }
  }

  return (
    <span className="offline">
      {estado ? (
        <span>
          Salvando para uso sem internet… {Math.round((estado.feito / estado.total) * 100)}%
        </span>
      ) : (
        <>
          <button className="botao" onClick={salvar}>
            {salvoEm ? 'Atualizar dados sem internet' : 'Salvar para usar sem internet (~60 MB)'}
          </button>
          {salvoEm && <span> Salvo em {salvoEm}.</span>}
          {erro && <span className="erro"> Não foi possível salvar ({erro}). Tente de novo com internet.</span>}
        </>
      )}
    </span>
  )
}
