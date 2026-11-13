"""Etapa 13 — composição do Senado em 2027 (81 cadeiras).

  54 cadeiras: eleitos em 2026 (mandato 2027–2035), do TSE.
  27 cadeiras: turma eleita em 2022 (mandato 2023–2031), com o OCUPANTE ATUAL segundo a API de
               dados abertos do Senado (titular ou suplente em exercício, desde quando e por quê).

Suplentes de cada chapa: consulta_cand do TSE (cargos 9 e 10), casados com o titular por UF + número.
Previsão: titular da turma de 2022 eleito para outro cargo em 2026 (cruzamento por CPF) fica marcado
como "suplente deve assumir em 2027". O CPF só é usado no cruzamento; não é gravado.

Saída: data/processed/senado_2027.parquet (versionado: o build não depende da API do Senado).
Uso: python pipeline/senado.py [--forcar]   (--forcar baixa de novo as respostas da API)
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
import zipfile
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from baixar import baixar  # noqa: E402
from comum import (  # noqa: E402
    CARGOS_SUPLENTE_SENADO, CONFIG, PROCESSED, RAW, RAW_TSE, SENADO_API, TSE_BASE, UFS, normalizar,
)

RAW_SENADO = RAW / "senado"
FIM_TURMA_2022 = "2031-01-31"
# siglas da API do Senado que diferem das do TSE (config/partidos_ideologia.csv usa as do TSE)
# partidos de 2022 extintos por fusão ou incorporação → sigla atual (para o partido do suplente de 2022)
SUCESSAO = {"PSC": "PODE", "PTB": "PRD", "PATRIOTA": "PRD", "PROS": "SOLIDARIEDADE", "PMN": "MOBILIZA",
            "PMB": "DEMOCRATA", "PTC": "AGIR"}
SIGLA_TSE = {"PODEMOS": "PODE", "PC DO B": "PCdoB", "PCDOB": "PCdoB", "UNIAO": "UNIÃO", "SD": "SOLIDARIEDADE"}


def api(caminho: str, forcar: bool) -> dict:
    """GET na API do Senado, com cópia em data/raw/senado/ (não versionada)."""
    destino = RAW_SENADO / (caminho.strip("/").replace("/", "_") + ".json")
    if destino.exists() and not forcar:
        return json.loads(destino.read_text())
    RAW_SENADO.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(f"{SENADO_API}/{caminho}.json", headers={"Accept": "application/json"})
    for tentativa in range(1, 4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                dados = json.loads(r.read())
            break
        except Exception as e:  # noqa: BLE001 — rede instável: tenta de novo
            if tentativa == 3:
                raise SystemExit(f"API do Senado indisponível ({e}). Ver PLAN.md, passo 13.4b.") from e
            time.sleep(3 * tentativa)
    destino.write_text(json.dumps(dados, ensure_ascii=False))
    return dados


def lista(x) -> list:
    """A API devolve objeto quando há um item só e lista quando há vários."""
    return x if isinstance(x, list) else [] if x is None else [x]


def consulta_cand(ano: int) -> pd.DataFrame:
    cols = ["SG_UF", "CD_CARGO", "DS_CARGO", "NR_TURNO", "SQ_CANDIDATO", "NR_CANDIDATO", "NM_CANDIDATO",
            "NM_URNA_CANDIDATO", "NR_CPF_CANDIDATO", "SG_PARTIDO", "DS_SITUACAO_CANDIDATURA", "DS_SIT_TOT_TURNO"]
    partes = []
    arq = RAW_TSE / f"consulta_cand_{ano}.zip"
    baixar(f"{TSE_BASE}/consulta_cand/consulta_cand_{ano}.zip", arq, forcar=False)
    with zipfile.ZipFile(arq) as z:
        for nome in z.namelist():
            if nome.endswith(".csv") and not nome.endswith("_BRASIL.csv"):
                with z.open(nome) as f:
                    partes.append(pd.read_csv(f, sep=";", encoding="latin-1", dtype=str, usecols=cols))
    df = pd.concat(partes, ignore_index=True)
    df["CD_CARGO"] = df.CD_CARGO.astype(int)
    df["SQ_CANDIDATO"] = df.SQ_CANDIDATO.astype("int64")
    return df


def suplentes_de(cc: pd.DataFrame) -> dict[tuple[str, str], dict[int, tuple[str, str, str]]]:
    """(uf, número da chapa) → {1: (nome, partido, cpf) do 1º suplente, 2: idem do 2º}. Só candidaturas aptas."""
    s = cc[cc.CD_CARGO.isin(CARGOS_SUPLENTE_SENADO) & (cc.NR_TURNO == "1")]
    s = s[~s.DS_SITUACAO_CANDIDATURA.isin(["INAPTO", "#NULO#"])]
    out: dict[tuple[str, str], dict[int, str]] = {}
    for r in s.itertuples():
        out.setdefault((r.SG_UF, r.NR_CANDIDATO), {})[CARGOS_SUPLENTE_SENADO[r.CD_CARGO]] = (
            r.NM_URNA_CANDIDATO, r.SG_PARTIDO, r.NR_CPF_CANDIDATO)
    return out


def eleitos(ano: int) -> pd.DataFrame:
    c = pd.read_parquet(PROCESSED / f"candidatos_{ano}_senado.parquet")
    return c[c.situacao == "Eleito"].copy()


def sigla(p: str | None) -> str | None:
    if not p:
        return None
    return SIGLA_TSE.get(normalizar(p).upper(), SIGLA_TSE.get(p.upper(), p.upper()))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--forcar", action="store_true")
    forcar = ap.parse_args().forcar

    cc22, cc26 = consulta_cand(2022), consulta_cand(2026)
    e22, e26 = eleitos(2022), eleitos(2026)
    assert len(e22) == 27 and e22.uf.nunique() == 27, "2022: esperado 1 eleito por UF"
    assert len(e26) == 54 and (e26.groupby("uf").size() == 2).all(), "2026: esperado 2 eleitos por UF"
    sup22, sup26 = suplentes_de(cc22), suplentes_de(cc26)

    # eleitos em 2026 para QUALQUER cargo, por CPF (para a previsão de vacância na turma de 2022)
    el26 = cc26[cc26.DS_SIT_TOT_TURNO.str.startswith("ELEITO", na=False)]
    cargo_2026 = {r.NR_CPF_CANDIDATO: (r.DS_CARGO.title(), r.SG_UF) for r in el26.itertuples()}
    cpf22 = dict(zip(cc22[cc22.CD_CARGO == 5].SQ_CANDIDATO, cc22[cc22.CD_CARGO == 5].NR_CPF_CANDIDATO))

    # ocupantes atuais das 27 cadeiras da turma de 2022 (API do Senado)
    atual = api("senador/lista/atual", forcar)["ListaParlamentarEmExercicio"]["Parlamentares"]["Parlamentar"]
    assert len(atual) == 81, f"API: esperado 81 senadores em exercício, veio {len(atual)}"
    por_uf: dict[str, dict] = {}
    for p in atual:
        m = p["Mandato"]
        if m["SegundaLegislaturaDoMandato"]["DataFim"] == FIM_TURMA_2022:
            assert m["UfParlamentar"] not in por_uf, f"duas cadeiras da turma de 2022 em {m['UfParlamentar']}"
            por_uf[m["UfParlamentar"]] = p
    assert sorted(por_uf) == sorted(UFS), "turma de 2022 incompleta na API"

    linhas = []
    for r in e22.itertuples():
        p = por_uf[r.uf]
        ident, m = p["IdentificacaoParlamentar"], p["Mandato"]
        part = m["DescricaoParticipacao"]
        desde = max(e["DataInicio"] for e in lista(m["Exercicios"]["Exercicio"]) if "DataFim" not in e)
        motivo = None
        if part != "Titular":
            # motivo da saída do titular: último exercício encerrado no mandato dele
            cod = m["Titular"]["CodigoParlamentar"]
            mand = api(f"senador/{cod}/mandatos", forcar)["MandatoParlamentar"]["Parlamentar"]["Mandatos"]["Mandato"]
            mand = [x for x in lista(mand) if x["SegundaLegislaturaDoMandato"]["DataFim"] == FIM_TURMA_2022]
            fins = [e for x in mand for e in lista(x["Exercicios"]["Exercicio"]) if "DataFim" in e]
            if fins:
                motivo = max(fins, key=lambda e: e["DataFim"]).get("DescricaoCausaAfastamento")
        s = sup22.get((r.uf, r.nr), {})
        ocupante = ident["NomeParlamentar"].upper() if part != "Titular" else r.nome_urna
        partido = sigla(ident.get("SiglaPartidoParlamentar")) or r.partido
        previsto = False
        dest = cargo_2026.get(cpf22.get(r.sq_candidato))
        if dest and part == "Titular":
            # titular eleito para outro cargo em 2026: a cadeira passa ao 1º suplente que não tenha,
            # ele próprio, sido eleito para outro cargo
            ordem = next((k for k in (1, 2) if k in s and s[k][2] not in cargo_2026), None)
            assert ordem, f"{r.uf}: sem suplente disponível para a cadeira de {r.nome_urna}"
            ocupante, partido = s[ordem][0], SUCESSAO.get(s[ordem][1], s[ordem][1])
            part, previsto, desde = f"{ordem}º Suplente", True, "2027-02-01"
            motivo = f"titular eleito {dest[0]} ({dest[1]}) em 2026"
        linhas.append({
            "turma": 2022, "uf": r.uf, "sq_titular": r.sq_candidato, "titular": r.nome_urna,
            "partido_eleicao": r.partido, "ocupante": ocupante, "partido": partido, "participacao": part,
            "previsto": previsto, "desde": desde, "motivo": motivo,
            "suplente1": s.get(1, (None,))[0], "suplente2": s.get(2, (None,))[0], "votos": r.votos_total,
            "cod_senado": int(ident["CodigoParlamentar"]),
        })
    for r in e26.itertuples():
        s = sup26.get((r.uf, r.nr), {})
        linhas.append({
            "turma": 2026, "uf": r.uf, "sq_titular": r.sq_candidato, "titular": r.nome_urna,
            "partido_eleicao": r.partido, "ocupante": r.nome_urna, "partido": r.partido,
            "participacao": "Titular", "previsto": False, "desde": "2027-02-01", "motivo": None,
            "suplente1": s.get(1, (None,))[0], "suplente2": s.get(2, (None,))[0], "votos": r.votos_total,
            "cod_senado": None,
        })
    df = pd.DataFrame(linhas).sort_values(["uf", "turma", "titular"]).reset_index(drop=True)
    df["cod_senado"] = df.cod_senado.astype("Int64")
    assert len(df) == 81 and (df.groupby("uf").size() == 3).all()
    df.to_parquet(PROCESSED / "senado_2027.parquet", index=False)

    em_ex = df[(df.participacao != "Titular") & ~df.previsto]
    print(f"OK: 81 cadeiras ({(df.turma == 2026).sum()} de 2026, {(df.turma == 2022).sum()} de 2022)")
    print(f"  suplentes em exercício hoje: {len(em_ex)}")
    for r in em_ex.itertuples():
        print(f"    {r.uf}: {r.ocupante} ({r.partido}), {r.participacao.lower()} de {r.titular} — {r.motivo}, desde {r.desde}")
    prev = df[df.previsto]
    print(f"  titulares de 2022 eleitos para outro cargo em 2026 (suplente previsto para 2027): {len(prev)}")
    for r in prev.itertuples():
        print(f"    {r.uf}: {r.ocupante} ({r.partido}), {r.participacao.lower()} de {r.titular} — {r.motivo}")
    sem = df[df.suplente1.isna() | df.suplente2.isna()]
    print(f"  chapas sem os dois suplentes no TSE: {len(sem)}" + (f" ({', '.join(sem.uf + ' ' + sem.titular)})" if len(sem) else ""))
    mudou = df[(df.turma == 2022) & (df.participacao == "Titular") & (df.partido != df.partido_eleicao)]
    partidos = set(pd.read_csv(CONFIG / "partidos_ideologia.csv").sigla)
    fora = df[~df.partido.isin(partidos)]
    print(f"  cadeiras com partido fora da tabela de campos (ficam sem campo): {len(fora)}"
          + "".join(f"\n    {r.uf}: {r.ocupante} ({r.partido})" for r in fora.itertuples()))
    print(f"  titulares de 2022 que trocaram de partido: {len(mudou)}"
          + "".join(f"\n    {r.uf}: {r.titular} {r.partido_eleicao} → {r.partido}" for r in mudou.itertuples()))


if __name__ == "__main__":
    main()
