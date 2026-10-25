const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  AttachmentBuilder,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
const {
  buildContainerV2,
  buildErrorContainerV2,
  buildLoadingContainerV2,
  disableContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const axios = require("axios");
const { getOrCreateBreaker, CircuitBreakerOpenError } = require("../../src/utils/circuitBreaker");
const { ApiResponseCache } = require("../../src/utils/apiResponseCache");

const openMeteoBreaker = getOrCreateBreaker("weather-openmeteo", {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
});

const wttrInBreaker = getOrCreateBreaker("weather-wttrin", {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
});

const weatherCache = new ApiResponseCache({ ttl: 600000, maxSize: 100 });
const geoCache = new ApiResponseCache({ ttl: 86400000, maxSize: 200 });

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
 * Fetch cuaca dari Open-Meteo dengan Circuit Breaker
 */
async function fetchFromOpenMeteo(city) {
  return openMeteoBreaker.execute(async () => {
    const geoCacheKey = `geo:${city.toLowerCase().trim()}`;
    let loc = geoCache.get("geocoding", { key: geoCacheKey });

    if (!loc) {
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

      loc = geoRes.data.results[0];
      geoCache.set("geocoding", { key: geoCacheKey }, loc);
    }

    const weatherRes = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max&timezone=auto`,
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
        isDay: data.current.is_day !== 0,
        uvIndex: data.daily?.uv_index_max?.[0] ?? 5.5,
        precipitationProbability: data.daily?.precipitation_probability_max?.[0] ?? 20,
      },
      daily: {
        time: data.daily.time,
        codes: data.daily.weather_code,
        tempMax: data.daily.temperature_2m_max,
        tempMin: data.daily.temperature_2m_min,
        precip: data.daily.precipitation_sum,
        precipProbMax: data.daily.precipitation_probability_max || [],
        uvMax: data.daily.uv_index_max || [],
      },
    };
  });
}

/**
 * Fetch cuaca dari wttr.in dengan Circuit Breaker
 */
async function fetchFromWttrIn(city) {
  return wttrInBreaker.execute(async () => {
    const res = await axios.get(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      { timeout: 5000 },
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
        code: 2,
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
  });
}

/**
 * Waterfall Weather Retriever dengan Cache & Circuit Breaker
 */
async function fetchWeatherWaterfall(city) {
  const cacheKey = city.toLowerCase().trim();
  
  const cached = weatherCache.get("weather", { city: cacheKey });
  if (cached) {
    logger.debug(`[Weather] Cache hit for "${city}"`);
    return cached;
  }

  let result = null;

  try {
    result = await fetchFromOpenMeteo(city);
    if (result) {
      weatherCache.set("weather", { city: cacheKey }, result);
      return result;
    }
  } catch (err) {
    if (err instanceof CircuitBreakerOpenError) {
      logger.warn(`[Weather] Open-Meteo circuit OPEN, skipping to wttr.in...`);
    } else {
      logger.warn(`[Weather] Open-Meteo error (${err.message}), trying wttr.in...`);
    }
  }

  try {
    result = await fetchFromWttrIn(city);
    if (result) {
      weatherCache.set("weather", { city: cacheKey }, result);
      return result;
    }
  } catch (err) {
    if (err instanceof CircuitBreakerOpenError) {
      logger.warn(`[Weather] wttr.in circuit OPEN, all providers unavailable.`);
    } else {
      logger.warn(`[Weather] wttr.in error (${err.message}).`);
    }
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
        .setAutocomplete(true)
        .setRequired(true),
    ),

  async execute(interaction) {
    const city = interaction.options.getString("kota");

    const loadingPayload = buildLoadingContainerV2({
      interaction,
      authorName: "Naura Weather Analyzer",
      title: "Memeriksa Cuaca...",
      description: `${ui.getEmoji("loading") || "⏳"} ${ui.getEmoji("naura_thinking") || "🤔"} *Naura sedang memeriksa kondisi cuaca di ${city}...*`,
      expression: "thinking",
      withBanner: true,
      footerText: ui.getFooter("utility"),
    });
    await interaction.deferReply();
    await interaction.editReply(loadingPayload);

    try {
      const weatherData = await fetchWeatherWaterfall(city);

      if (!weatherData) {
        const errPayload = buildErrorContainerV2({
          interaction,
          title: "Kota Tidak Ditemukan",
          description: `${ui.getEmoji("naura_akward") || "😅"} Maaf ya, Naura tidak bisa menemukan data cuaca untuk **"${city}"**.\n\n${ui.getEmoji("sparkle") || "✨"} *Coba periksa ejaan nama kotanya atau gunakan nama kota dalam bahasa Inggris, ya!*`,
          expression: "akward",
          withBanner: true,
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

      let weatherAttachment = null;
      try {
        const forecastItems = [
          {
            dayName: "Besok",
            minTemp: daily.tempMin?.[1] ?? current.temp - 2,
            maxTemp: daily.tempMax?.[1] ?? current.temp + 2,
            code: daily.codes?.[1] ?? current.code,
            rainProb: daily.precipProbMax?.[1] ?? 25,
          },
          {
            dayName: "Lusa",
            minTemp: daily.tempMin?.[2] ?? current.temp - 3,
            maxTemp: daily.tempMax?.[2] ?? current.temp + 1,
            code: daily.codes?.[2] ?? current.code,
            rainProb: daily.precipProbMax?.[2] ?? 35,
          },
          {
            dayName: "Hari ke-3",
            minTemp: daily.tempMin?.[3] ?? current.temp - 1,
            maxTemp: daily.tempMax?.[3] ?? current.temp + 3,
            code: daily.codes?.[3] ?? current.code,
            rainProb: daily.precipProbMax?.[3] ?? 20,
          },
        ];

        const cardBuffer = await canvasWorkerPool.execute("renderWeatherCard", {
          cityName,
          stateName,
          countryName,
          lat,
          lon,
          current: {
            ...current,
            conditionName: current.customDesc || getWeatherInfo(current.code).name,
            isDay: current.isDay !== false,
            uvIndex: current.uvIndex ?? 5.5,
          },
          forecast: forecastItems,
        });

        if (cardBuffer) {
          weatherAttachment = new AttachmentBuilder(cardBuffer, { name: "weather-card.png" });
        }
      } catch (canvasErr) {
        logger.warn("[Weather] Gagal merender canvas weather card: " + (canvasErr?.message || canvasErr));
      }

      const buildPayload = (dayIndex, disabledButtons = false) => {
        let title, description, fields, accentColorHex;

        if (dayIndex === -1) {
          const info = getWeatherInfo(current.code);
          accentColorHex = info.color;
          const condName = current.customDesc || info.name;
          title = `${info.emoji} Cuaca Saat Ini di ${cityName}${stateName}, ${countryName}`;
          
          const greeting = current.temp >= 30 
            ? "Panasss banget hari ini! Jangan lupa minum air putih yang banyak ya!" 
            : current.temp <= 20 
              ? "Dingin banget! Pakai jaket tebal biar tidak masuk angin, ya!" 
              : "Cuacanya nyaman hari ini, cocok buat jalan-jalan!";
          
          description = `Kondisi: **${condName}**\nSuhu: **${current.temp}°C** (Terasa seperti ${current.feelsLike}°C)\n\n> ${ui.getEmoji("naura_happy") || "💖"} *${greeting}*${isPremium ? `\n> ${ui.getEmoji("vip") || "💎"} [VIP Telemetry Active]` : ""}`;

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

          const codeVal = current.code;
          let biomeBuff;
          if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(codeVal)) {
            biomeBuff = {
              name: "🌧️ Efek Biome RPG (Hujan)",
              value:
                "• 🎣 Memancing: **+25% Peluang Ikan Langka**\n• ⚡ Konsumsi Stamina: **-10%**",
            };
          } else if ([71, 73, 75, 85, 86].includes(codeVal)) {
            biomeBuff = {
              name: "❄️ Efek Biome RPG (Salju)",
              value:
                "• 🛡️ Defensif Dungeon: **+15% Armor**\n• 🧊 Kecepatan Gerak: -5%",
            };
          } else if ([95, 96, 99].includes(codeVal)) {
            biomeBuff = {
              name: "⚡ Efek Biome RPG (Badai Petir)",
              value:
                "• ⛏️ Tambang: **+30% Rare Ore Drop**\n• ⚔️ Bahaya Monster: **Monster Lebih Agresif (+10% ATK)**",
            };
          } else if ([0, 1].includes(codeVal)) {
            biomeBuff = {
              name: "☀️ Efek Biome RPG (Cerah)",
              value:
                "• 🌾 Panen Ladang: **+20% Hasil Panen**\n• 📜 Quest EXP: **+15% Bonus EXP**",
            };
          } else {
            biomeBuff = {
              name: "⛅ Efek Biome RPG (Sejuk)",
              value:
                "• 🚶 Perjalanan Travel: **Waktu tempuh normal**\n• 💖 Regenerasi HP: **+5 HP / menit**",
            };
          }
          fields.push(biomeBuff);

          if (isPremium) {
            fields.push(
              {
                name: `${ui.getEmoji("lokasi") || "📍"} Koordinat Exact`,
                value: `\`${lat.toFixed(2)}, ${lon.toFixed(2)}\``,
              },
              {
                name: `${ui.getEmoji("about") || "🛰️"} Satelit Status`,
                value: `Live Telemetry OK (${sourceName})`,
              },
            );
          } else {
            fields.push({
              name: `${ui.getEmoji("vip") || "💎"} VIP Weather Metrics`,
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
          description = `Tanggal: **${formatDate(dateStr)}**\nKondisi: **${info.name}**\n\n> ${ui.getEmoji("naura_read") || "📖"} *Rencana aktivitasmu besok? Cek prakiraan ini dulu, ya!*`;
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
          interaction,
          accentColorHex,
          authorName: `Naura Weather Analyzer (${sourceName})`,
          title,
          description,
          fields,
          mediaAttachmentNames: weatherAttachment ? ["weather-card.png"] : [],
          files: weatherAttachment ? [weatherAttachment] : [],
          buttonsRow: buildButtonsRow(dayIndex, disabledButtons),
          footerText: ui.getFooter("utility"),
        });
      };

      const initialPayload = buildPayload(-1);
      const message = await interaction.editReply(initialPayload);

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          const errPayload = buildErrorContainerV2({
            interaction: i,
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

      collector.on("end", (_collected, reason) => {
        if (reason === "time") {
          const disabledPayload = disableContainerV2(buildPayload(-1));
          interaction.editReply(disabledPayload).catch(() => {});
        }
      });
    } catch (error) {
      logger.error("[Weather Error]", error);
      const isCircuitOpen = error instanceof CircuitBreakerOpenError;
      const errPayload = buildErrorContainerV2({
        interaction,
        title: isCircuitOpen ? "Server Cuaca Sedang Istirahat" : "Gagal Memproses",
        description: isCircuitOpen
          ? `${ui.getEmoji("naura_sleepy") || "😴"} Server cuaca sedang terlalu sibuk dan butuh istirahat sebentar. Coba lagi dalam 1-2 menit ya, Naura tungguin!`
          : `${ui.getEmoji("naura_cry") || "😢"} Maaf ya, terjadi kesalahan saat memproses data cuaca. Jaringan mungkin sedang tidak stabil.\n\n${ui.getEmoji("sparkle") || "✨"} *Coba lagi beberapa saat lagi, Naura yakin akan berhasil!*`,
        expression: isCircuitOpen ? "sleepy" : "cry",
        withBanner: true,
        footerText: ui.getFooter("utility"),
      });
      await interaction.editReply(errPayload);
    }
  },

  async autocomplete(interaction) {
    const {
      choice,
      safeRespond,
      fuzzyFilter,
    } = require("../../src/utils/autocompleteHelper");
    const focusedValue = interaction.options.getFocused().toLowerCase();

    const popularCities = [
      { name: "🇮🇩 Jakarta, Indonesia", value: "Jakarta" },
      { name: "🇮🇩 Surabaya, Jawa Timur", value: "Surabaya" },
      { name: "🇮🇩 Bandung, Jawa Barat", value: "Bandung" },
      { name: "🇮🇩 Medan, Sumatera Utara", value: "Medan" },
      { name: "🇮🇩 Semarang, Jawa Tengah", value: "Semarang" },
      { name: "🇮🇩 Makassar, Sulawesi Selatan", value: "Makassar" },
      { name: "🇮🇩 Palembang, Sumatera Selatan", value: "Palembang" },
      { name: "🇮🇩 Denpasar, Bali", value: "Denpasar" },
      { name: "🇮🇩 Yogyakarta, D.I. Yogyakarta", value: "Yogyakarta" },
      { name: "🇮🇩 Malang, Jawa Timur", value: "Malang" },
      { name: "🇮🇩 Balikpapan, Kalimantan Timur", value: "Balikpapan" },
      { name: "🇮🇩 Pontianak, Kalimantan Barat", value: "Pontianak" },
      { name: "🇮🇩 Banjarmasin, Kalimantan Selatan", value: "Banjarmasin" },
      { name: "🇮🇩 Manado, Sulawesi Utara", value: "Manado" },
      { name: "🇮🇩 Jayapura, Papua", value: "Jayapura" },
      { name: "🇯🇵 Tokyo, Jepang", value: "Tokyo" },
      { name: "🇯🇵 Osaka, Jepang", value: "Osaka" },
      { name: "🇰🇷 Seoul, Korea Selatan", value: "Seoul" },
      { name: "🇸🇬 Singapura", value: "Singapore" },
      { name: "🇲🇾 Kuala Lumpur, Malaysia", value: "Kuala Lumpur" },
      { name: "🇹🇭 Bangkok, Thailand", value: "Bangkok" },
      { name: "🇬🇧 London, Inggris", value: "London" },
      { name: "🇺🇸 New York, Amerika Serikat", value: "New York" },
      { name: "🇫🇷 Paris, Prancis", value: "Paris" },
      { name: "🇦🇺 Sydney, Australia", value: "Sydney" },
    ];

    const choices = popularCities.map((c) => choice(c.name, c.value));
    return safeRespond(interaction, fuzzyFilter(choices, focusedValue, 25));
  },
};
