# Log de decisões

Formato: data · decisão · por quê · quem decidiu. Mudanças de rumo entram aqui **antes** de mudar o código.

| Data | Decisão | Por quê | Quem |
|---|---|---|---|
| 2026-11-02 | Instalação via Safari › *Adicionar ao Dock* (site estático no GitHub Pages) | Mesmo modelo do app da apuração; sem servidor, sem custo | Yuri |
| 2026-11-02 | Duas divisões regionais com seletor; padrão meso/micro antigas | Comparabilidade com a planilha 2022 da Aliança + divisão oficial atual disponível | Yuri |
| 2026-11-02 | Rankings e perfis incluem todos os candidatos; busca filtra eleitos por padrão | Suplentes fortes são informação política local | Yuri |
| 2026-11-02 | Leitura ideológica por região via `config/partidos_ideologia.csv` editável | Classificação é julgamento da Aliança, deve ser visível e corrigível | Yuri |
| 2026-11-02 | Pipeline Python/DuckDB → Parquet versionado → JSON estático; mapas SVG com d3-geo | Ver PLAN.md §1 (D1–D9) | Plano |
| 2026-11-02 | Planilha original (.xlsx) fica fora do repo público; só os números de 2022 viram fixture de teste | Repo é público; a planilha é material interno da Aliança | Plano |
| 2026-11-02 | Site público, sem marca (padrão) | Escolha do Yuri | Yuri |
| 2026-11-02 | Classificação 2026. Direita: PL, PP, União, Republicanos, Novo, DC, Missão, PRTB. Centro: PSD, MDB, Podemos, Avante, Solidariedade, PSDB, Cidadania, PRD, Mobiliza, Agir, Democrata (ex-PMB). Esquerda: os demais | Confirmada pelo Yuri | Yuri |
| 2026-11-02 | Ideologia = (nominais + legenda) ÷ válidos; Direita + Centro + Esquerda = 100% | Coerência entre numerador e denominador (a planilha 2022 usava só nominais) | Plano (recomendação não contestada) |
| 2026-11-02 | ~~Paleta ideológica azul ↔ cinza ↔ vermelho~~ (substituída) | — | Plano |
| 2026-11-02 | **Cores fixas: Direita = verde, Centro = amarelo, Esquerda = vermelho**, nas barras e nos mapas (escalas de 7 tons de cada cor). O mapa de votos do candidato segue azul, porque mostra votos e não ideologia | Pedido do Yuri; trio validado para daltonismo nos dois modos | Yuri |
| 2026-11-03 | **Sem modo escuro:** o app é sempre claro, mesmo com o Mac no modo escuro | Pedido do Yuri | Yuri |
| 2026-11-03 | Mapa do perfil usa a cor do campo do partido do candidato (verde/amarelo/vermelho) | Pedido do Yuri | Yuri |
| 2026-11-03 | Mapa da UF abre em **"Campo predominante"**: cor do campo vencedor em cada região, intensidade pela fatia dele (<40%, 40–45, 45–50, 50–55, 55–65, ≥65%). Os modos % Direita/Centro/Esquerda continuam disponíveis | Pedido do Yuri; faixas fixas para comparar regiões e estados | Yuri |
| 2026-11-03 | Escala amarela clareada no fim (mínimo L 0,58) para não virar marrom | Legibilidade de "tons de amarelo" | Plano |
| 2026-11-03 | **Republicanos, União Brasil e PP passam para Centro.** Direita: PL, Novo, Missão, DC, PRTB. Efeito no Brasil: Direita 47,0% → 26,5% dos válidos; Centro 26,7% → 47,2% | Revisão do Yuri | Yuri |
| 2026-11-03 | **Posicionamento próprio por parlamentar** (`config/candidatos_ideologia.csv`): o campo marcado vale para o perfil (cor e rótulo) e para as somas regionais; seus votos nominais saem do campo do partido, e a legenda continua com o partido | Pedido do Yuri | Yuri |
| 2026-11-03 | **Edição do posicionamento direto no app**: grava `config/candidatos_ideologia.csv` na `main` via API do GitHub, com chave de acesso (fine-grained, só este repositório, Contents: Read and write) guardada no navegador do Yuri; o commit republica o site e o app acompanha. Visitantes sem chave não veem o editor | Pedido do Yuri; sem servidor próprio, o GitHub é a fonte única e auditável | Yuri |
| 2026-11-10 | **Tipologia da base (Ames)** com concentração pelo **índice G** (distância entre a distribuição dos votos do candidato e a do eleitorado da UF) e dominância de Ames; o I de Moran fica como contiguidade. Tipos relativos à mediana dos eleitos da UF; DF sem tipologia; UF com menos de 30 municípios marcada como de baixa confiabilidade | O Moran sozinho classifica como "concentrado" quem tem votos no estado inteiro (ex.: Nikolas, MG 2026, Moran 0,57, G 0,15). Validação: nos 26 reeleitos de MG, correlação 2022×2026 de 0,88 (G) e 0,64 (dominância); 62% mantêm o tipo, e as mudanças se concentram perto da mediana | Plano |
| 2026-11-10 | **Fase 2 — deputados estaduais:** seletor Federal/Estadual no topo; estadual = cargos 7 e 8 (distrital no DF); mesma tabela ideológica dos partidos; dobradinhas (pares federal–estadual com bases sobrepostas) como etapa final. Detalhes em PLAN.md, D10–D14 e Etapas 8–11 | Decisões do Yuri; reaproveita todo o código validado sem alterar o federal | Yuri |
| 2026-11-10 | **Fase 3 — home e Senado:** home como página inicial com a composição **eleita para 2027** (hemiciclos por campo, aritmética de votações, renovação, mapa do Brasil, maiores votações e puxadores, governadores 2026, bancadas e variação); Senado como terceiro cargo (disputas de 2022 e 2026); suplentes em exercício pela API do Senado. Detalhes em PLAN.md, D15–D20 e Etapas 12–15 | Decisões do Yuri (10/11) | Yuri |
| 2026-11-10 | **Dados versionados no endereço** (`?v=<gerado_em>`) e `meta.json` em NetworkFirst no service worker | Incidente: após publicar a home, o app aberto pelo Dock leu do cache o `meta.json` antigo (sem a lista da Câmara) com o código novo e mostrou "0 cadeiras" até recarregar. Com a versão no endereço, código e dados de uma mesma publicação andam sempre juntos, inclusive offline | Plano |
| 2026-11-10 | PCB classificado como Esquerda | Só disputou cargos estaduais; regra do Yuri: "Esquerda: todo o restante" | Yuri (regra) |
| 2026-11-10 | **Fase 4 — refino da interface pelos princípios de design da Apple** (skill `apple-design`) como etapa final (16), para todas as páginas de uma vez; o app continua só claro e as cores dos campos não mudam. Detalhes em PLAN.md, D21–D23 e Etapa 16 | Pedido do Yuri | Yuri |
| 2026-11-10 | **Regra de trabalho:** avançar etapa a etapa, pedindo a autorização do Yuri antes de começar cada uma | Pedido do Yuri | Yuri |
| 2026-11-13 | **Etapa 13 concluída**: Senado 2027 com 81 cadeiras; turma de 2022 com ocupante e partido atuais (API do Senado), turma de 2026 pelo TSE; titular eleito para outro cargo → suplente "previsto" | Ver D26 e D27 no PLAN.md | Claude, a validar com o Yuri |
| 2026-11-13 | **Refino de interface antecipado** (16.1 a 16.4 e parte da 16.6): tokens, tipografia, cabeçalho translúcido, resposta na pressão, esqueletos, molas nos seletores e abas | Pedido do Yuri: "melhore o design do aplicativo… inclua animações onde couber" | Yuri |
| 2026-11-13 | `motion` usada só pela função `animate` | Orçamento de 40 KB comprimidos (16.4): a camada de React custava +43 KB; a função, +25 KB | Claude |
| 2026-11-13 | Cor da barra de título do app (theme-color) passa de azul-escuro para o tom de papel | Com o cabeçalho translúcido, a barra de título e o conteúdo viram uma superfície só | Claude, reversível em uma linha |
| 2026-11-13 | Ambiente de nuvem próprio do repositório (`eleicoes-dep-fed-2026`), com TSE, IBGE, Senado e o endereço do app publicado | A API do Senado e o GitHub Pages eram bloqueados no ambiente Default | Yuri (aprovou o pedido) |

