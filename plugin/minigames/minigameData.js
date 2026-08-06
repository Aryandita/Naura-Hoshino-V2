// Data statis seluruh minigame Naura.
// Dipisahkan dari minigame.js supaya penambahan soal tidak lagi menyentuh
// berkas logika permainan.

const triviaDBFallback = {
    pemula: [
        { q: 'Apa ibukota negara Indonesia?', options: ['Jakarta', 'Bandung', 'Surabaya', 'Medan'], a: 'Jakarta' },
        { q: 'Benda langit yang mengelilingi bumi adalah?', options: ['Matahari', 'Bulan', 'Bintang', 'Mars'], a: 'Bulan' }
    ],
    lanjut: [
        { q: 'Siapa penemu bola lampu pijar?', options: ['Albert Einstein', 'Thomas Edison', 'Nikola Tesla', 'Isaac Newton'], a: 'Thomas Edison' },
        { q: 'Gunung tertinggi di Pulau Jawa adalah?', options: ['Gunung Merapi', 'Gunung Bromo', 'Gunung Semeru', 'Gunung Rinjani'], a: 'Gunung Semeru' }
    ],
    master: [
        { q: 'Tahun berapa VOC dibubarkan secara resmi?', options: ['1799', '1602', '1800', '1945'], a: '1799' },
        { q: 'Gas apa yang paling banyak terdapat di atmosfer Bumi?', options: ['Oksigen', 'Karbondioksida', 'Nitrogen', 'Hidrogen'], a: 'Nitrogen' }
    ],
    grandmaster: [
        { q: 'Siapa nama asli Kapitan Pattimura?', options: ['Thomas Matulessy', 'Yohanis Matulessy', 'Martha Tiahahu', 'Anthony Matulessy'], a: 'Thomas Matulessy' },
        { q: 'Berapa jumlah tulang pada tubuh manusia dewasa normal?', options: ['206', '208', '210', '212'], a: '206' }
    ]
};

const rewards = {
    pemula: { coin: 50, score: 10, time: 20000, color: '#00FF00' },
    lanjut: { coin: 150, score: 30, time: 15000, color: '#00FFFF' },
    master: { coin: 300, score: 50, time: 10000, color: '#FF00FF' },
    grandmaster: { coin: 1000, score: 100, time: 15000, color: '#FFD700' }
};

const wordleWords = [
    'MOBIL', 'MOTOR', 'LAMPU', 'BUNGA', 'PINTU', 'KAPAL', 'PESAN', 'SURAT',
    'BULAN', 'KASUR', 'HUTAN', 'POHON', 'PASIR', 'SINGA', 'MACAN', 'ELANG',
    'BEBEK', 'KATAK', 'BADAK', 'KAMAR', 'KASIR', 'PAGAR'
];

const anagramDB = {
    mudah: ['PINTU', 'MEJA', 'KASUR', 'MOBIL', 'MOTOR', 'BOTOL', 'KIPAS', 'KAPAL', 'BUKU', 'PENA', 'SABUN', 'AYAM', 'SAPI', 'KUDA'],
    sulit: ['ASTRONOT', 'KOMPUTER', 'TELEVISI', 'MIKROSKOP', 'HELIKOPTER', 'METEOROLOGI', 'KONSTITUSI', 'UNIVERSITAS']
};

const hangmanWords = ['ASTRONOT', 'KOMPUTER', 'TELEVISI', 'MIKROSKOP', 'HELIKOPTER', 'METEOROLOGI', 'KONSTITUSI', 'UNIVERSITAS'];

const memoryEmojis = ['\ud83c\udf4e', '\ud83c\udf4c', '\ud83c\udf47', '\ud83c\udf49', '\ud83c\udf53', '\ud83c\udf52'];

const tebakGambarDB = [
    {
        url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
        clue: 'Hewan peliharaan yang mengeong',
        answer: 'kucing'
    },
    {
        url: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
        clue: 'Kendaraan roda empat',
        answer: 'mobil'
    },
    {
        url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
        clue: 'Perangkat elektronik lipat untuk bekerja',
        answer: 'laptop'
    },
    {
        url: 'https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
        clue: 'Mamalia darat dengan leher paling panjang',
        answer: 'jerapah'
    }
];

const ttsDB = [
    { id: 1, clue: '**1 Mendatar:** Ibukota negara Jepang\n**1 Menurun:** Alat untuk menulis dengan tinta', answer: 'tokyo pena' },
    { id: 2, clue: '**1 Mendatar:** Mamalia darat terbesar yang punya belalai\n**1 Menurun:** Buah berduri yang di dalamnya kuning dan wangi', answer: 'gajah durian' },
    { id: 3, clue: '**1 Mendatar:** Planet merah di tata surya kita\n**1 Menurun:** Makanan pokok orang Indonesia', answer: 'mars nasi' }
];

const todFallback = {
    truth: [
        'Apa rahasia terbesar yang belum pernah kamu ceritakan kepada siapa pun di server ini?',
        'Kapan terakhir kali kamu menangis dan apa alasannya?',
        'Siapa orang yang paling kamu sukai diam-diam di server Discord ini?',
        'Apa hal terkonyol yang pernah kamu lakukan demi menarik perhatian seseorang?',
        'Jika kamu bisa bertukar tubuh dengan salah satu temanmu selama sehari, siapa yang akan kamu pilih dan mengapa?'
    ],
    dare: [
        'Kirim voice note bernyanyi bagian chorus dari lagu favoritmu di chat umum saat ini juga!',
        'Ubah nickname Discord-mu menjadi Hamba Sahaya Naura selama 24 jam ke depan!',
        'Gunakan foto profil badut lucu selama 3 hari berturut-turut!',
        'Kirim pesan cinta acak ke salah satu bot di server ini dan screenshot balasannya!',
        'Tirukan suara hewan (seperti kucing manja atau bebek) lewat voice note dan kirim ke grup!'
    ]
};

module.exports = {
    triviaDBFallback,
    rewards,
    wordleWords,
    anagramDB,
    hangmanWords,
    memoryEmojis,
    tebakGambarDB,
    ttsDB,
    todFallback
};
