"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const abyssEngine = require("../../../src/survival/engines/abyssEngine");

module.exports = {
  name: "abyss",
  description:
    "🌀 Jelajahi Labirin Rogue-lite Prosedural 50 Lantai (The Neo-Abyss)",

  async execute(interaction) {
    const action = interaction.options.getString("aksi") || "start";
    const userId = interaction.user.id;

    // 1. KELUAR & KLAIM HADIAH (LEAVE)
    if (action === "leave") {
      const leaveRes = await abyssEngine.finishRun(userId);
      if (!leaveRes.success) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Tidak Ada Ekspedisi",
            description:
              "Kamu sedang tidak berada di dalam labirin The Neo-Abyss.",
            footerText: ui.getFooter("survival"),
          }),
        });
      }

      const payload = buildContainerV2({
        accentColorHex: "#86EFAC",
        authorName: "🏁 Pintu Keluar The Neo-Abyss",
        title: "✨ Ekspedisi Berhasil Diselesaikan!",
        description: [
          `Kamu telah memutuskan untuk keluar dan mengamankan seluruh jarahanmu!`,
          ``,
          `🏰 **Lantai Tertinggi Ditaklukkan:** \`Lantai ${leaveRes.floorsCleared}\``,
          `🎁 **Total Relic Dikumpulkan:** \`${leaveRes.relicsGained} Relic\``,
          `💰 **Total Koin Diamankan:** \`+${leaveRes.totalCoins.toLocaleString("id-ID")} Star Fragments\``,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    // 2. PILIH RUANGAN LANGSUNG ATAU START
    let run = await abyssEngine.getRun(userId);
    let outcomeText = "";

    if (!run || run.status === "DEFEATED" || run.status === "VICTORY") {
      run = await abyssEngine.startRun(userId);
      outcomeText =
        "🚀 *Kamu melangkah masuk ke dalam gerbang dimensi The Neo-Abyss Lantai 1!*";
    } else if (action.startsWith("room_")) {
      const choiceIdx = parseInt(action.replace("room_", ""), 10) - 1;
      const processRes = await abyssEngine.chooseRoom(userId, choiceIdx);
      run = processRes.run;
      outcomeText = processRes.outcome.log;
    }

    if (run.status === "DEFEATED") {
      const payload = buildContainerV2({
        accentColorHex: "#EF4444",
        authorName: "☠️ Ekspedisi Berakhir Tragis",
        title: "Kamu Gugur di Dalam Labirin!",
        description: [
          outcomeText,
          ``,
          `🏰 **Lantai Terakhir:** \`Lantai ${run.currentFloor}\``,
          `💰 **Koin yang Hilang:** \`${run.fragmentsCollected} ⭐\``,
          ``,
          `-# 💡 *Tingkatkan level karakter dan persenjataanmu sebelum menantang The Neo-Abyss kembali!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    if (run.status === "VICTORY") {
      const payload = buildContainerV2({
        accentColorHex: "#FFD700",
        authorName: "👑 Penakluk Legendaris Neo-Abyss",
        title: "🎉 KEMENANGAN TOTAL! 50 LANTAI DITAKLUKKAN!",
        description: [
          outcomeText,
          ``,
          `💰 **Total Koin Masuk Tas:** \`+${(run.fragmentsCollected + 1000).toLocaleString("id-ID")} Star Fragments\``,
          `🏆 Gelar kehormatan dan hadiah musim telah berhasil diklaim!`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    // Tampilkan Pilihan Ruangan Aktif
    const choicesDesc = run.availableChoices
      .map((c, idx) => `**Pilihan ${idx + 1}:** ${c.label}`)
      .join("\n");

    const relicsDesc =
      run.relics.length > 0
        ? run.relics.map((r) => `\`${r}\``).join(", ")
        : "*Belum ada Relic*";

    const buttonsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("abyss_btn_1")
        .setLabel("🚪 Pilihan 1")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("abyss_btn_2")
        .setLabel("🚪 Pilihan 2")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("abyss_btn_3")
        .setLabel("🚪 Pilihan 3")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("abyss_btn_leave")
        .setLabel("🏁 Keluar")
        .setStyle(ButtonStyle.Danger),
    );

    const payload = buildContainerV2({
      accentColorHex: "#A855F7",
      authorName: `🌀 The Neo-Abyss, Lantai ${run.currentFloor} / 50`,
      title: `❤️ HP: ${run.currentHp}/${run.maxHp}  |  ⚔️ ATK: ${run.attackPower}  |  💰 ${run.fragmentsCollected} ⭐`,
      description: [
        outcomeText ? `${outcomeText}\n` : "",
        `🧭 **PILIH JALUR RUANGAN BERIKUTNYA:**`,
        choicesDesc,
        ``,
        `🎁 **Relic Aktif:** ${relicsDesc}`,
        ``,
        `-# 💡 *Tekan tombol di bawah untuk memilih pintu ruangan yang ingin kamu masuki!*`,
      ].join("\n"),
      footerText: ui.getFooter("survival"),
      buttonsRow,
    });

    const msg = await interaction.editReply(payload);

    // Button Collector
    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on("collect", async (btnInteraction) => {
      if (btnInteraction.user.id !== userId) {
        return btnInteraction.reply({
          content: "❌ Ini bukan ekspedisi labirin milikmu!",
          flags: 64,
        });
      }

      await btnInteraction.deferUpdate();

      if (btnInteraction.customId === "abyss_btn_leave") {
        const leaveRes = await abyssEngine.finishRun(userId);
        return interaction.followUp({
          ...buildContainerV2({
            accentColorHex: "#86EFAC",
            title: "✨ Ekspedisi Berhasil Diselesaikan!",
            description: `Kamu berhasil mengamankan **+${leaveRes.totalCoins.toLocaleString("id-ID")} Star Fragments**!`,
            footerText: ui.getFooter("survival"),
          }),
          flags: 64,
        });
      }

      let choiceIdx = 0;
      if (btnInteraction.customId === "abyss_btn_2") choiceIdx = 1;
      if (btnInteraction.customId === "abyss_btn_3") choiceIdx = 2;

      const processRes = await abyssEngine.chooseRoom(userId, choiceIdx);
      const nextRun = processRes.run;

      return interaction.followUp({
        ...buildContainerV2({
          accentColorHex: nextRun.status === "DEFEATED" ? "#EF4444" : "#A855F7",
          title: `Lantai ${nextRun.currentFloor} / 50 (HP: ${nextRun.currentHp}/${nextRun.maxHp})`,
          description: processRes.outcome.log,
          footerText: ui.getFooter("survival"),
        }),
        flags: 64,
      });
    });
  },
};
