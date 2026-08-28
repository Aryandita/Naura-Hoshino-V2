// Lokasi: plugin/survival/achievementsData.js
const ui = require("../../config/ui");

const achievementsPool = [
  {
    id: "swallowtail_citizen",
    title: "Warga Swallowtail",
    description: "Mencapai hari ke-30 (Awakening awal).",
    emoji: ui.getEmoji("medal") || "🏅",
    color: "#4ade80",
  },
  {
    id: "high_mage",
    title: "Penyihir Kelas Atas",
    description: "Mencapai Level Survival 50.",
    emoji: ui.getEmoji("crystal_ball") || "🔮",
    color: "#c084fc",
  },
  {
    id: "elf_evolution",
    title: "Evolusi Ras Elf",
    description: "Melakukan Reinkarnasi (Rebirth) pertama.",
    emoji: ui.getEmoji("elf") || "🧝",
    color: "#22d3ee",
  },
  {
    id: "weapon_manifest",
    title: "Manifestasi Senjata",
    description: "Merakit (Craft) Pedang Api Neraka.",
    emoji: ui.getEmoji("dagger") || "🗡️",
    color: "#f87171",
  },
  {
    id: "frostsnow_explorer",
    title: "Penjelajah Frostsnow",
    description: "Bertahan hidup di cuaca badai salju.",
    emoji: ui.getEmoji("snow") || "❄️",
    color: "#93c5fd",
  },
  {
    id: "cat_beast_friend",
    title: "Sahabat Siluman Kucing",
    description: "Meningkatkan afeksi penuh dengan pet Kucing.",
    emoji: ui.getEmoji("cat") || "🐈",
    color: "#fcd34d",
  },
  {
    id: "god_slayer",
    title: "God Slayer",
    description: "Mengalahkan Boss Tertinggi di Dungeon Ekstrim.",
    emoji: ui.getEmoji("skull") || "💀",
    color: "#ef4444",
  },
  {
    id: "demon_contract",
    title: "Kontrak Iblis",
    description: "Menggunakan sihir Kegelapan (Class Assassin) 100 kali.",
    emoji: ui.getEmoji("moon") || "🌑",
    color: "#a8a29e",
  },
  {
    id: "yinyang_light",
    title: "Cahaya Yin-Yang",
    description: "Menemukan flora magis legendaris di Taman Bunga.",
    emoji: ui.getEmoji("sparkle") || "✨",
    color: "#fef08a",
  },
  {
    id: "master_angler",
    title: "Master Angler",
    description: "Menangkap ikan langka Ikan Mas Koki di Pantai Utara.",
    emoji: ui.getEmoji("fish") || "🎣",
    color: "#60a5fa",
  },
  {
    id: "miner_dwarf",
    title: "Kurcaci Penambang",
    description: "Dapatkan 100 Diamond dari tambang.",
    emoji: ui.getEmoji("pickaxe") || "⛏️",
    color: "#d6d3d1",
  },
  {
    id: "forest_guardian",
    title: "Penjaga Hutan",
    description: "Dapatkan 500 Kayu Mahoni.",
    emoji: ui.getEmoji("tree") || "🌳",
    color: "#16a34a",
  },
  {
    id: "masochist",
    title: "Masokis",
    description: "Mati kelaparan/kehausan sebanyak 10 kali.",
    emoji: ui.getEmoji("skull") || "💀",
    color: "#9ca3af",
  },
  {
    id: "cassanova",
    title: "Cassanova",
    description: "Melakukan kencan romantis dengan NPC di Amusement Park.",
    emoji: ui.getEmoji("heart") || "💖",
    color: "#f472b6",
  },
  {
    id: "billionaire",
    title: "Sultan Naura",
    description: "Memiliki kekayaan luar biasa (1 Juta Koin) di Bank.",
    emoji: ui.getEmoji("gem") || "💎",
    color: "#fbbf24",
  },
  {
    id: "magic_creator",
    title: "Pencipta Kehidupan",
    description:
      "Berhasil menetaskan Telur Misterius (Pet Egg) menjadi makhluk buatan.",
    emoji: ui.getEmoji("dna") || "🧬",
    color: "#a78bfa",
  },
  {
    id: "gambler",
    title: "Raja Gacha",
    description: "Melakukan 50x tarikan di mesin Gacha Premium.",
    emoji: ui.getEmoji("slot_machine") || "🎰",
    color: "#fb923c",
  },
  {
    id: "blacksmith_master",
    title: "Dewa Tempa",
    description: "Melakukan Upgrade Senjata hingga level maksimal (+5).",
    emoji: ui.getEmoji("hammer") || "⚒️",
    color: "#9ca3af",
  },
  {
    id: "naura_biggest_fan",
    title: "Naura Biggest Fan",
    description:
      "Memberikan dukungan vote di Top.gg selama 30 hari berturut-turut tanpa terputus.",
    emoji: ui.getEmoji("star_sparkle") || "🌟",
    color: "#F43F5E",
  },
];

module.exports = achievementsPool;
