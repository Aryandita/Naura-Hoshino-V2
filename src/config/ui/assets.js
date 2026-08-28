"use strict";

// Peta lokasi berkas gambar: banner, background kanvas, dan latar survival.
// Semua path relatif terhadap root proyek, sama seperti sebelumnya.

const banners = {
  // --- Leveling ---
  levelUp: "./assets/core/levelbg.png",

  // --- General & Categories ---
  naura: "./assets/core/avatar.png",
  qris: "./assets/general/qris.jpg",
  ticket: "./assets/general/Support & Ticket Banner.jpeg",
  ticketOld: "./assets/general/banner_ticket.png",
  about: "./assets/core/banner_about.png",
  ping: "./assets/core/banner_ping.png",
  help: "./assets/general/Utility & Tools Banner.jpeg",
  helpOld: "./assets/core/banner_help.png",
  stats: "./assets/core/banner_stats.png",
  utility: "./assets/general/Utility & Tools Banner.jpeg",
  minigame: "./assets/general/Minigame & Arcade Banner.jpeg",
  arcade: "./assets/general/Minigame & Arcade Banner.jpeg",
  giveaway: "./assets/general/Giveaway & Event Banner.jpeg",
  admin: "./assets/general/Admin & Security Banner.jpeg",
  music: "./assets/general/Music Banner.jpeg",
  musicNowPlaying: "./assets/music/Now Playing Banner.jpeg",
  nowPlaying: "./assets/music/Now Playing Banner.jpeg",
  musicProfile: "./assets/music/Now Playing Banner.jpeg",
  survival: "./assets/survival/banner_survival.png",
  shop: "./assets/economy/shop_banner.png",
  dungeon: "./assets/survival/banner_dungeon.png",
  economy: "./assets/general/Economy & Market Banner.jpeg",
  economyOld: "./assets/economy/banner_economy.png",
  wedding: "./assets/survival/banner_wedding.png",
  error: "./assets/general/Error Banner.gif",
  errorCompressed: "./assets/general/Error Banner_compressed.gif",
  errorWebp: "./assets/general/Error Banner.webp",
  loading: "./assets/general/Loading Banner.gif",
  loadingCompressed: "./assets/general/Loading Banner_compressed.gif",
  loadingWebp: "./assets/general/Loading Banner.webp",
  maintenance: "./assets/general/Maintenace Banner.gif",
  maintenanceCompressed: "./assets/general/Maintenace Banner_compressed.gif",
  maintenanceWebp: "./assets/general/Maintenace Banner.webp",
};

const characters = {
  luna_gacha: "./assets/survival/characters/luna_gacha.jpeg",
};

const backgrounds = {
  welcome: "./assets/core/welcome_bg.png",
  leave: "./assets/core/leave_bg.png",
  boost: "./assets/core/boost_bg.png",
};

const BG_DIR = "./assets/survival/background";

const survivalBackgrounds = {
  desa_pagi: BG_DIR + "/desa_pagi.jpeg",
  desa_siang: BG_DIR + "/desa_siang.jpeg",
  desa_sore: BG_DIR + "/desa_sore.jpeg",
  desa_malam: BG_DIR + "/desa_malam.jpeg",

  hutan_pagi: BG_DIR + "/hutan_pagi.jpeg",
  hutan_siang: BG_DIR + "/hutan_siang.jpeg",
  hutan_sore: BG_DIR + "/hutan_sore.jpeg",
  hutan_malam: BG_DIR + "/hutan_malam.jpeg",

  tambang_pagi: BG_DIR + "/tambang_pagi.jpeg",
  tambang_siang: BG_DIR + "/tambang_siang.jpeg",
  tambang_sore: BG_DIR + "/tambang_sore.jpeg",
  tambang_malam: BG_DIR + "/tambang_malam.jpeg",

  laut_pagi: BG_DIR + "/laut_pagi.jpeg",
  laut_siang: BG_DIR + "/laut_siang.jpeg",
  laut_sore: BG_DIR + "/laut_sore.jpeg",
  laut_malam: BG_DIR + "/laut_malam.jpeg",

  kota_pagi: BG_DIR + "/kota_pagi.jpeg",
  kota_siang: BG_DIR + "/kota_siang.jpeg",
  kota_sore: BG_DIR + "/kota_sore.jpeg",
  kota_malam: BG_DIR + "/kota_malam.jpeg",

  academy_pagi: BG_DIR + "/academy_pagi.jpeg",
  academy_siang: BG_DIR + "/academy_siang.jpeg",
  academy_sore: BG_DIR + "/academy_sore.jpeg",
  academy_malam: BG_DIR + "/academy_malam.jpeg",

  park_pagi: BG_DIR + "/park_pagi.jpeg",
  park_siang: BG_DIR + "/park_siang.jpeg",
  park_sore: BG_DIR + "/park_sore.jpeg",
  park_malam: BG_DIR + "/park_malam.jpeg",

  frostsnow_pagi: BG_DIR + "/frostsnow.png",
  frostsnow_siang: BG_DIR + "/frostsnow.png",
  frostsnow_sore: BG_DIR + "/frostsnow.png",
  frostsnow_malam: BG_DIR + "/frostsnow.png",

  twilight_pagi: BG_DIR + "/twilight.png",
  twilight_siang: BG_DIR + "/twilight.png",
  twilight_sore: BG_DIR + "/twilight.png",
  twilight_malam: BG_DIR + "/twilight.png",
};

module.exports = {
  banners,
  characters,
  backgrounds,
  survivalBackgrounds,
  BG_DIR,
};
