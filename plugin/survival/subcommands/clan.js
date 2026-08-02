const GuildClan = require('../../../src/models/GuildClan');
const UserSurvival = require('../../../src/models/UserSurvival');
const ui = require('../../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

// Helper untuk reply error di clan
const errReply = async (interaction, msg) => {
    const payload = buildErrorContainerV2({
        title: 'Gagal',
        description: msg,
        footerText: ui.getFooter('survival')
    });
    return interaction.editReply({ ...payload, embeds: [] });
};

module.exports = {
    async execute(interaction, client) {
        const action = interaction.options.getString('aksi') || 'info';
        const clanNameInput = interaction.options.getString('nama');
        const amountInput = interaction.options.getInteger('jumlah') || 100;
        const user = interaction.user;
        const guild = interaction.guild;

        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        // --- AKSI: INFO ---
        if (action === 'info') {
            const allClans = await GuildClan.findAll();
            const userClan = allClans.find(c => Array.isArray(c.members) && c.members.includes(user.id));

            if (!userClan) {
                const payload = buildContainerV2({
                    accentColorHex: ui.getColor('warning') || '#FFD700',
                    title: '🏕️ Sistem Klan Survival',
                    description: `Kamu belum bergabung dengan klan manapun.\n\n• Gunakan \`/survival rpg clan create <nama>\` untuk mendirikan klan baru (Biaya: 500 Star Fragments).\n• Gunakan \`/survival rpg clan join <nama>\` untuk bergabung ke klan kawan.`,
                    footerText: ui.getFooter('survival')
                });
                return interaction.editReply({ ...payload, embeds: [] });
            }

            const leaderUser = await client.users.fetch(userClan.leaderId).catch(() => ({ username: 'Unknown Leader' }));

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                title: `🛡️ Klan: ${userClan.name}`,
                description: `**👑 Pemimpin Klan:** ${leaderUser.username}\n**📊 Level Klan:** Level ${userClan.level}\n**💰 Vault Klan:** ${userClan.vault} Star Fragments\n**👥 Anggota:** ${userClan.members.length} / 20\n**🐉 Boss Raid HP:** ${userClan.bossHp} / 1000 HP`,
                footerText: 'Gunakan /survival rpg clan deposit atau raid untuk berkontribusi!'
            });
            return interaction.editReply({ ...payload, embeds: [] });
        }

        // --- AKSI: CREATE ---
        if (action === 'create') {
            if (!clanNameInput) return errReply(interaction, 'Harap masukkan nama klan yang ingin dibuat.');

            const allClans = await GuildClan.findAll();
            const existingUserClan = allClans.find(c => Array.isArray(c.members) && c.members.includes(user.id));
            if (existingUserClan) return errReply(interaction, 'Kamu sudah menjadi anggota klan lain. Keluar terlebih dahulu.');
            if (survival.starFragments < 500) return errReply(interaction, 'Butuh minimal **500 Star Fragments** untuk mendirikan klan.');

            survival.starFragments -= 500;
            await survival.save();

            const newClan = await GuildClan.create({
                name: clanNameInput.trim(),
                leaderId: user.id,
                guildId: guild ? guild.id : 'global',
                members: [user.id],
                vault: 500
            });

            const payload = buildContainerV2({
                accentColorHex: '#FFD700',
                title: '🏰 Klan Berhasil Didirikan!',
                description: `Selamat! Klan **${newClan.name}** resmi berdiri dengan 500 Star Fragments awal di Vault.\n\nAjak temanmu bergabung dengan \`/survival rpg clan join ${newClan.name}\`!`,
                footerText: ui.getFooter('survival')
            });
            return interaction.editReply({ ...payload, embeds: [] });
        }

        // --- AKSI: JOIN ---
        if (action === 'join') {
            if (!clanNameInput) return errReply(interaction, 'Harap masukkan nama klan yang ingin kamu masuki.');

            const allClans = await GuildClan.findAll();
            const existingUserClan = allClans.find(c => Array.isArray(c.members) && c.members.includes(user.id));
            if (existingUserClan) return errReply(interaction, 'Kamu sudah bergabung dengan klan lain.');

            const targetClan = await GuildClan.findOne({ where: { name: clanNameInput.trim() } });
            if (!targetClan) return errReply(interaction, `Klan dengan nama **"${clanNameInput}"** tidak ditemukan.`);
            if (targetClan.members.length >= 20) return errReply(interaction, 'Klan ini sudah mencapai batas maksimal 20 anggota.');

            const updatedMembers = [...targetClan.members, user.id];
            targetClan.members = updatedMembers;
            targetClan.changed('members', true);
            await targetClan.save();

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('success') || '#22c55e',
                title: '⚔️ Berhasil Bergabung!',
                description: `Kamu resmi bergabung menjadi anggota klan **${targetClan.name}**!`,
                footerText: ui.getFooter('survival')
            });
            return interaction.editReply({ ...payload, embeds: [] });
        }

        // --- AKSI: DEPOSIT ---
        if (action === 'deposit') {
            const allClans = await GuildClan.findAll();
            const userClan = allClans.find(c => Array.isArray(c.members) && c.members.includes(user.id));
            if (!userClan) return errReply(interaction, 'Kamu belum memiliki klan.');
            if (survival.starFragments < amountInput) return errReply(interaction, `Star Fragments kamu tidak cukup (Dimiliki: ${survival.starFragments}).`);

            survival.starFragments -= amountInput;
            await survival.save();

            userClan.vault += amountInput;
            if (userClan.vault >= userClan.level * 2000) userClan.level += 1;
            await userClan.save();

            const payload = buildContainerV2({
                accentColorHex: '#FFD700',
                title: '💰 Deposit Berhasil',
                description: `Kamu menyumbang **${amountInput} Star Fragments** ke Vault klan **${userClan.name}**!\nTotal Vault Saat Ini: \`${userClan.vault} Star Fragments\` (Level ${userClan.level})`,
                footerText: ui.getFooter('survival')
            });
            return interaction.editReply({ ...payload, embeds: [] });
        }

        // --- AKSI: RAID ---
        if (action === 'raid') {
            const allClans = await GuildClan.findAll();
            const userClan = allClans.find(c => Array.isArray(c.members) && c.members.includes(user.id));
            if (!userClan) return errReply(interaction, 'Kamu belum memiliki klan.');
            if (survival.stamina < 15) return errReply(interaction, 'Stamina kamu terlalu rendah (Butuh minimal 15 Stamina).');

            survival.stamina -= 15;

            const damage = Math.floor(Math.random() * 50) + (survival.strength * 10) + 20;
            let currentBossHp = userClan.bossHp - damage;
            let bossDefeated = false;

            if (currentBossHp <= 0) {
                bossDefeated = true;
                currentBossHp = 1000 + (userClan.level * 200);
                userClan.vault += 1500;
                survival.starFragments += 300;
                survival.survival_xp += 150;
            } else {
                survival.survival_xp += 30;
            }

            userClan.bossHp = currentBossHp;
            await userClan.save();
            await survival.save();

            const payload = buildContainerV2({
                accentColorHex: bossDefeated ? '#FFD700' : '#ff4757',
                title: bossDefeated ? '🎉 BOSS RAID DIKALAHKAN!' : '⚔️ RAID CLAN BOSS',
                description: bossDefeated
                    ? `Kerja bagus! Seranganmu sebesar **${damage} DMG** berhasil menumbangkan Boss Clan!\n\n🎁 **Hadiah:**\n+300 Star Fragments (Individu)\n+1500 Star Fragments ke Vault Klan\n+150 Survival XP`
                    : `Kamu menyerang Boss Clan dan memberikan **${damage} DMG**!\nSisa HP Boss: \`${currentBossHp} / 1000 HP\``,
                footerText: ui.getFooter('survival')
            });
            return interaction.editReply({ ...payload, embeds: [] });
        }
    }
};
