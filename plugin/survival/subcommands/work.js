const UserSurvival = require('../../../src/models/UserSurvival');
const UserProfile = require('../../../src/models/UserProfile');
const cacheManager = require('../../../src/managers/cacheManager');
const path = require('path');
const fs = require('fs');
const ui = require('../../../src/config/ui');
const { advanceTime, getTimeState, getWeather, getSeason } = require('../../../plugin/survival/survivalTime');
const leveling = require('../../../plugin/survival/survivalLeveling');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const { safeParseInventory } = require('../inventoryHelper');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const pekerjaan = interaction.options.getString('pekerjaan');

        const survival = await cacheManager.getUserSurvival(user.id);

        if (survival.currentLocation === 'prison') {
            return ui.sendError(interaction, 'err_sys_68', true);
        }
        const profile = await cacheManager.getUserProfile(user.id);

        if (survival.currentLocation !== 'kota' && survival.currentLocation !== 'city') {
            return ui.sendError(interaction, 'err_sys_69', true);
        }

        if (survival.hunger <= 25 || survival.thirst <= 25) {
            return ui.sendError(interaction, 'err_sys_70', true);
        }

        const stats = {
            'janitor': { reqInt: 1, reqStr: 1, reqAgi: 1, baseSalary: 200, time: 2, title: 'Tukang Sapu' },
            'office': { reqInt: 10, reqStr: 1, reqAgi: 1, baseSalary: 500, time: 4, title: 'Pekerja Kantoran' },
            'doctor': { reqInt: 30, reqStr: 5, reqAgi: 20, baseSalary: 1500, time: 6, title: 'Dokter Spesialis' },
            'ceo': { reqInt: 80, reqStr: 10, reqAgi: 30, baseSalary: 4500, time: 8, title: 'CEO Perusahaan' }
        };

        const job = stats[pekerjaan] || stats['janitor'];


        if ((survival.intelligence || 1) < job.reqInt || (survival.strength || 1) < job.reqStr || (survival.agility || 1) < job.reqAgi) {
            return ui.sendError(interaction, `Skill kamu belum cukup! Pekerjaan **${job.title}** butuh minimal:\n🧠 ${job.reqInt} INT | 💪 ${job.reqStr} STR | 🏃 ${job.reqAgi} AGI.\n(Stats Kamu: INT ${survival.intelligence || 1}, STR ${survival.strength || 1}, AGI ${survival.agility || 1})`, true);
        }

        const rpgState = survival.rpg_state || { sick: false, tax_due: 0 };
        if (rpgState.sick) {
            return ui.sendError(interaction, `${ui.getEmoji('sick') || '🤒'} Kamu sedang sakit parah! Tidak ada perusahaan yang mau menerima karyawan sakit. Beli obat atau beristirahatlah dulu!`, true);
        }

        if (pekerjaan === 'doctor' || pekerjaan === 'ceo') {
            // Normalisasi inventory untuk mencegah crash 'xxx.some is not a function'
            const safeInv = safeParseInventory(profile.inventory);
            const hasIjazah = safeInv.some(i => i && i.id === 'certificate');
            if (!hasIjazah) {
                return ui.sendError(interaction, `🎓 Pekerjaan **${job.title}** membutuhkan sertifikasi akademik resmi. Kamu harus belajar dan lulus ujian dari Prof. Habibie di Naura Academy (Gunakan command /survival study) terlebih dahulu!`, true);
            }
        }

        // Advance Time and get status
        let timeUpdate = await advanceTime(user.id, job.time);
        let timeState = getTimeState(timeUpdate.hour);
        let weather = getWeather(timeUpdate.day, timeUpdate.hour);
        let season = getSeason(timeUpdate.day);


        const diffHelper = require('../../../plugin/survival/difficultyHelper');
        const diffConfig = diffHelper.getDifficultyConfig(rpgState.difficulty || 'Normal');

        // Pengaruh INT: Bonus gaji
        const intBonus = (survival.intelligence || 1) * 5;
        let salary = Math.floor((job.baseSalary + intBonus) * diffConfig.coinMultiplier);

        // Check active booster items in inventory
        let bestMultiplier = 1.0;
        let activeBoosterName = null;
        if (profile.inventory && profile.inventory.length > 0) {
            const boosterItems = {
                'basic_shovel': { name: 'Sekop Biasa', mult: 1.2 },
                'steel_pickaxe': { name: 'Beliung Baja', mult: 1.5 },
                'enchanted_gloves': { name: 'Sarung Tangan Ajaib', mult: 2.0 },
                'lucky_charm': { name: 'Jimat Keberuntungan', mult: 2.5 },
                'laptop_gaming': { name: 'Laptop Gaming', mult: 3.0 },
                'vip_card': { name: 'Kartu VIP', mult: 4.0 },
                'golden_ticket': { name: 'Tiket Emas', mult: 5.0 }
            };
            for (const item of profile.inventory) {
                if (item && boosterItems[item.id]) {
                    const b = boosterItems[item.id];
                    if (b.mult > bestMultiplier) {
                        bestMultiplier = b.mult;
                        activeBoosterName = b.name;
                    }
                }
            }
        }
        if (bestMultiplier > 1.0) {
            salary = Math.floor(salary * bestMultiplier);
        }

        // VIP Premium Bonus (+50% Salary)
        const isVIP = profile.isPremium && profile.premiumUntil > new Date();
        if (isVIP) {
            salary = Math.floor(salary * 1.5);
        }

        // Calculate costs
        let newHunger = Math.max(0, survival.hunger - Math.floor(job.time * 5 * diffConfig.drainMultiplier));
        let newThirst = Math.max(0, survival.thirst - Math.floor(job.time * 6 * diffConfig.drainMultiplier));


        let newWallet = (survival.starFragments || 0) + salary;

        // Menambahkan XP menggunakan leveling module
        const xpData = await leveling.addPlayerXP(user.id, job.time * 15);

        await UserSurvival.update({
            hunger: newHunger,
            thirst: newThirst
        }, { where: { userId: user.id } });

        await UserSurvival.update({ starFragments: newWallet }, { where: { userId: user.id } });
        // Update Quest Progress
        try {
            const { incrementQuestProgress } = require('../../../plugin/survival/questGenerator');
            await incrementQuestProgress(user.id, 'work_' + pekerjaan);

            const UserQuest = require('../../../src/models/UserQuest');
            const today = new Date().toISOString().split('T')[0];
            let [quest] = await UserQuest.findOrCreate({ where: { userId: user.id }, defaults: { lastReset: today } });
            if (quest.lastReset !== today) {
                quest.workCount = 0; quest.dungeonKills = 0; quest.collectCount = 0; quest.isClaimed = false; quest.lastReset = today;
            }
            quest.workCount++;
            await quest.save();
        } catch(e) {}


        const eNsf = ui.getEmoji('nsf') || '🪙';
        let resultMsg = `Kamu bekerja shift sebagai **${job.title}** selama ${job.time} jam.\nBos memberimu gaji sebesar **${salary.toLocaleString('id-ID')}** ${eNsf} **Naura Star Fragment**! *(Termasuk bonus INT +${intBonus})*`;
        if (isVIP) {
            resultMsg += `\n💎 **VIP Perks:** +50% Bonus Gaji V.I.P diterapkan!`;
        }
        if (activeBoosterName) {
            resultMsg += `\n🚀 **Booster Aktif:** ${activeBoosterName} (Gaji x${bestMultiplier})`;
        }
        if (xpData.hasLeveledUp) {
            resultMsg += `\n\n🌟 **LEVEL UP!** Kamu naik ke **Level ${xpData.currentLevel}**!\nBatas Kapasitas Status naik menjadi **${xpData.maxStatCap}**!`;
        }

        const fields = [
            { name: 'Kondisi Fisik', value: `Lapar: ${Math.floor(newHunger)}% | Haus: ${Math.floor(newThirst)}%` },
            { name: 'Waktu & Cuaca', value: `${timeState.emoji} Hari ${timeUpdate.day}, ${timeUpdate.hour.toString().padStart(2, '0')}:00\n${season.emoji} ${season.name} | ${weather.emoji} ${weather.name}` }
        ];

        const accentColor = weather.name.includes('Badai') ? '#1f2937'
            : weather.name.includes('Hujan') ? '#3b82f6'
            : weather.name.includes('Panas') ? '#ef4444'
            : ui.getColor('success');

        const payload = buildContainerV2({
            accentColorHex: accentColor,
            authorName: 'Naura Employment Center',
            title: `🏢 Selesai Bekerja: ${job.title}`,
            description: resultMsg,
            fields,
            footerText: ui.getFooter('survival')
        });

        return interaction.reply(payload);
    }
};
