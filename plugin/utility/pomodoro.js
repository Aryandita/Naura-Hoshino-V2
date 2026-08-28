/**
 * @namespace: plugin/utility/pomodoro.js
 * @type: Command
 * @copyright 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 1.0.0
 * @description Pomodoro Study & Focus Room with Voice Channel Chime & Focus XP
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const path = require("node:path");
const fs = require("node:fs");
const VoiceManager = require("../../src/managers/voiceManager");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

const activePomodoros = new Map();

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function buildPomodoroContainer(session) {
  const isFocus = session.mode === "focus";
  const statusColor = session.isPaused
    ? "#f59e0b"
    : isFocus
      ? "#60A5FA"
      : "#34D399";
  const modeTitle = isFocus ? "Sesi Fokus Belajar" : "Waktu Istirahat";
  const eIcon = isFocus
    ? ui.getEmoji("book") || "📚"
    : ui.getEmoji("coffee") || "☕";
  const eClock = ui.getEmoji("clock") || "⏳";
  const eFire = ui.getEmoji("fire") || "🔥";
  const eLeaf = ui.getEmoji("bonsai") || "🌿";
  const eSparkle = ui.getEmoji("sparkle") || "💡";

  return buildContainerV2({
    accentColorHex: statusColor,
    authorName: `Pomodoro Timer • ${session.username}`,
    title: `${eIcon} ${modeTitle} (Siklus #${session.cycle})`,
    description: [
      `### ${eClock} Sisa Waktu: \`${formatTime(session.timeLeft)}\``,
      `**Status:** ${session.isPaused ? "⏸️ Dijeda" : isFocus ? `${eFire} Sedang Fokus Bekerja / Belajar` : `${eLeaf} Rehat & Minum Air`}`,
      `**Target Fokus:** ${session.focusDuration / 60} Menit | **Istirahat:** ${session.breakDuration / 60} Menit`,
      session.voiceChannelId
        ? `**Voice Room:** <#${session.voiceChannelId}> (Notifikasi Audio Aktif)`
        : "",
      "",
      `${eSparkle} *Gunakan tombol di bawah untuk mengontrol sesi belajarmu.*`,
    ]
      .filter(Boolean)
      .join("\n"),
    footerText: "Fokus belajar bersama Naura Hoshino",
  });
}

function buildPomodoroButtons(session) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pomodoro_pause")
        .setLabel(session.isPaused ? "Lanjutkan" : "Jeda")
        .setEmoji(session.isPaused ? "▶️" : "⏸️")
        .setStyle(session.isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("pomodoro_skip")
        .setLabel("Lewati Fase")
        .setEmoji("⏭️")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("pomodoro_stop")
        .setLabel("Selesai / Berhenti")
        .setEmoji("⏹️")
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pomodoro")
    .setDescription(
      "Mulai sesi fokus belajar / kerja Pomodoro dengan pengingat suara VC & XP",
    )
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Mulai sesi Pomodoro baru")
        .addIntegerOption((opt) =>
          opt
            .setName("fokus")
            .setDescription("Durasi waktu fokus dalam menit (default 25 menit)")
            .setMinValue(5)
            .setMaxValue(120)
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("istirahat")
            .setDescription(
              "Durasi waktu istirahat dalam menit (default 5 menit)",
            )
            .setMinValue(1)
            .setMaxValue(30)
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("suara_vc")
            .setDescription(
              "Nyalakan pengingat suara di Voice Channel? (default: Ya jika di VC)",
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("stop")
        .setDescription("Hentikan sesi Pomodoro yang sedang berjalan"),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === "stop") {
      const existing = activePomodoros.get(userId);
      if (!existing) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Tidak Ada Sesi",
            description:
              "❌ Kamu tidak memiliki sesi Pomodoro yang sedang aktif.",
            footerText: ui.getFooter("utility"),
          }),
          flags: 64,
        });
      }

      clearInterval(existing.interval);
      activePomodoros.delete(userId);

      const totalMins = Math.max(1, Math.round(existing.totalFocusTime / 60));
      const xpEarned = totalMins * 5;
      await cacheManager.incrementUserSurvival(userId, "survival_xp", xpEarned);

      return interaction.reply(
        buildContainerV2({
          accentColorHex: ui.getColor("success") || "#22c55e",
          authorName: "Pomodoro Selesai",
          title: `${ui.getEmoji("celebrate") || "🎉"} Sesi Belajar Berakhir!`,
          description: `Hebat! Kamu telah fokus belajar selama **${totalMins} Menit**.\n${ui.getEmoji("sparkles") || "✨"} **Reward Fokus:** +${xpEarned} Survival XP!`,
          footerText: ui.getFooter("utility"),
        }),
      );
    }

    if (subcommand === "start") {
      if (activePomodoros.has(userId)) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Sesi Sudah Ada",
            description:
              "❌ Kamu sudah memiliki sesi Pomodoro yang aktif. Gunakan `/pomodoro stop` terlebih dahulu jika ingin mengulang.",
            footerText: ui.getFooter("utility"),
          }),
          flags: 64,
        });
      }

      const focusMinutes = interaction.options.getInteger("fokus") || 25;
      const breakMinutes = interaction.options.getInteger("istirahat") || 5;
      const vcOpt = interaction.options.getBoolean("suara_vc");

      const voiceChannel = interaction.member?.voice?.channel;
      const enableVoice = vcOpt !== false && Boolean(voiceChannel);

      const session = {
        userId,
        username: interaction.user.displayName || interaction.user.username,
        focusDuration: focusMinutes * 60,
        breakDuration: breakMinutes * 60,
        timeLeft: focusMinutes * 60,
        mode: "focus",
        cycle: 1,
        isPaused: false,
        totalFocusTime: 0,
        voiceChannelId: enableVoice ? voiceChannel.id : null,
        interaction,
        interval: null,
      };

      const container = buildPomodoroContainer(session);
      const buttons = buildPomodoroButtons(session);

      const replyMsg = await interaction.reply({
        ...container,
        components: [...container.components, ...buttons],
        fetchReply: true,
      });

      const audioChimePath = path.resolve(
        __dirname,
        "../../assets/audio/Intro (ID).mp3",
      );

      session.interval = setInterval(async () => {
        if (session.isPaused) return;

        session.timeLeft -= 5;
        if (session.mode === "focus") {
          session.totalFocusTime += 5;
        }

        if (session.timeLeft <= 0) {
          if (session.mode === "focus") {
            // Selesai fokus -> Masuk istirahat
            session.mode = "break";
            session.timeLeft = session.breakDuration;

            if (
              enableVoice &&
              interaction.member?.voice?.channel &&
              fs.existsSync(audioChimePath)
            ) {
              await VoiceManager.playFile(audioChimePath, interaction.member);
            }

            await interaction
              .followUp({
                content: `🔔 <@${userId}> **Waktu fokus selesai!** Saatnya istirahat selama ${breakMinutes} menit. Rileks sejenak yaa~ ☕`,
              })
              .catch(() => {});
          } else {
            // Selesai istirahat -> Masuk fokus siklus baru
            session.mode = "focus";
            session.timeLeft = session.focusDuration;
            session.cycle += 1;

            if (
              enableVoice &&
              interaction.member?.voice?.channel &&
              fs.existsSync(audioChimePath)
            ) {
              await VoiceManager.playFile(audioChimePath, interaction.member);
            }

            await interaction
              .followUp({
                content: `🔔 <@${userId}> **Waktu istirahat selesai!** Mari mulai sesi fokus siklus #${session.cycle}. Semangat! 🔥`,
              })
              .catch(() => {});
          }
        }

        const updated = buildPomodoroContainer(session);
        const updatedButtons = buildPomodoroButtons(session);

        await replyMsg
          .edit({
            ...updated,
            components: [...updated.components, ...updatedButtons],
          })
          .catch(() => {});
      }, 5000);

      activePomodoros.set(userId, session);

      const collector = replyMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 14400000, // 4 jam
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== userId) {
          return i.reply({
            content: "❌ Ini bukan sesi Pomodoro milikmu.",
            flags: 64,
          });
        }

        if (i.customId === "pomodoro_pause") {
          session.isPaused = !session.isPaused;
          const updated = buildPomodoroContainer(session);
          const updatedButtons = buildPomodoroButtons(session);
          return i.update({
            ...updated,
            components: [...updated.components, ...updatedButtons],
          });
        }

        if (i.customId === "pomodoro_skip") {
          session.timeLeft = 0;
          return i.reply({
            content: "⏭️ Fase saat ini dilewati!",
            flags: 64,
          });
        }

        if (i.customId === "pomodoro_stop") {
          clearInterval(session.interval);
          activePomodoros.delete(userId);
          collector.stop();

          const totalMins = Math.max(
            1,
            Math.round(session.totalFocusTime / 60),
          );
          const xpEarned = totalMins * 5;
          await cacheManager.incrementUserSurvival(
            userId,
            "survival_xp",
            xpEarned,
          );

          const finalContainer = buildContainerV2({
            accentColorHex: ui.getColor("success") || "#22c55e",
            authorName: "Pomodoro Selesai",
            title: `${ui.getEmoji("celebrate") || "🎉"} Sesi Belajar Berakhir!`,
            description: `Hebat! Kamu telah fokus belajar selama **${totalMins} Menit**.\n${ui.getEmoji("sparkles") || "✨"} **Reward Fokus:** +${xpEarned} Survival XP!`,
            footerText: ui.getFooter("utility"),
          });

          return i.update({
            ...finalContainer,
            components: finalContainer.components,
          });
        }
      });
    }
  },
};
