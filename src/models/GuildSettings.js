const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const GuildSettings = sequelize.define('GuildSettings', {
    guildId: { 
        type: DataTypes.STRING, 
        allowNull: false, 
        primaryKey: true 
    },
    
    // Menggabungkan pengaturan ke dalam objek JSON
    music: { 
        type: DataTypes.JSON, 
        defaultValue: {
            twentyFourSeven: false,
            defaultVolume: 100,
            textChannel: null,
            voiceChannel: null
        }
    },
    
    settings: {
        type: DataTypes.JSON,
        defaultValue: {
            globalChat: { enabled: false, channelId: null },
            starboard: { enabled: false, channelId: null, threshold: 3 },
            qotd: { enabled: false, channelId: null, questions: [], lastAsked: null, time: '08:00' },
            ticket: { channelId: null, categoryId: null },
            minecraft: { ip: null, port: null },
            tempVoice: { channelId: null, categoryId: null },
            warn_punishments: { 1: "dm", 2: "mute", 3: "kick", 4: "ban" },
            sticky_roles: false,
            stickyMessage: { channelId: null, message: null },
            announcementChannel: null,
            autoRole: null,
            autoReplies: [],
            vanityRoles: { 
                enabled: false, 
                text: null, 
                roles: [], 
                channelId: null, 
                message: null 
            },
            antinuke: { enabled: false, actions: ['kick'], whitelist: [] },
            automod: { 
                enabled: true,
                antiInvite: false, 
                antiCaps: false, 
                massMention: 5, 
                antiSpam: true,
                badWords: [] // List kata kasar kustom per server
            },
            modmail: {
                enabled: false,
                categoryId: null,
                logChannelId: null // Tempat mengirim transkrip saat ditutup
            }
        }
    },

    system: {
        type: DataTypes.JSON,
        defaultValue: { prefix: 'n!', language: 'id' }
    },
    
    channels: {
        type: DataTypes.JSON,
        defaultValue: { counting: null, tod: null }
    },

    isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
    aiVoiceEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    premiumUntil: { type: DataTypes.DATE, allowNull: true },
    
    countingGame: {
        type: DataTypes.JSON,
        defaultValue: { currentNumber: 0, lastUser: null }
    }
    
}, {
    tableName: 'guild_settings',
    timestamps: false
});

module.exports = GuildSettings;
