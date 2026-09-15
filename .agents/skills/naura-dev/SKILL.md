---
name: naura-dev
description: >-
  Panduan pengembangan, navigasi arsitektur, transaksi atomik, layout Discord Components V2,
  dan tata kelola ekosistem Naura Hoshino V2. Aktifkan saat menulis fitur baru, memodifikasi
  logika ekonomi/survival, menyusun UI bot, atau melakukan maintenance repositori.
---

# 🌸 Panduan Kerja Developer & Skill Manual: Naura Hoshino V2

Skill ini merupakan ringkasan pengetahuan operasional, arsitektur, dan cheatsheet teknis untuk mengembangkan bot Discord multifungsi **Naura Hoshino V2**.

---

## 🧭 1. Mental Model Ekosistem (6 Pilar Utama)

1. **Bot Engine (discord.js v14)**:
   - Sharding & Hybrid Clustering (`shard.js`, `index.js`).
   - Handler modular: `src/interactions/` (buttons, modals, selects, autocomplete).
   - Slash Command router: `plugin/<kategori>/<command>.js`.
2. **Web Dashboard (Vite MPA + Tailwind v4 + Three.js)**:
   - Folder: `dashboard/` (build output: `dashboard/dist`).
   - 3D Model Viewer untuk Avatar Naura PBR (`portfolio.html`, `world.html`).
   - Socket.IO telemetri real-time.
3. **Audio & DJ Companion**:
   - Poru v5 pada Lavalink v4 multi-node cluster dengan prefetch delay 1500ms di `trackStart.js`.
   - Fish Audio API (`/v1/tts`) untuk radio snippet dan voice companion.
4. **Polyglot Database**:
   - **PostgreSQL / Supabase**: Data relasional transaksional (`UserProfile`, `UserSurvival`, `GuildSettings`).
   - **Redis**: Cache cepat (`cache:*`), Pub/Sub invalidasi (`cache:invalidate`), penyangga XP.
   - **MongoDB**: Audit log, riwayat chat AI, transkrip tiket.
   - **SQLite**: Fallback offline otomatis bila cloud terputus.
5. **Survival RPG (Naura Wilds)**:
   - 46 subcommands di `plugin/survival/subcommands/`.
   - Transaksi atomik saldo (Koin, Star Fragments, Kupon).
   - Penguncian baris `SELECT FOR UPDATE` untuk kolom JSON (inventory, rpg_state).
   - Dual-layer RPG: life stats (HP, hunger, thirst, stamina) & combat stats.
6. **Living AI**:
   - Gemini 2.0 Flash (`@google/genai`), AI memory per user, persona system, tribunal court, dan server RAG.

---

## ⚡ 2. Aturan Emas Pengembangan (_Golden Coding Laws_)

### 2.1 Transaksi Saldo Wajib Atomik (Anti-Inflation Guard)

- **DILARANG Read-Modify-Write**:
  ```javascript
  // ❌ SALAH (Race condition, double spend saat double click)
  profile.economy_wallet += 500;
  await profile.save();
  ```
- **WAJIB Operasi Atomik CacheManager**:

  ```javascript
  // ✅ BENAR (Menambah saldo)
  await cacheManager.incrementUserProfile(userId, "economy_wallet", 500);
  await cacheManager.incrementUserSurvival(userId, "starFragments", 100);

  // ✅ BENAR (Memotong saldo dengan validasi kecukupan SQL Op.gte)
  const debitRes = await cacheManager.debitUserSurvival(userId, "coupons", 5);
  if (!debitRes.ok) {
    return { success: false, message: "Saldo Kupon tidak mencukupi!" };
  }
  ```

- **Mutasi Kolom JSON (Inventory / Cooldown)**:
  ```javascript
  // ✅ Gunakan mutateJson dengan baris terkunci
  await cacheManager.mutateUserProfileJson(userId, "inventory", (inv) => {
    // inv adalah salinan terisolasi
    inv.push({ id: "item_xyz", amount: 1 });
    return inv; // kembalikan null untuk membatalkan transaksi
  });
  ```

### 2.2 Discord UI: Wajib Components V2 (5-Lapisan)

Semua respons bot wajib menggunakan `buildContainerV2()` dari `src/utils/NauraContainerBuilder.js`:

```javascript
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");

const payload = buildContainerV2({
  accentColorHex: ui.getColor("primary") || "#FFB6C1",
  authorName: "Naura Hoshino System",
  title: `${ui.getEmoji("core") || "🌸"} Judul Container`,
  description: "Konten deskripsi utama pesan di sini.",
  footerText: ui.getFooter("core"),
  // opsional: buttonsRow, selectMenu, expression, withBanner
});

await interaction.reply(payload);
```

- Custom emoji Discord (`<:name:id>`) dilarang di `authorName` dan `footerText` (otomatis disanitasi).
- Selalu gunakan `MessageFlags.Ephemeral` (bukan `ephemeral: true`).

### 2.3 Lingkungan & Konfigurasi

- **Dilarang memanggil `process.env.*` langsung di plugin atau manager**. Selalu impor `{ env }` dari `src/config/env.js`.
- Versi Node.js wajib `>= 24.0.0`.
- Karakter em dash (`\u2014`) dilarang keras di seluruh berkas dan file bahasa JSON. Gunakan tanda minus `-` biasa.

### 2.4 Standarisasi Penomoran Versi (X.Y.Z)

Seluruh ekosistem, package.json, dan suite dokumentasi wajib mematuhi standar tiga tingkat:
- **`X` (Versi Keseluruhan / Era Naura):** Generasi platform Naura (saat ini bernilai `2` untuk era Naura Hoshino V2).
- **`Y` (Major Update):** Pembaruan arsitektur besar, penambahan pilar baru, sistem moneter baru (seperti Currency V2 Closed-Loop), integrasi AI Ensemble, atau kluster audio Lavalink.
- **`Z` (Minor Update):** Peningkatan berkala, optimasi, balancing RPG/ekonomi, atau perbaikan bug (bugfix).

---

## 🛠️ 3. Panduan Perintah CLI di Windows

Karena sistem operasi menggunakan Windows PowerShell dengan pembatasan skrip:

- **Jalankan npm via CMD wrapper**:
  ```powershell
  npm.cmd run lint
  npx.cmd eslint .
  npx.cmd prettier --write .
  ```
- **Menjalankan Unit Test**:
  ```powershell
  node --test "src/**/*.test.js"
  node --test src/services/seasonEngine.test.js
  ```
- **Checklist QA Gate Sebelum Commit**:

  ```powershell
  # 1. Linter
  npm.cmd run lint

  # 2. Em dash check
  node scripts/check-em-dash.js

  # 3. Paritas kamus bahasa ID & EN
  node scripts/validate-locales.js --strict

  # 4. Resolusi internal require
  node scripts/check-requires.js

  # 5. Automated test suite (254 tests wajib 100% lulus)
  node --test "src/**/*.test.js"
  ```

  Semua 5 pengujian di atas wajib berstatus hijau (0 error).

---

## 🔍 4. Peta Cepat Pencarian Kode

| Ingin Mengubah Apa?                             | Buka Berkas Mana?                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Drop rate, loot monster, item catalog           | `src/survival/data/items_catalog.js`, `items.js`, `monsters.js`                                                   |
| Formula XP, stamina, vitals                     | `src/survival/helpers/survivalVitals.js`, `src/survival/engines/survivalLeveling.js`                              |
| Currency V2, Recycling Pool & Server Treasury   | `src/survival/engines/currency.js`, `src/survival/engines/recyclingPoolEngine.js`, `src/models/ServerTreasury.js` |
| Durability & Repair Surcharge                   | `src/survival/engines/durabilityEngine.js`                                                                        |
| Aturan pasar saham & dynamic tax                | `src/services/stockMarketEngine.js`, `src/services/economyGuardEngine.js`                                         |
| AI Multi-Model Ensemble Router & LLM Failover   | `src/ai/aiEnsembleRouter.js`, `src/ai/aiHelper.js`                                                                |
| Living AI Semantic Vector Memory & Server RAG   | `src/ai/semanticMemoryService.js`, `src/ai/aiMemory.js`, `src/models/SemanticMemory.js`                          |
| Lavalink Cluster Manager & Multi-Node Failover  | `src/managers/lavalinkClusterManager.js`, `src/managers/musicManager.js`                                          |
| Web Soundboard Studio & WebSocket Realtime      | `src/services/soundboardService.js`, `dashboard/src/pages/soundboard.html`                                        |
| Battle Pass Season Rewards                      | `src/services/seasonEngine.js`                                                                                    |
| World Boss multi-fase & rewards                 | `src/survival/engines/worldBossEngine.js`                                                                         |
| Living City NPC & Town Square Simulation        | `src/survival/engines/townEngine.js`, `plugin/survival/subcommands/town.js`                                       |
| Skema database PostgreSQL & 41 Migrasi          | `src/models/*.js` & migrasi di `src/managers/dbMigrator.js`                                                       |
| Token warna & styling Discord                   | `src/config/ui.js`, `src/utils/survivalUIHelper.js`                                                               |
| Terjemahan bahasa bot                           | `assets/language/id.json` dan `en.json` (wajib sinkron)                                                           |
