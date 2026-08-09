const { createCanvas, loadImage, GlobalFonts } = require('./canvasRuntime');
const path = require('path');



async function generateGachaCard(cardInfo, userAvatarUrl) {
    const canvas = createCanvas(400, 600);
    const ctx = canvas.getContext('2d');

    let grad;
    if (cardInfo.rarity === 'Epic') {
        grad = ctx.createLinearGradient(0, 0, 400, 600);
        grad.addColorStop(0, '#8a2be2');
        grad.addColorStop(1, '#4b0082');
    } else if (cardInfo.rarity === 'Rare') {
        grad = ctx.createLinearGradient(0, 0, 400, 600);
        grad.addColorStop(0, '#00bfff');
        grad.addColorStop(1, '#1e90ff');
    } else {
        grad = ctx.createLinearGradient(0, 0, 400, 600);
        grad.addColorStop(0, '#a9a9a9');
        grad.addColorStop(1, '#696969');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 600);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, 390, 590);

    try {
        const img = await loadImage(userAvatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(50, 100, 300, 300, 20);
        ctx.clip();
        ctx.drawImage(img, 50, 100, 300, 300);
        ctx.restore();
    } catch (e) {}

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 420);
    ctx.lineTo(350, 420);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '35px "MontserratBold", "EmojiFont"';
    ctx.textAlign = 'center';
    ctx.fillText(cardInfo.name, 200, 460);

    ctx.fillStyle = cardInfo.rarity === 'Epic' ? '#ffd700' : cardInfo.rarity === 'Rare' ? '#00ffff' : '#ffffff';
    ctx.font = '25px "MontserratBold", "EmojiFont"';
    ctx.fillText(cardInfo.rarity.toUpperCase(), 200, 510);

    ctx.font = '20px "EmojiFont"';
    ctx.fillStyle = '#ffff00';
    ctx.fillText('⭐'.repeat(cardInfo.stars), 200, 550);

    return canvas.toBuffer('image/png');
}

module.exports = { generateGachaCard };
