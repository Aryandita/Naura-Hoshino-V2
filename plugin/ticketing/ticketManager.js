"use strict";

const fs = require("fs");
const path = require("path");
const { AttachmentBuilder, MessageFlags } = require("discord.js");
const UserTicket = require("../../src/models/UserTicket");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const { buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");

/**
 * Merender daftar pesan menjadi string HTML sederhana (bisa dipercantik dengan CSS Glassmorphism)
 */
function generateHtmlTranscript(messages, ticket) {
  let html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Transkrip Tiket - ${ticket.topic}</title>
        <style>
            body { font-family: 'Inter', sans-serif; background-color: #0B0C10; color: #FFF; padding: 20px; margin: 0; }
            .container { max-width: 800px; margin: 0 auto; background: rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); }
            h1 { color: #FFB6C1; }
            .msg { margin-bottom: 15px; padding: 10px; background: rgba(0, 0, 0, 0.3); border-radius: 8px; }
            .author { font-weight: bold; color: #93C5FD; margin-bottom: 5px; }
            .bot { color: #F9A8D4; }
            .time { font-size: 0.8em; color: #AAA; float: right; }
            .content { white-space: pre-wrap; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Transkrip Tiket</h1>
            <p><strong>Topik:</strong> ${ticket.topic}</p>
            <p><strong>Ditutup pada:</strong> ${new Date().toLocaleString('id-ID')}</p>
            <hr>
  `;

  // Messages di Discord dikembalikan dari terbaru ke terlama, kita reverse
  const sortedMsgs = Array.from(messages.values()).reverse();
  
  for (const msg of sortedMsgs) {
    if (!msg.content && msg.embeds.length === 0) continue; // Skip pesan kosong
    
    const isBot = msg.author.bot;
    const authorClass = isBot ? "author bot" : "author";
    const time = msg.createdAt.toLocaleString('id-ID');
    
    let content = msg.content || "";
    if (msg.embeds.length > 0 && msg.embeds[0].description) {
      content += `\n[Embed]: ${msg.embeds[0].description}`;
    }

    html += `
            <div class="msg">
                <div class="time">${time}</div>
                <div class="${authorClass}">${msg.author.tag}</div>
                <div class="content">${content}</div>
            </div>
    `;
  }

  html += `
        </div>
    </body>
    </html>
  `;
  return html;
}

async function closeTicket(interaction, client) {
  try {
    const thread = interaction.channel;
    
    // Cari data tiket di DB
    const ticketData = await UserTicket.findOne({
      where: { ticketId: thread.id, status: "open" }
    });

    if (!ticketData) {
      return interaction.reply({
        embeds: [buildErrorContainerV2({ title: "Tiket Tidak Ditemukan", description: "Tiket ini sudah ditutup atau tidak ada di database." })],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Pastikan yang menutup adalah yang punya tiket atau memiliki izin ManageMessages
    const hasPerm = interaction.member.permissions.has("ManageMessages");
    if (interaction.user.id !== ticketData.userId && !hasPerm) {
      return interaction.reply({
        embeds: [buildErrorContainerV2({ title: "Akses Ditolak", description: "Kamu tidak berhak menutup tiket ini." })],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // 1. Fetch seluruh pesan dari thread
    let allMessages = [];
    let lastId;
    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;
      const msgs = await thread.messages.fetch(options);
      allMessages.push(...msgs.values());
      if (msgs.size !== 100) break;
      lastId = msgs.last().id;
    }

    // 2. Buat Transkrip
    const htmlStr = generateHtmlTranscript(allMessages, ticketData);
    
    // 3. Simpan Transkrip ke Disk
    const filename = `ticket_${ticketData.id}_${Date.now()}.html`;
    const publicPath = path.join(__dirname, "../../dashboard/public/transcripts");
    if (!fs.existsSync(publicPath)) {
      fs.mkdirSync(publicPath, { recursive: true });
    }
    const fullPath = path.join(publicPath, filename);
    fs.writeFileSync(fullPath, htmlStr);

    // 4. Update Database
    await ticketData.update({
      status: "closed",
      transcriptPath: `/transcripts/${filename}`
    });

    // 5. Kirim DM ke Pengguna dengan file HTML
    try {
      const owner = await client.users.fetch(ticketData.userId);
      if (owner) {
        const att = new AttachmentBuilder(Buffer.from(htmlStr), { name: filename });
        await owner.send({
          content: `Halo! Tiket bantuanmu dengan topik **"${ticketData.topic}"** telah ditutup.\nBerikut adalah lampiran transkrip percakapan kita.`,
          files: [att]
        });
      }
    } catch (e) {
      logger.warn(`[TICKETING] Gagal mengirim transkrip via DM ke ${ticketData.userId}`);
    }

    // 6. Arsipkan dan Kunci Thread
    await interaction.editReply(`${ui.getEmoji("success") || "✅"} Tiket berhasil ditutup. Menyimpan transkrip dan mengunci thread...`);
    
    await thread.send(`🔒 Tiket ini ditutup oleh **${interaction.user.tag}**.`);
    await thread.setArchived(true, "Tiket ditutup");
    await thread.setLocked(true, "Tiket ditutup");
    
  } catch (error) {
    logger.error("[TICKETING] Error menutup tiket:", error);
    try {
      await interaction.editReply("Terjadi kesalahan sistem saat mencoba menutup tiket.");
    } catch (e) {}
  }
}

module.exports = {
  closeTicket
};
