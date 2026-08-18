"use strict";

// Handler tombol btn_giveaway_join:<messageId>
// Memverifikasi syarat peserta secara real-time dan mendaftarkannya secara atomik.

const { MessageFlags } = require("discord.js");
const { sequelize } = require("../../managers/dbManager");
const Giveaway = require("../../models/Giveaway");
const UserLeveling = require("../../models/UserLeveling");
const ui = require("../../config/ui");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const { logger } = require("../../managers/logger");

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

/**
 * Verifikasi seluruh persyaratan ikut giveaway.
 * Mengembalikan string alasan penolakan, atau null bila lulus.
 */
async function checkRequirements(interaction, requirements) {
    if (!requirements) return null;

    const member = interaction.member;
    const { requiredRoleId, minLevel, minAccountAgeDays, mustBeBooster } = requirements;

    // 1. Cek role wajib
    if (requiredRoleId) {
        if (!member.roles.cache.has(requiredRoleId)) {
            return `Kamu harus memiliki role <@&${requiredRoleId}> untuk ikut!`;
        }
    }

    // 2. Cek level minimum di guild ini
    if (minLevel && minLevel > 0) {
        const levelData = await UserLeveling.findOne({
            where: { userId: interaction.user.id, guildId: interaction.guildId },
        }).catch(() => null);
        const currentLevel = levelData?.level || 0;
        if (currentLevel < minLevel) {
            return `Kamu harus berada di level **${minLevel}** atau lebih! Level kamu saat ini: **${currentLevel}**.`;
        }
    }

    // 3. Cek umur akun minimum (anti-bot)
    if (minAccountAgeDays && minAccountAgeDays > 0) {
        const createdAt = interaction.user.createdAt;
        const ageMs = Date.now() - createdAt.getTime();
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        if (ageDays < minAccountAgeDays) {
            return `Akun Discord kamu harus berumur minimal **${minAccountAgeDays} hari**! Akun kamu baru berumur **${ageDays} hari**.`;
        }
    }

    // 4. Cek server booster
    if (mustBeBooster) {
        if (!member.premiumSince) {
            return `Kamu harus menjadi **Server Booster** untuk ikut giveaway ini!`;
        }
    }

    return null;
}

module.exports = [
    {
        prefix: "giveaway_join:",
        label: "giveaway-join",
        defer: false,
        async handler(interaction) {
            const messageId = interaction.customId.replace("giveaway_join:", "");
            const userId = interaction.user.id;

            let resultMessage;
            try {
                await sequelize.transaction(async (t) => {
                    const gw = await Giveaway.findByPk(messageId, {
                        lock: t.LOCK.UPDATE,
                        transaction: t,
                    });

                    if (!gw) {
                        resultMessage = { error: "Giveaway ini sudah tidak ada di database." };
                        return;
                    }
                    if (gw.ended || gw.endTime <= new Date()) {
                        resultMessage = { error: "Giveaway ini sudah berakhir." };
                        return;
                    }

                    const participants = Array.isArray(gw.participants) ? gw.participants : [];
                    if (participants.includes(userId)) {
                        resultMessage = { alreadyJoined: true, count: participants.length };
                        return;
                    }

                    // Verifikasi persyaratan real-time
                    const rejectionReason = await checkRequirements(interaction, gw.requirements);
                    if (rejectionReason) {
                        resultMessage = { rejected: rejectionReason };
                        return;
                    }

                    // Daftarkan peserta secara atomik
                    const updated = [...participants, userId];
                    await gw.update({ participants: updated }, { transaction: t });
                    resultMessage = { success: true, count: updated.length, prize: gw.prize };
                });
            } catch (err) {
                logger.error("[GiveawayButton] Gagal mendaftarkan peserta:", err);
                resultMessage = { error: "Terjadi kesalahan internal. Coba lagi!" };
            }

            // Balas berdasarkan hasil (semua ephemeral)
            if (resultMessage.error) {
                return interaction.reply({
                    ...buildErrorContainerV2({
                        title: `${e("cry", "❌")} Gagal`,
                        description: resultMessage.error,
                        footerText: ui.getFooter("core"),
                    }),
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (resultMessage.rejected) {
                return interaction.reply({
                    ...buildErrorContainerV2({
                        title: `${e("hmph", "\uD83D\uDEAB")} Syarat Tidak Terpenuhi`,
                        description: resultMessage.rejected,
                        footerText: ui.getFooter("core"),
                    }),
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (resultMessage.alreadyJoined) {
                return interaction.reply({
                    ...buildContainerV2({
                        accentColorHex: "#F9A8D4",
                        title: `${e("cute", "\uD83D\uDCAD")} Sudah Terdaftar!`,
                        description: `Kamu sudah terdaftar di giveaway ini.\nTotal peserta saat ini: **${resultMessage.count}** orang.\n\nSabar ya, doakan kamu menang!`,
                        footerText: ui.getFooter("core"),
                    }),
                    flags: MessageFlags.Ephemeral,
                });
            }

            return interaction.reply({
                ...buildContainerV2({
                    accentColorHex: "#86EFAC",
                    title: `${e("success", "\uD83C\uDF89")} Yeay! Berhasil Mendaftar!`,
                    description: `Kamu berhasil ikut giveaway **${resultMessage.prize}**!\nTotal peserta sekarang: **${resultMessage.count}** orang.\n\nNaura doakan kamu jadi pemenangnya ya!`,
                    footerText: ui.getFooter("core"),
                }),
                flags: MessageFlags.Ephemeral,
            });
        },
    },
];
