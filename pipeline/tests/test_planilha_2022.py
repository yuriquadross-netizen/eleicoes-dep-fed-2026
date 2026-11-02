"""Valida o pipeline contra o mapeamento 2022 da Aliança (MG, 66 micros × top 10).

Requer: python pipeline/municipios.py && python pipeline/tabelas.py --ano 2022 --uf MG
"""
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from comum import PROCESSED, normalizar  # noqa: E402

FIXTURE = Path(__file__).parent / "fixtures" / "planilha_alianca_2022_mg.csv"
SIT = {"Eleito": "Eleito", "Suplente": "Suplente", "Não Eleito": "Não eleito"}

# Erros conhecidos da planilha: a soma de válidos omitiu um município em duas micros.
# O pipeline está certo; o teste exige que a diferença seja exatamente o município omitido.
ERRATA_VALIDOS = {"cataguases": ("Dona Euzébia", 4436), "ponte nova": ("Sem-Peixe", 2535)}


@pytest.fixture(scope="module")
def calculado():
    if not (PROCESSED / "votos_cand_mun_2022.parquet").exists():
        pytest.skip("rode tabelas.py --ano 2022 --uf MG antes")
    mun = pd.read_parquet(PROCESSED / "municipios.parquet")
    mun = mun[mun.uf == "MG"]
    votos = pd.read_parquet(PROCESSED / "votos_cand_mun_2022.parquet").merge(mun, on="cd_ibge")
    validos = pd.read_parquet(PROCESSED / "validos_mun_2022.parquet").merge(mun, on="cd_ibge")
    cand = pd.read_parquet(PROCESSED / "candidatos_2022.parquet")
    cand = cand[cand.uf == "MG"]

    vm = votos.groupby(["micro_nome", "sq_candidato"], as_index=False).votos.sum()
    val = validos.groupby("micro_nome", as_index=False).validos.sum()
    vm = vm.merge(val, on="micro_nome").merge(cand[["sq_candidato", "nome", "partido", "situacao", "votos_total"]],
                                              on="sq_candidato")
    vm["part_dep_regiao"] = vm.votos / vm.validos
    vm["part_regiao_dep"] = vm.votos / vm.votos_total
    vm = vm.sort_values(["micro_nome", "votos", "nome"], ascending=[True, False, True])
    vm["posicao"] = vm.groupby("micro_nome").cumcount() + 1
    vm["k"] = vm.micro_nome.map(normalizar)
    return vm[vm.posicao <= 10]


@pytest.fixture(scope="module")
def planilha():
    f = pd.read_csv(FIXTURE)
    f["k"] = f.microrregiao.map(normalizar)
    return f


def test_votos_validos_por_micro(calculado, planilha):
    a = planilha.groupby("k").votos_validos_micro.first()
    b = calculado.groupby("k").validos.first()
    diff = b.reindex(a.index) - a
    for k, (_, faltou) in ERRATA_VALIDOS.items():
        assert diff[k] == faltou, f"{k}: esperado +{faltou}, veio {diff[k]}"
        diff[k] = 0
    assert diff.abs().max() == 0, f"válidos divergentes:\n{diff[diff != 0]}"


def test_top10_identico(calculado, planilha):
    m = planilha.merge(calculado, on=["k", "posicao"], suffixes=("_p", "_c"))
    assert len(m) == len(planilha) == 660
    ruins = m[(m.votos_p != m.votos_c) | (m.candidato != m.nome)]
    assert ruins.empty, ruins[["microrregiao", "posicao", "candidato", "nome", "votos_p", "votos_c"]].to_string()


def test_metricas(calculado, planilha):
    m = planilha.merge(calculado, on=["k", "posicao"], suffixes=("_p", "_c"))
    ok = m[~m.k.isin(ERRATA_VALIDOS)]  # nas micros com erro, o denominador da planilha está errado
    assert (ok.part_dep_regiao_p - ok.part_dep_regiao_c).abs().max() < 1e-4
    assert (m.part_regiao_dep_p - m.part_regiao_dep_c).abs().max() < 1e-4
    assert (m.situacao_p.map(SIT) == m.situacao_c).all()


def test_sentinelas(calculado):
    nik = calculado[calculado.nome == "NIKOLAS FERREIRA DE OLIVEIRA"]
    assert nik.votos_total.iloc[0] == 1_492_047
    assert nik[nik.micro_nome == "Barbacena"].votos.iloc[0] == 13_576
