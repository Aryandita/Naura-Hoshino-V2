const {
  createCanvas,
  loadImage,
  runWithLimit,
} = require("./canvasRuntime");
const path = require("path");
const fs = require("fs");

/**
 * Generate Unified Profile Card (/user info)
 *
 * @param {Object} payload Payload from worker thread
 */
async function generateUnifiedProfile(payload) {
  const { user, profile, survival, extra = {} } = payload;
  
  return await runWithLimit(async () => {
    const canvas = createCanvas(900, 400);
    const ctx = canvas.getContext("2d");

    // 1. Latar Belakang (Banner Kustom atau Gradien Default)
    let bannerLoaded = false;
    try {
      if (profile.activeBanners) {
        const activeBanners = typeof profile.activeBanners === "string" ? JSON.parse(profile.activeBanners) : profile.activeBanners;
        if (activeBanners && activeBanners.profile) {
          const bannerPath = path.join(__dirname, "assets", "banners", activeBanners.profile + ".png");
          if (fs.existsSync(bannerPath)) {
            const bg = await loadImage(bannerPath);
            ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "rgba(10, 10, 15, 0.65)"; // Dark overlay
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            bannerLoaded = true;
          }
        }
      }
    } catch (e) {}

    if (!bannerLoaded) {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, "#0f172a");
      gradient.addColorStop(0.5, "#1e1b4b");
      gradient.addColorStop(1, "#312e81");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Base Panel (Glassmorphism)
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.beginPath();
    ctx.roundRect(20, 20, 860, 360, 24);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Avatar
    const avatarSize = 120;
    const avatarX = 40;
    const avatarY = 40;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    try {
      const avatarUrl = typeof user.displayAvatarURL === "function" ? user.displayAvatarURL({ extension: "png", size: 256 }) : user.avatarUrl;
      const avatar = await loadImage(avatarUrl);
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    } catch (e) {
      ctx.fillStyle = "#333";
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.stroke();

    // 4. User Name and Badges
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(user.username || "Sobat Naura", 180, 80);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "italic 18px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(profile.custom_title || "Petualang Pemula", 180, 105);

    // 5. Data Points
    const survivalLvl = survival ? (survival.level || 1) : 1;
    const chatLvl = profile.leveling_level || 1;
    
    const ncWallet = profile.economy_wallet || 0;
    const ncBank = profile.economy_bank || 0;
    const totalNc = ncWallet + ncBank;
    
    const nsf = survival ? (survival.starFragments || 0) : 0;
    const coupons = survival ? (survival.coupons || 0) : 0;
    const tracksListened = profile.music_tracksListened || 0;

    const minigamePts = (profile.minigame_mathScore || 0) +
                        (profile.minigame_triviaScore || 0) +
                        (profile.minigame_rpsWin || 0) * 10 +
                        (profile.minigame_tttWin || 0) * 10 +
                        (profile.minigame_wordleWin || 0) * 20 +
                        (profile.minigame_duelScore || 0);

    const cols = [180, 420, 660];
    const rows = [160, 240, 320];

    const drawStat = (x, y, label, value, icon) => {
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "600 14px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(label.toUpperCase(), x, y);
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(`${icon} ${value}`, x, y + 28);
    };

    drawStat(cols[0], rows[0], "Survival Level", `Lv. ${survivalLvl}`, "🌲");
    drawStat(cols[1], rows[0], "Chat Level", `Lv. ${chatLvl}`, "💬");
    drawStat(cols[2], rows[0], "Minigame Points", minigamePts.toLocaleString("id-ID"), "🎮");

    drawStat(cols[0], rows[1], "Total NC", totalNc.toLocaleString("id-ID"), "🪙");
    drawStat(cols[1], rows[1], "Star Fragments", nsf.toLocaleString("id-ID"), "💠");
    drawStat(cols[2], rows[1], "Naura Coupons", coupons.toLocaleString("id-ID"), "🎟️");

    drawStat(cols[0], rows[2], "Tracks Listened", tracksListened.toLocaleString("id-ID"), "🎧");

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "600 14px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("LISTENING WITH", cols[1], rows[2]);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "italic 16px 'Segoe UI', Arial, sans-serif";
    const friends = extra.friendsInVoice || [];
    let friendsText = "Sendirian~";
    if (friends.length > 0) {
       friendsText = friends.slice(0, 3).join(", ");
       if (friends.length > 3) friendsText += ` +${friends.length - 3} lainnya`;
    }
    ctx.fillText(friendsText, cols[1], rows[2] + 24);

    // Watermark
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.font = "bold 20px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("NAURA HOSHINO V2", canvas.width - 40, canvas.height - 35);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
  });
}

module.exports = {
  generateUnifiedProfile,
};
