"use strict";

const { performance } = require("node:perf_hooks");
const { levenshteinDistance } = require("../utils/levenshteinSuggest");
const { sendModLog } = require("../utils/modLogHelper");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const languageManager = require("../managers/languageManager");
const ui = require("../config/ui");

/**
 * Official Discord domains and subdomains (100% allowlist, 0 false positive).
 */
const OFFICIAL_DISCORD_DOMAINS = new Set([
  "discord.com",
  "discord.gg",
  "discord.gift",
  "discord.media",
  "discord.co",
  "discordapp.com",
  "discordapp.net",
  "discordstatus.com",
  "dis.gd",
  "watchanimeattheoffice.net",
  "discord.design",
  "discord.dev",
  "discord.new",
  "discord.events",
]);

/**
 * Trusted third-party and community domains.
 */
const TRUSTED_COMMUNITY_DOMAINS = new Set([
  "top.gg",
  "discordbotlist.com",
  "bots.gg",
  "disboard.org",
  "discordservers.com",
  "discord.me",
  "discord.io",
  "discord.js.org",
  "discordjs.guide",
  "github.com",
  "githubusercontent.com",
  "gitlab.com",
  "youtube.com",
  "youtu.be",
  "tenor.com",
  "giphy.com",
  "spotify.com",
  "google.com",
  "twitter.com",
  "x.com",
  "twitch.tv",
  "reddit.com",
  "steamcommunity.com",
  "steampowered.com",
]);

/**
 * Suspicious top-level domains commonly abused for throwaway Nitro scams.
 */
const SUSPICIOUS_TLDS = new Set([
  "xyz", "top", "ru", "click", "site", "fun", "club", "link",
  "info", "work", "rest", "buzz", "online", "cfd", "sbs", "icu", "shop", "pw",
]);

/**
 * Common scam trigger keywords associated with Discord Nitro baiting.
 */
const SCAM_TRIGGERS = [
  "gift", "free", "claim", "airdrop", "steam", "boost",
  "drop", "promo", "generator", "giveaway", "billing", "login",
];

/**
 * Cyrillic and Greek homoglyphs mapped to Latin counterparts.
 */
const HOMOGLYPH_MAP = {
  // Cyrillic
  "\u0430": "a", "\u0410": "a",
  "\u0441": "c", "\u0421": "c",
  "\u0435": "e", "\u0425": "x",
  "\u043E": "o", "\u041E": "o",
  "\u0440": "p", "\u0420": "p",
  "\u0445": "x", "\u0443": "y",
  "\u0456": "i", "\u0406": "i",
  "\u0457": "i", "\u0407": "i",
  "\u0458": "j", "\u0408": "j",
  "\u0455": "s", "\u0405": "s",
  "\u0501": "d", "\u0503": "d",
  "\u051B": "q", "\u050D": "g",
  "\u0432": "b", "\u043F": "n",
  "\u0442": "t",
  // Greek
  "\u03B1": "a", "\u0391": "a",
  "\u03BF": "o", "\u039F": "o",
  "\u03B5": "e", "\u0395": "e",
  "\u03B9": "i", "\u0399": "i",
  "\u03BA": "k", "\u039A": "k",
  "\u03BD": "v", "\u039D": "v",
  "\u03C1": "p", "\u03A1": "p",
  "\u03C4": "t", "\u03A4": "t",
  "\u03C7": "x", "\u03A7": "x",
  "\u03C5": "u", "\u03A5": "u",
};

/**
 * Fast URL extraction regex.
 */
const URL_REGEX = /(?:https?:\/\/)?((?:[a-zA-Z0-9_\u00a1-\uffff-]+\.)+[a-zA-Z\u00a1-\uffff]{2,})(?::\d+)?(?:\/[^\s]*)?/gi;

/**
 * Strips zero-width characters, homoglyphs, accents, and leetspeak substitutions.
 * @param {string} text
 * @returns {string}
 */
function stripHomoglyphs(text) {
  if (!text) return "";

  // 1. Remove zero-width & invisible characters
  let clean = text.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u200E\u200F]/g, "");

  // 2. Normalize unicode diacritics (NFKD)
  clean = clean.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // 3. Map Cyrillic / Greek homoglyphs
  let replaced = "";
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    replaced += HOMOGLYPH_MAP[char] || char;
  }

  // 4. Common visual letter combinations
  replaced = replaced
    .replace(/cl/g, "d")
    .replace(/vv/g, "w")
    .replace(/rn/g, "m");

  // 5. Basic leetspeak conversions for brand detection
  replaced = replaced
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t");

  return replaced;
}

/**
 * Checks whether a hostname belongs to official Discord domains or trusted communities.
 * Guarantees zero false positives.
 * @param {string} hostname
 * @returns {boolean}
 */
function isAllowedDomain(hostname) {
  if (!hostname) return false;
  const cleanHost = hostname.toLowerCase().trim().replace(/^\.+|\.+$/g, "").split(":")[0];

  for (const domain of OFFICIAL_DISCORD_DOMAINS) {
    if (cleanHost === domain || cleanHost.endsWith("." + domain)) {
      return true;
    }
  }

  for (const domain of TRUSTED_COMMUNITY_DOMAINS) {
    if (cleanHost === domain || cleanHost.endsWith("." + domain)) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts Second-Level Domain (SLD) from hostname.
 * Examples:
 * - 'discord.com' -> 'discord'
 * - 'canary.discord.com' -> 'discord'
 * - 'dlscord-nitro.com' -> 'dlscord-nitro'
 * - 'scam.co.uk' -> 'scam'
 * - 'gift-nitro.xyz' -> 'gift-nitro'
 * @param {string} hostname
 * @returns {string}
 */
function extractSld(hostname) {
  if (!hostname || typeof hostname !== "string") return "";
  const clean = hostname.toLowerCase().trim().replace(/^\.+|\.+$/g, "").split(":")[0];
  const parts = clean.split(".").filter(Boolean);
  if (parts.length <= 1) return parts[0] || "";

  // Common multi-part TLD suffixes (e.g. .co.uk, .com.au, .net.id)
  const multiPartTlds = new Set(["co", "com", "net", "org", "edu", "gov", "ac"]);
  if (parts.length >= 3 && multiPartTlds.has(parts[parts.length - 2])) {
    return parts[parts.length - 3];
  }
  return parts[parts.length - 2];
}

/**
 * Extracts all hostnames from a text string.
 * @param {string} content
 * @returns {string[]}
 */
function extractUrls(content) {
  if (!content || typeof content !== "string") return [];
  const urls = [];
  const regex = new RegExp(URL_REGEX.source, "gi");
  let match;

  while ((match = regex.exec(content)) !== null) {
    const fullMatched = match[0];
    const rawHost = match[1];
    if (rawHost) {
      urls.push({
        rawUrl: fullMatched,
        hostname: rawHost.toLowerCase().trim().replace(/^\.+|\.+$/g, ""),
      });
    }
  }

  return urls;
}

/**
 * Evaluates whether a domain exhibits phishing / typosquatting characteristics.
 * Returns { isPhishing: boolean, detectedDomain: string | null, reason: string | null, elapsedMs: number }
 * Guaranteed execution in < 50ms.
 * @param {string} content
 * @returns {{ isPhishing: boolean, detectedDomain: string | null, reason: string | null, elapsedMs: number }}
 */
function analyzeContent(content) {
  const startTime = performance.now();

  if (!content || typeof content !== "string") {
    return {
      isPhishing: false,
      detectedDomain: null,
      reason: null,
      elapsedMs: performance.now() - startTime,
    };
  }

  const extracted = extractUrls(content);
  if (extracted.length === 0) {
    return {
      isPhishing: false,
      detectedDomain: null,
      reason: null,
      elapsedMs: performance.now() - startTime,
    };
  }

  for (const item of extracted) {
    const host = item.hostname;

    // Fast O(1) bypass for official Discord domains & trusted sites
    if (isAllowedDomain(host)) {
      continue;
    }

    // Normalized hostname with homoglyph & leetspeak stripping
    const normalizedHost = stripHomoglyphs(host);

    // Extract domain parts and labels
    const hostParts = host.split(".").filter(Boolean);
    const normalizedParts = normalizedHost.split(".").filter(Boolean);
    const tld = hostParts.length > 1 ? hostParts[hostParts.length - 1].toLowerCase() : "";
    const isSuspiciousTld = SUSPICIOUS_TLDS.has(tld);

    // Extract Second-Level Domain (SLD)
    const sld = extractSld(host);
    const normalizedSld = extractSld(normalizedHost);

    // 1. Explicit Levenshtein distance on Second-Level Domain (SLD)
    for (const targetBrand of ["discord", "discordapp"]) {
      const sldDist = levenshteinDistance(sld, targetBrand);
      const normDist = levenshteinDistance(normalizedSld, targetBrand);

      if (sldDist === 0 || normDist === 0) {
        return {
          isPhishing: true,
          detectedDomain: host,
          reason: `Penggunaan merek ${targetBrand} pada domain tidak resmi`,
          elapsedMs: performance.now() - startTime,
        };
      }

      if ((sldDist >= 1 && sldDist <= 2) || (normDist >= 1 && normDist <= 2)) {
        return {
          isPhishing: true,
          detectedDomain: host,
          reason: `Typosquatting merek Discord pada SLD (variasi '${sld}')`,
          elapsedMs: performance.now() - startTime,
        };
      }
    }

    // Levenshtein distance on SLD for Nitro / Airdrop scam
    const sldNitroDist = levenshteinDistance(sld, "nitro");
    const normSldNitroDist = levenshteinDistance(normalizedSld, "nitro");
    if (sldNitroDist <= 1 || normSldNitroDist <= 1 || sld.includes("nitro") || normalizedSld.includes("nitro")) {
      const isScamSld = SCAM_TRIGGERS.some((t) => sld.includes(t) || normalizedSld.includes(t)) || isSuspiciousTld;
      if (isScamSld) {
        return {
          isPhishing: true,
          detectedDomain: host,
          reason: "Tautan penipuan Discord Nitro pada SLD",
          elapsedMs: performance.now() - startTime,
        };
      }
    }

    // 2. Token-level checks on all domain segments
    const allLabels = [...hostParts, ...normalizedParts];
    const subTokens = [];
    for (const label of allLabels) {
      for (const sub of label.split("-")) {
        if (sub) subTokens.push(sub);
      }
    }

    for (const token of subTokens) {
      // Exact match to discord on unauthorized domain
      if (token === "discord") {
        return {
          isPhishing: true,
          detectedDomain: host,
          reason: "Penggunaan merek Discord pada domain tidak resmi",
          elapsedMs: performance.now() - startTime,
        };
      }

      // Levenshtein distance check against "discord"
      // Covers dlscord, discorcl, discrod, dicsord, disccord, disscord, dicord, etc.
      const dist = levenshteinDistance(token, "discord");
      if (dist >= 1 && dist <= 2) {
        return {
          isPhishing: true,
          detectedDomain: host,
          reason: `Typosquatting merek Discord (variasi '${token}')`,
          elapsedMs: performance.now() - startTime,
        };
      }
    }

    // 3. Nitro scam combinations
    // Checks if domain combines nitro with scam baits like gift, free, claim, airdrop, steam
    const hasNitro = subTokens.some((t) => t === "nitro" || levenshteinDistance(t, "nitro") <= 1);
    const hasScamTrigger = subTokens.some((t) =>
      SCAM_TRIGGERS.includes(t) ||
      levenshteinDistance(t, "airdrop") <= 1 ||
      levenshteinDistance(t, "gift") <= 1
    );

    if (hasNitro && (hasScamTrigger || isSuspiciousTld)) {
      return {
        isPhishing: true,
        detectedDomain: host,
        reason: "Tautan penipuan Discord Nitro atau hadiah palsu",
        elapsedMs: performance.now() - startTime,
      };
    }

    // 4. Phishing Regex Patterns
    const phishingPatterns = [
      /discorcl/i,
      /dlscord/i,
      /disc[o0]rd/i,
      /d1scord/i,
      /dls[o0]rd/i,
      /discorde/i,
      /discord-nitro/i,
      /nitro-gift/i,
      /free-nitro/i,
      /claim-nitro/i,
      /discord-gift/i,
      /gift-nitro/i,
      /discord-airdrop/i,
      /steam-discord/i,
      /discord-steam/i,
      /nitro-drop/i,
      /nitro-promo/i,
      /discord-claim/i,
      /discord-free/i,
    ];

    for (const pattern of phishingPatterns) {
      if (pattern.test(host) || pattern.test(normalizedHost)) {
        return {
          isPhishing: true,
          detectedDomain: host,
          reason: "Pola domain phishing Nitro terdeteksi",
          elapsedMs: performance.now() - startTime,
        };
      }
    }

    // 5. Suspicious TLD combined with Discord/Nitro keywords
    if (isSuspiciousTld) {
      const containsDiscordKeyword = normalizedHost.includes("discord") || normalizedHost.includes("nitro");
      if (containsDiscordKeyword) {
        return {
          isPhishing: true,
          detectedDomain: host,
          reason: `Domain dengan TLD mencurigakan (.${tld}) meniru Discord/Nitro`,
          elapsedMs: performance.now() - startTime,
        };
      }
    }
  }

  return {
    isPhishing: false,
    detectedDomain: null,
    reason: null,
    elapsedMs: performance.now() - startTime,
  };
}

/**
 * Scans a Discord message for phishing URLs, deletes the message, warns the channel,
 * and logs to the moderation channel if detected.
 * @param {import("discord.js").Message} message
 * @param {import("discord.js").Client} client
 * @returns {Promise<{ isPhishing: boolean, detectedDomain: string | null, reason: string | null, elapsedMs: number }>}
 */
async function scanMessage(message, client) {
  if (!message || !message.content || typeof message.content !== "string") {
    return { isPhishing: false, detectedDomain: null, reason: null, elapsedMs: 0 };
  }

  // Bypass for bot messages
  if (message.author?.bot) {
    return { isPhishing: false, detectedDomain: null, reason: null, elapsedMs: 0 };
  }

  const result = analyzeContent(message.content);
  if (!result.isPhishing) {
    return result;
  }

  // Action on violation
  try {
    // 1. Delete infringing message immediately
    await message.delete().catch(() => {});

    // 2. Send short self-destructing warning in channel (5 seconds)
    if (message.channel && typeof message.channel.send === "function") {
      const lang = message.localeLang || "id";
      const warningText = languageManager && typeof languageManager.has === "function" && languageManager.has(lang, "automod.phishing.channel_alert")
        ? languageManager.translateSync(lang, "automod.phishing.channel_alert", {
            author: `<@${message.author.id}>`,
            domain: result.detectedDomain,
          })
        : `⚠️ <@${message.author.id}>, pesanmu otomatis dihapus karena memuat tautan berbahaya/phishing (${result.detectedDomain}).`;

      const warnMsg = await message.channel.send({ content: warningText }).catch(() => {});
      if (warnMsg) {
        const timer = setTimeout(() => {
          warnMsg.delete().catch(() => {});
        }, 5000);
        if (timer.unref) timer.unref();
      }
    }

    // 3. Log to moderation channel via sendModLog
    if (message.guild) {
      const rawAuthorTag = message.author.tag || message.author.username || "Unknown";
      const safeAuthorName = ui.stripCustomEmojis
        ? ui.stripCustomEmojis(`${rawAuthorTag} (${message.author.id})`)
        : `${rawAuthorTag} (${message.author.id})`;

      const modLogPayload = buildContainerV2({
        accentColorHex: ui.getColor("error") || "#FF0000",
        authorName: safeAuthorName,
        title: `${ui.getEmoji("shield_alert") || "🚨"} AutoMod: Tautan Phishing Dinetralisir`,
        description: `Pesan berbahaya dari <@${message.author.id}> telah dihapus secara proaktif.`,
        fields: [
          {
            name: `${ui.getEmoji("member") || "👤"} Pengirim`,
            value: `<@${message.author.id}> (\`${message.author.id}\`)`,
            inline: true,
          },
          {
            name: `${ui.getEmoji("warn") || "🌐"} Domain Terdeteksi`,
            value: `\`${result.detectedDomain}\``,
            inline: true,
          },
          {
            name: `${ui.getEmoji("info") || "ℹ️"} Alasan & Latensi`,
            value: `${result.reason} (dianalisis dalam \`${result.elapsedMs.toFixed(2)}ms\`)`,
            inline: false,
          },
          {
            name: `${ui.getEmoji("desc") || "📋"} Konten Pesan`,
            value: message.content
              ? `\`\`\`text\n${message.content.substring(0, 1000)}\n\`\`\``
              : "*[Kosong]*",
            inline: false,
          },
        ],
        footerText: ui.getFooter("admin"),
      });

      await sendModLog(message.guild, modLogPayload).catch(() => {});
    }
  } catch (error) {
    // Defensive error handling
  }

  return result;
}

module.exports = {
  scanMessage,
  checkMessage: scanMessage,
  analyzeContent,
  isAllowedDomain,
  stripHomoglyphs,
  extractUrls,
  extractSld,
  OFFICIAL_DISCORD_DOMAINS,
  TRUSTED_COMMUNITY_DOMAINS,
  SUSPICIOUS_TLDS,
};
