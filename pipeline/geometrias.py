"""Passo 2.1 — geometrias por UF para os mapas do app.

Para cada UF: pega os polígonos municipais (geobr 2024), anexa os recortes de
data/processed/municipios.parquet e usa o mapshaper para simplificar e dissolver
em micro, meso, rgi e rgint. Assim mapa e números usam o mesmo mapeamento (D7).

Saída: web/public/geo/{UF}.json (TopoJSON com 5 camadas: mun, micro, meso, rgi, rgint).
Requer: cd pipeline/node && npm install   (instala o mapshaper fixado no package.json)
Uso: python pipeline/geometrias.py [--uf MG]
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import geopandas as gpd
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from comum import PROCESSED, RAW_GEO, WEB_PUBLIC, args_padrao, ufs_de  # noqa: E402

MAPSHAPER = Path(__file__).parent / "node" / "node_modules" / ".bin" / "mapshaper"
SIMPLIFICACAO = "12%"  # fração de vértices mantida (sobre a malha já simplificada do geobr)
CAMADAS = ["micro", "meso", "rgi", "rgint"]


def main() -> None:
    a = args_padrao(__doc__)
    if not MAPSHAPER.exists():
        raise SystemExit("mapshaper não instalado: cd pipeline/node && npm install")
    mun = pd.read_parquet(PROCESSED / "municipios.parquet")
    geo = gpd.read_parquet(RAW_GEO / "municipalities_2024_simplified.parquet")
    geo["cd_ibge"] = geo["code_muni"].astype("int64")
    geo = geo.merge(mun[["cd_ibge", "uf"] + [f"{c}_id" for c in CAMADAS]], on="cd_ibge")
    destino = WEB_PUBLIC / "geo"
    destino.mkdir(parents=True, exist_ok=True)

    for uf in ufs_de(a.uf):
        g = geo[geo.uf == uf][["cd_ibge"] + [f"{c}_id" for c in CAMADAS] + ["geometry"]].to_crs(4326)
        with tempfile.TemporaryDirectory() as tmp:
            entrada = Path(tmp) / "mun.json"
            entrada.write_text(g.to_json(), encoding="utf-8")
            saida = destino / f"{uf}.json"
            cmd = [str(MAPSHAPER), "-i", str(entrada), "name=mun",
                   "-simplify", SIMPLIFICACAO, "keep-shapes", "-clean"]
            for c in CAMADAS:
                cmd += ["-dissolve", f"{c}_id", "+", f"name={c}", "-target", "mun"]
            cmd += ["-o", "format=topojson", "quantization=100000", "target=*", str(saida)]
            subprocess.run(cmd, check=True, capture_output=True)
        topo = json.loads(saida.read_text())
        n = {k: len(v["geometries"]) for k, v in topo["objects"].items()}
        esperado = {"mun": len(g), **{c: g[f"{c}_id"].nunique() for c in CAMADAS}}
        assert n == esperado, f"{uf}: feições {n} ≠ esperado {esperado}"
        print(f"  {uf}: {n} — {saida.stat().st_size / 1e3:.0f} KB")


if __name__ == "__main__":
    main()
