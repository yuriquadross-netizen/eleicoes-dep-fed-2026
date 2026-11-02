# data/

- `raw/`: downloads do TSE e do IBGE. **Não versionado.** Recriado por `make dados`.
- `processed/`: tabelas compactas em Parquet. **Versionado.** É a fonte do build do site.

Para regenerar: `make dados ANO=2026` (no Mac ou pelo workflow `dados.yml` no GitHub Actions).
