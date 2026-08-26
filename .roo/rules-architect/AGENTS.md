# Project Architecture Rules (Non-Obvious Only)

## Polyglot persistence: domain dipisah keras

- Supabase/PostgreSQL: data transaksional inti. MongoDB (`src/models/mongo/`): dokumen bervolume besar (AI chat history, transcript tiket, audit log command), tulis non-blocking. Redis: cache + Pub/Sub invalidasi + rate limit. SQLite (`node:sqlite`): fallback darurat saat remote mati.
- Nama tabel Sequelize tidak seragam: `UserSurvival` -> tabel `UserSurvivals` (timestamps on), `UserProfile` -> `user_profiles` (timestamps off). Selalu cek `tableName` sebelum SQL mentah.
- Migrasi skema eksklusif di `dbMigrator.js` dengan versi bernomor + ledger `schema_migrations`. Dilarang ALTER TABLE di `dbManager.js` atau `sync({ alter: true })` di produksi. Migrasi data yang menambah nilai (contoh `v6_move_coupons_to_column`) dobel-eksekusi = saldo terduplikasi; ledger satu-satunya pengaman.

## Titik tulis tunggal (single writer)

- Semua tulis data user wajib lewat `cacheManager` (increment/debit/mutateJson); semua tulis `GuildSettings` wajib lewat `guildSettingsService.updateGuildSetting()`. Menulis model langsung meninggalkan cache basi sampai TTL habis.
- Invalidasi cache lintas shard disiarkan via Redis Pub/Sub channel `cache:invalidate`.

## Skala & batas

- Masih `ShardingManager`, tapi kode baru wajib siap migrasi ke clustering: komunikasi lintas shard lewat manager terpusat/Redis, bukan `broadcastEval` tersebar; state penting tidak boleh hanya di memori satu proses; `pool.max` per proses dikalikan jumlah shard.
- Render Canvas wajib lewat `canvasWorkerPool.js` (worker threads), konkurensi global 2-3, buffer di-dispose, cache `canvas:*` di-invalidasi via `smartInvalidateUserCanvas(userId)`.
- Batas payload Components V2 dijaga `src/utils/componentBudget.js`: maks 40 komponen, teks aman di bawah ~3.500 karakter; builder memotong isi berlebih alih-alih gagal di Discord.
- Deploy di Pterodactyl hanya memberi satu perintah (`CMD_RUN=npm start`), sehingga urutan migrasi wajib hidup di `prestart` dalam `package.json`, bukan di panel.
