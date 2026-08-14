const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const axios = require("axios");

const weatherCodes = {
  0: {
    name: "Cerah / Sunny",
    emoji: ui.getEmoji("weather_sunny") || "☀️",
    color: "#f1c40f",
  },
  1: {
    name: "Cerah Berawan / Mainly Clear",
    emoji: ui.getEmoji("weather_mainly_clear") || "🌤️",
    color: "#f1c40f",
  },
  2: {
    name: "Berawan / Partly Cloudy",
    emoji: ui.getEmoji("weather_cloudy") || "⛅",
    color: "#95a5a6",
  },
  3: {
    name: "Mendung / Overcast",
    emoji: ui.getEmoji("weather_overcast") || "☁️",
    color: "#95a5a6",
  },
  45: {
    name: "Kabut / Fog",
    emoji: ui.getEmoji("weather_fog") || "🌫️",
    color: "#bdc3c7",
  },
  48: {
    name: "Kabut Beku / Depositing Rime Fog",
    emoji: ui.getEmoji("weather_fog") || "🌫️",
    color: "#bdc3c7",
  },
  51: {
    name: "Gerimis Ringan / Light Drizzle",
    emoji: ui.getEmoji("weather_rain") || "🌧️",
    color: "#3498db",
  },
  53: {
    name: "Gerimis Sedang / Moderate Drizzle",
    emoji: ui.getEmoji("weather_rain") || "🌧️",
    color: "#3498db",
  },
  55: {
    name: "Gerimis Lebat / Dense Drizzle",
    emoji: ui.getEmoji("weather_rain") || "🌧️",
    color: "#3498db",
  },
  61: {
    name: "Hujan Ringan / Slight Rain",
    emoji: ui.getEmoji("weather_rain") || "🌧️",
    color: "#3498db",
  },
  63: {
    name: "Hujan Sedang / Moderate Rain",
    emoji: ui.getEmoji("weather_rain") || "🌧️",
    color: "#3498db",
  },
  65: {
    name: "Hujan Lebat / Heavy Rain",
    emoji: ui.getEmoji("weather_rain") || "🌧️",
    color: "#2980b9",
  },
  71: {
    name: "Salju Tipis / Slight Snow Fall",
    emoji: ui.getEmoji("weather_snow") || "❄️",
    color: "#ffffff",
  },
  73: {
    name: "Salju Sedang / Moderate Snow Fall",
    emoji: ui.getEmoji("weather_snow") || "❄️",
    color: "#ffffff",
  },
  75: {
    name: "Salju Tebal / Heavy Snow Fall",
    emoji: ui.getEmoji("weather_snow") || "❄️",
    color: "#ffffff",
  },
  80: {
    name: "Hujan Mandi Ringan / Slight Rain Showers",
    emoji: ui.getEmoji("weather_rain") || "🌧️",
    color: "#3498db",
  },
  81: {
    name: "Hujan Mandi Sedang / Moderate Rain Showers",
    emoji: ui.getEmoji("weather_rain") || "🌧️",
    color: "#3498db",
  },
  82: {
    name: "Hujan Mandi Lebat / Violent Rain Showers",
    emoji: ui.getEmoji("weather_rain") || "🌧️",
    color: "#2980b9",
  },
  95: {
    name: "Badai Petir / Thunderstorm",
    emoji: ui.getEmoji("weather_thunder") || "⛈️",
    color: "#9b59b6",
  },
  96: {
    name: "Badai Petir Es Ringan / Thunderstorm with Slight Hail",
    emoji: ui.getEmoji("weather_thunder") || "⛈️",
    color: "#9b59b6",
  },
  99: {
    name: "Badai Petir Es Lebat / Thunderstorm with Heavy Hail",
    emoji: ui.getEmoji("weather_thunder") || "⛈️",
    color: "#9b59b6",
  },
};

function getWeatherInfo(code) {
  return (
    weatherCodes[code] || {
      name: "Tidak Diketahui / Unknown",
      emoji: "⛅",
      color: "#95a5a6",
    }
  );
}

/**
 * Fetch cuaca dari Open-Meteo
 */
async function fetchFromOpenMeteo(city) {
  const geoRes = await axios.get(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=id`,
    { timeout: 5000 },
  );

  if (
    !geoRes.data ||
    !geoRes.data.results ||
    geoRes.data.results.length === 0
  ) {
    return null;
  }

  const loc = geoRes.data.results[0];
  const weatherRes = await axios.get(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`,
    { timeout: 5000 },
  );

  const data = weatherRes.data;
  return {
    sourceName: "Open-Meteo Telemetry",
    cityName: loc.name,
    stateName: loc.admin1 ? `, ${loc.admin1}` : "",
    countryName: loc.country || "Global",
    lat: loc.latitude,
    lon: loc.longitude,
    current: {
      temp: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      precipitation: data.current.precipitation,
      code: data.current.weather_code,
    },
    daily: {
      time: data.daily.time,
      codes: data.daily.weather_code,
      tempMax: data.daily.temperature_2m_max,
      tempMin: data.daily.temperature_2m_min,
      precip: data.daily.precipitation_sum,
    },
  };
}

/**
 * Fetch cuaca dari wttr.in (Public Global Weather Fallback)
 */
async function fetchFromWttrIn(city) {
  const res = await axios.get(
    `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
    {
      timeout: 5000,
    },
  );

  const data = res.data;
  if (!data || !data.current_condition || data.current_condition.length === 0)
    return null;

  const cur = data.current_condition[0];
  const area = data.nearest_area?.[0] || {};
  const areaName = area.areaName?.[0]?.value || city;
  const country = area.country?.[0]?.value || "Global";
  const region = area.region?.[0]?.value ? `, ${area.region[0].value}` : "";

  const forecast = data.weather || [];

  return {
    sourceName: "wttr.in Global Weather",
    cityName: areaName,
    stateName: region,
    countryName: country,
    lat: parseFloat(area.latitude || 0),
    lon: parseFloat(area.longitude || 0),
    current: {
      temp: parseFloat(cur.temp_C),
      feelsLike: parseFloat(cur.FeelsLikeC),
      humidity: parseFloat(cur.humidity),
      windSpeed: parseFloat(cur.windspeedKmph),
      precipitation: parseFloat(cur.precipMM || 0),
      code: 2, // Default partly cloudy
      customDesc: cur.weatherDesc?.[0]?.value || "Berawan",
    },
    daily: {
      time: forecast.map((f) => f.date),
      codes: forecast.map(() => 2),
      tempMax: forecast.map((f) => parseFloat(f.maxtempC)),
      tempMin: forecast.map((f) => parseFloat(f.mintempC)),
      precip: forecast.map((f) => parseFloat(f.hourly?.[0]?.precipMM || 0)),
    },
  };
}

/**
 * Waterfall Weather Retriever
 */
async function fetchWeatherWaterfall(city) {
  try {
    const openMeteo = await fetchFromOpenMeteo(city);
    if (openMeteo) return openMeteo;
  } catch (err) {
    logger.warn(
      `[Weather Search] Open-Meteo error (${err.message}), beralih ke wttr.in...`,
    );
  }

  try {
    const wttr = await fetchFromWttrIn(city);
    if (wttr) return wttr;
  } catch (err) {
    logger.warn(`[Weather Search] wttr.in error (${err.message}).`);
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("weather")
    .setDescription(
      "⛅ Cek cuaca dan ramalan prakiraan cuaca di suatu kota secara lengkap.",
    )
    .addStringOption((opt) =>
      opt
        .setName("kota")
        .setDescription("Nama kota yang ingin dicek cuacanya")
        .setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const city = interaction.options.getString("kota");

    try {
      const weatherData = await fetchWeatherWaterfall(city);

      if (!weatherData) {
        const errPayload = buildErrorContainerV2({
          title: "Kota Tidak Ditemukan",
          description: `${ui.getEmoji("cross") || "❌"} Data cuaca untuk kota **"${city}"** tidak ditemukan di server cuaca.`,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }

      const {
        current,
        daily,
        cityName,
        stateName,
        countryName,
        lat,
        lon,
        sourceName,
      } = weatherData;

      const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      };

      const cacheManager = require("../../src/managers/cacheManager");
      const profile = await cacheManager.getUserProfile(interaction.user.id);
      const isPremium =
        profile.isPremium &&
        profile.premiumUntil &&
        new Date(profile.premiumUntil) > new Date();

      const buildButtonsRow = (activeDay, disabledAll = false) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("weather_current")
            .setLabel("Hari Ini")
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabledAll || activeDay === -1),
          new ButtonBuilder()
            .setCustomId("weather_day_1")
            .setLabel("Besok")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabledAll || activeDay === 1),
          new ButtonBuilder()
            .setCustomId("weather_day_2")
            .setLabel("Lusa")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabledAll || activeDay === 2),
          new ButtonBuilder()
            .setCustomId("weather_day_3")
            .setLabel("Hari ke-3")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabledAll || activeDay === 3),
        );
      };

      const buildPayload = (dayIndex, disabledButtons = false) => {
        let title, description, fields, accentColorHex;

        if (dayIndex === -1) {
          const info = getWeatherInfo(current.code);
          accentColorHex = info.color;
          const condName = current.customDesc || info.name;
          title = `${info.emoji} Cuaca Saat Ini di ${cityName}${stateName}, ${countryName}`;
          description = `Kondisi: **${condName}**${isPremium ? " 💎 [VIP Telemetry]" : ""}`;

          fields = [
            {
              name: `${ui.getEmoji("weather_temp") || "🌡️"} Suhu`,
              value: `${current.temp}°C (Terasa seperti ${current.feelsLike}°C)`,
            },
            {
              name: `${ui.getEmoji("weather_humidity") || "💧"} Kelembapan`,
              value: `${current.humidity}%`,
            },
            {
              name: `${ui.getEmoji("weather_wind") || "💨"} Kecepatan Angin`,
              value: `${current.windSpeed} km/h`,
            },
            {
              name: `${ui.getEmoji("weather_rain") || "🌧️"} Presipitasi`,
              value: `${current.precipitation} mm`,
            },
          ];

          if (isPremium) {
            fields.push(
              {
                name: "📍 Koordinat Exact",
                value: `\`${lat.toFixed(2)}, ${lon.toFixed(2)}\``,
              },
              {
                name: "🛰️ Satelit Status",
                value: `Live Telemetry OK (${sourceName})`,
              },
            );
          } else {
            fields.push({
              name: "💎 VIP Weather Metrics",
              value:
                "Gunakan `/premium` untuk membuka koordinat & telemetry terperinci!",
            });
          }
        } else {
          const dateStr = daily.time[dayIndex] || daily.time[0];
          const wCode = daily.codes[dayIndex] || 0;
          const tempMax = daily.tempMax[dayIndex] || 0;
          const tempMin = daily.tempMin[dayIndex] || 0;
          const precip = daily.precip[dayIndex] || 0;
          const info = getWeatherInfo(wCode);
          accentColorHex = info.color;

          let titlePrefix = "Besok";
          if (dayIndex === 0) titlePrefix = "Hari Ini (Prakiraan)";
          else if (dayIndex === 2) titlePrefix = "Lusa";
          else if (dayIndex === 3) titlePrefix = "Hari ke-3";

          title = `${info.emoji} Prakiraan ${titlePrefix} - ${cityName}`;
          description = `Tanggal: **${formatDate(dateStr)}**\nKondisi: **${info.name}**`;
          fields = [
            {
              name: `${ui.getEmoji("weather_temp_max") || "📈"} Suhu Maks`,
              value: `${tempMax}°C`,
            },
            {
              name: `${ui.getEmoji("weather_temp_min") || "📉"} Suhu Min`,
              value: `${tempMin}°C`,
            },
            {
              name: `${ui.getEmoji("weather_rain") || "🌧️"} Total Hujan`,
              value: `${precip} mm`,
            },
          ];
        }

        return buildContainerV2({
          accentColorHex,
          authorName: `Naura Weather Analyzer (${sourceName})`,
          title,
          description,
          fields,
          buttonsRow: buildButtonsRow(dayIndex, disabledButtons),
          footerText: ui.getFooter("utility"),
        });
      };

      const message = await interaction.editReply(buildPayload(-1));

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          const errPayload = buildErrorContainerV2({
            title: "Akses Ditolak",
            description:
              "Gunakan perintah `/weather` untuk mencari cuaca kota Anda sendiri!",
            footerText: ui.getFooter("utility"),
          });
          return i.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
        }

        let activeDay = -1;
        if (i.customId === "weather_day_1") activeDay = 1;
        else if (i.customId === "weather_day_2") activeDay = 2;
        else if (i.customId === "weather_day_3") activeDay = 3;

        await i.update(buildPayload(activeDay));
      });

      collector.on("end", () => {
        interaction.editReply(buildPayload(-1, true)).catch(() => {});
      });
    } catch (error) {
      logger.error("[Weather Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Memproses",
        description: "Terjadi kesalahan saat memproses data cuaca.",
        footerText: ui.getFooter("utility"),
      });
      await interaction.editReply(errPayload);
    }
  },
};
