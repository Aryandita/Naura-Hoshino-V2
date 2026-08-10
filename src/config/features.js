'use strict';

/**
 * Feature registry Naura Hoshino.
 *
 * Registry ini menjadi sumber data ringan untuk daftar modul utama Naura.
 * Tujuannya bukan menjalankan fitur, tetapi menyediakan metadata konsisten untuk
 * /help, /setup, dashboard, dan health check di patch berikutnya.
 */

const FEATURES = Object.freeze({
    core: {
        id: 'core',
        name: 'Core',
        category: 'system',
        description: 'Perintah dasar Naura seperti ping, info, about, help, dan bahasa.',
        enabledByDefault: true,
        setupKey: null,
        premium: false,
        healthCheck: true,
        requiresEnv: ['TOKEN', 'CLIENT_ID'],
        requiresPermissions: ['ViewChannel', 'SendMessages']
    },

    setup: {
        id: 'setup',
        name: 'Setup Center',
        category: 'admin',
        description: 'Pusat konfigurasi server untuk modul Naura.',
        enabledByDefault: true,
        setupKey: 'setup',
        premium: false,
        healthCheck: true,
        requiresEnv: [],
        requiresPermissions: ['ManageGuild']
    },

    automod: {
        id: 'automod',
        name: 'Automod',
        category: 'moderation',
        description: 'Perlindungan otomatis untuk spam, invite, caps, mention berlebih, dan kata terlarang.',
        enabledByDefault: false,
        setupKey: 'automod',
        premium: false,
        healthCheck: true,
        requiresEnv: [],
        requiresPermissions: ['ManageMessages', 'ModerateMembers']
    },

    auditLog: {
        id: 'auditLog',
        name: 'Audit Log',
        category: 'moderation',
        description: 'Pencatatan aktivitas server seperti pesan dihapus, channel berubah, role dibuat, dan kejadian penting lain.',
        enabledByDefault: false,
        setupKey: 'auditLog',
        premium: false,
        healthCheck: true,
        requiresEnv: [],
        requiresPermissions: ['ViewAuditLog', 'SendMessages']
    },

    ticket: {
        id: 'ticket',
        name: 'Ticket',
        category: 'support',
        description: 'Sistem tiket dukungan server dengan channel kategori dan log.',
        enabledByDefault: false,
        setupKey: 'ticket',
        premium: false,
        healthCheck: true,
        requiresEnv: [],
        requiresPermissions: ['ManageChannels', 'SendMessages', 'ViewChannel']
    },

    modmail: {
        id: 'modmail',
        name: 'ModMail',
        category: 'support',
        description: 'Jalur bantuan privat antara user dan staff server.',
        enabledByDefault: false,
        setupKey: 'modmail',
        premium: false,
        healthCheck: true,
        requiresEnv: [],
        requiresPermissions: ['ManageChannels', 'SendMessages', 'ViewChannel']
    },

    tempVoice: {
        id: 'tempVoice',
        name: 'TempVoice',
        category: 'utility',
        description: 'Room voice sementara yang dibuat otomatis saat user masuk trigger channel.',
        enabledByDefault: false,
        setupKey: 'tempVoice',
        premium: false,
        healthCheck: true,
        requiresEnv: [],
        requiresPermissions: ['ManageChannels', 'MoveMembers', 'Connect', 'Speak']
    },

    music: {
        id: 'music',
        name: 'Music',
        category: 'entertainment',
        description: 'Pemutar musik berbasis Lavalink dengan queue, kontrol tombol, filter, dan panel now playing.',
        enabledByDefault: true,
        setupKey: 'music',
        premium: false,
        healthCheck: true,
        requiresEnv: ['LAVA_HOST', 'LAVA_PORT', 'LAVA_PASS'],
        requiresPermissions: ['Connect', 'Speak', 'SendMessages']
    },

    ai: {
        id: 'ai',
        name: 'AI',
        category: 'intelligence',
        description: 'Fitur percakapan dan bantuan cerdas Naura dengan provider AI berlapis.',
        enabledByDefault: false,
        setupKey: 'ai',
        premium: false,
        healthCheck: true,
        requiresEnv: ['GEMINI_API'],
        requiresPermissions: ['SendMessages', 'ReadMessageHistory']
    },

    survival: {
        id: 'survival',
        name: 'Survival RPG',
        category: 'game',
        description: 'Dunia RPG, ekonomi, quest, NPC, farming, crafting, dungeon, dan achievement.',
        enabledByDefault: false,
        setupKey: 'survival',
        premium: false,
        healthCheck: false,
        requiresEnv: [],
        requiresPermissions: ['SendMessages']
    },

    leveling: {
        id: 'leveling',
        name: 'Leveling',
        category: 'community',
        description: 'Sistem XP, rank, leaderboard, dan progres komunitas server.',
        enabledByDefault: false,
        setupKey: 'leveling',
        premium: false,
        healthCheck: true,
        requiresEnv: [],
        requiresPermissions: ['SendMessages']
    },

    premium: {
        id: 'premium',
        name: 'Premium',
        category: 'monetization',
        description: 'Voucher, benefit VIP, dan akses fitur eksklusif Naura.',
        enabledByDefault: true,
        setupKey: 'premium',
        premium: false,
        healthCheck: true,
        requiresEnv: [],
        requiresPermissions: ['SendMessages']
    },

    dashboard: {
        id: 'dashboard',
        name: 'Web Dashboard',
        category: 'web',
        description: 'Panel web untuk konfigurasi, statistik, OAuth2, dan kontrol server.',
        enabledByDefault: false,
        setupKey: 'dashboard',
        premium: false,
        healthCheck: true,
        requiresEnv: ['SESSION_SECRET'],
        requiresPermissions: []
    },

    minecraft: {
        id: 'minecraft',
        name: 'Minecraft',
        category: 'integration',
        description: 'Integrasi status server dan bridge Minecraft sesuai konfigurasi deployment.',
        enabledByDefault: false,
        setupKey: 'minecraft',
        premium: false,
        healthCheck: true,
        requiresEnv: [],
        requiresPermissions: ['SendMessages']
    }
});

function listFeatures() {
    return Object.values(FEATURES);
}

function getFeature(featureId) {
    return FEATURES[featureId] || null;
}

function listFeaturesByCategory(category) {
    return listFeatures().filter(feature => feature.category === category);
}

function listHealthCheckFeatures() {
    return listFeatures().filter(feature => feature.healthCheck);
}

function listSetupFeatures() {
    return listFeatures().filter(feature => feature.setupKey);
}

async function isFeatureEnabled(guildId, featureId) {
    const feature = FEATURES[featureId];
    if (!feature) return false;

    if (!guildId) return feature.enabledByDefault;

    // We avoid circular dependency by requiring cacheManager inside the function
    // since features.js is required by many places
    const cacheManager = require('../managers/cacheManager');
    const settings = await cacheManager.getGuildSettings(guildId);
    
    if (!settings || !settings.settings || !settings.settings.features) {
        return feature.enabledByDefault;
    }

    const isEnabled = settings.settings.features[featureId];
    return isEnabled !== undefined ? isEnabled : feature.enabledByDefault;
}

const COMMAND_FEATURE_MAP = {
    'survival': 'survival',
    'rank': 'leveling',
    'leveling': 'leveling',
    'music': 'music',
    'play': 'music',
    'setup': 'setup',
    'ticket': 'ticket',
    'modmail': 'modmail',
    'tempvoice': 'tempVoice',
    'ai': 'ai',
    'ask': 'ai',
    'core': 'core'
};

module.exports = {
    FEATURES,
    COMMAND_FEATURE_MAP,
    listFeatures,
    getFeature,
    listFeaturesByCategory,
    listHealthCheckFeatures,
    listSetupFeatures,
    isFeatureEnabled
};
