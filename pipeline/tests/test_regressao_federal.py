"""Não-regressão dos deputados federais (Fase 2): tabelas e JSON de amostra iguais ao retrato salvo.

Requer os dados processados e a exportação federal (python pipeline/exportar_web.py --ano 2026).
Se uma mudança nos federais for intencional, regrave o retrato: python pipeline/retrato_federal.py --gravar
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import retrato_federal as rf  # noqa: E402


def test_federais_intactos():
    if not rf.RETRATO.exists() or not (rf.DADOS / "meta.json").exists():
        pytest.skip("sem retrato salvo ou sem exportação federal")
    assert rf.diferencas() == []
