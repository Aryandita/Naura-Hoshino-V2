"use strict";

/**
 * Command /portfolio, Kelola dan bagikan portfolio publik member
 *
 * Subcommand:
 *   /portfolio view [user]         - Lihat link portfolio seseorang (atau diri sendiri)
 *   /portfolio edit bio:<teks>     - Ubah bio
 *   /portfolio edit tagline:<teks> - Ubah tagline
 *   /portfolio toggle              - Toggle publik/privat
 *   /portfolio theme <nama>        - Ganti tema (default/sakura/cyber/midnight)
 *   /portfolio pin <card-id>       - Pin kartu ke portfolio
 */

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const { logger } = require("../../src/managers/logger");
const env = require("../../src/config/env");

const PREMIUM_THEMES = ["sakura", "midnight"];

function getDashboardBase() {
  const origins = String(env.DASHBOARD_ORIGIN || "")
    .split(/[\s,]+/)
    .filter(Boolean);
  return origins[0] || `http://localhost:${env.PORT || 3000}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("portfolio")
    .setDescription("Kelola dan bagikan portfolio publik Naura kamu 🌐")
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Lihat link portfolio seseorang atau diri sendiri")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Member yang ingin dilihat portfolionya")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Toggle visibilitas portfolio kamu (publik/privat)"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("bio")
        .setDescription("Ubah bio portfolio kamu")
        .addStringOption((opt) =>
          opt
            .setName("teks")
            .setDescription("Bio baru (maks. 500 karakter)")
            .setRequired(true)
            .setMaxLength(500),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("tagline")
        .setDescription("Ubah tagline di bawah namamu")
        .addStringOption((opt) =>
          opt
            .setName("teks")
            .setDescription("Tagline baru (maks. 80 karakter)")
            .setRequired(true)
            .setMaxLength(80),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("theme")
        .setDescription(
          "Ganti tema warna portfolio (default gratis, sakura/midnight premium)",
        )
        .addStringOption((opt) =>
          opt
            .setName("nama")
            .setDescription("Pilih tema")
            .setRequired(true)
            .addChoices(
              { name: "🌙 Default", value: "default" },
              { name: "🌸 Sakura (Premium)", value: "sakura" },
              { name: "🤖 Cyber (Premium)", value: "cyber" },
              { name: "🌑 Midnight (Premium)", value: "midnight" },
            ),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const displayName =
      interaction.user.displayName || interaction.user.username;

    try {
      const UserPortfolio = require("../../src/models/UserPortfolio");
      const UserProfile = require("../../src/models/UserProfile");
      const dashboardBase = getDashboardBase();

      // ── VIEW ─────────────────────────────────────────────────────
      if (sub === "view") {
        const targetUser =
          interaction.options.getUser("user") || interaction.user;
        const portfolio = await UserPortfolio.findOne({
          where: { userId: targetUser.id },
        });
        const isSelf = targetUser.id === userId;

        if (!portfolio || !portfolio.isPublic) {
          if (!isSelf) {
            return interaction.reply({
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
              components: buildContainerV2({
                title: "Portfolio Belum Tersedia",
                description: `Portfolio ${targetUser.displayName} belum dipublikasikan.\nKalau kamu ingin membuat portfoliomu sendiri, gunakan **/portfolio bio** dan **/portfolio toggle**.`,
                color: 0x1a1a2e,
              }),
            });
          }
          // Tampilkan info untuk diri sendiri (draft)
          return interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: buildContainerV2({
              title: `Portfolio Kamu, Draft`,
              description: `Portfolio kamu **belum dipublikasikan**. Gunakan **/portfolio toggle** untuk membuatnya publik.\n\nEdit portfoliomu di dashboard:\n🔗 [${dashboardBase}/portfolio](${dashboardBase}/portfolio)`,
              color: 0x1a1a2e,
              fields: [
                {
                  name: "Bio",
                  value: portfolio.bio || "*(belum diisi)*",
                  inline: false,
                },
                {
                  name: "Tagline",
                  value: portfolio.tagline || "*(belum diisi)*",
                  inline: true,
                },
                {
                  name: "Tema",
                  value: portfolio.theme || "default",
                  inline: true,
                },
              ],
            }),
          });
        }

        const portfolioUrl = `${dashboardBase}/u/${targetUser.id}`;
        return interaction.reply({
          flags: MessageFlags.IsComponentsV2,
          components: buildContainerV2({
            title: `${isSelf ? "🌐 Portfolio Kamu" : `🌐 Portfolio ${targetUser.displayName}`}`,
            description: `${portfolio.tagline ? `*"${portfolio.tagline}"*\n\n` : ""}Lihat portfolio lengkap di sini:\n🔗 [${portfolioUrl}](${portfolioUrl})\n\n${portfolio.viewCount > 0 ? `👁️ Sudah dilihat **${portfolio.viewCount.toLocaleString("id-ID")}** kali` : ""}`,
            color: 0xffb6c1,
          }),
        });
      }

      // ── TOGGLE ───────────────────────────────────────────────────
      if (sub === "toggle") {
        const [portfolio] = await UserPortfolio.findOrCreate({
          where: { userId },
        });
        portfolio.isPublic = !portfolio.isPublic;
        await portfolio.save({ fields: ["isPublic"] });

        const dashUrl = `${dashboardBase}/u/${userId}`;
        return interaction.reply({
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          components: buildContainerV2({
            title: portfolio.isPublic
              ? "🌐 Portfolio Dipublikasikan!"
              : "🔒 Portfolio Disembunyikan",
            description: portfolio.isPublic
              ? `Portfolio kamu sekarang bisa dilihat siapa pun!\n🔗 [${dashUrl}](${dashUrl})`
              : `Portfolio kamu sekarang hanya bisa kamu lihat sendiri.`,
            color: portfolio.isPublic ? 0x86efac : 0xff6b6b,
          }),
        });
      }

      // ── BIO ──────────────────────────────────────────────────────
      if (sub === "bio") {
        const teks = interaction.options.getString("teks");
        const [portfolio] = await UserPortfolio.findOrCreate({
          where: { userId },
        });
        portfolio.bio = teks;
        await portfolio.save({ fields: ["bio"] });

        return interaction.reply({
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          components: buildContainerV2({
            title: "✅ Bio Diperbarui",
            description: `Bio portfolio kamu telah diperbarui, ${displayName}!\n\n> ${teks}`,
            color: 0xffb6c1,
          }),
        });
      }

      // ── TAGLINE ──────────────────────────────────────────────────
      if (sub === "tagline") {
        const teks = interaction.options.getString("teks");
        const [portfolio] = await UserPortfolio.findOrCreate({
          where: { userId },
        });
        portfolio.tagline = teks;
        await portfolio.save({ fields: ["tagline"] });

        return interaction.reply({
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          components: buildContainerV2({
            title: "✅ Tagline Diperbarui",
            description: `Tagline portfolio kamu sekarang: *"${teks}"*`,
            color: 0xffb6c1,
          }),
        });
      }

      // ── THEME ────────────────────────────────────────────────────
      if (sub === "theme") {
        const tema = interaction.options.getString("nama");

        if (PREMIUM_THEMES.includes(tema)) {
          const profile = await UserProfile.findOne({ where: { userId } });
          if (!profile || !profile.isPremium) {
            return interaction.reply({
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
              components: buildContainerV2({
                title: "💎 Fitur Premium",
                description: `Tema **${tema}** hanya tersedia untuk pengguna Premium.\n\nUpgrade ke Premium untuk membuka semua tema eksklusif, warna aksen kustom, dan lainnya!`,
                color: 0xffd700,
              }),
            });
          }
        }

        const [portfolio] = await UserPortfolio.findOrCreate({
          where: { userId },
        });
        portfolio.theme = tema;
        await portfolio.save({ fields: ["theme"] });

        const themeEmoji = {
          default: "🌙",
          sakura: "🌸",
          cyber: "🤖",
          midnight: "🌑",
        };
        return interaction.reply({
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          components: buildContainerV2({
            title: "✅ Tema Diperbarui",
            description: `Tema portfolio kamu sekarang: ${themeEmoji[tema] || ""} **${tema}**`,
            color: 0xffb6c1,
          }),
        });
      }
    } catch (err) {
      logger.error(`[/portfolio] Error di subcommand '${sub}':`, err);
      try {
        const errMethod =
          interaction.replied || interaction.deferred ? "followUp" : "reply";
        await interaction[errMethod]({
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          components: buildContainerV2({
            title: "Ups, Terjadi Kesalahan",
            description:
              "Naura tidak bisa memproses portfolio kamu saat ini. Coba lagi nanti ya!",
            color: 0xff6b6b,
          }),
        });
      } catch {
        /* already replied */
      }
    }
  },
};
