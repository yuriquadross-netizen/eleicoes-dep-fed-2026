"""Passo 1.1 — baixa os dados brutos do TSE e as malhas do geobr (Ipea).

Uso: python pipeline/baixar.py --ano 2026
Idempotente: não baixa de novo o que já existe (use --forcar para baixar de novo).
"""
from __future__ import annotations

import argparse
import shutil
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from comum import (  # noqa: E402
    CROSSWALK_URL, GEOBR_ARQUIVOS, GEOBR_BASE, RAW, RAW_GEO, RAW_TSE, TSE_BASE, TSE_CONJUNTOS,
)


def baixar(url: str, destino: Path, forcar: bool) -> None:
    if destino.exists() and destino.stat().st_size > 0 and not forcar:
        print(f"  já existe  {destino.name}")
        return
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(destino.suffix + ".part")
    print(f"  baixando   {url}")
    for tentativa in range(1, 4):  # o CDN do TSE às vezes recusa (403/5xx) por instantes
        try:
            with urllib.request.urlopen(url, timeout=600) as r, open(tmp, "wb") as f:
                shutil.copyfileobj(r, f, length=1 << 20)
            break
        except (urllib.error.URLError, TimeoutError) as e:
            if tentativa == 3:
                raise
            print(f"  falhou ({e}); nova tentativa em {5 * tentativa}s")
            time.sleep(5 * tentativa)
    tmp.rename(destino)
    print(f"  ok         {destino.name} ({destino.stat().st_size / 1e6:.1f} MB)")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ano", type=int, default=2026, choices=[2022, 2026])
    p.add_argument("--forcar", action="store_true")
    a = p.parse_args()

    print(f"TSE {a.ano}")
    for c in TSE_CONJUNTOS:
        baixar(f"{TSE_BASE}/{c}/{c}_{a.ano}.zip", RAW_TSE / f"{c}_{a.ano}.zip", a.forcar)

    print("geobr (Ipea)")
    for arq in GEOBR_ARQUIVOS:
        baixar(f"{GEOBR_BASE}/{arq}", RAW_GEO / arq, a.forcar)

    print("Correspondência TSE ↔ IBGE")
    baixar(CROSSWALK_URL, RAW / "municipios_tse_ibge.csv", a.forcar)


if __name__ == "__main__":
    main()
