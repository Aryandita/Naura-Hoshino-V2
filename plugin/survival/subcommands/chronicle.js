"use strict";

const { MessageFlags } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const ui = require("../../../src/config/ui");
const { logger } = require("../../../src/managers/logger");

class WorldEventNarrator {
  constructor() {
    this.narrativeStyles = {
      epic: "Gaya epik seperti kronik kerajaan kuno",
      mysterious: "Gaya misterius dengan nuansa gelap dan teka-teki",
      cheerful: "Gaya ceria untuk perayaan dan festival",
      dramatic: "Gaya dramatis untuk konflik dan pertempuran besar",
      poetic: "Gaya puitis dengan metafora dan rima",
    };
  }

  narrateWorldEvent(eventData = {}, narrativeStyle = "epic") {
    try {
      const eventType = eventData.type || "generic";
      const participants = eventData.participants || [];
      const outcome = eventData.outcome || "unknown";
      const location = eventData.location || "Naura Wilds";

      return this._generateSimulatedNarration(
        eventType,
        participants,
        outcome,
        narrativeStyle,
        location,
      );
    } catch (error) {
      logger.error("[WorldEventNarrator] Galat:", error);
      return {
        title: "Peristiwa Dunia",
        text: "Sebuah peristiwa telah terjadi di Naura Wilds...",
        style: "epic",
      };
    }
  }

  _generateSimulatedNarration(type, participants, outcome, style, location) {
    const participantList =
      participants.length > 0
        ? participants.slice(0, 3).join(", ")
        : "para petualang pemberani";

    const narratives = {
      boss_defeat: {
        epic: {
          title: `Kemenangan Gemilang di ${location}`,
          text: `Di bawah langit kelam ${location}, ${participantList} berdiri tegak menghadapi sang tiran. Dengan tekad membara dan pedang berkilau, mereka menumbangkan musuh yang telah lama meneror desa. Sejarah akan mencatat hari ini sebagai awal era baru.`,
        },
        dramatic: {
          title: `Pertarungan Terakhir di ${location}`,
          text: `Darah dan keringat membasahi tanah ${location}. ${participantList} hampir kehilangan harapan ketika monster itu bangkit kembali. Namun dengan serangan terakhir yang menentukan, kegelapan pun sirna. Kemenangan diraih dengan harga yang mahal.`,
        },
      },
      festival: {
        cheerful: {
          title: `Kegembiraan Melanda ${location}`,
          text: `Sorak sorai terdengar di seluruh penjuru ${location}! ${participantList} memimpin perayaan dengan tarian dan nyanyian. Makanan lezat tersaji, hadiah dibagikan, dan senyum menghiasi wajah setiap warga. Hari yang takkan terlupakan!`,
        },
      },
      trade_milestone: {
        epic: {
          title: "Era Kemakmuran Ekonomi",
          text: `Pasar ${location} kini lebih hidup dari sebelumnya. ${participantList} telah mencapai tonggak perdagangan yang mengesankan. Emas mengalir, barang langka berpindah tangan, dan ekonomi desa memasuki babak baru yang menjanjikan.`,
        },
      },
      dungeon_clear: {
        epic: {
          title: `Penaklukan Dungeon ${location}`,
          text: `Kegelapan dungeon ${location} akhirnya terusir oleh cahaya keberanian ${participantList}. Setiap ruangan yang dilewati dipenuhi jebakan mematikan, namun tekad mereka tak pernah padam. Harta karun legendaris kini menjadi milik mereka!`,
        },
      },
      clan_war: {
        dramatic: {
          title: `Pertempuran Klan di ${location}`,
          text: `Tanah ${location} berguncang oleh benturan senjata dan teriakan perang. ${participantList} memimpin klan mereka menuju kemenangan epik. Strategi brilian dan kerja sama tim mengalahkan kekuatan brute force musuh.`,
        },
      },
      generic: {
        epic: {
          title: `Catatan dari ${location}`,
          text: `Di ${location}, sebuah peristiwa penting telah tercatat. ${participantList} terlibat dalam kejadian yang akan mengubah jalannya sejarah. Apa yang terjadi selanjutnya masih menjadi misteri...`,
        },
      },
    };

    const typeNarratives = narratives[type] || narratives.generic;
    const styleNarrative =
      typeNarratives[style] || typeNarratives.epic || Object.values(typeNarratives)[0];

    return (
      styleNarrative || {
        title: `Peristiwa di ${location}`,
        text: `${participantList} mengalami sesuatu yang luar biasa di ${location}.`,
        style: "epic",
      }
    );
  }
}

const narrator = new WorldEventNarrator();

module.exports = {
  name: "chronicle",
  description: "Generate narasi sinematik dari peristiwa server",

  async execute(interaction) {
    const userId = interaction.user.id;
    const eventType = interaction.options.getString("type") || "generic";
    const style = interaction.options.getString("style") || "epic";
    const location = interaction.options.getString("location") || "Naura Wilds";

    try {
      const participants = [interaction.user.displayName || interaction.user.username];

      const narration = narrator.narrateWorldEvent(
        {
          type: eventType,
          participants,
          outcome: "success",
          location,
        },
        style,
      );

      const payload = buildContainerV2({
        accentColorHex: survivalUI.getColor("amber"),
        authorName: "World Event Chronicle",
        title: `📜 ${narration.title}`,
        description: [
          `> _${narration.text}_`,
          "",
          `-# 🎭 Gaya Narasi: **${style.charAt(0).toUpperCase() + style.slice(1)}**`,
          `-# 📍 Lokasi: **${location}**`,
          `-# ⚔️ Tipe Event: **${eventType.replace(/_/g, " ").toUpperCase()}**`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...payload, embeds: [] });
    } catch (error) {
      logger.error(`[Chronicle] Error for user ${userId}:`, error);
      const errorPayload = buildErrorContainerV2(
        "Gagal menghasilkan narasi. Silakan coba lagi.",
      );
      return interaction.editReply({ ...errorPayload, embeds: [] });
    }
  },
};
