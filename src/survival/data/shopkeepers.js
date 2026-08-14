"use strict";

const { FRAGMENT, COIN } = require("../engines/currency");

// Setiap toko dimiliki NPC sungguhan, lengkap dengan potret dan gaya bicaranya.
// Dialognya disimpan sebagai beberapa varian supaya kunjungan berulang tidak
// terasa seperti membaca pesan sistem yang sama terus.
//
// Penanda yang bisa dipakai di dalam dialog: {nama}, {barang}, {harga}, {saldo}, {kurang}

const SHOPS = {
  desa: {
    key: "desa",
    npcId: "pak_damar",
    shopName: "Warung Keliling Pak Damar",
    currency: FRAGMENT,
    accentColorHex: "#A3E635",
    // Pedagang desa menjual kebutuhan harian, bukan barang mewah.
    categories: {
      consumable: "Makanan & Minuman Warung",
      material: "Bahan Baku & Hasil Tempa",
      tools: "Alat Kerja Sederhana",
      seed: "Bibit Tanaman",
      pet_food: "Pakan Hewan",
    },
    dialog: {
      greet: [
        "Eh, {nama}! Mampir juga akhirnya. Gelar tikar dulu, barang Pak Damar hari ini lengkap, lho.",
        "Assalamualaikum, {nama}! Kebetulan gerobak Pak Damar baru sampai desa. Lihat-lihat dulu, gratis kok kalau cuma lihat.",
        "Wah, pelanggan langganan datang! Duduk, {nama}. Pak Damar sudah hafal seleramu, hehe.",
      ],
      browse: [
        "Nah, yang ini pilihan bagus. Pak Damar ambil langsung dari pemasoknya, jadi harganya masih wajar.",
        "Silakan diperiksa satu-satu. Pak Damar nggak pernah jual barang cacat ke orang desa sendiri.",
        "Kalau bingung, ambil yang paling murah dulu. Nanti kalau sudah kaya, baru naik kelas, ya!",
      ],
      bought: [
        "Mantap! **{barang}** jadi milikmu. Ini kembaliannya... eh, nggak ada kembalian. Pas, hehe.",
        "Sudah Pak Damar bungkus rapi, **{barang}** aman di tasmu. Hati-hati di jalan, {nama}!",
        "Terima kasih banyak! Karena kamu langganan, nanti Pak Damar kabari kalau ada barang langka.",
      ],
      broke: [
        "Aduh, {nama}... uangmu kurang **{kurang}**. Pak Damar juga butuh makan, jadi nggak bisa kasih utang, ya.",
        "Nah, ini yang Pak Damar takutkan. Kurang **{kurang}** lagi. Kerja dulu di sawah, nanti balik ke sini.",
        "Sabar, sabar. Kumpulkan **{kurang}** lagi, barangnya Pak Damar simpan dulu buat kamu.",
      ],
      farewell: [
        "Pak Damar mau lanjut keliling dulu, ya. Sampai jumpa besok, {nama}!",
        "Gerobak sudah mau ditarik. Kalau butuh apa-apa, cari Pak Damar di pasar desa!",
      ],
    },
  },
  kota: {
    key: "kota",
    npcId: "mbak_rini",
    shopName: "Butik Lelang Mbak Rini",
    currency: COIN,
    accentColorHex: "#F472B6",
    categories: {
      tools: "Alat & Senjata Premium",
      booster: "Item Booster Kerja",
      skill: "Buku Keahlian",
      decoration: "Dekorasi & Furnitur Mewah",
      consumable: "Hidangan Restoran Kota",
      material: "Material Langka & Batangan Logam",
      special: "Barang Spesial & Properti",
    },
    dialog: {
      greet: [
        "Selamat datang di butik Mbak Rini, {nama}~ Jangan malu-malu, semua di sini asli, bukan barang pasar loak.",
        "Ooh, {nama}. Mbak Rini kira kamu sudah lupa jalan ke sini. Duduk, biar Mbak tunjukkan koleksi terbaru.",
        "Wangi parfum siapa ini? Ah, {nama}. Kebetulan sekali, ada beberapa barang yang cocok untukmu.",
      ],
      browse: [
        "Pilih dengan tenang. Mbak Rini nggak suka pembeli yang tergesa-gesa, nanti salah pilih.",
        "Yang ini? Selera bagus. Barang itu susah masuk kota, cuma Mbak Rini yang punya.",
        "Harganya memang tinggi, sayang. Tapi kualitas kota beda dengan barang desa, kan?",
      ],
      bought: [
        "Transaksi selesai. **{barang}** resmi milikmu, {nama}. Rawat baik-baik, ya~",
        "Pintar sekali pilihanmu. **{barang}** ini nilainya akan naik, percaya Mbak Rini.",
        "Senang berbisnis denganmu. Mbak Rini catat kamu sebagai pelanggan prioritas sekarang.",
      ],
      broke: [
        "Ish, {nama}~ Dompetmu kurang **{kurang}**. Mbak Rini kasih diskon senyuman saja, ya, bukan potongan harga.",
        "Kurang **{kurang}**, sayang. Mbak Rini sayang kamu, tapi lebih sayang uang. Cari dulu di kota.",
        "Jangan buat Mbak Rini malu di depan pelanggan lain. Kumpulkan **{kurang}** dulu, baru kembali.",
      ],
      farewell: [
        "Butik mau Mbak Rini tutup dulu. Datang lagi, ya, {nama}~",
        "Mbak Rini ada janji lelang malam ini. Jangan kangen, hehe.",
      ],
    },
  },
};

// Wilayah alam ikut memakai warung desa, karena Pak Damar memang berkeliling.
const LOCATION_ALIAS = {
  village: "desa",
  jalanan: "desa",
  hutan: "desa",
  sawah: "desa",
  pantai: "desa",
  laut: "desa",
  tambang: "desa",
  city: "kota",
  academy: "kota",
};

function resolveShop(location) {
  const key = SHOPS[location] ? location : LOCATION_ALIAS[location];
  return key ? SHOPS[key] : null;
}

/** Ambil satu baris dialog secara acak supaya percakapannya terasa hidup. */
function pickLine(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return "";
  return lines[Math.floor(Math.random() * lines.length)];
}

/** Isi penanda di dalam dialog dengan nilai sebenarnya. */
function fill(line, vars = {}) {
  return String(line || "").replace(/\{(\w+)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(vars, key)
      ? String(vars[key])
      : match;
  });
}

function say(lines, vars) {
  return fill(pickLine(lines), vars);
}

module.exports = { SHOPS, LOCATION_ALIAS, resolveShop, pickLine, fill, say };
