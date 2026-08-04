'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const UserSurvival = require('../../../src/models/UserSurvival');
const UserPet = require('../../../src/models/UserPet');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const { safeParseInventory, findItem, removeItem } = require('../inventoryHelper');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

const COLLECTOR_MS = 60000;
const BREED_FEE = 5000;
const BREED_MIN_LEVEL = 10;
const MUTANT_CHANCE = 0.1;
const XP_PER_MEAL = 20;
const XP_PER_LEVEL = 100;

// ID di bawah ini sudah dicocokkan dengan katalog item. Versi lama mencari
// 'pet_food' dan 'meat' yang tidak pernah ada, jadi tombol beri makan selalu
// menolak walaupun tas pemain penuh makanan hewan.
const PET_FOODS = [
    { id: 'bone', hunger: 20 },
    { id: 'small_fish', hunger: 30 },
    { id: 'mystic_herb', hunger: 40 },
    { id: 'dragon_meat', hunger: 60 }
];

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

function ephemeral(content) {
    return { content, flags: MessageFlags.Ephemeral };
}

function petLabel(pet) {
    return pet.petName || pet.petType;
}

function statLines(pet) {
    return [
        `**Spesies:** ${String(pet.petType).toUpperCase()}`,
        `**Level:** ${pet.petLevel || 1} (${pet.petExp || 0}/${XP_PER_LEVEL} XP)`,
        `**Lapar:** ${pet.hunger || 0}/100`,
        `**Afeksi:** ${pet.affection || 0}/100`
    ].join('\n');
}

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        await UserSurvival.findOrCreate({ where: { userId: user.id } });

        const pets = await UserPet.findAll({ where: { userId: user.id } });
        if (pets.length === 0) {
            return ui.sendError(interaction, 'err_sys_55', true);
        }

        const pet = pets.find(p => p.isActive) || pets[0];

        const buildPetPayload = (mood, closing) => buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFC0CB',
            authorName: 'Naura Pet Care',
            title: `${e(mood, '\uD83D\uDC3E')} ${petLabel(pet)} nemenin kamu`,
            iconURL: user.displayAvatarURL(),
            description: `${statLines(pet)}\n\n${closing}`,
            footerText: ui.getFooter('survival')
        });

        const greeting = `Naura sempat main sama ${petLabel(pet)} tadi, lucu banget! Rawat dia terus yaa. Kalau sudah cukup kuat, Ki Prawiro mau bantu breeding, lho.`;

        const buildRow = (disabled = false) => new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('pet_feed')
                .setLabel('Beri Makan')
                .setStyle(ButtonStyle.Success)
                .setDisabled(disabled),
            new ButtonBuilder()
                .setCustomId('pet_breed')
                .setLabel('Breeding (Ki Prawiro)')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(disabled)
        );

        const basePayload = buildPetPayload('happy', greeting);
        await interaction.reply({ ...basePayload, components: [...basePayload.components, buildRow()] });
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: COLLECTOR_MS
        });

        const refresh = async (mood, closing) => {
            const updated = buildPetPayload(mood, closing);
            await interaction.editReply({ ...updated, components: [...updated.components, buildRow()] });
        };

        collector.on('collect', async i => {
            await i.deferUpdate();

            if (i.customId === 'pet_feed') {
                const profile = await cacheManager.getUserProfile(user.id);
                const inv = safeParseInventory(profile.inventory);

                const food = PET_FOODS.find(f => findItem(inv, f.id));
                if (!food) {
                    return i.followUp(ephemeral(
                        `${e('akward', '\u274C')} Tas kamu belum ada makanan hewan. Coba beli Tulang atau Ikan Kecil dulu yaa!`
                    ));
                }

                // Dulu satu tumpukan makanan langsung terhapus seluruhnya karena
                // memakai splice. Sekarang hanya satu porsi yang berkurang.
                profile.inventory = removeItem(inv, food.id, 1);
                profile.changed('inventory', true);
                await profile.save();

                pet.hunger = Math.min(100, (pet.hunger || 0) + food.hunger);
                pet.affection = Math.min(100, (pet.affection || 0) + 5);
                pet.petExp = (pet.petExp || 0) + XP_PER_MEAL;

                let naikLevel = false;
                while (pet.petExp >= XP_PER_LEVEL) {
                    pet.petExp -= XP_PER_LEVEL;
                    pet.petLevel = (pet.petLevel || 1) + 1;
                    naikLevel = true;
                }

                await pet.save();

                if (naikLevel) {
                    await i.followUp(ephemeral(
                        `${e('impressed', '\uD83C\uDF89')} **${petLabel(pet)}** naik ke Level ${pet.petLevel}! Naura bangga banget sama kalian berdua.`
                    ));
                }

                return refresh('eating', `Nyam nyam... ${petLabel(pet)} makan dengan lahap. Naura ikut senang lihatnya!`);
            }

            if (i.customId === 'pet_breed') {
                if ((pet.petLevel || 1) < BREED_MIN_LEVEL) {
                    return i.followUp(ephemeral(
                        `${e('thinking', '\u274C')} **Ki Prawiro:** "Peliharaanmu masih terlalu kecil. Latih dulu sampai Level ${BREED_MIN_LEVEL}."`
                    ));
                }

                const profile = await cacheManager.getUserProfile(user.id);
                if ((profile.economy_wallet || 0) < BREED_FEE) {
                    return i.followUp(ephemeral(
                        `${e('cry', '\u274C')} **Ki Prawiro:** "Jasa breeding butuh ${BREED_FEE.toLocaleString('id-ID')} Coin. Uangmu belum cukup."`
                    ));
                }

                await profile.decrement('economy_wallet', { by: BREED_FEE });

                const resultType = Math.random() < MUTANT_CHANCE
                    ? `mutant_${pet.petType}`
                    : pet.petType;

                await UserPet.create({ userId: user.id, petType: resultType, isTamed: true, affection: 10 });

                return i.followUp(ephemeral(
                    `${e('cheers', '\uD83E\uDDEC')} Breeding berhasil! Kamu dapat peliharaan baru bertipe **${resultType.toUpperCase()}**. Selamat yaa!`
                ));
            }
        });

        collector.on('end', async () => {
            // Pesan Components V2 tidak boleh diedit hanya dengan components saja,
            // seluruh payload harus dikirim ulang.
            const closing = buildPetPayload('sleepy', `${petLabel(pet)} sudah ngantuk. Panggil Naura lagi kalau mau main sama dia, yaa!`);
            await interaction.editReply({ ...closing, components: [...closing.components, buildRow(true)] }).catch(() => {});
        });
    }
};
