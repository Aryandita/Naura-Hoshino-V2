#!/usr/bin/env bash
# =============================================================
# NAURA HOSHINO V2 - YouTube Bot Detection Bypass Setup (Linux/Mac)
# =============================================================
# Menyiapkan PO Token provider (bgutil-ytdlp-pot-provider) di port 4416
# + yt-dlp, sebagai lapisan bypass anti-bot YouTube untuk Lavalink.
#
# Cara pakai:
#   chmod +x scripts/setup-youtube-bypass.sh
#   ./scripts/setup-youtube-bypass.sh
#
# Setelah selesai, restart Lavalink (docker compose restart lavalink
# atau restart panel/hosting Anda).

set -euo pipefail

POT_PORT="${POT_PORT:-4416}"
POT_REPO="https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git"
POT_BRANCH="${POT_BRANCH:-master}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/bgutil-ytdlp-pot-provider}"
POT_URL="http://127.0.0.1:${POT_PORT}"

log() { printf '\033[36m[setup-youtube-bypass]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[WARN]\033[0m %s\n' "$*" >&2; }
fail() { printf '\033[31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }

# ----------------------------------------
# 1. Cek Node.js (server bgutil butuh Node >= 20)
# ----------------------------------------
log "Memeriksa Node.js..."
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js tidak ditemukan. Install Node.js >= 20 dari https://nodejs.org lalu jalankan ulang script ini."
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js versi ${NODE_MAJOR} terlalu lama. Butuh >= 20 (server bgutil memakai API modern)."
fi
log "Node.js $(node --version) OK."

# ----------------------------------------
# 2. Clone / update bgutil-ytdlp-pot-provider
# ----------------------------------------
if [ -d "$INSTALL_DIR/.git" ]; then
  log "Repo sudah ada di ${INSTALL_DIR}, memperbarui..."
  git -C "$INSTALL_DIR" pull --ff-only || warn "git pull gagal; lanjut dengan kode yang ada."
else
  log "Cloning bgutil-ytdlp-pot-provider ke ${INSTALL_DIR}..."
  git clone --single-branch --branch "$POT_BRANCH" "$POT_REPO" "$INSTALL_DIR" \
    || fail "git clone gagal. Cek koneksi internet atau proxy Anda."
fi

# ----------------------------------------
# 3. Build server PO Token
# ----------------------------------------
cd "$INSTALL_DIR/server"
log "Menginstall dependensi server (npm ci)..."
npm ci || fail "npm ci gagal."
log "Membangun TypeScript (npx tsc)..."
npx tsc || fail "npx tsc gagal."

# ----------------------------------------
# 4. Cek port & jalankan server (background)
# ----------------------------------------
if curl -fsS "$POT_URL/ping" >/dev/null 2>&1; then
  log "PO Token server sudah berjalan di ${POT_URL}. Tidak perlu start ulang."
else
  log "Menjalankan PO Token server di ${POT_URL}..."
  nohup node build/main.js --port "$POT_PORT" > "$INSTALL_DIR/pot-server.log" 2>&1 &
  echo $! > "$INSTALL_DIR/pot-server.pid"
  sleep 3
  if curl -fsS "$POT_URL/ping" >/dev/null 2>&1; then
    log "PO Token server BERHASIL berjalan (PID $(cat "$INSTALL_DIR/pot-server.pid"))."
  else
    fail "Server gagal merespons /ping. Cek log: $INSTALL_DIR/pot-server.log"
  fi
fi

# ----------------------------------------
# 5. Install yt-dlp (jika belum ada)
# ----------------------------------------
if command -v yt-dlp >/dev/null 2>&1; then
  log "yt-dlp sudah terinstall: $(yt-dlp --version 2>/dev/null || echo 'versi tidak diketahui')."
else
  log "yt-dlp tidak ditemukan, mencoba install via pip..."
  if command -v pip3 >/dev/null 2>&1; then
    pip3 install -U yt-dlp || fail "pip3 install yt-dlp gagal."
  elif command -v pip >/dev/null 2>&1; then
    pip install -U yt-dlp || fail "pip install yt-dlp gagal."
  else
    warn "pip tidak tersedia. Install yt-dlp manual dari https://github.com/yt-dlp/yt-dlp/wiki/Installation"
  fi
fi

# ----------------------------------------
# 6. Instruksi environment & restart
# ----------------------------------------
log ""
log "=================== SELESAI ==================="
log "PO Token server : ${POT_URL} (/ping, /get_pot)"
log "yt-dlp         : $(command -v yt-dlp || echo 'BELUM TERINSTALL - install manual')"
log ""
log "Konfigurasi yang harus aktif di lingkungan Lavalink Anda:"
log "  POT_PROVIDER_BASE_URL=http://127.0.0.1:${POT_PORT}"
log "  (di docker-compose.yml, nilai default sudah http://pot-server:4416)"
log ""
log "RESTART LAVALINK sekarang:"
log "  docker compose up -d --build lavalink pot-server"
log "  (atau restart service Lavalink di panel hosting Anda)"
log ""
log "Verifikasi: lihat docs/YOUTUBE_BYPASS_SETUP.md bagian troubleshooting."