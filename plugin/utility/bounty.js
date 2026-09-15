"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const bountyVaultEngine = require("../../src/services/bountyVaultEngine");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bounty")
    .setDescription("📜 Papan Sayembara Komunitas & Brankas Rahasia Zero-Knowledge.")
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Lihat daftar sayembara tugas komunitas yang sedang dibuka di server."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Buat sayembara baru dengan hadiah Star Fragments dari saldomu.")
        .addStringOption((opt) =>
          opt
            .setName("judul")
            .setDescription("Judul tugas sayembara")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("deskripsi")
            .setDescription("Detail tugas dan syarat penyelesaian")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("hadiah")
            .setDescription("Jumlah Star Fragments (NSF) sebagai imbalan")
            .setRequired(true)
            .setMinValue(50),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("claim")
        .setDescription("Ajukan bukti penyelesaian sayembara yang kamu kerjakan.")
        .addStringOption((opt) =>
          opt
            .setName("bounty_id")
            .setDescription("ID sayembara yang dikerjakan")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("bukti")
            .setDescription("Bukti atau penjelasan penyelesaian tugas")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("approve")
        .setDescription("Setujui penyelesaian sayembara buatanmu dan cairkan hadiah ke pekerja.")
        .addStringOption((opt) =>
          opt
            .setName("bounty_id")
            .setDescription("ID sayembara yang ingin disetujui")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("vault_store")
        .setDescription("🔒 Simpan teks rahasia ke Zero-Knowledge Vault terenkripsi AES-256-GCM.")
        .addStringOption((opt) =>
          opt
            .setName("teks")
            .setDescription("Catatan/rahasia yang ingin dienkripsi")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("passphrase")
            .setDescription("Kunci rahasia pribadi untuk membuka kembali")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("vault_read")
        .setDescription("🔓 Buka catatan rahasia dari Zero-Knowledge Vault dengan passphrasemu.")
        .addStringOption((opt) =>
          opt
            .setName("vault_id")
            .setDescription("ID brankas rahasia")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("passphrase")
            .setDescription("Kunci rahasia yang kamu pakai saat menyimpan")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subCmd = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Zero-knowledge Vault operations: Ephemeral
    if (subCmd === "vault_store") {
      const text = interaction.options.getString("teks");
      const passphrase = interaction.options.getString("passphrase");

      const res = await bountyVaultEngine.storeSecret({
        userId,
        secretText: text,
        passphrase,
      });

      const payload = buildContainerV2({
        accentColorHex: "#10B981",
        authorName: "NAURA PRIVACY VAULT",
        title: "🔒 Catatan Rahasia Tersimpan",
        description: [
          "Catatanmu telah dienkripsi secara end-to-end menggunakan standar **AES-256-GCM**.",
          "",
          `> 🗝️ **Vault ID:** \`${res.vaultId}\``,
          "> 🛡️ **Zero-Knowledge:** Passphrase tidak pernah disimpan. Jika kamu lupa passphrase, catatan tidak dapat dipulihkan.",
          "",
          `Gunakan \`/bounty vault_read vault_id:${res.vaultId} passphrase:...\` untuk membuka kembali.`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }

    if (subCmd === "vault_read") {
      const vaultId = interaction.options.getString("vault_id");
      const passphrase = interaction.options.getString("passphrase");

      const res = await bountyVaultEngine.retrieveSecret(vaultId, passphrase);

      if (!res.success) {
        const err = buildErrorContainerV2({
          title: "❌ Gagal Membuka Brankas",
          description: res.error,
          footerText: ui.getFooter("utility"),
        });
        return interaction.reply({ ...err, flags: MessageFlags.Ephemeral });
      }

      const payload = buildContainerV2({
        accentColorHex: "#06B6D4",
        authorName: "NAURA PRIVACY VAULT",
        title: "🔓 Isi Catatan Rahasia",
        description: [
          `Dekripsi terotentikasi untuk Vault \`${vaultId}\` berhasil:`,
          "",
          "```",
          res.plaintext,
          "```",
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }

    // Bounty operations: Normal public/channel responses
    await interaction.deferReply();

    if (subCmd === "list") {
      const bounties = await bountyVaultEngine.listBounties(guildId);
      const openBounties = bounties.filter((b) => b.status === "open" || b.status === "submitted");

      const bountyLines =
        openBounties.length > 0
          ? openBounties
              .map(
                (b) =>
                  `• **[${b.bountyId}]** \`${b.title}\`\n  > 💰 Imbalan: \`${b.rewardNsf.toLocaleString("id-ID")} NSF\` • Status: \`${b.status.toUpperCase()}\``,
              )
              .join("\n")
          : "*Belum ada sayembara aktif di server ini. Buat dengan `/bounty create`!*";

      const payload = buildContainerV2({
        accentColorHex: "#F59E0B",
        authorName: "NAURA BOUNTY BOARD",
        title: `📜 Papan Sayembara Komunitas: ${interaction.guild.name}`,
        description: [
          "Papan tugas dan sayembara komunitas dengan jaminan escrow Star Fragments.",
          "",
          bountyLines,
          "",
          "-# 💡 *Gunakan `/bounty claim` untuk mengajukan bukti penyelesaian tugas.*",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    if (subCmd === "create") {
      const title = interaction.options.getString("judul");
      const desc = interaction.options.getString("deskripsi");
      const reward = interaction.options.getInteger("hadiah");

      const res = await bountyVaultEngine.createBounty({
        guildId,
        creatorId: userId,
        title,
        description: desc,
        rewardNsf: reward,
      });

      if (!res.success) {
        const err = buildErrorContainerV2({
          title: "❌ Gagal Membuat Sayembara",
          description: res.error,
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply(err);
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22C55E",
        authorName: "NAURA BOUNTY BOARD",
        title: "✨ Sayembara Komunitas Resmi Dibuka!",
        description: [
          `Sayembara baru **"${title}"** telah terdaftar di papan pengumuman.`,
          "",
          `> 📜 **ID Sayembara:** \`${res.bounty.bountyId}\``,
          `> 💰 **Hadiah Escrow:** \`${reward.toLocaleString("id-ID")} Star Fragments\``,
          `> 📝 **Tugas:** ${desc}`,
          "",
          "Hadiah telah disimpan dengan aman di brankas escrow dan akan dicairkan saat tugas diverifikasi!",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    if (subCmd === "claim") {
      const bountyId = interaction.options.getString("bounty_id");
      const proof = interaction.options.getString("bukti");

      const res = await bountyVaultEngine.claimBounty(guildId, bountyId, userId, proof);

      if (!res.success) {
        const err = buildErrorContainerV2({
          title: "❌ Gagal Mengklaim Sayembara",
          description: res.error,
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply(err);
      }

      const payload = buildContainerV2({
        accentColorHex: "#3B82F6",
        authorName: "NAURA BOUNTY BOARD",
        title: "📬 Bukti Sayembara Berhasil Diajukan",
        description: [
          `Bukti pengerjaan sayembara \`${bountyId}\` telah dikirimkan ke pembuat sayembara.`,
          "",
          `> 👤 **Pengaju:** <@${userId}>`,
          `> 📄 **Bukti:** ${proof}`,
          "",
          "Menunggu persetujuan dan pencairan hadiah dari pembuat sayembara.",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    if (subCmd === "approve") {
      const bountyId = interaction.options.getString("bounty_id");

      const res = await bountyVaultEngine.approveBounty(guildId, bountyId, userId);

      if (!res.success) {
        const err = buildErrorContainerV2({
          title: "❌ Gagal Menyetujui Sayembara",
          description: res.error,
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply(err);
      }

      const payload = buildContainerV2({
        accentColorHex: "#10B981",
        authorName: "NAURA BOUNTY BOARD",
        title: "🎉 Sayembara Selesai & Hadiah Dicairkan!",
        description: [
          `Sayembara \`${bountyId}\` telah disetujui!`,
          "",
          `> 💰 **Imbalan Dicairkan:** \`${res.rewardNsf.toLocaleString("id-ID")} Star Fragments\``,
          "> ⚡ Dana escrow telah ditransfer secara atomik ke saldo penerima.",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }
  },
};
