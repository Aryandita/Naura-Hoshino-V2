const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const UserNPC = require('../../../src/models/UserNPC');
const { safeParseInventory } = require('../inventoryHelper');
const ui = require('../../../src/config/ui');
const { advanceTime, getTimeState } = require('../../../plugin/survival/survivalTime');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await cacheManager.getUserProfile(user.id);
        const eNsf = ui.getEmoji('nsf') || '🪙';

        // 1. Lokasi & Waktu Check
        if (survival.currentLocation !== 'kota') {
            const errPayload = buildContainerV2({
                accentColorHex: ui.getColor('error') || '#ef4444',
                title: '❌ Lokasi Tidak Valid',
                description: 'Naura Central Bank hanya ada di **Kota**. Gunakan `/survival travel` untuk pindah!',
                footerText: ui.getFooter('survival')
            });
            return interaction.reply({ ...errPayload, flags: 64 });
        }

        const timeState = getTimeState(survival.inGameHour || 6);
        if (!timeState.label.toLowerCase().includes('malam') && survival.inGameHour > 5 && survival.inGameHour < 22) {
            const errPayload = buildContainerV2({
                accentColorHex: ui.getColor('error') || '#ef4444',
                title: '❌ Bank Beroperasi',
                description: 'Bank sedang beroperasi dan dijaga ketat oleh Satpam Yanto. Datanglah di tengah malam saat sepi!',
                footerText: ui.getFooter('survival')
            });
            return interaction.reply({ ...errPayload, flags: 64 });
        }

        // 2. Requirement Item Check
        const currentInv = safeParseInventory(profile.inventory);
        const hasMask = currentInv.some(i => i && i.id === 'heist_mask');
        const hasBomb = currentInv.some(i => i && i.id === 'c4_bomb');

        if (!hasMask || !hasBomb) {
            const errPayload = buildContainerV2({
                accentColorHex: ui.getColor('error') || '#ef4444',
                title: '❌ Perlengkapan Kurang',
                description: `Kamu belum siap! Untuk merampok bank, kamu **wajib** memakai ${ui.getEmoji('mask') || '🎭'} **Topeng Perampok** dan membawa ${ui.getEmoji('bomb') || '💣'} **Bom Rakitan (C4)** untuk meledakkan brankas. (Crafting di meja perakitan)`,
                footerText: ui.getFooter('survival')
            });
            return interaction.reply({ ...errPayload, flags: 64 });
        }

        const agility = survival.agility || 1;
        const luck = survival.luck || 1;
        const successChance = 10 + (Math.min(80, agility) * 0.5) + (Math.min(100, luck) * 0.2);
        const roll = Math.random() * 100;

        // Hapus bom dari inventory
        const bombIndex = currentInv.findIndex(i => i && i.id === 'c4_bomb');
        if (bombIndex !== -1) currentInv.splice(bombIndex, 1);
        profile.inventory = currentInv;

        if (roll <= successChance) {
            // SUCCESS
            const reward = Math.floor(50000 + (Math.random() * 100000));
            survival.starFragments = (survival.starFragments || 0) + reward;
            await survival.save();
            await advanceTime(user.id, 4);

            const successPayload = buildContainerV2({
                accentColorHex: ui.getColor('success') || '#22c55e',
                title: `${ui.getEmoji('bomb') || '💣'} PERAMPOKAN SUKSES!`,
                description: `Kamu meledakkan brankas Naura Central Bank dan berhasil kabur membawa karung berisi Naura Star Fragment sebelum Bripka Agus tiba!\n\n${ui.getEmoji('dungeon_money') || '💰'} **Rampasan:** +${reward.toLocaleString('id-ID')} ${eNsf} **Naura Star Fragment**\n\nKamu bersembunyi selama 4 jam untuk menghilangkan jejak.`,
                footerText: ui.getFooter('survival')
            });
            return interaction.reply(successPayload);
        } else {
            // FAIL
            let walletAmount = survival.starFragments || 0;
            survival.starFragments = 0;

            let bankPenalty = 50000;
            let bankBal = profile.economy_bank || 0;
            let paidPenalty = Math.min(bankBal, bankPenalty);
            profile.economy_bank -= paidPenalty;

            await profile.save();

            survival.currentLocation = 'prison';
            survival.stamina = 10;
            survival.hp = 10;
            await survival.save();

            const allNPCs = await UserNPC.findAll({ where: { userId: user.id } });
            let relationshipLog = '';
            for (const npc of allNPCs) {
                npc.affection = Math.max(0, npc.affection - 30);
                npc.relationshipLevel = Math.max(0, npc.relationshipLevel - 1);
                await npc.save();
            }

            if (allNPCs.length > 0) {
                relationshipLog = `\n💔 Berita penangkapanmu tersebar. **Semua NPC** merasa kecewa! Afeksi mereka turun drastis dan level hubungan berkurang 1.`;
            }

            await advanceTime(user.id, 24);

            const failPayload = buildContainerV2({
                accentColorHex: ui.getColor('error') || '#ef4444',
                title: `${ui.getEmoji('prison') || '⛓️'} TERTANGKAP!`,
                description: `Alarm berbunyi sangat keras! Bripka Agus dan tim SWAT langsung menyergapmu sebelum kamu bisa keluar dari brankas.\n\nKamu dijebloskan ke **Penjara** selama 24 Jam.\n\n${ui.getEmoji('npc_tax') || '💸'} Uang Dompet: **Disita Semua (-${walletAmount.toLocaleString('id-ID')}** ${eNsf} **Naura Star Fragment)**\n${ui.getEmoji('npc_tax') || '💸'} Denda Bank: **-${paidPenalty.toLocaleString('id-ID')} NC**${relationshipLog}`,
                footerText: ui.getFooter('survival')
            });
            return interaction.reply(failPayload);
        }
    }
};
