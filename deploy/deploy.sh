#!/usr/bin/env bash
# Builds and (re)starts the production stack. Run on the server, from
# anywhere in the repo, after `git pull` for updates:
#   ./deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=deploy/.env
CADDY_IMAGE=caddy:2.11.9-alpine
COMPOSE=(docker compose -f compose.yaml -f deploy/compose.prod.yaml --env-file "$ENV_FILE")

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Create it from the template:"
  echo "  cp deploy/.env.example deploy/.env && nano deploy/.env"
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

fail() { echo "deploy/.env: $1" >&2; exit 1; }
for name in DOMAIN BASIC_AUTH_USER BASIC_AUTH_PASSWORD POSTGRES_PASSWORD; do
  [ -n "${!name:-}" ] || fail "$name is empty"
done
[ "${#BASIC_AUTH_PASSWORD}" -ge 12 ] || fail "BASIC_AUTH_PASSWORD should be at least 12 characters"
[ "${#POSTGRES_PASSWORD}" -ge 16 ] || fail "POSTGRES_PASSWORD should be at least 16 characters (openssl rand -hex 24)"
if [ "${LLM_PROVIDER:-ollama}" = anthropic ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  fail "LLM_PROVIDER=anthropic needs ANTHROPIC_API_KEY"
fi

echo "==> Hashing the demo password for Caddy"
# Hashing here keeps the "$" characters of a bcrypt hash out of the env file,
# where they would be mangled by variable interpolation.
BASIC_AUTH_HASH=$(docker run --rm "$CADDY_IMAGE" caddy hash-password --plaintext "$BASIC_AUTH_PASSWORD")
export BASIC_AUTH_HASH

echo "==> Building and starting (the first run downloads ~6 GB and takes a while)"
"${COMPOSE[@]}" up -d --build --remove-orphans

echo "==> Status"
"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}'
echo
echo "Open https://$DOMAIN and sign in as '$BASIC_AUTH_USER'."
echo "Logs: docker compose -f compose.yaml -f deploy/compose.prod.yaml logs -f api caddy"
