# =============================================================
# NAURA HOSHINO V2 - YouTube Bot Detection Bypass Setup (Windows)
# =============================================================
# Menyiapkan PO Token provider (bgutil-ytdlp-pot-provider) di port 4416
# + yt-dlp, sebagai lapisan bypass anti-bot YouTube untuk Lavalink.
#
# Cara pakai:
#   .\scripts\setup-youtube-bypass.ps1
#
# Setelah selesai, restart Lavalink (docker compose restart lavalink
# atau restart panel/hosting Anda).

$ErrorActionPreference = "Stop"
$POT_PORT = if ($env:POT_PORT) { [int]$env:POT_PORT } else { 4416 }
$POT_REPO = "https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git"
$POT_BRANCH = if ($env:POT_BRANCH) { $env:POT_BRANCH } else { "master" }
$INSTALL_DIR = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { Join-Path $HOME "bgutil-ytdlp-pot-provider" }
$POT_URL = "http://127.0.0.1:${POT_PORT}"

function Write-Log($msg) { Write-Host "[setup-youtube-bypass] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Warning $msg }
function Write-Fail($msg) { Write-Error $msg; exit 1 }

# ----------------------------------------
# 1. Cek Node.js (server bgutil butuh Node >= 20)
# ----------------------------------------
Write-Log "Memeriksa Node.js..."
try {
    $nodeVer = & node --version 2>$null
    if (-not $?) { throw "node tidak ditemukan" }
} catch {
    Write-Fail "Node.js tidak ditemukan. Install Node.js >= 20 dari https://nodejs.org lalu jalankan ulang script ini."
}
$major = [int]($nodeVer.TrimStart("v").Split(".")[0])
if ($major -lt 20) {
    Write-Fail "Node.js versi ${major} terlalu lama. Butuh >= 20 (server bgutil memakai API modern)."
}
Write-Log "Node.js $nodeVer OK."

# ----------------------------------------
# 2. Clone / update bgutil-ytdlp-pot-provider
# ----------------------------------------
if (Test-Path "$INSTALL_DIR\.git") {
    Write-Log "Repo sudah ada di $INSTALL_DIR, memperbarui..."
    Push-Location $INSTALL_DIR
    try { git pull --ff-only } catch { Write-Warn "git pull gagal; lanjut dengan kode yang ada." }
    Pop-Location
} else {
    Write-Log "Cloning bgutil-ytdlp-pot-provider ke $INSTALL_DIR..."
    git clone --single-branch --branch $POT_BRANCH $POT_REPO $INSTALL_DIR
    if ($LASTEXITCODE -ne 0) { Write-Fail "git clone gagal. Cek koneksi internet atau proxy Anda." }
}

# ----------------------------------------
# 3. Build server PO Token
# ----------------------------------------
Push-Location "$INSTALL_DIR\server"
Write-Log "Menginstall dependensi server (npm ci)..."
npm ci
if ($LASTEXITCODE -ne 0) { Write-Fail "npm ci gagal." }
Write-Log "Membangun TypeScript (npx tsc)..."
npx tsc
if ($LASTEXITCODE -ne 0) { Write-Fail "npx tsc gagal." }
Pop-Location

# ----------------------------------------
# 4. Cek port & jalankan server (background)
# ----------------------------------------
$pingOk = $false
try {
    $resp = Invoke-WebRequest -Uri "$POT_URL/ping" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    $pingOk = ($resp.StatusCode -eq 200)
} catch {}

if ($pingOk) {
    Write-Log "PO Token server sudah berjalan di $POT_URL. Tidak perlu start ulang."
} else {
    Write-Log "Menjalankan PO Token server di $POT_URL..."
    $logFile = Join-Path $INSTALL_DIR "pot-server.log"
    Start-Process -FilePath "node" -ArgumentList "build/main.js","--port",$POT_PORT `
        -WorkingDirectory "$INSTALL_DIR\server" -WindowStyle Hidden -RedirectStandardOutput $logFile
    Start-Sleep -Seconds 3
    try {
        $resp = Invoke-WebRequest -Uri "$POT_URL/ping" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($resp.StatusCode -ne 200) { throw "bad status" }
        Write-Log "PO Token server BERHASIL berjalan."
    } catch {
        Write-Fail "Server gagal merespons /ping. Cek log: $logFile"
    }
}

# ----------------------------------------
# 5. Install yt-dlp (jika belum ada)
# ----------------------------------------
$ytdlpPath = Get-Command yt-dlp -ErrorAction SilentlyContinue
if ($ytdlpPath) {
    Write-Log "yt-dlp sudah terinstall: $($ytdlpPath.Source)"
} else {
    Write-Log "yt-dlp tidak ditemukan, mencoba install via pip..."
    if (Get-Command pip3 -ErrorAction SilentlyContinue) {
        pip3 install -U yt-dlp
        if ($LASTEXITCODE -ne 0) { Write-Fail "pip3 install yt-dlp gagal." }
    } elseif (Get-Command pip -ErrorAction SilentlyContinue) {
        pip install -U yt-dlp
        if ($LASTEXITCODE -ne 0) { Write-Fail "pip install yt-dlp gagal." }
    } else {
        Write-Warn "pip tidak tersedia. Install yt-dlp manual dari https://github.com/yt-dlp/yt-dlp/wiki/Installation"
    }
}

# ----------------------------------------
# 6. Instruksi environment & restart
# ----------------------------------------
Write-Log ""
Write-Log "=================== SELESAI ==================="
Write-Log "PO Token server : $POT_URL (/ping, /get_pot)"
Write-Log "yt-dlp         : $(if (Get-Command yt-dlp -EA SilentlyContinue) { (Get-Command yt-dlp).Source } else { 'BELUM TERINSTALL - install manual' })"
Write-Log ""
Write-Log "Konfigurasi yang harus aktif di lingkungan Lavalink Anda:"
Write-Log "  POT_PROVIDER_BASE_URL=http://127.0.0.1:${POT_PORT}"
Write-Log "  (di docker-compose.yml, nilai default sudah http://pot-server:4416)"
Write-Log ""
Write-Log "RESTART LAVALINK sekarang:"
Write-Log "  docker compose up -d --build lavalink pot-server"
Write-Log "  (atau restart service Lavalink di panel hosting Anda)"
Write-Log ""
Write-Log "Verifikasi: lihat docs/YOUTUBE_BYPASS_SETUP.md bagian troubleshooting."