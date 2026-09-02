'use strict';

const { MessageFlags } = require('discord.js');
const seasonEngine = require('../../services/seasonEngine');

module.exports = [
    {
        prefix: 'pass_claim_all',
        label: 'pass-claim-all',
        onError: 'Gagal mengklaim hadiah Battle Pass.',
        async handler(interaction) {
            const userId = interaction.user.id;
            const claimRes = await seasonEngine.claimAllRewards(userId);

            return interaction.reply({
                content: claimRes.message,
                flags: MessageFlags.Ephemeral,
            });
        },
    },
    {
        prefix: 'pass_upgrade_premium',
        label: 'pass-upgrade-premium',
        onError: 'Gagal upgrade ke Premium Battle Pass.',
        async handler(interaction) {
            const userId = interaction.user.id;
            const upgradeRes = await seasonEngine.upgradeToPremium(userId);

            return interaction.reply({
                content: upgradeRes.message,
                flags: MessageFlags.Ephemeral,
            });
        },
    },
];
