# Atalhos. Os scripts são criados ao longo das etapas do PLAN.md.
ANO ?= 2026
UF  ?= BR
PY  ?= .venv/bin/python

.PHONY: setup dados web teste

setup:
	python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
	npm --prefix web install

dados:
	$(PY) pipeline/baixar_tse.py --ano $(ANO) --uf $(UF)
	$(PY) pipeline/municipios.py --ano $(ANO)
	$(PY) pipeline/tabelas.py --ano $(ANO) --uf $(UF)

web:
	$(PY) pipeline/exportar_web.py --ano $(ANO) --uf $(UF)
	npm --prefix web run build

teste:
	ANO=2022 $(PY) -m pytest pipeline/tests -q
