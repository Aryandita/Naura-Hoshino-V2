// Lokasi: src/utils/canvasHelper.js
const { createCanvas, loadImage, GlobalFonts } = require('./canvasRuntime');
const { logger } = require('../../src/managers/logger');
const axios = require('axios');
const path = require('path');
const ui = require('../../src/config/ui');



const UI_COLORS = {
    background: '#0a0d14',
    card: '#0c111c',
    primary: '#00D9FF',
    secondary: '#1a243d',
    textMain: '#ffffff',
    textSub: '#8e98b0',
    gold: '#FFD700' // Tambahan warna VIP
};

const formatDur = ms => {
    if (!ms || isNaN(ms) || ms === 0) return '0 Menit';
    if (ms > 3600000000) return 'Radio / Live Stream';

    const totalSeconds = Number(ms) / 1000;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) return `${hours} J ${minutes} M`;
    return `${minutes} Menit`;
};

const drawCircularImage = (ctx, img, x, y, radius, borderColor) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = UI_COLORS.card;
    ctx.fill();
    ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);

    if (borderColor) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2, true);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 4;
        ctx.stroke();
    }
    ctx.restore();
};

const drawArcProgressBar = (ctx, x, y, radius, current, total, color, width) => {
    if (!total || total === 0 || total > 3600000000) return;
    const percentage = Math.min(1, current / total);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2, false);
    ctx.strokeStyle = UI_COLORS.secondary;
    ctx.lineWidth = width;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2 * percentage, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
};

const wrapText = (ctx, text, x, y, maxWidth, lineHeight, maxLines) => {
    const words = text.toString().split(' ');
    let line = '';
    let currentY = y;
    let lineCount = 1;

    for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && n > 0) {
            if (lineCount === maxLines) {
                ctx.fillText(line.trim() + '...', x, currentY);
                return currentY;
            }
            ctx.fillText(line.trim(), x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
            lineCount++;
        } else {
            line = testLine;
        }
    }
    if (lineCount <= maxLines) {
        ctx.fillText(line.trim(), x, currentY);
    }
    return currentY;
};

// Fitur truncate satu baris (memotong teks dengan ...)
const truncateText = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
};

async function generateMusicProfileImage(user, stats, clientAvatar) {
    const canvas = createCanvas(1000, 650); // Tinggi diperbesar untuk muat 5 list
    const ctx = canvas.getContext('2d');

    const isVIP = stats.isPremium;
    const themeColor = isVIP ? UI_COLORS.gold : UI_COLORS.primary;

    // Background - Dark Elegant Gradient
    const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGradient.addColorStop(0, '#090a0f');
    bgGradient.addColorStop(1, '#111522');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative Blur
    ctx.save();
    const blurGlow = ctx.createRadialGradient(200, 200, 50, 200, 200, 400);
    // Glow menyesuaikan status VIP
    blurGlow.addColorStop(0, isVIP ? 'rgba(255, 215, 0, 0.15)' : 'rgba(0, 217, 255, 0.15)');
    blurGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = blurGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const fillRoundedRect = (x, y, w, h, r, color) => {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
        ctx.fillStyle = color;
        ctx.fill();
    };

    // 🪧 MAIN HEADER CARD
    fillRoundedRect(40, 40, 920, 200, 25, 'rgba(255, 255, 255, 0.03)');
    ctx.strokeStyle = isVIP ? 'rgba(255, 215, 0, 0.5)' : 'rgba(0, 217, 255, 0.3)';
    ctx.lineWidth = isVIP ? 2 : 1; // Card VIP lebih tebal garisnya
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(40, 40, 920, 200, 25);
        ctx.stroke();
    }

    let userAvatarImg;
    try {
        userAvatarImg = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
    } catch (e) {
        userAvatarImg = await loadImage(clientAvatar);
    }

    drawCircularImage(ctx, userAvatarImg, 135, 140, 70, themeColor);

    // --- IDENTITAS (Kiri Header) ---
    ctx.fillStyle = UI_COLORS.textMain;
    ctx.font = 'bold 36px "MontserratBold", "EmojiFont", sans-serif';
    ctx.fillText(user.displayName || user.username, 230, 110);

    ctx.fillStyle = themeColor;
    ctx.font = '20px "Inter", sans-serif';
    ctx.fillText(`@${user.username}`, 230, 145);

    // TAG VIP/MEMBER (Di bawah Username)
    ctx.fillStyle = isVIP ? '#FFD700' : UI_COLORS.textSub;
    ctx.font = 'bold 18px "InterBold", "EmojiFont", sans-serif';
    ctx.fillText(isVIP ? '👑 VIP Prestige' : '🔹 Member Profile', 230, 185);

    // --- STATISTIK (Kanan Header) ---
    // Kolom 1: Total Trek & Durasi
    ctx.fillStyle = UI_COLORS.textSub;
    ctx.font = '16px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Total Trek', 550, 90);
    ctx.fillText('Total Durasi', 730, 90);

    ctx.fillStyle = UI_COLORS.textMain;
    ctx.font = 'bold 28px "MontserratBold", sans-serif';
    ctx.fillText(`${stats.tracksListened || 0}`, 550, 125);
    ctx.fillText(`${formatDur(stats.totalDurationMs)}`, 730, 125);

    // Kolom Bawah: Terakhir Diputar (Sejajar dengan metrik di atas)
    ctx.fillStyle = UI_COLORS.textSub;
    ctx.font = '16px "Inter", sans-serif';
    ctx.fillText('Terakhir Diputar:', 550, 180);

    ctx.fillStyle = UI_COLORS.textMain;
    ctx.font = 'bold 20px "InterBold", "EmojiFont", sans-serif';
    const lastListenedText = truncateText(ctx, stats.lastListened, 380); // Potong jika terlalu panjang
    ctx.fillText(lastListenedText, 550, 210);

    // ==========================================
    // 🗂️ 3 CARDS SECTION (TOP 5 LISTS)
    // ==========================================
    const cardY = 270;
    const cardW = 286;
    const cardH = 310;
    const gap = 30;

    // --- Fungsi Bantuan Pembuat List ---
    const drawList = (items, startX, startY) => {
        if (!items || items.length === 0) {
            ctx.fillStyle = UI_COLORS.textSub;
            ctx.font = 'italic 18px "Inter", sans-serif';
            ctx.fillText('Belum ada data', startX, startY);
            return;
        }

        ctx.font = 'bold 18px "InterBold", "EmojiFont", sans-serif';
        items.forEach((item, i) => {
            // Ranking Number (Highlight)
            ctx.fillStyle = themeColor;
            ctx.fillText(`${i + 1}.`, startX, startY + i * 45);

            // Value
            ctx.fillStyle = UI_COLORS.textMain;
            const itemText = truncateText(ctx, item, cardW - 50);
            ctx.fillText(itemText, startX + 25, startY + i * 45);
        });
    };

    // --- CARD 1: Lagu Favorit ---
    fillRoundedRect(40, cardY, cardW, cardH, 20, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = themeColor;
    ctx.font = 'bold 22px "MontserratBold", "EmojiFont", sans-serif';
    ctx.fillText('🎵 Top 5 Trek', 60, cardY + 45);
    drawList(stats.topTracks, 60, cardY + 100);

    // --- CARD 2: Server Favorit ---
    fillRoundedRect(40 + cardW + gap, cardY, cardW, cardH, 20, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = isVIP ? '#FFA500' : '#FFD700'; // Gold / Orange
    ctx.font = 'bold 22px "MontserratBold", "EmojiFont", sans-serif';
    ctx.fillText('🏰 Top 5 Server', 40 + cardW + gap + 20, cardY + 45);
    drawList(stats.topServers, 40 + cardW + gap + 20, cardY + 100);

    // --- CARD 3: Relasi / Teman ---
    fillRoundedRect(40 + (cardW + gap) * 2, cardY, cardW, cardH, 20, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = '#ff4757'; // Red/Pink
    ctx.font = 'bold 22px "MontserratBold", "EmojiFont", sans-serif';
    ctx.fillText('🤝 Top 5 Relasi', 40 + (cardW + gap) * 2 + 20, cardY + 45);
    drawList(stats.topFriends, 40 + (cardW + gap) * 2 + 20, cardY + 100);

    // ==========================================
    // 🏁 FOOTER & WATERMARK
    // ==========================================
    try {
        const nauraLogoImg = await loadImage(clientAvatar);
        drawCircularImage(ctx, nauraLogoImg, 930, 615, 20); // Y digeser bawah
    } catch (e) {}

    ctx.fillStyle = UI_COLORS.textSub;
    ctx.font = 'bold 14px "MontserratBold", sans-serif';
    ctx.textAlign = 'right';

    // Footer diperbarui menjadi Naura Music Intelligence
    ctx.fillText('Naura Music Intelligence', 890, 620);

    return canvas.toBuffer('image/png');
}

// ... (Biarkan fungsi generateMusicPanelImage utuh di bawahnya)
async function generateMusicPanelImage(track, currentPos, clientAvatar) {
    const canvas = createCanvas(600, 280);
    const ctx = canvas.getContext('2d');

    // 1. Deteksi platform & warna aksen ambient glow
    const source = (track?.info?.originalSource || track?.info?.sourceName || 'youtube').toLowerCase();
    let accentColor = '#FFB6C1'; // Default Naura Pink
    if (source.includes('spotify')) accentColor = '#1DB954';
    else if (source.includes('youtube') || source.includes('ytm')) accentColor = '#FF0000';
    else if (source.includes('soundcloud')) accentColor = '#FF5500';

    // 2. Latar Belakang - Dark Cyber Canvas (#0B0C10)
    ctx.fillStyle = '#0B0C10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Dynamic Ambient Radial Glow per Platform
    ctx.save();
    const radialGlow = ctx.createRadialGradient(120, 140, 20, 120, 140, 250);
    radialGlow.addColorStop(0, `${accentColor}33`); // 20% opacity
    radialGlow.addColorStop(1, 'rgba(11, 12, 16, 0)');
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // 4. Equalizer Waveform Bars (14 Neon Spectrum Bars di bagian bawah)
    ctx.save();
    const barCount = 14;
    const barWidth = 6;
    const barGap = 5;
    const startX = 230;
    const startY = 245;
    const maxBarHeight = 28;

    for (let b = 0; b < barCount; b++) {
        // Hasilkan tinggi dinamis bergelombang berdasarkan posisi & index
        const pseudoFreq = Math.sin((currentPos / 1000) + b * 0.8) * 0.5 + 0.5;
        const barH = Math.max(6, Math.floor(pseudoFreq * maxBarHeight));

        const bx = startX + b * (barWidth + barGap);
        const by = startY - barH;

        ctx.fillStyle = accentColor;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, barWidth, barH, 3);
        else ctx.rect(bx, by, barWidth, barH);
        ctx.fill();
    }
    ctx.restore();

    // 5. Muat Gambar Cover Art / Thumbnail
    let trackImageUrl = track.info.image;
    if (!trackImageUrl && source.includes('youtube')) {
        trackImageUrl = `https://img.youtube.com/vi/${track.info.identifier}/mqdefault.jpg`;
    }
    if (!trackImageUrl || typeof trackImageUrl !== 'string' || !trackImageUrl.startsWith('http')) {
        trackImageUrl = clientAvatar;
    }

    let trackThumbImg = null;
    try {
        const response = await axios.get(trackImageUrl, { responseType: 'arraybuffer', timeout: 5000 });
        trackThumbImg = await loadImage(Buffer.from(response.data));
    } catch (error) {
        try {
            if (clientAvatar && typeof clientAvatar === 'string' && clientAvatar.startsWith('http')) {
                const response = await axios.get(clientAvatar, { responseType: 'arraybuffer', timeout: 5000 });
                trackThumbImg = await loadImage(Buffer.from(response.data));
            }
        } catch (e2) {}
    }

    // Gambar Cover Art Bulat dengan Neon Border Akses Platform
    if (trackThumbImg) {
        drawCircularImage(ctx, trackThumbImg, 120, 140, 85, accentColor);
    }

    // 6. Tipografi & Teks (Sesuai AGENTS.md Style Guide)
    // --- Header Brand ---
    ctx.fillStyle = accentColor;
    ctx.font = 'bold 15px "MontserratBold", "EmojiFont", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('✦ NAURA AUDIO ENGINE', 20, 32);

    // --- Nama Artis / Channel ---
    ctx.fillStyle = '#F9A8D4'; // Soft Brand Pink
    ctx.font = 'bold 15px "InterBold", "EmojiFont", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(track.info.author.substring(0, 24), 120, 255);

    // --- Judul Lagu (Putih Murni + Soft Shadow) ---
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#FFFFFF'; // Pure White
    ctx.font = 'bold 19px "MontserratBold", "EmojiFont", sans-serif';
    ctx.textAlign = 'left';
    wrapText(ctx, track.info.title, 230, 95, 170, 24, 4);
    ctx.restore();

    // 7. Arc Progress Bar
    drawArcProgressBar(ctx, 480, 140, 68, currentPos, track.info.length, accentColor, 8);

    ctx.fillStyle = '#93C5FD'; // Soft Ice Blue
    ctx.font = 'bold 17px "MontserratBold", "EmojiFont", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NAURA', 480, 145);

    if (track.info.isStream) {
        ctx.fillStyle = '#FF4757'; // Live Red
        ctx.font = 'bold 16px "InterBold", "EmojiFont", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔴 LIVE', 480, 230);
    } else {
        ctx.fillStyle = '#CBD5E1'; // Soft Slate Text
        ctx.font = '13px "Inter", "EmojiFont", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(formatDur(currentPos), 430, 230);
        ctx.fillText(formatDur(track.info.length), 530, 230);
    }

    return canvas.toBuffer('image/png');
}

module.exports = { generateMusicProfileImage, generateMusicPanelImage };
