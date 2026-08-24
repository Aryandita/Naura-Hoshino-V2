const env = require("../../config/env");
const { logger } = require("../../managers/logger");
const { awardXp } = require("../../leveling/levelingEngine");
const {
  buildLoadingContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");

// Subcommand yang perlu dibuang dari argumen sebelum dibaca sebagai teks bebas.
const SUBCOMMAND_WORDS = ["balance", "buy", "ping", "set", "add", "remove"];

/**
 * Cari command dari nama atau aliasnya.
 *
 * Alias sekarang tinggal di client.aliases, terpisah dari client.commands.
 * Pencarian linear ke cmd.aliases dipertahankan sebagai lapis terakhir supaya
 * command yang mendeklarasikan alias dengan cara tidak biasa tetap terjangkau.
 */
function resolveCommand(client, name) {
  const direct = client.commands.get(name);
  if (direct) return direct;

  const canonical = client.aliases?.get(name);
  if (canonical) {
    const viaAlias = client.commands.get(canonical);
    if (viaAlias) return viaAlias;
  }

  return (
    client.commands.find(
      (cmd) => Array.isArray(cmd.aliases) && cmd.aliases.includes(name),
    ) || null
  );
}

function buildLoadingPayload(message, client, commandName) {
  return buildLoadingContainerV2({
    authorName: "Naura Task Runner",
    title: "Sedang Memproses Perintah...",
    loadingMessage: `Tunggu sebentar ya, Naura sedang menyiapkan perintah \`${commandName}\` untuk Kak **${message.author.displayName || message.author.username}**! ✨`,
    lang: message.localeLang,
    withBanner: true,
  });
}

function normalizePayload(payload) {
  const base =
    typeof payload === "string"
      ? { content: payload, embeds: [], components: [], files: [] }
      : { content: null, embeds: [], components: [], files: [], ...payload };

  delete base.ephemeral;
  delete base.fetchReply;
  return base;
}

// Meniru objek interaction agar satu command bisa dipanggil lewat slash maupun prefix.
function buildMockInteraction(
  message,
  client,
  command,
  commandName,
  args,
  loadingMsg,
) {
  const editOrSend = async (payload) => {
    const msgPayload = normalizePayload(payload);
    if (loadingMsg) {
      try {
        return await loadingMsg.edit(msgPayload);
      } catch (e) {
        return await message.channel.send(msgPayload);
      }
    }
    return await message.channel.send(msgPayload);
  };

  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    isStringSelectMenu: () => false,
    commandName: command.data?.name || commandName,
    user: message.author,
    member: message.member,
    guild: message.guild,
    channel: message.channel,
    client,
    createdTimestamp: message.createdTimestamp,

    // Bahasa pengguna ikut diteruskan supaya terjemahan juga jalan di prefix.
    lang: message.localeLang,
    localeLang: message.localeLang,
    locale: message.localeLang,

    options: {
      getSubcommand: () => args[0]?.toLowerCase() || null,
      getString: () => {
        if (args.length === 0) return null;
        const rest = [...args];
        if (SUBCOMMAND_WORDS.includes(rest[0]?.toLowerCase())) rest.shift();
        return rest.join(" ") || null;
      },
      getUser: () => message.mentions.users.first() || null,
      getInteger: () => {
        const num = parseInt(
          args.find((a) => !isNaN(parseInt(a, 10))),
          10,
        );
        return isNaN(num) ? null : num;
      },
      getNumber: () => {
        const num = parseFloat(args.find((a) => !isNaN(parseFloat(a))));
        return isNaN(num) ? null : num;
      },
      getBoolean: () => {
        if (
          args.some((a) => ["true", "yes", "1", "on"].includes(a.toLowerCase()))
        )
          return true;
        if (
          args.some((a) =>
            ["false", "no", "0", "off"].includes(a.toLowerCase()),
          )
        )
          return false;
        return null;
      },
      getChannel: () => {
        const mention = message.mentions.channels.first();
        if (mention) return mention;
        const match = args.find((a) => a.match(/^<#(\d+)>$/));
        return match
          ? message.guild?.channels.cache.get(match.replace(/\D/g, "")) || null
          : null;
      },
      getRole: () => {
        const mention = message.mentions.roles.first();
        if (mention) return mention;
        const match = args.find((a) => a.match(/^<@&(\d+)>$/));
        return match
          ? message.guild?.roles.cache.get(match.replace(/\D/g, "")) || null
          : null;
      },
    },

    reply: editOrSend,
    editReply: editOrSend,
    followUp: async (payload) => {
      const msgPayload =
        typeof payload === "string" ? { content: payload } : { ...payload };
      delete msgPayload.ephemeral;
      return await message.channel.send(msgPayload);
    },
    deferReply: async () => {},
    deleteReply: async () => {
      if (loadingMsg) await loadingMsg.delete().catch(() => {});
    },
  };
}

/**
 * Menjalankan perintah berawalan prefix. Pesan biasa tetap mendapat XP.
 * Selalu mengembalikan true karena ini langkah terakhir dalam rantai.
 */
module.exports = async function handlePrefixCommand(message, client) {
  const prefix = env.PREFIX || "n!";

  if (!message.content.toLowerCase().startsWith(prefix.toLowerCase())) {
    if (message.guild) {
      // Isi pesan wajib diteruskan. Tanpa argumen keempat, awardXp menolak
      // memberi XP karena penyaring panjang minimum membaca teks kosong.
      await awardXp(
        message.author,
        message.guild,
        message.channel,
        message.content,
      ).catch(() => {});
    }
    return true;
  }

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return true;

  const command = resolveCommand(client, commandName);
  if (!command) return true;

  const loadingMsg = await message
    .reply(buildLoadingPayload(message, client, commandName))
    .catch(() => null);

  try {
    // Metrik: Catat penggunaan prefix command di Redis Hash
    try {
      const redis = require("../../managers/redisManager").client;
      if (redis?.isReady) {
        redis.hincrby("metrics:commands", commandName, 1);
        redis.hincrby("metrics:commands", "total", 1);
      }
    } catch (e) {
      // Abaikan gagal log metrik
    }

    if (typeof command.executePrefix === "function") {
      if (loadingMsg) await loadingMsg.delete().catch(() => {});
      await command.executePrefix(message, args, client);
    } else if (!command.data && typeof command.execute === "function") {
      if (loadingMsg) await loadingMsg.delete().catch(() => {});
      await command.execute(client, message, args);
    } else {
      await command.execute(
        buildMockInteraction(
          message,
          client,
          command,
          commandName,
          args,
          loadingMsg,
        ),
      );
    }
  } catch (error) {
    logger.error(`[HYBRID ERROR] Command (${commandName}):`, error);
    if (loadingMsg) {
      await loadingMsg
        .edit(
          buildErrorContainerV2({
            authorName: "Naura System Guard",
            title: "Perintah Terkendala",
            errorMessage: `Maaf ya Kak **${message.author.displayName || message.author.username}**, terjadi kendala saat Naura menjalankan perintah \`${commandName}\`. Coba lagi sebentar lagi ya!`,
            lang: message.localeLang,
            withBanner: true,
          }),
        )
        .catch(() => {});
    }
  }

  return true;
};
