const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anime')
        .setDescription('🔍 Cari informasi detail anime dari MyAnimeList (Rating, Sinopsis, dsb).')
        .addStringOption(opt => 
            opt.setName('judul')
                .setDescription('Judul anime yang ingin dicari')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const query = interaction.options.getString('judul');

        try {
            const response = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`, {
                timeout: 8000
            });


            if (!response.data || !response.data.data || response.data.data.length === 0) {
                const emptyPayload = buildErrorContainerV2({ title: 'Tidak Ditemukan', description: `${ui.getEmoji('error') || '❌'} Anime dengan judul **"${query}"** tidak ditemukan.`, footerText: ui.getFooter('core') });
                return interaction.editReply(emptyPayload);
            }

            const results = response.data.data;
            let currentIndex = 0;


            const buildButtonsRow = (index, disabledAll = false) => {
                const anime = results[index];
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('anime_prev')
                        .setLabel('« Sebelumnya')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(disabledAll || index === 0),
                    new ButtonBuilder()
                        .setCustomId('anime_page_indicator')
                        .setLabel(`${index + 1} / ${results.length}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('anime_next')
                        .setLabel('Lanjut »')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(disabledAll || index === results.length - 1)
                );

                if (anime.url) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setLabel('Buka di MAL')
                            .setStyle(ButtonStyle.Link)
                            .setURL(anime.url)
                    );
                }

                return row;
            };

            const buildPayload = (index, disabledButtons = false) => {
                const anime = results[index];
                const englishTitle = anime.title_english || anime.title;
                const japaneseTitle = anime.title_japanese ? `\n*${anime.title_japanese}*` : '';
                const synopsis = anime.synopsis 
                    ? (anime.synopsis.length > 800 ? `${anime.synopsis.substring(0, 797)}...` : anime.synopsis)
                    : '*Tidak ada sinopsis.*';

                const genres = anime.genres && anime.genres.length > 0 
                    ? anime.genres.map(g => g.name).join(', ') 
                    : 'N/A';

                const score = anime.score ? `${ui.getEmoji('star') || '⭐'} **${anime.score}** / 10` : 'N/A';

                const fields = [
                    { name: `${ui.getEmoji('anime_rating') || '⭐'} Rating MAL`, value: score },
                    { name: `${ui.getEmoji('anime_type') || '📺'} Tipe`, value: anime.type || 'N/A' },
                    { name: `${ui.getEmoji('anime_episodes') || '📼'} Episode`, value: anime.episodes ? `${anime.episodes} Ep` : 'Unknown' },
                    { name: `${ui.getEmoji('anime_status') || '⌛'} Status`, value: anime.status || 'N/A' },
                    { name: `${ui.getEmoji('anime_genres') || '🎭'} Genre`, value: genres },
                    { name: `${ui.getEmoji('anime_age_rating') || '🔞'} Batasan Umur`, value: anime.rating || 'N/A' }
                ];

                return buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#FFB6C1',
                    authorName: `MyAnimeList Intelligence (Hasil ${index + 1}/${results.length})`,
                    title: englishTitle,
                    description: `${japaneseTitle}\n\n${synopsis}`,
                    fields,
                    buttonsRow: buildButtonsRow(index, disabledButtons),
                    footerText: ui.getFooter('utility')
                });
            };

            const message = await interaction.editReply(buildPayload(currentIndex));

            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000 // 2 minutes interaction timeout
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ 
                        content: `${ui.getEmoji('cross')} Perintah ini dibuat oleh orang lain. Ketik \`/anime\` untuk mencari anime favoritmu sendiri!`, 
                        flags: MessageFlags.Ephemeral 
                    });
                }

                if (i.customId === 'anime_prev') {
                    currentIndex = Math.max(0, currentIndex - 1);
                } else if (i.customId === 'anime_next') {
                    currentIndex = Math.min(results.length - 1, currentIndex + 1);
                }

                await i.update(buildPayload(currentIndex));
            });

            collector.on('end', () => {
                interaction.editReply(buildPayload(currentIndex, true)).catch(() => {});
            });

        } catch (error) {
            logger.error('[Anime Search Error]', error);
            const errPayload = buildErrorContainerV2({ title: 'Gagal Koneksi', description: `${ui.getEmoji('error') || '❌'} Terjadi kegagalan saat menghubungkan ke database MyAnimeList. Coba lagi nanti.`, footerText: ui.getFooter('core') });
            await interaction.editReply(errPayload);
        }
    }
};
