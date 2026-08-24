// Katalog tier V.I.P. Satu-satunya sumber kebenaran untuk harga, durasi,
// dan daftar fitur. Dipisahkan dari premium.js agar mudah disunting.
const YES = "\u2705";
const NO = "\u274c";

const PREMIUM_TIERS = {
  tier_voter: {
    name: "🗳️ Naura Voter",
    tier: "voter",
    days: 0.5,
    price: "Gratis (Top.gg Vote)",
    emoji: "🗳️",
    description: "Paket apresiasi yang aktif otomatis setiap kali kamu memberikan vote di Top.gg.",
    features: [
      `${YES} **1.15x Global XP Boost** - nikmati lonjakan XP gratis`,
      `${YES} **+10% Bonus Gaji Kerja** - pendapatan kerja survival ekstra`,
      `${YES} **1.15x Minigame Reward** - bonus perolehan Naura Star Fragments`,
      `${YES} **1-2 Naura Coupon Gratis** - kupon berharga per vote untuk gacha & survival`,
      `${YES} **Voter Badge** - lencana pendukung setia di kartu profil`,
      `${NO} Musik 24/7 & Filter DSP`,
      `${NO} Autoplay AI Dropdown`,
      `${NO} Dungeon tanpa batas`,
      `${NO} Gold Card & VIP Badge`,
    ],
  },
  tier_0: {
    name: "🌱 Naura Starter",
    tier: "starter",
    days: 7,
    price: "Rp 10.000",
    emoji: "🌱",
    description: "Paket hemat untuk kamu yang ingin mencoba sensasi fitur premium Naura.",
    features: [
      `${YES} **1.25x Global XP Boost** - percepat progres levelmu`,
      `${YES} **+15% Bonus Gaji Kerja** - penghasilan harian lebih banyak`,
      `${YES} **1.25x Minigame Reward** - bonus perolehan Naura Star Fragments`,
      `${YES} **Simpan 5 Playlist Musik** - simpan daftar putar favoritmu`,
      `${YES} **Starter Badge** - lencana pemula di kartu profil Canvas`,
      `${NO} Musik 24/7 & Filter DSP`,
      `${NO} Autoplay AI Dropdown`,
      `${NO} Dungeon tanpa batas`,
      `${NO} Gold Card & VIP Badge`,
    ],
  },
  tier_1: {
    name: "🌟 Naura Supporter",
    tier: "supporter",
    days: 30,
    price: "Rp 25.000",
    emoji: "🌟",
    description: "Paket bulanan favorit untuk menemani perjalananmu bersama Naura.",
    features: [
      `${YES} **1.5x Global XP Boost** - naik level lebih cepat di semua server`,
      `${YES} **Banner Profil Custom** - pasang banner sendiri di kartu profil`,
      `${YES} **+25% Bonus Gaji Kerja** - pendapatan kerja survival ekstra`,
      `${YES} **1.25x Minigame Reward** - perbanyak saldo Naura Star Fragments`,
      `${YES} **Simpan 10 Playlist Musik** - kelola antrean musik lebih leluasa`,
      `${YES} **Supporter Badge** - lencana supporter di kartu profil Canvas`,
      `${NO} Musik 24/7 & Filter DSP`,
      `${NO} Autoplay AI Dropdown`,
      `${NO} Dungeon tanpa batas`,
      `${NO} Gold Card & VIP Badge`,
    ],
  },
  tier_2: {
    name: "💫 Naura Friends",
    tier: "friends",
    days: 90,
    price: "Rp 45.000",
    emoji: "💫",
    description: "Pilihan terbaik untuk penikmat audio premium dan survival antusias.",
    features: [
      `${YES} **Semua fitur Supporter**`,
      `${YES} **Mode Siaga Musik 24/7** - Naura standby di voice channel tanpa henti`,
      `${YES} **Filter Audio DSP** - Nightcore, Vaporwave, 8D Surround, Bassboost, Karaoke`,
      `${YES} **Autoplay AI Dropdown** - rekomendasi lagu otomatis & cerdas di panel musik`,
      `${YES} **Playlist Tanpa Batas** - simpan dan impor playlist sepuasnya`,
      `${YES} **1.75x Global XP Boost** - lonjakan XP lebih tinggi`,
      `${YES} **+50% Bonus Gaji Kerja** - keuntungan berlimpah di survival`,
      `${YES} **1.5x Minigame Reward** - panen Naura Star Fragments lebih cepat`,
      `${YES} **Friends Badge & Neon Glow** - kartu profil bersinar dengan efek neon`,
      `${NO} Dungeon di atas lantai 50`,
      `${NO} Bypass Vote-Skip Musik`,
      `${NO} Gold Card & VIP Badge`,
    ],
  },
  tier_3: {
    name: "👑 Naura V.I.P",
    tier: "vip",
    days: 365,
    price: "Rp 75.000",
    emoji: "👑",
    description: "Paket terlengkap tahunan. Akses tanpa batas ke seluruh keistimewaan Naura.",
    features: [
      `${YES} **Semua fitur Friends**`,
      `${YES} **2.0x Global XP Boost** - kecepatan leveling tertinggi di Naura`,
      `${YES} **Dungeon Tanpa Batas** - jelajahi dungeon di atas lantai 50 tanpa batas`,
      `${YES} **+100% Bonus Gaji Kerja** - gaji kerja berlipat ganda`,
      `${YES} **+2% Bunga Deposito Bank** - tabungan ekonomi bertumbuh pesat`,
      `${YES} **2.0x Minigame Reward** - perolehan maksimal Naura Star Fragments`,
      `${YES} **Bypass Vote-Skip Musik** - kendali penuh atas pemutaran musik`,
      `${YES} **Gold Glow Card & VIP Badge** - kartu profil dan rank emas mewah`,
      `${YES} **Custom Title Badge** - gelar eksklusif di profil`,
    ],
  },
};

// Mengambil data tier dari nama tier ('starter' | 'supporter' | 'friends' | 'vip').
function tierByKey(tierKey) {
  const found = Object.keys(PREMIUM_TIERS).find(
    (k) => PREMIUM_TIERS[k].tier === tierKey,
  );
  return found ? PREMIUM_TIERS[found] : null;
}

// Nama tampilan yang aman dipakai walau tier tidak dikenali.
function tierDisplayName(tierKey, days) {
  const info = tierByKey(tierKey);
  if (info) return info.name;
  return `V.I.P (${days} hari)`;
}

function buildBenefitsDescription() {
  const lines = [
    "Berikut perbandingan lengkap setiap tier **Naura V.I.P Subscription**:\n",
  ];

  for (const tier of Object.values(PREMIUM_TIERS)) {
    const dot =
      tier.tier === "vip"
        ? "🟡"
        : tier.tier === "friends"
          ? "🟣"
          : tier.tier === "supporter"
            ? "🔵"
            : tier.tier === "starter"
              ? "🟢"
              : "🔴";

    lines.push(
      `${dot} **${tier.name}** - \`${tier.price}\` / ${tier.days >= 1 ? `${tier.days} hari` : "12 jam"}`,
    );
    lines.push(`*${tier.description}*`);
    for (const feat of tier.features) lines.push(`・ ${feat}`);
    lines.push("");
  }

  lines.push(
    "-# Gunakan `/premium info` untuk berlangganan, atau `/premium check` untuk melihat status aktifmu.",
  );
  return lines.join("\n");
}

module.exports = {
  PREMIUM_TIERS,
  tierByKey,
  tierDisplayName,
  buildBenefitsDescription,
  YES,
  NO,
};
