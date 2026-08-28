/**
 * @namespace: plugin/utility/lfg.js
 * @type: Command
 * @copyright 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 1.0.0
 * @description Role-Aware LFG (Looking for Group) & Team Roster Builder
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

const PRESETS = {
  valorant: {
    name: "Valorant (5v5)",
    max: 5,
    roles: [
      { id: "duelist", label: "Duelist", emoji: "⚔️" },
      { id: "initiator", label: "Initiator", emoji: "🔍" },
      { id: "controller", label: "Controller", emoji: "💨" },
      { id: "sentinel", label: "Sentinel", emoji: "🛡️" },
      { id: "flex", label: "Flex", emoji: "🎯" },
    ],
  },
  mlbb: {
    name: "Mobile Legends (5v5)",
    max: 5,
    roles: [
      { id: "gold", label: "Gold Lane", emoji: "🏹" },
      { id: "mid", label: "Mid Lane", emoji: "🔮" },
      { id: "exp", label: "EXP Lane", emoji: "🛡️" },
      { id: "roam", label: "Roamer", emoji: "💚" },
      { id: "jungle", label: "Jungler", emoji: "🗡️" },
    ],
  },
  genshin: {
    name: "Genshin / HSR Co-op",
    max: 4,
    roles: [
      { id: "dps", label: "Main DPS", emoji: "⚔️" },
      { id: "subdps", label: "Sub DPS", emoji: "⚡" },
      { id: "shielder", label: "Shielder", emoji: "🛡️" },
      { id: "healer", label: "Healer", emoji: "💚" },
    ],
  },
  minecraft: {
    name: "Minecraft Party",
    max: 6,
    roles: [
      { id: "miner", label: "Miner", emoji: "⛏️" },
      { id: "builder", label: "Builder", emoji: "🏰" },
      { id: "farmer", label: "Farmer", emoji: "🌾" },
      { id: "fighter", label: "Fighter", emoji: "⚔️" },
    ],
  },
  dungeon: {
    name: "RPG Dungeon & Raid",
    max: 4,
    roles: [
      { id: "tank", label: "Tank", emoji: "🛡️" },
      { id: "dps", label: "DPS", emoji: "⚔️" },
      { id: "healer", label: "Healer", emoji: "💚" },
      { id: "support", label: "Support", emoji: "🔮" },
    ],
  },
  custom: {
    name: "Custom Party",
    max: 5,
    roles: [
      { id: "attacker", label: "Attacker", emoji: "⚔️" },
      { id: "defender", label: "Defender", emoji: "🛡️" },
      { id: "support", label: "Support", emoji: "💚" },
      { id: "flex", label: "Flex", emoji: "🎯" },
    ],
  },
};

function renderLfgDisplay(state, preset) {
  const currentCount = state.members.length;
  const isFull = currentCount >= state.maxSlots;

  const rosterLines = [];
  for (let i = 0; i < state.maxSlots; i++) {
    const member = state.members[i];
    if (member) {
      rosterLines.push(
        `\`[Slot ${i + 1}]\` ${member.roleEmoji} **${member.roleLabel}**, <@${member.userId}>`,
      );
    } else {
      rosterLines.push(
        `\`[Slot ${i + 1}]\` ⚪ *[Slot Kosong - Klik tombol role untuk gabung]*`,
      );
    }
  }

  const statusText = isFull
    ? `${ui.getEmoji("greenping") || "🟢"} **TIM LENGKAP & SIAP MAIN!**`
    : `${ui.getEmoji("yellowping") || "🟡"} **Mencari Pemain (${currentCount}/${state.maxSlots})**`;

  return buildContainerV2({
    accentColorHex: isFull ? "#22c55e" : ui.getColor("primary") || "#FFB6C1",
    authorName: `Lobby LFG • Dibuat oleh ${state.hostTag}`,
    title: `${ui.getEmoji("arcade") || "🎮"} ${state.title} (${preset.name})`,
    description: [
      `**Status:** ${statusText}`,
      state.description ? `**Catatan:** *${state.description}*` : "",
      "",
      `### ${ui.getEmoji("member") || "👥"} Susunan Tim (Roster):`,
      ...rosterLines,
    ]
      .filter(Boolean)
      .join("\n"),
    footerText: "Klik tombol role di bawah untuk bergabung atau keluar",
  });
}

function buildLfgButtons(preset, state) {
  const isFull = state.members.length >= state.maxSlots;

  const roleButtons = preset.roles
    .slice(0, 4)
    .map((r) =>
      new ButtonBuilder()
        .setCustomId(`lfg_role_${r.id}`)
        .setLabel(r.label)
        .setEmoji(r.emoji)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(isFull),
    );

  const row1 = new ActionRowBuilder().addComponents(roleButtons);

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("lfg_leave")
      .setLabel("Keluar")
      .setEmoji(ui.parseEmoji(ui.getEmoji("logout")) || { name: "🚪" })
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("lfg_ping")
      .setLabel("Ping Tim")
      .setEmoji(ui.parseEmoji(ui.getEmoji("bell")) || { name: "🔔" })
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("lfg_close")
      .setLabel("Tutup Lobby")
      .setEmoji(ui.parseEmoji(ui.getEmoji("trash_can")) || { name: "🗑️" })
      .setStyle(ButtonStyle.Danger),
  );

  return [row1, row2];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lfg")
    .setDescription(
      "Cari teman mabar & susun tim dengan role otomatis (Looking For Group)",
    )
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Buat lobby pencarian tim baru")
        .addStringOption((opt) =>
          opt
            .setName("game")
            .setDescription("Pilih preset game")
            .setRequired(true)
            .addChoices(
              { name: "Valorant (5v5)", value: "valorant" },
              { name: "Mobile Legends (5v5)", value: "mlbb" },
              { name: "Genshin / HSR Co-op (4p)", value: "genshin" },
              { name: "Minecraft Party (6p)", value: "minecraft" },
              { name: "RPG Dungeon & Raid (4p)", value: "dungeon" },
              { name: "Custom Party", value: "custom" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("judul")
            .setDescription(
              "Judul mabar (contoh: Push Rank Immortal / Farming)",
            )
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("slot")
            .setDescription("Jumlah maksimal pemain (opsional jika custom)")
            .setMinValue(2)
            .setMaxValue(10)
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("deskripsi")
            .setDescription("Deskripsi atau persyaratan tambahan")
            .setRequired(false),
        ),
    ),

  async execute(interaction) {
    const gameKey = interaction.options.getString("game");
    const title = interaction.options.getString("judul");
    const customSlot = interaction.options.getInteger("slot");
    const description = interaction.options.getString("deskripsi") || "";

    const preset = PRESETS[gameKey] || PRESETS.custom;
    const maxSlots = customSlot || preset.max;

    const state = {
      hostId: interaction.user.id,
      hostTag: interaction.user.displayName || interaction.user.username,
      title,
      description,
      maxSlots,
      members: [
        {
          userId: interaction.user.id,
          roleId: preset.roles[0].id,
          roleLabel: preset.roles[0].label,
          roleEmoji: preset.roles[0].emoji,
        },
      ],
    };

    const container = renderLfgDisplay(state, preset);
    const buttons = buildLfgButtons(preset, state);

    const responseMsg = await interaction.reply({
      ...container,
      components: [...container.components, ...buttons],
      fetchReply: true,
    });

    const collector = responseMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 3600000, // 1 jam
    });

    collector.on("collect", async (i) => {
      const customId = i.customId;

      // 1. Tutup Lobby
      if (customId === "lfg_close") {
        if (
          i.user.id !== state.hostId &&
          !i.memberPermissions?.has("ManageGuild")
        ) {
          return i.reply({
            content: `${ui.getEmoji("error") || "❌"} Hanya pembuat lobby atau admin yang dapat menutup lobby ini.`,
            flags: 64,
          });
        }
        collector.stop("closed");
        const closedContainer = buildContainerV2({
          accentColorHex: ui.getColor("error") || "#ef4444",
          authorName: "Lobby LFG Ditutup",
          title: `${ui.getEmoji("lock") || "🔒"} Lobby ${state.title} telah ditutup`,
          description: `Lobby ini telah ditutup oleh <@${i.user.id}>. Terima kasih!`,
          footerText: ui.getFooter("utility"),
        });
        return i.update({
          ...closedContainer,
          components: closedContainer.components,
        });
      }

      // 2. Ping Tim
      if (customId === "lfg_ping") {
        const isParticipant = state.members.some((m) => m.userId === i.user.id);
        if (!isParticipant) {
          return i.reply({
            content: `${ui.getEmoji("error") || "❌"} Kamu harus bergabung ke dalam tim untuk memanggil anggota lain.`,
            flags: 64,
          });
        }
        const mentions = state.members.map((m) => `<@${m.userId}>`).join(" ");
        return i.reply({
          content: `${ui.getEmoji("bell") || "🔔"} **Panggilan Mabar LFG (${state.title})!**\nPerhatian untuk tim: ${mentions}\n*Dipanggil oleh <@${i.user.id}>!*`,
        });
      }

      // 3. Keluar dari Tim
      if (customId === "lfg_leave") {
        const existingIdx = state.members.findIndex(
          (m) => m.userId === i.user.id,
        );
        if (existingIdx === -1) {
          return i.reply({
            content: `${ui.getEmoji("info") || "ℹ️"} Kamu belum bergabung di dalam lobby ini.`,
            flags: 64,
          });
        }

        state.members.splice(existingIdx, 1);
        const updated = renderLfgDisplay(state, preset);
        const newButtons = buildLfgButtons(preset, state);
        await i.update({
          ...updated,
          components: [...updated.components, ...newButtons],
        });
        return;
      }

      // 4. Pilih Role
      if (customId.startsWith("lfg_role_")) {
        const roleId = customId.replace("lfg_role_", "");
        const roleObj = preset.roles.find((r) => r.id === roleId) || {
          id: roleId,
          label: roleId,
          emoji: ui.getEmoji("arcade") || "🎮",
        };

        const existingIdx = state.members.findIndex(
          (m) => m.userId === i.user.id,
        );

        if (existingIdx !== -1) {
          // Ganti role
          state.members[existingIdx].roleId = roleObj.id;
          state.members[existingIdx].roleLabel = roleObj.label;
          state.members[existingIdx].roleEmoji = roleObj.emoji;
        } else {
          // Tambah member baru
          if (state.members.length >= state.maxSlots) {
            return i.reply({
              content: `${ui.getEmoji("error") || "❌"} Maaf, slot tim sudah penuh!`,
              flags: 64,
            });
          }
          state.members.push({
            userId: i.user.id,
            roleId: roleObj.id,
            roleLabel: roleObj.label,
            roleEmoji: roleObj.emoji,
          });
        }

        const updated = renderLfgDisplay(state, preset);
        const newButtons = buildLfgButtons(preset, state);

        await i.update({
          ...updated,
          components: [...updated.components, ...newButtons],
        });

        // Cek jika tim baru saja penuh
        if (state.members.length === state.maxSlots) {
          const mentions = state.members.map((m) => `<@${m.userId}>`).join(" ");
          await interaction.followUp({
            content: `${ui.getEmoji("celebrate") || "🎉"} **Tim ${state.title} sudah lengkap!**\nAnggota: ${mentions}\n*Selamat bermain dan semoga menang!* ${ui.getEmoji("star") || "🌟"}`,
          });
        }
      }
    });
  },
};
