#!/usr/bin/env bash
# Roda as migrations + testes de segurança num Postgres LOCAL descartável.
# Uso: PGHOST=/tmp PGPORT=54329 PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=repeteco_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
for f in tests/00_supabase_stub.sql 01_base_v4.sql 02_v5_produto.sql 02_v5_produto.sql tests/10_rls_test.sql; do
  echo "== $f"
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
