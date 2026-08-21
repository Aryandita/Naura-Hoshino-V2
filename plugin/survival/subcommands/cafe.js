"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ComponentType,
} = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const cafeEngine = require("../../../src/survival/engines/cafeEngine");
const { CAFE_RECIPES, getRecipeById } = require("../../../src/survival/data/cafeRecipes");
const { drawCafeCard } = require("../../../src/canvas/cafeCanvas");

module.exports = {
  name: "cafe",
  description: "☕ Kelola Cozy Cyber-Cafe & Maid Lounge, masak menu, dan layani pelanggan!",

  async execute(interaction) {
    const action = interaction.options.getString("aksi") || "status";
    const recipeId = interaction.options.getString("resep");
    const targetUser = interaction.options.getUser("target_user");
    const userId = interaction.user.id;
    const username = interaction.user.displayName || interaction.user.username;

    // 1. LIHAT STATUS KAFE
    if (action === "status") {
      const cafe = await cafeEngine.openOrGetCafe(userId, username);
      const files = [];

      try {
        const cardBuffer = await drawCafeCard(cafe);
        files.push(new AttachmentBuilder(cardBuffer, { name: "cafe_status.png" }));
      } catch (err) {
        // Fallback jika canvas gagal render
      }

      const dishes = cafe.activeDishes || {};
      const dishSummary = Object.entries(dishes)
        .filter(([, count]) => Number(count) > 0)
        .map(([id, count]) => {
          const r = getRecipeById(id);
          return `- ${r ? r.emoji : "🍽️"} **${r ? r.name : id}**: \`${count} porsi\` (*${r ? r.price : 200} ⭐*)`;
        })
        .join("\n") || "_Etalase masih kosong. Masak hidangan baru untuk mulai berjualan!_";

      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("cafe_btn_cook")
          .setLabel("🍳 Masak Menu")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("cafe_btn_serve")
          .setLabel("👥 Layani Tamu")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("cafe_btn_collect")
          .setLabel("💰 Klaim Pendapatan")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("cafe_btn_menu")
          .setLabel("📖 Buku Resep")
          .setStyle(ButtonStyle.Secondary),
      );

      const payload = buildContainerV2({
        accentColorHex: "#F9A8D4",
        authorName: "☕ Cozy Cyber-Cafe & Maid Lounge",
        title: `✨ ${cafe.cafeName} (Level ${cafe.level})`,
        description: [
          `Selamat datang di lounge santaimu! Tempat berkumpul hangat para petualang Neo-Hoshino.`,
          ``,
          `⭐ **Reputasi Kafe:** \`${cafe.reputation} REP\` (Level Up: \`${cafe.level * 100} REP\`)`,
          `👥 **Total Tamu Dilayani:** \`${cafe.customersServed} Orang\``,
          `💰 **Pendapatan Pasif Siap Klaim:** \`${Number(cafe.uncollectedRevenue || 0).toLocaleString("id-ID")} ⭐\``,
          ``,
          `🍽️ **Menu Aktif di Etalase:**`,
          dishSummary,
          ``,
          `-# 💡 *Tips: Gunakan tombol di bawah atau command \`/survival life cafe aksi:cook resep:sakura_latte\`!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
        buttonsRow,
      });

      const msg = await interaction.editReply({ ...payload, files });

      // Collector Tombol Interaktif (1 Menit)
      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
      });

      collector.on("collect", async (btnInteraction) => {
        if (btnInteraction.user.id !== userId) {
          return btnInteraction.reply({
            content: "❌ Ini adalah panel kafe milik pemain lain!",
            flags: 64,
          });
        }

        await btnInteraction.deferUpdate();

        if (btnInteraction.customId === "cafe_btn_collect") {
          const collectRes = await cafeEngine.collectIdleRevenue(userId);
          if (!collectRes.success) {
            return interaction.followUp({
              ...buildErrorContainerV2({
                title: "Belum Ada Pendapatan",
                description: "Belum ada akumulasi koin yang bisa diklaim saat ini. Tunggu beberapa waktu lagi!",
              }),
              flags: 64,
            });
          }

          return interaction.followUp({
            ...buildContainerV2({
              accentColorHex: "#86EFAC",
              title: "💰 Pendapatan Berhasil Diklaim!",
              description: `Kamu berhasil mengumpulkan **+${collectRes.collectedAmount.toLocaleString("id-ID")} Star Fragments** dari pendapatan pasif tokomu!`,
              footerText: ui.getFooter("survival"),
            }),
            flags: 64,
          });
        }

        if (btnInteraction.customId === "cafe_btn_serve") {
          const serveRes = await cafeEngine.serveNpcCustomers(userId);
          if (!serveRes.success) {
            return interaction.followUp({
              ...buildErrorContainerV2({
                title: "Etalase Kosong",
                description: "Tidak ada makanan/minuman yang siap disajikan! Masak menu terlebih dahulu.",
              }),
              flags: 64,
            });
          }

          return interaction.followUp({
            ...buildContainerV2({
              accentColorHex: "#38BDF8",
              title: "👥 Pelanggan Telah Dilayani!",
              description: [
                `Pelanggan baru saja membeli **${serveRes.soldQuantity}x ${serveRes.emoji} ${serveRes.dishName}**!`,
                ``,
                `💵 **Hasil Penjualan:** \`+${serveRes.earnings.toLocaleString("id-ID")} ⭐\` (Termasuk tips \`${serveRes.tips} ⭐\`)`,
                `📦 **Sisa Stok:** \`${serveRes.remainingStock} Porsi\``,
                `👥 **Total Tamu:** \`${serveRes.customersServed} Orang\``,
              ].join("\n"),
              footerText: ui.getFooter("survival"),
            }),
            flags: 64,
          });
        }

        if (btnInteraction.customId === "cafe_btn_menu") {
          const recipeList = CAFE_RECIPES.map((r) => {
            const ingList = r.ingredients.map((i) => `${i.amount}x ${i.name}`).join(", ");
            return `### ${r.emoji} ${r.name} (\`${r.id}\`)\n- **Kategori:** \`${r.category}\` | **Harga Jual:** \`${r.price} ⭐\`\n- **Bahan Diperlukan:** ${ingList}\n- **Efek Buff:** *${r.buff.description}*`;
          }).join("\n\n");

          return interaction.followUp({
            ...buildContainerV2({
              accentColorHex: "#FDE047",
              authorName: "📖 Buku Resep & Kuliner Kafe",
              title: "Daftar Resep & Khasiat Hidangan",
              description: recipeList,
              footerText: ui.getFooter("survival"),
            }),
            flags: 64,
          });
        }

        if (btnInteraction.customId === "cafe_btn_cook") {
          // Default cook first available recipe
          const cookRes = await cafeEngine.cookRecipe(userId, "sakura_latte", 1);
          if (!cookRes.success) {
            return interaction.followUp({
              ...buildErrorContainerV2({
                title: "Gagal Memasak",
                description: `Bahan mentah di tas tidak cukup untuk memasak **Sakura Blossom Latte**! Kumpulkan herbal dan air bersih dari aktivitas gathering.`,
              }),
              flags: 64,
            });
          }

          return interaction.followUp({
            ...buildContainerV2({
              accentColorHex: "#F9A8D4",
              title: "🍳 Berhasil Memasak Hidangan!",
              description: [
                `Kamu berhasil memasak **1x ${cookRes.emoji} ${cookRes.dishName}** dan menaruhnya di etalase kafe!`,
                ``,
                `⭐ **Reputasi:** \`+${cookRes.repGain} REP\` (Total: \`${cookRes.currentRep} REP\`)`,
                `📦 **Total Stok Etalase:** \`${cookRes.totalStock} Porsi\``,
                cookRes.levelUp ? `\n🎉 **KAFE NAIK LEVEL!** Sekarang kafe milikmu berada di **Level ${cookRes.newLevel}**!` : "",
              ].join("\n"),
              footerText: ui.getFooter("survival"),
            }),
            flags: 64,
          });
        }
      });

      return;
    }

    // 2. MASAK MENU (COOK)
    if (action === "cook") {
      const targetRecipe = recipeId || "sakura_latte";
      const cookRes = await cafeEngine.cookRecipe(userId, targetRecipe, 1);

      if (!cookRes.success) {
        let msg = "Gagal memasak menu kafe.";
        if (cookRes.reason === "RECIPE_NOT_FOUND") msg = `Resep dengan ID \`${targetRecipe}\` tidak ditemukan! Gunakan buku resep untuk melihat daftar.`;
        if (cookRes.reason === "RECIPE_LOCKED") msg = `Resep ini masih terkunci! Memerlukan kafe Level ${cookRes.requiredLevel}.`;
        if (cookRes.reason === "INSUFFICIENT_INGREDIENTS") msg = `Bahan mentah di inventarismu tidak cukup untuk memasak hidangan ini!`;

        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Gagal Memasak",
            description: msg,
            footerText: ui.getFooter("survival"),
          }),
        });
      }

      const payload = buildContainerV2({
        accentColorHex: "#F9A8D4",
        authorName: "🍳 Dapur Cozy Cafe",
        title: "✨ Masakan Selesai & Masuk Etalase!",
        description: [
          `Kamu telah selesai memasak **1x ${cookRes.emoji} ${cookRes.dishName}**!`,
          ``,
          `⭐ **Reputasi Kafe:** \`+${cookRes.repGain} REP\` (Total: \`${cookRes.currentRep} REP\`)`,
          `📦 **Stok Saat Ini:** \`${cookRes.totalStock} Porsi\``,
          `✨ **Khasiat Buff:** *${cookRes.buff.description}*`,
          cookRes.levelUp ? `\n🎉 **KAFE NAIK LEVEL!** Kafe kini mencapai **Level ${cookRes.newLevel}**!` : "",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    // 3. LAYANI PELANGGAN NPC (SERVE)
    if (action === "serve") {
      const serveRes = await cafeEngine.serveNpcCustomers(userId);
      if (!serveRes.success) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Etalase Kosong",
            description: "Tidak ada makanan atau minuman siap saji di etalasemu! Masak hidangan terlebih dahulu.",
            footerText: ui.getFooter("survival"),
          }),
        });
      }

      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "👥 Layanan Tamu Kafe",
        title: "✨ Pelanggan Menikmati Pesanan!",
        description: [
          `Tamu baru saja membeli dan menghabiskan **${serveRes.soldQuantity}x ${serveRes.emoji} ${serveRes.dishName}**!`,
          ``,
          `💵 **Pendapatan Bersih:** \`+${serveRes.earnings.toLocaleString("id-ID")} ⭐\` (Tips: \`${serveRes.tips} ⭐\`)`,
          `📦 **Sisa Stok:** \`${serveRes.remainingStock} Porsi\``,
          `👥 **Total Tamu Dilayani:** \`${serveRes.customersServed} Orang\``,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    // 4. KLAIM PENDAPATAN PASIF (COLLECT)
    if (action === "collect") {
      const collectRes = await cafeEngine.collectIdleRevenue(userId);
      if (!collectRes.success) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Belum Ada Pendapatan",
            description: "Belum ada akumulasi pendapatan pasif yang bisa diklaim saat ini. Tunggu beberapa waktu lagi!",
            footerText: ui.getFooter("survival"),
          }),
        });
      }

      const payload = buildContainerV2({
        accentColorHex: "#86EFAC",
        authorName: "💰 Kasir Kafe",
        title: "✨ Pendapatan Pasif Diklaim!",
        description: [
          `Kamu telah memanen hasil usaha dari **${collectRes.cafeName}**!`,
          ``,
          `💰 **Total Koin Masuk:** \`+${collectRes.collectedAmount.toLocaleString("id-ID")} Star Fragments\``,
          `📈 **Level Usaha:** \`Level ${collectRes.level}\``,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    // 5. BELI DARI KAFE PEMAIN LAIN (ORDER)
    if (action === "order") {
      if (!targetUser) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Pemain Tidak Ditentukan",
            description: "Tentukan pemilik kafe yang ingin kamu kunjungi menggunakan opsi `target_user`!",
            footerText: ui.getFooter("survival"),
          }),
        });
      }

      const targetRecipe = recipeId || "sakura_latte";
      const orderRes = await cafeEngine.orderDishFromUser(userId, targetUser.id, targetRecipe, username);

      if (!orderRes.success) {
        let msg = "Gagal memesan hidangan.";
        if (orderRes.reason === "CANNOT_ORDER_FROM_SELF") msg = "Kamu tidak bisa memesan makanan dari kafemu sendiri!";
        if (orderRes.reason === "SELLER_NO_CAFE") msg = `<@${targetUser.id}> belum membuka usaha kafe!`;
        if (orderRes.reason === "OUT_OF_STOCK") msg = `Menu \`${targetRecipe}\` di kafe <@${targetUser.id}> sedang habis!`;
        if (orderRes.reason === "INSUFFICIENT_FUNDS") msg = `Saldo Star Fragments milikmu tidak cukup (${orderRes.price} ⭐)!`;

        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Pesanan Gagal",
            description: msg,
            footerText: ui.getFooter("survival"),
          }),
        });
      }

      const payload = buildContainerV2({
        accentColorHex: "#A855F7",
        authorName: "🛍️ Pesanan Kafe Antar-Pemain",
        title: "✨ Pesanan Kuliner Berhasil!",
        description: [
          `Kamu berhasil membeli **1x ${orderRes.emoji} ${orderRes.dishName}** dari **${orderRes.sellerCafeName}** (<@${targetUser.id}>)!`,
          ``,
          `💸 **Biaya:** \`${orderRes.price} Star Fragments\``,
          `✨ **Khasiat Buff Aktif:** *${orderRes.buff.description}* (Berlaku selama ${orderRes.buff.durationHours} jam)`,
          ``,
          `-# 💡 *Koin telah langsung dikirimkan ke pemilik kafe dan reputasi kafenya bertambah!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }
  },
};
