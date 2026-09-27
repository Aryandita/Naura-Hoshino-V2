"use strict";

const FILTER_PRESETS = [
  { label: "Normal (Off)", value: "off", description: "Matikan semua filter DSP", emoji: "📴" },
  { label: "Bass Boost", value: "bassboost", description: "Dentuman bass bertenaga tinggi", emoji: "🔊" },
  { label: "Nightcore", value: "nightcore", description: "Kecepatan dan nada lebih tinggi", emoji: "🌙" },
  { label: "8D Audio", value: "8d", description: "Rotasi suara spasial 360 derajat", emoji: "🎧" },
  { label: "Pop EQ", value: "pop", description: "Optimal untuk vokal dan melodi cerah", emoji: "🎤" },
  { label: "Soft EQ", value: "soft", description: "Suara hangat dan lembut untuk relaksasi", emoji: "☕" },
  { label: "Treble & Bass", value: "treblebass", description: "Peningkatan frekuensi rendah dan tinggi", emoji: "⚡" },
  { label: "Karaoke", value: "karaoke", description: "Meredam vokal utama penyanyi", emoji: "🎶" },
  { label: "Vibrato", value: "vibrato", description: "Efek getaran gelombang modulasi pitch", emoji: "〰️" },
  { label: "Tremolo", value: "tremolo", description: "Efek fluktuasi amplitudo ritmis", emoji: "🌊" },
];

function applyAudioFilter(player, type) {
  if (!player) return false;
  if (type === "off") {
    player.clearFilters();
  } else if (type === "bassboost") {
    player.setFilters({
      equalizer: [
        { band: 0, gain: 0.6 },
        { band: 1, gain: 0.67 },
        { band: 2, gain: 0.67 },
        { band: 3, gain: 0 },
        { band: 4, gain: -0.5 },
        { band: 5, gain: 0.15 },
      ],
    });
  } else if (type === "nightcore") {
    player.setFilters({ timescale: { speed: 1.2, pitch: 1.2, rate: 1.0 } });
  } else if (type === "8d") {
    player.setFilters({ rotation: { rotationHz: 0.2 } });
  } else if (type === "pop") {
    player.setFilters({
      equalizer: [
        { band: 0, gain: 0.65 },
        { band: 1, gain: 0.45 },
        { band: 2, gain: -0.45 },
        { band: 3, gain: -0.65 },
        { band: 4, gain: -0.35 },
        { band: 5, gain: 0.45 },
      ],
    });
  } else if (type === "soft") {
    player.setFilters({
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
    });
  } else if (type === "treblebass") {
    player.setFilters({
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
    });
  } else if (type === "karaoke") {
    player.setFilters({
      karaoke: {
        level: 1.0,
        monoLevel: 1.0,
        filterBand: 220.0,
        filterWidth: 100.0,
      },
    });
  } else if (type === "vibrato") {
    player.setFilters({ vibrato: { frequency: 2.0, depth: 0.5 } });
  } else if (type === "tremolo") {
    player.setFilters({ tremolo: { frequency: 2.0, depth: 0.5 } });
  } else {
    return false;
  }
  return true;
}

module.exports = {
  FILTER_PRESETS,
  applyAudioFilter,
};
