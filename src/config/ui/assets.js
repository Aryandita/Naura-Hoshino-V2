'use strict';

// Peta lokasi berkas gambar: banner, background kanvas, dan latar survival.
// Semua path relatif terhadap root proyek, sama seperti sebelumnya.

const banners = {
    // --- Leveling ---
    levelUp: './assets/core/levelbg.png',

    // --- General ---
    naura: './assets/core/avatar.png',
    qris: './assets/general/qris.jpg',
    ticket: './assets/general/banner_ticket.png',
    about: './assets/core/banner_about.png',
    ping: './assets/core/banner_ping.png',
    help: './assets/core/banner_help.png',
    stats: './assets/core/banner_stats.png',
    music: './assets/music/banner_music.png',
    survival: './assets/survival/banner_survival.png',
    shop: './assets/economy/shop_banner.png',
    dungeon: './assets/survival/banner_dungeon.png',
    economy: './assets/economy/banner_economy.png',
    wedding: './assets/survival/banner_wedding.png'
};

const backgrounds = {
    welcome: './assets/core/welcome_bg.png',
    leave: './assets/core/leave_bg.png',
    boost: './assets/core/boost_bg.png'
};

const BG_DIR = './assets/survival/background';

const survivalBackgrounds = {
    desa_pagi: BG_DIR + '/desa_pagi.jpeg',
    desa_siang: BG_DIR + '/desa_siang.jpeg',
    desa_sore: BG_DIR + '/desa_sore.jpeg',
    desa_malam: BG_DIR + '/desa_malam.jpeg',

    hutan_pagi: BG_DIR + '/hutan_pagi.jpeg',
    hutan_siang: BG_DIR + '/hutan_siang.jpeg',
    hutan_sore: BG_DIR + '/hutan_sore.jpeg',
    hutan_malam: BG_DIR + '/hutan_malam.jpeg',

    tambang_pagi: BG_DIR + '/tambang_pagi.jpeg',
    tambang_siang: BG_DIR + '/tambang_siang.jpeg',
    tambang_sore: BG_DIR + '/tambang_sore.jpeg',
    tambang_malam: BG_DIR + '/tambang_malam.jpeg',

    laut_pagi: BG_DIR + '/laut_pagi.jpeg',
    laut_siang: BG_DIR + '/laut_siang.jpeg',
    laut_sore: BG_DIR + '/laut_sore.jpeg',
    laut_malam: BG_DIR + '/laut_malam.jpeg',

    kota_pagi: BG_DIR + '/kota_pagi.jpeg',
    kota_siang: BG_DIR + '/kota_siang.jpeg',
    kota_sore: BG_DIR + '/kota_sore.jpeg',
    kota_malam: BG_DIR + '/kota_malam.jpeg',

    academy_pagi: BG_DIR + '/academy_pagi.jpeg',
    academy_siang: BG_DIR + '/academy_siang.jpeg',
    academy_sore: BG_DIR + '/academy_sore.jpeg',
    academy_malam: BG_DIR + '/academy_malam.jpeg',

    park_pagi: BG_DIR + '/park_pagi.jpeg',
    park_siang: BG_DIR + '/park_siang.jpeg',
    park_sore: BG_DIR + '/park_sore.jpeg',
    park_malam: BG_DIR + '/park_malam.jpeg',

    frostsnow_pagi: BG_DIR + '/frostsnow.png',
    frostsnow_siang: BG_DIR + '/frostsnow.png',
    frostsnow_sore: BG_DIR + '/frostsnow.png',
    frostsnow_malam: BG_DIR + '/frostsnow.png',

    twilight_pagi: BG_DIR + '/twilight.png',
    twilight_siang: BG_DIR + '/twilight.png',
    twilight_sore: BG_DIR + '/twilight.png',
    twilight_malam: BG_DIR + '/twilight.png'
};

module.exports = { banners, backgrounds, survivalBackgrounds, BG_DIR };
