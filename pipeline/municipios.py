"""Passo 1.2 — tabela de municípios: código TSE ↔ código IBGE ↔ quatro recortes regionais.

Saída: data/processed/municipios.parquet com uma linha por município:
  cd_tse, cd_ibge, nome, uf, regiao,
  micro_id, micro_nome, meso_id, meso_nome,        (divisão IBGE até 2017)
  rgi_id, rgi_nome, rgint_id, rgint_nome           (divisão IBGE atual)

Como:
- Recortes regionais: junção espacial entre um ponto interno de cada polígono
  municipal (geobr 2024) e os polígonos de micro/meso (geobr 2020) e de
  imediata/intermediária (geobr 2019). Feita assim porque o IBGE bloqueia
  acesso fora do Brasil e as tabelas do geobr não trazem o cruzamento pronto.
- Código TSE ↔ IBGE: tabela betafcc/Municipios-Brasileiros-TSE; o que faltar
  é casado por nome normalizado + UF; o que ainda faltar vai para
  config/municipios_override.csv (o script falha listando os órfãos).

Uso: python pipeline/municipios.py
"""
from __future__ import annotations

import sys
import zipfile
from pathlib import Path

import geopandas as gpd
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from comum import CONFIG, PROCESSED, RAW, RAW_GEO, RAW_TSE, UF_REGIAO, normalizar  # noqa: E402

CAMADAS = {
    "micro": ("microregions_2020_simplified.parquet", "code_micro", "name_micro"),
    "meso": ("mesoregions_2020_simplified.parquet", "code_meso", "name_meso"),
    "rgi": ("immediateregions_2019_simplified.parquet", "code_immediate", "name_immediate"),
    "rgint": ("intermediateregions_2019_simplified.parquet", "code_intermediate", "name_intermediate"),
}


def recortes_ibge() -> pd.DataFrame:
    mun = gpd.read_parquet(RAW_GEO / "municipalities_2024_simplified.parquet")
    mun = mun[mun["code_muni"].notna()].copy()
    mun["cd_ibge"] = mun["code_muni"].astype("int64")
    # Lagoas dos Patos e Mirim (RS) aparecem como "municípios" 4300001/4300002 na malha.
    mun = mun[~mun["cd_ibge"].isin([4300001, 4300002])]
    pontos = mun[["cd_ibge", "name_muni", "abbrev_state", "geometry"]].copy()
    pontos["geometry"] = mun.geometry.representative_point()

    out = pontos.drop(columns="geometry").rename(columns={"name_muni": "nome", "abbrev_state": "uf"})
    for chave, (arq, col_id, col_nome) in CAMADAS.items():
        reg = gpd.read_parquet(RAW_GEO / arq)[[col_id, col_nome, "geometry"]].to_crs(mun.crs)
        j = gpd.sjoin(pontos, reg, how="left", predicate="within")
        j = j[~j.index.duplicated()]
        faltam = j[col_id].isna()
        if faltam.any():  # ponto caiu numa fresta da simplificação: usa a região mais próxima
            perto = gpd.sjoin_nearest(pontos[faltam].to_crs(5880), reg.to_crs(5880), how="left")
            perto = perto[~perto.index.duplicated()]
            j.loc[faltam, col_id] = perto[col_id]
            j.loc[faltam, col_nome] = perto[col_nome]
            print(f"  {chave}: {faltam.sum()} município(s) atribuídos pela região mais próxima")
        out[f"{chave}_id"] = j[col_id].astype("int64").values
        out[f"{chave}_nome"] = j[col_nome].values
    return out


def municipios_tse() -> pd.DataFrame:
    """Todos os municípios que aparecem nos arquivos do TSE (2022 e 2026)."""
    frames = []
    for zp in sorted(RAW_TSE.glob("detalhe_votacao_munzona_*.zip")):
        with zipfile.ZipFile(zp) as z:
            for n in z.namelist():
                if not n.endswith(".csv") or n.endswith(("_BR.csv", "_BRASIL.csv")):
                    continue
                df = pd.read_csv(z.open(n), sep=";", encoding="latin1",
                                 usecols=["SG_UF", "CD_MUNICIPIO", "NM_MUNICIPIO"], dtype=str)
                frames.append(df.drop_duplicates())
    df = pd.concat(frames).drop_duplicates(subset=["CD_MUNICIPIO"])
    df = df[df["SG_UF"] != "ZZ"]
    return df.rename(columns={"SG_UF": "uf", "CD_MUNICIPIO": "cd_tse", "NM_MUNICIPIO": "nome_tse"}).assign(
        cd_tse=lambda d: d["cd_tse"].astype("int64"))


def main() -> None:
    ibge = recortes_ibge()
    tse = municipios_tse()

    cw = pd.read_csv(RAW / "municipios_tse_ibge.csv", dtype={"codigo_tse": "int64", "codigo_ibge": "int64"})
    m = tse.merge(cw[["codigo_tse", "codigo_ibge"]], left_on="cd_tse", right_on="codigo_tse", how="left")
    m = m.rename(columns={"codigo_ibge": "cd_ibge"}).drop(columns="codigo_tse")

    # Fallback 1: nome normalizado + UF
    ibge["_k"] = ibge["uf"] + "|" + ibge["nome"].map(normalizar)
    chave_ibge = dict(zip(ibge["_k"], ibge["cd_ibge"]))
    sem = m["cd_ibge"].isna()
    m.loc[sem, "cd_ibge"] = (m.loc[sem, "uf"] + "|" + m.loc[sem, "nome_tse"].map(normalizar)).map(chave_ibge)

    # Fallback 2: override manual
    ov = pd.read_csv(CONFIG / "municipios_override.csv", dtype=str)
    if len(ov):
        mapa = dict(zip(ov["cd_tse"].astype("int64"), ov["cd_ibge"].astype("int64")))
        sem = m["cd_ibge"].isna()
        m.loc[sem, "cd_ibge"] = m.loc[sem, "cd_tse"].map(mapa)

    orfaos = m[m["cd_ibge"].isna()]
    if len(orfaos):
        print("Municípios do TSE sem código IBGE — adicione em config/municipios_override.csv:")
        print(orfaos.to_string(index=False))
        raise SystemExit(1)

    m["cd_ibge"] = m["cd_ibge"].astype("int64")
    final = m.merge(ibge.drop(columns=["_k", "uf"]), on="cd_ibge", how="left", validate="one_to_one")
    sem_regiao = final[final["micro_id"].isna()]
    if len(sem_regiao):
        print("Municípios sem recorte regional:")
        print(sem_regiao.to_string(index=False))
        raise SystemExit(1)

    final["regiao"] = final["uf"].map(UF_REGIAO)
    cols = ["cd_tse", "cd_ibge", "nome", "nome_tse", "uf", "regiao",
            "micro_id", "micro_nome", "meso_id", "meso_nome", "rgi_id", "rgi_nome", "rgint_id", "rgint_nome"]
    final = final[cols].sort_values(["uf", "nome"]).reset_index(drop=True)
    PROCESSED.mkdir(parents=True, exist_ok=True)
    final.to_parquet(PROCESSED / "municipios.parquet", index=False)

    mg = final[final.uf == "MG"]
    print(f"OK: {len(final)} municípios | MG: {len(mg)} mun, {mg.micro_id.nunique()} micros, "
          f"{mg.meso_id.nunique()} mesos, {mg.rgi_id.nunique()} imediatas, {mg.rgint_id.nunique()} intermediárias")
    # Micro/meso não podem atravessar fronteira estadual
    for k in ["micro", "meso", "rgi", "rgint"]:
        n = final.groupby(f"{k}_id")["uf"].nunique()
        assert (n == 1).all(), f"{k} com mais de uma UF: {n[n > 1].index.tolist()}"
    # Micro deve caber inteira numa meso
    assert (final.groupby("micro_id")["meso_id"].nunique() == 1).all(), "micro dividida entre mesos"
    assert (final.groupby("rgi_id")["rgint_id"].nunique() == 1).all(), "imediata dividida entre intermediárias"


if __name__ == "__main__":
    main()
