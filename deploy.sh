#!/usr/bin/env bash
set -euo pipefail

NO_START=0
SKIP_INSTALL=0
SKIP_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --no-start) NO_START=1 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help)
      cat <<'EOF'
BetterWriter one-click deploy (Linux)

Usage:
  ./deploy.sh [--no-start] [--skip-install] [--skip-build]

Options:
  --no-start       Finish setup but do not start server
  --skip-install   Skip npm install steps
  --skip-build     Skip build step (npm run build:all)
EOF
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Run ./deploy.sh --help" >&2
      exit 2
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_ENV="$ROOT_DIR/server/.env"

echo "BetterWriter one-click deploy (Linux)"
echo "Path: $ROOT_DIR"

command -v node >/dev/null 2>&1 || { echo "Node.js not found. Please install Node.js 18+." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm not found. Please install Node.js 18+ (includes npm)." >&2; exit 1; }

ensure_env_kv() {
  local file="$1"
  local key="$2"
  local value="$3"

  if [[ ! -f "$file" ]]; then
    mkdir -p "$(dirname "$file")"
    : >"$file"
  fi

  if grep -qE "^${key}=" "$file"; then
    local current
    current="$(grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- || true)"
    if [[ -n "${current}" ]]; then
      return 0
    fi
  fi

  printf "%s=%s\n" "$key" "$value" >>"$file"
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '\n' | tr -d '='
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import os, base64
print(base64.b64encode(os.urandom(48)).decode().rstrip('='), end='')
PY
    return 0
  fi
  head -c 48 /dev/urandom | base64 | tr -d '\n' | tr -d '='
}

ensure_env_kv "$SERVER_ENV" "JWT_SECRET" "$(random_secret)"
ensure_env_kv "$SERVER_ENV" "STORAGE_SECRET" "$(random_secret)"
echo "server/.env ready (JWT_SECRET / STORAGE_SECRET)."

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT_DIR" && npm install)

  echo "Installing backend dependencies..."
  (cd "$ROOT_DIR/server" && npm install)
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "Building frontend + backend..."
  (cd "$ROOT_DIR" && npm run build:all)
fi

LAN_IP=""
if command -v hostname >/dev/null 2>&1; then
  LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
fi
if [[ -z "$LAN_IP" ]] && command -v ip >/dev/null 2>&1; then
  LAN_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)"
fi

if [[ -n "$LAN_IP" ]]; then
  echo "LAN URL: http://$LAN_IP:3001/"
else
  echo "LAN URL: http://<your-ipv4>:3001/"
fi

echo "If LAN devices cannot access, allow inbound TCP 3001 in your firewall (ufw/firewalld/iptables)."

if [[ "$NO_START" -eq 1 ]]; then
  echo "Done (server not started due to --no-start)."
  exit 0
fi

echo "Starting server (Ctrl+C to stop)..."
(cd "$ROOT_DIR" && npm run start:server)
