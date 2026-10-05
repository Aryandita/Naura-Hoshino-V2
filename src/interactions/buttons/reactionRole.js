"use strict";

const { PermissionFlagsBits } = require("discord.js");
const ui = require("../../config/ui");
const { logger } = require("../../managers/logger");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    prefix: "role_assign_",
    label: "reaction-role-toggle",
    defer: "reply",
    isEphemeral: true,
    async handler(interaction) {
      if (!interaction.guild) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Khusus Server",
            errorMessage: "Tombol role ini hanya dapat digunakan di dalam server.",
          }),
        );
      }

      const roleId = interaction.customId.replace("role_assign_", "").trim();
      const role =
        interaction.guild.roles.cache.get(roleId) ||
        (await interaction.guild.roles.fetch(roleId).catch(() => null));

      if (!role) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Role Tidak Ditemukan",
            errorMessage:
              "Role ini sepertinya sudah dihapus dari pengaturan server.",
            expression: "shy",
          }),
        );
      }

      const me = interaction.guild.members.me;
      if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Izin Tidak Cukup",
            errorMessage:
              "Naura tidak memiliki izin **Manage Roles** di server ini untuk memberikan role.",
            expression: "warning",
          }),
        );
      }

      if (role.position >= me.roles.highest.position) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Hierarki Role Terlalu Tinggi",
            errorMessage:
              "Posisi role ini berada di atas atau setara dengan role tertinggi Naura.",
            expression: "warning",
          }),
        );
      }

      const member =
        interaction.member ||
        (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

      if (!member) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Membaca Profil",
            errorMessage: "Naura gagal memuat data keanggotaanmu di server ini.",
          }),
        );
      }

      const hasRole = member.roles.cache.has(role.id);

      try {
        if (hasRole) {
          await member.roles.remove(role.id);
          const payload = buildContainerV2({
            accentColorHex: ui.getColor("neutral") || "#64748B",
            title: "Role Berhasil Dilepas",
            expression: "info",
            description: `Role **${role.name}** telah dilepas dari profilmu. Klik tombol lagi jika ingin memasangnya kembali!`,
            footerText: ui.getFooter("core"),
          });
          return interaction.editReply(payload);
        } else {
          await member.roles.add(role.id);
          const payload = buildContainerV2({
            accentColorHex: ui.getColor("success") || "#10B981",
            title: "Role Berhasil Ditambahkan!",
            expression: "celebrate",
            description: `Selamat! Kamu sekarang memiliki role **${role.name}**. Klik tombol ini lagi jika ingin melepasnya.`,
            footerText: ui.getFooter("core"),
          });
          return interaction.editReply(payload);
        }
      } catch (err) {
        logger.error("[ReactionRole] Gagal toggle role: " + err.message);
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Gagal Memperbarui Role",
            errorMessage:
              "Terjadi kendala saat memperbarui role kamu. Pastikan role Naura berada di posisi paling atas.",
            expression: "sad",
          }),
        );
      }
    },
  },
];
