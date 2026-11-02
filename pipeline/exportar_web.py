"""Passos 1.4 / 3.1 — exporta os JSON estáticos que o app lê.

Saídas em web/public/data/{ANO}/:
  meta.json                      ano, data de geração, UFs disponíveis, totais
  busca.json                     índice de busca: uma linha (array) por candidato com voto
  uf/{UF}.json                   nomes e hierarquia de municípios e regiões da UF + válidos + eleitos
  candidato/{sq}.json            perfil: totais e, por recorte (micro, meso, rgi, rgint, mun),
                                 [id, votos, válidos, % do local, % da base, posição no local]
  regiao/{tipo}/{id}.json        top 10 de cada micro/meso/rgi/rgint (Etapa 3)

Todas as porcentagens são calculadas aqui; o front só exibe.
Uso: python pipeline/exportar_web.py --ano 2026 [--uf MG]
"""
from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from comum import PROCESSED, REGIOES, UF_REGIAO, WEB_PUBLIC, args_padrao, ufs_de  # noqa: E402

TIPOS = ["micro", "meso", "rgi", "rgint"]
SIT_COD = {"Eleito": "E", "Suplente": "S", "Não eleito": "N", "Outros": "O"}
TOP_N = 10


def gravar(caminho: Path, obj) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def r4(x: float) -> float:
    return round(float(x), 5)


def main() -> None:
    a = args_padrao(__doc__)
    ufs = ufs_de(a.uf)
    destino = WEB_PUBLIC / "data" / str(a.ano)
    if a.uf.upper() == "BR" and destino.exists():
        shutil.rmtree(destino)

    mun = pd.read_parquet(PROCESSED / "municipios.parquet")
    cand = pd.read_parquet(PROCESSED / f"candidatos_{a.ano}.parquet")
    votos = pd.read_parquet(PROCESSED / f"votos_cand_mun_{a.ano}.parquet")
    validos = pd.read_parquet(PROCESSED / f"validos_mun_{a.ano}.parquet")

    cand = cand[cand.uf.isin(ufs) & (cand.votos_total > 0)].copy()
    votos = votos[votos.votos > 0].merge(mun, on="cd_ibge")
    votos = votos[votos.uf.isin(ufs)]
    validos = validos.drop(columns="uf").merge(mun, on="cd_ibge")
    validos = validos[validos.uf.isin(ufs)]

    # posição do candidato na UF
    cand["pos_uf"] = cand.groupby("uf").votos_total.rank(method="min", ascending=False).astype(int)

    # agregados por recorte: votos do candidato, válidos do local, posição no local
    niveis = {"mun": "cd_ibge", **{t: f"{t}_id" for t in TIPOS}}
    agg = {}
    for nivel, col in niveis.items():
        v = votos.groupby([col, "sq_candidato"], as_index=False).votos.sum()
        val = validos.groupby(col, as_index=False).validos.sum()
        v = v.merge(val, on=col)
        v["pos"] = v.groupby(col).votos.rank(method="min", ascending=False).astype(int)
        v = v.merge(cand[["sq_candidato", "votos_total"]], on="sq_candidato")
        v["pct_local"] = v.votos / v.validos
        v["pct_base"] = v.votos / v.votos_total
        agg[nivel] = v.rename(columns={col: "id"})

    # ---- perfis de candidato
    por_cand = {n: dict(tuple(df.groupby("sq_candidato"))) for n, df in agg.items()}
    for c in cand.itertuples():
        perfil = {
            "sq": int(c.sq_candidato), "nr": c.nr, "nome": c.nome, "urna": c.nome_urna,
            "partido": c.partido, "federacao": c.federacao if isinstance(c.federacao, str) else None, "uf": c.uf, "situacao": c.situacao,
            "situacao_tse": c.situacao_tse, "votos": int(c.votos_total), "pos_uf": int(c.pos_uf),
        }
        for n in niveis:
            df = por_cand[n].get(c.sq_candidato)
            if df is None:
                perfil[n] = []
                continue
            df = df.sort_values("votos", ascending=False)
            perfil[n] = [[int(r.id), int(r.votos), int(r.validos), r4(r.pct_local), r4(r.pct_base), int(r.pos)]
                         for r in df.itertuples()]
        gravar(destino / "candidato" / f"{c.sq_candidato}.json", perfil)

    # ---- índice de busca
    busca = [[int(c.sq_candidato), c.nome_urna, c.nome, c.partido, c.uf, SIT_COD[c.situacao], int(c.votos_total)]
             for c in cand.sort_values("votos_total", ascending=False).itertuples()]
    gravar(destino / "busca.json", {"campos": ["sq", "urna", "nome", "partido", "uf", "sit", "votos"], "linhas": busca})

    # ---- arquivos de UF
    info_cand = cand.set_index("sq_candidato")
    for uf in ufs:
        m = mun[mun.uf == uf]
        val = validos[validos.uf == uf]
        regioes = {}
        for t in TIPOS:
            g = m.groupby(f"{t}_id").agg(nome=(f"{t}_nome", "first")).reset_index()
            vv = val.groupby(f"{t}_id").validos.sum()
            pai = {"micro": "meso_id", "rgi": "rgint_id"}.get(t)
            pais = m.groupby(f"{t}_id")[pai].first() if pai else None
            regioes[t] = {int(r[f"{t}_id"]): {"nome": r.nome, "validos": int(vv.get(r[f"{t}_id"], 0)),
                                              **({"pai": int(pais[r[f"{t}_id"]])} if pai else {})}
                          for _, r in g.iterrows()}
        vm = val.set_index("cd_ibge").validos
        municipios = {int(r.cd_ibge): [r.nome, int(r.micro_id), int(r.meso_id), int(r.rgi_id), int(r.rgint_id),
                                       int(vm.get(r.cd_ibge, 0))] for r in m.itertuples()}
        c_uf = cand[cand.uf == uf].sort_values("votos_total", ascending=False)
        eleitos = [[int(c.sq_candidato), c.nome_urna, c.partido, int(c.votos_total)]
                   for c in c_uf[c_uf.situacao == "Eleito"].itertuples()]
        bancada = c_uf[c_uf.situacao == "Eleito"].partido.value_counts().to_dict()
        gravar(destino / "uf" / f"{uf}.json", {
            "uf": uf, "regiao": UF_REGIAO[uf], "validos": int(val.validos.sum()),
            "municipios": municipios, "regioes": regioes, "eleitos": eleitos, "bancada": bancada,
            "n_candidatos": int(len(c_uf)),
        })

        # ---- top 10 por região (e por município)
        for t in TIPOS + ["mun"]:
            df = agg[t].merge(m[[niveis[t]]].drop_duplicates().rename(columns={niveis[t]: "id"}), on="id")
            for rid, g in df.groupby("id"):
                g = g.sort_values(["votos"], ascending=False).head(TOP_N)
                top = [[int(r.sq_candidato), info_cand.at[r.sq_candidato, "nome_urna"],
                        info_cand.at[r.sq_candidato, "partido"], SIT_COD[info_cand.at[r.sq_candidato, "situacao"]],
                        int(r.votos), r4(r.pct_local), r4(r.pct_base)] for r in g.itertuples()]
                gravar(destino / "regiao" / t / f"{rid}.json",
                       {"tipo": t, "id": int(rid), "uf": uf, "validos": int(g.validos.iloc[0]), "top": top})

    disponiveis = sorted(p.stem for p in (destino / "uf").glob("*.json"))
    gravar(destino / "meta.json", {
        "ano": a.ano, "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ufs": disponiveis, "regioes": {k: {"nome": n, "ufs": u} for k, (n, u) in REGIOES.items()},
        "fonte": "TSE — dados abertos (votação nominal por município e zona), 1º turno",
    })
    tam = sum(f.stat().st_size for f in destino.rglob("*.json")) / 1e6
    print(f"OK {a.ano}: {len(cand)} perfis, UFs {', '.join(ufs) if len(ufs) < 27 else 'todas'}; {tam:.1f} MB")


if __name__ == "__main__":
    main()
