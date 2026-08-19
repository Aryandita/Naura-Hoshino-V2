const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = async function handle(interaction, { currentSettings, saveSettings }, subcommand) {
  if (subcommand === "ai") {
    const channel = interaction.options.getChannel("channel");
    currentSettings.aiChannelId = channel.id;
    await saveSettings(currentSettings);

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary"),
      authorName: "Naura AI Module",
      title: "🧠 Setup AI Channel Berhasil",
      description: `Channel AI Chat: <#${channel.id}>`,
      footerText: ui.getFooter("core"),
    });
    return interaction.reply(payload);
  }

  if (subcommand === "ai-automod") {
    const enabled = interaction.options.getBoolean("aktif");
    const auditChannel = interaction.options.getChannel("audit-channel");
    const threshold = interaction.options.getInteger("threshold") ?? 70;
    const learningMode =
      interaction.options.getBoolean("learning-mode") ?? false;

    if (!currentSettings.aiAutomod) currentSettings.aiAutomod = {};
    currentSettings.aiAutomod.enabled = enabled;
    currentSettings.aiAutomod.toxicityThreshold = threshold;
    currentSettings.aiAutomod.learningMode = learningMode;
    if (auditChannel)
      currentSettings.aiAutomod.auditChannelId = auditChannel.id;
    await saveSettings(currentSettings);

    const payload = buildContainerV2({
      accentColorHex: enabled ? "#00FF88" : "#FF4444",
      authorName: "Naura AI Automod Module",
      title: "🤖 Setup AI Automod Berhasil",
      description: [
        `**Status:** ${enabled ? "🟢 Aktif" : "🔴 Nonaktif"}`,
        `**Threshold Aksi:** Skor ≥ ${threshold}/100`,
        `**Mode Belajar:** ${learningMode ? "✅ Aktif (hanya log, tidak ada aksi)" : "❌ Nonaktif (aksi otomatis)"}`,
        auditChannel
          ? `**Channel Audit:** <#${auditChannel.id}>`
          : "**Channel Audit:** *Belum Diatur*",
        "",
        enabled
          ? `ℹ️ Gunakan **klik kanan pada pesan** → **Apps** → **⚑ Report Pesan** untuk melaporkan pesan kepada AI.`
          : "",
      ].join("\n"),
      footerText: ui.getFooter("core"),
    });

    return interaction.reply(payload);
  }

  if (subcommand === "ai-config") {
    const persona = interaction.options.getString("persona");
    currentSettings.aiPersona = persona;
    await saveSettings(currentSettings);

    const payload = buildContainerV2({
      accentColorHex: "#00FFFF",
      authorName: "Naura AI Central Setup Module",
      title: "🤖 Persona AI Server Berhasil Diatur",
      description: `Persona/Sifat khusus AI di server ini telah berhasil diperbarui!\n\n**Persona Baru:**\n> *"${persona}"*`,
      footerText: ui.getFooter("core"),
    });

    return interaction.reply(payload);
  }

  if (subcommand === "ai-kb") {
    const aksi = interaction.options.getString("aksi") || "list";
    const judul = interaction.options.getString("judul");
    const konten = interaction.options.getString("konten");
    const knowledgeBase = require("../../../src/ai/knowledgeBase");

    if (aksi === "tambah") {
      if (!judul || !konten) {
        return interaction.reply({
          content: "❌ Harap sertakan judul dan konten dokumen untuk ditambahkan ke Knowledge Base.",
          ephemeral: true,
        });
      }

      const count = await knowledgeBase.addKnowledge(interaction.guildId, judul, konten);
      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "Naura AI RAG Knowledge Base",
        title: "📚 Dokumen Berhasil Dipelajari!",
        description: `Naura berhasil mempelajari dokumen **${judul}** ke dalam memori pengetahuan server ini (${count} potongan teks tersimpan).\n\nSekarang member bisa bertanya kepada Naura seputar isi dokumen ini!`,
        footerText: ui.getFooter("core"),
      });
      return interaction.reply(payload);
    }

    if (aksi === "reset") {
      await knowledgeBase.clearKnowledge(interaction.guildId);
      const payload = buildContainerV2({
        accentColorHex: "#EF4444",
        authorName: "Naura AI RAG Knowledge Base",
        title: "🗑️ Knowledge Base Direset",
        description: "Seluruh memori dokumen dan peraturan server untuk AI telah dibersihkan.",
        footerText: ui.getFooter("core"),
      });
      return interaction.reply(payload);
    }

    // Default: list
    const docs = await knowledgeBase.listKnowledge(interaction.guildId);
    const payload = buildContainerV2({
      accentColorHex: "#38BDF8",
      authorName: "Naura AI RAG Knowledge Base",
      title: "📖 Daftar Dokumen Pengetahuan Server",
      description: docs.length > 0
        ? `Berikut dokumen yang sudah dipelajari Naura di server ini:\n${docs.map((d, i) => `${i + 1}. **${d}**`).join("\n")}\n\n*Gunakan \`/setup ai-kb\` untuk menambah dokumen baru.*`
        : "Belum ada dokumen yang dipelajari Naura di server ini.\nGunakan `/setup ai-kb` dengan aksi **Tambah** untuk mendaftarkan peraturan/FAQ server.",
      footerText: ui.getFooter("core"),
    });
    return interaction.reply(payload);
  }
};

