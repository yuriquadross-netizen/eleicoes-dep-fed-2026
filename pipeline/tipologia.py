"""Tipologia da base eleitoral (Barry Ames, AJPS 1995; Os entraves da democracia no Brasil, 2001).

Duas dimensões, calculadas por candidato com os municípios da sua UF:

- Concentração: índice G = ½ Σ |v_m/V − T_m/T|, distância entre a distribuição dos votos do
  candidato e a do eleitorado da UF (0 = vota como o estado inteiro; 1 = tudo num lugar só).
  Ames usou o I de Moran nesta dimensão, mas o Moran sozinho classifica como "concentrado"
  quem tem votos no estado inteiro com intensidade regional (ex.: Nikolas Ferreira, MG 2026,
  votos nos 853 municípios, Moran 0,57). Por isso a concentração usa o G, e o Moran fica como
  descritor de contiguidade (a área forte é contínua ou em retalhos).
- Contiguidade: I de Moran da fatia do candidato nos votos válidos de cada município
  (x_m = v_m / T_m), vizinhança por fronteira comum (contiguidade "queen", pesos normalizados
  por linha), significância por permutação (999 sorteios).
- Dominância (Ames): média da fatia dele nos municípios, ponderada pelo peso de cada município
  na votação dele: D = Σ (v_m / V) · (v_m / T_m). Alta = onde tem voto, ele é "o" deputado.

Classificação relativa à UF (comparar MG, 853 municípios, com RR, 15, em termos absolutos distorce):
  concentrada  ⇔ G ≥ mediana dos eleitos da UF
  dominante    ⇔ dominância ≥ mediana dos eleitos da UF
DF (um município) não tem tipologia; UFs com menos de 30 municípios ficam com confiabilidade "baixa".

Saída: data/processed/tipologia_{ANO}.parquet
Uso: python pipeline/tipologia.py --ano 2026 [--uf MG]
"""
from __future__ import annotations

import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from scipy import sparse

sys.path.insert(0, str(Path(__file__).parent))
from comum import PROCESSED, RAW_GEO, args_padrao, ufs_de  # noqa: E402

PERMUTACOES = 999
SEMENTE = 2026
MIN_MUNICIPIOS_OK = 30
TIPOS = {
    (True, True): "concentrada-dominante",
    (True, False): "concentrada-compartilhada",
    (False, True): "dispersa-dominante",
    (False, False): "dispersa-compartilhada",
}


def vizinhanca(geo: gpd.GeoDataFrame, codigos: list[int]) -> sparse.csr_matrix:
    """Matriz de pesos (n×n) normalizada por linha: 1/k para cada um dos k vizinhos."""
    g = geo.set_index("cd_ibge").loc[codigos].reset_index().to_crs(5880)
    b = g[["cd_ibge", "geometry"]].copy()
    b["geometry"] = g.buffer(200)  # 200 m fecham as frestas da malha simplificada
    j = gpd.sjoin(b, b, predicate="intersects")
    j = j[j.cd_ibge_left != j.cd_ibge_right]
    pos = {c: i for i, c in enumerate(codigos)}
    lin = j.cd_ibge_left.map(pos).to_numpy()
    col = j.cd_ibge_right.map(pos).to_numpy()
    w = sparse.csr_matrix((np.ones(len(lin)), (lin, col)), shape=(len(codigos),) * 2)
    grau = np.asarray(w.sum(axis=1)).ravel()
    inv = np.divide(1.0, grau, out=np.zeros_like(grau), where=grau > 0)  # ilha: linha zerada
    return sparse.diags(inv) @ w


def moran(x: np.ndarray, w: sparse.csr_matrix) -> np.ndarray:
    """I de Moran de cada linha de x (candidatos × municípios)."""
    n = x.shape[1]
    s0 = w.sum()
    z = x - x.mean(axis=1, keepdims=True)
    num = np.einsum("ij,ij->i", z, (w @ z.T).T)
    den = np.einsum("ij,ij->i", z, z)
    return np.divide(n / s0 * num, den, out=np.zeros(len(x)), where=den > 0)


def main() -> None:
    a = args_padrao(__doc__)
    mun = pd.read_parquet(PROCESSED / "municipios.parquet")
    votos = pd.read_parquet(PROCESSED / f"votos_cand_mun_{a.ano}.parquet")
    validos = pd.read_parquet(PROCESSED / f"validos_mun_{a.ano}.parquet")
    cand = pd.read_parquet(PROCESSED / f"candidatos_{a.ano}.parquet")
    cand = cand[cand.votos_total > 0]
    geo = gpd.read_parquet(RAW_GEO / "municipalities_2024_simplified.parquet")
    geo["cd_ibge"] = geo["code_muni"].astype("int64")
    rng = np.random.default_rng(SEMENTE)
    saida = []

    for uf in ufs_de(a.uf):
        codigos = sorted(mun[mun.uf == uf].cd_ibge)
        c_uf = cand[cand.uf == uf]
        if len(codigos) < 2:
            print(f"  {uf}: um município só, sem tipologia")
            continue
        pos = {c: i for i, c in enumerate(codigos)}
        tot = validos.set_index("cd_ibge").validos.reindex(codigos).fillna(0).to_numpy(float)
        sqs = c_uf.sq_candidato.to_numpy()
        lin = {s: i for i, s in enumerate(sqs)}
        v = votos[votos.sq_candidato.isin(lin) & votos.cd_ibge.isin(pos)]
        mat = np.zeros((len(sqs), len(codigos)))
        mat[v.sq_candidato.map(lin).to_numpy(), v.cd_ibge.map(pos).to_numpy()] = v.votos.to_numpy()
        x = np.divide(mat, tot, out=np.zeros_like(mat), where=tot > 0)  # fatia no município

        w = vizinhanca(geo, codigos)
        i_obs = moran(x, w)
        maiores = np.zeros(len(sqs))
        for _ in range(PERMUTACOES):
            maiores += moran(x[:, rng.permutation(len(codigos))], w) >= i_obs
        p = (maiores + 1) / (PERMUTACOES + 1)
        vtot = mat.sum(axis=1)
        dom = np.divide((mat * x).sum(axis=1), vtot, out=np.zeros(len(sqs)), where=vtot > 0)
        dist_votos = np.divide(mat, vtot[:, None], out=np.zeros_like(mat), where=vtot[:, None] > 0)
        g = 0.5 * np.abs(dist_votos - tot / tot.sum()).sum(axis=1)

        df = pd.DataFrame({"sq_candidato": sqs, "uf": uf, "n_mun": len(codigos),
                           "concentracao": g, "moran": i_obs, "p_moran": p, "dominancia": dom})
        eleitos = df[c_uf.situacao.to_numpy() == "Eleito"]
        med_g, med_d = eleitos.concentracao.median(), eleitos.dominancia.median()
        df["concentrada"] = df.concentracao >= med_g
        df["dominante"] = df.dominancia >= med_d
        df["tipo"] = [TIPOS[(c, d)] for c, d in zip(df.concentrada, df.dominante)]
        # percentil entre os eleitos da UF (0–1): fração dos eleitos com valor menor ou igual
        eg, ed = np.sort(eleitos.concentracao.to_numpy()), np.sort(eleitos.dominancia.to_numpy())
        df["pct_concentracao"] = np.searchsorted(eg, df.concentracao, side="right") / len(eg)
        df["pct_dominancia"] = np.searchsorted(ed, df.dominancia, side="right") / len(ed)
        df["mediana_concentracao_uf"], df["mediana_dominancia_uf"] = med_g, med_d
        df["contigua"] = df.p_moran < 0.05
        df["confiabilidade"] = "ok" if len(codigos) >= MIN_MUNICIPIOS_OK else "baixa"
        saida.append(df)
        q = df[c_uf.situacao.to_numpy() == "Eleito"].tipo.value_counts().to_dict()
        print(f"  {uf}: {len(df)} candidatos; eleitos por tipo {q}")

    out = pd.concat(saida, ignore_index=True)
    caminho = PROCESSED / f"tipologia_{a.ano}.parquet"
    if caminho.exists() and a.uf.upper() != "BR":
        antigo = pd.read_parquet(caminho)
        out = pd.concat([antigo[~antigo.uf.isin(out.uf.unique())], out], ignore_index=True)
    out.to_parquet(caminho, index=False)
    print(f"OK {a.ano}: tipologia de {len(out)} candidatos em {out.uf.nunique()} UFs")


if __name__ == "__main__":
    main()
