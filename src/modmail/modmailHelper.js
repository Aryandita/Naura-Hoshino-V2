const {
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { logger } = require("../managers/logger");
const ModMail = require("../models/ModMail");
const ui = require("../config/ui");
const cacheManager = require("../managers/cacheManager");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../utils/NauraContainerBuilder");

async function handleModmailDM(message, client) {
  const activeMail = await ModMail.findOne({
    where: { userId: message.author.id, closed: false },
  });

  if (activeMail) {
    if (!activeMail.guildId) {
      await activeMail.update({ closed: true });
      return await initiateNewTicket(message, client);
    }
    const guild = client.guilds.cache.get(activeMail.guildId);
    const ticketChannel = guild?.channels.cache.get(activeMail.channelId);

    if (!guild || !ticketChannel) {
      await activeMail.update({ closed: true });
      return await initiateNewTicket(message, client);
    }
    return await forwardToTicket(message, ticketChannel, client);
  }
  return await initiateNewTicket(message, client);
}

async function forwardToTicket(message, channel, client) {
  try {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("mm_reply")
        .setLabel("Balas")
        .setEmoji(ui.getEmoji("support") || "💬")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("mm_reply_anon")
        .setLabel("Balas Anonim")
        .setEmoji(ui.getEmoji("mask") || "🎭")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("mm_close")
        .setLabel("Tutup Tiket")
        .setEmoji(ui.getEmoji("lock") || "🔒")
        .setStyle(ButtonStyle.Danger),
    );

    let bannerAtt = null;
    const files = [];
    if (message.attachments.size > 0) {
      const firstAtt = message.attachments.first();
      bannerAtt = firstAtt.name;
      files.push(firstAtt);
    }

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: message.author.tag,
      iconURL: message.author.displayAvatarURL(),
      description: message.content || "*Hanya mengirim lampiran*",
      bannerAttachmentName: bannerAtt,
      buttonsRow: row,
      footerText: ui.getFooter("core"),
    });

    await channel.send({ ...payload, files });
    await message.react(ui.getEmoji("success") || "✅").catch(() => {});
  } catch (error) {
    logger.error("[MODMAIL ERROR]", error);
    await message.react(ui.getEmoji("error") || "❌").catch(() => {});
  }
  return true;
}

async function initiateNewTicket(message, client) {
  const guildsWithModmail = [];
  for (const [id, guild] of client.guilds.cache) {
    try {
      const member = await guild.members
        .fetch(message.author.id)
        .catch(() => null);
      if (!member) continue;
      const settings = await cacheManager.getGuildSettings(id);
      if (
        settings?.settings?.modmail?.enabled &&
        settings?.settings?.modmail?.categoryId
      ) {
        guildsWithModmail.push({
          id: guild.id,
          name: guild.name,
          categoryId: settings.settings.modmail.categoryId,
        });
      }
    } catch (e) {
      continue;
    }
  }

  if (guildsWithModmail.length === 0) {
    const errPayload = buildErrorContainerV2({
      title: "Modmail Tidak Aktif",
      description: `${ui.getEmoji("error") || "❌"} Maaf, saya tidak menemukan server yang mengaktifkan layanan Modmail di mana kamu bergabung.`,
      footerText: ui.getFooter("core"),
    });
    await message.reply(errPayload);
    return true;
  }

  if (guildsWithModmail.length === 1) {
    // Single server, create directly
    await createTicketChannel(message, guildsWithModmail[0], client, {
      content: message.content.replace(/^n!modmail\s*/i, ""),
      attachments: Array.from(message.attachments.values()),
    });
  } else {
    // Save draft in Redis to use later
    const redisManager = require("../managers/redisManager");
    const draft = {
      content: message.content.replace(/^n!modmail\s*/i, ""),
      attachments: Array.from(message.attachments.values()).map((a) => ({
        name: a.name,
        url: a.url,
      })),
    };
    await redisManager.setCache(
      `modmail:draft:${message.author.id}`,
      draft,
      300,
    ); // 5 mins

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("mm_select_server")
      .setPlaceholder("Pilih server tujuan bantuan...")
      .addOptions(
        guildsWithModmail.map((g) => ({
          label: g.name.substring(0, 100),
          value: g.id,
        })),
      );
    const row = new ActionRowBuilder().addComponents(selectMenu);
    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: `${ui.getEmoji("support") || "💬"} Pilihan Server Tujuan`,
      description: `Hai! Kamu terhubung dengan beberapa server yang menyediakan layanan Modmail.\nPesan awalmu telah disimpan sementara.\n\nSilakan pilih salah satu server tujuan bantuanmu di bawah ini ya! 😊`,
      buttonsRow: row,
      footerText: "Naura Modmail Support System",
    });

    await message.reply(payload);
  }
  return true;
}

async function createTicketChannel(message, guildData, client, draft = null) {
  const guild = client.guilds.cache.get(guildData.id);
  if (!guild) return;

  try {
    const settings = await cacheManager.getGuildSettings(guild.id);
    const masterChannel =
      guild.channels.cache.get(guildData.categoryId) ||
      guild.channels.cache.find((c) => c.type === ChannelType.GuildText);

    if (!masterChannel)
      throw new Error("Master channel untuk modmail tidak ditemukan.");

    // Always create a PrivateThread if possible. If masterChannel is a category, we have a problem.
    // Modmail requires a TextChannel to create a thread. We should fall back to a text channel if a category is provided.
    let targetChannel = masterChannel;
    if (targetChannel.type === ChannelType.GuildCategory) {
      targetChannel =
        guild.channels.cache.find(
          (c) =>
            c.parentId === targetChannel.id && c.type === ChannelType.GuildText,
        ) || guild.channels.cache.find((c) => c.type === ChannelType.GuildText);
    }

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      throw new Error(
        "Kategori modmail tidak memiliki text channel untuk membuat thread.",
      );
    }

    const channel = await targetChannel.threads.create({
      name: `mm-${(message.author || message.user).username.substring(0, 20)}`,
      autoArchiveDuration: 10080,
      type: ChannelType.PrivateThread, // PRIVATE THREAD FOR MODMAIL
      reason: "Modmail Ticket",
    });

    const authorId = message.author ? message.author.id : message.user.id;

    await ModMail.destroy({
      where: {
        userId: authorId,
        closed: true,
      },
    });

    await ModMail.create({
      userId: authorId,
      channelId: channel.id,
      guildId: guild.id,
      closed: false,
    });

    const staffRoleId = settings?.settings?.modmail?.staffRoleId;
    const tagContent = staffRoleId ? `<@&${staffRoleId}>` : "@here";

    const initialContent = draft
      ? draft.content
      : message.content || "*Hanya Memilih Menu*";
    const attachments = draft && draft.attachments ? draft.attachments : [];

    const descriptionText = `**Pengguna:** <@${authorId}> (${authorId})\n**Server:** ${guild.name}\n\n**Pesan Awal:**\n${initialContent || "*Hanya Lampiran*"}`;

    const welcomePayload = buildContainerV2({
      accentColorHex: "#FFB6C1",
      title: "📩 Tiket Modmail Baru",
      iconURL: message.author
        ? message.author.displayAvatarURL()
        : message.user.displayAvatarURL(),
      description: descriptionText,
      footerText: ui.getFooter("core"),
      // Adding buttons for the admins to reply and close directly from the initial embed
      buttonsRow: new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("mm_reply")
          .setLabel("Balas")
          .setEmoji(ui.getEmoji("support") || "💬")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("mm_reply_anon")
          .setLabel("Balas Anonim")
          .setEmoji(ui.getEmoji("mask") || "🎭")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("mm_close")
          .setLabel("Tutup Tiket")
          .setEmoji(ui.getEmoji("lock") || "🔒")
          .setStyle(ButtonStyle.Danger),
      ),
    });

    if (tagContent) {
      await channel.send({ content: tagContent }).catch(() => {});
    }

    const payload = { ...welcomePayload };

    const files = [];
    if (attachments && attachments.length > 0) {
      attachments.forEach((att) => {
        files.push(new AttachmentBuilder(att.url, { name: att.name }));
      });

      // Use the first attachment as banner if it's an image
      if (files[0].name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        payload.bannerAttachmentName = files[0].name;
      }
    }

    const ticketBanner = ui.getBanner("ticket");
    if (ticketBanner && files.length === 0) {
      files.push(new AttachmentBuilder(ticketBanner, { name: "banner.png" }));
      payload.bannerAttachmentName = "banner.png";
    }

    if (files.length > 0) {
      payload.files = files;
    }

    await channel.send(payload);

    const isInteraction = typeof message.editReply === "function";
    const successPayload = buildContainerV2({
      accentColorHex: ui.getColor("success") || "#22c55e",
      title: "Tiket Dibuka",
      description: `${ui.getEmoji("success") || "✅"} Tiket telah dibuka di **${guild.name}**. Staf akan segera merespons.`,
      footerText: ui.getFooter("core"),
    });

    if (isInteraction) {
      await message
        .editReply({ ...successPayload, components: [] })
        .catch(() => {});
    } else if (message.reply) {
      await message.reply(successPayload).catch(() => {});
    }
    if (message.author) await forwardToTicket(message, channel, client);
  } catch (err) {
    logger.error("[MODMAIL ERROR] Channel creation failed:", err);
    const isInteraction = typeof message.editReply === "function";
    const errPayload = buildErrorContainerV2({
      title: "Gagal Buat Channel",
      description: `${ui.getEmoji("error") || "❌"} Gagal membuat channel tiket. Pastikan bot memiliki izin yang cukup di server, atau kategori tiket masih valid.`,
      footerText: ui.getFooter("core"),
    });

    if (isInteraction) {
      await message
        .editReply({ ...errPayload, components: [] })
        .catch(() => {});
    } else if (message.reply) {
      await message.reply(errPayload).catch(() => {});
    }
  }
}

module.exports = { handleModmailDM, createTicketChannel, initiateNewTicket };
