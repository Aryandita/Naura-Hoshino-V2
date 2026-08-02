// Lokasi: plugin/survival/storyData.js

const storyData = [
    {
        arc: 1,
        arcName: 'Dunia Tanpa Sihir',
        reqLevel: 1,
        chapters: [
            {
                chapter: 1,
                title: 'Manusia Biasa',
                background: 'desa',
                narrative: 'Dunia ini dipenuhi oleh elemen magis: api, es, air, tanaman, petir, cahaya, hingga kegelapan. Namun, di Desa Swallowtail, kamu hanyalah manusia biasa (Level 1) yang tidak memiliki sihir sama sekali.',
                dialogue: [
                    { speaker: 'Hector Swallowtail', text: '{player}, sudahlah. Terima saja nasib kita sebagai manusia Level 1. Kita tidak akan pernah bisa naik level atau menggunakan sihir.' },
                    { speaker: '{player}', text: 'Tidak... Aku merasakan sesuatu di dalam diriku. Energi yang tertidur.' },
                    { speaker: 'Naura', text: 'Mungkin mitos itu benar, {player}. Mitos tentang fenomena "Awakening" yang bisa membangkitkan sihir dalam diri manusia biasa.' }
                ],
                reward: { item: 'wooden_axe', amount: 1 },
                nextArc: 1,
                nextChapter: 2
            },
            {
                chapter: 2,
                title: 'Kebangkitan (Awakening)',
                background: 'hutan',
                narrative: 'Saat mencari kayu di pinggiran Hutan Tak Berujung (Spring Town), seekor monster buas menyerang Naura. Dalam keputusasaan, kamu melepaskan ledakan energi murni dari dalam tubuhmu.',
                dialogue: [
                    { speaker: 'Naura', text: '{player}! Tanganmu... bersinar! Itu sihir!' },
                    { speaker: 'Sistem', text: '[Batas Level 1 Terlampaui]. Kebangkitan Sihir Dikonfirmasi. Sistem Leveling kini terbuka untukmu.' }
                ],
                challenge: { type: 'item', reqId: 'wood', reqAmount: 10, btnLabel: 'Serahkan 10 Kayu', btnEmoji: '🪵', failMsg: 'Hector Swallowtail: "Kayu yang kamu bawa masih kurang, {player}. Tebanglah lebih banyak di hutan!"' },
                reward: { exp: 50 },
                nextArc: 2,
                nextChapter: 1
            }
        ]
    },
    {
        arc: 2,
        arcName: 'Jalan Penyihir',
        reqLevel: 2,
        chapters: [
            {
                chapter: 1,
                title: 'Penyihir Biasa & Siluman',
                background: 'kota',
                narrative: 'Kamu telah mencapai Level 2, masuk ke ranah Penyihir. Di kota ini, masyarakat terbagi menjadi tiga kasta: Penyihir Biasa, Penyihir Siluman, dan Penyihir Kelas Atas.',
                dialogue: [
                    { speaker: 'Naura', text: 'Sebagai Penyihir baru, {player}, kamu harus berhati-hati. Banyak Penyihir Kelas Atas yang merendahkan Penyihir Biasa seperti kita.' },
                    { speaker: 'Aska Sunset', text: 'Ssh... anak muda. Aku merasakan elemen kuat di dalam dirimu. Tapi kamu belum memiliki senjata penyalur sihir yang memadai.' }
                ],
                reward: { exp: 100 },
                nextArc: 2,
                nextChapter: 2
            },
            {
                chapter: 2,
                title: 'Fase 2.1: Senjata Elemen',
                background: 'tambang',
                narrative: 'Untuk mengendalikan sihirmu, kamu harus menemukan inti elemen di Tambang Kuno. Di sana, mana di dalam tubuhmu akhirnya beresonansi dan memadatkan diri menjadi sebuah senjata fisik.',
                dialogue: [
                    { speaker: '{player}', text: 'Benda ini... senjataku sendiri? Aku bisa merasakan elemen mengalir sempurna melaluinya.' },
                    { speaker: 'Sistem', text: '[Fase 2.1 Tercapai]. Kamu mendapatkan akses terhadap Senjata Sihir Baru (Mystic Sword).' }
                ],
                challenge: { type: 'item', reqId: 'iron_ore', reqAmount: 5, btnLabel: 'Ekstrak 5 Iron Ore', btnEmoji: '⛏️', failMsg: 'Kamu kekurangan Iron Ore untuk mensintesis pedang. Kembalilah menambang!' },
                reward: { item: 'mystic_sword', amount: 1, exp: 200 },
                nextArc: 3,
                nextChapter: 1
            }
        ]
    },
    {
        arc: 3,
        arcName: 'Rahasia Kerajaan Frostsnow',
        reqLevel: 5,
        chapters: [
            {
                chapter: 1,
                title: 'Dingin yang Menusuk',
                background: 'frostsnow',
                narrative: 'Dengan senjata barumu, kamu dan Naura melakukan perjalanan ke utara menuju Kerajaan Frostsnow yang diselimuti badai salju abadi.',
                dialogue: [
                    { speaker: 'Garry Frostsnow', text: 'Berhenti! Hanya Penyihir Kelas Atas dan Ras Elf yang diizinkan melintasi gerbang kerajaan ini!' },
                    { speaker: '{player}', text: 'Minggir. Aku tidak punya waktu untuk kasta atau peringkat konyol kalian.' }
                ],
                reward: { item: 'potion', amount: 3 },
                nextArc: 3,
                nextChapter: 2
            },
            {
                chapter: 2,
                title: 'Pertemuan di Taman Bunga',
                background: 'park',
                narrative: 'Di balik dinginnya Frostsnow, terdapat Taman Bunga rahasia tempat flora magis tumbuh subur. Di sinilah rahasia evolusi ras tertinggi disembunyikan.',
                dialogue: [
                    { speaker: 'Naura', text: '{player}, legenda mengatakan bahwa Ras Elf adalah ras terkuat di Dunia Sihir. Jika kita bisa mengungkap rahasia mereka, kita bisa mengakhiri diskriminasi kasta ini.' }
                ],
                challenge: { type: 'coin', reqAmount: 15000, btnLabel: 'Bayar 15,000 Koin', btnEmoji: '🪙', failMsg: 'Garry Frostsnow: "Uangmu tidak cukup, rakyat jelata! Menyingkir dari hadapanku!"' },
                reward: { exp: 300 },
                nextArc: 4,
                nextChapter: 1
            }
        ]
    },
    {
        arc: 4,
        arcName: 'Evolusi Tertinggi',
        reqLevel: 10,
        chapters: [
            {
                chapter: 1,
                title: 'Puncak Evolusi (Level 3)',
                background: 'twilight',
                narrative: 'Kamu telah menembus batas manusia dan penyihir biasa. Tubuh dan jiwamu mengalami transendensi. Kamu telah berevolusi menjadi Ras Elf—entitas terkuat di Dunia Sihir.',
                dialogue: [
                    { speaker: 'Sistem', text: '[Level 3 Tercapai]. Ras diubah menjadi: Elf. Kapasitas sihir meningkat secara eksponensial.' },
                    { speaker: '{player}', text: 'Jadi ini kekuatan Ras Elf... Dunia terlihat sepenuhnya berbeda dari atas sini di Kota Twilight.' }
                ],
                challenge: { type: 'item', reqId: 'diamond', reqAmount: 1, btnLabel: 'Korbankan 1 Diamond', btnEmoji: '💎', failMsg: 'Kapasitas sihirmu gagal berevolusi. Kamu butuh setidaknya 1 Diamond murni!' },
                reward: { exp: 500, item: 'diamond', amount: 1 },
                nextArc: 4,
                nextChapter: 2
            },
            {
                chapter: 2,
                title: 'Fase 3.1: Penciptaan Kehidupan',
                background: 'academy',
                narrative: 'Sebagai Ras Elf di puncak sihir, kamu sekarang mampu memanipulasi asal mula kehidupan. Di Twilight Academy, kamu bereksperimen dengan sihir ciptaan.',
                dialogue: [
                    { speaker: 'Naura', text: 'Luar biasa... kau memberikan jiwa pada benda mati, {player}!' },
                    { speaker: '{player}', text: 'Bangkitlah. Mulai sekarang, kau adalah ciptaanku, pengawal abadiku.' },
                    { speaker: 'Sistem', text: '[Fase 3.1 Tercapai]. Mengaktifkan sihir Penciptaan Kehidupan Buatan.' }
                ],
                reward: { item: 'pet_egg', amount: 1, exp: 1000 },
                nextArc: -1,
                nextChapter: -1
            }
        ]
    }
];

module.exports = storyData;
