// plugin/survival/subcommands/raid.js
const GuildClan = require('../../../src/models/GuildClan');
const UserSurvival = require('../../../src/models/UserSurvival');
const ui = require('../../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const { MessageFlags } = require('discord.js');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const guildId = interaction.guildId;

        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.stamina < 15) {
            return interaction.reply({
                ...buildErrorContainerV2({ errorMessage: 'Staminamu terlalu rendah untuk ikut Boss Raid (Minimal 15 Stamina).' }),
                flags: MessageFlags.Ephemeral
            });
        }

        // Cari klan user
        const allClans = await GuildClan.findAll({ where: { guildId } });
        const userClan = allClans.find(c => {
            const members = Array.isArray(c.members) ? c.members : [];
            return c.leaderId === user.id || members.includes(user.id);
        });

        if (!userClan) {
            return interaction.reply({
                ...buildErrorContainerV2({ errorMessage: 'Kamu harus bergabung dengan Klan di server ini untuk mengikuti Server Boss Raid! Gunakan `/survival clan`.' }),
                flags: MessageFlags.Ephemeral
            });
        }

        if ((userClan.bossHp || 0) <= 0) {
            return interaction.reply({
                ...buildContainerV2({
                    accentColorHex: ui.getColor('success') || '#00FF00',
                    authorName: 'Naura Guild Boss Raid',
                    title: `${ui.getEmoji('dungeon_boss') || '🐉'} Boss Klan Sudah Dikalahkan!`,
                    description: `Naga Raid klan **${userClan.name}** sudah berhasil ditumbangkan hari ini! Serangan boss akan direset besok.`,
                    footerText: ui.getFooter('survival')
                }),
                flags: MessageFlags.Ephemeral
            });
        }

        // Hitung Damage berdasarkan Strength & Agility
        const playerStr = survival.strength || 1;
        const playerAgi = survival.agility || 1;
        const baseDamage = Math.floor(Math.random() * 30) + (playerStr * 5) + (playerAgi * 2);
        const isCritical = Math.random() < 0.2;
        const finalDamage = isCritical ? Math.floor(baseDamage * 1.5) : baseDamage;

        // Kurangi HP Boss
        userClan.bossHp = Math.max(0, (userClan.bossHp || 1000) - finalDamage);
        userClan.changed('bossHp', true);
        await userClan.save();

        // Potong stamina & berikan hadiah NSF
        survival.stamina -= 15;
        const rewardNSF = Math.floor(finalDamage / 2) + 20;
        survival.starFragments = (survival.starFragments || 0) + rewardNSF;
        await survival.save();

        const isDefeated = userClan.bossHp <= 0;

        const payload = buildContainerV2({
            accentColorHex: isDefeated ? '#FFD700' : '#FF0000',
            authorName: 'Naura Guild Boss Raid Co-op Event',
            title: `${ui.getEmoji('dungeon_boss') || '🐉'} ${isCritical ? '💥 CRITICAL HIT!' : '⚔️ Serangan Boss Raid'}`,
            description: [
                `<@${user.id}> menyerang Boss Klan **${userClan.name}** dan memberikan **${finalDamage} Damage**! ${isCritical ? '🔥' : ''}`,
                '',
                `• **Sisa HP Boss:** **${userClan.bossHp} / 1000 HP**`,
                `• **Hadiah Serangan:** +**${rewardNSF}** ${ui.getEmoji('nsf') || '🪙'} NSF`,
                `• **Sisa Stamina:** **${survival.stamina} / 100**`,
                '',
                isDefeated ? `🎉 **Luar Biasa! Klan ${userClan.name} berhasil mengalahkan Boss Raid hari ini!** Poin kas klan bertambah!` : '💪 Bekerja samalah dengan anggota klanmu untuk mengalahkan sisa HP Boss!'
            ].join('\n'),
            footerText: ui.getFooter('survival')
        });

        return interaction.reply(payload);
    }
};
