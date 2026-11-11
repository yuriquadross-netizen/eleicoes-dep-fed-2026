// Editor do posicionamento ideológico de um parlamentar (só aparece para quem configurou a chave em #/edicao).
import { useEffect, useState } from 'react'
import { useCargo } from '../cargo'
import { type Classe, type Perfil } from '../dados'
import {
  atualizarArquivosDe, estadoPublicacao, gravarPosicao, lerToken, type EstadoPublicacao,
} from '../github'

const OPCOES: (Classe | '')[] = ['', 'Direita', 'Centro', 'Esquerda']

export default function EditarPosicao({ p }: { p: Perfil }) {
  const cargo = useCargo()
  const token = lerToken()
  const marcado = typeof p.posicao_propria === 'string'
  const [aberto, setAberto] = useState(false)
  const [classe, setClasse] = useState<Classe | ''>(marcado ? (p.classe ?? '') : '')
  const [obs, setObs] = useState(p.posicao_propria ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [commit, setCommit] = useState<string | null>(null)
  const [estado, setEstado] = useState<EstadoPublicacao | null>(null)

  // acompanha a republicação a cada 15 s, por até 15 min
  useEffect(() => {
    if (!commit) return
    let vivo = true
    let n = 0
    const passo = async () => {
      if (!vivo) return
      const e = await estadoPublicacao(commit).catch(() => 'aguardando' as const)
      if (!vivo) return
      setEstado(e)
      if (e === 'publicado') {
        await atualizarArquivosDe(cargo).catch(() => undefined)
        return
      }
      if (e === 'falhou' || e === 'substituida' || ++n > 60) return
      setTimeout(passo, 15000)
    }
    setTimeout(passo, 5000)
    return () => {
      vivo = false
    }
  }, [commit, cargo])

  // visitantes (sem chave) não veem nada; a edição se ativa pelo link "Edição" do rodapé
  if (!token) return null

  const salvar = async () => {
    setSalvando(true)
    setErro(null)
    try {
      const r = await gravarPosicao(token, p, classe || null, obs, cargo)
      setCommit(r.commit)
      setEstado('aguardando')
      setAberto(false)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="edicao">
      {!aberto && (
        <button className="botao" onClick={() => setAberto(true)} disabled={salvando}>
          Editar posicionamento
        </button>
      )}
      {aberto && (
        <div className="edicao-form">
          <label>
            Campo de {p.urna}
            <select value={classe} onChange={(e) => setClasse(e.target.value as Classe | '')}>
              {OPCOES.map((o) => (
                <option key={o} value={o}>
                  {o || `Seguir o partido (${p.classe_partido ?? '—'})`}
                </option>
              ))}
            </select>
          </label>
          {classe && (
            <label>
              Observação (opcional, aparece no perfil)
              <input type="text" value={obs} maxLength={140} onChange={(e) => setObs(e.target.value)} />
            </label>
          )}
          <div className="edicao-acoes">
            <button className="botao primario" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar para todos'}
            </button>
            <button className="botao" onClick={() => setAberto(false)} disabled={salvando}>
              Cancelar
            </button>
          </div>
          <p className="edicao-dica">
            A mudança vale para todos os que usam o app. Mapas e barras regionais são recalculados.
          </p>
        </div>
      )}
      {erro && <p className="edicao-erro">Não foi possível salvar: {erro}.</p>}
      {commit && estado && <Andamento estado={estado} />}
    </div>
  )
}

function Andamento({ estado }: { estado: EstadoPublicacao }) {
  const texto: Record<EstadoPublicacao, string> = {
    aguardando: 'Salvo. Iniciando a atualização do site…',
    publicando: 'Salvo. Atualizando o site (leva cerca de 3 minutos)…',
    publicado: 'Pronto: o site já está atualizado.',
    substituida: 'Salvo. Uma edição mais recente está atualizando o site e já inclui esta.',
    falhou: 'Salvo, mas a atualização do site falhou. Veja a aba Actions no GitHub ou peça ajuda ao Claude.',
  }
  return (
    <p className={`edicao-andamento ${estado}`}>
      {texto[estado]}{' '}
      {estado === 'publicado' && (
        <button className="botao" onClick={() => location.reload()}>
          Recarregar
        </button>
      )}
    </p>
  )
}
