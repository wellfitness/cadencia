#!/bin/bash
# Deploy Vatios con Ritmo a Hostinger via FTP.
# Sube el contenido de dist/ (build de Vite) a public_html del subdominio.
# Mismo patron que el deploy de KinesisLab: bash + curl, cero deps.

set -e

# Cargar variables FTP
source .env.local

if [ -z "$FTP_HOST" ] || [ -z "$FTP_USER" ] || [ -z "$FTP_PASS" ]; then
  echo "ERROR: Faltan credenciales FTP en .env.local"
  echo "Necesitas: FTP_HOST, FTP_USER, FTP_PASS, FTP_REMOTE_DIR"
  exit 1
fi

if [ ! -d "dist" ]; then
  echo "ERROR: No existe dist/. Ejecuta 'pnpm build' primero."
  exit 1
fi

BASE_URL="ftp://${FTP_HOST}${FTP_REMOTE_DIR}"
CURL_AUTH="--user ${FTP_USER}:${FTP_PASS}"
CURL_OPTS="--ftp-create-dirs --ssl-allow-beast -k"
COUNTER=0
ERRORS=0

upload_file() {
  local local_path="$1"
  local remote_path="$2"

  if curl -s -S -T "$local_path" $CURL_AUTH $CURL_OPTS "${BASE_URL}${remote_path}" 2>/dev/null; then
    COUNTER=$((COUNTER + 1))
    echo "  OK: $remote_path"
  else
    ERRORS=$((ERRORS + 1))
    echo "  FAIL: $remote_path"
  fi
}

echo "=========================================="
echo "  Deploy Vatios con Ritmo a Hostinger"
echo "=========================================="
echo "Host: $FTP_HOST"
echo "Dir:  $FTP_REMOTE_DIR (relativo al public_html del subdominio)"
echo ""

cd dist

# ──────────────────────────────────────────────
# 1. Archivos raiz (HTML, manifest, sw, htaccess, etc.)
# ──────────────────────────────────────────────
echo "[1/3] Archivos raiz..."
for f in index.html privacy.html terms.html manifest.webmanifest sw.js .htaccess robots.txt registerSW.js workbox-*.js favicon.svg; do
  [ -f "$f" ] && upload_file "$f" "$f"
done

# ──────────────────────────────────────────────
# 2. assets/ (CSS, JS, sourcemaps con hash)
# ──────────────────────────────────────────────
echo "[2/3] Assets (JS + CSS hasheados)..."
if [ -d "assets" ]; then
  for f in assets/*; do
    [ -f "$f" ] && upload_file "$f" "$f"
  done
fi

# ──────────────────────────────────────────────
# 3. Sourcemaps (opcional, para depurar errores en prod)
# ──────────────────────────────────────────────
echo "[3/3] Sourcemaps..."
for f in sw.js.map workbox-*.js.map; do
  [ -f "$f" ] && upload_file "$f" "$f"
done

cd ..

echo ""
echo "=========================================="
echo "  Deploy completado"
echo "=========================================="
echo "Subidos: $COUNTER archivos"
[ $ERRORS -gt 0 ] && echo "ERRORES: $ERRORS archivos" || echo "Errores: 0"
echo "URL: https://sincro.movimientofuncional.app"
