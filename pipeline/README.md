# pipeline/

Transforma os dados abertos do TSE e do IBGE nas tabelas que o app consome.

```
baixar_tse.py     → data/raw/            (passo 1.1)
municipios.py     → data/processed/municipios.parquet          (1.2)
tabelas.py        → data/processed/{votos_cand_mun,validos_mun,candidatos}.parquet  (1.3)
geometrias.py     → web/public/geo/{UF}.topo.json              (2.1)
exportar_web.py   → web/public/data/{ANO}/...                  (1.4, 3.1)
```

Todos os scripts aceitam `--ano` (2022 | 2026) e `--uf` (sigla ou `BR`).

Validação: `pytest pipeline/tests` compara o resultado de 2022 com o mapeamento da Aliança em `tests/fixtures/planilha_alianca_2022_mg.csv`.

Ambiente: `python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt`. As geometrias usam `npx mapshaper` (Node 20+).
