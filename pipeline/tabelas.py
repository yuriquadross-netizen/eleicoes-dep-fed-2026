"""Passo 1.3 — tabelas centrais de votação (Deputado Federal, 1º turno).

Saídas em data/processed/ (uma por ano):
  votos_cand_mun_{ANO}.parquet  sq_candidato, cd_ibge, votos (nominais VÁLIDOS), votos_brutos
  validos_mun_{ANO}.parquet     cd_ibge, uf, aptos, comparecimento, validos, nominais, legenda, brancos, nulos
  candidatos_{ANO}.parquet      sq_candidato, nr, nome, nome_urna, partido, nr_partido, federacao,
                                uf, situacao, situacao_tse, candidatura, votos_total, votos_brutos_total
  Regra: "votos" são sempre os nominais válidos — candidatos inaptos (votos anulados)
  ficam com zero, como na planilha da Aliança. Ver docs/dados.md.
  partido_mun_{ANO}.parquet     partido, federacao, cd_ibge, nominais, legenda   (leitura ideológica)

Uso: python pipeline/tabelas.py --ano 2026 [--uf MG] [--cargo federal|estadual|senado]
Cargo estadual = Deputado Estadual (7) e Deputado Distrital (8, DF); arquivos com sufixo _estadual.
Cargo senado = Senador (5), sem os suplentes da chapa; arquivos com sufixo _senado.
"""
from __future__ import annotations

import sys
import zipfile
from pathlib import Path

import duckdb
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from comum import CARGOS, INTERIM, PROCESSED, RAW_TSE, args_padrao, sufixo, ufs_de  # noqa: E402

SITUACAO = {
    "ELEITO POR QP": "Eleito",
    "ELEITO POR MÉDIA": "Eleito",
    "ELEITO": "Eleito",
    "SUPLENTE": "Suplente",
    "NÃO ELEITO": "Não eleito",
}


def extrair(conjunto: str, ano: int, uf: str) -> Path:
    destino = INTERIM / f"{conjunto}_{ano}_{uf}.csv"
    if not destino.exists():
        INTERIM.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(RAW_TSE / f"{conjunto}_{ano}.zip") as z:
            with z.open(f"{conjunto}_{ano}_{uf}.csv") as src, open(destino, "wb") as dst:
                while bloco := src.read(1 << 24):
                    dst.write(bloco)
    return destino


def ler(con: duckdb.DuckDBPyConnection, caminho: Path) -> str:
    return (f"read_csv('{caminho}', delim=';', quote='\"', encoding='latin-1', header=true, "
            f"all_varchar=true)")


def processar_uf(con, ano: int, uf: str, mun: pd.DataFrame, cargos: str) -> dict[str, pd.DataFrame]:
    con.register("mun", mun[["cd_tse", "cd_ibge"]])
    out = {}

    f = extrair("votacao_candidato_munzona", ano, uf)
    base = f"select * from {ler(con, f)} where CAST(CD_CARGO AS INT) IN ({cargos}) and NR_TURNO = '1'"
    out["votos"] = con.sql(f"""
        select CAST(c.SQ_CANDIDATO AS BIGINT) sq_candidato, m.cd_ibge,
               SUM(CAST(c.QT_VOTOS_NOMINAIS_VALIDOS AS BIGINT)) votos,
               SUM(CAST(c.QT_VOTOS_NOMINAIS AS BIGINT)) votos_brutos
        from ({base}) c join mun m on m.cd_tse = CAST(c.CD_MUNICIPIO AS BIGINT)
        group by all having SUM(CAST(c.QT_VOTOS_NOMINAIS AS BIGINT)) > 0
    """).df()
    out["cand"] = con.sql(f"""
        select CAST(SQ_CANDIDATO AS BIGINT) sq_candidato, any_value(NR_CANDIDATO) nr,
               any_value(NM_CANDIDATO) nome, any_value(NM_URNA_CANDIDATO) nome_urna,
               any_value(SG_PARTIDO) partido, any_value(NR_PARTIDO) nr_partido,
               any_value(regexp_replace(NULLIF(SG_FEDERACAO, '#NULO'), '[0-9]+-', '', 'g')) federacao, any_value(SG_UF) uf,
               any_value(DS_SIT_TOT_TURNO) situacao_tse, any_value(DS_SITUACAO_CANDIDATURA) candidatura,
               SUM(CAST(QT_VOTOS_NOMINAIS_VALIDOS AS BIGINT)) votos_total,
               SUM(CAST(QT_VOTOS_NOMINAIS AS BIGINT)) votos_brutos_total
        from ({base}) group by all
    """).df()
    f.unlink()

    f = extrair("detalhe_votacao_munzona", ano, uf)
    out["validos"] = con.sql(f"""
        select m.cd_ibge, any_value(d.SG_UF) uf,
               SUM(CAST(QT_APTOS AS BIGINT)) aptos, SUM(CAST(QT_COMPARECIMENTO AS BIGINT)) comparecimento,
               SUM(CAST(QT_TOTAL_VOTOS_VALIDOS AS BIGINT)) validos,
               SUM(CAST(QT_VOTOS_NOMINAIS_VALIDOS AS BIGINT)) nominais,
               SUM(CAST(QT_TOTAL_VOTOS_LEG_VALIDOS AS BIGINT)) legenda,
               SUM(CAST(QT_VOTOS_BRANCOS AS BIGINT)) brancos,
               SUM(CAST(QT_TOTAL_VOTOS_NULOS AS BIGINT)) nulos
        from {ler(con, f)} d join mun m on m.cd_tse = CAST(d.CD_MUNICIPIO AS BIGINT)
        where CAST(CD_CARGO AS INT) IN ({cargos}) and NR_TURNO = '1'
        group by m.cd_ibge
    """).df()
    f.unlink()

    f = extrair("votacao_partido_munzona", ano, uf)
    out["partido"] = con.sql(f"""
        select p.SG_PARTIDO partido, any_value(regexp_replace(NULLIF(p.SG_FEDERACAO, '#NULO'), '[0-9]+-', '', 'g')) federacao, m.cd_ibge,
               SUM(CAST(QT_VOTOS_NOMINAIS_VALIDOS AS BIGINT)) nominais,
               SUM(CAST(QT_TOTAL_VOTOS_LEG_VALIDOS AS BIGINT)) legenda
        from {ler(con, f)} p join mun m on m.cd_tse = CAST(p.CD_MUNICIPIO AS BIGINT)
        where CAST(CD_CARGO AS INT) IN ({cargos}) and NR_TURNO = '1'
        group by p.SG_PARTIDO, m.cd_ibge
    """).df()
    f.unlink()
    con.unregister("mun")
    for df in out.values():  # SUM do DuckDB vira float no pandas; volta para inteiro
        for col in df.columns:
            if df[col].dtype.kind == "f":
                df[col] = df[col].fillna(0).astype("int64")
    return out


def main() -> None:
    a = args_padrao(__doc__)
    ufs = ufs_de(a.uf)
    mun = pd.read_parquet(PROCESSED / "municipios.parquet")
    con = duckdb.connect()
    partes: dict[str, list[pd.DataFrame]] = {"votos": [], "cand": [], "validos": [], "partido": []}
    for uf in ufs:
        r = processar_uf(con, a.ano, uf, mun, ','.join(map(str, CARGOS[a.cargo])))
        for k, v in r.items():
            partes[k].append(v)
        print(f"  {uf}: {len(r['cand'])} candidatos, {len(r['votos'])} linhas cand×mun, "
              f"{r['validos'].validos.sum():,} válidos")

    cand = pd.concat(partes["cand"], ignore_index=True)
    cand["situacao"] = cand["situacao_tse"].map(SITUACAO).fillna("Outros")
    cand["votos_anulados"] = (cand.votos_total == 0) & (cand.votos_brutos_total > 0)
    for col in ["votos_total", "votos_brutos_total"]:
        cand[col] = cand[col].fillna(0).astype("int64")
    for k, nome in [("votos", "votos_cand_mun"), ("validos", "validos_mun"), ("partido", "partido_mun")]:
        df = pd.concat(partes[k], ignore_index=True)
        _salvar(df, nome, sufixo(a.cargo), a.ano, ufs)
    _salvar(cand, "candidatos", sufixo(a.cargo), a.ano, ufs)

    # Checagens de consistência
    v = pd.concat(partes["votos"]); val = pd.concat(partes["validos"])
    assert (v.groupby("sq_candidato").votos.sum().reindex(cand.sq_candidato).fillna(0).values
            == cand.votos_total.values).all(), "soma por município ≠ total do candidato"
    print(f"OK {a.ano}: {len(cand)} candidatos, {(cand.situacao == 'Eleito').sum()} eleitos, "
          f"{val.validos.sum():,} votos válidos")


def _salvar(df: pd.DataFrame, base: str, suf: str, ano: int, ufs: list[str]) -> None:
    """Mescla com o arquivo existente substituindo só as UFs processadas agora."""
    caminho = PROCESSED / f"{base}_{ano}{suf}.parquet"
    col_uf = "uf" if "uf" in df.columns else None
    if caminho.exists():
        antigo = pd.read_parquet(caminho)
        if col_uf:
            antigo = antigo[~antigo["uf"].isin(ufs)]
        else:
            mun = pd.read_parquet(PROCESSED / "municipios.parquet")
            cods = set(mun[mun.uf.isin(ufs)].cd_ibge)
            antigo = antigo[~antigo["cd_ibge"].isin(cods)]
        df = pd.concat([antigo, df], ignore_index=True)
    df.to_parquet(caminho, index=False)


if __name__ == "__main__":
    main()
