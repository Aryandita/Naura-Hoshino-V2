const fs = require('fs');
const path = require('path');
const pagesDir = path.join(process.cwd(), 'mobile', 'src', 'pages');
const jsDir = path.join(process.cwd(), 'mobile', 'src', 'js', 'pages');

const OLD_FONT = '<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />';
const NEW_FONT = '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Orbitron:wght@700;900&family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />';

// Update HTML fonts & add reveal class to main sections
fs.readdirSync(pagesDir).filter(f => f.endsWith('.html')).forEach(file => {
  if (file === 'index.html') return; // already done
  let content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
  
  // Font replacement
  content = content.replace(OLD_FONT, NEW_FONT);

  // Simple reveal class injection to top level sections in main
  content = content.replace(/<section([^>]*)>/g, (match, p1) => {
    if (!p1.includes('class=')) return `<section${p1} class="reveal">`;
    if (!p1.includes('reveal')) return `<section${p1.replace('class="', 'class="reveal ')}>`;
    return match;
  });

  fs.writeFileSync(path.join(pagesDir, file), content);
});

// Update JS files to initReveal
fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).forEach(file => {
  if (file === 'home.js') return; // already done
  let content = fs.readFileSync(path.join(jsDir, file), 'utf8');
  
  if (!content.includes('initReveal')) {
    content = content.replace('// ── Init', 'import { initReveal } from "../core/reveal.js";\n\n// ── Init');
    content = content.replace('initBottomNav();', 'initBottomNav();\n  initReveal();');
    fs.writeFileSync(path.join(jsDir, file), content);
  }
});
console.log('Update HTML and JS complete');
