// Lokasi: plugin/survival/survivalTime.js
const UserSurvival = require('../../src/models/UserSurvival');
const UserProfile = require('../../src/models/UserProfile');
const cacheManager = require('../../src/managers/cacheManager');
const { safeParseInventory } = require('./inventoryHelper');
const ui = require('../../src/config/ui');

async function advanceTime(userId, hoursAdded) {
    const [survival] = await UserSurvival.findOrCreate({ where: { userId } });
    let newHour = (survival.inGameHour || 6) + hoursAdded;
    let newDay = survival.inGameDay || 1;

    let passedOut = false;
    let penaltyAmt = 0;

    // 🛑 CEK APAKAH MELEWATI TENGAH MALAM ATAU STAMINA HABIS

        const rpgState = survival.rpg_state || { sick: false, tax_due: 0, house_seized: false, weather: 'cerah', weather_hour: 0, unlocked_recipes: [], failed_exams: 0, test_cd: 0 };

        // Pengecekan cuaca yang diperbarui setiap beberapa jam (setiap 3 jam ganti cuaca acak)
        if (Math.floor(newHour / 3) !== Math.floor((survival.inGameHour || 6) / 3)) {
            const seed = Math.random() * 100;
            // Dinamis persentase cuaca (misal kalau habis hujan kemungkinan hujan lagi kecil)
            let chanceHujan = rpgState.weather === 'hujan' ? 10 : 30;

            if (seed < chanceHujan) {
                rpgState.weather = 'hujan';
            } else if (seed < chanceHujan + 5) {
                rpgState.weather = 'badai';
            } else {
                rpgState.weather = 'cerah';
            }
        }

        // Cek penyakit jika cuaca buruk dan tidak terlindungi
        const profile = await cacheManager.getUserProfile(userId);
        const inv = safeParseInventory(profile?.inventory);
        const hasRaincoat = inv.some(item => item && item.id === 'raincoat');

        if (!rpgState.sick && (rpgState.weather === 'hujan' || rpgState.weather === 'badai') && !hasRaincoat) {
            // Chance 30% untuk sakit
            if (Math.random() < 0.3) {
                rpgState.sick = true;
            }
        }

        // Update rpg state di database
        survival.rpg_state = rpgState;

    if (newHour >= 24 || survival.stamina <= 0 || survival.hunger <= 0) {
        passedOut = true;

        let clinicType = survival.currentLocation === 'kota' ? 'RS Kota' : 'Klinik Desa';


        while (newHour >= 24) {
            newHour -= 24;
            newDay += 1;

            // Tax calculation
            if (survival.propertyId !== 'jalanan') {
                const taxRates = { 'gudang': 100, 'kos': 250, 'rumah': 500 };
                let dailyTax = taxRates[survival.propertyId] || 0;

                // Add to due
                const rpgState = survival.rpg_state || { sick: false, tax_due: 0, house_seized: false, weather: 'cerah', weather_hour: 0, unlocked_recipes: [], failed_exams: 0, test_cd: 0 };
                rpgState.tax_due += dailyTax;
                survival.rpg_state = rpgState;

                // Attempt Auto Deduction from bank with 20% penalty
                const profile = await cacheManager.getUserProfile(userId);
                if (profile && profile.economy_bank >= (dailyTax * 1.2)) {
                    const updatedBank = profile.economy_bank - Math.floor(dailyTax * 1.2);
                    rpgState.tax_due -= dailyTax;
                    await cacheManager.updateUserProfile(userId, { economy_bank: updatedBank });
                } else {
                    if (rpgState.tax_due > dailyTax * 3) { // 3 days unpaid
                        rpgState.house_seized = true;
                    }
                }
            }
        }

        // Pemain pingsan, terbangun jam 10 pagi keesokan harinya karena sakit
        newHour = 10;
        newDay += 1; // Lompat 1 hari

        // 💸 Eksekusi Denda Pingsan
        const profile = await cacheManager.getUserProfile(userId);
        if (profile) {
            if (clinicType === 'RS Kota') {
                penaltyAmt = 500; // Biaya RS Kota Suster Maya
            } else {
                penaltyAmt = 150; // Biaya Klinik Bidan Sari
            }

            // Jika tidak cukup, uang habis
            if (survival.starFragments < penaltyAmt) penaltyAmt = survival.starFragments;

            const newStarFragments = Math.max(0, (survival.starFragments || 0) - penaltyAmt);
            await UserSurvival.update(
                { starFragments: newStarFragments },
                { where: { userId } }
            );
        }

        // 🚑 Hukuman Fisik: Terbangun dalam kondisi lemas dan dipulangkan
        await UserSurvival.update(
            {
                inGameHour: newHour,
                inGameDay: newDay,
                hunger: 30,
                thirst: 30,
                stamina: 30,
                currentLocation: 'village' // Selalu dipulangkan ke desa (rumah)
            },
            { where: { userId } }
        );

        return { hour: newHour, day: newDay, passedOut: true, penalty: penaltyAmt, clinic: clinicType };
    }


    // Jika waktu berjalan normal (tidak lewat tengah malam)
    let advancedDays = 0;
    while (newHour >= 24) {
        newHour -= 24;
        newDay += 1;
        advancedDays++;
    }

    if (advancedDays > 0 && survival.propertyId !== 'jalanan') {
        const taxRates = { 'gudang': 100, 'kos': 250, 'rumah': 500 };
        let dailyTax = taxRates[survival.propertyId] || 0;

        const rpgState = survival.rpg_state || { sick: false, tax_due: 0, house_seized: false, weather: 'cerah', weather_hour: 0, unlocked_recipes: [], failed_exams: 0, test_cd: 0 };
        rpgState.tax_due += (dailyTax * advancedDays);
        survival.rpg_state = rpgState;

        const profile = await cacheManager.getUserProfile(userId);
        if (profile) {

        // Check if currently in prison, advancing time might free them
        if (survival.currentLocation === 'prison' && advancedDays > 0) {
            survival.currentLocation = 'village';
            // Also need to save this manually below
        }
            let totalDue = dailyTax * advancedDays;
            if (profile.economy_bank >= (totalDue * 1.2)) {
                profile.economy_bank -= Math.floor(totalDue * 1.2);
                rpgState.tax_due -= totalDue;
                await profile.save();
            } else if (rpgState.tax_due > dailyTax * 3) {
                rpgState.house_seized = true;
            }
        }
    }


    let finalLocation = survival.currentLocation;
    if (survival.currentLocation === 'prison' && advancedDays > 0) {
        finalLocation = 'village';
    }
    await UserSurvival.update({ inGameHour: newHour, inGameDay: newDay, currentLocation: finalLocation }, { where: { userId } });

    return { hour: newHour, day: newDay, passedOut: false, penalty: 0 };
}

function getTimeState(hour) {
    if (hour >= 6 && hour < 11)
        return { color: ui.colors?.time_morning || '#FDE047', emoji: ui.emojis?.morning || '🌅', label: 'Pagi Hari' };
    if (hour >= 11 && hour < 16)
        return { color: ui.colors?.time_day || '#38BDF8', emoji: ui.emojis?.day || '☀️', label: 'Siang Hari' };
    if (hour >= 16 && hour < 19)
        return {
            color: ui.colors?.time_afternoon || '#F97316',
            emoji: ui.emojis?.afternoon || '🌇',
            label: 'Sore Hari'
        };
    return { color: ui.colors?.time_night || '#1E1B4B', emoji: ui.emojis?.night || '🌙', label: 'Malam Hari' };
}

function getSeason(day) {
    // 2 musim di Indonesia: Kemarau & Penghujan. 1 Musim = 14 hari in-game (2 minggu)
    const dayInCycle = ((day - 1) % 28) + 1;
    if (dayInCycle <= 14) return { name: 'Kemarau', emoji: ui.getEmoji('weather_sunny') || '☀️', multiplier: { water: 2.0, crop: 0.8, stamina: 1.2 } };
    return { name: 'Penghujan', emoji: ui.getEmoji('weather_rain') || '🌧️', multiplier: { water: 0.5, crop: 1.5, stamina: 0.8 } };
}

function getWeather(day, hour) {
    // Pseudo-random weather based on day and hour seed
    const seed = (day * 24 + hour) % 100;
    const season = getSeason(day);

    let weatherData;
    if (season.name === 'Kemarau') {
        if (seed < 70) weatherData = { name: 'Cerah Berawan', emoji: ui.getEmoji('weather_cloudy') || '🌤️', staminaDrain: 1.0 };
        else if (seed < 95) weatherData = { name: 'Gelombang Panas', emoji: ui.getEmoji('weather_heat') || '🔥', staminaDrain: 1.5 };
        else weatherData = { name: 'Hujan Gerimis', emoji: ui.getEmoji('weather_drizzle') || '🌦️', staminaDrain: 0.9 };
    } else {
        if (seed < 40) weatherData = { name: 'Mendung', emoji: ui.getEmoji('weather_overcast') || '☁️', staminaDrain: 1.0 };
        else if (seed < 80) weatherData = { name: 'Hujan Deras', emoji: ui.getEmoji('weather_rain') || '🌧️', staminaDrain: 1.2 };
        else weatherData = { name: 'Badai Petir', emoji: ui.getEmoji('weather_storm') || '⛈️', staminaDrain: 1.8 }; // Sangat menguras stamina jika kerja saat badai
    }

    weatherData.season = season;
    return weatherData;
}

// Menghitung inflasi harga dari cuaca dan musim
function getShopMultiplier(item, weather, season) {
    let multiplier = 1.0;
    if (item.category === 'consumable') {
        if (season.name === 'Kemarau') {
            if (item.effects && item.effects.thirst) multiplier *= 1.5; // Minuman lebih mahal saat kemarau
        } else if (season.name === 'Penghujan') {
             if (item.effects && item.effects.hunger) multiplier *= 1.5; // Makanan lebih mahal saat hujan
        }
    } else if (item.category === 'seed') {
        if (season.name === 'Penghujan') multiplier *= 1.2; // Bibit lebih laku saat hujan
    }
    return multiplier;
}

module.exports = { advanceTime, getTimeState, getSeason, getWeather, getShopMultiplier };
