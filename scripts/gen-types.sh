#!/usr/bin/env bash
set -euo pipefail
BASE="${API_BASE:-http://localhost:8000}"
npx openapi-typescript "$BASE/openapi.json" -o src/api/schema.d.ts
echo "regenerated from $BASE"
