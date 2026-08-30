"use strict";

const { PermissionsBitField } = require("discord.js");

const ui = require("../../../src/config/ui");
const guildSettingsService = require("../../../src/managers/guildSettingsService");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

const MAX_PERSONA = 500;
const MAX_KNOWLEDGE = 1000;

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function failCard(title, description) {
  return buildErrorContainerV2({
    title: `${e("hmph", "\u274C")} ${title}`,
    description,
    footerText: ui.getFooter("core"),
  });
}

function canManage(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

function asBlock(value, emptyText) {
  return value ? `\`\`\`${value}\`\`\`` : `*${emptyText}*`;
}

/** Tampilkan konfigurasi yang berlaku sekarang tanpa mengubah apa pun. */
function overviewCard(interaction, ai) {
  const description = [
    "Ini pengaturan AI yang sedang Naura pakai di server kamu:",
    "",
    "**Sifat kustom (persona):**",
    asBlock(ai?.customPersona, "Belum diatur, jadi Naura tampil apa adanya"),
    "",
    "**FAQ / basis pengetahuan server:**",
    asBlock(
      ai?.serverKnowledge,
      "Belum diatur, Naura belum punya catatan khusus",
    ),
  ].join("\n");

  return buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: `Pengaturan AI \u2014 ${interaction.guild.name}`,
    title: `${e("read", "\u2699\uFE0F")} Konfigurasi AI Naura`,
    iconURL:
      interaction.guild.iconURL() || interaction.client.user.displayAvatarURL(),
    description,
    footerText: "Isi opsi persona atau knowledge kalau mau memperbaruinya.",
  });
}

module.exports = async function settings(interaction) {
  if (!interaction.guild) {
    return interaction.editReply(
      failCard(
        "Khusus di dalam server",
        "Perintah ini cuma bisa dipakai di dalam server Discord yaa, bukan lewat pesan pribadi.",
      ),
    );
  }

  if (!canManage(interaction.member)) {
    return interaction.editReply(
      failCard(
        "Naura belum bisa menuruti",
        "Hanya Administrator atau Pengelola Server yang boleh mengubah pengaturan AI Naura.",
      ),
    );
  }

  const newPersona = interaction.options.getString("persona");
  const newKnowledge = interaction.options.getString("knowledge");

  if (newPersona === null && newKnowledge === null) {
    const settingsData =
      (await guildSettingsService.getGuildSetting(interaction.guild.id)) || {};
    return interaction.editReply(overviewCard(interaction, settingsData.ai));
  }

  if (newPersona !== null && newPersona.length > MAX_PERSONA) {
    return interaction.editReply(
      failCard(
        "Personanya kepanjangan",
        `Naura cuma sanggup mengingat sampai **${MAX_PERSONA} karakter**. Coba diringkas sedikit yaa?`,
      ),
    );
  }

  if (newKnowledge !== null && newKnowledge.length > MAX_KNOWLEDGE) {
    return interaction.editReply(
      failCard(
        "Catatannya kepanjangan",
        `FAQ server maksimal **${MAX_KNOWLEDGE} karakter** yaa. Ambil bagian yang paling penting saja.`,
      ),
    );
  }

  const changes = [];

  await guildSettingsService.updateGuildSetting(
    interaction.guild.id,
    (settingsData) => {
      if (!settingsData.ai) settingsData.ai = {};

      if (newPersona !== null) {
        settingsData.ai.customPersona =
          newPersona.trim() === "" ? null : newPersona.trim();
        changes.push(
          `${e("cheers", "\u2705")} Sifat khusus Naura sudah diperbarui.`,
        );
      }

      if (newKnowledge !== null) {
        settingsData.ai.serverKnowledge =
          newKnowledge.trim() === "" ? null : newKnowledge.trim();
        changes.push(
          `${e("cheers", "\u2705")} Catatan khusus server sudah Naura simpan.`,
        );
      }
    },
  );

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("success") || "#22c55e",
    authorName: `Pengaturan AI \u2014 ${interaction.guild.name}`,
    title: `${e("impressed", "\u2699\uFE0F")} Sudah Naura catat!`,
    iconURL:
      interaction.guild.iconURL() || interaction.client.user.displayAvatarURL(),
    description: `${changes.join("\n")}\n\nMulai sekarang Naura akan mengikuti pengaturan ini di server kamu.`,
    footerText: ui.getFooter("core"),
  });

  return interaction.editReply(payload);
};
