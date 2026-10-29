# 🛡️ Plugin Admin - Moderasi & Konfigurasi Server

> Direktori ini berisi seluruh slash command kategori **administrasi dan moderasi** untuk Discord server. Semua command di sini memerlukan permission khusus (Administrator, ManageServer, atau role moderator).

## 📋 Daftar Command Utama

| File | Deskripsi | Permission |
|------|-----------|------------|
| `moderation.js` | Sistem moderasi lengkap (ban, kick, mute, timeout) | ModerateMembers |
| `warn.js` | Sistem peringatan bertingkat dengan auto-action | ModerateMembers |
| `setup.js` | Wizard konfigurasi awal server (channel, role, logging) | Administrator |
| `disasterRecovery.js` | Backup & restore data server darurat | Administrator |
| `announce.js` | Pengumuman global dengan embed Components V2 | ManageMessages |
| `giveaway.js` | Sistem giveaway dengan multi-winner & reroll | ManageEvents |
| `lockdown.js` | Lock/unlock channel massal saat krisis | ManageChannels |
| `shield.js` | Auto-moderation & filter konten berbahaya | Administrator |
| `levelrole.js` | Auto-role berdasarkan level pengguna | ManageRoles |
| `reactionrole.js` | Role assignment via reaksi emoji/tombol | ManageRoles |
| `roleShop.js` | Toko role dengan mata uang ekonomi server | ManageRoles |
| `nickname.js` | Kelola nickname pengguna | ManageNicknames |
| `slowmode.js` | Atur rate limit per-channel | ManageChannels |
| `steal-emoji.js` | Salin emoji dari server lain | ManageEmojisAndStickers |
| `sticky.js` | Pesan sticky yang auto-repost di channel | ManageMessages |
| `voicemod.js` | Moderasi voice channel (mute/deafen massal) | ModerateMembers |
| `qotd.js` | Question of the Day otomatis | ManageMessages |
| `report.js` | Sistem pelaporan pengguna ke moderator | - |
| `appeal.js` | Banding hukuman moderasi | - |
| `audit.js` | Audit log aktivitas moderator | ViewAuditLog |
| `modnote.js` | Catatan internal moderator per-pengguna | ModerateMembers |
| `adminCosmetic.js` | Kosmetik admin (badge, title dekoratif) | Administrator |
| `ownerOps.js` | Operasi khusus owner bot (eval, reload, debug) | BotOwnerOnly |

### Subcommands (`subcommands/`)

| File | Deskripsi |
|------|----------|
| `guildBoard.js` | Papan informasi guild & statistik server |
| `treasuryAudit.js` | Audit treasury server & aliran dana |

## 🏗️ Pola Arsitektur

### 1. Guard Clause Permission Check
Setiap command memulai dengan validasi permission sebelum logika utama:
```javascript
if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
  return interaction.reply({ content: t('errors.noPermission'), flags: MessageFlags.Ephemeral });
}
```

### 2. Components V2 Layout
Semua respons UI menggunakan `buildContainerV2()` dari `src/utils/NauraContainerBuilder.js`:
```javascript
const container = buildContainerV2()
  .addHeader(t('moderation.title'))
  .addSeparatorLine()
  .addBody(fields)
  .addActionRow(buttons)
  .addFooter(t('common.footer'));
```

### 3. Atomic Database Operations
Mutasi data moderasi selalu melalui `cacheManager` untuk mencegah race condition:
- `cacheManager.incrementUserProfile()` untuk counter warn
- `cacheManager.mutateUserProfileJson()` untuk array history

### 4. Localization Parity
Setiap string user-facing wajib ada di `assets/language/id.json` dan `en.json`.

## 🔗 Navigasi Terkait

- **Interaction Handlers:** `src/interactions/buttons/`, `src/interactions/modals/`
- **Core Logic:** `src/managers/cacheManager.js`, `src/domain/contracts/`
- **UI Builder:** `src/utils/NauraContainerBuilder.js`
- **Localization:** `assets/language/id.json`, `assets/language/en.json`
- **Rules:** Lihat [`RULES.md`](../../RULES.md) Bagian 1 (Transaksi Atomik) & Bagian 3 (Components V2)
- **AGENTS.md:** Lihat [`AGENTS.md`](../../AGENTS.md) Bagian 4.1 (SOP Menambah Command)

## ⚠️ Peringatan Kritis

1. **Jangan query DB mentah** di plugin - gunakan manager/service layer
2. **Jangan hardcode warna** - ambil dari `designTokens.js` atau `survivalUIHelper.js`
3. **Wrap semua interaksi** dalam `safeExecute()` dari `src/interactions/safeExecute.js`
4. **Gunakan `flags: MessageFlags.Ephemeral`**, bukan `ephemeral: true`
5. **Stop collector lama** dengan alasan `'navigated'` saat berpindah layar UI

---

*Dokumentasi ini ditujukan untuk developer junior. Untuk detail teknis lengkap, baca [`RULES.md`](../../RULES.md) dan [`AGENTS.md`](../../AGENTS.md).*
