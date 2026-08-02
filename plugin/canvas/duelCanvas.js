// Lokasi: plugin/canvas/duelCanvas.js
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

/**
 * Menggambar canvas untuk tampilan PvP Duel Battle Arena.
 * @param {Object} p1 - Data pemain 1 (challenger)
 * @param {Object} p2 - Data pemain 2 (opponent)
 * @param {string} roundLog - Teks log aksi yang terjadi di ronde ini
 * @returns {Buffer} Buffer gambar PNG
 */
async function drawDuel(p1, p2, roundLog) {
    const canvas = createCanvas(900, 500);
    const ctx = canvas.getContext('2d');

    const ui = require('../../src/config/ui');

    // 1. Background
    const bgPath = ui.getDungeonBackground ? ui.getDungeonBackground() : null;
    let bgLoaded = false;
    try {
        if (bgPath && fs.existsSync(bgPath)) {
            const bgImage = await loadImage(bgPath);
            ctx.drawImage(bgImage, 0, 0, 900, 500);
            bgLoaded = true;
        }
    } catch (err) {
        console.error('\x1b[41m\x1b[37m \u{1F4A5} DuelCanvas \x1b[0m \x1b[31mGagal memuat background:', err.message, '\x1b[0m');
    }

    if (!bgLoaded) {
        // Fallback Gradient (dark arena)
        const grad = ctx.createLinearGradient(0, 0, 0, 500);
        grad.addColorStop(0, '#0a0a1a');
        grad.addColorStop(0.5, '#1a0a2e');
        grad.addColorStop(1, '#0d0d1f');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 900, 500);
    }

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, 900, 500);

    // ==========================================
    // 2. PLAYER 1 (Kiri)
    // ==========================================
    await drawPlayerPanel(ctx, p1, 30, 30, 370, 260, 'rgba(255, 182, 193, 0.6)', 'rgba(255, 182, 193, 0.3)');

    // ==========================================
    // 3. PLAYER 2 (Kanan)
    // ==========================================
    await drawPlayerPanel(ctx, p2, 500, 30, 370, 260, 'rgba(147, 130, 255, 0.6)', 'rgba(147, 130, 255, 0.3)');

    // ==========================================
    // 4. VS Badge (Tengah)
    // ==========================================
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', 450, 170);
    ctx.shadowBlur = 0;

    // ==========================================
    // 5. Action Log Box (Bawah)
    // ==========================================
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(30, 320, 840, 150, 15);
    ctx.fill();
    ctx.stroke();

    // Header log
    ctx.fillStyle = '#ffb6c1';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('\u2694\uFE0F Battle Log', 50, 345);

    // Log text
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    const lines = (roundLog || '').split('\n');
    let yPos = 370;
    for (const line of lines.slice(0, 4)) {
        ctx.fillText(line.substring(0, 90), 50, yPos);
        yPos += 24;
    }

    return canvas.toBuffer('image/png');
}

/**
 * Menggambar panel info pemain (avatar, nama, kelas, HP bar, stamina bar)
 */
async function drawPlayerPanel(ctx, player, x, y, w, h, glowColor, strokeColor) {
    // Container frame (glassmorphism)
    ctx.shadowBlur = 15;
    ctx.shadowColor = glowColor;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 20);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Avatar
    let avatar = null;
    try {
        if (player.avatarUrl) {
            avatar = await loadImage(player.avatarUrl);
        }
    } catch (e) {
        // Fallback jika avatar gagal dimuat
    }

    const avatarX = x + 50;
    const avatarY = y + 45;
    const avatarR = 40;

    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
        ctx.restore();

        // Avatar border ring
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarR + 2, 0, Math.PI * 2);
        ctx.stroke();
    } else {
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
        ctx.fill();
    }

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText((player.username || 'Unknown').substring(0, 15), x + 100, avatarY - 8);

    // Class label
    ctx.fillStyle = '#ffb6c1';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Class: ${(player.class || 'No Class').toUpperCase()}`, x + 100, avatarY + 14);

    // HP Bar
    const barX = x + 20;
    const barW = w - 40;
    const hpBarY = y + 120;

    ctx.fillStyle = '#444444';
    ctx.beginPath();
    ctx.roundRect(barX, hpBarY, barW, 22, 11);
    ctx.fill();

    const hpPercent = Math.max(0, Math.min(1, player.hp / player.maxHp));
    ctx.fillStyle = hpPercent > 0.5 ? '#2ecc71' : hpPercent > 0.2 ? '#f1c40f' : '#e74c3c';
    ctx.beginPath();
    ctx.roundRect(barX, hpBarY, barW * hpPercent, 22, 11);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, barX + barW / 2, hpBarY + 16);

    // Stamina Bar
    const staminaBarY = hpBarY + 35;

    ctx.fillStyle = '#444444';
    ctx.beginPath();
    ctx.roundRect(barX, staminaBarY, barW, 18, 9);
    ctx.fill();

    const staminaPercent = Math.max(0, Math.min(1, (player.stamina || 0) / 100));
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.roundRect(barX, staminaBarY, barW * staminaPercent, 18, 9);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`STAMINA: ${player.stamina || 0}/100`, barX + barW / 2, staminaBarY + 13);

    // Stats summary (bottom of panel)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    const statsY = staminaBarY + 40;
    ctx.fillText(`STR: ${player.strength || 0}  |  AGI: ${player.agility || 0}  |  INT: ${player.intelligence || 0}  |  LCK: ${player.luck || 0}`, barX, statsY);
}

module.exports = { drawDuel };
