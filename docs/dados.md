# Dados: fontes, dicionário e métricas

## Fontes

| Conjunto | Origem | Uso |
|---|---|---|
| `votacao_candidato_munzona_{ANO}` | TSE, dados abertos (`cdn.tse.jus.br/estatistica/sead/odsele/`) | Votos por candidato × município × zona |
| `detalhe_votacao_munzona_{ANO}` | TSE | Aptos, comparecimento, nominais, legenda, brancos e nulos por município × zona × cargo |
| `votacao_partido_munzona_{ANO}` | TSE | Votos nominais + legenda por partido (leitura ideológica) |
| `eleicoes{ANO}/fotos/foto_cand{ANO}_{UF}_div.zip` | TSE (`cdn.tse.jus.br/estatistica/sead/eleicoes/`) | Fotos de divulgação; arquivos `F{UF}{sq}_div.jpg`. Só os eleitos vão para o app |
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

## Leitura ideológica — reconstrução da planilha 2022 (02/11/2026)

A classificação usada na planilha foi reconstruída resolvendo o sistema "Direita % e Centro % das 66 micros". O resultado é **exato** (resíduo zero), e o teste `test_ideologia_2022.py` o trava.

- **Direita (2022):** DC, NOVO, PL, PP, REPUBLICANOS, UNIÃO
- **Centro (2022):** AVANTE, CIDADANIA, MDB, PODE, PSD, PSDB, SOLIDARIEDADE
- **Fora das duas classes:** todos os demais, inclusive PTB, PATRIOTA, PSC, PRTB, PROS, PMN e AGIR. Não está claro se isso foi deliberado.
- **Fórmula da planilha:** votos **nominais** dos partidos da classe ÷ votos válidos (nominais + legenda). O numerador ignora os votos de legenda, mas o denominador os inclui.

Classificação 2026 confirmada pelo Yuri: `config/partidos_ideologia.csv`.
Recomendação de fórmula para 2026: nominais **+ legenda** no numerador, coerente com o denominador. A diferença fica entre 1 e 2 pontos em relação à fórmula de 2022.

## Como marcar um parlamentar com campo diferente do partido

**Pelo app (recomendado):** no rodapé, abra **Edição**, crie e cole a chave de acesso do GitHub (passo a passo na própria página; ela fica só no navegador daquele Mac). Depois, no perfil de qualquer parlamentar, use **Editar posicionamento** → escolha o campo (ou "Seguir o partido") → **Salvar para todos**. O app grava `config/candidatos_ideologia.csv` direto na `main` (um commit por edição, com mensagem "Posicionamento: NOME (PARTIDO-UF) → Campo"), o que dispara a republicação; o próprio app acompanha e avisa quando terminou (~3 min).

**Pelo arquivo:** edite `config/candidatos_ideologia.csv` (pelo GitHub, em *Edit*, ou peça ao Claude) e acrescente uma linha por parlamentar:

```
ano,sq_candidato,nome_urna,uf,partido,classe,observacao
2026,130002535301,ANA ELISA,MG,PT,Centro,motivo da marcação (opcional)
```

- `sq_candidato` é o número que aparece no endereço do perfil (`#/candidato/<número>`). É o único campo usado para localizar a pessoa.
- `nome_urna`, `uf` e `partido` servem para leitura humana. O pipeline confere com o TSE e avisa se não baterem.
- `classe` precisa ser `Direita`, `Centro` ou `Esquerda`. A publicação falha se vier outra coisa ou se o número não existir.
- **Efeito:** o perfil mostra "posicionamento próprio (partido: …)" e muda a cor do mapa. Nas barras e mapas regionais, os votos nominais da pessoa passam para o campo marcado; os votos de legenda continuam com o partido.
- A marcação aparece no site público.

## Tipologia da base eleitoral

`pipeline/tipologia.py` → `data/processed/tipologia_{ANO}.parquet` (uma linha por candidato com voto):
`concentracao` (índice G), `moran` e `p_moran` (999 permutações; vizinhança por fronteira comum na malha do geobr, com tolerância de 200 m), `dominancia`, `concentrada`, `dominante`, `tipo`, `pct_*` (percentil entre os eleitos da UF), medianas da UF e `confiabilidade`. Método completo na página `#/metodo` do app.

## Senado (Etapa 13)

**Fontes.** Resultado: `votacao_candidato_munzona`, `detalhe_votacao_munzona` e `votacao_partido_munzona` do TSE, `CD_CARGO = 5` (`tabelas.py --cargo senado`, arquivos `*_{ano}_senado.parquet`). Suplentes e CPF: `consulta_cand_{ano}.zip` (cargos 9 = 1º suplente, 10 = 2º suplente; a chapa casa com o titular por UF + número). Ocupantes atuais: API de dados abertos do Senado, `https://legis.senado.leg.br/dadosabertos` (pede `Accept: application/json`).

**Campos usados da API.** `senador/lista/atual` → `Parlamentar[]` com `IdentificacaoParlamentar` (`CodigoParlamentar`, `NomeParlamentar`, `SiglaPartidoParlamentar`, `UfParlamentar`) e `Mandato` (`DescricaoParticipacao`: "Titular", "1º Suplente" ou "2º Suplente"; `SegundaLegislaturaDoMandato.DataFim`: `2031-01-31` identifica a turma de 2022; `Titular` quando o ocupante é suplente; `Exercicios.Exercicio[]` com `DataInicio` e, se encerrado, `DataFim` e `DescricaoCausaAfastamento`). `senador/{codigo}/mandatos` → os exercícios do titular; o último encerrado dá o motivo da saída (ex.: "Renúncia", "Afastamento do exercício"). A API devolve objeto quando há um item e lista quando há vários.

**Regras de `pipeline/senado.py`.**
- 54 cadeiras: eleitos em 2026 (2 por UF), partido da eleição. 27 cadeiras: turma de 2022 (1 por UF), com o ocupante e o partido atuais da API. Como há uma cadeira da turma de 2022 por UF, o casamento TSE ↔ API é pela UF.
- Siglas da API convertidas para as do TSE (`PODEMOS` → `PODE` etc.). Senador sem partido fica sem campo (cinza no hemiciclo).
- Titular de 2022 eleito para outro cargo em 2026 (cruzamento por CPF, só em memória): a cadeira vai para o 1º suplente que não tenha sido eleito, marcada `previsto = true`; o partido é o do suplente em 2022, convertido quando o partido foi extinto por fusão (PSC → PODE, PTB e Patriota → PRD, PROS → Solidariedade, PMN → Mobiliza, PMB → Democrata, PTC → Agir).
- "% do local" em 2026, quando cada eleitor dá dois votos: votos do candidato ÷ total de votos válidos para senador (que soma os dois votos), como publica o TSE.
- O CPF não é gravado em nenhum arquivo versionado nem publicado.

**Saídas.** `data/processed/senado_2027.parquet` (versionado; o build não depende da API) e `web/public/data/2026/senado.json` (gerado por `exportar_web.py` no modo federal). As respostas da API ficam em `data/raw/senado/` (não versionado); `python pipeline/senado.py --forcar` baixa de novo.

**Validação (13/11/2026).** 81 cadeiras, 3 por UF. Suplentes em exercício: MA (Ana Paula Lobato, de Flávio Dino, renúncia) e PI (Jussara Lima, de Wellington Dias, afastamento). Previstos: AM, MG e PR (titulares eleitos governador). Sem partido: RJ (Romário).

