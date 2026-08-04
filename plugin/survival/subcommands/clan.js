'use strict';

const GuildClan = require('../../../src/models/GuildClan');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const leveling = require('../survivalLeveling');
const currency = require('../currency');
const { rollCouponDrop, dropLine } = require('../couponRewards');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

const CREATE_COST = 500;
const MAX_MEMBERS = 20;
const RAID_STAMINA = 15;
const BOSS_BASE_HP = 1000;
const BOSS_HP_PER_LEVEL = 200;
const BOSS_VAULT_REWARD = 1500;
const BOSS_PERSONAL_REWARD = 300;

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

function fail(interaction, message) {
    const payload = buildErrorContainerV2({
        title: `${e('shy', '\uD83D\uDE45')} Belum bisa dilakukan`,
        description: message,
        footerText: ui.getFooter('survival')
    });

    return interaction.editReply({ ...payload, embeds: [] });
}

function card(interaction, { color, title, description, expression, footer }) {
    const payload = buildContainerV2({
        accentColorHex: color,
        authorName: 'Naura Clan Hall',
        title,
        iconURL: interaction.user.displayAvatarURL(),
        expression: expression || 'info',
        description,
        footerText: footer || ui.getFooter('survival')
    });

    return interaction.editReply({ ...payload, embeds: [] });
}

async function findUserClan(userId) {
    const allClans = await GuildClan.findAll();
    return allClans.find(c => Array.isArray(c.members) && c.members.includes(userId));
}

function bossMaxHp(level) {
    return BOSS_BASE_HP + ((level || 1) - 1) * BOSS_HP_PER_LEVEL;
}

module.exports = {
    async execute(interaction, client) {
        const action = interaction.options.getString('aksi') || 'info';
        const clanNameInput = interaction.options.getString('nama');
        const amountInput = interaction.options.getInteger('jumlah') || 100;
        const user = interaction.user;
        const guild = interaction.guild;

        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await cacheManager.getUserProfile(user.id);
        const holders = { survival, profile };

        if (action === 'info') {
            const userClan = await findUserClan(user.id);

            if (!userClan) {
                return card(interaction, {
                    color: ui.getColor('warning') || '#FFD700',
                    title: `${e('happy', '\uD83C\uDFD5\uFE0F')} Kamu belum punya klan`,
                    expression: 'info',
                    description: [
                        'Belum ada klan yang kamu ikuti, tapi jangan sedih. Naura bantu jelaskan caranya, ya!',
                        '',
                        `> ${e('read', '\uD83C\uDFF0')} \`/survival clan\` aksi **create** untuk mendirikan klan (biaya ${currency.format(currency.FRAGMENT, CREATE_COST)})`,
                        `> ${e('impressed', '\u2694\uFE0F')} \`/survival clan\` aksi **join** untuk gabung ke klan temanmu`
                    ].join('\n')
                });
            }

            const leaderUser = await client.users.fetch(userClan.leaderId).catch(() => null);
            const leaderName = leaderUser ? leaderUser.username : 'pemimpin misterius';

            return card(interaction, {
                color: ui.getColor('primary') || '#FFB6C1',
                title: `${e('cheers', '\uD83D\uDEE1\uFE0F')} Klan ${userClan.name}`,
                expression: 'info',
                description: [
                    `> ${e('impressed', '\uD83D\uDC51')} Pemimpin: **${leaderName}**`,
                    `> ${e('read', '\uD83D\uDCCA')} Level klan: **${userClan.level}**`,
                    `> ${e('cheers', '\uD83D\uDCB0')} Kas klan: ${currency.format(currency.FRAGMENT, userClan.vault || 0)}`,
                    `> ${e('happy', '\uD83D\uDC65')} Anggota: **${userClan.members.length} / ${MAX_MEMBERS}**`,
                    `> ${e('shocked', '\uD83D\uDC09')} HP boss: **${userClan.bossHp} / ${bossMaxHp(userClan.level)}**`,
                    '',
                    'Ayo ramaikan klanmu! Naura senang lihat kalian bekerja sama.'
                ].join('\n')
            });
        }

        if (action === 'create') {
            if (!clanNameInput) return fail(interaction, 'Naura belum tahu nama klannya. Tulis namanya dulu ya!');

            const existing = await findUserClan(user.id);
            if (existing) return fail(interaction, `Kamu masih anggota klan **${existing.name}**. Keluar dulu sebelum mendirikan yang baru, ya.`);

            const paid = await currency.charge(currency.FRAGMENT, holders, CREATE_COST);
            if (paid === null) {
                return fail(interaction, `Untuk mendirikan klan butuh ${currency.format(currency.FRAGMENT, CREATE_COST)}, sedangkan saldomu belum cukup. Semangat mengumpulkannya!`);
            }

            const newClan = await GuildClan.create({
                name: clanNameInput.trim(),
                leaderId: user.id,
                guildId: guild ? guild.id : 'global',
                members: [user.id],
                vault: CREATE_COST,
                bossHp: BOSS_BASE_HP
            });

            return card(interaction, {
                color: '#FFD700',
                title: `${e('cheers', '\uD83C\uDFF0')} Klanmu resmi berdiri!`,
                expression: 'celebrate',
                description: [
                    `Selamat! Klan **${newClan.name}** sudah berdiri dengan kas awal ${currency.format(currency.FRAGMENT, CREATE_COST)}.`,
                    '',
                    `Ajak temanmu bergabung dengan menyebut nama **${newClan.name}** di aksi **join**. Naura ikut senang!`
                ].join('\n')
            });
        }

        if (action === 'join') {
            if (!clanNameInput) return fail(interaction, 'Naura belum tahu klan mana yang mau kamu masuki. Tulis namanya ya!');

            const existing = await findUserClan(user.id);
            if (existing) return fail(interaction, `Kamu sudah bergabung di klan **${existing.name}**, lho.`);

            const targetClan = await GuildClan.findOne({ where: { name: clanNameInput.trim() } });
            if (!targetClan) return fail(interaction, `Naura cari ke mana-mana, tapi klan **"${clanNameInput}"** tidak ada. Cek ejaannya lagi ya?`);
            if (targetClan.members.length >= MAX_MEMBERS) return fail(interaction, `Klan **${targetClan.name}** sudah penuh (${MAX_MEMBERS} anggota). Coba klan lain, ya.`);

            targetClan.members = [...targetClan.members, user.id];
            targetClan.changed('members', true);
            await targetClan.save();

            return card(interaction, {
                color: ui.getColor('success') || '#22c55e',
                title: `${e('cheers', '\u2694\uFE0F')} Kamu resmi bergabung!`,
                expression: 'success',
                description: `Selamat, kamu sekarang anggota klan **${targetClan.name}**! Kenalan sama yang lain ya, Naura yakin kalian cepat akrab.`
            });
        }

        if (action === 'deposit') {
            const userClan = await findUserClan(user.id);
            if (!userClan) return fail(interaction, 'Kamu belum punya klan, jadi belum ada kas yang bisa diisi.');
            if (amountInput < 1) return fail(interaction, 'Jumlah sumbangannya harus lebih dari nol ya.');

            const paid = await currency.charge(currency.FRAGMENT, holders, amountInput);
            if (paid === null) {
                const owned = currency.balanceOf(currency.FRAGMENT, holders);
                return fail(interaction, `Saldomu belum cukup. Sekarang kamu punya ${currency.format(currency.FRAGMENT, owned)}.`);
            }

            userClan.vault = (userClan.vault || 0) + amountInput;
            let leveledUp = false;

            if (userClan.vault >= userClan.level * 2000) {
                userClan.level += 1;
                leveledUp = true;
            }

            await userClan.save();

            const lines = [
                `Terima kasih! Kamu menyumbang ${currency.format(currency.FRAGMENT, amountInput)} ke kas klan **${userClan.name}**.`,
                '',
                `> ${e('read', '\uD83C\uDFE6')} Kas sekarang: **${userClan.vault.toLocaleString('id-ID')}**`,
                `> ${e('impressed', '\uD83D\uDCCA')} Level klan: **${userClan.level}**`
            ];

            if (leveledUp) lines.push('', `${e('cheers', '\uD83C\uDF89')} Klanmu naik level! Boss raidnya jadi lebih kuat, tapi hadiahnya juga lebih besar.`);

            return card(interaction, {
                color: '#FFD700',
                title: `${e('cheers', '\uD83D\uDCB0')} Sumbanganmu diterima`,
                expression: 'economy',
                description: lines.join('\n')
            });
        }

        if (action === 'raid') {
            const userClan = await findUserClan(user.id);
            if (!userClan) return fail(interaction, 'Kamu belum punya klan, jadi belum ada boss yang bisa diserang.');
            if ((survival.stamina || 0) < RAID_STAMINA) {
                return fail(interaction, `Staminamu tinggal **${survival.stamina || 0}**, sedangkan menyerang boss butuh **${RAID_STAMINA}**. Istirahat dulu ya, Naura khawatir.`);
            }

            survival.stamina -= RAID_STAMINA;
            await survival.save();

            const damage = Math.floor(Math.random() * 50) + ((survival.strength || 1) * 10) + 20;
            let bossHp = (userClan.bossHp || bossMaxHp(userClan.level)) - damage;
            const defeated = bossHp <= 0;
            let couponText = '';

            if (defeated) {
                userClan.vault = (userClan.vault || 0) + BOSS_VAULT_REWARD;
                bossHp = bossMaxHp(userClan.level);

                await currency.reward(currency.FRAGMENT, holders, BOSS_PERSONAL_REWARD);
                await leveling.addPlayerXP(user.id, 150);

                const coupon = await rollCouponDrop('clan_boss_kill', { survival });
                couponText = dropLine(coupon);
            } else {
                await leveling.addPlayerXP(user.id, 30);
            }

            userClan.bossHp = bossHp;
            await userClan.save();

            if (!defeated) {
                return card(interaction, {
                    color: '#ff4757',
                    title: `${e('impressed', '\u2694\uFE0F')} Seranganmu masuk!`,
                    expression: 'success',
                    description: [
                        `Kamu menghajar boss klan dan memberi **${damage} kerusakan**. Keren banget!`,
                        '',
                        `> ${e('shocked', '\uD83D\uDC09')} Sisa HP boss: **${bossHp} / ${bossMaxHp(userClan.level)}**`,
                        '',
                        'Ajak anggota lain menyerang bareng ya, Naura sorakin dari pinggir!'
                    ].join('\n')
                });
            }

            const lines = [
                `Luar biasa! Serangan **${damage} kerusakan** darimu menumbangkan boss klan. Naura sampai bertepuk tangan!`,
                '',
                `> ${e('cheers', '\uD83C\uDF81')} Hadiah pribadi: ${currency.format(currency.FRAGMENT, BOSS_PERSONAL_REWARD)}`,
                `> ${e('read', '\uD83C\uDFE6')} Kas klan bertambah **${BOSS_VAULT_REWARD.toLocaleString('id-ID')}**`,
                `> ${e('impressed', '\uD83C\uDF1F')} Survival XP **+150**`,
                '',
                `Boss berikutnya bangkit dengan **${bossMaxHp(userClan.level)} HP**. Siapkan tenaga ya!`
            ];

            if (couponText) lines.push('', couponText);

            return card(interaction, {
                color: '#FFD700',
                title: `${e('cheers', '\uD83C\uDF89')} Boss klan tumbang!`,
                expression: 'reward',
                description: lines.join('\n')
            });
        }

        return fail(interaction, 'Naura belum mengenali aksi itu. Coba pilih **info**, **create**, **join**, **deposit**, atau **raid** ya.');
    }
};
