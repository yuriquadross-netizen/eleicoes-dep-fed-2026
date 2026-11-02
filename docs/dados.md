# Dados: fontes, dicionário e métricas

## Fontes

| Conjunto | Origem | Uso |
|---|---|---|
| `votacao_candidato_munzona_{ANO}` | TSE, dados abertos (`cdn.tse.jus.br/estatistica/sead/odsele/`) | Votos por candidato × município × zona |
| `detalhe_votacao_munzona_{ANO}` | TSE | Aptos, comparecimento, nominais, legenda, brancos e nulos por município × zona × cargo |
| `votacao_partido_munzona_{ANO}` | TSE | Votos nominais + legenda por partido (leitura ideológica) |
| `fotos_cand{ANO}_{UF}_div` | TSE | Fotos dos candidatos (Etapa 6; *confirmar nome*) |
| geobr (Ipea), release `v2.0.0` no GitHub: `municipalities_2024_simplified`, `microregions_2020_simplified`, `mesoregions_2020_simplified`, `immediateregions_2019_simplified`, `intermediateregions_2019_simplified` | IBGE via Ipea | Polígonos e, por junção espacial, município → micro, meso, imediata, intermediária |
| `betafcc/Municipios-Brasileiros-TSE` (GitHub) | comunidade | Código TSE ↔ código IBGE (o que faltar é casado por nome + UF) |

> Os servidores do IBGE (`servicodados`, `geoftp`) recusam conexões fora do Brasil; por isso o geobr.

Filtros: `CD_CARGO = 6` (Deputado Federal), `NR_TURNO = 1`. CSVs do TSE: `latin1`, separador `;`.

## Métricas (o front nunca recalcula; tudo sai do pipeline)

| Nome no app | Coluna na planilha 2022 | Fórmula |
|---|---|---|
| Votos no local | Votos | Σ `QT_VOTOS_NOMINAIS_VALIDOS` do candidato nas zonas dos municípios do local |
| Votos válidos do local | Votos Válidos | Σ `QT_TOTAL_VOTOS_VALIDOS` (nominais válidos + legenda) do `detalhe_votacao_munzona`, cargo 6 |
| % do local que foi dele | Part. Dep. Região | votos no local / válidos do local |
| % dele que veio do local | Part. Região Dep. | votos no local / votos totais do candidato |
| Direita % / Centro % | Direita (%) / Centro (%) | (nominais + legenda dos partidos da classe) / válidos do local |

## Valores sentinela (2022, MG; vêm da planilha da Aliança)

- Barbacena (micro): 123.534 válidos; Nikolas Ferreira: 13.576 votos (10,99% do local; 0,91% da base dele).
- Nikolas Ferreira, total no estado: 1.492.047.
- Uberlândia (micro): 1º lugar Ana Paula Junqueira (PP), 69.210 votos.

## Notas de investigação
- **2026-11-02 — validação concluída.** Com as definições acima, o pipeline reproduz exatamente as 660 linhas (66 micros × top 10) da planilha 2022: nomes, votos, posições, situação e as duas porcentagens.
- **Votos de candidatos inaptos:** a planilha (e o app) usam votos nominais *válidos*. Candidatos com candidatura barrada têm votos anulados e ficam com zero (ex.: Carlos Alberto Pereira, PODE-MG 2022, 29.923 votos anulados). O bruto fica em `votos_brutos`.
- **Erro na planilha 2022:** a soma de válidos omitiu Dona Euzébia (micro Cataguases, 4.436) e Sem-Peixe (micro Ponte Nova, 2.535). O app usa o valor correto; o teste documenta a diferença.
- **Cadeiras 2026:** o TSE marca 513 eleitos, já com a redistribuição entre UFs (ex.: RJ 46, PA 17, PB 12). Nada fixo no código: tudo vem de `DS_SIT_TOT_TURNO`.
- **Municípios:** 5.571 (inclui Boa Esperança do Norte-MT). Os 66 nomes de micro de MG batem com a planilha.
- Arquivos do TSE 2026 publicados em 01/11/2026; colunas idênticas às de 2022.
