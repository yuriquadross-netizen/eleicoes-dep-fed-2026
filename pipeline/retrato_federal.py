"""Passo 8.0 — retrato dos dados dos deputados federais, para provar que a Fase 2 não os altera.

Calcula hashes (sha256) das tabelas federais em data/processed/ e de uma amostra fixa de JSON
exportados em web/public/data/2026/ (perfis, UFs, regiões, índice de busca, meta sem a data
de geração). `--gravar` salva o retrato; sem ele, compara com o salvo e lista as diferenças.

Uso:
  python pipeline/retrato_federal.py --gravar   # antes de mexer
  python pipeline/retrato_federal.py            # depois de cada passo (o teste faz o mesmo)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comum import PROCESSED, WEB_PUBLIC  # noqa: E402

RETRATO = Path(__file__).parent / "tests" / "fixtures" / "retrato_federal.json"
TABELAS = ["municipios", "votos_cand_mun_2026", "validos_mun_2026", "candidatos_2026",
           "partido_mun_2026", "tipologia_2026", "votos_cand_mun_2022", "candidatos_2022"]
DADOS = WEB_PUBLIC / "data" / "2026"
# amostra fixa: 5 grupos de perfis (inclui os de Nikolas Ferreira e Ana Elisa), 5 UFs, 10 arquivos de regiões
JSONS = [
    "busca.json", "meta.json",
    *[f"candidato/{g}.json" for g in (0, 17, 99, 130002542026 % 256, 130002535301 % 256)],
    *[f"uf/{uf}.json" for uf in ("MG", "SP", "DF", "RR", "BA")],
    *[f"regiao/{t}/{c}.json" for t, c in [("micro", 31), ("meso", 31), ("rgi", 31), ("rgint", 31), ("mun", 31),
                                          ("micro", 35), ("meso", 29), ("mun", 53), ("rgi", 43), ("micro", 14)]],
]


def _hash_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def retrato() -> dict[str, str]:
    r = {}
    for t in TABELAS:
        f = PROCESSED / f"{t}.parquet"
        r[f"processed/{t}.parquet"] = _hash_bytes(f.read_bytes()) if f.exists() else "AUSENTE"
    for j in JSONS:
        f = DADOS / j
        if not f.exists():
            r[f"data/2026/{j}"] = "AUSENTE"
            continue
        obj = json.loads(f.read_text(encoding="utf-8"))
        if j == "meta.json":
            obj.pop("gerado_em", None)  # muda a cada exportação
        r[f"data/2026/{j}"] = _hash_bytes(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode())
    return r


def diferencas() -> list[str]:
    salvo = json.loads(RETRATO.read_text())
    atual = retrato()
    return [k for k in sorted(set(salvo) | set(atual)) if salvo.get(k) != atual.get(k)]


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--gravar", action="store_true")
    a = p.parse_args()
    if a.gravar:
        RETRATO.write_text(json.dumps(retrato(), indent=1, sort_keys=True) + "\n")
        print(f"retrato gravado: {RETRATO}")
        return
    d = diferencas()
    print("federais intactos" if not d else "DIFERENÇAS:\n  " + "\n  ".join(d))
    raise SystemExit(1 if d else 0)


if __name__ == "__main__":
    main()
