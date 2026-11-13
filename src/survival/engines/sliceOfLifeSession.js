"use strict";

const { randomBytes } = require("node:crypto");
const chapter = require("../data/storyDrafts/prologueSliceOfLife");
const { resolveStoryDisplayName, replaceStoryPlayer } = require("../helpers/storyDisplayName");

/** Adapter siap diuji. Belum dipasang pada command atau runtime produksi. */
function createSliceOfLifeSession({ store, renderer, createCollector, buildError, buildComplete = buildError }) {
  if (!store?.read || !store?.transition || !renderer?.renderScene || typeof createCollector !== "function" || typeof buildError !== "function") throw new Error("Dependensi sesi tidak lengkap");

  async function start(interaction) {
    const ownerId = interaction.user.id;
    const initial = await store.read(ownerId);
    if (!initial.ok) return interaction.editReply(buildError("Progres belum dapat dibaca. Coba lagi nanti."));
    if (initial.progress.completed) return interaction.editReply(buildComplete("Prolog sudah selesai."));
    return show(interaction, ownerId, initial.progress);
  }

  async function show(interaction, ownerId, progress) {
    const scene = chapter.scenes[progress.scene];
    if (!scene || progress.completed) return interaction.editReply(buildError("Adegan tidak tersedia. Coba buka cerita kembali."));
    const nonce = randomBytes(8).toString("hex");
    const prefix = `sol_${nonce}`;
    const choices = scene.choices || [{ label: scene.end ? "Selesai" : "Lanjut" }];
    const playerName = resolveStoryDisplayName(interaction);
    const payload = await renderer.renderScene({
      title: "Prolog · Hari Pertama",
      speakerName: scene.speaker === "Aku" ? replaceStoryPlayer("[Player]", playerName) : scene.speaker,
      showNameBox: false,
      dialogText: scene.text,
      characterId: scene.character,
      characterEmotion: scene.emotion,
      backgroundId: scene.background,
      choices,
    }, { customIdPrefix: prefix });
    payload.allowedMentions = { parse: [] };
    payload.attachments = [];
    const message = await interaction.editReply(payload);
    let busy = false;
    createCollector(message, interaction.user, {
      time: 180000,
      denyMessage: "Ini bukan sesi cerita kamu.",
      onCollect: async (button, collector) => {
        const match = new RegExp(`^${prefix}_(\\d+)$`).exec(button.customId || "");
        if (button.user?.id !== ownerId || !match || busy) {
          if (!button.deferred && !button.replied) await button.reply({ content: "Tombol ini tidak lagi aktif.", flags: 64 });
          return;
        }
        const selection = Number(match[1]);
        if (!Number.isSafeInteger(selection) || selection < 0 || selection >= choices.length) {
          if (!button.deferred && !button.replied) await button.reply({ content: "Pilihan tidak tersedia.", flags: 64 });
          return;
        }
        busy = true;
        try { await button.deferUpdate(); } catch { busy = false; return; }
        const result = await store.transition(ownerId, progress.scene, selection);
        if (!result.ok) {
          collector.stop("navigated");
          return button.editReply(buildError("Progres belum dapat dipastikan. Buka kembali cerita untuk memeriksa posisi terakhir."));
        }
        collector.stop("navigated");
        if (result.progress.completed) return button.editReply(buildComplete("Prolog selesai. Terima kasih sudah bermain."));
        return show(button, ownerId, result.progress);
      },
    });
    return message;
  }
  return { start };
}

module.exports = { createSliceOfLifeSession };