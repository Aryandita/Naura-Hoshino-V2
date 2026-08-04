'use strict';

// Palet warna, sprite monster, pembatas teks, tautan resmi, dan footer.
// Dipisah dari src/config/ui.js supaya berkas induknya tetap ringan dan mudah
// disunting tanpa harus mengirim ulang seluruh konfigurasi UI.

const colors = {
    // --- Core Colors ---
    primary: '#FFC0CB',
    accent: '#00FFFF',

    // --- Custom Systems ---
    economy: '#FFD700',
    fishing: '#1E90FF',
    mining: '#8B4513',
    crafting: '#228B22',
    battle: '#DC143C',
    rank: '#9400D3',
    music: '#8A2BE2',
    welcome: '#00FFFF',
    leave: '#FF69B4',
    boost: '#FFD700',
    announcement: '#001aff',
    announce_update: '#00FFFF',
    announce_mt: '#8B4513',
    announce_event: '#FFD700',
    announce_warn: '#DC143C',

    // --- Status Colors ---
    success: '#00FF00',
    error: '#FF0000',
    warning: '#FFB347',
    info: '#57C7FF',
    dark: '#2b2d31',
    light: '#f0f0f0',

    // --- Premium Tier Colors ---
    premium_supporter: '#C0C0C0',
    premium_friends: '#A855F7',
    premium_vip: '#FFD700',
    premium_accent: '#FDE68A',
    premium_glow: 'rgba(255,215,0,0.3)'
};

const monsters = {
    slime: './assets/survival/monsters/slime.png',
    goblin: './assets/survival/monsters/goblin.png'
};

const dividers = {
    musicDividers: '\u22B1 \u2500\u2500\u2500\u2500\u2500\u2500 {.\u22C5 \u266B \u22C5.} \u2500\u2500\u2500\u2500\u2500 \u22B0',
    generalDividers: ''
};

const links = {
    dashboards: 'hyperion.kythia.xyz:3070',
    support_server: 'https://dsc.gg/naura-hoshino',
    invite: 'https://discord.com/oauth2/authorize?client_id=1483665745727721543&permissions=8&scope=bot%20applications.commands',
    vote: '',
    saweria: ''
};

const footers = {
    core: 'Naura Hoshino Core v1.2.0 \u2022 Created by Aryandita \u2728',
    utility: 'Naura Utility Feature \u2022 Created by Aryandita \u2728',
    survival: 'Naura RPG Survival Edition \u2022 Created by Aryandita \u2728',
    music: 'Naura High-Fidelity Audio System \u2022 Created by Aryandita \u2728',

    // --- Premium Tier Footers ---
    premium: 'Naura V.I.P Project \u2022 Terima kasih telah mendukung Naura! \uD83D\uDC8E',
    premium_supporter: 'Naura Supporter Tier \u2022 Bersama kita tumbuh \u2728',
    premium_friends: 'Naura Friends Tier \u2022 Terima kasih sahabat setia \uD83D\uDCAB',
    premium_vip: 'Naura V.I.P Tier \u2022 Kamu adalah yang terpilih \uD83D\uDC51'
};

module.exports = { colors, monsters, dividers, links, footers };
