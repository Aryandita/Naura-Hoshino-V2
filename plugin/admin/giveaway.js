"use strict";

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} = require("discord.js");
const ms = require("ms");
const Giveaway = require("../../src/models/Giveaway");
const ui = require("../../src/config/ui");
const { logger } = require("../../src/managers/logger");
const {
    buildContainerV2,
    buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const GiveawayManager = require("../../src/managers/giveawayManager");

const PARTY = "\u{1F389}";

function ephemeral(payload) {
    return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

function dot() {
    return ui.getEmoji("progressDot") || "\u2022";
}

function managerOf(client) {
    if (client.giveawayManager) return client.giveawayManager;
    client.giveawayManager = new GiveawayManager(client);
    client.giveawayManager.startChecking();
    return client.giveawayManager;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Sistem giveaway Naura")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
        .addSubcommand((sub) =>
            sub
                .setName("start")
                .setDescription("Mulai giveaway baru")
                .addStringOption((opt) =>
                    opt
                        .setName("durasi")
                        .setDescription("Contoh: 1h, 1d, 30m")
                        .setRequired(true),
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName("pemenang")
                        .setDescription("Jumlah pemenang")
                        .setRequired(true)
                        .setMinValue(1),
                )
                .addStringOption((opt) =>
                    opt
                        .setName("hadiah")
                        .setDescription("Hadiah giveaway")
                        .setRequired(true),
                )
                // --- Persyaratan (opsional) ---
                .addRoleOption((opt) =>
                    opt
                        .setName("role_syarat")
                        .setDescription("Role wajib yang harus dimiliki (opsional)")
                        .setRequired(false),
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName("min_level")
                        .setDescription("Level minimum di server ini (opsional)")
                        .setRequired(false)
                        .setMinValue(1),
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName("min_umur_akun")
                        .setDescription("Umur akun Discord minimum dalam hari (anti-bot, opsional)")
                        .setRequired(false)
                        .setMinValue(1),
                )
                .addBooleanOption((opt) =>
                    opt
                        .setName("harus_booster")
                        .setDescription("Hanya Server Booster yang boleh ikut (opsional)")
                        .setRequired(false),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName("end")
                .setDescription("Akhiri giveaway secara paksa")
                .addStringOption((opt) =>
                    opt
                        .setName("message_id")
                        .setDescription("ID pesan giveaway")
                        .setRequired(true),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName("reroll")
                .setDescription("Undi ulang pemenang baru dari peserta yang sama")
                .addStringOption((opt) =>
                    opt
                        .setName("message_id")
                        .setDescription("ID pesan giveaway yang sudah berakhir")
                        .setRequired(true),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName("list")
                .setDescription("Lihat semua giveaway aktif di server ini"),
        ),

    async execute(interaction) {
        const subCmd = interaction.options.getSubcommand();

        // =========================================
        // START
        // =========================================
        if (subCmd === "start") {
            const durasiStr = interaction.options.getString("durasi");
            const durasiMs = ms(durasiStr);

            if (!durasiMs || durasiMs <= 0) {
                return interaction.reply(
                    ephemeral(
                        buildErrorContainerV2({
                            title: "Formatnya belum pas",
                            description:
                                "Naura belum paham durasinya. Coba tulis seperti `1h`, `1d`, atau `30m` ya!",
                            footerText: ui.getFooter("core"),
                        }),
                    ),
                );
            }

            const pemenang = interaction.options.getInteger("pemenang");
            const hadiah = interaction.options.getString("hadiah");
            const reqRole = interaction.options.getRole("role_syarat");
            const minLevel = interaction.options.getInteger("min_level");
            const minUmurAkun = interaction.options.getInteger("min_umur_akun");
            const harusBooster = interaction.options.getBoolean("harus_booster");

            // Bangun objek requirements (hanya bila ada syarat)
            const hasRequirements = reqRole || minLevel || minUmurAkun || harusBooster;
            const requirements = hasRequirements
                ? {
                    requiredRoleId: reqRole?.id || null,
                    minLevel: minLevel || 0,
                    minAccountAgeDays: minUmurAkun || 0,
                    mustBeBooster: harusBooster || false,
                }
                : null;

            const endTimeDate = new Date(Date.now() + durasiMs);
            const unixEnd = Math.floor(endTimeDate.getTime() / 1000);

            // Bangun teks persyaratan untuk ditampilkan
            let syaratLines = "";
            if (requirements) {
                if (requirements.requiredRoleId) syaratLines += `\n${dot()} **Role:** <@&${requirements.requiredRoleId}>`;
                if (requirements.minLevel) syaratLines += `\n${dot()} **Level minimum:** ${requirements.minLevel}`;
                if (requirements.minAccountAgeDays) syaratLines += `\n${dot()} **Umur akun minimum:** ${requirements.minAccountAgeDays} hari`;
                if (requirements.mustBeBooster) syaratLines += `\n${dot()} **Harus:** Server Booster`;
            }

            await interaction.deferReply();

            const payload = buildContainerV2({
                accentColorHex: ui.getColor("accent") || "#F9A8D4",
                title: `${PARTY} GIVEAWAY: ${hadiah}`,
                description:
                    `Klik tombol di bawah untuk ikut serta ya! Naura doakan kamu menang.\n\n` +
                    `${dot()} **Jumlah pemenang:** ${pemenang}\n` +
                    `${dot()} **Disponsori oleh:** <@${interaction.user.id}>\n` +
                    `${dot()} **Berakhir:** <t:${unixEnd}:R>` +
                    syaratLines,
                footerText: ui.getFooter("core"),
            });

            await interaction.editReply(payload);
            const reply = await interaction.fetchReply();

            // Simpan ke DB
            try {
                await Giveaway.create({
                    messageId: reply.id,
                    channelId: interaction.channelId,
                    guildId: interaction.guildId,
                    prize: hadiah,
                    winnersCount: pemenang,
                    endTime: endTimeDate,
                    hostId: interaction.user.id,
                    requirements,
                    participants: [],
                    winners: [],
                });
            } catch (error) {
                logger.error("[Giveaway] Gagal menyimpan giveaway: " + error.message);
                await interaction.editReply(
                    buildErrorContainerV2({
                        title: "Aduh, gagal disimpan",
                        description:
                            "Naura tidak bisa menyimpan giveaway ini, jadi dibatalkan dulu ya. Coba lagi sebentar lagi!",
                        footerText: ui.getFooter("core"),
                    }),
                );
                return;
            }

            // Edit pesan untuk menambahkan tombol setelah messageId diketahui
            const joinButton = GiveawayManager.buildJoinButton(reply.id, 0);
            await reply.edit({ ...payload, components: [joinButton] }).catch(() => {});

            return;
        }

        // =========================================
        // END
        // =========================================
        if (subCmd === "end") {
            const msgId = interaction.options.getString("message_id");
            const gwData = await Giveaway.findByPk(msgId);

            if (!gwData || gwData.ended) {
                return interaction.reply(
                    ephemeral(
                        buildErrorContainerV2({
                            title: "Giveawaynya tidak ada",
                            description: "Naura tidak menemukan giveaway itu, atau giveawaynya sudah berakhir.",
                            footerText: ui.getFooter("core"),
                        }),
                    ),
                );
            }

            await interaction.reply(
                ephemeral(
                    buildContainerV2({
                        accentColorHex: ui.getColor("primary"),
                        title: "Sedang Naura akhiri",
                        expression: "loading",
                        description: "Naura sedang mengundi pemenangnya, tunggu sebentar ya!",
                        footerText: ui.getFooter("core"),
                    }),
                ),
            );

            try {
                await managerOf(interaction.client).endGiveaway(gwData, true);
            } catch (error) {
                logger.error("[Giveaway] Gagal mengakhiri giveaway: " + error.message);
                await interaction.editReply(
                    buildErrorContainerV2({
                        title: "Belum berhasil",
                        description: "Naura gagal mengakhiri giveaway itu. Coba periksa apakah pesannya masih ada ya.",
                        footerText: ui.getFooter("core"),
                    }),
                ).catch(() => {});
            }
            return;
        }

        // =========================================
        // REROLL
        // =========================================
        if (subCmd === "reroll") {
            const msgId = interaction.options.getString("message_id");
            const gwData = await Giveaway.findByPk(msgId);

            if (!gwData || !gwData.ended) {
                return interaction.reply(
                    ephemeral(
                        buildErrorContainerV2({
                            title: "Giveaway tidak ditemukan",
                            description:
                                "Naura tidak menemukan giveaway yang sudah berakhir dengan ID tersebut.",
                            footerText: ui.getFooter("core"),
                        }),
                    ),
                );
            }

            const participants = Array.isArray(gwData.participants) ? gwData.participants : [];
            if (participants.length === 0) {
                return interaction.reply(
                    ephemeral(
                        buildErrorContainerV2({
                            title: "Tidak Ada Peserta",
                            description: "Giveaway ini tidak memiliki peserta, sehingga tidak bisa di-reroll.",
                            footerText: ui.getFooter("core"),
                        }),
                    ),
                );
            }

            await interaction.reply(
                ephemeral(
                    buildContainerV2({
                        accentColorHex: ui.getColor("primary"),
                        title: "🔄 Sedang Re-roll...",
                        description: "Naura mengundi ulang pemenang baru dari peserta yang sama!",
                        footerText: ui.getFooter("core"),
                    }),
                ),
            );

            try {
                await managerOf(interaction.client).rerollGiveaway(gwData);
            } catch (err) {
                logger.error("[Giveaway] Gagal re-roll:", err.message);
            }
            return;
        }

        // =========================================
        // LIST
        // =========================================
        if (subCmd === "list") {
            const activeGiveaways = await Giveaway.findAll({
                where: { guildId: interaction.guildId, ended: false },
                order: [["endTime", "ASC"]],
                limit: 10,
            });

            if (activeGiveaways.length === 0) {
                return interaction.reply(
                    ephemeral(
                        buildContainerV2({
                            accentColorHex: "#93C5FD",
                            title: "📋 Daftar Giveaway Aktif",
                            description: "Belum ada giveaway yang aktif di server ini.",
                            footerText: ui.getFooter("core"),
                        }),
                    ),
                );
            }

            const lines = activeGiveaways.map((gw, i) => {
                const unixEnd = Math.floor(new Date(gw.endTime).getTime() / 1000);
                const participantCount = Array.isArray(gw.participants) ? gw.participants.length : 0;
                return (
                    `**${i + 1}. ${gw.prize}**\n` +
                    `${dot()} Pemenang: ${gw.winnersCount} ${dot()} Peserta: ${participantCount} ${dot()} Berakhir: <t:${unixEnd}:R>\n` +
                    `${dot()} ID Pesan: \`${gw.messageId}\``
                );
            });

            return interaction.reply(
                ephemeral(
                    buildContainerV2({
                        accentColorHex: "#93C5FD",
                        title: `📋 ${activeGiveaways.length} Giveaway Aktif`,
                        description: lines.join("\n\n"),
                        footerText: ui.getFooter("core"),
                    }),
                ),
            );
        }
    },
};
