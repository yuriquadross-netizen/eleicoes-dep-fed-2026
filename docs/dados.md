# Dados: fontes, dicionário e métricas

## Fontes

| Conjunto | Origem | Uso |
|---|---|---|
| `votacao_candidato_munzona_{ANO}` | TSE, dados abertos (`cdn.tse.jus.br/estatistica/sead/odsele/`) | Votos por candidato × município × zona |
| `detalhe_votacao_munzona_{ANO}` | TSE | Aptos, comparecimento, nominais, legenda, brancos e nulos por município × zona × cargo |
| `votacao_partido_munzona_{ANO}` | TSE | Votos nominais + legenda por partido (leitura ideológica) |
| `fotos_cand{ANO}_{UF}_div` | TSE | Fotos dos candidatos (Etapa 6; *confirmar nome*) |
| Localidades IBGE (`/api/v1/localidades/municipios?view=nivelado`) | IBGE | Município → micro, meso, imediata, intermediária, UF, região |
| Malhas IBGE (`/api/v3/malhas/...`) | IBGE | Polígonos municipais (dissolvidos nas regiões) |
| Correspondência TSE ↔ IBGE | Base dos Dados / `betafcc/Municipios-Brasileiros-TSE` (*confirmar*) | Ligar código TSE ao código IBGE |

Filtros: `CD_CARGO = 6` (Deputado Federal), `NR_TURNO = 1`. CSVs do TSE: `latin1`, separador `;`.

## Métricas (o front nunca recalcula; tudo sai do pipeline)

| Nome no app | Coluna na planilha 2022 | Fórmula |
|---|---|---|
| Votos no local | Votos | Σ votos nominais do candidato nas zonas dos municípios do local |
| Votos válidos do local | Votos Válidos | nominais + legenda para Dep. Federal (**a confirmar no passo 1.3**) |
| % do local que foi dele | Part. Dep. Região | votos no local / válidos do local |
| % dele que veio do local | Part. Região Dep. | votos no local / votos totais do candidato |
| Direita % / Centro % | Direita (%) / Centro (%) | (nominais + legenda dos partidos da classe) / válidos do local |

## Valores sentinela (2022, MG; vêm da planilha da Aliança)

- Barbacena (micro): 123.534 válidos; Nikolas Ferreira: 13.576 votos (10,99% do local; 0,91% da base dele).
- Nikolas Ferreira, total no estado: 1.492.047.
- Uberlândia (micro): 1º lugar Ana Paula Junqueira (PP), 69.210 votos.

## Notas de investigação
*(registrar aqui o que for descoberto: definição exata de válidos, municípios órfãos, colunas renomeadas em 2026 etc.)*
