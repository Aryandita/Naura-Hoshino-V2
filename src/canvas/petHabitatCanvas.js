"use strict";

const { createCanvas, runWithLimit } = require("./canvasRuntime");

/**
 * Render visual kamar santai habitat pet
 */
async function drawPetHabitatCard(habitatData) {
  return await runWithLimit(async () => {
    const width = 800;
    const height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const pet = habitatData.activePet || {
      petName: "Mimi",
      petType: "cyber_cat",
      petLevel: 1,
      affection: 50,
      mood: "happy",
      cosmicAura: false,
      passiveSkill: "LUCKY_PAW",
    };

    const isCosmic = pet.cosmicAura || pet.petType.startsWith("cosmic_");

    // 1. Background
    ctx.fillStyle = "#0B0C10";
    ctx.beginPath();
    ctx.roundRect(10, 10, width - 20, height - 20, 20);
    ctx.fill();

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, isCosmic ? "#3B0764" : "#1E1B4B");
    bgGrad.addColorStop(0.5, "#0F172A");
    bgGrad.addColorStop(1, "#050608");
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.fill();

    // 2. Neon Border
    ctx.save();
    ctx.strokeStyle = isCosmic ? "#C084FC" : "#F472B6";
    ctx.lineWidth = 2;
    ctx.shadowColor = isCosmic ? "#C084FC" : "#F472B6";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.roundRect(15, 15, width - 30, height - 30, 16);
    ctx.stroke();
    ctx.restore();

    // 3. Header
    ctx.font = 'bold 13px "Orbitron", "EmojiFont"';
    ctx.fillStyle = isCosmic ? "#E879F9" : "#38BDF8";
    ctx.fillText("🏡 PET SANCTUARY & COSMIC HABITAT", 40, 50);

    ctx.textAlign = "right";
    ctx.fillStyle = "#FFD700";
    ctx.fillText(`LEVEL ${pet.petLevel || 1}  |  💖 ${pet.affection || 0}% KASIH SAYANG`, width - 40, 50);
    ctx.textAlign = "left";

    // 4. Pet Name & Cosmic Badge
    ctx.font = 'bold 28px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    const nameStr = pet.petName || pet.petType;
    ctx.fillText(nameStr, 40, 95);

    if (isCosmic) {
      ctx.font = 'bold 12px "Orbitron", "EmojiFont"';
      ctx.fillStyle = "#C084FC";
      ctx.fillText("✨ COSMIC ASCENDED", 40 + ctx.measureText(nameStr).width + 15, 95);
    }

    // 5. Center Showcase Box (Habitat Room)
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.beginPath();
    ctx.roundRect(40, 120, width - 80, 240, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    // Pet Avatar Representation
    ctx.font = '60px "EmojiFont"';
    ctx.textAlign = "center";
    const petEmoji = isCosmic ? "🌌" : pet.petType.includes("dragon") ? "🐉" : pet.petType.includes("cat") ? "🐱" : "🐺";
    ctx.fillText(petEmoji, width / 2, 220);

    ctx.font = 'bold 16px "Outfit", "EmojiFont"';
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(pet.petType.toUpperCase().replace("_", " "), width / 2, 260);

    ctx.font = '13px "Outfit", "EmojiFont"';
    ctx.fillStyle = "#94A3B8";
    ctx.fillText(`Mood: ${pet.mood ? pet.mood.toUpperCase() : "HAPPY"}  |  Skill: ${pet.passiveSkill || "LUCKY_DROP"}`, width / 2, 290);
    ctx.textAlign = "left";

    // 6. Bottom Stats & Toys
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.roundRect(40, 380, width - 80, 80, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.stroke();

    ctx.font = 'bold 13px "Orbitron", "EmojiFont"';
    ctx.fillStyle = "#F9A8D4";
    ctx.fillText("🎾 MAINAN HABITAT:", 55, 415);

    ctx.font = '13px "Outfit", "EmojiFont"';
    ctx.fillStyle = "#CBD5E1";
    ctx.fillText("• Cyber Laser Pointer   • Sakura Plush Ball   • Catnip Circuit", 55, 440);

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  drawPetHabitatCard,
  renderPetHabitat: drawPetHabitatCard,
};
