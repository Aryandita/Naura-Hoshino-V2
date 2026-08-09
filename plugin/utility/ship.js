const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ship')
        .setDescription('💘 Cek persentase kecocokan cinta dengan seseorang.')
        .addUserOption(opt => opt.setName('user').setDescription('Pilih pasangan yang ingin di-ship').setRequired(true)),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const user1 = interaction.user;
        const user2 = target;

        if (user1.id === user2.id) {
            return interaction.reply({ content: 'Mencintai diri sendiri itu penting, tapi coba tag orang lain! 😅', flags: MessageFlags.Ephemeral });
        }

        // Consistent pseudo-random percentage based on user IDs
        const ids = [user1.id, user2.id].sort();
        const str = ids[0] + ids[1];
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        const percentage = Math.abs(hash) % 101;

        let emoji = '💔';
        let desc = 'Hmm... Mungkin lebih baik berteman saja.';

        if (percentage >= 40) { emoji = '❤️‍🩹'; desc = 'Ada sedikit kecocokan, tapi butuh usaha ekstra!'; }
        if (percentage >= 60) { emoji = '💖'; desc = 'Cukup serasi! Kalian mungkin cocok satu sama lain.'; }
        if (percentage >= 80) { emoji = '💞'; desc = 'Wow! Kalian berdua sangat serasi! Pasangan yang ideal!'; }
        if (percentage >= 95) { emoji = '💘'; desc = 'SEMPURNA! Takdir sudah mempertemukan kalian berdua!'; }

        const barLength = Math.round(percentage / 10);
        const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);

        const payload = buildContainerV2({
            accentColorHex: '#ff4757',
            title: `Kecocokan Cinta ${emoji}`,
            description: `**${user1.username}** x **${user2.username}**\n\n**Persentase:** ${percentage}%\n\`${bar}\`\n\n> *${desc}*`,
            footerText: ui.getFooter('utility')
        });

        await interaction.reply(payload);
    }
};
