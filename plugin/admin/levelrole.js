"use strict";

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require("discord.js");
const {
  getRoleRewards,
  addRoleReward,
  removeRoleReward,
  syncMemberRoles,
} = require("../../src/services/roleSyncService");
const {
  buildContainerV2,
  buildSuccessContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("levelrole")
    .setDescription("Kelola hadiah role otomatis berbasis level dan pencapaian survival")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Daftarkan hadiah role baru untuk milestone tertentu")
        .addStringOption((opt) =>
          opt
            .setName("tipe")
            .setDescription("Kategori milestone yang ingin dihadiahi")
            .setRequired(true)
            .addChoices(
              { name: "⚡ Level Global Server", value: "level" },
              { name: "🌲 Level Survival Wilds", value: "survival_level" },
              { name: "💰 Kekayaan (Total Naura Coins)", value: "wealth" },
              { name: "⭐ Star Fragments Survival", value: "fragments" },
            ),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("threshold")
            .setDescription("Batas angka minimal yang harus dicapai")
            .setRequired(true)
            .setMinValue(1),
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role Discord yang akan disematkan otomatis")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Hapus hadiah role milestone")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role yang ingin dicabut dari daftar milestone")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Lihat semua konfigurasi role reward milestone di server ini"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("sync")
        .setDescription("Sinkronkan role milestone pengguna secara manual")
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("Anggota yang ingin disinkronkan (kosongkan untuk diri sendiri)")
            .setRequired(false),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!guildId) {
      return interaction.reply({
        content: "Perintah ini hanya dapat dijalankan di dalam server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      if (sub === "add") {
        const type = interaction.options.getString("tipe");
        const threshold = interaction.options.getInteger("threshold");
        const role = interaction.options.getRole("role");

        await addRoleReward(guildId, { type, threshold, roleId: role.id });

        const payload = buildSuccessContainerV2({
          title: "Hadiah Role Dikonfigurasi",
          message: [
            `Role <@&${role.id}> berhasil diatur sebagai hadiah milestone:`,
            `> Kategori: **${type.toUpperCase()}**`,
            `> Ambang Batas: **${threshold.toLocaleString("id-ID")}**`,
            "",
            "- # *Anggota yang mencapai batas ini akan menerima role secara otomatis saat naik level atau melalui `/levelrole sync`.*",
          ].join("\n"),
          footerText: ui.getFooter("admin"),
        });
        return interaction.reply(payload);
      }

      if (sub === "remove") {
        const role = interaction.options.getRole("role");
        const success = await removeRoleReward(guildId, role.id);

        if (!success) {
          const errPayload = buildErrorContainerV2({
            title: "Role Tidak Ditemukan",
            errorMessage: `Role <@&${role.id}> tidak terdaftar dalam konfigurasi milestone.`,
            footerText: ui.getFooter("admin"),
          });
          return interaction.reply(errPayload);
        }

        const payload = buildSuccessContainerV2({
          title: "Hadiah Role Dihapus",
          message: `Role <@&${role.id}> telah dihapus dari daftar reward otomatis.`,
          footerText: ui.getFooter("admin"),
        });
        return interaction.reply(payload);
      }

      if (sub === "list") {
        const rules = await getRoleRewards(guildId);

        if (!rules || rules.length === 0) {
          const emptyPayload = buildContainerV2({
            accentColorHex: ui.getColor("info") || "#3B82F6",
            authorName: "NAURA ROLE REWARD MANAGER",
            title: "📜 Daftar Hadiah Role Server",
            description: [
              "Server ini belum memiliki konfigurasi hadiah role otomatis.",
              "",
              "Daftarkan role baru dengan perintah:",
              "`/levelrole add tipe:<tipe> threshold:<angka> role:<@role>`",
            ].join("\n"),
            footerText: ui.getFooter("admin"),
          });
          return interaction.reply(emptyPayload);
        }

        const lines = rules.map((r, idx) => {
          return `${idx + 1}. <@&${r.roleId}> ➔ Syarat: **${r.threshold.toLocaleString("id-ID")}** (${r.type})`;
        });

        const listPayload = buildContainerV2({
          accentColorHex: "#10B981",
          authorName: "NAURA ROLE REWARD MANAGER",
          title: `📜 Konfigurasi Hadiah Role (${rules.length} Aturan)`,
          description: [
            "Berikut adalah role yang akan disematkan secara otomatis:",
            "",
            lines.join("\n"),
          ].join("\n"),
          footerText: ui.getFooter("admin"),
        });
        return interaction.reply(listPayload);
      }

      if (sub === "sync") {
        const targetUser = interaction.options.getUser("target") || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
          return interaction.reply({
            content: "Anggota tidak ditemukan di server ini.",
            flags: MessageFlags.Ephemeral,
          });
        }

        await interaction.deferReply();
        const result = await syncMemberRoles(member);

        let desc;
        if (result.added.length > 0) {
          desc = `Berhasil menyinkronkan role untuk <@${member.id}>! Role baru yang diberikan: **${result.added.join(", ")}**.`;
        } else {
          desc = `Role <@${member.id}> sudah tersinkronisasi penuh dengan seluruh milestone yang memenuhi syarat (${result.totalEligible} role).`;
        }

        const payload = buildSuccessContainerV2({
          title: "Sinkronisasi Role Selesai",
          message: desc,
          footerText: ui.getFooter("admin"),
        });
        return interaction.editReply(payload);
      }
    } catch (err) {
      logger.error("Error executing /levelrole:", err);
      const errPayload = buildErrorContainerV2({
        title: "Terjadi Kesalahan",
        errorMessage: "Gagal memproses konfigurasi levelrole.",
        footerText: ui.getFooter("admin"),
      });
      return interaction.reply(errPayload).catch(() => {});
    }
  },
};
