"use strict";

/**
 * @module inventorySortFilter
 * @description Helper module untuk sorting dan filtering inventory items.
 * 
 * Fitur Utama:
 * - Multi-key sorting algorithms
 * - Category-based filtering
 * - Search by name substring
 */


const { logger } = require("../../../src/managers/logger");
// ============================================================================
// CONSTANTS
// ============================================================================

const cacheManager = require("../../../src/managers/cacheManager");
const { safeParseAndRemapInventory } = require("../../../src/survival/engines/inventoryHelper");

const SORT_MODES = ["name", "type", "rarity", "value", "quantity"];
const RARITY_ORDER = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
const PAGE_SIZE = 10;

class InventorySortFilter {
  /**
   * Sort dan filter inventory dengan pagination
   * @param {string} userId
   * @param {object} options - { sortBy, filterType, filterRarity, searchQuery, page }
   * @returns {Promise<{ items: Array, total: number, page: number, totalPages: number, filters: object }>}
   */
  static async getSortedInventory(userId, options = {}) {
    try {
      const profile = await cacheManager.getUserProfile(userId);
      if (!profile) {
        return { items: [], total: 0, page: 1, totalPages: 0, filters: options };
      }

      let items = safeParseAndRemapInventory(profile.inventory);

      if (options.filterType) {
        items = items.filter((i) => i.type === options.filterType);
      }

      if (options.filterRarity) {
        items = items.filter((i) => (i.rarity || "common") === options.filterRarity);
      }

      if (options.searchQuery) {
        const query = options.searchQuery.toLowerCase();
        items = items.filter((i) =>
          (i.name || "").toLowerCase().includes(query) ||
          (i.id || "").toLowerCase().includes(query)
        );
      }

      const sortBy = SORT_MODES.includes(options.sortBy) ? options.sortBy : "name";
      items = this._sortItems(items, sortBy);

      const total = items.length;
      const page = Math.max(1, options.page || 1);
      const totalPages = Math.ceil(total / PAGE_SIZE);
      const start = (page - 1) * PAGE_SIZE;
      const paginatedItems = items.slice(start, start + PAGE_SIZE);

      return {
        items: paginatedItems,
        total,
        page,
        totalPages,
        filters: {
          sortBy,
          filterType: options.filterType || null,
          filterRarity: options.filterRarity || null,
          searchQuery: options.searchQuery || null,
        },
      };
    } catch (error) {
      logger.error(`[InventorySortFilter] Error for user ${userId}:`, error);
      return { items: [], total: 0, page: 1, totalPages: 0, filters: options };
    }
  }

  static _sortItems(items, sortBy) {
    const sorted = [...items];

    switch (sortBy) {
      case "name":
        sorted.sort((a, b) => (a.name || a.id || "").localeCompare(b.name || b.id || ""));
        break;
      case "type":
        sorted.sort((a, b) => (a.type || "").localeCompare(b.type || ""));
        break;
      case "rarity":
        sorted.sort((a, b) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0));
        break;
      case "value":
        sorted.sort((a, b) => (b.price || b.value || 0) - (a.price || a.value || 0));
        break;
      case "quantity":
        sorted.sort((a, b) => (b.quantity || b.count || 0) - (a.quantity || a.count || 0));
        break;
    }

    return sorted;
  }

  static getSortModes() {
    return [...SORT_MODES];
  }
}

// ============================================================================
// HANDLER
// ============================================================================

module.exports = { InventorySortFilter, SORT_MODES, PAGE_SIZE };
