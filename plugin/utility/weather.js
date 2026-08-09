const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

const weatherCodes = {
    0: { name: 'Cerah / Sunny', emoji: ui.getEmoji('weather_sunny') || '☀️', color: '#f1c40f' },
    1: { name: 'Cerah Berawan / Mainly Clear', emoji: ui.getEmoji('weather_mainly_clear') || '🌤️', color: '#f1c40f' },
    2: { name: 'Berawan / Partly Cloudy', emoji: ui.getEmoji('weather_cloudy') || '⛅', color: '#95a5a6' },
    3: { name: 'Mendung / Overcast', emoji: ui.getEmoji('weather_overcast') || '☁️', color: '#95a5a6' },
    45: { name: 'Kabut / Fog', emoji: ui.getEmoji('weather_fog') || '🌫️', color: '#bdc3c7' },
    48: { name: 'Kabut Beku / Depositing Rime Fog', emoji: ui.getEmoji('weather_fog') || '🌫️', color: '#bdc3c7' },
    51: { name: 'Gerimis Ringan / Light Drizzle', emoji: ui.getEmoji('weather_rain') || '🌧️', color: '#3498db' },
    53: { name: 'Gerimis Sedang / Moderate Drizzle', emoji: ui.getEmoji('weather_rain') || '🌧️', color: '#3498db' },
    55: { name: 'Gerimis Lebat / Dense Drizzle', emoji: ui.getEmoji('weather_rain') || '🌧️', color: '#3498db' },
    61: { name: 'Hujan Ringan / Slight Rain', emoji: ui.getEmoji('weather_rain') || '🌧️', color: '#3498db' },
    63: { name: 'Hujan Sedang / Moderate Rain', emoji: ui.getEmoji('weather_rain') || '🌧️', color: '#3498db' },
    65: { name: 'Hujan Lebat / Heavy Rain', emoji: ui.getEmoji('weather_rain') || '🌧️', color: '#2980b9' },
    71: { name: 'Salju Tipis / Slight Snow Fall', emoji: ui.getEmoji('weather_snow') || '❄️', color: '#ffffff' },
    73: { name: 'Salju Sedang / Moderate Snow Fall', emoji: ui.getEmoji('weather_snow') || '❄️', color: '#ffffff' },
    75: { name: 'Salju Tebal / Heavy Snow Fall', emoji: ui.getEmoji('weather_snow') || '❄️', color: '#ffffff' },
    80: { name: 'Hujan Mandi Ringan / Slight Rain Showers', emoji: ui.getEmoji('weather_rain') || '🌧️', color: '#3498db' },
    81: { name: 'Hujan Mandi Sedang / Moderate Rain Showers', emoji: ui.getEmoji('weather_rain') || '🌧️', color: '#3498db' },
    82: { name: 'Hujan Mandi Lebat / Violent Rain Showers', emoji: ui.getEmoji('weather_rain') || '🌧️', color: '#2980b9' },
    95: { name: 'Badai Petir / Thunderstorm', emoji: ui.getEmoji('weather_thunder') || '⛈️', color: '#9b59b6' },
    96: { name: 'Badai Petir Es Ringan / Thunderstorm with Slight Hail', emoji: ui.getEmoji('weather_thunder') || '⛈️', color: '#9b59b6' },
    99: { name: 'Badai Petir Es Lebat / Thunderstorm with Heavy Hail', emoji: ui.getEmoji('weather_thunder') || '⛈️', color: '#9b59b6' }
};

function getWeatherInfo(code) {
    return weatherCodes[code] || { name: 'Tidak Diketahui / Unknown', emoji: '⛅', color: '#95a5a6' };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('⛅ Cek cuaca dan ramalan prakiraan cuaca di suatu kota secara lengkap.')
        .addStringOption(opt => opt.setName('kota').setDescription('Nama kota yang ingin dicek cuacanya').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const city = interaction.options.getString('kota');

        try {
            // 1. Geocoding API lookup (Accurate city parsing)
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=id`);
            if (!geoRes.ok) {
                const errPayload = buildErrorContainerV2({
                    title: 'Kota Tidak Ditemukan',
                    description: `Kota **${city}** tidak ditemukan atau layanan geocoding sedang gangguan.`,
                    footerText: ui.getFooter('utility')
                });
                return interaction.editReply(errPayload);
            }
            const geoData = await geoRes.json();
            if (!geoData.results || geoData.results.length === 0) {
                const errPayload = buildErrorContainerV2({
                    title: 'Kota Tidak Ditemukan',
                    description: `Kota **${city}** tidak ditemukan.`,
                    footerText: ui.getFooter('utility')
                });
                return interaction.editReply(errPayload);
            }

            const loc = geoData.results[0];
            const lat = loc.latitude;
            const lon = loc.longitude;
            const cityName = loc.name;
            const countryName = loc.country || 'Unknown';
            const stateName = loc.admin1 ? `, ${loc.admin1}` : '';

            // 2. Weather & Forecast API lookup
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
            if (!weatherRes.ok) {
                const errPayload = buildErrorContainerV2({
                    title: 'Gagal Ambil Cuaca',
                    description: `Gagal mengambil data cuaca untuk **${cityName}**.`,
                    footerText: ui.getFooter('utility')
                });
                return interaction.editReply(errPayload);
            }
            const weatherData = await weatherRes.json();
            const current = weatherData.current;
            const daily = weatherData.daily;

            const formatDate = (dateStr) => {
                const date = new Date(dateStr);
                const options = { day: 'numeric', month: 'short', year: 'numeric' };
                return date.toLocaleDateString('id-ID', options);
            };

            const cacheManager = require('../../src/managers/cacheManager');
            const profile = await cacheManager.getUserProfile(interaction.user.id);
            const isPremium = profile.isPremium && profile.premiumUntil && new Date(profile.premiumUntil) > new Date();

            const buildButtonsRow = (activeDay, disabledAll = false) => {
                return new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('weather_current')
                        .setLabel('Hari Ini')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(disabledAll || activeDay === -1),
                    new ButtonBuilder()
                        .setCustomId('weather_day_1')
                        .setLabel('Besok')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(disabledAll || activeDay === 1),
                    new ButtonBuilder()
                        .setCustomId('weather_day_2')
                        .setLabel('Lusa')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(disabledAll || activeDay === 2),
                    new ButtonBuilder()
                        .setCustomId('weather_day_3')
                        .setLabel('Hari ke-3')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(disabledAll || activeDay === 3)
                );
            };

            const buildPayload = (dayIndex, disabledButtons = false) => {
                let title, description, fields, accentColorHex;

                if (dayIndex === -1) {
                    const info = getWeatherInfo(current.weather_code);
                    accentColorHex = info.color;
                    title = `${info.emoji} Cuaca Saat Ini di ${cityName}${stateName}, ${countryName}`;
                    description = `Kondisi: **${info.name}**${isPremium ? ' 💎 [VIP Telemetry]' : ''}`;

                    fields = [
                        { name: `${ui.getEmoji('weather_temp') || '🌡️'} Suhu`, value: `${current.temperature_2m}°C (Terasa seperti ${current.apparent_temperature}°C)` },
                        { name: `${ui.getEmoji('weather_humidity') || '💧'} Kelembapan`, value: `${current.relative_humidity_2m}%` },
                        { name: `${ui.getEmoji('weather_wind') || '💨'} Kecepatan Angin`, value: `${current.wind_speed_10m} km/h` },
                        { name: `${ui.getEmoji('weather_rain') || '🌧️'} Presipitasi`, value: `${current.precipitation} mm` }
                    ];

                    if (isPremium) {
                        fields.push(
                            { name: `📍 Koordinat Exact`, value: `\`${lat.toFixed(2)}, ${lon.toFixed(2)}\`` },
                            { name: `🛰️ Satelit Status`, value: `Live Telemetry OK` }
                        );
                    } else {
                        fields.push(
                            { name: `💎 VIP Weather Metrics`, value: `Gunakan \`/premium\` untuk membuka koordinat & telemetry terperinci!` }
                        );
                    }
                } else {
                    const dateStr = daily.time[dayIndex];
                    const wCode = daily.weather_code[dayIndex];
                    const tempMax = daily.temperature_2m_max[dayIndex];
                    const tempMin = daily.temperature_2m_min[dayIndex];
                    const precip = daily.precipitation_sum[dayIndex];
                    const info = getWeatherInfo(wCode);
                    accentColorHex = info.color;

                    let titlePrefix = 'Besok';
                    if (dayIndex === 0) titlePrefix = 'Hari Ini (Prakiraan)';
                    else if (dayIndex === 2) titlePrefix = 'Lusa';
                    else if (dayIndex === 3) titlePrefix = 'Hari ke-3';

                    title = `${info.emoji} Prakiraan ${titlePrefix} - ${cityName}`;
                    description = `Tanggal: **${formatDate(dateStr)}**\nKondisi: **${info.name}**`;
                    fields = [
                        { name: `${ui.getEmoji('weather_temp_max') || '📈'} Suhu Maks`, value: `${tempMax}°C` },
                        { name: `${ui.getEmoji('weather_temp_min') || '📉'} Suhu Min`, value: `${tempMin}°C` },
                        { name: `${ui.getEmoji('weather_rain') || '🌧️'} Total Hujan`, value: `${precip} mm` }
                    ];
                }

                return buildContainerV2({
                    accentColorHex,
                    authorName: 'Naura Weather Analyzer',
                    title,
                    description,
                    fields,
                    buttonsRow: buildButtonsRow(dayIndex, disabledButtons),
                    footerText: ui.getFooter('utility')
                });
            };

            const message = await interaction.editReply(buildPayload(-1));

            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    const errPayload = buildErrorContainerV2({
                        title: 'Akses Ditolak',
                        description: 'Gunakan perintah `/weather` untuk mencari cuaca kota Anda sendiri!',
                        footerText: ui.getFooter('utility')
                    });
                    return i.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
                }

                let activeDay = -1;
                if (i.customId === 'weather_day_1') activeDay = 1;
                else if (i.customId === 'weather_day_2') activeDay = 2;
                else if (i.customId === 'weather_day_3') activeDay = 3;

                await i.update(buildPayload(activeDay));
            });

            collector.on('end', () => {
                interaction.editReply(buildPayload(-1, true)).catch(() => { });
            });

        } catch (error) {
            logger.error('[Weather Error]', error);
            const errPayload = buildErrorContainerV2({
                title: 'Gagal Memproses',
                description: 'Terjadi kesalahan saat memproses data cuaca.',
                footerText: ui.getFooter('utility')
            });
            await interaction.editReply(errPayload);
        }
    }
};
