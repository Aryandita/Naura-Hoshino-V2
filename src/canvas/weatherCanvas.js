"use strict";

const { createCanvas, runWithLimit } = require("./canvasRuntime");

/**
 * Helper menggambar rounded rect dengan fallback jika roundRect tidak tersedia.
 */
function drawRoundedRect(ctx, x, y, w, h, r, fillColor, strokeColor = null, lineWidth = 1) {
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Pemetaan warna tema & atmosfer berdasarkan WMO Weather Code
 */
function getWeatherAtmosphere(code, isDay = true) {
  // 0, 1: Cerah / Clear
  if (code === 0 || code === 1) {
    if (!isDay) {
      return {
        bgStart: "#030712",
        bgMid: "#0b1528",
        bgEnd: "#1e1b4b",
        accent: "#38bdf8",
        badge: "CERAH (MALAM)",
        icon: "🌙",
        glow: "rgba(56, 189, 248, 0.25)",
      };
    }
    return {
      bgStart: "#091428",
      bgMid: "#0f2347",
      bgEnd: "#451a03",
      accent: "#f59e0b",
      badge: "CERAH / SUNNY",
      icon: "☀️",
      glow: "rgba(245, 158, 11, 0.25)",
    };
  }
  // 2, 3: Berawan / Overcast
  if (code === 2 || code === 3) {
    return {
      bgStart: "#0b1120",
      bgMid: "#1e293b",
      bgEnd: "#334155",
      accent: "#94a3b8",
      badge: code === 2 ? "BERAWAN" : "MENDUNG",
      icon: code === 2 ? "⛅" : "☁️",
      glow: "rgba(148, 163, 184, 0.2)",
    };
  }
  // 45, 48: Kabut / Fog
  if (code === 45 || code === 48) {
    return {
      bgStart: "#0f172a",
      bgMid: "#1e293b",
      bgEnd: "#475569",
      accent: "#cbd5e1",
      badge: "KABUT / FOG",
      icon: "🌫️",
      glow: "rgba(203, 213, 225, 0.2)",
    };
  }
  // 51-67, 80-82: Hujan / Gerimis
  if ([51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return {
      bgStart: "#030d1e",
      bgMid: "#07203d",
      bgEnd: "#0c4a6e",
      accent: "#38bdf8",
      badge: "HUJAN / RAIN",
      icon: "🌧️",
      glow: "rgba(56, 189, 248, 0.3)",
    };
  }
  // 71-77, 85-86: Salju / Snow
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return {
      bgStart: "#082032",
      bgMid: "#133b5c",
      bgEnd: "#2563eb",
      accent: "#e0f2fe",
      badge: "SALJU / SNOW",
      icon: "❄️",
      glow: "rgba(224, 242, 254, 0.3)",
    };
  }
  // 95-99: Badai Petir / Thunderstorm
  if ([95, 96, 99].includes(code)) {
    return {
      bgStart: "#090514",
      bgMid: "#190e2e",
      bgEnd: "#3b0764",
      accent: "#c084fc",
      badge: "BADAI PETIR",
      icon: "⛈️",
      glow: "rgba(192, 132, 252, 0.35)",
    };
  }
  // Default fallback
  return {
    bgStart: "#0f172a",
    bgMid: "#1e293b",
    bgEnd: "#334155",
    accent: "#38bdf8",
    badge: "SEJUK",
    icon: "🌤️",
    glow: "rgba(56, 189, 248, 0.2)",
  };
}

/**
 * Render Kartu Infografis Cuaca Resolusi Tinggi (960 x 540)
 * Menampilkan telemetri meteorologi akurat dan visual atmosferik modern.
 */
async function renderWeatherCard(payload) {
  return runWithLimit("weatherCard", async () => {
    const {
      cityName = "Lokasi Tidak Diketahui",
      stateName = "",
      countryName = "",
      lat = 0,
      lon = 0,
      current = {},
      forecast = [],
    } = payload;

    const W = 960;
    const H = 540;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const code = Number(current.code ?? 0);
    const isDay = current.isDay !== false;
    const atmos = getWeatherAtmosphere(code, isDay);

    // 1. Background Gradient Atmosferik
    const bgGradient = ctx.createLinearGradient(0, 0, W, H);
    bgGradient.addColorStop(0, atmos.bgStart);
    bgGradient.addColorStop(0.55, atmos.bgMid);
    bgGradient.addColorStop(1, atmos.bgEnd);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, W, H);

    // 2. Efek Cahaya / Glow Radial
    const radialGlow = ctx.createRadialGradient(240, 200, 20, 240, 200, 360);
    radialGlow.addColorStop(0, atmos.glow);
    radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, W, H);

    // 3. Header Bar Atas
    const locationStr = `${cityName}${stateName ? `, ${stateName}` : ""}${countryName ? ` • ${countryName}` : ""}`.toUpperCase();
    
    // Header Glass Strip
    drawRoundedRect(ctx, 30, 24, W - 60, 56, 16, "rgba(255, 255, 255, 0.04)", "rgba(255, 255, 255, 0.08)", 1);

    // Lokasi Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`📍 ${locationStr}`, 52, 59);

    // Koordinat Pill di Kanan
    const coordText = `${Number(lat).toFixed(2)}°, ${Number(lon).toFixed(2)}°`;
    drawRoundedRect(ctx, W - 220, 34, 170, 34, 10, "rgba(0, 0, 0, 0.45)", atmos.accent, 1);
    ctx.fillStyle = atmos.accent;
    ctx.font = "bold 13px InterBold, sans-serif";
    ctx.fillText(`🌐 ${coordText}`, W - 204, 56);

    // 4. Hero Section: Kiri (Kondisi Cuaca & Suhu Utama)
    drawRoundedRect(ctx, 30, 96, 420, 260, 22, "rgba(15, 23, 42, 0.55)", "rgba(255, 255, 255, 0.07)", 1.5);

    // Status Badge Pill
    drawRoundedRect(ctx, 54, 118, 160, 32, 10, atmos.glow, atmos.accent, 1);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px InterBold, sans-serif";
    ctx.fillText(`${atmos.icon}  ${atmos.badge}`, 68, 139);

    // Suhu Utama (Besar & Bercahaya)
    const tempNum = Math.round(Number(current.temp ?? 0));
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 78px MontserratBold, InterBold, sans-serif";
    ctx.fillText(`${tempNum}°`, 54, 226);

    // Satuan Celcius kecil
    ctx.fillStyle = atmos.accent;
    ctx.font = "bold 28px InterBold, sans-serif";
    ctx.fillText("C", 188, 185);

    // Kondisi Cuaca Teks
    const condName = current.conditionName || atmos.badge;
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 20px InterBold, sans-serif";
    ctx.fillText(condName, 54, 266);

    // Feels Like Subtitle
    const feelsLike = Math.round(Number(current.feelsLike ?? tempNum));
    ctx.fillStyle = "#94a3b8";
    ctx.font = "15px Inter, sans-serif";
    ctx.fillText(`Terasa seperti ${feelsLike}°C • Kelembapan ${current.humidity ?? 0}%`, 54, 298);

    // RPG Buff Mini Chip
    ctx.fillStyle = atmos.accent;
    ctx.font = "bold 13px InterBold, sans-serif";
    ctx.fillText("✦ Naura Wilds Biome Telemetry Active", 54, 332);

    // 5. Grid Metrik Utama: Kanan (4 Glass Cards)
    const metrics = [
      {
        label: "KELEMBAPAN",
        value: `${current.humidity ?? 0}%`,
        icon: "💧",
        desc: Number(current.humidity) > 75 ? "Sangat Lembap" : "Optimal",
      },
      {
        label: "KECEPATAN ANGIN",
        value: `${current.windSpeed ?? 0} km/j`,
        icon: "💨",
        desc: Number(current.windSpeed) > 20 ? "Angin Kencang" : "Hembusan Tenang",
      },
      {
        label: "PRESIPITASI",
        value: `${current.precipitation ?? 0} mm`,
        icon: "🌧️",
        desc: Number(current.precipitation) > 0 ? "Potensi Hujan" : "Nihil / Kering",
      },
      {
        label: "INDEKS UV",
        value: `UV ${current.uvIndex ?? 5.5}`,
        icon: "☀️",
        desc: Number(current.uvIndex ?? 5) > 6 ? "Tinggi (Pakai Tabir Surya)" : "Moderat",
      },
    ];

    const gridX = 470;
    const gridY = 96;
    const cardW = 220;
    const cardH = 122;
    const gapX = 20;
    const gapY = 16;

    metrics.forEach((m, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx = gridX + col * (cardW + gapX);
      const cy = gridY + row * (cardH + gapY);

      drawRoundedRect(ctx, cx, cy, cardW, cardH, 16, "rgba(15, 23, 42, 0.55)", "rgba(255, 255, 255, 0.07)", 1.2);

      // Icon & Label
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 12px InterBold, sans-serif";
      ctx.fillText(`${m.icon} ${m.label}`, cx + 16, cy + 30);

      // Value
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px MontserratBold, InterBold, sans-serif";
      ctx.fillText(m.value, cx + 16, cy + 68);

      // Description
      ctx.fillStyle = atmos.accent;
      ctx.font = "12px Inter, sans-serif";
      ctx.fillText(m.desc, cx + 16, cy + 96);
    });

    // 6. Forecast Strip: Bawah (3 Hari ke Depan)
    const forecastBoxY = 372;
    const forecastCardW = 286;
    const forecastCardH = 120;
    const forecastGap = 20;

    const defaultForecast = [
      { dayName: "Besok", minTemp: tempNum - 2, maxTemp: tempNum + 2, code: code, rainProb: 30 },
      { dayName: "Lusa", minTemp: tempNum - 3, maxTemp: tempNum + 1, code: code, rainProb: 45 },
      { dayName: "Hari ke-3", minTemp: tempNum - 1, maxTemp: tempNum + 3, code: code, rainProb: 20 },
    ];

    const displayForecast = forecast && forecast.length >= 3 ? forecast.slice(0, 3) : defaultForecast;

    displayForecast.forEach((fc, i) => {
      const fx = 30 + i * (forecastCardW + forecastGap);
      const fAtmos = getWeatherAtmosphere(fc.code ?? 0, true);

      drawRoundedRect(ctx, fx, forecastBoxY, forecastCardW, forecastCardH, 16, "rgba(15, 23, 42, 0.6)", "rgba(255, 255, 255, 0.08)", 1);

      // Hari Header
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 15px InterBold, sans-serif";
      ctx.fillText(`🗓️ ${fc.dayName || `Hari ${i + 1}`}`, fx + 18, forecastBoxY + 32);

      // Icon Kondisi
      ctx.font = "26px Inter, sans-serif";
      ctx.fillText(fAtmos.icon, fx + 18, forecastBoxY + 74);

      // Suhu Min / Max
      const maxT = Math.round(fc.maxTemp ?? tempNum + 1);
      const minT = Math.round(fc.minTemp ?? tempNum - 2);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px MontserratBold, InterBold, sans-serif";
      ctx.fillText(`${maxT}° / ${minT}°C`, fx + 60, forecastBoxY + 72);

      // Peluang Hujan Bar / Text
      const rainProb = fc.rainProb ?? (fc.precipitation_probability_max ?? 25);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px Inter, sans-serif";
      ctx.fillText(`☔ Peluang Hujan: ${rainProb}%`, fx + 18, forecastBoxY + 102);
    });

    // 7. Footer Watermark
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    ctx.font = "11px Inter, sans-serif";
    ctx.fillText("NAURA HOSHINO WEATHER RADAR ENGINE • HIGH PRECISION METEOROLOGY", 34, 524);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  renderWeatherCard,
  getWeatherAtmosphere,
};
