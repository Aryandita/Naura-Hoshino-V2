'use strict';

// ==========================================
// MUSIM, CUACA, DAN PENGALI HARGA
// ==========================================
// Dipisah dari survivalTime.js supaya berkas waktu bisa fokus mengurus
// perpindahan jam dan penyimpanan state, dan supaya menambah satu jenis cuaca
// tidak berarti mengirim ulang seluruh logika waktu.

const ui = require('../../src/config/ui');

const SEASON_LENGTH = 14;
const SEASON_CYCLE = SEASON_LENGTH * 2;

/** Warna, emoji, dan label untuk satu jam dalam game. */
function getTimeState(hour) {
    if (hour >= 6 && hour < 11) {
        return {
            color: ui.getColor('time_morning'),
            emoji: ui.getEmoji('morning') || '\uD83C\uDF05',
            label: 'Pagi Hari'
        };
    }
    if (hour >= 11 && hour < 16) {
        return {
            color: ui.getColor('time_day'),
            emoji: ui.getEmoji('day') || '\u2600\uFE0F',
            label: 'Siang Hari'
        };
    }
    if (hour >= 16 && hour < 19) {
        return {
            color: ui.getColor('time_afternoon'),
            emoji: ui.getEmoji('afternoon') || '\uD83C\uDF07',
            label: 'Sore Hari'
        };
    }
    return {
        color: ui.getColor('time_night'),
        emoji: ui.getEmoji('night') || '\uD83C\uDF19',
        label: 'Malam Hari'
    };
}

/** Dua musim ala Indonesia: Kemarau dan Penghujan, masing-masing 14 hari. */
function getSeason(day) {
    const dayInCycle = ((day - 1) % SEASON_CYCLE) + 1;

    if (dayInCycle <= SEASON_LENGTH) {
        return {
            name: 'Kemarau',
            emoji: ui.getEmoji('weather_sunny') || '\u2600\uFE0F',
            multiplier: { water: 2.0, crop: 0.8, stamina: 1.2 }
        };
    }

    return {
        name: 'Penghujan',
        emoji: ui.getEmoji('weather_rain') || '\uD83C\uDF27\uFE0F',
        multiplier: { water: 0.5, crop: 1.5, stamina: 0.8 }
    };
}

/**
 * Cuaca semu berdasarkan hari dan jam, jadi dua pemain di waktu yang sama
 * selalu melihat cuaca yang sama.
 */
function getWeather(day, hour) {
    const seed = (day * 24 + hour) % 100;
    const season = getSeason(day);

    let weatherData;
    if (season.name === 'Kemarau') {
        if (seed < 70) {
            weatherData = { name: 'Cerah Berawan', emoji: ui.getEmoji('weather_cloudy') || '\uD83C\uDF24\uFE0F', staminaDrain: 1.0 };
        } else if (seed < 95) {
            weatherData = { name: 'Gelombang Panas', emoji: ui.getEmoji('weather_heat') || '\uD83D\uDD25', staminaDrain: 1.5 };
        } else {
            weatherData = { name: 'Hujan Gerimis', emoji: ui.getEmoji('weather_drizzle') || '\uD83C\uDF26\uFE0F', staminaDrain: 0.9 };
        }
    } else if (seed < 40) {
        weatherData = { name: 'Mendung', emoji: ui.getEmoji('weather_overcast') || '\u2601\uFE0F', staminaDrain: 1.0 };
    } else if (seed < 80) {
        weatherData = { name: 'Hujan Deras', emoji: ui.getEmoji('weather_rain') || '\uD83C\uDF27\uFE0F', staminaDrain: 1.2 };
    } else {
        // Bekerja saat badai sangat menguras tenaga.
        weatherData = { name: 'Badai Petir', emoji: ui.getEmoji('weather_storm') || '\u26C8\uFE0F', staminaDrain: 1.8 };
    }

    weatherData.season = season;
    return weatherData;
}

/** Inflasi harga toko mengikuti musim yang sedang berjalan. */
function getShopMultiplier(item, weather, season) {
    let multiplier = 1.0;
    if (!item) return multiplier;

    const activeSeason = season || (weather && weather.season) || getSeason(1);

    if (item.category === 'consumable') {
        if (activeSeason.name === 'Kemarau' && item.effects && item.effects.thirst) {
            multiplier *= 1.5;
        } else if (activeSeason.name === 'Penghujan' && item.effects && item.effects.hunger) {
            multiplier *= 1.5;
        }
    } else if (item.category === 'seed' && activeSeason.name === 'Penghujan') {
        multiplier *= 1.2;
    }

    return multiplier;
}

module.exports = { getTimeState, getSeason, getWeather, getShopMultiplier, SEASON_LENGTH, SEASON_CYCLE };
