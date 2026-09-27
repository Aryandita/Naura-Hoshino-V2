"use strict";

const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

module.exports = [
  {
    prefix: "btn_vote_skip_",
    label: "music-vote-skip-button",
    onError: "Gagal memproses voting skip.",
    async handler(interaction, client) {
      const guild = interaction.guild;
      if (!guild) return;

      const musicManager = client.musicManager;
      const poru = client.poru;
      const player = poru?.players.get(guild.id);

      if (!player || !player.currentTrack) {
        const errPayload = buildErrorContainerV2({
          title: "Tidak Ada Lagu",
          errorMessage: "Tidak ada lagu yang sedang diputar saat ini.",
          footerText: ui.getFooter("music"),
        });
        return interaction.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      const member = interaction.member;
      const userVc = member?.voice?.channelId;
      if (!userVc || userVc !== player.voiceChannel) {
        const errPayload = buildErrorContainerV2({
          title: "Bukan di Voice Channel",
          errorMessage: "Kakak harus berada di Voice Channel yang sama untuk ikut voting skip.",
          footerText: ui.getFooter("music"),
        });
        return interaction.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      const voiceChannel = guild.channels.cache.get(userVc);
      const nonBotMembers = voiceChannel ? voiceChannel.members.filter((m) => !m.user.bot) : new Map();
      const totalListeners = Math.max(1, nonBotMembers.size);
      const requiredVotes = Math.max(1, Math.ceil(totalListeners * 0.5));

      const { added } = musicManager.addSkipVote(guild.id, interaction.user.id);
      const currentVotes = musicManager.getSkipVotes(guild.id);

      if (currentVotes.size >= requiredVotes) {
        musicManager.clearSkipVotes(guild.id);
        if (typeof player.stopTrack === "function") player.stopTrack();
        else if (player.node && player.node.rest) {
          player.node.rest.updatePlayer({
            guildId: player.guildId,
            data: { track: { encoded: null } },
          }).catch(() => {});
        }

        const successPayload = buildContainerV2({
          accentColorHex: "#10B981",
          title: "⏭️ Voting Skip Berhasil!",
          description: `Batas kuorum voting tercapai (**${currentVotes.size}/${requiredVotes}** suara). Lagu berhasil dilewati!`,
          footerText: ui.getFooter("music"),
        });
        return interaction.update(successPayload);
      }

      if (!added) {
        return interaction.reply({
          content: "Kakak sudah memberikan suara sebelumnya!",
          flags: MessageFlags.Ephemeral,
        });
      }

      // Perbarui tombol dengan jumlah suara terbaru
      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_vote_skip_${guild.id}`)
          .setLabel(`⏭️ Vote Skip (${currentVotes.size}/${requiredVotes})`)
          .setStyle(ButtonStyle.Primary),
      );

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: "🗳️ Voting Skip Lagu",
        description: [
          `Voting untuk melewati lagu **${player.currentTrack.info.title}** sedang berlangsung.`,
          "",
          `Dibutuhkan **${requiredVotes} suara** dari **${totalListeners} pendengar** aktif (Terkumpul: **${currentVotes.size}/${requiredVotes}**).`,
          "- # *Klik tombol di bawah jika Kakak setuju lagu ini dilewati.*",
        ].join("\n"),
        buttonsRow: updatedRow,
        footerText: ui.getFooter("music"),
      });

      return interaction.update(payload);
    },
  },
];
