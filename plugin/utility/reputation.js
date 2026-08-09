'use strict';
const { SlashCommandBuilder } = require('discord.js');
const UserProfile = require('../../src/models/UserProfile');
const cacheManager = require('../../src/managers/cacheManager');
const ui = require('../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reputation')
        .setDescription('Lihat sistem reputasi dan peringkat global')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('Pilih pengguna untuk melihat reputasinya')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('menu')
                .setDescription('Pilih menu yang ingin ditampilkan')
                .setRequired(false)
                .addChoices(
                    { name: '🌟 Cek Reputasi', value: 'check' },
                    { name: '🏆 Peringkat Global', value: 'leaderboard' }
                )
        ),
        
    async execute(interaction, client) {
        await interaction.deferReply();
        
        const target = interaction.options.getUser('target') || interaction.user;
        const menu = interaction.options.getString('menu') || 'check';
        const repEmoji = ui.getEmoji('star') || '⭐';

        if (menu === 'check') {
            if (target.bot) {
                return interaction.editReply(buildErrorContainerV2({
                    title: 'Bot Tidak Punya Reputasi',
                    description: 'Bot tidak tergabung dalam sistem reputasi ini.',
                    footerText: ui.getFooter('utility')
                }));
            }

            const profile = await cacheManager.getUserProfile(target.id);
            const rep = profile ? (profile.reputation || 0) : 0;
            
            const payload = buildContainerV2({
                accentColorHex: ui.colors.primary || '#FFB6C1',
                title: '🌟 Status Reputasi',
                description: `<@${target.id}> memiliki **${rep}** ${repEmoji} Reputasi.\n\n-# *Reputasi didapatkan ketika seseorang mengucapkan terima kasih dan tag namamu.*`,
                footerText: ui.getFooter('utility')
            });
            
            return interaction.editReply(payload);
        } else if (menu === 'leaderboard') {
            const topUsers = await UserProfile.findAll({
                order: [['reputation', 'DESC']],
                limit: 10,
                where: {
                    reputation: {
                        [require('sequelize').Op.gt]: 0
                    }
                }
            });
            
            if (!topUsers || topUsers.length === 0) {
                return interaction.editReply(buildErrorContainerV2({
                    title: 'Leaderboard Kosong',
                    description: 'Belum ada pengguna yang mendapatkan reputasi.',
                    footerText: ui.getFooter('utility')
                }));
            }
            
            let list = '';
            for (let i = 0; i < topUsers.length; i++) {
                const u = topUsers[i];
                let prefix = `${i + 1}.`;
                if (i === 0) prefix = '🥇';
                if (i === 1) prefix = '🥈';
                if (i === 2) prefix = '🥉';
                
                list += `**${prefix}** <@${u.userId}> — **${u.reputation}** ${repEmoji}\n`;
            }
            
            const payload = buildContainerV2({
                accentColorHex: ui.colors.primary || '#FFD700',
                title: '🏆 Peringkat Reputasi Global',
                description: `Ini adalah pengguna dengan reputasi tertinggi yang sering membantu orang lain:\n\n${list}`,
                footerText: ui.getFooter('utility')
            });
            
            return interaction.editReply(payload);
        }
    }
};
