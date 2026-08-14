"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const UserSurvival = require("../../../src/models/UserSurvival");
const UserPet = require("../../../src/models/UserPet");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const {
  safeParseInventory,
  findItem,
  removeItem,
} = require("../../../src/survival/engines/inventoryHelper");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const petActions = require("../../../src/survival/helpers/petActions");
const fs = require("fs");
const path = require("path");
const { AttachmentBuilder } = require("discord.js");

const COLLECTOR_MS = 60000;
const BREED_FEE = 5000;
const BREED_MIN_LEVEL = 10;
const MUTANT_CHANCE = 0.1;
const XP_PER_MEAL = 20;
const XP_PER_LEVEL = 100;

// ID di bawah ini sudah dicocokkan dengan katalog item. Versi lama mencari
// 'pet_food' dan 'meat' yang tidak pernah ada, jadi tombol beri makan selalu
// menolak walaupun tas pemain penuh makanan hewan.
const PET_FOODS = [
  { id: "bone", hunger: 20 },
  { id: "small_fish", hunger: 30 },
  { id: "mystic_herb", hunger: 40 },
  { id: "dragon_meat", hunger: 60 },
];

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function ephemeral(content) {
  return { content, flags: MessageFlags.Ephemeral };
}

function petLabel(pet) {
  return pet.petName || pet.petType;
}

function statLines(pet) {
  const buffText = pet.passiveSkill && pet.passiveSkill !== 'none' 
    ? `\n**Passive Skill:** \`${pet.passiveSkill}\`` 
    : "";
  return [
    `**Spesies:** ${String(pet.petType).toUpperCase()}`,
    `**Level:** ${pet.petLevel || 1} (${pet.petExp || 0}/${XP_PER_LEVEL} XP)`,
    `**Lapar:** ${pet.hunger || 0}/100`,
    `**Afeksi:** ${pet.affection || 0}/100`,
    `**Mood:** ${String(pet.mood || 'normal').toUpperCase()}${buffText}`
  ].join("\n");
}

module.exports = {
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const pets = await UserPet.findAll({ where: { userId: interaction.user.id } });
    if (pets.length === 0) return interaction.respond([]).catch(() => {});
    
    const available = pets.map(p => ({
      name: `🐾 ${p.petName || p.petType} (Lv.${p.petLevel || 1})`,
      value: String(p.id)
    }));
    
    const filtered = available
      .filter(it => it.name.toLowerCase().includes(focusedValue))
      .slice(0, 25);
    await interaction.respond(filtered).catch(() => {});
  },

  async execute(interaction) {
    const user = interaction.user;
    await UserSurvival.findOrCreate({ where: { userId: user.id } });

    const pets = await UserPet.findAll({ where: { userId: user.id } });
    if (pets.length === 0) {
      return ui.sendError(interaction, "err_sys_55", true);
    }

    const targetPetId = interaction.options.getString("nama_pet");
    let pet = pets.find((p) => p.isActive) || pets[0];
    if (targetPetId) {
      const matchedPet = pets.find(p => String(p.id) === targetPetId);
      if (matchedPet) pet = matchedPet;
    }
    
    const action = interaction.options.getString("aksi");

    // Handle Image attachment
    const getPetImage = (petType) => {
      const imgPath = path.join(__dirname, "../../../assets/survival/pets", `${petType}.png`);
      if (fs.existsSync(imgPath)) {
         return new AttachmentBuilder(imgPath, { name: "pet.png" });
      }
      return null;
    };

    const buildPetPayload = (moodEmoji, closing, imgAttachment) =>
      buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFC0CB",
        authorName: "Naura Pet Care",
        title: `${e(moodEmoji, "\uD83D\uDC3E")} ${petLabel(pet)} nemenin kamu`,
        iconURL: user.displayAvatarURL(),
        description: `${statLines(pet)}\n\n${closing}`,
        footerText: ui.getFooter("survival"),
        bannerAttachmentName: imgAttachment ? "pet.png" : undefined
      });

    const greeting = `Naura sempat main sama ${petLabel(pet)} tadi, lucu banget! Rawat dia terus yaa. Kalau sudah cukup kuat, Ki Prawiro mau bantu breeding, lho.`;

    const buildRow = (disabled = false) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pet_feed")
          .setLabel("Beri Makan")
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId("pet_play")
          .setLabel("Ajak Main")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId("pet_breed")
          .setLabel("Breeding (Ki Prawiro)")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled),
      );

    const imgBase = getPetImage(pet.petType);
    const basePayload = buildPetPayload("happy", greeting, imgBase);
    
    const processPlay = async (responder, asFollowUp = true) => {
      pet.hunger = Math.max(0, (pet.hunger || 0) - 10);
      pet.affection = Math.min(100, (pet.affection || 0) + 15);
      pet.petExp = (pet.petExp || 0) + Math.floor(XP_PER_MEAL / 2);

      let naikLevel = false;
      while (pet.petExp >= XP_PER_LEVEL) {
        pet.petExp -= XP_PER_LEVEL;
        pet.petLevel = (pet.petLevel || 1) + 1;
        naikLevel = true;
      }
      
      petActions.evaluateMood(pet);
      const evo = petActions.evaluateEvolution(pet);
      await pet.save();

      if (evo.evolved) {
        const evoPayload = ephemeral(`🌟 **LUAR BIASA!** Peliharaanmu **${evo.oldName}** berevolusi menjadi **${evo.newName}**!`);
        if (asFollowUp) responder.followUp(evoPayload);
        else interaction.followUp(evoPayload);
      } else if (naikLevel) {
        const lvlPayload = ephemeral(`${e("impressed", "\uD83C\uDF89")} **${petLabel(pet)}** naik ke Level ${pet.petLevel}!`);
        if (asFollowUp) responder.followUp(lvlPayload);
        else interaction.followUp(lvlPayload);
      }
      
      const img = getPetImage(pet.petType);
      const payload = buildPetPayload(pet.mood === "happy" ? "happy" : "normal", `Woof! ${petLabel(pet)} bereaksi diajak bermain.`, img);
      
      const resPayload = { ...payload, components: [...payload.components, buildRow()], files: img ? [img] : [] };
      if (asFollowUp) return responder.editReply(resPayload);
      else return responder.reply(resPayload);
    };

    const processFeed = async (responder, asFollowUp = true) => {
      const profile = await cacheManager.getUserProfile(user.id);
      const inv = safeParseInventory(profile.inventory);

      const food = PET_FOODS.find((f) => findItem(inv, f.id));
      if (!food) {
        const errPayload = ephemeral(`${e("akward", "\u274C")} Tas kamu belum ada makanan hewan. Coba beli Tulang atau Ikan Kecil dulu yaa!`);
        return asFollowUp ? responder.followUp(errPayload) : responder.reply(errPayload);
      }

      profile.inventory = removeItem(inv, food.id, 1);
      profile.changed("inventory", true);
      await profile.save();

      pet.hunger = Math.min(100, (pet.hunger || 0) + food.hunger);
      pet.affection = Math.min(100, (pet.affection || 0) + 5);
      pet.petExp = (pet.petExp || 0) + XP_PER_MEAL;

      let naikLevel = false;
      while (pet.petExp >= XP_PER_LEVEL) {
        pet.petExp -= XP_PER_LEVEL;
        pet.petLevel = (pet.petLevel || 1) + 1;
        naikLevel = true;
      }

      petActions.evaluateMood(pet);
      const evo = petActions.evaluateEvolution(pet);
      await pet.save();

      if (evo.evolved) {
        const evoPayload = ephemeral(`🌟 **LUAR BIASA!** Peliharaanmu **${evo.oldName}** berevolusi menjadi **${evo.newName}**!`);
        if (asFollowUp) responder.followUp(evoPayload);
        else interaction.followUp(evoPayload);
      } else if (naikLevel) {
        const lvlPayload = ephemeral(`${e("impressed", "\uD83C\uDF89")} **${petLabel(pet)}** naik ke Level ${pet.petLevel}! Naura bangga banget sama kalian berdua.`);
        if (asFollowUp) responder.followUp(lvlPayload);
        else interaction.followUp(lvlPayload);
      }
      
      const img = getPetImage(pet.petType);
      const payload = buildPetPayload(pet.mood === "happy" ? "happy" : "normal", `Nyam nyam... ${petLabel(pet)} makan dengan lahap. Naura ikut senang lihatnya!`, img);
      
      const resPayload = { ...payload, components: [...payload.components, buildRow()], files: img ? [img] : [] };
      if (asFollowUp) return responder.editReply(resPayload);
      else return responder.reply(resPayload);
    };

    if (action === "feed") {
       const reply = await processFeed(interaction, false);
       if (reply) return;
    } else if (action === "play") {
       const reply = await processPlay(interaction, false);
       if (reply) return;
    } else if (action === "tame") {
       return interaction.reply(ephemeral("Naura belum menemukan hewan liar yang bisa dijinakkan di sekitar sini!"));
    } else {
      await interaction.reply({
        ...basePayload,
        components: [...basePayload.components, buildRow()],
        files: imgBase ? [imgBase] : []
      });
    }

    const message = await interaction.fetchReply().catch(() => null);
    if (!message) return;

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();

      if (i.customId === "pet_feed") {
        await processFeed(i, true);
      }
      if (i.customId === "pet_play") {
        await processPlay(i, true);
      }

      if (i.customId === "pet_breed") {
        const eligiblePets = pets.filter(p => (p.petLevel || 1) >= 15);

        if (eligiblePets.length < 2) {
          return i.followUp(
            ephemeral(
              `${e("thinking", "\u274C")} **Ki Prawiro:** "Kamu butuh setidaknya dua peliharaan Level 15 ke atas untuk di-breeding. Kembalilah nanti ya."`
            )
          );
        }

        const profile = await cacheManager.getUserProfile(user.id);
        if ((profile.economy_wallet || 0) < BREED_FEE) {
          return i.followUp(
            ephemeral(
              `${e("cry", "\u274C")} **Ki Prawiro:** "Jasa breeding butuh ${BREED_FEE.toLocaleString("id-ID")} Coin. Uangmu belum cukup."`
            )
          );
        }

        await profile.decrement("economy_wallet", { by: BREED_FEE });

        // Kombinasikan dua pet pertama yang level >= 15
        const p1 = eligiblePets[0];
        const p2 = eligiblePets[1];

        let resultType = "mutant_" + p1.petType;
        if (p1.petType !== p2.petType) resultType = "chimera";

        // Reset level indukan ke level 1? Atau biarkan saja? Biarkan saja sebagai bonus breeding.
        await UserPet.create({
          userId: user.id,
          petType: resultType,
          isTamed: true,
          affection: 50,
          mood: "happy",
          evolutionStage: 2, // Lahir langsung kuat
          passiveSkill: petActions.EVOLUTION_TREE && petActions.EVOLUTION_TREE["default"] ? petActions.EVOLUTION_TREE["default"][2].passive : "none"
        });

        return i.followUp(
          ephemeral(
            `${e("cheers", "\uD83E\uDDEC")} Proses Breeding oleh Ki Prawiro berhasil! Dari gabungan **${p1.petType}** dan **${p2.petType}**, lahir peliharaan baru bertipe **${resultType.toUpperCase()}**. Selamat yaa!`
          )
        );
      }
    });

    collector.on("end", async () => {
      // Pesan Components V2 tidak boleh diedit hanya dengan components saja,
      // seluruh payload harus dikirim ulang.
      const closingImg = getPetImage(pet.petType);
      const closing = buildPetPayload(
        "sleepy",
        `${petLabel(pet)} sudah ngantuk. Panggil Naura lagi kalau mau main sama dia, yaa!`,
        closingImg
      );
      await interaction
        .editReply({
          ...closing,
          components: [...closing.components, buildRow(true)],
          files: closingImg ? [closingImg] : []
        })
        .catch(() => {});
    });
  },
};
