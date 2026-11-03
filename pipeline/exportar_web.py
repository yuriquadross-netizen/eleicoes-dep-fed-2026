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
from comum import CONFIG, PROCESSED, REGIOES, UF_REGIAO, WEB_PUBLIC, args_padrao, ufs_de  # noqa: E402

TIPOS = ["micro", "meso", "rgi", "rgint"]
SIT_COD = {"Eleito": "E", "Suplente": "S", "Não eleito": "N", "Outros": "O"}
TOP_N = 10
CLASSES = ["Direita", "Centro", "Esquerda"]


def ideologia(ano: int, mun: pd.DataFrame) -> pd.DataFrame:
    """Votos (nominais + legenda) por classe ideológica e município, a partir de
    config/partidos_ideologia.csv. Falha se algum partido com voto não tiver classe."""
    pm = pd.read_parquet(PROCESSED / f"partido_mun_{ano}.parquet")
    cls = pd.read_csv(CONFIG / "partidos_ideologia.csv")
    faltam = sorted(set(pm.partido) - set(cls.sigla))
    if faltam:
        raise SystemExit(f"Partidos sem classe em config/partidos_ideologia.csv: {faltam}")
    pm = pm.merge(cls[["sigla", "classe"]], left_on="partido", right_on="sigla")
    pm["v"] = pm.nominais + pm.legenda
    t = pm.pivot_table(index="cd_ibge", columns="classe", values="v", aggfunc="sum").reindex(columns=CLASSES)
    return t.fillna(0).reset_index().merge(mun, on="cd_ibge")


def fatias(df: pd.DataFrame, col: str, validos: pd.Series) -> dict[int, list[float]]:
    """{id: [direita, centro, esquerda]} como fração dos válidos do recorte."""
    s = df.groupby(col)[CLASSES].sum()
    return {int(i): [r4(r[c] / validos[i]) if validos.get(i) else 0.0 for c in CLASSES] for i, r in s.iterrows()}


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

    ideo = ideologia(a.ano, mun)
    ideo = ideo[ideo.uf.isin(ufs)]
    cls = pd.read_csv(CONFIG / "partidos_ideologia.csv")
    classe_partido = dict(zip(cls.sigla, cls.classe))
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
            "classe": classe_partido.get(c.partido),
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
    ufs_info = {}
    for uf in ufs:
        m = mun[mun.uf == uf]
        val = validos[validos.uf == uf]
        iu = ideo[ideo.uf == uf]
        regioes = {}
        ideo_nivel = {}
        for t in TIPOS:
            g = m.groupby(f"{t}_id").agg(nome=(f"{t}_nome", "first")).reset_index()
            vv = val.groupby(f"{t}_id").validos.sum()
            ideo_nivel[t] = fatias(iu, f"{t}_id", vv)
            lider = agg[t][agg[t].pos == 1].drop_duplicates("id").set_index("id")
            pai = {"micro": "meso_id", "rgi": "rgint_id"}.get(t)
            pais = m.groupby(f"{t}_id")[pai].first() if pai else None
            regioes[t] = {}
            for _, r in g.iterrows():
                rid = r[f"{t}_id"]
                item = {"nome": r.nome, "validos": int(vv.get(rid, 0)), "ideo": ideo_nivel[t].get(int(rid))}
                if pai:
                    item["pai"] = int(pais[rid])
                if rid in lider.index:
                    li = lider.loc[rid]
                    sq = int(li.sq_candidato)
                    item["lider"] = [sq, info_cand.at[sq, "nome_urna"], info_cand.at[sq, "partido"],
                                     int(li.votos), r4(li.pct_local)]
                regioes[t][int(rid)] = item
        ideo_nivel["mun"] = fatias(iu, "cd_ibge", val.set_index("cd_ibge").validos)
        ideo_uf = [r4(iu[c].sum() / val.validos.sum()) for c in CLASSES]
        vm = val.set_index("cd_ibge").validos
        municipios = {int(r.cd_ibge): [r.nome, int(r.micro_id), int(r.meso_id), int(r.rgi_id), int(r.rgint_id),
                                       int(vm.get(r.cd_ibge, 0))] for r in m.itertuples()}
        c_uf = cand[cand.uf == uf].sort_values("votos_total", ascending=False)
        eleitos = [[int(c.sq_candidato), c.nome_urna, c.partido, int(c.votos_total)]
                   for c in c_uf[c_uf.situacao == "Eleito"].itertuples()]
        bancada = c_uf[c_uf.situacao == "Eleito"].partido.value_counts().to_dict()
        ufs_info[uf] = {"eleitos": len(eleitos), "validos": int(val.validos.sum()), "ideo": ideo_uf}
        gravar(destino / "uf" / f"{uf}.json", {
            "uf": uf, "regiao": UF_REGIAO[uf], "validos": int(val.validos.sum()), "ideo": ideo_uf,
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
                       {"tipo": t, "id": int(rid), "uf": uf, "validos": int(g.validos.iloc[0]),
                        "ideo": ideo_nivel[t].get(int(rid)), "top": top})

    disponiveis = sorted(p.stem for p in (destino / "uf").glob("*.json"))
    gravar(destino / "meta.json", {
        "ano": a.ano, "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ufs": disponiveis, "regioes": {k: {"nome": n, "ufs": u} for k, (n, u) in REGIOES.items()},
        "ufs_info": ufs_info, "classes": CLASSES,
        "ideologia": "Votos nominais + legenda dos partidos de cada classe ÷ votos válidos. "
                     "Classificação: Aliança (config/partidos_ideologia.csv).",
        "fonte": "TSE — dados abertos (votação nominal por município e zona), 1º turno",
    })
    tam = sum(f.stat().st_size for f in destino.rglob("*.json")) / 1e6
    print(f"OK {a.ano}: {len(cand)} perfis, UFs {', '.join(ufs) if len(ufs) < 27 else 'todas'}; {tam:.1f} MB")


if __name__ == "__main__":
    main()
