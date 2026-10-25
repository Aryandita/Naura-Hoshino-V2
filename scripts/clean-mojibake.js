const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'dashboard', 'src', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));

const replacements = [
  // Common mojibake in Indonesian/English UI
  [/ðŸŒ¸/g, '🌸'],
  [/âš”ï¸ /g, '⚔️'],
  [/âš”/g, '⚔️'],
  [/ðŸ’ /g, '💍'],
  [/ðŸ’Ž/g, '💎'],
  [/ðŸ§ª/g, '🧪'],
  [/ðŸª“/g, '🪓'],
  [/ðŸ“¦/g, '📦'],
  [/â­ /g, '⭐'],
  [/ðŸª™/g, '🪙'],
  [/ðŸ‘‘/g, '👑'],
  [/ðŸ ’/g, '🍒'],
  [/ðŸŽ‰/g, '🎉'],
  [/ðŸŽ°/g, '🎰'],
  [/âœ¨/g, '✨'],
  [/ðŸ‘‹/g, '👋'],
  [/ðŸŒ²/g, '🌲'],
  [/âš¡/g, '⚡'],
  [/ðŸ˜Š/g, '😊'],
  [/ðŸ˜„/g, '😄'],
  [/ðŸ¤”/g, '🤔'],
  [/ðŸ˜³/g, '😳'],
  [/ðŸ˜´/g, '😴'],
  [/ðŸ“¢/g, '📢'],
  [/ðŸŽ®/g, '🎮'],
  [/âœ“/g, '✓'],
  [/â”€/g, '─'],
  [/â€¢/g, '•'],
  [/Â·/g, '·'],
  [/Â/g, '']
];

let totalChanges = 0;

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

  // Specific fixes for lounge.html
  if (file === 'lounge.html') {
    content = content.replace(/<option value="maid">[^<]*Faithful Maid Protocol<\/option>/, '<option value="maid">☕ Faithful Maid Protocol</option>');
    content = content.replace(/<option value="tactical">[^<]*Wilds Survival Commander<\/option>/, '<option value="tactical">🌲 Wilds Survival Commander</option>');
  }

  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }

  // Also remove C1 control characters (U+0080 through U+009F) which break parse5
  content = content.replace(/[\u0080-\u009F]/g, '');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Cleaned: ${file}`);
    totalChanges++;
  }
}

console.log(`Done! Cleaned ${totalChanges} files.`);
