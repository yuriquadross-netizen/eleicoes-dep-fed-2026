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

