const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { drawRoundedRect, drawCircularImage, truncateText } = require('./CanvasUtils');

const UI_COLORS = {
    background: '#0a0d14',
    card: '#0c111c',
    primary: '#00D9FF',
    textMain: '#ffffff',
    textSub: '#8e98b0',
    gold: '#FFD700'
};

/**
 * Generate sebuah canvas gambar pop-up saat user membuka achievement
 * @param {Object} user - Discord user object
 * @param {String} title - Nama achievement
 * @param {String} subtitle - Deksripsi/Lore achievement
 * @param {String} badgeColor - Warna tema achievement
 */
async function generateAchievementImage(user, title, subtitle, badgeColor = '#FFD700') {
    const canvas = createCanvas(800, 220);
    const ctx = canvas.getContext('2d');

    // Background Canvas
    drawRoundedRect(ctx, 0, 0, 800, 220, 25, UI_COLORS.background);
    
    // Border Glow/Stroke Inner Card
    drawRoundedRect(ctx, 15, 15, 770, 190, 15, 'rgba(255,255,255,0.03)', badgeColor);

    // Konfigurasi Avatar
    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
    let userAvatarImg;
    try {
        userAvatarImg = await loadImage(avatarUrl);
    } catch (e) {}

    // Gambar Avatar
    if (userAvatarImg) {
        drawCircularImage(ctx, userAvatarImg, 110, 110, 70, badgeColor);
    }

    // Teks Pengumuman
    ctx.fillStyle = badgeColor;
    ctx.font = 'bold 24px "MontserratBold", "EmojiFont", sans-serif';
    ctx.fillText('ACHIEVEMENT UNLOCKED!', 210, 70);

    // Title / Nama Achievement
    ctx.fillStyle = UI_COLORS.textMain;
    ctx.font = 'bold 36px "MontserratBold", "EmojiFont", sans-serif';
    const cleanTitle = truncateText(ctx, title, 550);
    ctx.fillText(cleanTitle, 210, 115);

    // Subtitle / Lore
    ctx.fillStyle = UI_COLORS.textSub;
    ctx.font = '20px "Inter", "EmojiFont", sans-serif';
    const cleanSubtitle = truncateText(ctx, subtitle, 550);
    ctx.fillText(cleanSubtitle, 210, 155);

    return canvas.toBuffer('image/png');
}

module.exports = { generateAchievementImage };
