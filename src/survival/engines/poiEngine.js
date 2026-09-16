"use strict";

const worldMapData = require("../data/worldMapData");
const npcs = require("../data/npcs");
const npcPerksEngine = require("./npcPerksEngine");

/**
 * Mengecek apakah sebuah POI sedang buka pada jam in-game tertentu
 * @param {object} poi
 * @param {number} hour (0 - 23)
 * @returns {boolean}
 */
function isPoiOpen(poi, hour) {
  if (!poi || !poi.operatingHours) return true;
  const { start, end } = poi.operatingHours;

  if (start === 0 && end === 24) return true;
  if (start <= end) {
    return hour >= start && hour < end;
  }
  // Operasional lintas tengah malam (misal 18:00 - 06:00)
  return hour >= start || hour < end;
}

/**
 * Mengambil daftar POI untuk region tertentu beserta status operasionalnya
 * @param {string} regionKey
 * @param {number} inGameHour
 * @returns {Array<object>}
 */
function getActivePois(regionKey, inGameHour = 6) {
  const pois = worldMapData.getPoisForRegion(regionKey);
  return pois.map((poi) => {
    const isOpen = isPoiOpen(poi, inGameHour);
    const residents = (poi.residentNpcIds || [])
      .map((id) => npcs[id])
      .filter(Boolean);

    return {
      ...poi,
      isOpen,
      statusLabel: isOpen ? "Buka" : "Tutup",
      residents,
    };
  });
}

/**
 * Mengambil detail lengkap sebuah POI beserta keuntungan relasi pemain
 * @param {string} poiId
 * @param {number} inGameHour
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getPoiDetail(poiId, inGameHour = 6, userId = null) {
  const poi = worldMapData.getPoiById(poiId);
  if (!poi) return null;

  const isOpen = isPoiOpen(poi, inGameHour);
  const residents = [];

  for (const id of poi.residentNpcIds || []) {
    const npc = npcs[id];
    if (!npc) continue;

    let rel = { level: 0, title: "Kenalan", affection: 0, isMarried: false };
    let discount = { discountPercent: 0 };

    if (userId) {
      rel = await npcPerksEngine.getNpcRelationship(userId, id);
      discount = await npcPerksEngine.calculateDiscount(userId, id, 100);
    }

    residents.push({
      ...npc,
      relationshipLevel: rel.level,
      relationshipTitle: rel.title,
      affection: rel.affection,
      isMarried: rel.isMarried,
      discountPercent: discount.discountPercent,
    });
  }

  return {
    ...poi,
    isOpen,
    statusLabel: isOpen ? "Buka" : "Tutup",
    residents,
  };
}

module.exports = {
  isPoiOpen,
  getActivePois,
  getPoiDetail,
};
