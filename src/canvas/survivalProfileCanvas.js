"use strict";

const { createCanvas, loadImage, logger, drawRoundedRect, drawRoundedProgressBar } = require("./helpers/canvasPrimitives");
const leveling = require("../survival/engines/survivalLeveling");
const { BOT_VERSION } = require("../config/version");


// ==========================================
// ðŸŽ® SURVIVAL RPG PROFILE CANVAS  -  V3
// Canvas: 1000 x 640px  -  Extended Layout
// ==========================================
async function generateSurvivalProfileImage(
  user,
  profile,
  survival,
  ui,
  extras = {},
) {
  const W = 1000;
  const H = 640;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const {
    activePets = [],
    marriedNPCs = [],
    botAvatar = null,
    gear = null,
    isRegistered = false,
  } = extras;

  const currentLevel = parseInt(survival.survival_level, 10) || 1;
  const currentXP = parseInt(survival.survival_xp, 10) || 0;
  const reqXP = leveling.getExpRequirement(currentLevel);
  const maxStatCap = leveling.getMaxStatCap(currentLevel);
  const maxHP = 100 + Math.min(survival.strength || 1, maxStatCap) * 10;
  const rpgState = survival.rpg_state || {};

  // ──────────────────────────────────────────
  // 1. BACKGROUND (location-aware)
  // ──────────────────────────────────────────
  const fs = require("fs");
  const bgPath = ui.getSurvivalBackground(
    survival.currentLocation || "village",
    survival.inGameHour || 6,
  );
  const MARGIN = 16;
  const RADIUS = 18;

  // Base card fill
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, W, H, RADIUS);
  else ctx.rect(0, 0, W, H);
  ctx.fillStyle = "#17191e";
  ctx.fill();
  ctx.restore();

  // Dynamic bg image
  if (fs.existsSync(bgPath)) {
    try {
      const bgImg = await loadImage(bgPath);
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect)
        ctx.roundRect(
          MARGIN,
          MARGIN,
          W - MARGIN * 2,
          H - MARGIN * 2,
          RADIUS - 4,
        );
      else ctx.rect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);
      ctx.clip();
      ctx.drawImage(bgImg, MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);
      ctx.fillStyle = "rgba(10, 11, 16, 0.80)";
      ctx.fillRect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);
      ctx.restore();
    } catch (_) {
      drawRoundedRect(
        ctx,
        MARGIN,
        MARGIN,
        W - MARGIN * 2,
        H - MARGIN * 2,
        RADIUS - 4,
        "#1e2028",
      );
    }
  } else {
    drawRoundedRect(
      ctx,
      MARGIN,
      MARGIN,
      W - MARGIN * 2,
      H - MARGIN * 2,
      RADIUS - 4,
      "#1e2028",
    );
  }

  // Outer border glow
  ctx.save();
  ctx.strokeStyle = "rgba(255,182,193,0.25)";
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 12;
  ctx.shadowColor = "rgba(255,182,193,0.35)";
  ctx.beginPath();
  if (ctx.roundRect)
    ctx.roundRect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2, RADIUS - 4);
  else ctx.rect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);
  ctx.stroke();
  ctx.restore();

  // ──────────────────────────────────────────
  // 2. AVATAR (circular, top-left)
  // ──────────────────────────────────────────
  const AVA_R = 50;
  const AVA_CX = MARGIN + 22 + AVA_R;
  const AVA_CY = MARGIN + 22 + AVA_R;
  const avatarUrl = user.displayAvatarURL({ extension: "png", size: 256 });
  try {
    const avaImg = await loadImage(avatarUrl);
    // Glow ring
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(255,182,193,0.65)";
    ctx.beginPath();
    ctx.arc(AVA_CX, AVA_CY, AVA_R + 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,182,193,0.7)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
    // Clip & draw
    ctx.save();
    ctx.beginPath();
    ctx.arc(AVA_CX, AVA_CY, AVA_R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avaImg, AVA_CX - AVA_R, AVA_CY - AVA_R, AVA_R * 2, AVA_R * 2);
    ctx.restore();
  } catch (err) {
    logger.warn("[CanvasUtils:generateSurvivalProfileImage] Render visual canvas atau pemuatan aset gagal: " + (err?.message || err));
  }

  // ──────────────────────────────────────────
  // 3. IDENTITY (name, level, XP)
  // ──────────────────────────────────────────
  const INFO_X = AVA_CX + AVA_R + 18;
  const rebirthCount = rpgState.rebirth_count || 0;
  const diffText = rpgState.difficulty || "Normal";

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 26px "MontserratBold", sans-serif';
  ctx.fillText(user.displayName.toUpperCase(), INFO_X, AVA_CY - 18);

  ctx.fillStyle = "#FFD700";
  ctx.font = '14px "Inter", sans-serif';
  const subtitleParts = [`Lv.${currentLevel}  Survivor`, `Mode ${diffText}`];
  if (rebirthCount > 0) subtitleParts.push(`Rebirth x${rebirthCount}`);
  ctx.fillText(subtitleParts.join("  |  "), INFO_X, AVA_CY + 5);

  const XP_W = 240;
  ctx.fillStyle = "#8e98b0";
  ctx.font = '11px "Inter", sans-serif';
  ctx.fillText(
    `XP: ${currentXP.toLocaleString("id-ID")} / ${reqXP.toLocaleString("id-ID")}`,
    INFO_X,
    AVA_CY + 23,
  );
  drawRoundedProgressBar(
    ctx,
    INFO_X,
    AVA_CY + 29,
    XP_W,
    10,
    5,
    (currentXP / reqXP) * 100,
    ["#00D9FF", "#0055FF"],
  );

  // ──────────────────────────────────────────
  // 4. WALLET (top-right)
  // ──────────────────────────────────────────
  const WALLET_X = W - MARGIN - 18;
  const WALLET_Y0 = MARGIN + 18;
  const walletItems = [
    {
      label: "PRATAMA DOLLAR",
      value: (profile.economy_wallet || 0).toLocaleString("id-ID"),
      color: "#FFD700",
    },
    {
      label: "SUKAMAJU KOIN",
      value: (survival.starFragments || 0).toLocaleString("id-ID"),
      color: "#00D9FF",
    },
    {
      label: "VOUCHER BEASISWA",
      value: (survival.scholarshipVouchers || 0).toLocaleString("id-ID"),
      color: "#FFB6C1",
    },
  ];
  walletItems.forEach((item, i) => {
    const yBase = WALLET_Y0 + i * 42;
    ctx.textAlign = "right";
    ctx.fillStyle = "#8e98b0";
    ctx.font = '10px "InterBold", sans-serif';
    ctx.fillText(item.label, WALLET_X, yBase);
    ctx.fillStyle = item.color;
    ctx.font = '19px "MontserratBold", sans-serif';
    ctx.fillText(item.value, WALLET_X, yBase + 20);
  });

  // ──────────────────────────────────────────
  // 5. DIVIDER 1
  // ──────────────────────────────────────────
  const DIV_Y1 = AVA_CY + AVA_R + 20;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(MARGIN + 10, DIV_Y1, W - (MARGIN + 10) * 2, 1);

  // ──────────────────────────────────────────
  // 6. THREE-COLUMN BODY
  // ──────────────────────────────────────────
  const GAP = 14;
  const COL_W = Math.floor((W - MARGIN * 2 - GAP * 2) / 3);
  const COL_TOP = DIV_Y1 + 18;
  const COL_H = 248;
  const C1_X = MARGIN + 2;
  const C2_X = C1_X + COL_W + GAP;
  const C3_X = C2_X + COL_W + GAP;

  // Helper: glassmorphism card
  const glassCard = (x, y, w, h, accentColor = "rgba(255,255,255,0.03)") => {
    ctx.save();
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 12);
    else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  glassCard(C1_X, COL_TOP, COL_W, COL_H, "rgba(255,80,80,0.04)");
  glassCard(C2_X, COL_TOP, COL_W, COL_H, "rgba(147,88,235,0.04)");
  glassCard(C3_X, COL_TOP, COL_W - 4, COL_H, "rgba(255,182,193,0.04)");

  // Helper: section heading with underline accent
  const sectionHead = (text, x, y, accentColor, lineWidth = 70) => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 14px "InterBold", sans-serif';
    ctx.fillText(text, x + 14, y + 20);
    ctx.fillStyle = accentColor;
    ctx.fillRect(x + 14, y + 24, lineWidth, 2);
  };

  // ── COL 1: STATUS FISIK ──
  sectionHead("STATUS FISIK", C1_X, COL_TOP, "#FF6B6B", 72);

  const curHp =
    survival.hp !== undefined && survival.hp !== null
      ? Math.max(0, Number(survival.hp))
      : maxHP;
  const curHunger = Math.max(0, Number(survival.hunger || 0));
  const curThirst = Math.max(0, Number(survival.thirst || 0));
  const curStamina = Math.max(0, Number(survival.stamina || 0));

  const bars = [
    {
      label: `HP  ${curHp}/${maxHP}`,
      pct: Math.min(100, (curHp / maxHP) * 100),
      colors: ["#FF3333", "#FF7070"],
    },
    {
      label: `Lapar  ${curHunger}/100`,
      pct: Math.min(100, curHunger),
      colors: ["#FF8C00", "#FFBB44"],
    },
    {
      label: `Haus  ${curThirst}/100`,
      pct: Math.min(100, curThirst),
      colors: ["#00BFFF", "#87CEFA"],
    },
    {
      label: `Stamina  ${curStamina}/100`,
      pct: Math.min(100, curStamina),
      colors: ["#32CD32", "#98FB98"],
    },
  ];
  const BAR_W = COL_W - 30;
  let barY = COL_TOP + 42;
  bars.forEach((b) => {
    ctx.fillStyle = "#cccccc";
    ctx.font = '11px "Inter", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(b.label, C1_X + 14, barY);
    barY += 5;
    drawRoundedProgressBar(
      ctx,
      C1_X + 14,
      barY,
      BAR_W,
      11,
      5.5,
      b.pct,
      b.colors,
    );
    barY += 25;
  });

  // Lokasi chip
  const LOCATION_NAMES_C = {
    desa: "Desa Pemula",
    village: "Desa Pemula",
    jalanan: "Pinggir Jalan",
    kota: "Kota Naura",
    city: "Kota Naura",
    hutan: "Hutan Pinus",
    laut: "Pantai Selatan",
    pantai: "Pantai Selatan",
    sawah: "Sawah Desa",
    tambang: "Tambang Kuno",
    academy: "Naura Academy",
    park: "Amusement Park",
    prison: "Penjara Kota",
  };
  const locKey = survival.currentLocation || "desa";
  const locName = LOCATION_NAMES_C[locKey] || locKey.toUpperCase();
  const locChipY = barY + 4;
  drawRoundedRect(ctx, C1_X + 14, locChipY, BAR_W, 30, 8, "rgba(0,0,0,0.35)");
  ctx.textAlign = "left";
  ctx.fillStyle = "#8e98b0";
  ctx.font = '10px "InterBold", sans-serif';
  ctx.fillText("LOKASI SAAT INI", C1_X + 20, locChipY + 12);
  ctx.fillStyle = "#00D9FF";
  ctx.font = '11px "Inter", sans-serif';
  ctx.fillText(locName, C1_X + 20, locChipY + 25);

  // ── COL 2: STATS ATRIBUT ──
  sectionHead("STATS ATRIBUT", C2_X, COL_TOP, "#9B59B6", 82);

  const statDefs = [
    { name: "Kekuatan", key: "strength", color: "#DC143C" },
    { name: "Kelincahan", key: "agility", color: "#00FA9A" },
    { name: "Kepintaran", key: "intelligence", color: "#9370DB" },
    { name: "Keberuntungan", key: "luck", color: "#FFD700" },
  ];
  const STAT_W = COL_W - 30;
  let stY = COL_TOP + 42;
  statDefs.forEach((st) => {
    const val = survival[st.key] || 1;
    const pct = (val / maxStatCap) * 100;
    drawRoundedRect(ctx, C2_X + 14, stY, STAT_W, 36, 8, "rgba(0,0,0,0.35)");
    ctx.fillStyle = st.color;
    ctx.fillRect(C2_X + 14, stY, 4, 36);
    ctx.textAlign = "left";
    ctx.fillStyle = "#eeeeee";
    ctx.font = '12px "InterBold", sans-serif';
    ctx.fillText(st.name, C2_X + 24, stY + 13);
    drawRoundedProgressBar(ctx, C2_X + 24, stY + 20, STAT_W - 60, 7, 3.5, pct, [
      st.color,
      st.color + "AA",
    ]);
    ctx.textAlign = "right";
    ctx.fillStyle = st.color;
    ctx.font = 'bold 12px "MontserratBold", sans-serif';
    ctx.fillText(`${val}/${maxStatCap}`, C2_X + 14 + STAT_W - 2, stY + 13);
    stY += 46;
  });

  // ── COL 3: KEAHLIAN ──
  sectionHead("KEAHLIAN", C3_X, COL_TOP, "#FFB6C1", 56);

  const className = rpgState.class || null;
  const CLASS_NAMES = {
    warrior: "Pejuang",
    mage: "Penyihir",
    rogue: "Pencuri",
    hunter: "Pemburu",
    healer: "Penyembuh",
    bard: "Penghibur",
  };
  const CLASS_SKILLS = {
    warrior: "Tebasan Badai",
    mage: "Ledakan Aura",
    rogue: "Bayangan Gelap",
    hunter: "Bidikan Tepat",
    healer: "Cahaya Suci",
    bard: "Melodi Jiwa",
  };
  const STAT_SKILL = [
    { key: "strength", skill: "Pukulan Keras", color: "#DC143C" },
    { key: "agility", skill: "Lari Kilat", color: "#00FA9A" },
    { key: "intelligence", skill: "Pikiran Tajam", color: "#9370DB" },
    { key: "luck", skill: "Hoki Murni", color: "#FFD700" },
  ];

  const dispClass = className
    ? CLASS_NAMES[className] || className
    : "Penyintas";
  const activeSkill = className
    ? CLASS_SKILLS[className] || "Kemampuan Khusus"
    : (() => {
        const best = STAT_SKILL.reduce((a, b) =>
          (survival[a.key] || 1) >= (survival[b.key] || 1) ? a : b,
        );
        return best.skill;
      })();
  const skillColor = className
    ? "#FFB6C1"
    : STAT_SKILL.find((s) => s.skill === activeSkill)?.color || "#FFB6C1";
  const SKILL_W = COL_W - 32;
  let skY = COL_TOP + 42;

  // Kelas badge
  drawRoundedRect(
    ctx,
    C3_X + 14,
    skY,
    SKILL_W,
    36,
    8,
    "rgba(255,182,193,0.10)",
  );
  ctx.textAlign = "left";
  ctx.fillStyle = "#8e98b0";
  ctx.font = '10px "InterBold", sans-serif';
  ctx.fillText("KELAS", C3_X + 20, skY + 13);
  ctx.textAlign = "right";
  ctx.fillStyle = "#FFB6C1";
  ctx.font = 'bold 14px "MontserratBold", sans-serif';
  ctx.fillText(dispClass, C3_X + 14 + SKILL_W - 6, skY + 24);
  skY += 44;

  // Skill aktif
  drawRoundedRect(ctx, C3_X + 14, skY, SKILL_W, 36, 8, "rgba(0,0,0,0.30)");
  ctx.fillStyle = skillColor;
  ctx.fillRect(C3_X + 14, skY + 9, 3, 18);
  ctx.textAlign = "left";
  ctx.fillStyle = "#8e98b0";
  ctx.font = '10px "InterBold", sans-serif';
  ctx.fillText("SKILL AKTIF", C3_X + 22, skY + 13);
  ctx.fillStyle = "#ffffff";
  ctx.font = '12px "Inter", sans-serif';
  ctx.fillText(activeSkill, C3_X + 22, skY + 27);
  skY += 44;

  // Berkah aktif
  const perks = rpgState.perks || {};
  const perkCount = Object.keys(perks).length;
  drawRoundedRect(ctx, C3_X + 14, skY, SKILL_W, 36, 8, "rgba(0,0,0,0.25)");
  ctx.textAlign = "left";
  ctx.fillStyle = "#8e98b0";
  ctx.font = '10px "InterBold", sans-serif';
  ctx.fillText("BERKAH AKTIF", C3_X + 22, skY + 13);
  ctx.fillStyle = perkCount > 0 ? "#00FA9A" : "#555";
  ctx.font = 'bold 12px "MontserratBold", sans-serif';
  ctx.fillText(
    perkCount > 0 ? `${perkCount} berkah` : "Belum ada",
    C3_X + 22,
    skY + 27,
  );
  skY += 44;

  // Pasif bonus
  const passives = [];
  if ((survival.strength || 1) > 1)
    passives.push(`HP +${(Math.min(survival.strength, maxStatCap) - 1) * 10}`);
  if ((survival.luck || 1) > 1) passives.push(`Hoki +${survival.luck - 1}`);
  if (passives.length > 0) {
    drawRoundedRect(ctx, C3_X + 14, skY, SKILL_W, 36, 8, "rgba(0,0,0,0.20)");
    ctx.textAlign = "left";
    ctx.fillStyle = "#8e98b0";
    ctx.font = '10px "InterBold", sans-serif';
    ctx.fillText("PASIF BONUS", C3_X + 22, skY + 13);
    ctx.fillStyle = "#FFD700";
    ctx.font = '11px "Inter", sans-serif';
    const passTxt = passives.join(" | ");
    ctx.fillText(
      passTxt.length > 28 ? passTxt.substring(0, 26) + "..." : passTxt,
      C3_X + 22,
      skY + 27,
    );
    skY += 44;
  }

  // Rebirth badge
  if (rebirthCount > 0) {
    drawRoundedRect(
      ctx,
      C3_X + 14,
      skY,
      SKILL_W,
      30,
      8,
      "rgba(255,215,0,0.12)",
    );
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFD700";
    ctx.font = 'bold 12px "InterBold", sans-serif';
    ctx.fillText(`REBIRTH x${rebirthCount}`, C3_X + 14 + SKILL_W / 2, skY + 19);
  }

  // ──────────────────────────────────────────
  // 7. DIVIDER 2
  // ──────────────────────────────────────────
  const DIV_Y2 = COL_TOP + COL_H + 16;
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fillRect(MARGIN + 10, DIV_Y2, W - (MARGIN + 10) * 2, 1);

  // ──────────────────────────────────────────
  // 8. BOTTOM ROW: Quest / Pet / NPC Spouse
  // ──────────────────────────────────────────
  const BOT_TOP = DIV_Y2 + 16;
  const BOT_H = 98;

  glassCard(C1_X, BOT_TOP, COL_W, BOT_H, "rgba(255,215,0,0.05)");
  glassCard(C2_X, BOT_TOP, COL_W, BOT_H, "rgba(50,205,50,0.05)");
  glassCard(C3_X, BOT_TOP, COL_W - 4, BOT_H, "rgba(255,100,160,0.05)");

  // Accent top border strips per card
  ctx.fillStyle = "rgba(255,215,0,0.45)";
  ctx.fillRect(C1_X, BOT_TOP, COL_W, 2);
  ctx.fillStyle = "rgba(50,205,50,0.45)";
  ctx.fillRect(C2_X, BOT_TOP, COL_W, 2);
  ctx.fillStyle = "rgba(255,100,160,0.45)";
  ctx.fillRect(C3_X, BOT_TOP, COL_W - 4, 2);

  // Quest card
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFD700";
  ctx.font = 'bold 11px "InterBold", sans-serif';
  ctx.fillText("QUEST", C1_X + 14, BOT_TOP + 18);
  let questText = "Tidak ada quest aktif";
  let questColor = "#8e98b0";
  if (!isRegistered) {
    questText = "Daftar via /survival start";
    questColor = "#FF8C00";
  } else if (gear && !gear.axe && !gear.pickaxe) {
    questText = "Tempa alat pertamamu!";
    questColor = "#FFD700";
  }
  const questWords = questText.split(" ");
  const questLines = [];
  let questLineStr = "";
  for (const w of questWords) {
    if ((questLineStr + w).length > 34 && questLineStr.length > 0) {
      questLines.push(questLineStr.trim());
      questLineStr = "";
    }
    questLineStr += w + " ";
  }
  if (questLineStr.trim()) questLines.push(questLineStr.trim());
  ctx.fillStyle = questColor;
  ctx.font = '12px "Inter", sans-serif';
  questLines
    .slice(0, 3)
    .forEach((ql, qi) => ctx.fillText(ql, C1_X + 14, BOT_TOP + 38 + qi * 17));

  // Pet card
  ctx.textAlign = "left";
  ctx.fillStyle = "#32CD32";
  ctx.font = 'bold 11px "InterBold", sans-serif';
  ctx.fillText("PET AKTIF", C2_X + 14, BOT_TOP + 18);
  const activePet =
    Array.isArray(activePets) && activePets.length > 0 ? activePets[0] : null;
  if (activePet) {
    const petName = activePet.petName || activePet.petType || "Pet";
    const petType = (activePet.petType || "").toLowerCase();
    const PET_COLORS = { wolf: "#DC143C", cat: "#FFB6C1", dragon: "#FF6B00" };
    const PET_BONUS_TXT = {
      wolf: "+2 Strength",
      cat: "+2 Luck",
      dragon: "+3 STR / +1 LUK",
    };
    ctx.fillStyle = PET_COLORS[petType] || "#32CD32";
    ctx.font = 'bold 13px "MontserratBold", sans-serif';
    ctx.fillText(petName, C2_X + 14, BOT_TOP + 42);
    ctx.fillStyle = "#8e98b0";
    ctx.font = '11px "Inter", sans-serif';
    ctx.fillText(
      PET_BONUS_TXT[petType] || "Teman setia",
      C2_X + 14,
      BOT_TOP + 58,
    );
    ctx.fillStyle = "#555";
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillText("Efek bonus aktif", C2_X + 14, BOT_TOP + 73);
  } else {
    ctx.fillStyle = "#555";
    ctx.font = '12px "Inter", sans-serif';
    ctx.fillText("Belum ada teman berbulu", C2_X + 14, BOT_TOP + 46);
    ctx.fillStyle = "#444";
    ctx.font = '11px "Inter", sans-serif';
    ctx.fillText("Pelihara di /survival pet", C2_X + 14, BOT_TOP + 63);
  }

  // NPC Spouse card
  ctx.textAlign = "left";
  ctx.fillStyle = "#FF64A0";
  ctx.font = 'bold 11px "InterBold", sans-serif';
  ctx.fillText("PASANGAN NPC", C3_X + 14, BOT_TOP + 18);
  const npc =
    Array.isArray(marriedNPCs) && marriedNPCs.length > 0
      ? marriedNPCs[0]
      : null;
  if (npc) {
    const npcId = npc.npcId || "NPC";
    ctx.fillStyle = "#FFB6C1";
    ctx.font = 'bold 13px "MontserratBold", sans-serif';
    ctx.fillText(npcId, C3_X + 14, BOT_TOP + 42);
    ctx.fillStyle = "#8e98b0";
    ctx.font = '11px "Inter", sans-serif';
    ctx.fillText("Status: Menikah", C3_X + 14, BOT_TOP + 58);
    const npcAffection = npc.affection || npc.affectionPoints || 0;
    if (npcAffection > 0) {
      ctx.fillStyle = "#FF64A0";
      ctx.font = '11px "Inter", sans-serif';
      ctx.fillText(`Kasih sayang: ${npcAffection}`, C3_X + 14, BOT_TOP + 73);
    }
  } else {
    ctx.fillStyle = "#555";
    ctx.font = '12px "Inter", sans-serif';
    ctx.fillText("Masih sendiri~", C3_X + 14, BOT_TOP + 46);
    ctx.fillStyle = "#444";
    ctx.font = '11px "Inter", sans-serif';
    ctx.fillText("Kunjungi NPC di /npc chat", C3_X + 14, BOT_TOP + 63);
  }

  // ──────────────────────────────────────────
  // 9. DIVIDER 3
  // ──────────────────────────────────────────
  const DIV_Y3 = BOT_TOP + BOT_H + 14;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(MARGIN + 10, DIV_Y3, W - (MARGIN + 10) * 2, 1);

  // ──────────────────────────────────────────
  // 10. FOOTER BAR (Naura branded)
  // ──────────────────────────────────────────
  const FOOT_TOP = DIV_Y3 + 10;
  const FOOT_H = 46;
  const FOOT_MID = FOOT_TOP + FOOT_H / 2;

  // Footer glass card
  drawRoundedRect(
    ctx,
    MARGIN + 4,
    FOOT_TOP,
    W - (MARGIN + 4) * 2,
    FOOT_H,
    10,
    "rgba(255,182,193,0.05)",
  );

  // Gradient wash left -> right
  const footGrad = ctx.createLinearGradient(MARGIN + 4, 0, W - MARGIN - 4, 0);
  footGrad.addColorStop(0, "rgba(255,182,193,0.10)");
  footGrad.addColorStop(1, "rgba(255,182,193,0)");
  ctx.fillStyle = footGrad;
  ctx.beginPath();
  if (ctx.roundRect)
    ctx.roundRect(MARGIN + 4, FOOT_TOP, W - (MARGIN + 4) * 2, FOOT_H, 10);
  else ctx.rect(MARGIN + 4, FOOT_TOP, W - (MARGIN + 4) * 2, FOOT_H);
  ctx.fill();

  // Naura bot avatar circle
  const BOT_AVA_R = 17;
  const BOT_AVA_CX = MARGIN + 22 + BOT_AVA_R;
  if (botAvatar) {
    try {
      const botImg = await loadImage(botAvatar);
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = "rgba(255,182,193,0.5)";
      ctx.beginPath();
      ctx.arc(BOT_AVA_CX, FOOT_MID, BOT_AVA_R + 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,182,193,0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.arc(BOT_AVA_CX, FOOT_MID, BOT_AVA_R, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(
        botImg,
        BOT_AVA_CX - BOT_AVA_R,
        FOOT_MID - BOT_AVA_R,
        BOT_AVA_R * 2,
        BOT_AVA_R * 2,
      );
      ctx.restore();
    } catch (err) {
      logger.warn("[CanvasUtils:generateSurvivalProfileImage] Render visual canvas atau pemuatan aset gagal: " + (err?.message || err));
    }
  }

  // System label
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,182,193,0.85)";
  ctx.font = 'bold 13px "MontserratBold", sans-serif';
  ctx.fillText(
    "Naura Survival System",
    BOT_AVA_CX + BOT_AVA_R + 10,
    FOOT_MID + 5,
  );

  // Right side: game time & version
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(142,152,176,0.65)";
  ctx.font = '11px "Inter", sans-serif';
  const dayNum = survival.inGameDay || 1;
  const hourNum = (survival.inGameHour || 6).toString().padStart(2, "0");
  ctx.fillText(
    `Hari ke-${dayNum}  |  ${hourNum}:00  |  v${BOT_VERSION}`,
    W - MARGIN - 16,
    FOOT_MID + 5,
  );

  return canvas.toBuffer("image/png");
}

// ==========================================
// 🎵 MUSIC PROFILE CANVAS  -  PREMIUM REDESIGN
// Canvas: 1100 x 680px
// ==========================================
module.exports = { generateSurvivalProfileImage };
