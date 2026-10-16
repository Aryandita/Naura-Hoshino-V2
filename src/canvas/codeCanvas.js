"use strict";

const { createCanvas } = require("./canvasRuntime");
const { drawRoundedRect } = require("./CanvasUtils");

/**
 * Palet tema warna untuk kartu kode Carbon
 */
const THEMES = {
  dracula: {
    name: "Dracula",
    bg: "#282A36",
    outerBg: "#191A21",
    outerBorder: "#44475A",
    headerBg: "#21222C",
    headerBorder: "#343746",
    gutterBg: "#21222C",
    gutterBorder: "#383A4A",
    lineNum: "#6272A4",
    text: "#F8F8F2",
    keyword: "#FF79C6",
    string: "#F1FA8C",
    number: "#BD93F9",
    comment: "#6272A4",
    function: "#50FA7B",
    operator: "#8BE9FD",
    pillBg: "rgba(189, 147, 249, 0.15)",
    pillText: "#BD93F9",
  },
  monokai: {
    name: "Monokai",
    bg: "#272822",
    outerBg: "#181915",
    outerBorder: "#3E3D32",
    headerBg: "#1E1F1A",
    headerBorder: "#2E2F27",
    gutterBg: "#1E1F1A",
    gutterBorder: "#34352D",
    lineNum: "#75715E",
    text: "#F8F8F2",
    keyword: "#F92672",
    string: "#E6DB74",
    number: "#AE81FF",
    comment: "#75715E",
    function: "#A6E22E",
    operator: "#FD971F",
    pillBg: "rgba(249, 38, 114, 0.15)",
    pillText: "#F92672",
  },
  "one-dark": {
    name: "One Dark",
    bg: "#282C34",
    outerBg: "#1E2227",
    outerBorder: "#353B45",
    headerBg: "#21252B",
    headerBorder: "#2C313A",
    gutterBg: "#21252B",
    gutterBorder: "#31363F",
    lineNum: "#5C6370",
    text: "#ABB2BF",
    keyword: "#C678DD",
    string: "#98C379",
    number: "#D19A66",
    comment: "#5C6370",
    function: "#61AFEF",
    operator: "#56B6C2",
    pillBg: "rgba(97, 175, 239, 0.15)",
    pillText: "#61AFEF",
  },
  stellar: {
    name: "Stellar Cyberpunk",
    bg: "#0B0F17",
    outerBg: "#05070B",
    outerBorder: "#1E293B",
    headerBg: "#0E1420",
    headerBorder: "#1E293B",
    gutterBg: "#0E1420",
    gutterBorder: "#1E293B",
    lineNum: "#475569",
    text: "#E2E8F0",
    keyword: "#38BDF8",
    string: "#86EFAC",
    number: "#FBBF24",
    comment: "#64748B",
    function: "#F472B6",
    operator: "#A78BFA",
    pillBg: "rgba(56, 189, 248, 0.15)",
    pillText: "#38BDF8",
  },
};

const TRAFFIC_LIGHTS = {
  close: "#FF5F56",
  minimize: "#FFBD2E",
  maximize: "#27C93F",
};

/**
 * Daftar kata kunci berdasarkan bahasa pemrograman
 */
const KEYWORDS_BY_LANG = {
  javascript: new Set([
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "do", "switch", "case", "break", "continue", "default", "import", "from",
    "export", "class", "extends", "async", "await", "try", "catch", "finally",
    "throw", "new", "this", "typeof", "instanceof", "in", "of", "yield",
    "delete", "void", "true", "false", "null", "undefined", "static", "super",
  ]),
  typescript: new Set([
    "const", "let", "var", "function", "return", "if", "else", "for", "while",
    "do", "switch", "case", "break", "continue", "default", "import", "from",
    "export", "class", "extends", "async", "await", "try", "catch", "finally",
    "throw", "new", "this", "typeof", "instanceof", "in", "of", "yield",
    "true", "false", "null", "undefined", "interface", "type", "enum", "as",
    "implements", "readonly", "private", "protected", "public", "namespace",
  ]),
  python: new Set([
    "def", "class", "return", "if", "elif", "else", "for", "while", "import",
    "from", "as", "try", "except", "finally", "raise", "with", "yield",
    "lambda", "None", "True", "False", "is", "not", "in", "and", "or",
    "pass", "break", "continue", "async", "await", "global", "nonlocal", "assert",
  ]),
  rust: new Set([
    "fn", "let", "mut", "pub", "struct", "enum", "impl", "trait", "for",
    "in", "while", "loop", "match", "if", "else", "return", "use", "mod",
    "crate", "self", "Self", "async", "await", "true", "false", "Some",
    "None", "Ok", "Err", "where", "type", "const", "static", "ref", "unsafe",
  ]),
  go: new Set([
    "func", "package", "import", "var", "const", "type", "struct", "interface",
    "return", "if", "else", "for", "range", "switch", "case", "default",
    "go", "chan", "select", "defer", "nil", "true", "false", "map", "break",
    "continue", "fallthrough",
  ]),
  bash: new Set([
    "if", "then", "else", "elif", "fi", "case", "esac", "for", "while", "until",
    "do", "done", "in", "function", "echo", "exit", "return", "export",
    "local", "readonly", "set", "unset", "shift", "source", "alias", "sudo",
  ]),
  json: new Set(["true", "false", "null"]),
  html: new Set([
    "doctype", "html", "head", "body", "div", "span", "p", "a", "script",
    "style", "link", "meta", "button", "input", "form", "h1", "h2", "h3",
    "ul", "li", "header", "footer", "main", "nav", "section",
  ]),
  css: new Set([
    "media", "import", "keyframes", "font-face", "inherit", "initial",
    "unset", "important", "none", "solid", "auto", "block", "flex", "grid",
  ]),
};

/**
 * Tokenizer regex berbasis baris kode
 * @param {string} line
 * @param {string} lang
 * @returns {Array<{text: string, type: string}>}
 */
function tokenizeLine(line, lang = "javascript") {
  const normLang = String(lang || "javascript").toLowerCase();
  const keywords = KEYWORDS_BY_LANG[normLang] || KEYWORDS_BY_LANG.javascript;
  const isHashComment = normLang === "python" || normLang === "bash";

  const tokens = [];
  let index = 0;
  const len = line.length;

  while (index < len) {
    const char = line[index];

    // 1. Whitespace
    if (/\s/.test(char)) {
      let ws = "";
      while (index < len && /\s/.test(line[index])) {
        ws += line[index];
        index++;
      }
      tokens.push({ text: ws, type: "text" });
      continue;
    }

    // 2. Single-line Comments
    if (
      (isHashComment && char === "#") ||
      (!isHashComment && char === "/" && line[index + 1] === "/")
    ) {
      tokens.push({ text: line.slice(index), type: "comment" });
      break;
    }

    // 3. Block comment inline (/* ... */)
    if (!isHashComment && char === "/" && line[index + 1] === "*") {
      const endIdx = line.indexOf("*/", index + 2);
      if (endIdx !== -1) {
        tokens.push({ text: line.slice(index, endIdx + 2), type: "comment" });
        index = endIdx + 2;
        continue;
      }
      tokens.push({ text: line.slice(index), type: "comment" });
      break;
    }

    // 4. HTML Comments (<!-- ... -->)
    if (normLang === "html" && line.startsWith("<!--", index)) {
      const endIdx = line.indexOf("-->", index + 4);
      if (endIdx !== -1) {
        tokens.push({ text: line.slice(index, endIdx + 3), type: "comment" });
        index = endIdx + 3;
        continue;
      }
      tokens.push({ text: line.slice(index), type: "comment" });
      break;
    }

    // 5. Strings (", ', `)
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      let str = quote;
      index++;
      while (index < len) {
        const c = line[index];
        str += c;
        if (c === "\\") {
          index++;
          if (index < len) str += line[index];
        } else if (c === quote) {
          index++;
          break;
        }
        index++;
      }
      tokens.push({ text: str, type: "string" });
      continue;
    }

    // 6. Numbers
    if (
      /\d/.test(char) ||
      (char === "." && /\d/.test(line[index + 1] || ""))
    ) {
      let num = "";
      const hex = char === "0" && (line[index + 1] === "x" || line[index + 1] === "X");
      if (hex) {
        num += line.slice(index, index + 2);
        index += 2;
        while (index < len && /[0-9a-fA-F]/.test(line[index])) {
          num += line[index];
          index++;
        }
      } else {
        while (index < len && /[\d.eE+-]/.test(line[index])) {
          num += line[index];
          index++;
        }
      }
      tokens.push({ text: num, type: "number" });
      continue;
    }

    // 7. Words (Identifiers, Keywords, Functions)
    if (/[a-zA-Z_$]/.test(char)) {
      let word = "";
      while (index < len && /[a-zA-Z0-9_$-]/.test(line[index])) {
        word += line[index];
        index++;
      }

      if (keywords.has(word)) {
        tokens.push({ text: word, type: "keyword" });
      } else {
        // Cek apakah ini pemanggilan fungsi (diikuti tanda kurung)
        let peek = index;
        while (peek < len && /\s/.test(line[peek])) peek++;
        if (peek < len && line[peek] === "(") {
          tokens.push({ text: word, type: "function" });
        } else {
          tokens.push({ text: word, type: "text" });
        }
      }
      continue;
    }

    // 8. Operators & Symbols
    const twoChar = line.slice(index, index + 2);
    const threeChar = line.slice(index, index + 3);
    if (["===", "!==", "...", ">>>", "<<="].includes(threeChar)) {
      tokens.push({ text: threeChar, type: "operator" });
      index += 3;
      continue;
    }
    if (
      [
        "==", "!=", "<=", ">=", "=>", "&&", "||", "++", "--", "+=", "-=",
        "*=", "/=", "->", "::", "??", "?.",
      ].includes(twoChar)
    ) {
      tokens.push({ text: twoChar, type: "operator" });
      index += 2;
      continue;
    }
    if ("=+-*/<>!&|^~?:;,.()[]{}@%#".includes(char)) {
      tokens.push({ text: char, type: "operator" });
      index++;
      continue;
    }

    // Fallback: karakter lain
    tokens.push({ text: char, type: "text" });
    index++;
  }

  return tokens;
}

/**
 * Tokenize multiple lines of code
 * @param {string} code
 * @param {string} lang
 * @returns {Array<Array<{text: string, type: string}>>}
 */
function tokenizeCode(code, lang = "javascript") {
  const rawLines = String(code || "").split(/\r?\n/);
  return rawLines.map((line) => tokenizeLine(line, lang));
}

/**
 * Render kartu kode program bergaya jendela editor macOS
 * @param {Object} payload
 * @param {string} payload.code
 * @param {string} [payload.language='javascript']
 * @param {string} [payload.theme='one-dark']
 * @param {boolean} [payload.showLineNumbers=true]
 * @param {string} [payload.title]
 * @returns {Promise<Buffer>}
 */
async function renderCarbonCard(payload = {}) {
  const {
    code = "// No code provided",
    language = "javascript",
    theme = "one-dark",
    showLineNumbers = true,
    title,
  } = payload;

  const activeTheme = THEMES[theme] || THEMES["one-dark"];
  const normLang = String(language || "javascript").toLowerCase();

  // Bersihkan dan batasi baris kode (maks 100 baris untuk mencegah memory spike)
  let rawLines = String(code).replace(/\t/g, "  ").split(/\r?\n/);
  if (rawLines.length > 100) {
    rawLines = rawLines.slice(0, 100);
    rawLines.push("// ... [baris dipotong untuk menjaga performa]");
  }

  // Hitung dimensi
  const totalLines = rawLines.length;
  const digits = String(totalLines).length;
  const gutterWidth = showLineNumbers ? Math.max(48, digits * 11 + 24) : 0;

  // Ukur baris terpanjang
  const maxLineLength = Math.max(
    ...rawLines.map((l) => l.length),
    25,
  );

  const charWidth = 9.2;
  const paddingX = 30;
  const paddingY = 30;
  const headerHeight = 44;
  const lineHeight = 24;
  const fontSize = 14;

  const cardInnerWidth = Math.max(
    620,
    Math.min(1300, Math.round(maxLineLength * charWidth + gutterWidth + 60)),
  );
  const cardInnerHeight = headerHeight + totalLines * lineHeight + 24;

  const totalWidth = cardInnerWidth + paddingX * 2;
  const totalHeight = cardInnerHeight + paddingY * 2;

  const canvas = createCanvas(totalWidth, totalHeight);
  const ctx = canvas.getContext("2d");

  // 1. Gambar Outer Background Canvas (Gradien subtle dengan vignette)
  const outerGrad = ctx.createLinearGradient(0, 0, totalWidth, totalHeight);
  outerGrad.addColorStop(0, activeTheme.outerBg);
  outerGrad.addColorStop(1, "#020305");
  ctx.fillStyle = outerGrad;
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // 2. Outer Card Drop Shadow & Border Glow
  const cardX = paddingX;
  const cardY = paddingY;
  const cardRadius = 14;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 12;
  drawRoundedRect(
    ctx,
    cardX,
    cardY,
    cardInnerWidth,
    cardInnerHeight,
    cardRadius,
    activeTheme.bg,
  );
  ctx.restore();

  // Border garis luar kartu
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = activeTheme.outerBorder;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(cardX, cardY, cardInnerWidth, cardInnerHeight, cardRadius);
  } else {
    ctx.rect(cardX, cardY, cardInnerWidth, cardInnerHeight);
  }
  ctx.stroke();
  ctx.restore();

  // 3. Header Window macOS Chrome
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(
      cardX,
      cardY,
      cardInnerWidth,
      headerHeight,
      [cardRadius, cardRadius, 0, 0],
    );
  } else {
    ctx.rect(cardX, cardY, cardInnerWidth, headerHeight);
  }
  ctx.fillStyle = activeTheme.headerBg;
  ctx.fill();

  // Garis pemisah header
  ctx.strokeStyle = activeTheme.headerBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX, cardY + headerHeight);
  ctx.lineTo(cardX + cardInnerWidth, cardY + headerHeight);
  ctx.stroke();
  ctx.restore();

  // 4. Traffic Lights (Close, Minimize, Maximize)
  const trafficY = cardY + headerHeight / 2;
  const trafficStart = cardX + 22;
  const trafficGap = 20;
  const trafficRadius = 6;

  const lights = [
    TRAFFIC_LIGHTS.close,
    TRAFFIC_LIGHTS.minimize,
    TRAFFIC_LIGHTS.maximize,
  ];

  lights.forEach((color, i) => {
    ctx.beginPath();
    ctx.arc(trafficStart + i * trafficGap, trafficY, trafficRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });

  // 5. Titlebar Text (File name / Snippet Title)
  const displayTitle = title || `${normLang}_snippet.${getExtension(normLang)}`;
  ctx.font = '13px "Inter", "MontserratBold", sans-serif';
  ctx.fillStyle = activeTheme.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(displayTitle, cardX + cardInnerWidth / 2, trafficY);

  // 6. Pill Badge Bahasa di Kanan Header
  const badgeText = normLang.toUpperCase();
  ctx.font = 'bold 11px "Inter", sans-serif';
  const badgeWidth = ctx.measureText(badgeText).width + 16;
  const badgeHeight = 22;
  const badgeX = cardX + cardInnerWidth - badgeWidth - 18;
  const badgeY = trafficY - badgeHeight / 2;

  drawRoundedRect(
    ctx,
    badgeX,
    badgeY,
    badgeWidth,
    badgeHeight,
    6,
    activeTheme.pillBg,
  );
  ctx.fillStyle = activeTheme.pillText;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, badgeX + badgeWidth / 2, trafficY);

  // 7. Gutter Baris (Jika Diaktifkan)
  const contentTop = cardY + headerHeight;
  const contentHeight = cardInnerHeight - headerHeight;

  if (showLineNumbers) {
    ctx.fillStyle = activeTheme.gutterBg;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(cardX, contentTop, gutterWidth, contentHeight, [0, 0, 0, cardRadius]);
    } else {
      ctx.rect(cardX, contentTop, gutterWidth, contentHeight);
    }
    ctx.fill();

    // Garis border gutter vertikal
    ctx.strokeStyle = activeTheme.gutterBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + gutterWidth, contentTop);
    ctx.lineTo(cardX + gutterWidth, contentTop + contentHeight);
    ctx.stroke();
  }

  // 8. Render Kode & Nomor Baris
  const codeStartX = cardX + gutterWidth + 18;
  const codeStartY = contentTop + 18;

  ctx.textBaseline = "top";

  for (let i = 0; i < totalLines; i++) {
    const lineY = codeStartY + i * lineHeight;

    // Nomor Baris
    if (showLineNumbers) {
      ctx.font = '12px Consolas, "Courier New", "Inter", monospace';
      ctx.fillStyle = activeTheme.lineNum;
      ctx.textAlign = "right";
      ctx.fillText(String(i + 1), cardX + gutterWidth - 12, lineY + 2);
    }

    // Tokenized Code
    const tokens = tokenizeLine(rawLines[i], normLang);
    let currentX = codeStartX;
    ctx.textAlign = "left";
    ctx.font = `${fontSize}px Consolas, "Courier New", "Inter", monospace`;

    for (const token of tokens) {
      let color = activeTheme.text;
      switch (token.type) {
        case "keyword":
          color = activeTheme.keyword;
          break;
        case "string":
          color = activeTheme.string;
          break;
        case "number":
          color = activeTheme.number;
          break;
        case "comment":
          color = activeTheme.comment;
          break;
        case "function":
          color = activeTheme.function;
          break;
        case "operator":
          color = activeTheme.operator;
          break;
        default:
          color = activeTheme.text;
          break;
      }

      ctx.fillStyle = color;
      ctx.fillText(token.text, currentX, lineY);
      currentX += ctx.measureText(token.text).width;
    }
  }

  return canvas.toBuffer("image/png");
}

function getExtension(lang) {
  const map = {
    javascript: "js",
    typescript: "ts",
    python: "py",
    rust: "rs",
    go: "go",
    html: "html",
    css: "css",
    json: "json",
    bash: "sh",
  };
  return map[lang] || "txt";
}

module.exports = {
  renderCarbonCard,
  renderCodeCard: renderCarbonCard,
  tokenizeLine,
  tokenizeCode,
  THEMES,
};
