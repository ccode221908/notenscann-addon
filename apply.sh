#!/usr/bin/env bash
# =============================================================================
# notenscann-addon — apply.sh
# Wendet CorePass-Authentifizierung auf eine bestehende notenscanner-Installation an.
#
# Aufruf:
#   git clone https://github.com/ccode221908/notenscann-addon.git
#   cd notenscann-addon
#   bash apply.sh [NOTENSCANNER_DIR]
#
# NOTENSCANNER_DIR: Pfad zur notenscanner-Installation (Standard: /opt/sheet-music-web)
# =============================================================================
set -euo pipefail

ADDON_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-/opt/sheet-music-web}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}WARN:${NC} $*"; }
die()  { echo -e "${RED}ERROR:${NC} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Dieses Script muss als root ausgefuehrt werden."
[[ -d "$TARGET/backend/app" ]] || die "notenscanner nicht gefunden unter: $TARGET"

BACKEND="$TARGET/backend"
FRONTEND="$TARGET/frontend"

# Pruefen ob .env existiert
[[ -f "$BACKEND/.env" ]] || die "backend/.env fehlt. Bitte zuerst notenscanner installieren."

# -----------------------------------------------------------------------------
# 1. JWT_SECRET und COREPASS_BASE_URL in .env eintragen (falls noch nicht vorhanden)
# -----------------------------------------------------------------------------
info "Pruefe .env..."
if ! grep -q "JWT_SECRET" "$BACKEND/.env"; then
    JWT_SECRET=$(openssl rand -hex 32)
    echo "" >> "$BACKEND/.env"
    echo "JWT_SECRET=$JWT_SECRET" >> "$BACKEND/.env"
    info "  JWT_SECRET generiert und eingetragen."
else
    info "  JWT_SECRET bereits vorhanden."
fi

if ! grep -q "COREPASS_BASE_URL" "$BACKEND/.env"; then
    echo "COREPASS_BASE_URL=" >> "$BACKEND/.env"
    warn "  COREPASS_BASE_URL ist leer — bitte in $BACKEND/.env eintragen!"
    warn "  Beispiel: COREPASS_BASE_URL=https://sheetmusic.xcbfan.cc"
else
    info "  COREPASS_BASE_URL bereits vorhanden."
fi

# -----------------------------------------------------------------------------
# 2. Backend-Abhaengigkeiten installieren
# -----------------------------------------------------------------------------
info "Installiere Python-Abhaengigkeiten (qrcode)..."
"$TARGET/venv/bin/pip" install -r "$ADDON_DIR/backend/requirements_addon.txt" -q

# -----------------------------------------------------------------------------
# 3. Neue Backend-Dateien kopieren
# -----------------------------------------------------------------------------
info "Kopiere neue Backend-Dateien..."
cp "$ADDON_DIR/backend/app/auth.py"              "$BACKEND/app/auth.py"
cp "$ADDON_DIR/backend/app/api/routes/auth.py"   "$BACKEND/app/api/routes/auth.py"

# -----------------------------------------------------------------------------
# 4. Bestehende Backend-Dateien ersetzen (Backups anlegen)
# -----------------------------------------------------------------------------
info "Erstelle Backups und ersetze Backend-Dateien..."

backup() {
    local src="$1"
    if [[ -f "$src" ]]; then
        cp "$src" "${src}.bak-$(date +%Y%m%d%H%M%S)"
    fi
}

backup "$BACKEND/app/config.py"
backup "$BACKEND/app/models.py"
backup "$BACKEND/app/main.py"
backup "$BACKEND/app/api/routes/scores.py"
backup "$BACKEND/app/services/storage.py"
backup "$BACKEND/app/services/musescore.py"

cp "$ADDON_DIR/backend/app_patches/config.py"              "$BACKEND/app/config.py"
cp "$ADDON_DIR/backend/app_patches/models.py"              "$BACKEND/app/models.py"
cp "$ADDON_DIR/backend/app_patches/main.py"                "$BACKEND/app/main.py"
cp "$ADDON_DIR/backend/app_patches/routes_scores.py"       "$BACKEND/app/api/routes/scores.py"
cp "$ADDON_DIR/backend/app_patches/services_storage.py"    "$BACKEND/app/services/storage.py"
cp "$ADDON_DIR/backend/app_patches/services_musescore.py"  "$BACKEND/app/services/musescore.py"

# -----------------------------------------------------------------------------
# 5. Frontend-Dateien ersetzen
# -----------------------------------------------------------------------------
info "Kopiere Frontend-Dateien..."

backup "$FRONTEND/src/api.ts"
backup "$FRONTEND/src/App.tsx"
backup "$FRONTEND/src/pages/Home.tsx"

cp "$ADDON_DIR/frontend/src/patches/api.ts"    "$FRONTEND/src/api.ts"
cp "$ADDON_DIR/frontend/src/patches/App.tsx"   "$FRONTEND/src/App.tsx"
cp "$ADDON_DIR/frontend/src/patches/Home.tsx"  "$FRONTEND/src/pages/Home.tsx"
cp "$ADDON_DIR/frontend/src/pages/Login.tsx"   "$FRONTEND/src/pages/Login.tsx"

# -----------------------------------------------------------------------------
# 6. Frontend bauen
# -----------------------------------------------------------------------------
info "Baue Frontend..."
cd "$FRONTEND"
npm ci --silent
npm run build

# Static files deployen
mkdir -p /var/www/sheet-music-web
rsync -a --delete "$FRONTEND/dist/" /var/www/sheet-music-web/
chown -R www-data:www-data /var/www/sheet-music-web 2>/dev/null || true

# -----------------------------------------------------------------------------
# 7. Backend neu starten
# -----------------------------------------------------------------------------
info "Starte Backend neu..."
systemctl restart sheet-music-backend
sleep 2
systemctl is-active sheet-music-backend || die "Backend-Start fehlgeschlagen. Logs: journalctl -u sheet-music-backend -n 50"

# -----------------------------------------------------------------------------
# Fertig
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN} notenscann-addon erfolgreich angewendet!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo "Naechste Schritte:"
echo "  1. COREPASS_BASE_URL in $BACKEND/.env setzen (falls noch leer)"
echo "     Beispiel: COREPASS_BASE_URL=https://sheetmusic.xcbfan.cc"
echo "  2. Backend neu starten: systemctl restart sheet-music-backend"
echo "  3. Browser oeffnen → Login-Seite erscheint"
echo ""
echo "Testen:"
echo "  curl -s -X POST http://localhost:8000/auth/challenge | python3 -m json.tool"
echo ""
