# Project Debug Rules (Non-Obvious Only)

## Pintu darurat & flag

- `SKIP_DB_MIGRATE=1` (atau `npm run start:no-migrate`) menyalakan bot tanpa migrasi. Hanya untuk darurat, jangan permanen.
- `.cache/commands-deploy.json` menyimpan signature SHA-256 definisi slash command. Bila folder `.cache/` terhapus, semua command di-deploy ulang saat boot berikutnya (makan rate limit Discord). Deploy hanya oleh shard utama.
- `env.js` punya `cleanEnv()` yang membersihkan tanda kutip dari variabel panel Pterodactyl. Nilai env aneh berkutip sering berasal dari panel, bukan dari kode.

## Lokasi error & logging

- Global error handler: `src/managers/errorHandler.js`. Error tak tertangani dari interaksi masuk ke sini, lalu opsional dikirim ke `ERROR_WEBHOOK_URL` dan Sentry (`@sentry/node`).
- Boot status tampil sebagai ASCII report via `src/utils/bootScreen.js`.
- Integritas resolusi modul internal dicek `scripts/check-requires.js` (`npm run test:requires`). Require path rusak terdeteksi di sini, bukan saat lint.

## Fallback & konsistensi

- Bila Supabase tidak terjangkau, bot otomatis jatuh ke SQLite lokal `naura_fallback.sqlite`; sinkron balik lewat `syncFallbackToMySQL()` saat pulih. Data "hilang" saat debugging bisa jadi tersimpan di fallback.
- Antrean penulisan saldo di-flush oleh `cacheManager` (delta `charge()`/`reward()` tertunda beberapa detik). Nilai DB yang tampak basi saat debug bisa jadi belum di-flush; shutdown bersih memanggil `cacheManager.flushAll()`.
- Graceful shutdown menangani `SIGINT`/`SIGTERM`; shard crash otomatis respawn kecuali exit code `78` (konfigurasi salah).
