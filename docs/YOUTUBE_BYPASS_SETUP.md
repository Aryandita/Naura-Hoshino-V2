# YouTube Bot Detection Bypass Setup (Naura Hoshino V2)

> Panduan lengkap bypass "Sign in to confirm you're not a bot" YouTube pada
> Lavalink v4 Naura Hoshino V2. Berlaku sejak 2026-10-28 (versi 2.4.0).

## Mengapa YouTube Memblokir Bot

YouTube menjalankan deteksi otomatis terhadap request yang bukan dari browser
asli. Bot musik (Lavalink/Lavaplayer) memanggil API internal YouTube
(InnerTube) tanpa menjalankan JavaScript browser, sehingga gagal challenge
**PO Token (Proof of Origin)**: teka-teki JS yang harus dipecahkan klien
sebelum dianggap manusia. IP datacenter (VPS/hosting) mendapat skor risiko
lebih tinggi daripada IP rumahan, sehingga blokir muncul lebih cepat.

Gejala: error `Sign in to confirm you're not a bot`, `This video is
unavailable`, atau track YouTube gagal load tanpa pesan jelas.

## Solusi 3 Lapis

| Lapis | Komponen | Cara kerja |
|-------|----------|------------|
| 1. PO Token | Server bgutil (`pot-server`, port 4416) + plugin yt-dlp `bgutil-ytdlp-pot-provider` | Server menjalankan BrowserJS (via Node) untuk memecahkan challenge YouTube dan mengeluarkan token asli; plugin yt-dlp menyematkannya ke setiap request. |
| 2. Client Rotation | youtube-source plugin, key `plugins.youtube.clients` | Pencobaan berurutan lewat beberapa client InnerTube non-default (MUSIC, WEBEMBEDDED, ANDROID_VR, TVHTML5_SIMPLY). Jika satu diblokir, client berikutnya mencoba. |
| 3. yt-dlp Primary | LavaSrc source `ytdlp` (prefix `ytsearch:`) | Pencarian & load URL YouTube didelegasikan ke binary yt-dlp yang selalu up-to-date melawan perubahan YouTube, dan otomatis memakai PO token dari Lapis 1. |

Catatan penting:

- PO token statis (`plugins.youtube.pot.token`) HANYA berlaku untuk client
  WEB/WEBEMBEDDED dan sering kedaluwarsa. Jalur utama kita adalah provider
  bgutil untuk yt-dlp.
- youtube-source TIDAK punya opsi `poTokenProviderUrl`, `playerClients`,
  `sources.YOUTUBE_MUSIC`, atau client `TV_DOWNLOADED`; jangan salin konfigurasi
  tersebut dari internet lama. Kunci yang benar: `clients:`, `pot:`,
  `remoteCipher:`, `oauth:`.
- Prefix `ytsearch:` hanya boleh dimiliki SATU source. Kita menyerahkannya ke
  source `ytdlp` LavaSrc (bukan youtube-source), sehingga pencarian biasa
  otomatis lewat yt-dlp. `ytmsearch:` tetap ditangani client MUSIC youtube-source.

## Arsitektur File

- `docker/lavalink/application.yml` : konfigurasi plugin (Lapis 2 + 3 + wiring Lapis 1).
- `docker/lavalink/Dockerfile` : image Lavalink + yt-dlp + plugin bgutil.
- `docker-compose.yml` : service `pot-server` + env `POT_PROVIDER_BASE_URL`.
- `scripts/setup-youtube-bypass.sh` / `.ps1` : setup provider di host (non-docker).
- `src/config/env.js` : default `MUSIC_DEFAULT_SEARCH` = `ytmsearch`.
- `plugin/music/subcommands/playEngine.js` : fallback chain
  `ytmsearch -> ytsearch -> scsearch`.

## Setup dengan Docker Compose (Rekomendasi)

1. Pastikan kredensial Spotify terisi di `.env` (`SPOTIFY_CLIENT_ID`,
   `SPOTIFY_CLIENT_SECRET`) untuk mirroring LavaSrc.
2. Jalankan:

   ```bash
   docker compose up -d --build lavalink pot-server
   docker compose restart bot
   ```

3. Selesai. Compose otomatis:
   - build image Lavalink dengan yt-dlp + plugin bgutil (versi disamakan),
   - menjalankan `pot-server` (jaringan internal, tanpa port publik),
   - mengisi `POT_PROVIDER_BASE_URL=http://pot-server:4416` untuk Lavalink,
   - menerapkan `application.yml` hasil mount read-only.

## Setup Manual (Tanpa Docker)

Gunakan bila Lavalink Anda berjalan di panel/hosting terpisah:

- Linux/Mac: `chmod +x scripts/setup-youtube-bypass.sh && ./scripts/setup-youtube-bypass.sh`
- Windows: `.\scripts\setup-youtube-bypass.ps1`

Script tersebut akan: cek Node.js >= 20, clone + build server bgutil,
menjalankannya di `http://127.0.0.1:4416`, dan install yt-dlp bila belum ada.
Lalu set env Lavalink: `POT_PROVIDER_BASE_URL=http://127.0.0.1:4416` dan
restart Lavalink Anda.

## Verifikasi Berhasil

1. PO server hidup:

   ```bash
   curl http://127.0.0.1:4416/ping
   # Docker internal: docker compose exec lavalink curl -s http://pot-server:4416/ping
   ```

   Respons `OK` berarti sehat.

2. yt-dlp mengambil PO token (dari dalam container/host Lavalink):

   ```bash
   yt-dlp --extractor-args "youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416" \
     -f bestaudio --skip-download -J "https://www.youtube.com/watch?v=dQw4w9WgXcQ" \
     | head -c 300
   ```

   Output JSON (bukan pesan "Sign in to confirm") = bypass bekerja.

3. Uji pencarian lewat REST Lavalink:

   ```bash
   curl "http://localhost:2333/v4/loadtracks?identifier=ytsearch:unravel%20lwv" \
     -H "Authorization: youshallnotpass"
   ```

   `loadType: SEARCH_RESULT` dengan track terisi = berhasil.

4. Uji end-to-end: `/music play query:unravel` di Discord. Tanpa error dan
   tanpa lagu salah ambil = tuntas.

## Troubleshooting

| Gejala | Penyebab umum | Solusi |
|--------|---------------|--------|
| `pot-server` /ping timeout | Server belum jalan atau port salah | Jalankan script setup; cek `POT_PROVIDER_BASE_URL` sesuai host (docker: `http://pot-server:4416`, host: `127.0.0.1:4416`) |
| yt-dlp: `Unable to retrieve POT` | Versi plugin != versi server bgutil | Samakan versi `BGUTIL_PLUGIN_VERSION` (Dockerfile) dengan tag image pot-server |
| Masih "Sign in to confirm" | IP datacenter sangat terblokir | Pastikan Lapis 3 aktif (`ytdlp: true`); coba ganti IP/proxy; PO token bukan jaminan mutlak |
| Pencarian sangat lambat | yt-dlp spawn per query (normal) | Turunkan `searchLimit`; pertimbangkan cache; pastikan CPU host cukup |
| `ytmsearch` kosong tapi `ytsearch` jalan | Client MUSIC diblokir | Cek log Lavalink; naikkan versi youtube-source plugin |
| Track Spotify gagal resolve | Spotify creds kosong/limit | Isi `SPOTIFY_CLIENT_ID/SECRET`; fallback chain bot-side akan ke ytsearch |
| ytsearch error "no such file" | yt-dlp tidak ada di PATH container | Pastikan pakai Dockerfile custom (`docker compose build lavalink`) atau isi `YT_DLP_PATH` |
| Playlist YouTube besar lambat | playlistLoadLimit tinggi | Turunkan `plugins.lavasrc.ytdlp.playlistLoadLimit` |

## Pemeliharaan Rutin

- Naikkan versi `yt-dlp` dan `bgutil-ytdlp-pot-provider` bersamaan setiap
  beberapa minggu (YouTube sering mengubah mekanisme).
- Pantau rilis youtube-source & LavaSrc dan perbarui baris dependency di
  `application.yml`.
- Bila YouTube kembali memblokir, urutan investigasi: log pot-server -> log
  yt-dlp manual (perintah verifikasi #2) -> log Lavalink `dev.lavalink.youtube`.

## Rollback

Jika 3 lapis ini menimbulkan masalah, kembalikan `MUSIC_DEFAULT_SEARCH` ke
`scsearch` di `.env` (tanpa ubah kode), dan matikan service `pot-server`.
Konfigurasi plugin dapat dikembalikan dari `docker/lavalink/application.yml.bak`.