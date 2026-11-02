# Atalhos. Ver PLAN.md.
ANO ?= 2026
UF  ?= BR
PY  ?= .venv/bin/python

.PHONY: setup dados web teste dev

setup:
	python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
	npm --prefix web install

dados:            ## baixa TSE + geobr e gera data/processed/
	$(PY) pipeline/baixar.py --ano $(ANO)
	$(PY) pipeline/municipios.py
	$(PY) pipeline/tabelas.py --ano $(ANO) --uf $(UF)

web:              ## gera os JSON e faz o build do app
	$(PY) pipeline/exportar_web.py --ano $(ANO) --uf $(UF)
	npm --prefix web run build

dev:              ## app em modo de desenvolvimento (http://localhost:5173)
	npm --prefix web run dev

teste:            ## valida contra a planilha 2022 da Aliança
	$(PY) pipeline/baixar.py --ano 2022
	$(PY) pipeline/tabelas.py --ano 2022 --uf MG
	$(PY) -m pytest pipeline/tests -q
