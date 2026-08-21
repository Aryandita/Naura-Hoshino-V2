const { REST, Routes } = require("discord.js");
const { logger } = require("../../src/managers/logger");
const env = require("../../src/config/env");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
  buildLoadingContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  name: "deploy",
  aliases: ["sync"],
  description:
    "Manual deploy slash commands ke server atau global (Owner Only).",
  category: "owner",

  async executePrefix(message, args, client) {
    if (!env.OWNER_IDS.includes(message.author.id)) {
      return ui.sendError(message, "err_sys_23");
    }

    const loadingPayload = buildLoadingContainerV2({
      authorName: "Naura Deploy System",
      title: "Menyiapkan Registrasi...",
      loadingMessage: "Mengambil daftar command terdaftar...",
      withBanner: true,
      footerText: ui.getFooter("core"),
    });
    const msg = await message.reply(loadingPayload);

    const globalCommands = [];
    const guildCommands = [];
    const loadedNames = [];

    client.commands.forEach((command) => {
      if (command.data) {
        const cmdJson = command.data.toJSON();
        if (command.data.name === "naura") {
          guildCommands.push(cmdJson);
        } else {
          globalCommands.push(cmdJson);
        }
        loadedNames.push(command.data.name);
      }
    });

    const guildId =
      args[0] === "global" ? null : env.GUILD_ID || message.guild.id;
    const commandsData = guildId
      ? [...globalCommands, ...guildCommands]
      : globalCommands;

    if (commandsData.length === 0) {
      const errPayload = buildErrorContainerV2({
        authorName: "Naura Deploy System",
        title: "Deploy Gagal",
        errorMessage: "Tidak ada slash command valid yang ditemukan.",
        withBanner: true,
        footerText: ui.getFooter("core"),
      });
      return msg.edit(errPayload);
    }

    const rest = new REST({ version: "10" }).setToken(env.TOKEN);
    const clientId = env.CLIENT_ID;

    try {
      const updatingPayload = buildLoadingContainerV2({
        authorName: "Naura Deploy System",
        title: "Mendaftarkan Commands...",
        loadingMessage: `Mendaftarkan ${commandsData.length} slash commands ke Discord API...`,
        withBanner: true,
        footerText: ui.getFooter("core"),
      });
      await msg.edit(updatingPayload);

      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
          body: commandsData,
        });
        const successPayload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#22c55e",
          title: "🚀 Deploy Server Berhasil",
          description: `${ui.getEmoji("success") || "✅"} Berhasil registrasi **${commandsData.length}** commands ke Server (${guildId}).\n\nGunakan \`n!deploy global\` untuk sinkronisasi semua server (bisa memakan waktu 1 jam).`,
          footerText: ui.getFooter("core"),
        });
        await msg.edit(successPayload);
      } else {
        await rest.put(Routes.applicationCommands(clientId), {
          body: commandsData,
        });
        const successPayload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#22c55e",
          title: "🌍 Deploy Global Berhasil",
          description: `${ui.getEmoji("success") || "✅"} Berhasil registrasi **${commandsData.length}** commands secara GLOBAL.\n\nPerubahan mungkin membutuhkan waktu hingga 1 jam untuk sinkronisasi.`,
          footerText: ui.getFooter("core"),
        });
        await msg.edit(successPayload);
      }
    } catch (error) {
      logger.error("[DEPLOY ERROR]", error);
      const errPayload = buildErrorContainerV2({
        title: "Deploy Error",
        description: `${ui.getEmoji("error") || "❌"} Gagal deploy command. Periksa log console.`,
        footerText: ui.getFooter("core"),
      });
      await msg.edit(errPayload);
    }
  },
};
