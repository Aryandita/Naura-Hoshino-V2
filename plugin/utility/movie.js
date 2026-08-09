const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('movie')
        .setDescription('🎬 Cari informasi film atau serial TV dari database OMDB (IMDb).')
        .addStringOption(opt => opt.setName('judul').setDescription('Judul film atau serial TV').setRequired(true))
        .addIntegerOption(opt => opt.setName('tahun').setDescription('Tahun rilis (opsional, untuk hasil lebih akurat)').setRequired(false)),

    async execute(interaction) {
        const query = interaction.options.getString('judul');
        const year = interaction.options.getInteger('tahun');
        const apiKey = process.env.OMDB_API_KEY;

        if (!apiKey || apiKey === 'YOUR_OMDB_API_KEY_HERE') {
            return interaction.reply({ content: `${ui.getEmoji('cross')} Fitur ini belum dikonfigurasi oleh pemilik bot. (OMDB API Key tidak ditemukan di \`.env\`)`, flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply();

        try {
            // 1. Search OMDB API to get list of matching items
            let searchUrl = `http://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(query)}`;
            if (year) searchUrl += `&y=${year}`;

            const searchRes = await axios.get(searchUrl, { timeout: 8000 });
            if (!searchRes.data || searchRes.data.Response === 'False' || !searchRes.data.Search) {
                return interaction.editReply(`${ui.getEmoji('cross')} Film **${query}** tidak ditemukan.`);
            }

            // Get top 5 search matches
            const results = searchRes.data.Search.slice(0, 5);
            let currentIndex = 0;

            const fetchMovieDetails = async (imdbID) => {
                const detailRes = await axios.get(`http://www.omdbapi.com/?apikey=${apiKey}&i=${imdbID}&plot=full`, { timeout: 8000 });
                return detailRes.data;
            };


            const buildButtonsRow = (index, movieData, disabledAll = false) => {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('movie_prev')
                        .setLabel('« Sebelumnya')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(disabledAll || index === 0),
                    new ButtonBuilder()
                        .setCustomId('movie_page_indicator')
                        .setLabel(`${index + 1} / ${results.length}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('movie_next')
                        .setLabel('Lanjut »')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(disabledAll || index === results.length - 1)
                );

                if (movieData.imdbID) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setLabel('Buka di IMDb')
                            .setStyle(ButtonStyle.Link)
                            .setURL(`https://www.imdb.com/title/${movieData.imdbID}`)
                    );
                }

                return row;
            };

            const buildPayload = (movieData, index, disabledButtons = false) => {
                const synopsis = movieData.Plot && movieData.Plot !== 'N/A' 
                    ? (movieData.Plot.length > 800 ? `${movieData.Plot.substring(0, 797)}...` : movieData.Plot)
                    : 'Tidak ada sinopsis.';

                const fields = [
                    { name: `${ui.getEmoji('movie_genres') || '🎭'} Genre`, value: movieData.Genre || 'N/A' },
                    { name: `${ui.getEmoji('movie_director') || '🎬'} Sutradara`, value: movieData.Director || 'N/A' },
                    { name: `${ui.getEmoji('movie_actors') || '👥'} Aktor`, value: movieData.Actors || 'N/A' },
                    { name: `${ui.getEmoji('movie_rating') || '⭐'} IMDB Rating`, value: `${movieData.imdbRating || 'N/A'} / 10` },
                    { name: `${ui.getEmoji('movie_runtime') || '⏱️'} Durasi`, value: movieData.Runtime || 'N/A' },
                    { name: `${ui.getEmoji('movie_awards') || '🏆'} Penghargaan`, value: movieData.Awards !== 'N/A' ? movieData.Awards : 'Tidak ada' }
                ];

                const posterURL = (movieData.Poster && movieData.Poster !== 'N/A') ? movieData.Poster : null;

                return buildContainerV2({
                    accentColorHex: '#f5c518', // IMDb Yellow
                    authorName: `Naura Movie Library (Hasil ${index + 1}/${results.length})`,
                    title: `${movieData.Title} (${movieData.Year})`,
                    iconURL: posterURL || 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/IMDB_Logo_2016.svg/512px-IMDB_Logo_2016.svg.png',
                    description: synopsis,
                    fields,
                    buttonsRow: buildButtonsRow(index, movieData, disabledButtons),
                    footerText: ui.getFooter('utility')
                });
            };

            // Load first movie details
            let currentMovieData = await fetchMovieDetails(results[currentIndex].imdbID);
            
            const message = await interaction.editReply(buildPayload(currentMovieData, currentIndex));

            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: `${ui.getEmoji('cross')} Gunakan perintah \`/movie\` untuk mencari film Anda sendiri!`, flags: MessageFlags.Ephemeral });
                }

                const oldIndex = currentIndex;
                if (i.customId === 'movie_prev') {
                    currentIndex = Math.max(0, currentIndex - 1);
                } else if (i.customId === 'movie_next') {
                    currentIndex = Math.min(results.length - 1, currentIndex + 1);
                }

                if (currentIndex !== oldIndex) {
                    currentMovieData = await fetchMovieDetails(results[currentIndex].imdbID);
                }

                await i.update(buildPayload(currentMovieData, currentIndex));
            });

            collector.on('end', () => {
                interaction.editReply(buildPayload(currentMovieData, currentIndex, true)).catch(() => {});
            });

        } catch (error) {
            logger.error('[Movie Error]', error);
            await interaction.editReply(`${ui.getEmoji('cross')} Terjadi kesalahan saat mencari informasi film.`);
        }
    }
};
