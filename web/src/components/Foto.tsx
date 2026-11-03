// Foto de divulgação do TSE (só eleitos têm arquivo). Some sozinha se a imagem não existir.
import { useState } from 'react'

export default function Foto({ sq, nome, tamanho = 'p' }: { sq: number; nome: string; tamanho?: 'p' | 'g' }) {
  const [falhou, setFalhou] = useState(false)
  if (falhou) return null
  return (
    <img
      className={`foto foto-${tamanho}`}
      src={`./fotos/${sq}.webp`}
      alt={tamanho === 'g' ? `Foto de ${nome}` : ''}
      loading="lazy"
      onError={() => setFalhou(true)}
    />
  )
}
