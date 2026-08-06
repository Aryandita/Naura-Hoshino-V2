// Katalog tier V.I.P. Satu-satunya sumber kebenaran untuk harga, durasi,
// dan daftar fitur. Dipisahkan dari premium.js agar mudah disunting.
const YES = '\u2705';
const NO = '\u274c';

const PREMIUM_TIERS = {
    tier_1: {
        name: '\ud83c\udf1f Naura Supporter',
        tier: 'supporter',
        days: 30,
        price: 'Rp 25.000',
        emoji: '\ud83c\udf1f',
        description: 'Paket pertama untuk kamu yang ingin menemani Naura tumbuh.',
        features: [
            `${YES} **1.5x Global XP Boost** - naik level lebih cepat di semua server`,
            `${YES} **Banner Profil Custom** - pasang banner sendiri di kartu profilmu`,
            `${YES} **Memori AI Lebih Panjang** - Naura mengingat 10 pesan terakhir`,
            `${YES} **Download Harian 10x** - downloader dan translate dengan limit tinggi`,
            `${NO} Musik 24/7`,
            `${NO} Filter audio DSP`,
            `${NO} Playlist tanpa batas`,
            `${NO} Dungeon tanpa batas`,
            `${NO} Gold Card dan AI Studio`
        ]
    },
    tier_2: {
        name: '\ud83d\udcab Naura Friends',
        tier: 'friends',
        days: 90,
        price: 'Rp 45.000',
        emoji: '\ud83d\udcab',
        description: 'Pilihan paling pas buat penikmat musik dan konten harian.',
        features: [
            `${YES} **Semua fitur Supporter**`,
            `${YES} **Mode Siaga 24/7** - musik menemani kamu tanpa henti`,
            `${YES} **Filter Audio DSP** - Nightcore, Vaporwave, 8D Surround, Karaoke`,
            `${YES} **Playlist Tanpa Batas** - simpan dan impor sebanyak yang kamu mau`,
            `${YES} **Download Tanpa Batas** - tanpa limit harian maupun batas translate`,
            `${YES} **1.75x Global XP Boost** - naik level makin cepat`,
            `${NO} Dungeon di atas lantai 50`,
            `${NO} Bonus gaji dan bunga bank`,
            `${NO} Gold Card dan AI Studio`
        ]
    },
    tier_3: {
        name: '\ud83d\udc51 Naura V.I.P',
        tier: 'vip',
        days: 365,
        price: 'Rp 75.000',
        emoji: '\ud83d\udc51',
        description: 'Paket terlengkap. Semua pintu terbuka, tanpa batas.',
        features: [
            `${YES} **Semua fitur Friends**`,
            `${YES} **2x Global XP Boost** - level tercepat di seluruh server`,
            `${YES} **Dungeon Tanpa Batas** - lewati lantai 50 sepuasnya`,
            `${YES} **+50% Bonus Gaji Survival** - koin ekstra setiap shift kerja`,
            `${YES} **+2% Bunga Deposito Bank** - tabunganmu tumbuh lebih subur`,
            `${YES} **AI Studio Penuh** - limit tinggi \`/ai imagine\` dan memori 20 pesan`,
            `${YES} **Gold Glow Card** - kartu profil dan rank emas dengan efek berkilau`
        ]
    }
};

// Mengambil data tier dari nama tier ('supporter' | 'friends' | 'vip').
function tierByKey(tierKey) {
    const found = Object.keys(PREMIUM_TIERS).find(k => PREMIUM_TIERS[k].tier === tierKey);
    return found ? PREMIUM_TIERS[found] : null;
}

// Nama tampilan yang aman dipakai walau tier tidak dikenali.
function tierDisplayName(tierKey, days) {
    const info = tierByKey(tierKey);
    if (info) return info.name;
    return `V.I.P (${days} hari)`;
}

function buildBenefitsDescription() {
    const lines = ['Ini perbandingan lengkap tiap tier **Naura V.I.P Subscription**, biar kamu gampang memilih.\n'];

    for (const tier of Object.values(PREMIUM_TIERS)) {
        const dot = tier.tier === 'vip'
            ? '\ud83d\udfe1'
            : tier.tier === 'friends' ? '\ud83d\udfe3' : '\u26aa';

        lines.push(`${dot} **${tier.name}** - \`${tier.price}\` / ${tier.days} hari`);
        lines.push(`*${tier.description}*`);
        for (const feat of tier.features) lines.push(`\u30fb ${feat}`);
        lines.push('');
    }

    lines.push('-# Pakai `/premium info` untuk berlangganan, atau `/premium check` untuk melihat statusmu.');
    return lines.join('\n');
}

module.exports = {
    PREMIUM_TIERS,
    tierByKey,
    tierDisplayName,
    buildBenefitsDescription,
    YES,
    NO
};
