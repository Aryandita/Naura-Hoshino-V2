# 🎵 Lavalink Cluster Modules - Naura Hoshino V2

> **Untuk Junior Developer:** Folder ini berisi modul-modular yang mengelola kluster audio Lavalink. Sistem ini memastikan musik tetap bermain tanpa putus bahkan saat server mengalami masalah.

## 📚 Apa itu Lavalink Cluster?

Lavalink adalah server audio standalone yang digunakan Discord bot untuk memutar musik. "Cluster" berarti kita menggunakan beberapa server Lavalink sekaligus untuk:
- **Redundansi**: Jika satu server mati, yang lain mengambil alih
- **Load Balancing**: Beban dibagi merata antar server
- **Kualitas Audio**: Server khusus untuk audio HD/lossless

## 🗂️ Struktur Modul

### 1. `circuitBreaker.js` - Pelindung Otomatis

**Analogi Sederhana:** Seperti sekring listrik di rumah. Jika ada korsleting (error berulang), sekring otomatis memutus arus untuk mencegah kerusakan lebih lanjut.

**Fungsi Utama:**
- Memantau error pada setiap node Lavalink
- Mengisolasi node bermasalah selama 5 menit (quarantine)
- Menguji apakah node sudah pulih sebelum mengizinkan traffic lagi

**State Machine:**
```
CLOSED (normal) → OPEN (karantina) → HALF_OPEN (testing) → CLOSED atau OPEN
```

**Contoh Penggunaan:**
```javascript
const { CircuitBreakerManager } = require('./circuitBreaker');

const cb = new CircuitBreakerManager();

// Catat error
cb.recordNodeError('node-1', new Error('Connection timeout'));

// Cek apakah node boleh dipakai
if (!cb.isNodeQuarantined('node-1')) {
  // Aman untuk menggunakan node ini
}
```

---

### 2. `nodeSelector.js` - Pemilihan Server Cerdas

**Analogi Sederhana:** Seperti memilih jalur tol tercepat saat bepergian. Sistem melihat kemacetan (latency), jarak (region), dan fasilitas (capability) untuk memilih rute terbaik.

**Fungsi Utama:**
- Mengelompokkan node berdasarkan prioritas (Tier 1 > 2 > 3)
- Memilih node dengan latency terendah
- Mendeteksi kemampuan node (YouTube, Spotify, LavaSrc plugin)
- Mengelola node Hi-Fi untuk audio lossless

**Tier System:**
```
Tier 1: Private Node Utama     (paling cepat, paling stabil)
Tier 2: Private Node Cadangan  (backup jika Tier 1 down)
Tier 3: Public Fallback Pool   (server publik sebagai last resort)
```

**Contoh Penggunaan:**
```javascript
const { NodeSelector } = require('./nodeSelector');
const { CircuitBreakerManager } = require('./circuitBreaker');

const cb = new CircuitBreakerManager();
const selector = new NodeSelector(cb);

// Pilih node terbaik
const bestNode = selector.getPreferredNode(poruInstance, {
  requireLavaSrc: true,  // Butuh Spotify support
  region: 'singapore',   // Preferensi region
});
```

---

### 3. `playerMigrator.js` - Migrasi Tanpa Putus

**Analogi Sederhana:** Seperti pindah kereta di stasiun tanpa turun dari peron. Penumpang (audio stream) dipindahkan mulus dari kereta rusak ke kereta baru tanpa merasakan gangguan.

**Fungsi Utama:**
- Memindahkan sesi audio aktif ke node sehat saat node lama gagal
- Menyimpan posisi lagu tepat di milidetik terakhir
- Mempertahankan antrian lagu, volume, dan mode loop
- Mencegah duplikasi migrasi untuk guild yang sama

**Dual-Path Strategy:**
```
Path 1: moveNode API    → Zero-drop (tanpa putus suara, preferred)
Path 2: Reconnect       → Destroy + create new (fallback jika Path 1 gagal)
```

**Contoh Penggunaan:**
```javascript
const { PlayerMigrator } = require('./playerMigrator');
const { NodeSelector } = require('./nodeSelector');

const selector = new NodeSelector(cb);
const migrator = new PlayerMigrator(selector);

// Saat node disconnect
await migrator.migratePlayer(poru, player, failedNode, 'Node disconnect');
```

---

## 🔍 Konsep Kunci

### 1. Circuit Breaker Pattern

Pattern ini mencegah sistem terus-menerus mencoba node yang sedang bermasalah:

```javascript
// Normal operation (CLOSED)
cb.recordNodeSuccess('node-1');  // Reset counter

// Error terjadi
cb.recordNodeError('node-1', error);  // failures++

// Jika 3 error dalam 30 detik → OPEN (quarantine 5 menit)
// Setelah 5 menit → HALF_OPEN (test 1 request)
// Jika sukses → CLOSED, jika gagal → OPEN lagi
```

### 2. Tiered Selection Algorithm

Prioritas pemilihan node:
1. **Filter**: Hanya node connected & tidak di-quarantine
2. **Group**: Kelompokkan berdasarkan tier (1, 2, 3)
3. **Sort**: Urutkan berdasarkan:
   - Capability (LavaSrc jika dibutuhkan)
   - Latency (RTT terendah)
   - Region match (bonus -40ms penalty)
   - Load penalties
4. **Select**: Ambil node pertama dari tier tertinggi yang tersedia

### 3. Zero-Drop Migration

Teknik memindahkan audio tanpa henti:
- **Snapshot**: Simpan state player (track, position, queue, volume)
- **moveNode**: Poru API untuk pindah node tanpa disconnect voice
- **Fallback**: Jika moveNode gagal, destroy + reconnect manual
- **Restore**: Resume playback di posisi exact yang sama

---

## 🛠️ Konfigurasi

### Circuit Breaker Config (`CB_CONFIG`)
```javascript
{
  ERROR_THRESHOLD: 3,      // Max error sebelum quarantine
  WINDOW_MS: 30000,        // Window waktu (30 detik)
  QUARANTINE_MS: 300000,   // Durasi quarantine (5 menit)
}
```

### Node Tiers (`NODE_TIERS`)
```javascript
{
  PRIMARY: 1,    // Private utama
  SECONDARY: 2,  // Private backup
  FALLBACK: 3,   // Public pool
}
```

### Latency Thresholds (`LATENCY_THRESHOLDS`)
```javascript
{
  EXCELLENT: 100,  // < 100ms
  GOOD: 200,       // < 200ms
  FAIR: 450,       // < 450ms (threshold warning)
  POOR: Infinity,  // > 450ms
}
```

---

## 📊 Monitoring & Debugging

### Check Circuit Breaker State
```javascript
const state = cb.getState('node-1');
console.log(state);
// { state: 'OPEN', failures: 3, quarantineUntil: 1698765432000 }
```

### Manual Reset
```javascript
cb.reset('node-1');  // Force back to CLOSED state
```

### Check Node Capabilities
```javascript
const caps = selector.getCapabilities('node-1');
console.log(caps);
// { version: '4.0.0', hasLavaSrc: true, hasYoutube: true, ... }
```

---

## ⚠️ Common Issues & Solutions

### Issue: Semua node masuk quarantine
**Solution:** Check network connectivity atau restart Lavalink servers

### Issue: Audio putus saat migrasi
**Solution:** Pastikan Poru mendukung moveNode API, atau check log untuk fallback reconnect

### Issue: Node selection selalu pilih Tier 3
**Solution:** Check apakah Tier 1/2 nodes connected dan tidak di-quarantine

---

## 🔗 Related Files

- [`../lavalinkClusterManager.js`](../lavalinkClusterManager.js) - Main orchestrator (uses these modules)
- [`../../utils/loggerBanner.js`](../../utils/loggerBanner.js) - Colored logging utility
- [`../../../config/lavalink-fallbacks.json`](../../../config/lavalink-fallbacks.json) - Public node config

---

**Last Updated:** 2026-10-26  
**Maintained By:** Naura Dev Team  
**Version:** 2.4.0
