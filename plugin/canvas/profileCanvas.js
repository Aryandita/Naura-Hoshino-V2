const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Pendaftaran Font Lokal
try {
    GlobalFonts.registerFromPath(path.join(__dirname, '../../assets/fonts/Montserrat/Montserrat-Bold.ttf'), 'MontserratBold');
    GlobalFonts.registerFromPath(path.join(__dirname, '../../assets/fonts/Inter/Inter-Regular.ttf'), 'Inter');
    GlobalFonts.registerFromPath(path.join(__dirname, '../../assets/fonts/Inter/Inter-Bold.ttf'), 'InterBold');
    GlobalFonts.registerFromPath(path.join(__dirname, '../../assets/fonts/emoji/NotoColorEmoji.ttf'), 'EmojiFont');
} catch (e) {}

/**
 * Generate a dynamic profile card using canvas
 */
async function generateProfileCard(user, userProfile, userLeveling, rankNumber) {
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext('2d');

    // Latar Belakang (Gradient Modern)
    const gradient = ctx.createLinearGradient(0, 0, 800, 300);
    gradient.addColorStop(0, '#0f0c29');
    gradient.addColorStop(0.5, '#302b63');
    gradient.addColorStop(1, '#24243e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Efek Glassmorphism (Kotak Semi Transparan)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.roundRect(20, 20, 760, 260, 15);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Gambar Avatar User
    const avatarSize = 150;
    const avatarX = 50;
    const avatarY = 75;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    try {
        // Fallback untuk PNG
        const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarUrl);
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    } catch (e) {
        ctx.fillStyle = '#333';
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }
    ctx.restore();

    // Bingkai Avatar
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
    ctx.lineWidth = 6;
    ctx.strokeStyle = userProfile.isPremium ? '#FFD700' : '#00FFFF'; // Gold untuk Premium
    ctx.stroke();

    // Jika premium, tambahkan icon crown
    if (userProfile.isPremium) {
        ctx.font = '30px "EmojiFont"';
        ctx.fillText('👑', avatarX + 110, avatarY + 30);
    }

    // Teks Username
    ctx.font = 'bold 36px "MontserratBold", "EmojiFont"';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(user.username.length > 15 ? user.username.substring(0, 15) + '...' : user.username, 230, 95);

    // Teks Level & Rank
    ctx.font = 'bold 24px "InterBold", "EmojiFont"';
    ctx.fillStyle = '#FFD700'; // Gold Color
    ctx.fillText(`Rank #${rankNumber}  |  Level ${userLeveling.level}`, 230, 140);

    // Teks Manners Point (Tata Krama)
    ctx.font = '20px "Inter", "EmojiFont"';
    let mannersColor = '#00FF00';
    if (userLeveling.mannersPoint <= 50) mannersColor = '#FFA500';
    if (userLeveling.mannersPoint <= 20) mannersColor = '#FF0000';

    ctx.fillStyle = mannersColor;
    ctx.fillText(`Tata Krama: ${userLeveling.mannersPoint}/100`, 230, 175);

    // Saldo Economy
    ctx.fillStyle = '#FFB6C1'; // Light Pink
    const wallet = userProfile.economy_wallet || 0;
    const bank = userProfile.economy_bank || 0;
    ctx.font = '20px "Inter", "EmojiFont"';
    ctx.fillText(`💳 Saldo Wallet: Rp ${wallet.toLocaleString('id-ID')}`, 230, 210);

    // Progress Bar XP
    // Asumsi rumus level: next_level_xp = level * 100
    const xpCurrent = userLeveling.xp || 0;
    const xpNeeded = userLeveling.level * 100;

    const barX = 230;
    const barY = 235;
    const barWidth = 500;
    const barHeight = 25;

    // Latar belakang bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, 12);
    ctx.fill();

    // Isi Progress
    let progress = Math.min(xpCurrent / xpNeeded, 1);
    if (isNaN(progress) || progress < 0) progress = 0;

    const progressWidth = Math.max(barWidth * progress, 15); // Minimal 15px agar rounded corner terlihat bagus

    if (progressWidth > 0) {
        const progressGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
        progressGradient.addColorStop(0, '#00FFFF');
        progressGradient.addColorStop(1, '#FF00FF');

        ctx.fillStyle = progressGradient;
        ctx.beginPath();
        ctx.roundRect(barX, barY, progressWidth, barHeight, 12);
        ctx.fill();
    }

    // Teks XP di dalam Bar
    ctx.font = 'bold 14px "InterBold", "EmojiFont"';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(`${xpCurrent} / ${xpNeeded} XP`, barX + barWidth / 2, barY + 18);

    return canvas.toBuffer('image/png');
}

module.exports = { generateProfileCard };
