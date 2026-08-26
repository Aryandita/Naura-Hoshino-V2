# Implementation Plan

[Overview]
Remediasi menyeluruh atas temuan audit repository Naura Hoshino V2: menutup risiko integritas data (bare `.save()` dan read-modify-write numerik), memperbaiki kompatibilitas migrasi PostgreSQL yang kritis, menambah `.unref()` pada semua interval level-modul, memindahkan penulisan `GuildSettings` ke service resmi, membersihkan akses `process.env` langsung, dan mengamankan recovery SQLite.

Audit menemukan bahwa ESLint lolos bersih dan keamanan webhook sudah baik (`timingSafeEqual`, idempotency, penolakan 503), tetapi ada tiga kelas bug berisiko tinggi yang tidak tertangkap linter: (1) sekitar 40 panggilan `.save()` tanpa `fields` pada model ber-cache yang dapat menimpa delta `increment()`/`debit()` atomik yang sedang mengantre di flush queue cacheManager — kelas bug yang sama dengan insiden "kupon dobel" historis; (2) 33 dari 34 migrasi di `dbMigrator.js` hanya memiliki SQL dialek MySQL padahal produksi sudah PostgreSQL/Supabase, sehingga deploy baru/staging/disaster recovery akan gagal total di `prestart`; (3) pola baca-ubah-tulis pada kolom numerik `starFragments` di helper survival padahal `debitUserSurvival()` atomik tersedia. Perbaikan dilakukan bertahap dari yang paling berisiko terhadap data produksi, dengan prinsip tidak mengubah perilaku fungsional apa pun selain membuatnya aman terhadap konkurensi dan portabilitas dialek.

[Types]
Tidak ada perubahan sistem tipe — proyek adalah JavaScript CommonJS murni tanpa TypeScript.

Struktur data yang tersentuh hanyalah bentuk entri migrasi di `dbMigrator.js`, yang mendapatkan field opsional kedua secara konsisten:

```javascript
// Bentuk entri MIGRATIONS (sudah ada, kini wajib lengkap untuk SEMUA entri):
{
  id: string,          // ID unik ledger, TIDAK boleh diubah untuk entri lama
  description: string, // Deskripsi manusia
  sql: string,         // Dialek MySQL (dipertahankan sebagai referensi historis)
  pgSql: string,       // WAJIB ditambahkan untuk v1..v33 (dialek PostgreSQL)
}
```

Aturan translasi dialek yang dipakai konsisten pada semua `pgSql` baru:

| MySQL                                     | PostgreSQL                                                           |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `TINYINT(1)`                              | `SMALLINT DEFAULT 0/1` (atau `BOOLEAN` bila semantik boolean)        |
| `MODIFY COLUMN x T ...`                   | `ALTER COLUMN x TYPE T` / `ALTER COLUMN x SET/DROP DEFAULT`          |
| `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`   | (dihapus)                                                            |
| `INT AUTO_INCREMENT PRIMARY KEY`          | `SERIAL PRIMARY KEY`                                                 |
| `BIGINT`                                  | `BIGINT`                                                             |
| `FLOAT`                                   | `DOUBLE PRECISION`                                                   |
| `DATETIME`                                | `TIMESTAMPTZ`                                                        |
| `UNIQUE KEY nama (kol)`                   | `CONSTRAINT nama UNIQUE (kol)` (inline) atau `CREATE UNIQUE INDEX`   |
| `INDEX nama (kol)` inline di CREATE TABLE | `CREATE INDEX IF NOT EXISTS nama ON tabel(kol);` terpisah            |
| `JSON_EXTRACT(kol, '$.key')`              | `(kol->>'key')`                                                      |
| `CAST(x AS UNSIGNED)`                     | `CAST(x AS INTEGER)`                                                 |
| `JSON_TYPE(...)`                          | pemeriksaan `jsonb_typeof(...)` / guard `?` operator sesuai kasus v6 |

[Files]
Perbaikan tersebar pada 4 area: migrator, engine/helper survival, plugin & dashboard yang menulis model ber-cache, serta event handler dengan interval.

**File baru:**

- `src/managers/dbMigrator.test.js` — test `node:test` statis: (a) setiap entri `MIGRATIONS` wajib punya `pgSql` non-kosong; (b) `pgSql` tidak mengandung token terlarang dialek MySQL (`ENGINE=InnoDB`, `AUTO_INCREMENT`, `TINYINT(`, `MODIFY COLUMN`, `UNIQUE KEY`, `INSERT IGNORE`); (c) fungsi pemecah multi-statement menghasilkan statement valid.

**File dimodifikasi — KRITIS (migrasi PostgreSQL):**

- `src/managers/dbMigrator.js`
  - Tambahkan `pgSql` untuk migrasi v1–v33 (translasi sesuai tabel [Types]).
  - Tambahkan helper internal `splitStatements(sql)` yang memecah string multi-statement pada `;` di luar kutip, karena beberapa migrasi (v24, v32, v33) berisi 2+ statement; eksekusi berurutan per statement.
  - `runMigrations()`: loop per statement hasil `splitStatements(querySql)`.
  - JANGAN mengubah `id` maupun urutan entri mana pun (ledger `schema_migrations` produksi sudah berisi ID lama).
  - Catatan khusus `v6_move_coupons_to_column`: versi `pgSql` harus idempoten secara nilai — gunakan `UPDATE "UserSurvivals" SET coupons = coupons + COALESCE((rpg_state->>'coupons')::integer, 0), rpg_state = rpg_state - 'coupons' WHERE rpg_state ? 'coupons' AND jsonb_typeof(rpg_state->'coupons') IN ('number');` (sesuaikan tipe kolom `rpg_state` json vs jsonb saat implementasi; verifikasi dulu tipe aktual di Supabase).

**File dimodifikasi — KRITIS (bare `.save()` → `fields` eksplisit + invalidasi cache):**
Pola perbaikan seragam: tambahkan `{ fields: [...hanya kolom yang dimutasi...] }`, panggil `.changed(kol, true)` untuk kolom JSON yang objeknya diganti referensi, dan panggil invalidasi cache (`cacheManager.invalidateUserProfile(userId)` / `invalidateUserSurvival(userId)` — verifikasi nama metode aktual di `cacheManager.js` saat implementasi) setelah save berhasil:

- `src/survival/engines/duelEngine.js` — `p1Survival.save()` / `p2Survival.save()` → `fields: ["stamina", "hp", "rpg_state"]` sesuai kolom yang benar-benar dimutasi di fungsi tersebut.
- `src/survival/engines/worldBossEngine.js` — `dbBoss.save()` → `fields` kolom boss yang dimutasi.
- `src/survival/engines/questGenerator.js`, `src/survival/engines/petHabitatEngine.js`, `src/survival/engines/guildHallEngine.js`, `src/survival/engines/dungeonRewards.js`, `src/survival/engines/coliseumEngine.js`, `src/survival/engines/cafeEngine.js` — `quest.save()`, `pet.save()`, `clan.save()`, `team.save()`, `teamRecord.save()`, `cafe.save()`, `sellerCafe.save()` → `fields` eksplisit.
- `src/services/predictionEngine.js`, `src/services/stockMarketEngine.js`, `src/services/territoryWarEngine.js`, `src/services/onboardingWizard.js` — save di dalam transaksi juga diberi `fields`.
- `src/premium/premiumStore.js`, `src/premium/premiumRedeem.js`, `src/services/minecraftBridge.js`, `src/services/capsuleService.js` — `voucher.save()`, `link.save()`, `capsule.save()` → `fields`.
- `src/managers/cronManager.js` — `record.save()`, `guildData.save()` → `fields`.
- `src/managers/rssManager.js` — `alert.save()` → `fields`.
- `src/interactions/buttons/cardBattle.js`, `cardTrade.js`, `modmail.js`, `ticketClose.js` — `wDeck/lDeck/deck.save()`, `ticket.save()` → `fields`.
- `src/events/messageCreate/globalChat.js`, `staffReply.js` — `friendship.save()`, `thread.save()` → `fields`.
- `src/events/ready/dailyReminder.js`, `modmailCleanup.js` — `profile.save()`, `ticket.save()` → `fields`.
- `src/card/cardEngine.js` — `mainCard.save()`, `card.save()` → `fields`.
- `src/ai/personaEngine.js` — `persona.save()` → `fields`.
- `plugin/modmail/modmail.js`, `plugin/utility/banner.js`, `birthday.js`, `cosmetic.js`, `room.js` — → `fields`.
- `plugin/survival/subcommands/auction.js`, `achievements.js`, `clan.js` (7 lokasi), `class.js`, `date.js`, `heist.js`, `house.js`, `gallery.js`, `pet.js`, `quest.js`, `rebirth.js`, `expedition.js`, `story.js`, `travel.js`, `work.js` — semua `survival.save()` / `profile.save()` / `npc.save()` / `quest.save()` / `pet.save()` / `auction.save()` telanjang → `fields` eksplisit + invalidasi cache.
- `plugin/minigames/minigame.js` — `profile.save()` telanjang (4 lokasi) → `fields` kolom skor spesifik.
- `plugin/music/music.js`, `soundboard.js`, `trivia-music.js` — `guildData.save()`, `settings.save()`, `userLevel.save()` → `fields` (lihat juga area GuildSettings di bawah).
- `plugin/card/card.js` — `userDeck.save()`, `card.save()` → `fields`.
- `plugin/admin/setup.js` — `settingsRecord.save()` → `save({ fields: ["settings"] })`.
- `dashboard/routes/guild.js`, `dashboard/routes/user.js` — `model.save()`, `mutator.save()` telanjang → `fields`.
- `dashboard/utils/voteRewards.js` — `userAch.save()` → `fields`.

**File dimodifikasi — KRITIS (read-modify-write numerik):**

- `src/survival/helpers/npcActions.js` — ganti `survival.starFragments -= GIFT_COST; await survival.save({fields:["starFragments"]})` (dan pola serupa REPAIR_COST) dengan `const ok = await cacheManager.debitUserSurvival(user.id, "starFragments", GIFT_COST); if (!ok) { /* balas saldo kurang */ }`. Urutan hadiah tetap: tulis barang dulu, potong biaya belakangan.
- `src/survival/helpers/specialEffects.js`, `marketStock.js`, `shopPurchase.js` — verifikasi tidak ada pola `-=` lain pada kolom numerik; jika ada, terapkan pola debit atomik yang sama.
- `src/interactions/buttons/cardTrade.js` — sudah memakai `fields` di dalam transaksi; biarkan, hanya pastikan tidak membaca saldo awal sebagai dasar penulisan.

**File dimodifikasi — SEDANG (`setInterval` tanpa `.unref()`):**

- `src/managers/rssManager.js` — simpan handle, `if (t.unref) t.unref()`.
- `src/managers/clusterManager.js` — idem.
- `src/events/ready/tempVoiceCleanup.js`, `presenceRotation.js`, `modmailCleanup.js`, `dailyReminder.js` — idem.
- `src/canvas/CanvasUtils.js` — idem.
- `src/music/MusicUIManager.js` — interval per-player: pastikan `clearInterval` di semua jalur akhir track/destroy player; tambahkan `unref` sebagai pengaman.
- `src/music/poru_events/autoplayUtils.js` — `_fadeInterval` / `_endWatcher`: verifikasi dibersihkan pada `trackEnd`/`playerDestroy`; tambahkan `unref`.

**File dimodifikasi — SEDANG (penulisan GuildSettings lewat service):**

- `plugin/admin/automod.js`, `autorole.js`, `sticky.js`, `qotd.js`, `setup.js`
- `plugin/ai/subcommands/settings.js`
- `plugin/music/music.js`, `soundboard.js`, `trivia-music.js`
- `plugin/utility/notification.js`
- `dashboard/routes/guild.js`
  Pola: ganti `settings.changed("settings", true); await settings.save(); cacheManager.invalidateGuildSettings(id)` dengan `guildSettingsService.updateGuildSetting(guildId, (current) => { ...mutasi salinan... return next; })` (verifikasi signature aktual di `guildSettingsService.js`). Bila sebuah handler butuh instance model untuk hal lain, minimal pertahankan `changed()` + `fields: ["settings"]` + invalidasi — jangan pernah save telanjang.

**File dimodifikasi — MINOR:**

- `src/managers/logger.js` — ambil `NODE_ENV`/`DEBUG` dari `require("../config/env")`.
- `scripts/migrate.js` — baca `SKIP_DB_MIGRATE` via `env.js` (tambahkan ekspor `SKIP_DB_MIGRATE` di `env.js` bila belum ada).
- `dashboard/middleware/auth.js` — fallback `process.env.OWNER_ID` dipindah menjadi field resmi di `env.js` (mis. `OWNER_IDS_SINGLE`), lalu diimpor.
- `plugin/minigames/akinator.js` — biarkan `NODE_EXTRA_CA_CERTS` (bootstrap sebelum env siap) tapi tambahkan komentar pengecualian yang merujuk Rule 1.3 #4.
- `src/managers/dbMigrator.js` (`syncFallbackToMySQL`) — ganti `record.update(row)` dengan `record.update(row, { fields: Object.keys(row).filter((k) => ![pk, "createdAt", "updatedAt"].includes(k)) })` agar recovery tidak menimpa kolom di luar snapshot.

[Functions]
Tujuan: tidak ada signature publik yang berubah; perubahan bersifat internal pada badan fungsi dan penambahan helper migrator.

**Fungsi baru:**

- `splitStatements(sql: string): string[]` — di `src/managers/dbMigrator.js`. Memecah SQL multi-statement pada titik koma di luar string terkutip (single/double quote) agar aman untuk `sequelize.query()` PostgreSQL. Tidak diekspor kecuali untuk test.

**Fungsi dimodifikasi:**

- `runMigrations(sequelize)` — `src/managers/dbMigrator.js`: eksekusi per-statement hasil `splitStatements`; logika ledger, urutan, dan error handling tidak berubah.
- Semua fungsi `execute()` plugin dan helper yang tercantum di bagian [Files]: badan fungsi disesuaikan (tambah `fields`, ganti debit atomik, ganti jalur tulis GuildSettings); nama, parameter, dan nilai balik tidak berubah.
- `syncFallbackToMySQL(mysqlSequelize)` — batasi kolom update seperti dijelaskan.

**Fungsi dihapus:** tidak ada.

[Classes]
Tidak ada class baru maupun penghapusan class.

**Class dimodifikasi:**

- `CacheManager` (`src/managers/cacheManager.js`) — tidak diubah kecuali bila verifikasi menunjukkan belum ada metode invalidasi per-user (`invalidateUserProfile` / `invalidateUserSurvival`); bila belum ada, tambahkan dua metode tipis tersebut (hapus key `cache:user:*` terkait + siarkan Pub/Sub `cache:invalidate`) mengikuti pola `invalidateGuildSettings` yang sudah ada.
- `GuildSettingsService` (`src/managers/guildSettingsService.js`) — hanya diverifikasi; tidak diubah kecuali signature `updateGuildSetting` ternyata tidak menutup kebutuhan mutasi berbasis callback, maka tambahkan overload callback yang aman.

[Dependencies]
Tidak ada dependensi baru, peningkatan versi, atau penghapusan paket. Semua perbaikan memakai modul yang sudah ada (`node:test`, sequelize, cacheManager, guildSettingsService).

[Testing]
Validasi berlapis: lint, test unit baru, test suite yang sudah ada, dan smoke test migrasi terhadap PostgreSQL lokal.

- **Test baru** `src/managers/dbMigrator.test.js` (`node:test`):
  1. Setiap `MIGRATIONS[i].pgSql` ada dan non-kosong.
  2. Tidak ada token MySQL terlarang di `pgSql` manapun.
  3. `splitStatements()` memecah contoh multi-statement v32/v33 dengan benar dan tidak memecah di dalam string terkutip.
- **Test yang sudah ada**: `npm test` (seluruh suite `node:test`), `npm run test:requires`, `npm run lint`, `npm run format:check`, `npm run locales:check:strict` — semuanya wajib hijau.
- **Smoke test migrasi**: jalankan `docker-compose up -d` (layanan PostgreSQL di compose) atau gunakan `DATABASE_URL` Supabase staging, lalu `npm run db:migrate` terhadap database kosong; wajib selesai tanpa error dan `schema_migrations` berisi 34 baris. Ulangi sekali lagi untuk memastikan idempoten ("tidak ada migrasi tertunda").
- **Regression manual minimal**: `/survival clan join`, `/survival travel`, duel, dan satu alur admin `/setup` — memastikan tidak ada perubahan perilaku yang terlihat user.

[Implementation Order]
Urutan dirancang agar perubahan paling berisiko (migrasi) diverifikasi lebih dulu, dan perubahan mekanis luas (fields) dilakukan setelah fondasi aman.

1. Tambahkan `splitStatements()` + lengkapi `pgSql` v1–v33 di `dbMigrator.js` (termasuk versi aman v6), tanpa mengubah `id`/urutan.
2. Buat `dbMigrator.test.js`; jalankan `npm test` sampai hijau.
3. Smoke test `npm run db:migrate` terhadap PostgreSQL lokal/kosong (dua kali, cek idempoten).
4. Perbaiki `setInterval` tanpa `.unref()` (8 file, perubahan kecil dan independen).
5. Perbaiki read-modify-write numerik di `npcActions.js` (dan temuan serupa) memakai `debitUserSurvival()`.
6. Remediasi bare `.save()` → `fields` + invalidasi cache, per area: (a) `src/survival/engines/*`, (b) `src/services/*`, (c) `src/interactions/*`, (d) `src/events/*`, (e) `plugin/survival/subcommands/*`, (f) sisa plugin + dashboard. Jalankan `npm run lint` + `npm test` setiap sub-tahap.
7. Migrasikan penulisan `GuildSettings` ke `guildSettingsService.updateGuildSetting()` pada daftar plugin/dashboard; pastikan tidak ada double-invalidate yang merusak.
8. Perbaikan minor: akses `process.env` di `logger.js`, `scripts/migrate.js`, `auth.js` (+ tambahan field di `env.js`), komentar pengecualian `akinator.js`, pembatasan `fields` pada `syncFallbackToMySQL()`.
9. Verifikasi akhir: `npm run lint && npm test && npm run test:requires && npm run locales:check:strict` semua hijau, lalu review diff menyeluruh sebelum commit dengan format `<emoji> <tipe>: <deskripsi>` (disarankan pecah menjadi 3 commit: `🐛 fix:` migrasi pg, `🐛 fix:` atomicity/cache, `🔧 chore:` hygiene).
