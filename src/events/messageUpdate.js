const { EmbedBuilder } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const cacheManager = require('../managers/cacheManager');
const ui = require('../config/ui');
const { handleAutomod } = require('../utils/automodHelper');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage, client) {
        // ==========================================
        // 1. ANTI-CRASH: TANGANI PESAN LAMA (PARTIAL)
        // ==========================================
        // Jika pesan belum di-cache oleh bot, author akan bernilai null.
        if (oldMessage.partial || newMessage.partial || !oldMessage.author) return;

        // Abaikan jika pesan bot atau di luar server
        if (oldMessage.author.bot || !oldMessage.guild) return;
        
        // Abaikan jika yang diedit hanyalah embed (contoh: link preview dari Discord)
        if (oldMessage.content === newMessage.content) return;
        
        // ==========================================
        // 2. CEK AUTOMOD
        // ==========================================
        // Penting jika user awalnya kirim pesan baik, lalu diedit jadi kata kasar/link ilegal
        const isViolating = await handleAutomod(newMessage, client);
        if (isViolating) return;

        try {
            // ==========================================
            // 3. AMBIL DATA DARI DATABASE (SAFENET JSON)
            // ==========================================
            const settingsDB = await cacheManager.getGuildSettings(oldMessage.guild.id);
            if (!settingsDB) return;

            // Memastikan data terbaca sebagai Objek, bukan String
            let parsedSettings = settingsDB.settings;
            if (typeof parsedSettings === 'string') {
                try { parsedSettings = JSON.parse(parsedSettings); } catch(e) {}
            }

            const logChannelId = parsedSettings?.automod?.logChannelId;
            if (!logChannelId) return;

            const logChannel = oldMessage.guild.channels.cache.get(logChannelId);
            if (!logChannel) return;

            // ==========================================
            // 4. ANTI-CRASH: BATAS KARAKTER EMBED (MAX 1024)
            // ==========================================
            let oldContent = oldMessage.content || 'Kosong/Hanya Gambar';
            if (oldContent.length > 1000) {
                oldContent = oldContent.substring(0, 1000) + '\n... [Terpotong]';
            }

            let newContent = newMessage.content || 'Kosong/Hanya Gambar';
            if (newContent.length > 1000) {
                newContent = newContent.substring(0, 1000) + '\n... [Terpotong]';
            }

            // ==========================================
            // 5. KIRIM LAPORAN KE AUDIT LOG
            // ==========================================
           const embed = new EmbedBuilder()
                .setColor(ui.getColor('primary'))
                .setAuthor({ name: oldMessage.author.tag, iconURL: oldMessage.author.displayAvatarURL() })
                .setTitle(`${ui.getEmoji('rename') || '📝'} Pesan Direvisi`)
                .setDescription(`>>> Aktivitas edit pesan terdeteksi di <#${oldMessage.channel.id}>.\n[🔗 Lompat ke Lokasi Pesan Saat Ini](${newMessage.url})`)
                .addFields(
                    { name: `${ui.getEmoji('rename') || '📝'} Diedit Oleh`, value: `\`${oldMessage.author.globalName || oldMessage.author.username} (@${oldMessage.author.username})\``, inline: false },
                    { name: `${ui.getEmoji('desc') || '📋'} Konten Original`, value: `\`\`\`text\n${oldContent}\n\`\`\``, inline: false },
                    { name: `${ui.getEmoji('desc') || '📋'} Konten Sesudah Diedit`, value: `\`\`\`text\n${newContent}\n\`\`\``, inline: false }
                )
                .setFooter({ text: `User ID: ${oldMessage.author.id}` })
                .setTimestamp();

            await logChannel.send({ embeds: [embed] }).catch(() => {});
        } catch (e) {
            logger.error('[MSG UPDATE LOG ERROR]', e);
        }
    }
};