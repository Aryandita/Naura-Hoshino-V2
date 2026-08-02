// Lokasi: src/commands/survival/subcommands/travel.js
const { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UserSurvival = require('../../../src/models/UserSurvival');
const path = require('path');
const fs = require('fs');
const ui = require('../../../src/config/ui');
const { advanceTime, getTimeState } = require('../../../plugin/survival/survivalTime');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const tujuan = interaction.options.getString('lokasi');

        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.currentLocation === 'prison') {
            return ui.sendError(interaction, `${ui.getEmoji('prison') || '⛓️'} **Kamu sedang di penjara!** Kamu tidak bisa bepergian kemana-mana sampai bebas.`, true);
        }

        if (survival.currentLocation === tujuan) {
            return ui.sendError(interaction, 'err_sys_66', true);
        }

        const hasNoVehicle = !survival.vehicle || survival.vehicle === 'none';
        const hasNoHouse = !survival.propertyId || survival.propertyId === 'jalanan';

        // Pengecekan keluar desa: Wajib punya rumah dan kendaraan
        if (tujuan !== 'village' && (hasNoVehicle || hasNoHouse)) {
            return ui.sendError(interaction, 'err_sys_67', true);
        }

        let travelTime = 2; // Default jalan kaki ke desa
        let vehName = 'Jalan Kaki';
        if (survival.vehicle === 'bicycle') { travelTime = 1; vehName = 'Sepeda Kayuh'; }
        if (survival.vehicle === 'motorcycle') { travelTime = 0.5; vehName = 'Sepeda Motor'; }

        // Menerapkan perjalanan
        survival.currentLocation = tujuan;
        await survival.save();

        const timeUpdate = await advanceTime(user.id, Math.ceil(travelTime));
        const timeState = getTimeState(timeUpdate.hour);
        let encounterText = '';
        if (!timeUpdate.passedOut && Math.random() < 0.15) {
            const seed = Math.random();
            if (seed < 0.5) {
                encounterText = `\n\n${ui.getEmoji('thief') || '🥷'} **RANDOM ENCOUNTER!**\nDi tengah jalan, kamu dicegat oleh **Bandit**! Untungnya kamu berhasil lolos, tapi beberapa Naura Star Fragmentmu terjatuh di jalan.`;
                const cacheManager = require('../../../src/managers/cacheManager');
                const profile = await cacheManager.getUserProfile(user.id);
                if (profile) {
                    survival.starFragments = Math.max(0, (survival.starFragments || 0) - 50);
                }
            } else {
                encounterText = `\n\n🎒 **RANDOM ENCOUNTER!**\nKamu berpapasan dengan **Pak Damar** (Pedagang Keliling). "Psst, kalau butuh barang langka temui aku di pojok kota malam ini," bisiknya sebelum menghilang.`;
            }
        }

        const locNames = {
            'village': 'Desa Pemula (Awal)',
            'kota': 'Naura City (Pusat Kota)',
            'academy': 'Naura Academy (Kampus)',
            'hutan': 'Hutan Terlarang',
            'tambang': 'Gua Penambang',
            'laut': 'Pantai & Dermaga'
        };

        let desc = `Kamu melakukan perjalanan menuju **${locNames[tujuan] || tujuan}** menggunakan **${vehName}**.\n\nWaktu tempuh: **${travelTime} Jam**.\n> Saat ini: ${timeState.emoji} **Hari ke-${timeUpdate.day}, Jam ${timeUpdate.hour.toString().padStart(2, '0')}:00** (${timeState.label})`;
        desc += encounterText;

        if (timeUpdate.passedOut) {
            const eNsf = ui.getEmoji('nsf') || '🪙';
            desc += `\n\n${ui.getEmoji('sick') || '🚑'} **Kamu pingsan di jalan karena kelelahan / melanggar jam malam!**\nKamu dilarikan ke **${timeUpdate.clinic}** dan dikembalikan ke Desa.\nBiaya medis yang dipotong: **-${timeUpdate.penalty}** ${eNsf} **Naura Star Fragment**.`;
        }

        // Cari background gambar lokasi sesuai waktu
        let timePeriod = 'pagi';
        if (timeState.label.toLowerCase().includes('siang')) timePeriod = 'siang';
        if (timeState.label.toLowerCase().includes('sore')) timePeriod = 'sore';
        if (timeState.label.toLowerCase().includes('malam')) timePeriod = 'malam';

        let locKey = tujuan === 'village' ? 'desa' : tujuan;
        if (locKey === 'academy') locKey = 'kota';

        const bgFilename = `${locKey}_${timePeriod}.png`;
        const bgPath = path.join(__dirname, '..', 'assets', 'background', bgFilename);

        let files = [];
        let bannerAttachmentName;

        if (fs.existsSync(bgPath)) {
            files.push(new AttachmentBuilder(bgPath, { name: bgFilename }));
            bannerAttachmentName = bgFilename;
        } else {
            const fallbackPath = path.join(__dirname, '..', 'assets', 'background', 'placeholder.png');
            if (fs.existsSync(fallbackPath)) {
                files.push(new AttachmentBuilder(fallbackPath, { name: 'placeholder.png' }));
                bannerAttachmentName = 'placeholder.png';
            }
        }

        const npcConfig = require('../../../plugin/survival/npcs');
        const presentNPCs = Object.values(npcConfig).filter(n => {
            const loc = (typeof n.getLocation === 'function') ? n.getLocation(survival.inGameHour || 6) : n.location;
            return loc === tujuan;
        });

        let talkRow;
        if (presentNPCs.length > 0) {
            talkRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`travel_talk_npc_${tujuan}`)
                    .setLabel('Bicara dengan Warga')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(ui.getEmoji('talk') || '🗣️')
            );
        }

        const payload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: `${ui.getEmoji('lokasi') || '🗺️'} Perjalanan Tiba di Tujuan`,
            description: desc,
            bannerAttachmentName,
            buttonsRow: talkRow,
            footerText: ui.getFooter('survival')
        });

        const response = await interaction.reply({ ...payload, files, components: payload.components, fetchReply: true });

        if (presentNPCs.length > 0 && response && response.createMessageComponentCollector) {
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === user.id && i.customId.startsWith('travel_talk_npc_'),
                time: 60000
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`travel_talk_npc_disabled`)
                        .setLabel('Bicara dengan Warga')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(ui.getEmoji('talk') || '🗣️')
                        .setDisabled(true)
                );
                await i.editReply({ components: [disabledRow] }).catch(() => { });

                const npcHandler = require('./npc.js');
                await npcHandler.execute(i, client);
            });
        }
        return response;
    }
};