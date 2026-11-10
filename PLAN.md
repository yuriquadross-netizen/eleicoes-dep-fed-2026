# PLAN — Mapa da Base de Votos · Congresso 2026 (Câmara, Senado e Assembleias)

> Documento vivo. Atualize o **Status** e marque os passos concluídos (`[x]`) ao fim de cada sessão.
> Mudou uma decisão? Registre em `docs/decisoes.md` antes de mudar o código.

---

## 0. Bloco de passagem (cole isto primeiro numa sessão nova)

**O que é:** um app web instalável no Mac (Safari › Arquivo › *Adicionar ao Dock*, como o app da apuração) que mapeia a base de votos de todos os candidatos a deputado federal em 2026, com dados do TSE. O usuário pode (a) buscar um candidato por nome ou partido e abrir o perfil; (b) navegar por Região › UF › mesorregião/microrregião (divisão antiga do IBGE) ou região intermediária/imediata (divisão atual), com seletor, e ver o **top 10** de cada meso e micro. O perfil traz um **mapa coroplético do estado por microrregião** (mais escuro = mais votos), a lista das microrregiões e municípios mais votados e, para cada local, as duas métricas da planilha da Aliança: **% dos votos válidos do local que foram para o candidato** e **% da votação total do candidato que veio daquele local**. Inclui ainda uma leitura ideológica (Direita/Centro/Esquerda) por região, baseada numa tabela de partidos editável pela Aliança.

**Abordagem escolhida:** pipeline em Python (DuckDB) baixa TSE + IBGE e gera tabelas compactas (`data/processed/*.parquet`, versionadas). Um script de exportação transforma essas tabelas em JSON estático. Um site React (Vite + TypeScript) lê esse JSON e desenha os mapas em SVG (d3-geo + TopoJSON). O GitHub Actions publica no GitHub Pages, e o Yuri instala pelo Safari. Não há servidor nem banco de dados, e o custo é zero.

**Referência de validação:** `pipeline/tests/fixtures/planilha_alianca_2022_mg.csv` traz o mapeamento de 2022 feito pela Aliança (MG, 66 micros × top 10). Rodar o pipeline com `ANO=2022` precisa reproduzir esses números. Esse é o teste de que os dados de 2026 estarão certos.

**Status (10/11/2026):** **Fase 1 (deputados federais) concluída e publicada** em https://yuriquadross-netizen.github.io/eleicoes-dep-fed-2026/ (etapas 0–6, incluindo fotos, CSV, uso sem internet, edição do posicionamento pelo app e tipologia de Ames). Cada merge em `main` republica sozinho. A Etapa 7 (comparativo 2022→2026) segue opcional, aguardando aval.

**Fase 2 (planejada): deputados estaduais (e distritais no DF).** Toda a análise dos federais replicada para eles, com um seletor de cargo no topo, a mesma tabela ideológica e, ao final, a análise de **dobradinhas**. Etapas 8–11.

**Fase 3 (planejada): home do cenário nacional e Senado.** Página inicial sobre o Congresso **eleito para 2027** (hemiciclos da Câmara e do Senado na cor dos campos, aritmética de votações, renovação, mapa do Brasil, maiores votações e puxadores, governadores 2026, bancadas e variação desde 2022) e a mesma análise dos deputados para os **senadores eleitos em 2022 e 2026**, com os **suplentes em exercício** vindos da API de dados abertos do Senado. Etapas 12–15.

**Ordem de execução recomendada:** 12 → 8 → 13 → 14 → 15 → 9 → 10 → 11. **Próximo passo: 12.1.**

**Rede:** o TSE está liberado no ambiente da nuvem. O IBGE recusa conexões fora do Brasil, por isso as malhas e os recortes vêm do geobr (Ipea), hospedado no GitHub. Ver `docs/dados.md`.

---

## 1. Decisões (o porquê fica registrado para não ser rediscutido)

| # | Decisão | Por quê | Alternativas rejeitadas |
|---|---|---|---|
| D1 | **Site estático + GitHub Pages + "Adicionar ao Dock"** | Mesmo modo de instalação do app da apuração. Sem servidor, sem custo, atualiza sozinho a cada deploy. | **Tauri/Electron .app**: exige build em macOS, assinatura e alertas do Gatekeeper, sem ganho real para o caso. **Streamlit/Python local**: rápido de prototipar, mas não vira app de Dock sem servidor rodando. **DuckDB-wasm consultando Parquet no navegador**: flexível, mas são mais de 30 MB de wasm e mais complexidade; fica como porta aberta para consultas livres no futuro. |
| D2 | **Dados pré-calculados em JSON** (um arquivo por candidato, por região e por UF) | Abertura instantânea e lógica trivial no front. Todo cálculo acontece no pipeline e é testável em Python. | Calcular no navegador a partir da tabela bruta: lento e difícil de testar. |
| D3 | **Duas divisões regionais com seletor** (padrão: meso/micro antigas) | As antigas são comparáveis com a planilha de 2022 e são o vocabulário político corrente. As novas são as oficiais desde 2017. | Só uma das duas. |
| D4 | **Todos os candidatos entram nos rankings e têm perfil**; a busca mostra eleitos por padrão | Um suplente forte numa micro é informação política (ex.: Raphael Rios em Araxá, 2022). O custo extra de dados é pequeno. | Só os eleitos. |
| D5 | **Ideologia via CSV editável** (`config/partidos_ideologia.csv`) | A classificação é julgamento da Aliança, não dado do TSE, e deve ficar visível e corrigível. | Classificação fixa no código. |
| D6 | **Mapas em SVG com d3-geo** (sem tiles) | Funciona offline, é leve e basta para um coroplético estadual. | MapLibre/Leaflet: exigem tiles e são exagero para o caso. |
| D7 | **Geometrias regionais por dissolução da malha municipal** (mapshaper) | Garante que mapa e números usem exatamente o mesmo mapeamento município→região. | Baixar malhas de micro/meso prontas: risco de divergir do mapeamento usado nas contas. |
| D8 | **Pipeline roda no GitHub Actions ou localmente; `data/processed/` é versionado** | O TSE é bloqueado na sandbox. O resultado de 2026 é final e é regenerado raramente. | Baixar o TSE a cada deploy: lento e frágil. |
| D9 | **Ano parametrizado (`ANO=2026` ou `2022`)** | Permite validar com 2022 e abre caminho para o comparativo 2022→2026. | Ano fixo no código. |
| D10 | **Cargo como parâmetro em todo o pipeline e no app** (`--cargo federal` ou `--cargo estadual`). O federal mantém os nomes de arquivo e os endereços atuais; o estadual ganha sufixo `_estadual` (tabelas), pasta `data/2026e/` (JSON) e prefixo `#/estadual/...` (rotas) | Reaproveita 100% do código já validado; os links e o cache offline dos federais continuam valendo | Um segundo app ou repositório (duplica manutenção); coluna `cargo` dentro das tabelas atuais (mexe em tudo o que já funciona) |
| D11 | **Seletor Federal / Estadual no cabeçalho**; ao trocar, a página equivalente abre no outro cargo (UF, região, Brasil); no perfil, volta para a busca | Um só app no Dock, navegação idêntica nos dois cargos | Seções separadas (navegação duplicada) |
| D12 | **Estadual = `CD_CARGO` 7 (Deputado Estadual) + 8 (Deputado Distrital, DF)** | No DF o cargo equivalente é o distrital | Excluir o DF |
| D13 | **Mesma tabela ideológica de partidos para os dois cargos**; casos individuais pela edição de posicionamento (mesmo `config/candidatos_ideologia.csv`, com coluna `cargo`) | Decisão do Yuri (10/11); manutenção única | Ajuste por estado |
| D14 | **Dobradinhas** só depois do estadual básico no ar (Etapa 11), com métrica escolhida num passo de pesquisa | É a análise mais nova e com mais risco metodológico; não pode atrasar o resto | Fazer junto (atrasa a entrega visível) |
| D15 | **A home vira a página inicial (`#/`)**; a busca vai para `#/buscar`, com redirecionamento dos links antigos | O app passa a abrir pelo panorama nacional, que é o ponto de partida da análise | Home como página secundária |
| D16 | **Senado como terceiro cargo do seletor** (Federal / Estadual / Senado), com duas disputas: 2022 (1 vaga por UF) e 2026 (2 vagas por UF) | Reaproveita a infraestrutura de cargo da Etapa 8 e todas as análises | Seção à parte só para o Senado |
| D17 | **A home mostra a composição eleita para 2027** (decisão do Yuri, 10/11). Senado 2027 = 54 eleitos em 2026 + 27 da turma de 2022 com o ocupante atual; se o titular de 2022 foi eleito governador ou vice em 2026, a cadeira aparece como "suplente deve assumir" | É o Congresso que vai decidir a partir de 2027 | Composição atual em exercício; comparação atual × eleita |
| D18 | **Hemiciclo colorido por campo** (verde/amarelo/vermelho), partidos agrupados da Esquerda (à esquerda) à Direita, com tooltip por partido | Três cores legíveis e coerentes com o resto do app; a identidade do partido fica no tooltip e na tabela ao lado | Uma cor por partido (cerca de 20 cores, ilegível e conflitante com os campos) |
| D19 | **Variação de bancadas via tabela de sucessão de partidos** (`config/partidos_sucessao.csv`) | Fusões entre 2022 e 2026 (PRD, Mobiliza, Democrata, Agir etc.) tornariam a comparação por sigla enganosa | Comparar siglas cruas |
| D20 | **Suplentes em exercício vêm da API do Senado** (decisão do Yuri), gravados como retrato versionado (`data/processed/senado_exercicio.parquet`) e atualizados pelo pipeline; reserva: lista mantida à mão editável pelo app | Fonte oficial, sem trabalho manual; o retrato versionado mantém o site funcionando mesmo se a API cair | Consulta ao vivo pelo navegador (dependência externa a cada acesso) |

**Decisão em aberto para o Yuri:** o repositório é **público** e, portanto, o site no Pages também é. Os dados do TSE são públicos, mas a tabela de ideologia é julgamento da Aliança. Para restringir o acesso, seria preciso tornar o repo privado e usar GitHub Pro (US$ 4/mês) ou outro host. O padrão até nova ordem é site público, sem marca, com URL não divulgada.

---

## 2. Definições das métricas (fonte única; o front nunca recalcula)

Ver `docs/dados.md` para colunas e fontes. Resumo:

- **votos(c, L):** votos nominais do candidato `c` no local `L`, somando todas as zonas do município. Cargo Deputado Federal, 1º turno.
- **válidos(L):** votos válidos para deputado federal no local `L` = nominais + legenda. *A confirmar no passo 1.3 contra a planilha (Barbacena 2022 = 123.534).*
- **Part. Dep. Região** = votos(c, L) / válidos(L) → "quanto do local é dele".
- **Part. Região Dep.** = votos(c, L) / votos(c, total) → "quanto dele vem do local".
- **Top 10 de uma região:** candidatos ordenados por votos(c, L). Desempate por nome.
- **Direita % / Centro % / Esquerda %** = votos (nominais + legenda) dos partidos daquela classe / válidos(L), usando `votacao_partido_munzona`.

---

## 3. Estrutura do repositório

```
PLAN.md                  ← este arquivo
docs/decisoes.md         ← log de decisões
docs/dados.md            ← fontes, dicionário e métricas
config/                  ← tabelas editáveis (ideologia, overrides de municípios)
pipeline/                ← Python: download → tabelas → export JSON
  tests/fixtures/        ← planilha da Aliança 2022 (validação)
data/raw/                ← downloads do TSE/IBGE (gitignored)
data/processed/          ← parquet compacto (versionado)
web/                     ← app React (Vite + TS)
web/public/data/         ← JSON gerado (gitignored; gerado no build)
.github/workflows/       ← dados.yml (pipeline) e deploy.yml (Pages)
Makefile                 ← atalhos: make dados, make web, make teste
```

---

## 4. Etapas

Cada etapa termina com algo **visível**. Cada passo tem **Objetivo / Onde / Verificar / Cerca**. Não pule o "Verificar": um passo sem verificação passando não está concluído.

### Etapa 0 — Repositório organizado ✅
- [x] Estrutura de pastas, `README.md`, `PLAN.md`, `docs/`, `.gitignore`, fixture da planilha 2022.

---

### Etapa 1 — Esqueleto ponta a ponta (MG) · *Visível: o Yuri abre o app pelo Dock, busca "Nikolas" e vê a tabela de microrregiões com as duas porcentagens.*

- [x] **1.1 Download dos dados do TSE** → `pipeline/baixar.py` (também baixa o geobr e a correspondência TSE↔IBGE)
  - **Objetivo:** script baixa e descompacta, para `ANO` ∈ {2022, 2026}: `votacao_candidato_munzona_{ANO}.zip`, `detalhe_votacao_munzona_{ANO}.zip` e `votacao_partido_munzona_{ANO}.zip`, a partir de `https://cdn.tse.jus.br/estatistica/sead/odsele/<conjunto>/<conjunto>_{ANO}.zip`.
  - **Onde:** `pipeline/baixar.py`, `Makefile` (alvo `dados`), `.github/workflows/dados.yml` (`workflow_dispatch`, com o ano como input).
  - **Verificar:** `python pipeline/baixar_tse.py --ano 2022 --uf MG` imprime contagem de linhas maior que zero, com `CD_CARGO == 6` presente. Os CSVs são `latin1`, separados por `;`. Se a sandbox bloquear, rodar o workflow no Actions e conferir o log.
  - **Cerca:** só baixar e descompactar, sem transformar. Não versionar `data/raw/`.
  - **Pesquisar antes:** confirmar no portal `dadosabertos.tse.jus.br` os nomes exatos dos conjuntos de 2026 e se já estão publicados. Os nomes de colunas podem mudar entre eleições.

- [x] **1.2 Tabela de municípios (TSE ↔ IBGE ↔ regiões)** → feita por junção espacial com o geobr, porque a API do IBGE está inacessível
  - **Objetivo:** gerar `data/processed/municipios.parquet` com `cd_tse, cd_ibge, nome, uf, regiao, meso_id, meso_nome, micro_id, micro_nome, rgint_id, rgint_nome, rgi_id, rgi_nome`.
  - **Onde:** `pipeline/municipios.py`, `config/municipios_override.csv`.
  - **Fontes:** API IBGE `/api/v1/localidades/municipios?view=nivelado` (traz micro, meso, imediata e intermediária). Correspondência TSE↔IBGE: diretório de municípios da Base dos Dados ou o repositório `betafcc/Municipios-Brasileiros-TSE` no GitHub. *Pesquisar a fonte mais atual.*
  - **Verificar:** script com asserts: todo município presente nos CSVs do TSE tem `cd_ibge` e as quatro regiões. MG tem 853 municípios, 66 micros e 12 mesos. Imprimir os municípios órfãos, que vão para o override.
  - **Cerca:** sem geometria neste passo.

- [x] **1.3 Tabelas centrais + validação contra a planilha 2022** → 4 testes passando; ver as notas em `docs/dados.md`
  - **Objetivo:** gerar `votos_cand_mun.parquet` (`ano, sq_candidato, cd_ibge, votos`), `validos_mun.parquet` (`ano, cd_ibge, validos, nominais, legenda, aptos, comparecimento`) e `candidatos.parquet` (`ano, sq_candidato, nr, nome, nome_urna, partido, federacao, uf, situacao, votos_total`).
  - **Onde:** `pipeline/tabelas.py`, `pipeline/tests/test_planilha_2022.py`.
  - **Verificar:** `pytest pipeline/tests` com `ANO=2022`. Para as 660 linhas da fixture, os votos batem exatamente e as duas porcentagens batem em ±0,0001. Casos sentinela: Barbacena tem 123.534 válidos; Nikolas tem 13.576 votos em Barbacena e 1.492.047 no total.
  - **Cerca:** se não bater, **não ajustar a fixture**. Investigar a definição de válidos (nominais vs. nominais válidos; votos de candidatos *sub judice*) e registrar a conclusão em `docs/dados.md`.

- [x] **1.4 Exportação para JSON** → já exporta o Brasil inteiro, além dos tops por região (antecipa 3.1)
  - **Objetivo:** gerar `web/public/data/{ANO}/candidatos/index.json` (busca: id, nome, urna, partido, UF, situação, votos) e `candidatos/{sq}.json` (totais + lista por micro e por município com as duas métricas e o ranking local).
  - **Onde:** `pipeline/exportar_web.py`.
  - **Verificar:** `python pipeline/exportar_web.py --ano 2022 --uf MG` e `jq` no JSON de Nikolas mostrando 66 micros com somatório de `part_regiao_dep` igual a 1,0 (±0,001).
  - **Cerca:** só os campos que o front usa. Nada de geometria ainda.

- [x] **1.5 App web mínimo** → busca + perfil com abas micro/meso/imediata/intermediária (antecipa parte de 3.3)
  - **Objetivo:** Vite + React + TypeScript + React Router (`HashRouter`). Rotas `#/` (busca com nome sem acento, filtro por partido, "só eleitos" ligado) e `#/candidato/:sq` (cabeçalho e tabela de micros ordenável, expandindo para municípios).
  - **Onde:** `web/`.
  - **Verificar:** `npm --prefix web run build` sem erros. `npm --prefix web run preview` e um script Playwright `web/scripts/screenshots.mjs` que salva capturas de `#/` e `#/candidato/<sq Nikolas>` em `web/screenshots/` (gitignored). Conferir a captura.
  - **Cerca:** sem mapa e sem navegação geográfica. Visual limpo, sem perfeccionismo.

- [x] **1.6 Publicação + instalação no Dock** → no ar desde 02/11/2026 (Pages com Source = GitHub Actions)
  - **Objetivo:** `.github/workflows/deploy.yml` roda `exportar_web.py` a partir de `data/processed/`, depois o build do web e o deploy no Pages. Incluir `manifest.webmanifest`, ícones (512/192/`apple-touch-icon`) e `<meta name="apple-mobile-web-app-capable">`.
  - **Verificar:** a URL `https://yuriquadross-netizen.github.io/eleicoes-dep-fed-2026/` abre. O Yuri usa Safari › Arquivo › Adicionar ao Dock e o app abre em janela própria (requer macOS Sonoma ou posterior).
  - **Cerca:** sem service worker ainda (Etapa 6).

---

### Etapa 2 — Mapa no perfil · *Visível: o perfil mostra o mapa do estado por microrregião, mais escuro onde ele teve mais votos.*

- [x] **2.1 Geometrias** → `pipeline/geometrias.py` usa o geobr em vez da API do IBGE; mapshaper fixado em `pipeline/node/package.json`. `web/public/geo/` é versionado (3,4 MB, 27 UFs)
  - **Objetivo:** baixar a malha municipal por UF (API IBGE v3 `malhas/estados/{UF}?intrarregiao=municipio&formato=application/vnd.geo+json`; *verificar endpoint e qualidade*), dissolver com `mapshaper` por `micro_id`, `meso_id`, `rgi_id` e `rgint_id` usando `municipios.parquet`, simplificar e salvar `web/public/geo/{UF}.topo.json` com cinco camadas (municipio, micro, meso, rgi, rgint).
  - **Onde:** `pipeline/geometrias.py` (chama `npx mapshaper`).
  - **Verificar:** MG.topo.json com 853, 66, 12, 70 e 13 feições, respectivamente (*conferir os números de rgi e rgint de MG*). Tamanho abaixo de 1,5 MB. Um PNG renderizado de cada camada.
  - **Cerca:** só a UF do passo. A escala nacional entra na Etapa 4.

- [x] **2.2 Componente `MapaUF`** → quantis em 7 classes, rampa azul; no modo escuro a rampa inverte (ponta clara = mais votos), conforme a regra de legibilidade em fundo escuro
  - **Objetivo:** mapa SVG (d3-geo, projeção `geoMercator().fitSize`) com camada selecionável, escala sequencial de uma só cor (clara → escura), legenda, tooltip com nome, votos e as duas porcentagens, e seletor de métrica (votos absolutos [padrão] / % dos válidos do local / % da base dele).
  - **Onde:** `web/src/components/MapaUF.tsx`. Ler a skill `dataviz` antes de escolher paleta e escala; a escala é quantil ou raiz, nunca linear crua.
  - **Verificar:** captura do perfil do Nikolas (MG 2022) com a micro de Belo Horizonte entre as mais escuras. Clicar numa micro destaca a linha correspondente na tabela.
  - **Cerca:** o componente não busca dados; recebe props.

- [x] **2.3 Indicadores-resumo do perfil**
  - **Objetivo:** cartões com votos totais, posição no estado, nº de municípios com voto, micro mais forte e "nº de micros para chegar a 50% da votação" (concentração).
  - **Verificar:** valores conferidos à mão em 2 candidatos (um concentrado, um disperso).
  - **Cerca:** nada de tipologia estatística aqui (ver 6.3).

---

### Etapa 3 — Navegação geográfica + top 10 · *Visível: Brasil › Sudeste › MG › Triângulo › Uberlândia mostra o top 10 idêntico à planilha (no modo 2022).*

- [x] **3.1 Export das regiões** (feito em `exportar_web.py`, inclusive top 10 por município): `data/{ANO}/regioes/{tipo}/{id}.json` com o top 10 (duas métricas, partido, situação), válidos, lista de municípios e os filhos (meso→micros). `uf/{UF}.json` com eleitos da UF, bancada por partido e lista de mesos/micros. **Verificar:** o top 10 de Uberlândia 2022 começa com Ana Paula Junqueira (69.210). **Cerca:** sem ideologia ainda.
- [x] **3.2 Rotas e páginas:** (inclui `#/r/mun/:id`, o top 10 por município, que antecipa parte da Etapa 7) `#/brasil`, `#/regiao/:sigla` (UFs, cadeiras e bancada), `#/uf/:uf` (mapa clicável + eleitos), `#/r/:tipo/:id` (top 10 + mini-mapa com a região destacada + municípios). Breadcrumb em todas. **Verificar:** capturas Playwright das quatro rotas. **Cerca:** reaproveitar `MapaUF`.
- [x] **3.3 Seletor de divisão:** alterna "Meso/Micro (IBGE até 2017)" ↔ "Intermediária/Imediata (IBGE atual)". Guarda a escolha no `localStorage` (envolto em try/catch) e afeta mapas, perfil e navegação. **Verificar:** alternar no perfil muda camada e tabela. **Cerca:** o padrão é sempre meso/micro.
- [x] **3.4 Busca por partido:** (resolvida pelo filtro da busca: `#/?partido=PL&todos=1`, com link no perfil) `#/partido/:sigla` com candidatos da sigla por UF. **Verificar:** captura de `#/partido/PL`.

---

### Etapa 4 — Brasil inteiro · *Visível: qualquer deputado de qualquer UF tem perfil e mapa.*

- [ ] **4.1** Rodar 1.2–3.1 para as 27 UFs, com `ANO=2026`. **Verificar:** o nº de eleitos por UF bate com as cadeiras oficiais da eleição de 2026. **Não fixar 513 no código:** conferir no TSE a distribuição vigente (houve debate em 2025 sobre a ampliação da Câmara). O DF tem micro única: conferir que não quebra.
- [ ] **4.2 Orçamento de tamanho:** `du -sh web/dist` abaixo de 300 MB, nenhum arquivo acima de 50 MB e índice de busca abaixo de 1,5 MB gzip. **Se estourar:** listas por município só para municípios com voto e arrays em vez de objetos.
- [ ] **4.3 Busca nacional:** filtros de UF, partido e situação, com resultado instantâneo (< 100 ms) para ~10 mil nomes. **Verificar:** busca por "silva" devolve resultados de várias UFs.

---

### Etapa 5 — Leitura ideológica · *Visível: cada meso/micro mostra Direita/Centro/Esquerda %, e o mapa da UF pode ser colorido por isso.*

- [x] **5.1** (confirmado pelo Yuri em 02/11/2026) Gerar `config/partidos_ideologia.csv` (`sigla, nome, federacao, classe`) com todos os partidos de 2026, com `classe` vazia ou com sugestão marcada `?`. **O Yuri preenche e revisa.** Nenhum cálculo roda com classe vazia (o pipeline falha com a lista das faltantes).
- [x] **5.2** (feito com nominais + legenda; a fórmula de 2022, só nominais, está travada em `test_ideologia_2022.py`) Calcular os percentuais por município e região a partir de `votacao_partido_munzona` (nominais + legenda). **Verificar:** com a classificação de 2022 da Aliança (pedir ao Yuri, ou inferir e confirmar com ele), Barbacena 2022 deve dar Direita ≈ 0,3159 e Centro ≈ 0,2227.
- [x] **5.3** (com Esquerda % incluída; no mapa da UF, cada classe usa a escala sequencial) Exibir nas páginas de região e incluir a opção "Colorir por: % Direita" no `MapaUF` (paleta divergente). **Cerca:** a classificação nunca aparece no perfil do candidato como rótulo pessoal, só como agregado regional.

---

### Etapa 6 — Acabamento · *Visível: o app abre sem internet e tem fotos dos eleitos.*

- [x] **6.1 Offline:** (feito com vite-plugin-pwa 2.0.0; mais um botão no rodapé, "Salvar para usar sem internet", que baixa os ~960 arquivos listados em `data/2026/arquivos.json`) `vite-plugin-pwa` com precache do app e cache em tempo de execução para `data/` e `geo/`. **Verificar:** abrir, visitar 3 perfis, desligar o Wi-Fi e reabrir.
- [x] **6.2 Fotos dos eleitos:** (`pipeline/fotos.py`; 513 fotos, 1,6 MB, versionadas em `web/public/fotos/`) pacote de fotos do TSE (`fotos_cand{ANO}_{UF}_div.zip`; *confirmar nome*), redimensionadas para 160 px em WebP, **só para eleitos**.
- [x] **6.3 Tipologia de base eleitoral (Ames):** feita em `pipeline/tipologia.py`. A concentração usa o índice G em vez do I de Moran, que fica como contiguidade (ver docs/decisoes.md). Selo no perfil, gráfico de dispersão na UF, página `#/metodo`. Texto original do item: concentrada × dispersa (I de Moran entre micros) e dominante × compartilhada (média de `part_dep_regiao` ponderada). Mostrar como selo no perfil, com nota metodológica.
- [x] **6.4 Exportar:** (perfil: CSV por município com os quatro recortes; UF: CSV das regiões; região: CSV do top 10) botão "Baixar CSV" no perfil e no top 10 (para planilhas da Aliança).

---

### Etapa 7 — (opcional, só com aval do Yuri)
- **Comparativo 2022 → 2026** para reeleitos: onde cresceu e onde perdeu (o pipeline já é parametrizado por ano).
- **Página do município:** top 10 por cidade, útil para reuniões com anfitriões no interior.

---

## FASE 2 — Deputados estaduais

> Regra geral desta fase: **nada do que funciona para os federais pode mudar de comportamento.** Todo passo que mexe em código compartilhado termina rodando o teste de não-regressão (8.0).

### Etapa 8 — Esqueleto estadual (MG) · *Visível: no app, o Yuri troca para "Estadual", busca um deputado estadual de MG e vê perfil, mapa e tabela de micros.*

- [ ] **8.0 Teste de não-regressão dos federais**
  - **Objetivo:** guardar um "retrato" dos federais e comparar depois de cada mudança.
  - **Onde:** `pipeline/retrato_federal.py` (grava hashes dos parquet federais e de 20 JSON de amostra — 5 perfis, 5 UFs, 10 regiões — em `pipeline/tests/fixtures/retrato_federal.json`) e `pipeline/tests/test_regressao_federal.py` (recalcula e compara).
  - **Verificar:** gerar o retrato, rodar o teste duas vezes sem mudança → passa; alterar um número num JSON exportado → falha.
  - **Cerca:** só leitura; não altera pipeline nem app.

- [ ] **8.1 `tabelas.py --cargo`**
  - **Objetivo:** gerar `votos_cand_mun_2026_estadual.parquet`, `validos_mun_2026_estadual.parquet`, `candidatos_2026_estadual.parquet` e `partido_mun_2026_estadual.parquet` com `CD_CARGO in (7, 8)`.
  - **Onde:** `pipeline/tabelas.py`, `pipeline/comum.py` (constante `CARGOS = {"federal": [6], "estadual": [7, 8]}` e função `sufixo(cargo)` que devolve `""` ou `"_estadual"`).
  - **Verificar:** `python pipeline/tabelas.py --ano 2026 --cargo estadual --uf MG` → 943 candidatos e **77 eleitos**; a soma dos válidos estaduais de MG é igual ao total de `QT_TOTAL_VOTOS_VALIDOS` do cargo 7 no `detalhe_votacao_munzona` de MG; o teste 8.0 passa (federais intactos).
  - **Cerca:** não mudar nomes de arquivo federais.

- [ ] **8.2 `exportar_web.py --cargo`**
  - **Objetivo:** exportar o estadual para `web/public/data/2026e/`, no mesmo formato do federal. `posicoes_proprias` filtra o CSV pela coluna `cargo` (linha sem `cargo` = federal).
  - **Onde:** `pipeline/exportar_web.py`, `config/candidatos_ideologia.csv` (acrescentar a coluna `cargo`).
  - **Verificar:** `meta.json` de `2026e` com MG; perfil de um eleito estadual com micros e `% da base` somando 1,0; teste 8.0 passa.
  - **Cerca:** tipologia e fotos ficam para a Etapa 10.

- [ ] **8.3 App: contexto de cargo, rotas e seletor**
  - **Objetivo:** `CargoContext` derivado do prefixo da rota (`#/estadual/...`); `api.*` lê de `data/2026/` ou `data/2026e/`; links gerados por um helper `rota(cargo, caminho)`; seletor no cabeçalho; título "Deputados Estaduais · 2026" (no DF, "Distritais").
  - **Onde:** `web/src/cargo.ts` (novo), `web/src/dados.ts`, `web/src/main.tsx`, páginas existentes.
  - **Verificar:** script Playwright com todas as rotas federais do smoke test atual, mais `#/estadual/` e `#/estadual/candidato/<sq de MG>`; zero erros; capturas conferidas.
  - **Cerca:** nenhuma página nova; só parametrizar as existentes.

- [ ] **8.4 Publicar** (pull request, merge, conferir o deploy).

### Etapa 9 — Estaduais no Brasil inteiro · *Visível: qualquer UF no modo Estadual, com a Assembleia, mapa por campo predominante e top 10 por região.*

- [ ] **9.1** Rodar 8.1–8.2 para as 27 UFs. **Verificar:** eleitos por UF = tamanho legal da Assembleia (CF art. 27: 3 × deputados federais até 36; acima disso, 24 + deputados federais; DF = 24). O script falha listando as divergências. **Cerca:** sem mudanças de interface.
- [ ] **9.2** Páginas Brasil, UF e região no modo estadual: "Assembleia Legislativa de MG · 77 cadeiras", bancada, eleitos, campo predominante, top 10 por micro, meso e município. **Verificar:** capturas de MG, SP, DF e RR. **Cerca:** reaproveitar os componentes; sem gráficos novos.
- [ ] **9.3** Orçamento de publicação: `find web/dist -type f | wc -l` < 2.500 e `du -sh web/dist` < 300 MB; deploy em menos de 3 min. **Se estourar:** aumentar os grupos de perfis (256 → 512) só no estadual.

### Etapa 10 — Recursos completos para estaduais · *Visível: fotos, tipologia, CSV, edição e uso offline também no modo Estadual.*

- [ ] **10.1** `fotos.py --cargo estadual` (os zips do TSE já baixados contêm os estaduais). **Verificar:** cerca de 1.059 fotos, sem faltantes.
- [ ] **10.2** `tipologia.py --cargo estadual`. **Verificar:** distribuição por tipo em MG e SP; DF sem tipologia.
- [ ] **10.3** A edição de posicionamento grava `cargo` no CSV. **Verificar:** teste com API do GitHub simulada (como na Fase 1) para um estadual e um federal.
- [ ] **10.4** Offline: um `arquivos.json` por cargo; o botão salva o cargo selecionado. **Verificar:** teste sem internet em páginas estaduais não visitadas.
- [ ] **10.5** CSV com o cargo no nome do arquivo. **Verificar:** baixar os três CSVs no modo estadual.

### Etapa 11 — Dobradinhas · *Visível: no perfil, "parceiros prováveis" do outro cargo, com o grau de sobreposição; na UF, a lista dos pares mais fortes.*

- [ ] **11.1 Pesquisar e decidir a métrica** (registrar em `docs/decisoes.md`). Candidatas:
  (a) correlação de Pearson das fatias municipais (x_m = v_m / T_m) dos dois candidatos;
  (b) sobreposição de base Σ min(p_m^A, p_m^B), com p = distribuição dos votos do candidato;
  (c) a métrica (b) corrigida pelo esperado se ambos votassem como o eleitorado.
  **Risco conhecido:** em (b), dois candidatos de capital parecem "parceiros" só por dependerem da capital. **Critério de escolha:** em MG e SP, entre os 5 parceiros mais fortes de cada eleito, a fração do mesmo partido ou federação deve ser alta, e pares de capital sem afinidade partidária não devem dominar.
- [ ] **11.2** `pipeline/dobradinhas.py` → `data/processed/dobradinhas_2026.parquet` (top 5 parceiros por candidato; só candidatos com pelo menos 0,1% dos válidos da UF). **Verificar:** simetria (se A lista B com força s, B lista A com a mesma s quando ambos estão no top).
- [ ] **11.3** Perfil (bloco "Parceiros prováveis", com link para o perfil no outro cargo) e UF (tabela dos 20 pares mais fortes). **Cerca:** descrever como "bases sobrepostas", nunca afirmar acordo político; nota de método explicando.

---

## FASE 3 — Home do cenário nacional e Senado

> Pedido do Yuri (10/11/2026): uma página inicial com a leitura geral do Congresso que toma posse em 2027 (hemiciclos da Câmara e do Senado na cor dos campos, aritmética de votações, renovação, mapa do Brasil, maiores votações e puxadores, governadores 2026, bancadas e variação) e a mesma análise dos deputados para os senadores eleitos em 2022 e em 2026, indicando os suplentes que assumiram no lugar de titulares que saíram.
>
> **Ordem de execução recomendada (Fases 2 e 3 juntas):** 12 → 8 → 13 → 14 → 15 → 9 → 10 → 11. A Etapa 12 é uma vitória rápida que só usa dados já prontos. A Etapa 8 cria a infraestrutura de cargo (seletor e rotas), que o Senado reaproveita na Etapa 14.

### Etapa 12 — Home com o hemiciclo da Câmara · *Visível: ao abrir o app, a home mostra as 513 cadeiras da Câmara eleita para 2027, coloridas por campo, com as bancadas.*

- [ ] **12.1 Rotas:** a home passa a ser `#/`, e a busca vai para `#/buscar`. Links antigos (`#/?q=…`, `#/?partido=…`) redirecionam para `#/buscar?…`. **Onde:** `web/src/main.tsx`, `web/src/pages/Home.tsx` (novo), `Busca.tsx`. **Verificar:** smoke test de todas as rotas; um link antigo de busca abre a busca com o filtro. **Cerca:** sem análises ainda.
- [ ] **12.2 Componente `Hemiciclo`:** SVG de assentos em arcos (algoritmo padrão de "parliament diagram": fileiras concêntricas, assentos distribuídos proporcionalmente ao comprimento de cada fileira), partidos agrupados da Esquerda (à esquerda) ao Centro e à Direita, cor do campo (verde/amarelo/vermelho), separação fina entre partidos, tooltip com partido, campo e cadeiras, legenda com a contagem de cada campo. **Onde:** `web/src/components/Hemiciclo.tsx`. **Verificar:** 513 assentos desenhados e soma por campo igual à de `meta.json`; captura conferida. **Cerca:** um só componente, reaproveitado no Senado; nada de cor por partido (D18).
- [ ] **12.3 Bancadas 2027:** tabela de partidos da Câmara (cadeiras, campo, federação) ao lado do hemiciclo. **Verificar:** soma 513. **Cerca:** a variação desde 2022 fica para a Etapa 15.
- [ ] **12.4 Publicar.**

### Etapa 13 — Dados do Senado e composição 2027 · *Visível: a home ganha o hemiciclo do Senado (81 cadeiras), com os suplentes em exercício marcados.*

- [ ] **13.1 Pesquisar e liberar o acesso aos dados do Senado.** Pedir a liberação de `legis.senado.leg.br` pelas ferramentas de ambiente (o ambiente atual é o Default; criar um ambiente pessoal do repositório com os hosts do TSE e do Senado, conforme a regra da ferramenta). Confirmar, na API de dados abertos (`/dadosabertos/senador/lista/atual` e o histórico de mandatos/exercícios), os campos de: titular ou suplente, data de início do exercício, motivo do afastamento do titular e código do parlamentar. **Verificar:** uma chamada devolve os 81 senadores em exercício; registrar os campos em `docs/dados.md`. **Se a API recusar** (bloqueio ou fora do ar): usar a lista mantida à mão (13.4b).
- [ ] **13.2 Resultados do Senado no TSE:** `tabelas.py --cargo senado` para 2022 (1 vaga por UF) e 2026 (2 vagas por UF), `CD_CARGO = 5`. **Pesquisar antes:** a convenção do "% do local" quando cada eleitor dá 2 votos (2026): usar a mesma do TSE (votos do candidato ÷ total de votos válidos para senador, que soma os dois votos) e explicar na nota de método. **Verificar:** 27 eleitos em 2022 e 54 em 2026, 1 e 2 por UF.
- [ ] **13.3 Candidaturas (suplentes e CPF):** baixar `consulta_cand_{2022,2026}.zip` do TSE (`cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/`) para obter o 1º e o 2º suplentes de cada chapa de senador (cargos 9 e 10) e o CPF de todos os candidatos (usado também na renovação, 15.2). **Verificar:** cada senador eleito tem dois suplentes; CPFs presentes nos eleitos.
- [ ] **13.4 Composição do Senado em 2027** → `data/processed/senado_2027.parquet`: 54 cadeiras dos eleitos em 2026 e 27 da turma de 2022, com o **ocupante atual** (API do Senado). Previsão: se o titular de 2022 foi eleito governador ou vice em 2026 (cruzamento por CPF com o cargo 3/4 de 2026), a cadeira fica marcada como "suplente deve assumir em 2027", com o nome do suplente. **(b) Alternativa manual:** `config/senado_exercicio.csv`, editável pelo app, como o posicionamento. **Verificar:** 81 cadeiras; cada suplente em exercício traz o titular e o motivo; os casos de titular eleito governador são listados no log.
- [ ] **13.5 Hemiciclo do Senado na home**, com marcação visual de suplente em exercício (contorno) e tooltip "suplente de X (motivo)". **Verificar:** 81 assentos; captura conferida.

### Etapa 14 — Senado no app · *Visível: o seletor ganha a opção "Senado"; cada senador tem perfil com mapa, % do local e % da base, e cada região mostra o top 10 da disputa.*

- [ ] **14.1** Exportar `data/2026s/` (disputa de 2026) e `data/2022s/` (disputa de 2022), no mesmo formato dos deputados. **Depende da Etapa 8** (infraestrutura de cargo).
- [ ] **14.2** Seletor "Federal | Estadual | Senado". No modo Senado, a página da UF mostra as duas turmas ("Eleitos em 2026 · mandato 2027–2035" e "Eleito em 2022 · mandato 2023–2031"), quem está em exercício e os suplentes; o top 10 por região é por disputa (2026 ou 2022). A busca cobre as duas disputas, com o ano indicado.
- [ ] **14.3** Perfil do senador: mapa, tabela, leitura ideológica, tipologia (`tipologia.py --cargo senado`), fotos (zips do TSE) e, quando for o caso, "em exercício: suplente X desde dd/mm/aaaa". **Verificar:** capturas de um senador de 2026, de um de 2022 com suplente em exercício e de um titular eleito governador.

### Etapa 15 — Home analítica · *Visível: a home traz as seis análises pedidas, com links para as páginas de detalhe.*

- [ ] **15.1 Aritmética de votações:** cadeiras de cada campo e de cada soma de campos (D, C, E, D+C, C+E, D+E) frente a: maioria absoluta (257 / 41), emenda constitucional (3/5: 308 / 49) e minoria de bloqueio de emenda (206 / 33). Mostrar, para Câmara e Senado, quem alcança cada patamar. **Verificar:** contas conferidas à mão contra `meta.json`. **Cerca:** sem simular votações reais; é aritmética de cadeiras.
- [ ] **15.2 Renovação:** Câmara: reeleitos (eleitos em 2022 e em 2026, cruzados por CPF), novatos e "não voltaram", com o destino destes (não concorreu; concorreu e perdeu; foi para Senado, governo ou Assembleia). Senado: das 54 vagas de 2026, quantos titulares da turma de 2018 voltaram. **Pesquisar antes:** baixar o resultado do Senado de 2018 do TSE (`consulta_cand_2018` ou `votacao_candidato_munzona_2018`, cargo 5, só os eleitos). **Verificar:** reeleitos + novatos = 513; nenhum eleito sem cruzamento (se houver, listar e resolver por nome + UF).
- [ ] **15.3 Bancadas e variação desde 2022:** cadeiras por partido e por federação em 2022 e em 2026, agregando partidos fundidos pela tabela `config/partidos_sucessao.csv` (ex.: PTB e Patriota → PRD; PSC → Podemos; PROS → Solidariedade; PMN → Mobiliza; PMB → Democrata; PTC → Agir). **O Yuri revisa a tabela de sucessão.** Senado: composição 2027 frente à de 2023 (turmas de 2018 e 2022). **Verificar:** totais 513 e 81 nos dois anos.
- [ ] **15.4 Mapa do Brasil:** TopoJSON nacional (UFs e micros, dissolvidos do geobr) com campo predominante por UF e por micro (Câmara 2026), Senado 2026 (disputa de 2026) e governadores (15.6). Clique leva à página da UF ou da região. **Verificar:** 27 UFs e 558 micros; tamanho do arquivo abaixo de 2 MB.
- [ ] **15.5 Maiores votações e puxadores:** os 20 deputados mais votados do país (votos, % dos válidos da UF, quantos quocientes eleitorais os votos representam, QE = válidos ÷ cadeiras da UF) e os senadores mais votados. **Cerca:** "quantos quocientes" é estimativa do peso do puxador, não o número exato de eleitos por ele; dizer isso na tela.
- [ ] **15.6 Governadores 2026:** eleitos (1º ou 2º turno; **pesquisar antes** se o turno 2 está no mesmo arquivo do TSE, `NR_TURNO = 2`), partido, campo e votação, em mapa e lista. **Verificar:** 27 governadores.
- [ ] **15.7 Publicar** e revisar a home inteira com o Yuri.

---

## 5. Riscos e alarmes

> **Ocorrido em 03/11/2026:** com um arquivo por candidato e por região (~16 mil arquivos), o GitHub Pages passou dos 10 min de limite duas vezes. Correção: perfis agrupados em 256 arquivos (`sq % 256`) e tops em um arquivo por tipo e UF (código IBGE de 2 dígitos), somando ~450 arquivos; o tempo-limite do envio também subiu para 30 min. **Não voltar a gravar um arquivo por item.**


| Risco | Alarme (quando se descobre) | Plano B |
|---|---|---|
| TSE/IBGE inacessíveis (sandbox bloqueia; Actions pode sofrer bloqueio geográfico) | Passo 1.1, primeira execução | Liberar os domínios no ambiente da nuvem; ou rodar `make dados` no Mac e versionar `data/processed/`. |
| Arquivos de 2026 com colunas renomeadas ou ainda não publicados | Passo 1.1 (assert de colunas em `pipeline/colunas.py`) | Atualizar o mapeamento de colunas; em último caso, usar os JSON de resultados da totalização (pesquisar). |
| Município sem correspondência TSE↔IBGE ou sem micro/meso (municípios criados depois de 2017) | Passo 1.2 (lista de órfãos) | `config/municipios_override.csv`, atribuindo a micro do município de origem. |
| Pipeline não reproduz a planilha 2022 | Passo 1.3 (pytest) | Testar definições alternativas de "válidos" e registrar em `docs/dados.md`. Tolerância máxima de 0,5% com nota explicando. |
| Site grande demais para o Pages (limite de 1 GB; 100 MB por arquivo) | Passo 4.2 | Compactar o formato; cortar o detalhe municipal de candidatos com poucos votos (< 1.000). |
| Classificação ideológica vira ponto político sensível num site público | Etapa 5 | Exibir a fonte ("classificação: Aliança, revisão de dd/mm/aaaa"); ou tornar o repo privado (ver decisão em aberto). |
| (Fase 2) Mudança compartilhada quebra os federais | Teste 8.0 a cada passo | Reverter o passo; o federal é o produto já em uso |
| (Fase 2) Número de eleitos estaduais não bate com o tamanho da Assembleia | Passo 9.1 (checagem automática) | Investigar `DS_SIT_TOT_TURNO` da UF (recontagens, decisões judiciais) e documentar exceções em `docs/dados.md` |
| (Fase 2) Site grande demais ou publicação lenta | Passo 9.3 | Mais grupos de perfis; tops por município só para municípios com voto |
| (Fase 2) Métrica de dobradinha enviesada por capitais | Passo 11.1 (critério do mesmo partido) | Usar a métrica (c), corrigida pelo eleitorado, ou excluir a capital do cálculo |
| (Fase 3) API do Senado inacessível (rede do ambiente, bloqueio a IPs estrangeiros no GitHub Actions ou instabilidade) | Passo 13.1 | Retrato versionado gerado onde a API responder; em último caso, `config/senado_exercicio.csv` mantido à mão pelo app |
| (Fase 3) Cruzamento de pessoas entre eleições falha (renovação, suplentes, governadores) | Passos 13.3 e 15.2 (contagem de eleitos sem par) | CPF da `consulta_cand`; sem CPF, nome + UF com revisão manual dos casos listados |
| (Fase 3) Fusões e federações confundem a variação de bancadas | Passo 15.3 | Tabela de sucessão revisada pelo Yuri antes de publicar |
| (Fase 3) Governadores em 2º turno ausentes do arquivo | Passo 15.6 | Arquivo de 2º turno do TSE (pesquisar o nome do conjunto) |

---

## 6. Como trabalhar neste repositório (para qualquer sessão)

1. Ler o bloco 0 e achar o primeiro `[ ]` não marcado.
2. Executar **um passo por vez**, respeitando a **Cerca**.
3. Rodar o **Verificar**. Se não passar, o passo não está concluído.
4. Marcar `[x]`, atualizar o **Status** no bloco 0 e fazer commit com a mensagem `etapa X.Y: <resumo>`.
5. Se surgir uma decisão que o plano não previu (ex.: definição de métrica, escolha de fonte), registrar em `docs/decisoes.md` e, se for de julgamento político ou institucional, **perguntar ao Yuri**.
