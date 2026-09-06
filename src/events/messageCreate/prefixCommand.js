"use strict";

/**
 * Penangan perintah berawalan prefix (Hybrid Slash/Prefix execution).
 * Mengimplementasikan:
 * - Law 1: Guard Clauses / Flat paths (early return saat bukan prefix / kosong)
 * - Law 2: Intent-revealing domain naming
 * - Law 6: Make errors useful (tampilkan pesan DomainError)
 */

const env = require("../../config/env");
const { logger } = require("../../managers/logger");
const { awardXp } = require("../../leveling/levelingEngine");
const { isDomainError } = require("../../errors/DomainError");
const {
  buildLoadingContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");

// Subcommand yang perlu dibuang dari argumen sebelum dibaca sebagai teks bebas.
const SUBCOMMAND_WORDS = Object.freeze(["balance", "buy", "ping", "set", "add", "remove"]);

/**
 * Cari command dari nama atau aliasnya.
 * @param {import('discord.js').Client} client
 * @param {string} commandName
 * @returns {any|null}
 */
function resolveCommand(client, commandName) {
  const directCommand = client.commands.get(commandName);
  if (directCommand) return directCommand;

  const canonicalName = client.aliases?.get(commandName);
  if (canonicalName) {
    const aliasTarget = client.commands.get(canonicalName);
    if (aliasTarget) return aliasTarget;
  }

  return (
    client.commands.find(
      (cmd) => Array.isArray(cmd.aliases) && cmd.aliases.includes(commandName),
    ) || null
  );
}

function buildLoadingPayload(message, client, commandName) {
  const authorName = message.author.displayName || message.author.username;
  return buildLoadingContainerV2({
    authorName: "Naura Task Runner",
    title: "Sedang Memproses Perintah...",
    loadingMessage: `Tunggu sebentar ya, Naura sedang menyiapkan perintah \`${commandName}\` untuk Kak **${authorName}**! ✨`,
    lang: message.localeLang,
    withBanner: true,
  });
}

function normalizeMessagePayload(rawPayload) {
  const basePayload =
    typeof rawPayload === "string"
      ? { content: rawPayload, embeds: [], components: [], files: [] }
      : { content: null, embeds: [], components: [], files: [], ...rawPayload };

  delete basePayload.ephemeral;
  delete basePayload.fetchReply;
  return basePayload;
}

/**
 * Meniru objek Interaction Discord agar Slash Command dapat dipanggil via Prefix
 */
function buildMockInteraction(
  message,
  client,
  targetCommand,
  commandName,
  commandArguments,
  loadingMessage,
) {
  const editOrSend = async (payload) => {
    const normalizedPayload = normalizeMessagePayload(payload);
    if (loadingMessage) {
      try {
        return await loadingMessage.edit(normalizedPayload);
      } catch {
        return await message.channel.send(normalizedPayload);
      }
    }
    return await message.channel.send(normalizedPayload);
  };

  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    isStringSelectMenu: () => false,
    commandName: targetCommand.data?.name || commandName,
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
      getSubcommand: () => commandArguments[0]?.toLowerCase() || null,
      getString: () => {
        if (commandArguments.length === 0) return null;
        const argumentTokens = [...commandArguments];
        if (SUBCOMMAND_WORDS.includes(argumentTokens[0]?.toLowerCase())) {
          argumentTokens.shift();
        }
        return argumentTokens.join(" ") || null;
      },
      getUser: () => message.mentions.users.first() || null,
      getInteger: () => {
        const found = commandArguments.find((arg) => !isNaN(parseInt(arg, 10)));
        if (!found) return null;
        const parsed = parseInt(found, 10);
        return isNaN(parsed) ? null : parsed;
      },
      getNumber: () => {
        const found = commandArguments.find((arg) => !isNaN(parseFloat(arg)));
        if (!found) return null;
        const parsed = parseFloat(found);
        return isNaN(parsed) ? null : parsed;
      },
      getBoolean: () => {
        if (
          commandArguments.some((arg) => ["true", "yes", "1", "on"].includes(arg.toLowerCase()))
        ) {
          return true;
        }
        if (
          commandArguments.some((arg) => ["false", "no", "0", "off"].includes(arg.toLowerCase()))
        ) {
          return false;
        }
        return null;
      },
      getChannel: () => {
        const mention = message.mentions.channels.first();
        if (mention) return mention;
        const match = commandArguments.find((arg) => arg.match(/^<#(\d+)>$/));
        return match
          ? message.guild?.channels.cache.get(match.replace(/\D/g, "")) || null
          : null;
      },
      getRole: () => {
        const mention = message.mentions.roles.first();
        if (mention) return mention;
        const match = commandArguments.find((arg) => arg.match(/^<@&(\d+)>$/));
        return match
          ? message.guild?.roles.cache.get(match.replace(/\D/g, "")) || null
          : null;
      },
    },

    reply: editOrSend,
    editReply: editOrSend,
    followUp: async (payload) => {
      const normalizedPayload =
        typeof payload === "string" ? { content: payload } : { ...payload };
      delete normalizedPayload.ephemeral;
      return await message.channel.send(normalizedPayload);
    },
    deferReply: async () => {},
    deleteReply: async () => {
      if (loadingMessage) await loadingMessage.delete().catch(() => {});
    },
  };
}

/**
 * Menjalankan perintah berawalan prefix. Pesan biasa tetap mendapat XP.
 * Selalu mengembalikan true karena ini langkah terakhir dalam rantai messageCreate.
 */
module.exports = async function handlePrefixCommand(message, client) {
  const configuredPrefix = env.PREFIX || "n!";

  // Guard Clause 1: Bukan awalan prefix, jalankan perhitungan XP pesan biasa
  if (!message.content.toLowerCase().startsWith(configuredPrefix.toLowerCase())) {
    if (message.guild) {
      await awardXp(
        message.author,
        message.guild,
        message.channel,
        message.content,
      ).catch(() => {});
    }
    return true;
  }

  // Ekstraksi nama command dan argumen
  const commandTokens = message.content.slice(configuredPrefix.length).trim().split(/ +/);
  const targetCommandName = commandTokens.shift()?.toLowerCase();

  // Guard Clause 2: Awalan prefix tanpa nama command
  if (!targetCommandName) return true;

  const targetCommand = resolveCommand(client, targetCommandName);
  // Guard Clause 3: Perintah tidak dikenali
  if (!targetCommand) return true;

  const loadingMessage = await message
    .reply(buildLoadingPayload(message, client, targetCommandName))
    .catch(() => null);

  try {
    // Metrik: Catat penggunaan prefix command di Redis Hash
    try {
      const redis = require("../../managers/redisManager").client;
      if (redis?.isReady) {
        redis.hincrby("metrics:commands", targetCommandName, 1);
        redis.hincrby("metrics:commands", "total", 1);
      }
    } catch {
      // Abaikan bila modul Redis belum siap
    }

    if (typeof targetCommand.executePrefix === "function") {
      if (loadingMessage) await loadingMessage.delete().catch(() => {});
      await targetCommand.executePrefix(message, commandTokens, client);
    } else if (!targetCommand.data && typeof targetCommand.execute === "function") {
      if (loadingMessage) await loadingMessage.delete().catch(() => {});
      await targetCommand.execute(client, message, commandTokens);
    } else {
      await targetCommand.execute(
        buildMockInteraction(
          message,
          client,
          targetCommand,
          targetCommandName,
          commandTokens,
          loadingMessage,
        ),
      );
    }
  } catch (error) {
    const callerName = message.author.displayName || message.author.username;
    if (isDomainError(error)) {
      logger.warn(`[PREFIX DOMAIN ERROR] Command (${targetCommandName}): [${error.code}] ${error.message}`, error.context);
      if (loadingMessage) {
        await loadingMessage
          .edit(
            buildErrorContainerV2({
              authorName: "Naura Action Guard",
              title: "Perintah Gagal",
              errorMessage: error.userMessage,
              lang: message.localeLang,
              withBanner: true,
            }),
          )
          .catch(() => {});
      }
      return true;
    }

    logger.error(`[HYBRID ERROR] Command (${targetCommandName}):`, error);
    if (loadingMessage) {
      await loadingMessage
        .edit(
          buildErrorContainerV2({
            authorName: "Naura System Guard",
            title: "Perintah Terkendala",
            errorMessage: `Maaf ya Kak **${callerName}**, terjadi kendala saat Naura menjalankan perintah \`${targetCommandName}\`. Coba lagi sebentar lagi ya!`,
            lang: message.localeLang,
            withBanner: true,
          }),
        )
        .catch(() => {});
    }
  }

  return true;
};
