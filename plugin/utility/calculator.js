const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

function evaluateMathExpression(rawExpr) {
  if (!rawExpr || typeof rawExpr !== "string") {
    return { success: false, error: "Ekspresi kosong." };
  }

  // Normalisasi karakter umum: x, X, × -> *; ÷, : -> /; ^ -> **
  const expr = rawExpr
    .trim()
    .replace(/[xX×]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/\^/g, "**")
    .replace(/,/g, ".");

  // Validasi karakter yang diizinkan: angka, operator, kurung, titik, spasi
  const SAFE_MATH_REGEX = /^[0-9+\-*/(). \t]+$/;
  if (!SAFE_MATH_REGEX.test(expr)) {
    return {
      success: false,
      error: "Karakter tidak valid. Hanya angka dan operator matematika (+, -, *, /, ^, kurung) yang diizinkan.",
    };
  }

  try {
    const result = new Function(`"use strict"; return (${expr});`)();
    if (typeof result !== "number" || !Number.isFinite(result)) {
      return {
        success: false,
        error: "Hasil perhitungan bukan angka yang valid (tak hingga atau NaN).",
      };
    }
    return { success: true, expression: rawExpr.trim(), result: String(result) };
  } catch (err) {
    return { success: false, error: `Sintaks matematika salah: ${err.message}` };
  }
}

function buildResultContainer(expression, result) {
  const desc = `**Ekspresi:**\n\`\`\`\n${expression}\n\`\`\`\n**Hasil:**\n\`\`\`\n${result}\n\`\`\``;
  const container = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    title: "🧮 Hasil Perhitungan",
    description: desc,
    footerText: ui.getFooter("core"),
  });
  container.title = "🧮 Hasil Perhitungan";
  container.description = desc;
  return container;
}

function buildErrorCalcContainer(expression, errorMsg) {
  const desc = `**Ekspresi:**\n\`\`\`\n${expression}\n\`\`\`\n${ui.getEmoji("cross") || "❌"} ${errorMsg}`;
  const container = buildContainerV2({
    accentColorHex: ui.getColor("error") || "#EF4444",
    title: "🧮 Kalkulator Galat",
    description: desc,
    footerText: ui.getFooter("core"),
  });
  container.title = "🧮 Kalkulator Galat";
  container.description = desc;
  return container;
}

module.exports = {
  aliases: ["calc"],
  data: new SlashCommandBuilder()
    .setName("calculator")
    .setDescription("🧮 Buka kalkulator interaktif atau hitung ekspresi matematika.")
    .addStringOption((opt) =>
      opt
        .setName("ekspresi")
        .setDescription("Ekspresi matematika yang ingin dihitung (misal: 12 * 8 + 4)")
        .setRequired(false),
    ),

  async executePrefix(message, args, client) {
    const rawExpr = args ? args.join(" ").trim() : "";
    if (rawExpr) {
      const evalRes = evaluateMathExpression(rawExpr);
      if (evalRes.success) {
        return message.reply(buildResultContainer(evalRes.expression, evalRes.result));
      }
      return message.reply(buildErrorCalcContainer(rawExpr, evalRes.error));
    }

    // Jika tanpa argumen, tampilkan kalkulator interaktif
    const mockInteraction = {
      id: message.id,
      user: message.author,
      member: message.member,
      guild: message.guild,
      channel: message.channel,
      client,
      isChatInputCommand: () => true,
      options: {
        getString: () => null,
      },
      reply: async (payload) => {
        const normalized = typeof payload === "string" ? { content: payload } : { ...payload };
        delete normalized.ephemeral;
        return await message.reply(normalized);
      },
      editReply: async (payload) => {
        const normalized = typeof payload === "string" ? { content: payload } : { ...payload };
        delete normalized.ephemeral;
        return await message.channel.send(normalized);
      },
    };

    return this.execute(mockInteraction);
  },

  async execute(interaction) {
    const inputExpr = interaction.options?.getString?.("ekspresi")?.trim();
    if (inputExpr) {
      const evalRes = evaluateMathExpression(inputExpr);
      if (evalRes.success) {
        const payload = buildResultContainer(evalRes.expression, evalRes.result);
        return interaction.replied || interaction.deferred
          ? interaction.editReply(payload)
          : interaction.reply(payload);
      }
      const errPayload = {
        ...buildErrorCalcContainer(inputExpr, evalRes.error),
        flags: MessageFlags.Ephemeral,
      };
      return interaction.replied || interaction.deferred
        ? interaction.editReply(errPayload)
        : interaction.reply(errPayload);
    }

    let expression = "";

    const createCalcPayload = (text, buttonRows) => {
      return buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: "🧮 Kalkulator Interaktif",
        description: `\`\`\`\n${text || "0"}\n\`\`\``,
        buttonsRow: buttonRows,
        footerText: ui.getFooter("core"),
      });
    };

    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("calc_clear")
          .setLabel("C")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("calc_(")
          .setLabel("(")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("calc_)")
          .setLabel(")")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("calc_/")
          .setLabel("÷")
          .setStyle(ButtonStyle.Primary),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("calc_7")
          .setLabel("7")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("calc_8")
          .setLabel("8")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("calc_9")
          .setLabel("9")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("calc_*")
          .setLabel("×")
          .setStyle(ButtonStyle.Primary),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("calc_4")
          .setLabel("4")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("calc_5")
          .setLabel("5")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("calc_6")
          .setLabel("6")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("calc_-")
          .setLabel("-")
          .setStyle(ButtonStyle.Primary),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("calc_1")
          .setLabel("1")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("calc_2")
          .setLabel("2")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("calc_3")
          .setLabel("3")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("calc_+")
          .setLabel("+")
          .setStyle(ButtonStyle.Primary),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("calc_0")
          .setLabel("0")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("calc_.")
          .setLabel(".")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("calc_del")
          .setLabel("⌫")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("calc_=")
          .setLabel("=")
          .setStyle(ButtonStyle.Success),
      ),
    ];

    const message = await interaction.reply({
      ...createCalcPayload(expression, rows),
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000,
    });

    const ALLOWED_CALC_TOKENS = new Set([
      "clear", "del", "=", "(", ")", "/", "*", "-", "+", ".",
      "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    ]);
    const SAFE_EXPRESSION_REGEX = /^[0-9+\-*/(). ]+$/;

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content:
            "Ini bukan kalkulatormu! Silakan gunakan perintah `/calculator` sendiri.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const val = i.customId.split("_")[1];
      if (!ALLOWED_CALC_TOKENS.has(val)) {
        return;
      }

      if (val === "clear") {
        expression = "";
      } else if (val === "del") {
        expression = expression.slice(0, -1);
      } else if (val === "=") {
        try {
          if (expression.length > 0 && SAFE_EXPRESSION_REGEX.test(expression)) {
            const result = new Function(`return ${expression}`)();
            expression = Number.isFinite(result) ? String(result) : "Error";
          } else {
            expression = "Error";
          }
        } catch (e) {
          expression = "Error";
        }
      } else {
        if (expression === "Error") expression = "";
        expression += val;
      }

      await i.update(createCalcPayload(expression, rows));
    });

    collector.on("end", async () => {
      rows.forEach((row) =>
        row.components.forEach((btn) => btn.setDisabled(true)),
      );
      await interaction.editReply(createCalcPayload(expression, rows)).catch(() => {});
    });
  },
};
