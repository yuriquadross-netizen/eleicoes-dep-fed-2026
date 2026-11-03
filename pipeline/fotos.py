"""Passo 6.2 — fotos dos eleitos (divulgação do TSE), reduzidas para o app.

Baixa foto_cand{ANO}_{UF}_div.zip do TSE, extrai só os eleitos e grava
web/public/fotos/{sq}.webp (160 px de largura). As fotos são versionadas no
repositório (~4 MB), porque a publicação no GitHub não baixa nada do TSE.

Uso: python pipeline/fotos.py --ano 2026 [--uf MG]
"""
from __future__ import annotations

import io
import sys
import zipfile
from pathlib import Path

import pandas as pd
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from baixar import baixar  # noqa: E402
from comum import PROCESSED, RAW, WEB_PUBLIC, args_padrao, ufs_de  # noqa: E402

LARGURA = 160
URL = "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes{ano}/fotos/foto_cand{ano}_{uf}_div.zip"


def main() -> None:
    a = args_padrao(__doc__)
    cand = pd.read_parquet(PROCESSED / f"candidatos_{a.ano}.parquet")
    eleitos = cand[cand.situacao == "Eleito"]
    destino = WEB_PUBLIC / "fotos"
    destino.mkdir(parents=True, exist_ok=True)
    faltam = []
    for uf in ufs_de(a.uf):
        zp = RAW / "fotos" / f"foto_cand{a.ano}_{uf}_div.zip"
        baixar(URL.format(ano=a.ano, uf=uf), zp, forcar=False)
        with zipfile.ZipFile(zp) as z:
            nomes = set(z.namelist())
            n = 0
            for sq in eleitos[eleitos.uf == uf].sq_candidato:
                arq = f"F{uf}{sq}_div.jpg"
                if arq not in nomes:
                    faltam.append((uf, sq))
                    continue
                img = Image.open(io.BytesIO(z.read(arq))).convert("RGB")
                alt = round(img.height * LARGURA / img.width)
                img.resize((LARGURA, alt), Image.LANCZOS).save(destino / f"{sq}.webp", "WEBP", quality=78, method=6)
                n += 1
        print(f"  {uf}: {n} fotos")
    total = sum(f.stat().st_size for f in destino.glob("*.webp")) / 1e6
    print(f"OK: {len(list(destino.glob('*.webp')))} fotos, {total:.1f} MB; sem foto no TSE: {faltam or 'nenhum'}")


if __name__ == "__main__":
    main()
