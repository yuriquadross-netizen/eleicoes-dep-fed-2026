"""Caminhos, constantes e utilidades compartilhadas pelo pipeline."""
from __future__ import annotations

import argparse
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
RAW = RAIZ / "data" / "raw"
RAW_TSE = RAW / "tse"
RAW_GEO = RAW / "geobr"
INTERIM = RAIZ / "data" / "interim"
PROCESSED = RAIZ / "data" / "processed"
CONFIG = RAIZ / "config"
WEB_PUBLIC = RAIZ / "web" / "public"

TSE_BASE = "https://cdn.tse.jus.br/estatistica/sead/odsele"
TSE_CONJUNTOS = ["votacao_candidato_munzona", "detalhe_votacao_munzona", "votacao_partido_munzona"]

GEOBR_BASE = "https://github.com/ipea/geobr_prep_data/releases/download/v2.0.0"
GEOBR_ARQUIVOS = [
    "municipalities_2024_simplified.parquet",
    "microregions_2020_simplified.parquet",
    "mesoregions_2020_simplified.parquet",
    "immediateregions_2019_simplified.parquet",
    "intermediateregions_2019_simplified.parquet",
]
CROSSWALK_URL = (
    "https://raw.githubusercontent.com/betafcc/Municipios-Brasileiros-TSE/master/"
    "municipios_brasileiros_tse.csv"
)

CARGO_DEP_FEDERAL = 6
# Fase 2: cargo como parâmetro. Federal mantém os nomes de arquivo atuais (sufixo vazio).
CARGOS = {"federal": [6], "estadual": [7, 8]}  # 8 = Deputado Distrital (DF)


def sufixo(cargo: str) -> str:
    """Sufixo dos arquivos em data/processed/: "" para federal, "_estadual" para estadual."""
    return "" if cargo == "federal" else f"_{cargo}"


def pasta_web(ano: int, cargo: str) -> str:
    """Pasta dos JSON em web/public/data/: "2026" (federal) ou "2026e" (estadual)."""
    return str(ano) if cargo == "federal" else f"{ano}e"

UFS = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
    "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
]

REGIOES = {
    "N": ("Norte", ["AC", "AM", "AP", "PA", "RO", "RR", "TO"]),
    "NE": ("Nordeste", ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"]),
    "CO": ("Centro-Oeste", ["DF", "GO", "MS", "MT"]),
    "SE": ("Sudeste", ["ES", "MG", "RJ", "SP"]),
    "S": ("Sul", ["PR", "RS", "SC"]),
}
UF_REGIAO = {uf: sigla for sigla, (_, ufs) in REGIOES.items() for uf in ufs}


def normalizar(txt: str) -> str:
    """Minúsculas, sem acento, sem pontuação extra — para casar nomes."""
    t = unicodedata.normalize("NFKD", str(txt)).encode("ascii", "ignore").decode()
    t = t.lower().replace("'", "").replace("-", " ")
    return " ".join(t.split())


def args_padrao(descricao: str) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=descricao)
    p.add_argument("--ano", type=int, default=2026, choices=[2022, 2026])
    p.add_argument("--uf", default="BR", help="Sigla da UF ou BR para todas")
    p.add_argument("--cargo", default="federal", choices=list(CARGOS))
    return p.parse_args()


def ufs_de(arg: str) -> list[str]:
    arg = arg.upper()
    if arg == "BR":
        return UFS
    ufs = [u.strip() for u in arg.split(",")]
    for u in ufs:
        if u not in UFS:
            raise SystemExit(f"UF inválida: {u}")
    return ufs
