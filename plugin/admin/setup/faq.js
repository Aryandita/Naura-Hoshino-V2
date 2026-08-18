const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = async function handle(
  interaction,
  { currentSettings, saveSettings },
) {
  if (!currentSettings.faq) currentSettings.faq = [];

  const aksi = interaction.options.getString("aksi");

  if (aksi === "add") {
    const question = interaction.options.getString("pertanyaan");
    const answer = interaction.options.getString("jawaban");

    if (!question || !answer) {
      return interaction.reply(
        buildErrorContainerV2({
          title: "Argumen Tidak Lengkap",
          description:
            "❌ Harap berikan opsi `pertanyaan` dan `jawaban` saat menambah FAQ.",
          footerText: ui.getFooter("core"),
        }),
      );
    }

    if (currentSettings.faq.length >= 30) {
      return interaction.reply(
        buildErrorContainerV2({
          title: "Batas Maksimal FAQ",
          description: "❌ Server ini telah mencapai batas maksimum 30 entri FAQ.",
          footerText: ui.getFooter("core"),
        }),
      );
    }

    const nextId = (
      currentSettings.faq.reduce((max, item) => Math.max(max, parseInt(item.id, 10) || 0), 0) + 1
    ).toString();

    currentSettings.faq.push({
      id: nextId,
      question: question.trim(),
      answer: answer.trim(),
      updatedAt: Date.now(),
    });

    await saveSettings(currentSettings);

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("success") || "#22c55e",
      authorName: "Naura Knowledge Base Setup",
      title: "📚 FAQ Berhasil Ditambahkan",
      description: "Entri FAQ baru telah disimpan dan akan digunakan Naura saat menjawab pertanyaan member via `/faq ask`!",
      fields: [
        { name: `ID #${nextId} - Pertanyaan`, value: question },
        { name: "Jawaban / Panduan", value: answer },
      ],
      footerText: ui.getFooter("core"),
    });

    return interaction.reply(payload);
  }

  if (aksi === "hapus") {
    const id = interaction.options.getString("id");
    if (!id) {
      return interaction.reply(
        buildErrorContainerV2({
          title: "ID Dibutuhkan",
          description: "❌ Harap berikan opsi `id` FAQ yang ingin dihapus.",
          footerText: ui.getFooter("core"),
        }),
      );
    }

    const initialLen = currentSettings.faq.length;
    currentSettings.faq = currentSettings.faq.filter((f) => String(f.id) !== id.trim());

    if (currentSettings.faq.length === initialLen) {
      return interaction.reply(
        buildErrorContainerV2({
          title: "Tidak Ditemukan",
          description: `❌ Tidak ditemukan entri FAQ dengan ID #${id}.`,
          footerText: ui.getFooter("core"),
        }),
      );
    }

    await saveSettings(currentSettings);

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("error") || "#ef4444",
      authorName: "Naura Knowledge Base Setup",
      title: "🗑️ FAQ Berhasil Dihapus",
      description: `Entri FAQ dengan ID #${id} telah dihapus dari database server.`,
      footerText: ui.getFooter("core"),
    });

    return interaction.reply(payload);
  }

  if (aksi === "clear") {
    currentSettings.faq = [];
    await saveSettings(currentSettings);

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("warning") || "#f59e0b",
      authorName: "Naura Knowledge Base Setup",
      title: "🧹 Seluruh FAQ Direset",
      description: "Seluruh data FAQ dan basis pengetahuan server ini telah dikosongkan.",
      footerText: ui.getFooter("core"),
    });

    return interaction.reply(payload);
  }

  // Aksi list
  if (currentSettings.faq.length === 0) {
    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary"),
      authorName: "Naura Knowledge Base Setup",
      title: "📚 Daftar FAQ Server",
      description:
        "Belum ada data FAQ di server ini. Tambahkan FAQ menggunakan `/setup faq aksi:Tambah FAQ` agar Naura dapat menjawab pertanyaan seputar server!",
      footerText: ui.getFooter("core"),
    });
    return interaction.reply(payload);
  }

  const fields = currentSettings.faq.slice(0, 10).map((f) => ({
    name: `ID #${f.id} • ${f.question}`,
    value: f.answer.length > 200 ? f.answer.slice(0, 197) + "..." : f.answer,
  }));

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Knowledge Base Setup",
    title: `📚 Daftar FAQ Server (${currentSettings.faq.length} Entri)`,
    description:
      "Berikut adalah basis pengetahuan dan aturan yang diajarkan ke AI Naura:",
    fields,
    footerText: ui.getFooter("core"),
  });

  return interaction.reply(payload);
};
