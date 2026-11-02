"""Trava a classificação ideológica de 2022 reconstruída a partir da planilha da Aliança.

A planilha calculava: Direita % = Σ votos NOMINAIS (sem legenda) dos partidos da classe
/ votos válidos da micro (com o denominador da própria planilha). Com a tabela
config/partidos_ideologia_2022_alianca.csv, o resultado bate nas 66 micros.
"""
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from comum import CONFIG, PROCESSED, normalizar  # noqa: E402

FIXTURE = Path(__file__).parent / "fixtures" / "planilha_alianca_2022_mg.csv"


def test_reconstrucao_bate_com_planilha():
    if not (PROCESSED / "partido_mun_2022.parquet").exists():
        pytest.skip("rode tabelas.py --ano 2022 --uf MG antes")
    mun = pd.read_parquet(PROCESSED / "municipios.parquet")
    pm = pd.read_parquet(PROCESSED / "partido_mun_2022.parquet").merge(mun[mun.uf == "MG"], on="cd_ibge")
    cls = pd.read_csv(CONFIG / "partidos_ideologia_2022_alianca.csv")
    pm = pm.merge(cls, left_on="partido", right_on="sigla", how="left")
    soma = pm.pivot_table(index="micro_nome", columns="classe", values="nominais", aggfunc="sum").fillna(0)
    soma.index = soma.index.map(normalizar)
    f = pd.read_csv(FIXTURE).groupby("microrregiao")[["votos_validos_micro", "direita_pct", "centro_pct"]].first()
    f.index = f.index.map(normalizar)
    d = soma["Direita"].reindex(f.index) / f.votos_validos_micro
    c = soma["Centro"].reindex(f.index) / f.votos_validos_micro
    assert (d - f.direita_pct).abs().max() < 1e-5
    assert (c - f.centro_pct).abs().max() < 1e-5
