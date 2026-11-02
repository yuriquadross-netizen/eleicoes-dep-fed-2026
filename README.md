# Mapa da Base de Votos — Deputados Federais 2026

App instalável no Mac (Safari › Arquivo › *Adicionar ao Dock*) para mapear a base eleitoral de todos os candidatos a deputado federal em 2026, com dados abertos do TSE e divisões regionais do IBGE.

**O que o app faz**
- Busca por nome ou partido → perfil do candidato.
- Navegação por Região › UF › mesorregião/microrregião (ou região intermediária/imediata), com o **top 10** de cada recorte.
- Perfil com mapa do estado por microrregião, lista das regiões e municípios mais votados e as duas métricas de base:
  - **% dos votos válidos do local** que foram para o candidato;
  - **% da votação do candidato** que veio daquele local.
- Leitura ideológica por região (Direita/Centro/Esquerda), conforme a tabela de partidos da Aliança.

**Onde está cada coisa**
| | |
|---|---|
| `PLAN.md` | Plano de construção, etapas e status. **Comece por aqui.** |
| `docs/decisoes.md` | Decisões tomadas e o porquê. |
| `docs/dados.md` | Fontes, dicionário de dados e definição das métricas. |
| `config/` | Tabelas editáveis (classificação ideológica, ajustes de municípios). |
| `pipeline/` | Scripts Python que baixam e processam os dados. |
| `web/` | O app (React + Vite). |

Status atual: ver o bloco 0 do `PLAN.md`.
