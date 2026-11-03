"""Passos 1.4 / 3.1 — exporta os JSON estáticos que o app lê.

Saídas em web/public/data/{ANO}/:
  meta.json                      ano, data de geração, UFs disponíveis, totais
  busca.json                     índice de busca: uma linha (array) por candidato com voto
  uf/{UF}.json                   nomes e hierarquia de municípios e regiões da UF + válidos + eleitos
  candidato/{sq % 256}.json      {sq: perfil}: totais e, por recorte (micro, meso, rgi, rgint, mun),
                                 [id, votos, válidos, % do local, % da base, posição no local]
  regiao/{tipo}/{cod_uf}.json    {id: top 10} de cada micro/meso/rgi/rgint/município da UF

Os perfis e os tops são agrupados em poucos arquivos (≈450 no total, em vez de ≈16 mil):
o GitHub Pages passou do tempo-limite ao publicar um arquivo por candidato/região.
O código IBGE de qualquer recorte começa pelos 2 dígitos da UF (cod_uf).

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
GRUPOS_CANDIDATO = 256  # o front usa o mesmo número (web/src/dados.ts)
CLASSES = ["Direita", "Centro", "Esquerda"]


def posicoes_proprias(ano: int, cand: pd.DataFrame) -> pd.DataFrame:
    """Parlamentares marcados com campo diferente do partido (config/candidatos_ideologia.csv).

    Colunas: ano, sq_candidato, nome_urna, uf, partido, classe, observacao. Só sq_candidato e
    classe são usados; nome, UF e partido servem para leitura humana e são conferidos."""
    pp = pd.read_csv(CONFIG / "candidatos_ideologia.csv", dtype={"sq_candidato": "int64"})
    pp = pp[pp.ano == ano]
    invalidas = sorted(set(pp.classe) - set(CLASSES))
    if invalidas:
        raise SystemExit(f"Classe inválida em config/candidatos_ideologia.csv: {invalidas} (use {CLASSES})")
    conf = pp.merge(cand[["sq_candidato", "nome_urna", "uf", "partido"]], on="sq_candidato",
                    how="left", suffixes=("", "_tse"))
    sem = conf[conf.nome_urna_tse.isna()]
    if len(sem):
        raise SystemExit(f"Candidatos não encontrados em {ano}:\n{sem[['sq_candidato', 'nome_urna']]}")
    for r in conf.itertuples():
        if (r.nome_urna, r.uf, r.partido) != (r.nome_urna_tse, r.uf_tse, r.partido_tse):
            print(f"  aviso: {r.sq_candidato} no CSV é '{r.nome_urna} {r.partido}-{r.uf}', "
                  f"no TSE é '{r.nome_urna_tse} {r.partido_tse}-{r.uf_tse}'")
    return pp[["sq_candidato", "classe", "observacao"]]


def ideologia(ano: int, mun: pd.DataFrame, proprias: pd.DataFrame, cand: pd.DataFrame) -> pd.DataFrame:
    """Votos (nominais + legenda) por classe ideológica e município, a partir de
    config/partidos_ideologia.csv. Falha se algum partido com voto não tiver classe.

    Parlamentar com posicionamento próprio: seus votos nominais saem do campo do partido e
    vão para o campo dele; os votos de legenda continuam com o partido."""
    pm = pd.read_parquet(PROCESSED / f"partido_mun_{ano}.parquet")
    cls = pd.read_csv(CONFIG / "partidos_ideologia.csv")
    faltam = sorted(set(pm.partido) - set(cls.sigla))
    if faltam:
        raise SystemExit(f"Partidos sem classe em config/partidos_ideologia.csv: {faltam}")
    pm = pm.merge(cls[["sigla", "classe"]], left_on="partido", right_on="sigla")
    pm["v"] = pm.nominais + pm.legenda
    t = pm.pivot_table(index="cd_ibge", columns="classe", values="v", aggfunc="sum").reindex(columns=CLASSES).fillna(0)
    if len(proprias):
        classe_partido = dict(zip(cls.sigla, cls.classe))
    propria_classe = dict(zip(proprias.sq_candidato, proprias.classe))
    # observação (texto) ou "" quando marcado sem observação; ausente = segue o partido
    propria_obs = {sq: (o if isinstance(o, str) else "") for sq, o in zip(proprias.sq_candidato, proprias.observacao)}
    if len(proprias):
        print(f"  {len(proprias)} parlamentar(es) com posicionamento próprio")
        votos = pd.read_parquet(PROCESSED / f"votos_cand_mun_{ano}.parquet")
        partido = cand.set_index("sq_candidato").partido
        for r in proprias.itertuples():
            de = classe_partido[partido[r.sq_candidato]]
            if de == r.classe:
                continue
            v = votos[votos.sq_candidato == r.sq_candidato].set_index("cd_ibge").votos
            t.loc[v.index, de] -= v
            t.loc[v.index, r.classe] += v
        assert (t >= 0).all().all(), "voto negativo após mover posicionamentos próprios"
    return t.reset_index().merge(mun, on="cd_ibge")


def fatias(df: pd.DataFrame, col: str, validos: pd.Series) -> dict[int, list[float]]:
    """{id: [direita, centro, esquerda]} como fração dos válidos do recorte."""
    s = df.groupby(col)[CLASSES].sum()
    return {int(i): [r4(r[c] / validos[i]) if validos.get(i) else 0.0 for c in CLASSES] for i, r in s.iterrows()}


def gravar(caminho: Path, obj) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def gravar_grupo(caminho: Path, itens: dict) -> None:
    """Grava um arquivo-grupo {id: objeto}, mesclando com o que já existir (exportação parcial por UF)."""
    if caminho.exists():
        itens = {**json.loads(caminho.read_text(encoding="utf-8")), **itens}
    gravar(caminho, itens)


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

    proprias = posicoes_proprias(a.ano, cand)
    ideo = ideologia(a.ano, mun, proprias, cand)
    ideo = ideo[ideo.uf.isin(ufs)]
    cls = pd.read_csv(CONFIG / "partidos_ideologia.csv")
    classe_partido = dict(zip(cls.sigla, cls.classe))
    propria_classe = dict(zip(proprias.sq_candidato, proprias.classe))
    # observação (texto) ou "" quando marcado sem observação; ausente = segue o partido
    propria_obs = {sq: (o if isinstance(o, str) else "") for sq, o in zip(proprias.sq_candidato, proprias.observacao)}
    if len(proprias):
        print(f"  {len(proprias)} parlamentar(es) com posicionamento próprio")
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
    grupos: dict[int, dict] = {}
    for c in cand.itertuples():
        perfil = {
            "sq": int(c.sq_candidato), "nr": c.nr, "nome": c.nome, "urna": c.nome_urna,
            "partido": c.partido, "federacao": c.federacao if isinstance(c.federacao, str) else None, "uf": c.uf, "situacao": c.situacao,
            "situacao_tse": c.situacao_tse, "votos": int(c.votos_total), "pos_uf": int(c.pos_uf),
            "classe": propria_classe.get(c.sq_candidato, classe_partido.get(c.partido)),
            "classe_partido": classe_partido.get(c.partido),
            "posicao_propria": propria_obs.get(c.sq_candidato),
        }
        for n in niveis:
            df = por_cand[n].get(c.sq_candidato)
            if df is None:
                perfil[n] = []
                continue
            df = df.sort_values("votos", ascending=False)
            perfil[n] = [[int(r.id), int(r.votos), int(r.validos), r4(r.pct_local), r4(r.pct_base), int(r.pos)]
                         for r in df.itertuples()]
        grupos.setdefault(int(c.sq_candidato) % GRUPOS_CANDIDATO, {})[str(c.sq_candidato)] = perfil
    for g, itens in grupos.items():
        gravar_grupo(destino / "candidato" / f"{g}.json", itens)

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
        cod_uf = str(int(m.cd_ibge.iloc[0]))[:2]
        for t in TIPOS + ["mun"]:
            df = agg[t].merge(m[[niveis[t]]].drop_duplicates().rename(columns={niveis[t]: "id"}), on="id")
            tops = {}
            for rid, g in df.groupby("id"):
                g = g.sort_values(["votos"], ascending=False).head(TOP_N)
                top = [[int(r.sq_candidato), info_cand.at[r.sq_candidato, "nome_urna"],
                        info_cand.at[r.sq_candidato, "partido"], SIT_COD[info_cand.at[r.sq_candidato, "situacao"]],
                        int(r.votos), r4(r.pct_local), r4(r.pct_base)] for r in g.itertuples()]
                assert str(int(rid)).startswith(cod_uf), f"{t} {rid} não começa com {cod_uf}"
                tops[str(int(rid))] = {"tipo": t, "id": int(rid), "uf": uf, "validos": int(g.validos.iloc[0]),
                                       "ideo": ideo_nivel[t].get(int(rid)), "top": top}
            gravar(destino / "regiao" / t / f"{cod_uf}.json", tops)

    disponiveis = sorted(p.stem for p in (destino / "uf").glob("*.json"))
    gravar(destino / "meta.json", {
        "ano": a.ano, "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "ufs": disponiveis, "regioes": {k: {"nome": n, "ufs": u} for k, (n, u) in REGIOES.items()},
        "ufs_info": ufs_info, "classes": CLASSES,
        "ideologia": "Votos nominais + legenda dos partidos de cada classe ÷ votos válidos. "
                     "Classificação: Aliança (config/partidos_ideologia.csv).",
        "fonte": "TSE — dados abertos (votação nominal por município e zona), 1º turno",
    })
    # lista de tudo o que o botão "salvar para usar sem internet" precisa baixar
    publico = WEB_PUBLIC
    arquivos = sorted(
        str(f.relative_to(publico)) for pasta in [destino, publico / "geo", publico / "fotos"]
        if pasta.exists() for f in pasta.rglob("*") if f.is_file()
    )
    tamanho = sum((publico / f).stat().st_size for f in arquivos)
    gravar(destino / "arquivos.json", {"total_bytes": tamanho, "arquivos": arquivos})
    tam = sum(f.stat().st_size for f in destino.rglob("*.json")) / 1e6
    print(f"OK {a.ano}: {len(cand)} perfis, UFs {', '.join(ufs) if len(ufs) < 27 else 'todas'}; {tam:.1f} MB")


if __name__ == "__main__":
    main()
