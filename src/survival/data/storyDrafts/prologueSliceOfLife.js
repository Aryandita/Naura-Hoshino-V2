"use strict";

// Naskah versioned yang belum diaktifkan: tidak menimpa chapter/progres lama.
const scene = (speaker, text, nextScene, extra = {}) => ({ speaker, text, nextScene, ...extra });
const choice = (label, nextScene) => ({ label, nextScene });
module.exports = {
  chapterId: "prologue_slice_of_life_v1",
  title: "Hari Pertama di Sukamaju",
  startScene: "start",
  scenes: {
    start: scene("Aku", "Kendaraan yang kutumpangi berhenti di tepi jalan. Aku turun sambil membawa barang-barangku dan melihat papan bertuliskan Sukamaju.", "naura"),
    naura: scene("Naura", "Halo, kamu yang baru tiba, ya? Aku Naura. Perjalanannya bagaimana?", "first_choice", { character: "naura", emotion: "happy" }),
    first_choice: scene("Aku", "Aku menyesuaikan letak tasku dan melihat ke arah jalan desa.", null, { choices: [choice("Lihat tempat tinggal", "home"), choice("Duduk sebentar", "rest")] }),
    home: scene("Naura", "Boleh. Tempatnya tidak jauh dari sini. Aku antar, ya.", "village_hall", { character: "naura", emotion: "neutral" }),
    rest: scene("Naura", "Tentu. Ada bangku di dekat warung. Kita bisa berangkat setelah kamu siap.", "village_hall", { character: "naura", emotion: "tender" }),
    village_hall: scene("Aku", "Setelah itu, aku dan Naura mampir ke balai desa. Seorang pria menyambut kami dari balik meja.", "tirto"),
    tirto: scene("Pak Kades Tirto", "Selamat datang di Sukamaju. Tidak perlu mengenal semuanya hari ini. Kalau ada yang ingin ditanyakan, silakan mampir.", "activities", { character: "kades_tirto" }),
    activities: scene("Aku", "Di dekat pintu, kulihat papan berisi catatan kegiatan warga. Aku memilih tempat yang ingin kukunjungi terlebih dahulu.", null, { choices: [choice("Kunjungi kebun", "garden"), choice("Kunjungi bengkel", "workshop"), choice("Kunjungi pasar", "market"), choice("Kunjungi pesisir", "coast")] }),
    garden: scene("Ningsih", "Halo. Aku Ningsih. Aku sedang menata bibit, tapi masih ada beberapa yang harus kupindahkan. Kalau kamu ingin melihat-lihat, silakan.", "garden_self", { character: "ningsih", emotion: "shy", background: "desa_sukamaju/kebun_morning" }),
    garden_self: scene("Aku", "Aku melihat barisan pot kecil di sampingnya. Aku ingin mengenal kebun ini lebih jauh.", "return_home"),
    workshop: scene("Bagas", "Aku Bagas. Kalau mau melihat bengkel, hati-hati dengan perkakas di dekat meja. Aku sedang membereskannya.", "workshop_self", { character: "bagas" }),
    workshop_self: scene("Aku", "Aku melihat beberapa perkakas tersusun di meja kerja. Sepertinya aku bisa belajar banyak di sini.", "return_home"),
    market: scene("Luna", "Hai, aku Luna! Aku sedang menata aksesori untuk lapak. Kalau penasaran, kamu boleh melihat-lihat dulu.", "market_self", { character: "luna" }),
    market_self: scene("Aku", "Aku memperhatikan lapak-lapak yang mulai dibuka. Aku ingin kembali ketika pasar lebih ramai.", "return_home"),
    coast: scene("Tari", "Hai! Aku Tari. Mang Ujang sedang memeriksa perahunya. Kalau mau mendekat, hati-hati, papannya agak licin.", "coast_self", { character: "tari" }),
    coast_self: scene("Aku", "Aku berhenti di tepi dermaga dan melihat Mang Ujang bekerja. Aku ingin mengenal tempat ini lebih jauh.", "return_home"),
    return_home: scene("Aku", "Hari mulai sore. Aku berjalan pulang dan bertemu Naura di jalan.", "evening_naura"),
    evening_naura: scene("Naura", "Bagaimana hari pertamamu? Kalau belum ingin cerita sekarang juga tidak apa-apa.", "journal", { character: "naura", emotion: "tender" }),
    journal: scene("Aku", "Sesampainya di tempat tinggal, aku membuka jurnal. Hal pertama yang ingin kucatat adalah...", null, { choices: [choice("Suasana desa", "journal_place"), choice("Orang yang kutemui", "journal_people"), choice("Kegiatan yang ingin kucoba", "journal_activity")] }),
    journal_place: scene("Aku", "Aku menulis beberapa baris tentang suasana desa.", "finish"),
    journal_people: scene("Aku", "Aku menulis beberapa baris tentang orang yang kutemui.", "finish"),
    journal_activity: scene("Aku", "Aku menulis kegiatan yang ingin kucoba nanti.", "finish"),
    finish: scene("Aku", "Aku menutup jurnal dan meletakkannya di dekat barang-barangku. Besok, aku bisa melanjutkan mengenal Sukamaju.", null, { end: true }),
  },
};