# 🏛️ Core System - Naura Hoshino V2

> **Untuk Junior Developer:** Folder ini adalah fondasi utama bot Naura Hoshino. Mulailah dari sini untuk memahami arsitektur dasar sebelum mempelajari fitur-fitur lainnya.

## 📚 Apa itu Core System?

Core System adalah "jantung" dari bot yang mengatur:
- **Service Container**: Tempat menyimpan dan mengakses layanan (seperti database, cache, manager)
- **Event Bus**: Sistem komunikasi antar-modul (seperti radio untuk mengirim pesan)
- **Help View**: Tampilan menu bantuan yang Anda lihat saat mengetik `/help`

## 🗂️ File-file Utama

### 1. `container.js` - Service Container (IoC Registry)

**Analogi Sederhana:** Bayangkan container seperti lemari penyimpanan dengan label. Daripada membuat ulang alat setiap kali butuh, kita simpan di lemari dan ambil saat diperlukan.

**Fungsi Utama:**
- Menyimpan layanan (database, cache, manager) dalam satu tempat terpusat
- Memastikan hanya ada satu instance layanan (singleton pattern)
- Mencegah ketergantungan melingkar (circular dependency)

**Contoh Penggunaan:**
```javascript
// ❌ SALAH: Membuat instance baru setiap kali
const dbManager = new DbManager();
const cacheManager = new CacheManager(dbManager);

// ✅ BENAR: Ambil dari container (sudah dibuat sekali, dipakai bersama)
const dbManager = container.resolve('dbManager');
const cacheManager = container.resolve('cacheManager');
```

**Kapan Membaca File Ini:** Saat ingin memahami bagaimana bot mengelola koneksi database, cache Redis, atau layanan lainnya.

**Tingkat Kesulitan:** ⭐⭐ (Mudah dipahami dengan komentar lengkap)

---

### 2. `eventBus.js` - Event Mediator (Two-tier System)

**Analogi Sederhana:** Seperti sistem pengumuman di sekolah:
- **Tier 1 (Lokal)**: Pengumuman di kelas tertentu (cepat, hanya untuk murid di kelas itu)
- **Tier 2 (Redis)**: Pengumuman lewat speaker sekolah (sampai ke semua kelas, tapi lebih lambat)

**Fungsi Utama:**
- Mengirim event antar-modul tanpa mereka saling kenal langsung (decoupling)
- Sinkronisasi event antar-shard (jika bot berjalan di multiple processes)
- Mencegah echo loop (pesan tidak berputar terus-menerus)

**Contoh Penggunaan:**
```javascript
// Module A: Kirim event
eventBus.emit('user:levelUp', { userId: '123', newLevel: 5 });

// Module B: Dengarkan event (tidak perlu tahu siapa yang kirim)
eventBus.on('user:levelUp', (data) => {
  console.log(`User ${data.userId} naik ke level ${data.newLevel}`);
});

// Broadcast ke semua shard (jika bot multi-process)
eventBus.broadcast('system:shutdown', { reason: 'maintenance' });
```

**Kapan Membaca File Ini:** Saat ingin memahami bagaimana modul berbeda berkomunikasi (misal: leveling system memberitahu profile card untuk update).

**Tingkat Kesulitan:** ⭐⭐⭐ (Perlu pemahaman tentang EventEmitter dan async)

---

### 3. `helpView.js` - Help System UI Builder

**Analogi Sederhana:** Seperti buku panduan interaktif dengan menu dropdown dan tombol navigasi.

**Fungsi Utama:**
- Membangun tampilan menu bantuan `/help` dengan Components V2 Discord
- Menampilkan 13 kategori perintah (music, survival, AI, dll)
- Pagination untuk command list yang panjang
- Quick-start guide untuk user baru

**Struktur Kompleks:** File ini cukup besar (641 baris) karena menangani:
- Multi-language support (Indonesia/English)
- Dynamic category loading dari command registry
- Banner image attachment
- Button navigation state management

**Kapan Membaca File Ini:** Saat ingin mengubah tampilan help menu, menambah kategori baru, atau memperbaiki bug di pagination.

**Tingkat Kesulitan:** ⭐⭐⭐⭐ (Kompleks, banyak conditional logic dan Discord.js specifics)

**⚠️ Catatan untuk Refactoring:** File ini akan mengalami perbaikan besar-besaran untuk meningkatkan keterbacaan. Lihat section "Planned Improvements" di bawah.

---

## 🔍 Konsep Kunci untuk Dipahami

### 1. Inversion of Control (IoC)

**Tanpa IoC:**
```javascript
// Setiap module membuat dependency sendiri
class MusicCommand {
  constructor() {
    this.dbManager = new DbManager(); // Tight coupling
    this.cacheManager = new CacheManager(this.dbManager);
  }
}
```

**Dengan IoC (Container):**
```javascript
// Module minta dependency dari container
class MusicCommand {
  constructor(container) {
    this.dbManager = container.resolve('dbManager'); // Loose coupling
    this.cacheManager = container.resolve('cacheManager');
  }
}
```

**Kenapa Penting?** Memudahkan testing (bisa inject mock) dan maintenance (ganti implementasi tanpa ubah semua module).

### 2. Event-Driven Architecture

**Tanpa Events:**
```javascript
// Module A harus tahu Module B secara langsung
class LevelingSystem {
  onLevelUp(userId) {
    const profileCard = new ProfileCardGenerator(); // Direct dependency
    profileCard.update(userId);
  }
}
```

**Dengan Events:**
```javascript
// Module A broadcast event, siapa saja bisa dengar
class LevelingSystem {
  onLevelUp(userId) {
    eventBus.emit('user:levelUp', { userId }); // Decoupled
  }
}

// Module B independently listen
class ProfileCardGenerator {
  constructor() {
    eventBus.on('user:levelUp', (data) => this.update(data.userId));
  }
}
```

**Kenapa Penting?** Module tidak saling tergantung, mudah menambah fitur baru tanpa ubah kode existing.

### 3. Components V2 (Discord Modern UI)

Format pesan modern Discord berbasis container 5-lapisan:
```
┌─────────────────────────────┐
│ Header (Title + Author)     │ ← Type 10
├─────────────────────────────┤
│ Separator Line              │ ← Type 14
├─────────────────────────────┤
│ Content / Fields            │ ← Type 10
├─────────────────────────────┤
│ Buttons / Select Menu       │ ← ActionRow
├─────────────────────────────┤
│ Footer                      │ ← Type 10
└─────────────────────────────┘
```

**Kenapa Penting?** Semua UI bot menggunakan format ini. Pahami strukturnya sebelum modifikasi tampilan apa pun.

---

## 🛠️ Planned Improvements (Refactoring Queue)

### helpView.js - Priority: HIGH

**Masalah Saat Ini:**
- Fungsi `buildHelpPayload()` memiliki parameter overloading yang membingungkan
- Banyak magic numbers (angka tanpa penjelasan)
- Variable naming ambigu (`e()`, `langInput`, `clientOrIndex`)
- Nested conditionals terlalu dalam (4 level)

**Rencana Perbaikan:**
1. ✅ Rename `e()` → `getEmojiWithFallback()`
2. ✅ Extract magic numbers ke named constants
3. ✅ Refactor parameter overloading ke options object
4. ✅ Flatten nested conditionals dengan guard clauses
5. ✅ Add comprehensive JSDoc dengan @type hints
6. ✅ Break down fungsi besar menjadi sub-functions

**Estimated Time:** 6-8 hours

### eventBus.js - Priority: MEDIUM

**Masalah Saat Ini:**
- Silent error handling (`catch (_) {}`) menyulitkan debugging
- Magic number untuk maxListeners
- Kurang detail pada packet structure documentation

**Rencana Perbaikan:**
1. ✅ Replace silent catches dengan conditional debug logging
2. ✅ Extract `DEFAULT_MAX_LISTENERS = 100` constant
3. ✅ Document Redis packet structure dengan TypeScript-style interface
4. ✅ Add @type JSDoc pada emit() options parameter

**Estimated Time:** 1.5 hours

### container.js - Priority: LOW

**Masalah Saat Ini:**
- Self-referential pattern (`container.container = container`) perlu penjelasan
- Validation logic duplicated di beberapa methods

**Rencana Perbaikan:**
1. ✅ Add block comment explaining global runtime pattern
2. ✅ Extract validation helper `_validateName(name)`
3. ✅ Add type hints pada Map/Set properties

**Estimated Time:** 1 hour

---

## 🧪 Testing Strategy

Semua file core memiliki test coverage lengkap:
- `container.test.js` - 15+ test cases termasuk edge cases
- `eventBus.test.js` - Mock Redis integration tests
- `helpView.test.js` - UI rendering validation

**Sebelum Refactoring:**
```bash
npm run test -- src/core/
```

**Setelah Refactoring:**
```bash
npm run qa  # Full quality gate (lint + test + locale check)
```

---

## 📖 Further Reading

- **Architecture Overview**: [`../../AGENTS.md`](../../AGENTS.md) - Section 1 (Mental Model)
- **Coding Standards**: [`../../RULES.md`](../../RULES.md) - Technical constitution
- **UI Design Guide**: [`../../DESIGN.md`](../../DESIGN.md) - Components V2 layout engineering
- **Product Requirements**: [`../../PRD.md`](../../PRD.md) - Feature specifications

---

## 💡 Tips untuk Junior Developer

1. **Mulai dari container.js** - Contoh terbaik dari clean code dengan dokumentasi lengkap
2. **Jangan takut bertanya** - Jika ada konsep yang belum jelas, tanyakan di Discord community
3. **Gunakan debugger** - Set breakpoint di VS Code untuk trace alur eksekusi
4. **Baca test files** - Test cases menunjukkan expected behavior dan edge cases
5. **Experiment safely** - Buat branch baru sebelum mencoba perubahan

---

**Last Updated:** 2026-10-25  
**Maintained By:** Naura Dev Team  
**Version:** 2.4.0
