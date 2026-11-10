import { Link } from 'react-router-dom'
import { TIPO_BASE, type TipoBase } from '../dados'
import { useTitulo } from '../formato'

export default function Metodo() {
  useTitulo('Tipologia da base eleitoral')
  return (
    <article className="texto">
      <p className="trilha">
        <Link to="/brasil">Brasil</Link> › Método
      </p>
      <h1>Tipologia da base eleitoral</h1>
      <p>
        Inspirada em Barry Ames (“Electoral Strategy under Open-List Proportional Representation”, <i>American
        Journal of Political Science</i>, 1995; <i>Os entraves da democracia no Brasil</i>, 2001). O deputado federal é
        eleito pelo estado inteiro, mas quase nenhum disputa o estado inteiro: o formato do território de onde vêm os
        votos diz muito sobre o tipo de representação.
      </p>
      <h2>As duas medidas</h2>
      <p>
        <b>Concentração.</b> Quanto a distribuição dos votos do candidato pelos municípios se afasta da distribuição
        do eleitorado do estado (índice G = ½ Σ |votos do candidato no município ÷ votos dele − válidos do município ÷
        válidos da UF|). Vai de 0 (vota exatamente como o estado) a 100% (todos os votos num só lugar).
      </p>
      <p>
        <b>Dominância.</b> Nos municípios onde tem voto, qual a fatia dele nos votos válidos, em média, ponderada pelo
        peso de cada município na votação dele. Alta: onde ele tem voto, é “o” deputado do lugar.
      </p>
      <p>
        <b>Contiguidade.</b> Mostrada no perfil, não entra no tipo: se a área forte forma uma mancha contínua (I de
        Moran significativo, vizinhança por fronteira comum, 999 permutações) ou aparece em retalhos.
      </p>
      <h2>Os quatro tipos</h2>
      <ul>
        {(Object.keys(TIPO_BASE) as TipoBase[]).map((t) => (
          <li key={t}>
            <b>{TIPO_BASE[t].nome}:</b> {TIPO_BASE[t].descricao}
          </li>
        ))}
      </ul>
      <h2>Cuidados de leitura</h2>
      <ul>
        <li>
          <b>Relativa ao estado.</b> “Concentrada” e “dominante” significam acima da mediana dos eleitos da mesma UF.
          Comparar Minas (853 municípios) com Roraima (15) em termos absolutos distorceria.
        </li>
        <li>
          <b>Por que não só o I de Moran, como em Ames.</b> O Moran mede se a força do candidato varia de forma agrupada
          no mapa, não se os votos estão reunidos num território. Sozinho, ele classifica como “concentrado” quem tem
          votos no estado inteiro com intensidade regional. Por isso a concentração usa o índice G, e o Moran fica como
          medida de contiguidade.
        </li>
        <li>
          <b>Estável, mas com fronteira.</b> Nos reeleitos de Minas, os índices de 2022 e 2026 têm correlação de 0,88
          (concentração) e 0,64 (dominância). Quem está perto da mediana pode mudar de tipo por pouco; o perfil avisa
          esses casos.
        </li>
        <li>
          <b>Limites.</b> O DF tem um único município e não tem tipologia. Estados com menos de 30 municípios têm
          leitura menos confiável. Nas capitais, a dominância tende a ser baixa por haver muitos concorrentes.
        </li>
        <li>
          <b>Descritiva, não normativa.</b> Uma base concentrada e dominante não é “paroquial” no sentido pejorativo:
          pode indicar o deputado mais enraizado e responsável perante a sua região.
        </li>
      </ul>
    </article>
  )
}
