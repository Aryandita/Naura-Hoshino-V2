# Laporan Teknis: Node Lavalink Hyperion dan Yt Cipher

Status: BELUM TERSELESAIKAN
Tanggal probe: 2026-11-01
Disusun untuk: pemilik node `hyperion.kythia.xyz`
Disusun oleh: operator Naura Hoshino V2

---

## 1. Ringkasan

Node Hyperion sehat dan pencarian YouTube berfungsi lewat `ytsearch`. Namun ada tiga
masalah yang membuat bot musik tidak bisa memanfaatkannya secara penuh:

1. `ytmsearch` mengembalikan hasil kosong di node ini.
2. Service Yt Cipher berjalan tetapi belum pernah menerima satu pun permintaan.
3. `scsearch` gagal di node ini dan juga di node publik lain yang kami pakai.

Tujuan laporan ini adalah meminta konfirmasi konfigurasi, bukan menuduh ada kerusakan.

---

## 2. Data node yang dilaporkan

| Item | Nilai |
| --- | --- |
| Host | `hyperion.kythia.xyz` |
| Port Lavalink | `3010` |
| Versi saat dilaporkan | Lavalink v4.2.1 |
| Versi saat diprobe | Lavalink v4.2.2 |
| Secure | false |
| Port Yt Cipher | `3040` |
| Versi Yt Cipher | 2.0.0 |

Kredensial node dan cipher sengaja tidak dicantumkan di dokumen ini. Bagian yang
memerlukan password ditandai `[REDACTED]`.

Plugin yang terbaca dari `/v4/info`:

- lavasearch-plugin 1.0.0
- lavalyrics-plugin 1.1.0
- sponsorblock-plugin 3.0.1
- youtube-plugin 1.18.1
- DuncteBot-plugin 1.7.0
- lavasrc-plugin 4.8.1

Source manager yang aktif: soundcloud, bandcamp, twitch, vimeo, niconico, youtube,
getyarn.io, clypit, speak, pornhub, reddit, ocremix, tiktok, mixcloud, soundgasm, http.

---

## 3. Temuan

### 3.1 `ytmsearch` mengembalikan hasil kosong

Perintah:

```
GET /v4/loadtracks?identifier=ytmsearch:tulus%20diri
```

Hasil:

```json
{ "loadType": "empty", "data": [] }
```

Diulang dengan query lain (`ytmsearch:lofi hip hop`) dan hasilnya sama, `empty` dengan
nol track.

Sebagai pembanding, node publik lain yang kami pakai mengembalikan 20 hasil untuk
perintah yang identik. Artinya masalah ini spesifik pada node Hyperion, bukan pada query.

Dugaan: client `MUSIC` pada youtube-plugin belum aktif di node ini.

### 3.2 `ytsearch` berfungsi normal

Perintah:

```
GET /v4/loadtracks?identifier=ytsearch:tulus%20diri
```

Hasil:

```json
{
  "loadType": "search",
  "data": [
    {
      "info": {
        "title": "TULUS - Diri (Official Lyric Video)",
        "author": "Tulus",
        "length": 244000,
        "sourceName": "youtube"
      }
    }
  ]
}
```

Total 20 track dikembalikan. Resolve URL YouTube langsung juga berhasil dengan
`loadType: track`, durasi 244000 ms.

Kesimpulan: jalur pencarian dan metadata YouTube di node ini sehat.

### 3.3 Yt Cipher berjalan tetapi tidak pernah dipakai

Hasil `GET http://hyperion.kythia.xyz:3040/health`:

```json
{
  "status": "healthy",
  "version": "2.0.0",
  "workers": { "total": 1, "idle": 1, "busy": 0, "error": 0 }
}
```

Hasil `GET /status`:

```json
{
  "uptime": { "formatted": "4d 1h 36m 34s" },
  "metrics": {
    "requests": { "total": 0, "successful": 0, "failed": 0, "rateLimited": 0 }
  }
}
```

Service menyala lebih dari 4 hari, tetapi `requests.total` bernilai 0. Artinya tidak ada
klien yang tersambung ke cipher tersebut, termasuk Lavalink di node yang sama.

Dugaan: blok `remoteCipher` pada `application.yml` node belum diaktifkan, sehingga
Lavalink tidak pernah memanggil cipher.

### 3.4 Autentikasi Yt Cipher ditolak

Password yang dilaporkan (`[REDACTED]`) kami uji ke endpoint terproteksi
`GET /cache_stats` dengan empat bentuk header berbeda:

| Header | Hasil |
| --- | --- |
| `Authorization: [REDACTED]` | 401 Unauthorized |
| `X-API-Key: [REDACTED]` | 401 Unauthorized |
| `Authorization: Bearer [REDACTED]` | 401 Unauthorized |
| `x-api-key: [REDACTED]` | 401 Unauthorized |

Endpoint `/health`, `/status`, dan `/info` terbuka tanpa autentikasi dan berhasil diakses.
Hanya endpoint API yang menolak.

Catatan: `/info` melaporkan `"authentication": "enabled"`, sehingga penolakan ini wajar.
Yang perlu dikonfirmasi adalah format kredensial yang benar, bukan apakah autentikasi aktif.

### 3.5 `scsearch` gagal di node ini dan di node pembanding

Perintah:

```
GET /v4/loadtracks?identifier=scsearch:tulus%20diri
```

Hasil:

```json
{
  "loadType": "error",
  "data": {
    "message": "Something went wrong while looking up the track.",
    "cause": "java.lang.RuntimeException: Did not detect any supported formats"
  }
}
```

Diuji ulang dengan `scsearch:lofi`, `scsearch:test`, dan URL SoundCloud langsung.
Semuanya `error` dengan cause yang sama.

Node pembanding (GlaceYT, `de-01.strixnodes.com:2010`) juga mengembalikan `error` untuk
`scsearch`. Jadi ini bukan masalah eksklusif Hyperion, melainkan masalah SoundCloud yang
lebih luas pada node yang kami pakai.

---

## 4. Pertanyaan untuk pemilik node

1. Apakah `plugins.youtube.clients` di node ini memuat client `MUSIC`? Jika belum,
   apakah bisa diaktifkan agar `ytmsearch` berfungsi?
2. Apakah blok `remoteCipher` pada `application.yml` Lavalink sudah diarahkan ke
   `http://127.0.0.1:3040` atau `http://hyperion.kythia.xyz:3040`? Jika sudah, mengapa
   `requests.total` masih 0?
3. Format autentikasi Yt Cipher yang benar seperti apa? Password `[REDACTED]` ditolak
   pada empat bentuk header standar.
4. Apakah `scsearch` memang sedang bermasalah di node ini, atau ada konfigurasi
   SoundCloud yang perlu diperbaiki?

---

## 5. Dampak ke bot kami

| Jalur | Status sebelum | Status setelah perbaikan sisi bot |
| --- | --- | --- |
| Pencarian default | `ytmsearch`, kosong di node ini | `ytsearch`, berfungsi |
| Fallback pencarian | `ytmsearch` lalu `ytsearch` | `ytsearch` lalu `ytmsearch` |
| Playback YouTube | bergantung cipher | masih bergantung cipher |

Perbaikan sisi bot yang sudah dilakukan: default pencarian dipindahkan dari `ytmsearch`
ke `ytsearch` karena `ytsearch` terbukti menghasilkan track di setiap node yang kami pakai.

Yang belum bisa diselesaikan dari sisi bot: playback stream YouTube. Tanpa cipher yang
tersambung, pencarian bisa menemukan lagu tetapi pemutaran masih berisiko gagal.

---

## 6. Catatan metode

Semua hasil di atas diperoleh dari probe langsung ke endpoint publik node pada
2026-11-01, bukan dari asumsi atau dokumentasi pihak ketiga. Perintah yang dijalankan
hanya `GET` pada endpoint baca (`/v4/info`, `/v4/stats`, `/v4/loadtracks`, `/health`,
`/status`, `/info`, `/cache_stats`). Tidak ada perubahan konfigurasi yang dilakukan
terhadap node.
