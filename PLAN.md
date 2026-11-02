# PLAN — Mapa da Base de Votos · Deputados Federais 2026

> Documento vivo. Atualize o **Status** e marque os passos concluídos (`[x]`) ao fim de cada sessão.
> Mudou uma decisão? Registre em `docs/decisoes.md` antes de mudar o código.

---

## 0. Bloco de passagem (cole isto primeiro numa sessão nova)

**O que é:** um app web instalável no Mac (Safari › Arquivo › *Adicionar ao Dock*, como o app da apuração) que mapeia a base de votos de todos os candidatos a deputado federal em 2026, com dados do TSE. O usuário pode (a) buscar um candidato por nome ou partido e abrir o perfil; (b) navegar por Região › UF › mesorregião/microrregião (divisão antiga do IBGE) ou região intermediária/imediata (divisão atual), com seletor, e ver o **top 10** de cada meso e micro. O perfil traz um **mapa coroplético do estado por microrregião** (mais escuro = mais votos), a lista das microrregiões e municípios mais votados e, para cada local, as duas métricas da planilha da Aliança: **% dos votos válidos do local que foram para o candidato** e **% da votação total do candidato que veio daquele local**. Inclui ainda uma leitura ideológica (Direita/Centro/Esquerda) por região, baseada numa tabela de partidos editável pela Aliança.

**Abordagem escolhida:** pipeline em Python (DuckDB) baixa TSE + IBGE e gera tabelas compactas (`data/processed/*.parquet`, versionadas). Um script de exportação transforma essas tabelas em JSON estático. Um site React (Vite + TypeScript) lê esse JSON e desenha os mapas em SVG (d3-geo + TopoJSON). O GitHub Actions publica no GitHub Pages, e o Yuri instala pelo Safari. Não há servidor nem banco de dados, e o custo é zero.

**Referência de validação:** `pipeline/tests/fixtures/planilha_alianca_2022_mg.csv` traz o mapeamento de 2022 feito pela Aliança (MG, 66 micros × top 10). Rodar o pipeline com `ANO=2022` precisa reproduzir esses números. Esse é o teste de que os dados de 2026 estarão certos.

**Status (02/11/2026):** Etapas 0 e 1 concluídas no código, com dados reais de 2026 para o Brasil inteiro (7.051 candidatos com voto, 513 eleitos). O pipeline reproduz a planilha 2022 da Aliança linha a linha (`make teste`). **Pendente da Etapa 1:** ativar o Pages e fazer o merge em `main` (passo 1.6, ação do Yuri). **Etapa 2 (mapa) concluída.** **Próximo passo de código: 3.2** (páginas de navegação geográfica; os JSON de top 10 por região já são exportados).

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

- [ ] **1.6 Publicação + instalação no Dock** → `deploy.yml` e ícones prontos; falta o Yuri ativar o Pages e fazer o merge em `main`
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
- [ ] **3.2 Rotas e páginas:** `#/brasil`, `#/regiao/:sigla` (UFs, cadeiras e bancada), `#/uf/:uf` (mapa clicável + eleitos), `#/r/:tipo/:id` (top 10 + mini-mapa com a região destacada + municípios). Breadcrumb em todas. **Verificar:** capturas Playwright das quatro rotas. **Cerca:** reaproveitar `MapaUF`.
- [ ] **3.3 Seletor de divisão:** alterna "Meso/Micro (IBGE até 2017)" ↔ "Intermediária/Imediata (IBGE atual)". Guarda a escolha no `localStorage` (envolto em try/catch) e afeta mapas, perfil e navegação. **Verificar:** alternar no perfil muda camada e tabela. **Cerca:** o padrão é sempre meso/micro.
- [ ] **3.4 Busca por partido:** `#/partido/:sigla` com candidatos da sigla por UF. **Verificar:** captura de `#/partido/PL`.

---

### Etapa 4 — Brasil inteiro · *Visível: qualquer deputado de qualquer UF tem perfil e mapa.*

- [ ] **4.1** Rodar 1.2–3.1 para as 27 UFs, com `ANO=2026`. **Verificar:** o nº de eleitos por UF bate com as cadeiras oficiais da eleição de 2026. **Não fixar 513 no código:** conferir no TSE a distribuição vigente (houve debate em 2025 sobre a ampliação da Câmara). O DF tem micro única: conferir que não quebra.
- [ ] **4.2 Orçamento de tamanho:** `du -sh web/dist` abaixo de 300 MB, nenhum arquivo acima de 50 MB e índice de busca abaixo de 1,5 MB gzip. **Se estourar:** listas por município só para municípios com voto e arrays em vez de objetos.
- [ ] **4.3 Busca nacional:** filtros de UF, partido e situação, com resultado instantâneo (< 100 ms) para ~10 mil nomes. **Verificar:** busca por "silva" devolve resultados de várias UFs.

---

### Etapa 5 — Leitura ideológica · *Visível: cada meso/micro mostra Direita/Centro/Esquerda %, e o mapa da UF pode ser colorido por isso.*

- [x] **5.1** (proposta gerada; **aguarda confirmação do Yuri**, ver `docs/dados.md`) Gerar `config/partidos_ideologia.csv` (`sigla, nome, federacao, classe`) com todos os partidos de 2026, com `classe` vazia ou com sugestão marcada `?`. **O Yuri preenche e revisa.** Nenhum cálculo roda com classe vazia (o pipeline falha com a lista das faltantes).
- [ ] **5.2** Calcular os percentuais por município e região a partir de `votacao_partido_munzona` (nominais + legenda). **Verificar:** com a classificação de 2022 da Aliança (pedir ao Yuri, ou inferir e confirmar com ele), Barbacena 2022 deve dar Direita ≈ 0,3159 e Centro ≈ 0,2227.
- [ ] **5.3** Exibir nas páginas de região e incluir a opção "Colorir por: % Direita" no `MapaUF` (paleta divergente). **Cerca:** a classificação nunca aparece no perfil do candidato como rótulo pessoal, só como agregado regional.

---

### Etapa 6 — Acabamento · *Visível: o app abre sem internet e tem fotos dos eleitos.*

- [ ] **6.1 Offline:** `vite-plugin-pwa` com precache do app e cache em tempo de execução para `data/` e `geo/`. **Verificar:** abrir, visitar 3 perfis, desligar o Wi-Fi e reabrir.
- [ ] **6.2 Fotos dos eleitos:** pacote de fotos do TSE (`fotos_cand{ANO}_{UF}_div.zip`; *confirmar nome*), redimensionadas para 160 px em WebP, **só para eleitos**.
- [ ] **6.3 (opcional) Tipologia de base eleitoral à la Barry Ames:** concentrada × dispersa (I de Moran entre micros) e dominante × compartilhada (média de `part_dep_regiao` ponderada). Mostrar como selo no perfil, com nota metodológica.
- [ ] **6.4 Exportar:** botão "Baixar CSV" no perfil e no top 10 (para planilhas da Aliança).

---

### Etapa 7 — (opcional, só com aval do Yuri)
- **Comparativo 2022 → 2026** para reeleitos: onde cresceu e onde perdeu (o pipeline já é parametrizado por ano).
- **Página do município:** top 10 por cidade, útil para reuniões com anfitriões no interior.

---

## 5. Riscos e alarmes

| Risco | Alarme (quando se descobre) | Plano B |
|---|---|---|
| TSE/IBGE inacessíveis (sandbox bloqueia; Actions pode sofrer bloqueio geográfico) | Passo 1.1, primeira execução | Liberar os domínios no ambiente da nuvem; ou rodar `make dados` no Mac e versionar `data/processed/`. |
| Arquivos de 2026 com colunas renomeadas ou ainda não publicados | Passo 1.1 (assert de colunas em `pipeline/colunas.py`) | Atualizar o mapeamento de colunas; em último caso, usar os JSON de resultados da totalização (pesquisar). |
| Município sem correspondência TSE↔IBGE ou sem micro/meso (municípios criados depois de 2017) | Passo 1.2 (lista de órfãos) | `config/municipios_override.csv`, atribuindo a micro do município de origem. |
| Pipeline não reproduz a planilha 2022 | Passo 1.3 (pytest) | Testar definições alternativas de "válidos" e registrar em `docs/dados.md`. Tolerância máxima de 0,5% com nota explicando. |
| Site grande demais para o Pages (limite de 1 GB; 100 MB por arquivo) | Passo 4.2 | Compactar o formato; cortar o detalhe municipal de candidatos com poucos votos (< 1.000). |
| Classificação ideológica vira ponto político sensível num site público | Etapa 5 | Exibir a fonte ("classificação: Aliança, revisão de dd/mm/aaaa"); ou tornar o repo privado (ver decisão em aberto). |

---

## 6. Como trabalhar neste repositório (para qualquer sessão)

1. Ler o bloco 0 e achar o primeiro `[ ]` não marcado.
2. Executar **um passo por vez**, respeitando a **Cerca**.
3. Rodar o **Verificar**. Se não passar, o passo não está concluído.
4. Marcar `[x]`, atualizar o **Status** no bloco 0 e fazer commit com a mensagem `etapa X.Y: <resumo>`.
5. Se surgir uma decisão que o plano não previu (ex.: definição de métrica, escolha de fonte), registrar em `docs/decisoes.md` e, se for de julgamento político ou institucional, **perguntar ao Yuri**.
