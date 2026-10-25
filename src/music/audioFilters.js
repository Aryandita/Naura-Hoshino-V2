"use strict";

const PREMIUM_FILTERS = ["nightcore", "vaporwave", "8d", "karaoke"];

const FILTER_PRESETS = [
  { label: "Normal (Reset)", value: "off", description: "Matikan semua filter DSP", emoji: "📴" },
  { label: "Bass Boost", value: "bassboost", description: "Dentuman bass bertenaga tinggi", emoji: "🔊" },
  { label: "Nightcore", value: "nightcore", description: "Kecepatan dan nada lebih tinggi", emoji: "🌙" },
  { label: "Vaporwave", value: "vaporwave", description: "Tempo lambat santai bernuansa retro reverb", emoji: "🌊" },
  { label: "8D Audio", value: "8d", description: "Rotasi suara spasial 360 derajat", emoji: "🎧" },
  { label: "Pop EQ", value: "pop", description: "Optimal untuk vokal dan melodi cerah", emoji: "🎤" },
  { label: "Soft EQ", value: "soft", description: "Suara hangat dan lembut untuk relaksasi", emoji: "☕" },
  { label: "Treble & Bass", value: "treblebass", description: "Peningkatan frekuensi rendah dan tinggi", emoji: "⚡" },
  { label: "Karaoke", value: "karaoke", description: "Meredam vokal utama penyanyi", emoji: "🎶" },
  { label: "Vibrato", value: "vibrato", description: "Efek getaran gelombang modulasi pitch", emoji: "〰️" },
  { label: "Tremolo", value: "tremolo", description: "Efek fluktuasi amplitudo ritmis", emoji: "🎸" },
];

function applyAudioFilter(player, type) {
  if (!player) return false;
  const normalized = String(type || "").toLowerCase().trim();

  const applyPayload = (payload, name) => {
    player.currentFilterName = name;
    if (typeof player.setFilters === "function") {
      if (!payload || Object.keys(payload).length === 0) {
        if (typeof player.clearFilters === "function") {
          player.clearFilters();
        } else {
          player.setFilters({});
        }
      } else {
        player.setFilters(payload);
      }
    } else if (player.node && player.node.rest && typeof player.node.rest.updatePlayer === "function") {
      player.node.rest.updatePlayer({
        guildId: player.guildId,
        data: { filters: payload || {} },
      }).catch(() => {});
    }
  };

  if (normalized === "off" || normalized === "reset" || normalized === "clear") {
    applyPayload({}, "Original Audio");
  } else if (normalized === "bassboost") {
    applyPayload(
      {
        equalizer: [
          { band: 0, gain: 0.6 },
          { band: 1, gain: 0.67 },
          { band: 2, gain: 0.67 },
          { band: 3, gain: 0 },
          { band: 4, gain: -0.5 },
          { band: 5, gain: 0.15 },
        ],
      },
      "Sub-Bassboost",
    );
  } else if (normalized === "nightcore") {
    applyPayload(
      { timescale: { speed: 1.2, pitch: 1.2, rate: 1.0 } },
      "Nightcore Shift",
    );
  } else if (normalized === "vaporwave") {
    applyPayload(
      { timescale: { speed: 0.8, pitch: 0.8, rate: 1.0 } },
      "Vaporwave Reverb",
    );
  } else if (normalized === "8d") {
    applyPayload(
      { rotation: { rotationHz: 0.2 } },
      "8D Surround",
    );
  } else if (normalized === "pop") {
    applyPayload(
      {
        equalizer: [
          { band: 0, gain: 0.65 },
          { band: 1, gain: 0.45 },
          { band: 2, gain: -0.45 },
          { band: 3, gain: -0.65 },
          { band: 4, gain: -0.35 },
          { band: 5, gain: 0.45 },
        ],
      },
      "Pop EQ",
    );
  } else if (normalized === "soft") {
    applyPayload(
      {
        equalizer: [
          { band: 0, gain: 0 },
          { band: 1, gain: 0 },
          { band: 2, gain: 0 },
          { band: 3, gain: 0 },
          { band: 4, gain: 0 },
          { band: 5, gain: 0 },
          { band: 6, gain: 0 },
          { band: 7, gain: -0.25 },
          { band: 8, gain: -0.25 },
          { band: 9, gain: -0.25 },
          { band: 10, gain: -0.25 },
          { band: 11, gain: -0.25 },
          { band: 12, gain: -0.25 },
          { band: 13, gain: -0.25 },
        ],
      },
      "Soft EQ",
    );
  } else if (normalized === "treblebass") {
    applyPayload(
      {
        equalizer: [
          { band: 0, gain: 0.6 },
          { band: 1, gain: 0.67 },
          { band: 2, gain: 0.67 },
          { band: 3, gain: 0 },
          { band: 4, gain: -0.5 },
          { band: 5, gain: 0.15 },
          { band: 6, gain: -0.45 },
          { band: 7, gain: 0.23 },
          { band: 8, gain: 0.35 },
          { band: 9, gain: 0.45 },
          { band: 10, gain: 0.55 },
          { band: 11, gain: 0.6 },
          { band: 12, gain: 0.55 },
        ],
      },
      "Treble & Bass",
    );
  } else if (normalized === "karaoke") {
    applyPayload(
      {
        karaoke: {
          level: 1.0,
          monoLevel: 1.0,
          filterBand: 220.0,
          filterWidth: 100.0,
        },
      },
      "Karaoke Mode",
    );
  } else if (normalized === "vibrato") {
    applyPayload(
      { vibrato: { frequency: 2.0, depth: 0.5 } },
      "Vibrato Wave",
    );
  } else if (normalized === "tremolo") {
    applyPayload(
      { tremolo: { frequency: 2.0, depth: 0.5 } },
      "Tremolo Rhythm",
    );
  } else {
    return false;
  }
  return true;
}

module.exports = {
  PREMIUM_FILTERS,
  FILTER_PRESETS,
  applyAudioFilter,
};
