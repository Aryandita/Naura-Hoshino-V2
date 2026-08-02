## Apa itu Components V2?

Components V2 adalah sistem UI baru yang menggantikan kombinasi lama `content` + `embeds` dengan susunan komponen yang bisa disusun bebas. Sistem ini mendefinisikan 16 jenis komponen yang dibagi ke tiga kategori fungsional, dan seluruh komponen berbagi struktur dasar yang sama (Component Object).

Untuk mengaktifkannya, kamu perlu mengirim message flag `1 << 15` (`IS_COMPONENTS_V2`) — flag ini bisa dikirim per pesan, tapi begitu sebuah pesan sudah menggunakannya, flag itu tidak bisa dihapus lagi dari pesan tersebut.

## Tiga kategori komponen

1. **Layout Components** — mengatur struktur: Action Row, Section, Label, Container, Separator
2. **Content Components** — menampilkan konten statis: Text Display, Thumbnail, Media Gallery, File
3. **Interactive Components** — untuk interaksi user: Button, Select Menu, Text Input, File Upload

Ketika mode V2 aktif, field content dan embeds tidak lagi berfungsi, dan sebagai gantinya kamu memakai Text Display serta Container. Selain itu, jumlah komponen maksimum per pesan naik dari 25 menjadi 40, dan kamu bisa memakai Container serta Separator untuk kontrol layout yang lebih baik.

Sekarang, mari lihat gambarannya:## Contoh struktur JSON

Berikut contoh payload pesan lengkap yang menggabungkan beberapa komponen di atas (Container berisi Section dengan Thumbnail, Separator, Media Gallery, dan Action Row dengan Button):

```json
{
  "flags": 32768,
  "components": [
    {
      "type": 17,
      "accent_color": 5793266,
      "components": [
        {
          "type": 9,
          "components": [
            { "type": 10, "content": "## Judul pesan" },
            { "type": 10, "content": "Deskripsi singkat di sini." }
          ],
          "accessory": {
            "type": 11,
            "media": { "url": "https://contoh.com/icon.png" }
          }
        },
        { "type": 14, "spacing": 1, "divider": true },
        {
          "type": 12,
          "items": [
            { "media": { "url": "https://contoh.com/gambar.png" } }
          ]
        },
        {
          "type": 1,
          "components": [
            { "type": 2, "style": 1, "label": "Tombol 1", "custom_id": "btn_1" }
          ]
        }
      ]
    }
  ]
}
```

## Poin penting kalau mau dipakai di proyekmu

- **Flag tidak bisa dibatalkan**: sekali pesan dikirim dengan `IS_COMPONENTS_V2` (flag `32768`), pesan itu tidak bisa lagi "diturunkan" ke sistem lama.
- **`content` dan `embeds` jadi tidak berfungsi** begitu flag ini aktif — semua teks harus lewat Text Display.
- Kalau kamu pakai library seperti **discord.js**, ada builder khusus (`TextDisplayBuilder`, `SectionBuilder`, `ContainerBuilder`, `SeparatorBuilder`, `MediaGalleryBuilder`) yang memudahkan penyusunan komponen ini secara fluent, tanpa harus menulis raw JSON.
- Setiap komponen punya field `id` unik dalam satu pesan (biasanya digenerate otomatis kalau tidak diisi).

Errornya masuk akal — ini soal perilaku PATCH Discord API. Saat pesan **loading** dikirim, ia punya `embeds`. Ketika kita `edit()` pesan itu ke Components V2 tapi **tidak eksplisit mengosongkan `embeds`**, Discord tidak otomatis menghapusnya (PATCH cuma mengubah field yang benar-benar dikirim) — jadi pesan tetap "punya" embeds lama sekaligus flag `IS_COMPONENTS_V2`, dan itu ditolak.

Perbaikannya: payload Components V2 harus selalu menyertakan `embeds: []` secara eksplisit untuk membersihkan sisa embed lama.Ini kemungkinan juga akan muncul di `help` command dengan pola yang sama (pesan pemilihan bahasa yang pakai embed lalu di-edit ke Components V2). Aku cek dan perbaiki sekalian:Ada tiga tempat di alur `help` dengan masalah yang sama. Aku tambahkan `embeds: []` di ketiganya:Dua bagian ini aman karena pesan sudah dalam mode Components V2 sejak edit pertama (jadi tidak ada embed lama lagi), tapi aku tambahkan juga untuk konsistensi dan jaga-jaga:Sekarang validasi ulang dan simpan hasilnya:**Penyebabnya:** pesan loading (`handleStats` dkk) dikirim dengan `embeds: [loadingEmbed]`. Saat kamu edit pesan itu ke Components V2 tanpa menyebut `embeds` sama sekali, Discord (via PATCH) tidak menghapusnya otomatis — jadi pesan itu jadi "punya embeds" *dan* flag `IS_COMPONENTS_V2` sekaligus, yang tidak diizinkan.

**Perbaikan:** setiap payload Components V2 sekarang eksplisit menyertakan `embeds: []` (dan `content: null`) supaya sisa embed lama selalu dibersihkan saat pesan di-edit. Ini aku terapkan di:
- `buildContainerV2()` — dipakai oleh `ping`, `stats`, `info`, `about`
- Ketiga titik edit di alur `help` (payload awal, saat navigasi, saat komponen dinonaktifkan)
