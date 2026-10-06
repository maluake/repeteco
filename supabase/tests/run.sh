#!/usr/bin/env bash
# Roda as migrations + testes de segurança num Postgres LOCAL descartável.
# Cada parte da v5 é enviada como UMA requisição (psql -c), como faz o
# SQL Editor do Supabase, e a v5 roda duas vezes para provar idempotência.
# Uso: PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=repeteco_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run_file() { echo "== $1"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1"; }
run_as_editor() { echo "== $1 (requisição única)"; psql -q -v ON_ERROR_STOP=1 -d "$DB" -c "$(cat "$1")" >/dev/null; }
run_file tests/00_supabase_stub.sql
run_as_editor 01_base_v4.sql
for round in 1 2; do
  for f in v5/*.sql; do run_as_editor "$f"; done
done
run_file tests/10_rls_test.sql
